import { router } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Button } from "@/components/Button";
import { Screen } from "@/components/Screen";
import { StatusPill } from "@/components/StatusPill";

const zones = [
  { id: "centro", name: "Centro", activity: "molto attiva", tone: "success" as const, posts: 42, distance: "180 m", summary: "Domande, eventi e informazioni rapide nel centro." },
  { id: "stazione", name: "Stazione", activity: "attiva", tone: "neutral" as const, posts: 18, distance: "430 m", summary: "Oggetti smarriti e richieste di aiuto in transito." },
  { id: "parco", name: "Parco", activity: "poco attiva", tone: "warning" as const, posts: 5, distance: "1.2 km", summary: "Poche conversazioni, soprattutto socializzazione." }
];

export default function HeatmapScreen() {
  const [selectedZoneId, setSelectedZoneId] = useState(zones[0].id);
  const selectedZone = zones.find((zone) => zone.id === selectedZoneId) ?? zones[0];

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
          <Pressable accessibilityRole="button" accessibilityLabel="Seleziona zona Centro" onPress={() => setSelectedZoneId("centro")} className="absolute left-6 top-8 h-24 w-24 rounded-full bg-success opacity-70" />
          <View className="absolute left-16 top-20 h-36 w-36 rounded-full bg-success opacity-30" pointerEvents="none" />
          <Pressable accessibilityRole="button" accessibilityLabel="Seleziona zona Stazione" onPress={() => setSelectedZoneId("stazione")} className="absolute right-9 top-24 h-20 w-20 rounded-full bg-primary opacity-60" />
          <View className="absolute right-16 top-40 h-32 w-32 rounded-full bg-primary opacity-25" pointerEvents="none" />
          <Pressable accessibilityRole="button" accessibilityLabel="Seleziona zona Parco" onPress={() => setSelectedZoneId("parco")} className="absolute bottom-10 left-24 h-16 w-16 rounded-full bg-accent opacity-55" />
          <View className="absolute bottom-20 left-12 h-28 w-28 rounded-full bg-accent opacity-20" pointerEvents="none" />
          <View className="absolute left-4 right-4 top-4 flex-row justify-between">
            <View className="rounded-full bg-white px-3 py-2">
              <Text className="text-xs font-semibold text-ink">Bologna - demo</Text>
            </View>
            <View className="rounded-full bg-white px-3 py-2">
              <Text className="text-xs font-semibold text-primary">Raggio privato</Text>
            </View>
          </View>
          <View className="absolute bottom-4 left-4 right-4 rounded-card bg-white p-4">
            <Text className="font-semibold text-ink">{selectedZone.name}</Text>
            <Text className="mt-1 text-sm leading-5 text-muted">{selectedZone.summary}</Text>
            <Text className="mt-2 text-xs font-semibold text-primary">{selectedZone.posts} post - circa {selectedZone.distance}</Text>
            <View className="mt-3 flex-row gap-2">
              <View className="h-3 flex-1 rounded-full bg-accent opacity-60" />
              <View className="h-3 flex-1 rounded-full bg-primary opacity-70" />
              <View className="h-3 flex-1 rounded-full bg-success opacity-80" />
            </View>
          </View>
        </View>
        <Button label="Vedi post vicini" onPress={() => router.push("/(tabs)/feed")} />
        <View className="gap-3">
          {zones.map((zone) => (
            <Pressable key={zone.name} accessibilityRole="button" onPress={() => setSelectedZoneId(zone.id)} className={`rounded-card border p-4 ${selectedZoneId === zone.id ? "border-primary bg-surface" : "border-border bg-surface"}`}>
              <View className="flex-row items-center justify-between gap-3">
                <View>
                  <Text className="font-semibold text-ink">{zone.name}</Text>
                  <Text className="mt-1 text-sm text-muted">{zone.posts} post - circa {zone.distance}</Text>
                </View>
                <StatusPill label={zone.activity} tone={zone.tone} />
              </View>
            </Pressable>
          ))}
        </View>
      </View>
    </Screen>
  );
}
