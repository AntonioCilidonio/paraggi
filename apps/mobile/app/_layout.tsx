import "../global.css";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo } from "react";
import { assertEnv } from "@/config/env";
import { installGlobalErrorLogger } from "@/services/clientLogger";
import { configureNotifications } from "@/services/notifications";

export default function RootLayout() {
  const queryClient = useMemo(() => new QueryClient(), []);
  assertEnv();

  useEffect(() => {
    installGlobalErrorLogger();
    void configureNotifications();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="post" />
        <Stack.Screen name="chat" />
        <Stack.Screen name="settings" />
      </Stack>
    </QueryClientProvider>
  );
}
