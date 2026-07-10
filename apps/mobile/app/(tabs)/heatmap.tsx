import { Text, View } from "react-native";
import { Screen } from "@/components/Screen";
import { StatusPill } from "@/components/StatusPill";

const zones = [
  { name: "Centro", activity: "molto attiva", tone: "success" as const, posts: 42, distance: "180 m" },
  { name: "Stazione", activity: "attiva", tone: "neutral" as const, posts: 18, distance: "430 m" },
  { name: "Parco", activity: "poco attiva", tone: "warning" as const, posts: 5, distance: "1.2 km" }
];

export default function HeatmapScreen() {
  return (
    <Screen>
      <View className="mt-4 gap-4">
        <View>
          <Text className="text-2xl font-bold text-ink">Heatmap</Text>
          <Text className="mt-1 text-sm leading-5 text-muted">Zone aggregate. Nessun marker persona, nessuna posizione precisa.</Text>
        </View>
        <View className="h-80 overflow-hidden rounded-card border border-border bg-surface">
          <View className="absolute left-0 right-0 top-0 h-20 bg-primary opacity-10" />
          <View className="absolute bottom-0 left-0 right-0 h-24 bg-accent opacity-10" />
          <View className="absolute left-6 top-8 h-24 w-24 rounded-full bg-success opacity-70" />
          <View className="absolute left-16 top-20 h-36 w-36 rounded-full bg-success opacity-30" />
          <View className="absolute right-9 top-24 h-20 w-20 rounded-full bg-primary opacity-60" />
          <View className="absolute right-16 top-40 h-32 w-32 rounded-full bg-primary opacity-25" />
          <View className="absolute bottom-10 left-24 h-16 w-16 rounded-full bg-accent opacity-55" />
          <View className="absolute bottom-20 left-12 h-28 w-28 rounded-full bg-accent opacity-20" />
          <View className="absolute left-4 right-4 top-4 flex-row justify-between">
            <View className="rounded-full bg-white px-3 py-2">
              <Text className="text-xs font-semibold text-ink">Bologna · demo</Text>
            </View>
            <View className="rounded-full bg-white px-3 py-2">
              <Text className="text-xs font-semibold text-primary">Raggio privato</Text>
            </View>
          </View>
          <View className="absolute bottom-4 left-4 right-4 rounded-card bg-white p-4">
            <Text className="font-semibold text-ink">Attivita aggregata</Text>
            <Text className="mt-1 text-sm leading-5 text-muted">Mostra solo densita per area. Le posizioni individuali non vengono mai disegnate.</Text>
            <View className="mt-3 flex-row gap-2">
              <View className="h-3 flex-1 rounded-full bg-accent opacity-60" />
              <View className="h-3 flex-1 rounded-full bg-primary opacity-70" />
              <View className="h-3 flex-1 rounded-full bg-success opacity-80" />
            </View>
          </View>
        </View>
        <View className="gap-3">
          {zones.map((zone) => (
            <View key={zone.name} className="rounded-card border border-border bg-surface p-4">
              <View className="flex-row items-center justify-between gap-3">
                <View>
                  <Text className="font-semibold text-ink">{zone.name}</Text>
                  <Text className="mt-1 text-sm text-muted">{zone.posts} post · circa {zone.distance}</Text>
                </View>
                <StatusPill label={zone.activity} tone={zone.tone} />
              </View>
            </View>
          ))}
        </View>
      </View>
    </Screen>
  );
}
