import "../global.css";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo } from "react";
import { Platform } from "react-native";
import { assertEnv } from "@/config/env";
import { installGlobalErrorLogger } from "@/services/clientLogger";
import { NotificationResponseHandler } from "@/components/NotificationResponseHandler";

export default function RootLayout() {
  const queryClient = useMemo(() => new QueryClient(), []);
  assertEnv();

  useEffect(() => {
    installGlobalErrorLogger();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="light" backgroundColor="#3b82c4" translucent={Platform.OS === "android"} />
      <NotificationResponseHandler />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="post" />
        <Stack.Screen name="chat" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="notifications" />
        <Stack.Screen name="danger" />
        <Stack.Screen name="area" />
        <Stack.Screen name="media-view" />
        <Stack.Screen name="profile-preview" />
      </Stack>
    </QueryClientProvider>
  );
}
