import type { ErrorBoundaryProps } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import { Redirect, Tabs } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, AppState, Text, View } from "react-native";
import { Button } from "@/components/Button";
import { CivicBottomBar, type TabKey } from "@/components/CivicBottomBar";
import { demoMode } from "@/config/env";
import { usePushRegistration } from "@/hooks/usePushRegistration";
import { useLocationSync } from "@/hooks/useLocationSync";
import { useRealtimeChannel } from "@/hooks/useRealtimeChannel";
import { supabase } from "@/services/supabase";
import { callFunction } from "@/services/api";
import { setAppBadgeCount } from "@/services/notifications";
import { captureClientError } from "@/services/clientLogger";
import { useAppStore } from "@/stores/appStore";
import { useUnreadNotificationCount } from "@/hooks/useUnreadNotificationCount";

export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const loggedMessageRef = useRef<string | null>(null);

  useEffect(() => {
    if (loggedMessageRef.current === error.message) return;
    loggedMessageRef.current = error.message;
    captureClientError("tabs_screen_error", error, {}, "fatal");
  }, [error]);

  return (
    <View className="flex-1 justify-center gap-4 bg-bg px-6">
      <Text className="text-2xl font-bold text-ink">Sezione non disponibile</Text>
      <Text className="text-sm leading-5 text-muted">Paraggi ha protetto la sessione da un errore della schermata. Puoi riprovare senza riaprire l'app.</Text>
      <View className="rounded-card border border-danger bg-white p-4">
        <Text className="font-semibold text-danger">Dettaglio tecnico</Text>
        <Text className="mt-1 text-sm leading-5 text-muted">{error.message}</Text>
      </View>
      <Button label="Riprova" onPress={retry} />
    </View>
  );
}

export default function TabsLayout() {
  const queryClient = useQueryClient();
  const [isCheckingSession, setIsCheckingSession] = useState(!demoMode);
  const [hasSession, setHasSession] = useState(demoMode);
  const [userId, setUserId] = useState<string | null>(null);
  const startupPermissionsStartedRef = useRef(false);
  const lastPresenceSyncRef = useRef(0);
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
  const notificationBadge = useUnreadNotificationCount();
  const notificationUnreadCount = notificationBadge.data ?? 0;

  useEffect(() => {
    if (!userId || demoMode) {
      void setAppBadgeCount(0);
      return;
    }
    if (chatBadge.isSuccess && notificationBadge.isSuccess) {
      void setAppBadgeCount(chatUnreadCount + notificationUnreadCount);
    }
  }, [chatBadge.isSuccess, chatUnreadCount, notificationBadge.isSuccess, notificationUnreadCount, userId]);

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

  useEffect(() => {
    if (demoMode || !userId) return;

    const refreshPresence = async () => {
      if (Date.now() - lastPresenceSyncRef.current < 4 * 60 * 1000) return;
      const permission = await Location.getForegroundPermissionsAsync();
      if (permission.status !== "granted") return;
      lastPresenceSyncRef.current = Date.now();
      const result = await syncLocation();
      if (result.ok) await queryClient.invalidateQueries({ queryKey: ["nearby-feed"] });
    };

    const interval = setInterval(() => {
      if (AppState.currentState === "active") void refreshPresence();
    }, 5 * 60 * 1000);
    const appStateSubscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void refreshPresence();
    });

    return () => {
      clearInterval(interval);
      appStateSubscription.remove();
    };
  }, [queryClient, syncLocation, userId]);

  if (isCheckingSession) {
    return (
      <View className="flex-1 items-center justify-center bg-bg">
        <ActivityIndicator />
      </View>
    );
  }

  if (!hasSession) return <Redirect href="/(auth)/login" />;

  return (
    <Tabs tabBar={({ state, navigation }) => (
      <CivicBottomBar
        unreadCount={chatUnreadCount}
        activeTab={state.routes[state.index]?.name as TabKey}
        onNavigate={(tab) => navigation.navigate(tab)}
      />
    )} screenOptions={{
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
