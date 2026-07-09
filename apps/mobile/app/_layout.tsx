import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useMemo } from "react";
import { assertEnv } from "@/config/env";

export default function RootLayout() {
  const queryClient = useMemo(() => new QueryClient(), []);
  assertEnv();

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

