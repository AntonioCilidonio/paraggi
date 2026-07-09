import { Text, View } from "react-native";
import { Screen } from "@/components/Screen";
import { StatusPill } from "@/components/StatusPill";

const zones = [
  { name: "Centro", activity: "molto attiva", tone: "success" as const },
  { name: "Stazione", activity: "attiva", tone: "neutral" as const },
  { name: "Parco", activity: "poco attiva", tone: "warning" as const }
];

export default function HeatmapScreen() {
  return (
    <Screen>
      <View className="mt-4 gap-4">
        <View>
          <Text className="text-2xl font-bold text-ink">Heatmap</Text>
          <Text className="mt-1 text-sm leading-5 text-muted">Zone aggregate. Nessun marker persona, nessuna posizione precisa.</Text>
        </View>
        <View className="h-72 justify-end rounded-card border border-border bg-surface p-4">
          <Text className="font-semibold text-ink">Mappa aggregata</Text>
          <Text className="mt-1 text-sm text-muted">Mapbox verra collegato con layer heatmap nello step di integrazione nativa.</Text>
        </View>
        <View className="gap-3">
          {zones.map((zone) => (
            <View key={zone.name} className="flex-row items-center justify-between rounded-card border border-border p-4">
              <Text className="font-semibold text-ink">{zone.name}</Text>
              <StatusPill label={zone.activity} tone={zone.tone} />
            </View>
          ))}
        </View>
      </View>
    </Screen>
  );
}

