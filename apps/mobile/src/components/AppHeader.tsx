import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { useAppStore } from "@/stores/appStore";

function formatRadius(radiusMeters: number) {
  if (radiusMeters >= 1000) return `${radiusMeters / 1000} km`;
  return `${radiusMeters} m`;
}

export function AppHeader() {
  const radiusMeters = useAppStore((state) => state.radiusMeters);
  const currentAreaName = useAppStore((state) => state.currentAreaName);
  const currentCity = useAppStore((state) => state.currentCity);
  const place = currentAreaName ?? currentCity ?? "Area da aggiornare";

  return (
    <View className="flex-row items-center justify-between gap-3 border-b border-border pb-4">
      <View className="flex-1 flex-row items-center gap-3">
        <View className="h-10 w-10 items-center justify-center rounded-card bg-primary">
          <Ionicons name="radio" size={21} color="#ffffff" />
        </View>
        <View className="flex-1">
          <Text className="text-lg font-bold text-ink">Paraggi</Text>
          <Text className="mt-0.5 text-xs text-muted" numberOfLines={1}>{place} · entro {formatRadius(radiusMeters)}</Text>
        </View>
      </View>
      <View className="flex-row gap-2">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Apri notifiche"
          onPress={() => router.push("/notifications")}
          className="h-11 w-11 items-center justify-center rounded-card border border-border bg-white"
        >
          <Ionicons name="notifications-outline" size={21} color="#17232b" />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Apri profilo"
          onPress={() => router.push("/(tabs)/profile")}
          className="h-11 w-11 items-center justify-center rounded-card bg-primary"
        >
          <Ionicons name="person-outline" size={21} color="#ffffff" />
        </Pressable>
      </View>
    </View>
  );
}
