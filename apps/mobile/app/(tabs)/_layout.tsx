import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import { Redirect, Tabs } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { CivicBottomBar } from "@/components/CivicBottomBar";
import { demoMode } from "@/config/env";
import { usePushRegistration } from "@/hooks/usePushRegistration";
import { useLocationSync } from "@/hooks/useLocationSync";
import { useRealtimeChannel } from "@/hooks/useRealtimeChannel";
import { supabase } from "@/services/supabase";
import { callFunction } from "@/services/api";
import { setAppBadgeCount } from "@/services/notifications";
import { useAppStore } from "@/stores/appStore";

export default function TabsLayout() {
  const queryClient = useQueryClient();
  const [isCheckingSession, setIsCheckingSession] = useState(!demoMode);
  const [hasSession, setHasSession] = useState(demoMode);
  const [userId, setUserId] = useState<string | null>(null);
  const startupPermissionsStartedRef = useRef(false);
  const registerPush = usePushRegistration();
  const syncLocation = useLocationSync();
  const setLocationPermission = useAppStore((state) => state.setLocationPermission);
  const setNotificationPermission = useAppStore((state) => state.setNotificationPermission);
  useRealtimeChannel(userId ? { type: "notifications", userId } : null);
  const chatBadge = useQuery({
    queryKey: ["chats", "badge", userId],
    enabled: demoMode || Boolean(userId),
    refetchInterval: demoMode ? false : 30000,
    queryFn: async () => {
      if (demoMode) return { totalUnread: 0 };
      return callFunction<{ totalUnread: number }>("get-chat-inbox", { method: "GET" });
    }
  });
  const chatUnreadCount = chatBadge.data?.totalUnread ?? 0;

  useEffect(() => {
    if (!userId || demoMode) {
      void setAppBadgeCount(0);
      return;
    }
    if (chatBadge.isSuccess) void setAppBadgeCount(chatUnreadCount);
  }, [chatBadge.isSuccess, chatUnreadCount, userId]);

  useEffect(() => {
    if (demoMode) return;

    let isMounted = true;
    void supabase.auth.getUser().then(({ data, error }) => {
      if (!isMounted) return;
      const isAuthenticated = !error && Boolean(data.user);
      setHasSession(isAuthenticated);
      setUserId(isAuthenticated ? data.user?.id ?? null : null);
      setIsCheckingSession(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setHasSession(Boolean(session));
      setUserId(session?.user.id ?? null);
      setIsCheckingSession(false);
    });

    return () => {
      isMounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (demoMode || !userId || startupPermissionsStartedRef.current) return;
    startupPermissionsStartedRef.current = true;
    void (async () => {
      const [locationPermission, notificationPermission] = await Promise.all([
        Location.getForegroundPermissionsAsync(),
        Notifications.getPermissionsAsync()
      ]);
      setLocationPermission(locationPermission.status === "granted" ? "granted" : locationPermission.status === "denied" ? "denied" : "unknown");
      setNotificationPermission(notificationPermission.status === "granted" ? "granted" : notificationPermission.status === "denied" ? "denied" : "unknown");
      const locationSync = await syncLocation();
      if (locationSync.ok) await queryClient.invalidateQueries({ queryKey: ["nearby-feed"] });
      await registerPush({ showLocalConfirmation: false });
    })();
  }, [queryClient, registerPush, setLocationPermission, setNotificationPermission, syncLocation, userId]);

  if (isCheckingSession) {
    return (
      <View className="flex-1 items-center justify-center bg-bg">
        <ActivityIndicator />
      </View>
    );
  }

  if (!hasSession) return <Redirect href="/(auth)/login" />;

  return (
    <Tabs tabBar={() => <CivicBottomBar unreadCount={chatUnreadCount} />} screenOptions={{
      headerShown: false,
      tabBarHideOnKeyboard: true,
      sceneStyle: { backgroundColor: "#eef6ff" }
    }}>
      <Tabs.Screen name="feed" options={{ title: "Vicino" }} />
      <Tabs.Screen name="heatmap" options={{ title: "Mappa" }} />
      <Tabs.Screen name="create" options={{ title: "Pubblica" }} />
      <Tabs.Screen name="chats" options={{ title: "Chat" }} />
      <Tabs.Screen name="history" options={{ title: "Aree" }} />
      <Tabs.Screen name="profile" options={{ href: null }} />
    </Tabs>
  );
}
