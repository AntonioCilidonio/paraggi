import { useQueryClient } from "@tanstack/react-query";
import Constants from "expo-constants";
import { useEffect } from "react";
import { Platform } from "react-native";
import { demoMode } from "@/config/env";
import { sendLocalNotification } from "@/services/notifications";
import { supabase } from "@/services/supabase";

type RealtimeTarget =
  | { type: "post-comments"; postId: string }
  | { type: "chat-messages"; chatId: string }
  | { type: "chat-status"; chatId: string }
  | { type: "notifications"; userId: string };

export function useRealtimeChannel(target: RealtimeTarget | null) {
  const queryClient = useQueryClient();
  const targetType = target?.type;
  const postId = target?.type === "post-comments" ? target.postId : undefined;
  const chatId = target?.type === "chat-messages" || target?.type === "chat-status" ? target.chatId : undefined;
  const userId = target?.type === "notifications" ? target.userId : undefined;

  useEffect(() => {
    if (!targetType || demoMode) return;

    const channelName = targetType === "post-comments" && postId
      ? `post:${postId}:comments`
      : targetType === "chat-messages" && chatId
        ? `chat:${chatId}:messages`
        : targetType === "chat-status" && chatId
          ? `chat:${chatId}:status`
          : targetType === "notifications" && userId
            ? `user:${userId}:notifications`
            : null;

    if (!channelName) return;

    const channel = supabase.channel(channelName);

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
      channel.on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` }, (payload) => {
        const notification = payload.new as { title?: string; body?: string; type?: string; deep_link?: string };
        const nativePushConfigured = Constants.expoConfig?.extra?.nativePushConfigured as Record<string, boolean> | undefined;
        if (nativePushConfigured?.[Platform.OS] !== true) {
          void sendLocalNotification(
            notification.title ?? "Paraggi",
            notification.body ?? "Hai una nuova notifica vicina.",
            { type: notification.type, deepLink: notification.deep_link }
          );
        }
        void queryClient.invalidateQueries({ queryKey: ["notifications"] });
        if (notification.type === "comment_received" || notification.type === "nearby_relevant_post") {
          void queryClient.invalidateQueries({ queryKey: ["nearby-feed"] });
        }
        if (notification.type === "private_request" || notification.type === "request_accepted" || notification.type === "private_message") {
          void queryClient.invalidateQueries({ queryKey: ["chats"] });
        }
      });
      channel.on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${userId}` }, () => {
        void queryClient.invalidateQueries({ queryKey: ["profile-summary"] });
        void queryClient.invalidateQueries({ queryKey: ["nearby-feed"] });
      });
    }

    void channel.subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [chatId, postId, queryClient, targetType, userId]);
}
