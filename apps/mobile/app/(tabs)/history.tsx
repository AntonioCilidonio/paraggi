import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useMemo } from "react";
import { Pressable, Text, View } from "react-native";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/Button";
import { PageHeader } from "@/components/PageHeader";
import { Screen } from "@/components/Screen";
import { demoMode } from "@/config/env";
import { demoHistory } from "@/demo/data";
import { useLocationSync } from "@/hooks/useLocationSync";
import { callFunction } from "@/services/api";
import { deduplicateAreas, type AreaHistory } from "@/services/areaHistory";
import { getFriendlyError } from "@/services/errors";

export default function HistoryScreen() {
  const syncLocation = useLocationSync();
  const history = useQuery({
    queryKey: ["area-history"],
    queryFn: async () => {
      if (demoMode) return demoHistory as AreaHistory[];
      const data = await callFunction<{ history: AreaHistory[] }>("get-area-history", { method: "GET" });
      return data.history;
    }
  });
  const areas = useMemo(() => deduplicateAreas(history.data ?? []), [history.data]);

  async function updateArea() {
    const result = await syncLocation();
    if (result.ok) await history.refetch();
  }

  return (
    <Screen>
      <View className="gap-5">
        <AppHeader />
        <PageHeader title="Le tue aree" subtitle="I luoghi in cui hai partecipato, senza salvare il percorso GPS." />
        <Button label="Aggiorna area attuale" icon="navigate-outline" variant="secondary" onPress={() => void updateArea()} />

        {history.isLoading ? <View className="h-32 rounded-card bg-surface" /> : null}
        {history.isError ? (
          <View className="rounded-card border border-danger bg-surface p-4">
            <Text className="font-semibold text-danger">Aree non caricate</Text>
            <Text className="mt-1 text-sm leading-5 text-muted">{getFriendlyError(history.error, "Aggiorna la posizione e riprova.")}</Text>
            <View className="mt-3"><Button label="Riprova" variant="secondary" onPress={() => void history.refetch()} /></View>
          </View>
        ) : null}
        {!history.isLoading && areas.length === 0 ? (
          <View className="items-center gap-3 border-y border-border py-10">
            <View className="h-14 w-14 items-center justify-center rounded-full bg-surface"><Ionicons name="trail-sign-outline" size={26} color="#62717a" /></View>
            <Text className="text-lg font-semibold text-ink">La cronologia iniziera qui</Text>
            <Text className="max-w-72 text-center text-sm leading-5 text-muted">Aggiorna la posizione quando arrivi in un luogo. Paraggi conservera solo il nome dell'area.</Text>
          </View>
        ) : null}

        <View className="gap-2">
          {areas.map((item) => (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              accessibilityLabel={`Apri attivita di ${item.areas?.name ?? "questa area"}`}
              onPress={() => router.push(`/area/${item.area_id}`)}
              className="flex-row items-center gap-3 border-b border-border py-4"
            >
              <View className="h-11 w-11 items-center justify-center rounded-card bg-surface"><Ionicons name="location-outline" size={21} color="#16808a" /></View>
              <View className="flex-1">
                <Text className="font-semibold text-ink">{item.areas?.name ?? "Area"}</Text>
                <Text className="mt-1 text-sm text-muted">{item.areas?.city ?? "Italia"} · visita {new Date(item.last_seen_at).toLocaleDateString("it-IT")}</Text>
                <Text className="mt-2 text-xs font-semibold text-muted">{item.post_count} post · {item.comment_count} commenti · {item.connection_count} chat</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#62717a" />
            </Pressable>
          ))}
        </View>
      </View>
    </Screen>
  );
}
