import { Ionicons } from "@expo/vector-icons";
import { Redirect, Tabs } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { demoMode } from "@/config/env";
import { usePushRegistration } from "@/hooks/usePushRegistration";
import { useLocationSync } from "@/hooks/useLocationSync";
import { useRealtimeChannel } from "@/hooks/useRealtimeChannel";
import { supabase } from "@/services/supabase";

const icons = {
  feed: ["radio-outline", "radio"] as const,
  heatmap: ["map-outline", "map"] as const,
  chats: ["chatbubbles-outline", "chatbubbles"] as const,
  history: ["trail-sign-outline", "trail-sign"] as const
};

export default function TabsLayout() {
  const [isCheckingSession, setIsCheckingSession] = useState(!demoMode);
  const [hasSession, setHasSession] = useState(demoMode);
  const [userId, setUserId] = useState<string | null>(null);
  const startupPermissionsStartedRef = useRef(false);
  const registerPush = usePushRegistration();
  const syncLocation = useLocationSync();
  useRealtimeChannel(userId ? { type: "notifications", userId } : null);

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
      await syncLocation();
      await registerPush({ showLocalConfirmation: false });
    })();
  }, [registerPush, syncLocation, userId]);

  if (isCheckingSession) {
    return (
      <View className="flex-1 items-center justify-center bg-bg">
        <ActivityIndicator />
      </View>
    );
  }

  if (!hasSession) return <Redirect href="/(auth)/login" />;

  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarHideOnKeyboard: true,
      tabBarActiveTintColor: "#16808a",
      tabBarInactiveTintColor: "#62717a",
      tabBarLabelStyle: { fontSize: 12, fontWeight: "700" },
      tabBarItemStyle: { justifyContent: "center" },
      tabBarStyle: { height: 72, paddingTop: 7, paddingBottom: 9, backgroundColor: "#ffffff", borderTopColor: "#d9e2e3" },
      sceneStyle: { backgroundColor: "#ffffff" }
    }}>
      <Tabs.Screen name="feed" options={{ title: "Vicino", tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? icons.feed[1] : icons.feed[0]} size={22} color={color} /> }} />
      <Tabs.Screen name="heatmap" options={{ title: "Mappa", tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? icons.heatmap[1] : icons.heatmap[0]} size={22} color={color} /> }} />
      <Tabs.Screen name="create" options={{
        title: "Pubblica",
        tabBarLabelStyle: { color: "#16808a", fontSize: 12, fontWeight: "700" },
        tabBarIcon: () => <View className="-mt-5 h-14 w-14 items-center justify-center rounded-full border-4 border-white bg-primary"><Ionicons name="add" size={29} color="#ffffff" /></View>
      }} />
      <Tabs.Screen name="chats" options={{ title: "Chat", tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? icons.chats[1] : icons.chats[0]} size={22} color={color} /> }} />
      <Tabs.Screen name="history" options={{ title: "Aree", tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? icons.history[1] : icons.history[0]} size={22} color={color} /> }} />
      <Tabs.Screen name="profile" options={{ href: null }} />
    </Tabs>
  );
}
