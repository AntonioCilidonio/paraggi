import { useQueryClient } from "@tanstack/react-query";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { useEffect, useRef } from "react";
import { AppState, Platform } from "react-native";
import { demoMode } from "@/config/env";
import { sendLocalNotification } from "@/services/notifications";
import { supabase } from "@/services/supabase";

type RealtimeTarget =
  | { type: "post-comments"; postId: string }
  | { type: "chat-messages"; chatId: string }
  | { type: "chat-status"; chatId: string }
  | { type: "notifications"; userId: string };

let nextChannelInstanceId = 0;

type NotificationRow = {
  id?: string;
  title?: string;
  body?: string;
  type?: string;
  deep_link?: string;
  created_at?: string;
};

const notificationCursorKey = (userId: string) => `paraggi:notification-cursor:${userId}`;

export function useRealtimeChannel(target: RealtimeTarget | null) {
  const queryClient = useQueryClient();
  const channelInstanceIdRef = useRef<number | null>(null);
  const subscriptionSequenceRef = useRef(0);
  if (channelInstanceIdRef.current === null) {
    nextChannelInstanceId += 1;
    channelInstanceIdRef.current = nextChannelInstanceId;
  }
  const targetType = target?.type;
  const postId = target?.type === "post-comments" ? target.postId : undefined;
  const chatId = target?.type === "chat-messages" || target?.type === "chat-status" ? target.chatId : undefined;
  const userId = target?.type === "notifications" ? target.userId : undefined;

  useEffect(() => {
    if (!targetType || demoMode) return;

    const channelBaseName = targetType === "post-comments" && postId
      ? `post:${postId}:comments`
      : targetType === "chat-messages" && chatId
        ? `chat:${chatId}:messages`
        : targetType === "chat-status" && chatId
          ? `chat:${chatId}:status`
          : targetType === "notifications" && userId
            ? `user:${userId}:notifications`
            : null;

    if (!channelBaseName) return;

    subscriptionSequenceRef.current += 1;
    const channelName = `${channelBaseName}:${channelInstanceIdRef.current}:${subscriptionSequenceRef.current}`;
    const channel = supabase.channel(channelName);
    let notificationPoll: ReturnType<typeof setInterval> | undefined;
    let notificationAppStateSubscription: ReturnType<typeof AppState.addEventListener> | undefined;
    let notificationCursor: string | null = null;
    let notificationSyncReady = false;
    let notificationSyncRunning = false;
    const handledNotificationIds = new Set<string>();

    if (targetType === "post-comments" && postId) {
      channel.on("postgres_changes", { event: "*", schema: "public", table: "comments", filter: `post_id=eq.${postId}` }, () => {
        void queryClient.invalidateQueries({ queryKey: ["comments", postId] });
        void queryClient.invalidateQueries({ queryKey: ["post-detail", postId] });
        void queryClient.invalidateQueries({ queryKey: ["nearby-feed"] });
      });
    }

    if (targetType === "chat-messages" && chatId) {
      channel.on("postgres_changes", { event: "*", schema: "public", table: "private_messages", filter: `chat_id=eq.${chatId}` }, () => {
        void queryClient.invalidateQueries({ queryKey: ["chat-thread", chatId] });
      });
    }

    if (targetType === "chat-status" && chatId) {
      channel.on("postgres_changes", { event: "UPDATE", schema: "public", table: "private_chats", filter: `id=eq.${chatId}` }, () => {
        void queryClient.invalidateQueries({ queryKey: ["chat-thread", chatId] });
      });
    }

    if (targetType === "notifications" && userId) {
      const refreshForNotification = (notification: NotificationRow) => {
        void queryClient.invalidateQueries({ queryKey: ["notifications"] });
        if (notification.type === "comment_received" || notification.type === "nearby_relevant_post") {
          void queryClient.invalidateQueries({ queryKey: ["nearby-feed"] });
        }
        if (notification.type === "private_request" || notification.type === "request_accepted" || notification.type === "private_message") {
          void queryClient.invalidateQueries({ queryKey: ["chats"] });
        }
      };

      const presentNotification = async (notification: NotificationRow) => {
        if (notification.id && handledNotificationIds.has(notification.id)) return;
        if (notification.id) handledNotificationIds.add(notification.id);
        const nativePushConfigured = Constants.expoConfig?.extra?.nativePushConfigured as Record<string, boolean> | undefined;
        if (nativePushConfigured?.[Platform.OS] !== true) {
          await sendLocalNotification(
            notification.title ?? "Paraggi",
            notification.body ?? "Hai una nuova notifica vicina.",
            { type: notification.type, deepLink: notification.deep_link },
            { urgent: notification.type === "danger_alert" }
          );
        }
        refreshForNotification(notification);
        if (notification.created_at && (!notificationCursor || notification.created_at > notificationCursor)) {
          notificationCursor = notification.created_at;
          await AsyncStorage.setItem(notificationCursorKey(userId), notification.created_at);
        }
      };

      const syncNotifications = async () => {
        if (notificationSyncRunning || AppState.currentState !== "active") return;
        notificationSyncRunning = true;
        try {
          if (!notificationSyncReady) {
            notificationCursor = await AsyncStorage.getItem(notificationCursorKey(userId));
            if (!notificationCursor) {
              const { data } = await supabase
                .from("notifications")
                .select("created_at")
                .eq("user_id", userId)
                .order("created_at", { ascending: false })
                .limit(1)
                .maybeSingle();
              const initialCursor = data?.created_at ?? new Date().toISOString();
              notificationCursor = initialCursor;
              await AsyncStorage.setItem(notificationCursorKey(userId), initialCursor);
              notificationSyncReady = true;
              return;
            }
            notificationSyncReady = true;
          }

          const { data, error } = await supabase
            .from("notifications")
            .select("id,title,body,type,deep_link,created_at")
            .eq("user_id", userId)
            .gt("created_at", notificationCursor)
            .order("created_at", { ascending: true })
            .limit(20);
          if (error) return;
          for (const notification of data ?? []) {
            await presentNotification(notification);
          }
        } finally {
          notificationSyncRunning = false;
        }
      };

      channel.on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` }, (payload) => {
        void presentNotification(payload.new as NotificationRow);
      });
      channel.on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${userId}` }, () => {
        void queryClient.invalidateQueries({ queryKey: ["profile-summary"] });
        void queryClient.invalidateQueries({ queryKey: ["nearby-feed"] });
      });

      void syncNotifications();
      notificationPoll = setInterval(() => void syncNotifications(), 10_000);
      notificationAppStateSubscription = AppState.addEventListener("change", (state) => {
        if (state === "active") void syncNotifications();
      });
    }

    void channel.subscribe((status) => {
      if (status === "SUBSCRIBED" && targetType === "notifications") {
        void queryClient.invalidateQueries({ queryKey: ["notifications"] });
        void queryClient.invalidateQueries({ queryKey: ["nearby-feed"] });
      }
    });

    return () => {
      if (notificationPoll) clearInterval(notificationPoll);
      notificationAppStateSubscription?.remove();
      void supabase.removeChannel(channel);
    };
  }, [chatId, postId, queryClient, targetType, userId]);
}
