import { Redirect } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { demoMode } from "@/config/env";
import { supabase } from "@/services/supabase";

export default function Index() {
  const [target, setTarget] = useState<"/(tabs)/feed" | "/(auth)/login" | null>(null);

  useEffect(() => {
    if (demoMode) {
      setTarget("/(tabs)/feed");
      return;
    }

    void supabase.auth.getUser().then(({ data, error }) => {
      setTarget(!error && data.user ? "/(tabs)/feed" : "/(auth)/login");
    });
  }, []);

  if (target) return <Redirect href={target} />;

  return (
    <View className="flex-1 items-center justify-center bg-bg">
      <ActivityIndicator />
    </View>
  );
}
