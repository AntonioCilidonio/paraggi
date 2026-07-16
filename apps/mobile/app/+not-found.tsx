import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Text, View } from "react-native";
import { Button } from "@/components/Button";
import { Screen } from "@/components/Screen";

export default function NotFoundScreen() {
  return (
    <Screen scroll={false}>
      <View className="flex-1 items-center justify-center gap-4 px-4">
        <View className="h-14 w-14 items-center justify-center rounded-card bg-primary-strong">
          <Ionicons name="navigate-outline" size={28} color="#ffffff" />
        </View>
        <View className="gap-1">
          <Text className="text-center text-xl font-bold text-ink">Contenuto non disponibile</Text>
          <Text className="text-center text-sm leading-5 text-muted">Il collegamento potrebbe essere scaduto. Torna alle conversazioni vicine.</Text>
        </View>
        <Button label="Torna a Vicino" icon="radio-outline" onPress={() => router.replace("/(tabs)/feed")} />
      </View>
    </Screen>
  );
}
