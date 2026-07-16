import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";

export function AppHeader() {
  return (
    <View className="-mx-4 -mt-3 flex-row items-center justify-between gap-3 bg-primary-strong px-4 pb-4 pt-4">
      <View className="flex-1 flex-row items-center gap-3">
        <View className="h-10 w-10 items-center justify-center rounded-card bg-white/15">
          <Ionicons name="radio" size={21} color="#ffffff" />
        </View>
        <View className="flex-1">
          <Text className="text-lg font-semibold text-white">Paraggi</Text>
          <Text className="mt-0.5 text-xs text-white/70" numberOfLines={1}>La piazza digitale vicina</Text>
        </View>
      </View>
      <View className="flex-row gap-2">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Apri notifiche"
          onPress={() => router.push("/notifications")}
          className="h-11 w-11 items-center justify-center rounded-card border border-white/20 bg-white/10"
        >
          <Ionicons name="notifications-outline" size={21} color="#ffffff" />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Apri profilo"
          onPress={() => router.navigate("/(tabs)/profile")}
          className="h-11 w-11 items-center justify-center rounded-card bg-white/15"
        >
          <Ionicons name="person-outline" size={21} color="#ffffff" />
        </Pressable>
      </View>
    </View>
  );
}
