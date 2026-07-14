import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Button } from "@/components/Button";
import { AppHeader } from "@/components/AppHeader";
import { PageHeader } from "@/components/PageHeader";
import { Screen } from "@/components/Screen";
import { demoMode } from "@/config/env";
import { demoHistory } from "@/demo/data";
import { callFunction } from "@/services/api";
import { getFriendlyError } from "@/services/errors";
import { useLocationSync } from "@/hooks/useLocationSync";

type AreaHistory = {
  id: string;
  first_seen_at: string;
  last_seen_at: string;
  post_count: number;
  comment_count: number;
  connection_count: number;
  areas: { name: string; city: string | null; country_code: string } | null;
};

export default function HistoryScreen() {
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>("demo-area-1");
  const syncLocation = useLocationSync();
  const history = useQuery({
    queryKey: ["area-history"],
    queryFn: async () => {
      if (demoMode) return demoHistory;
      const data = await callFunction<{ history: AreaHistory[] }>("get-area-history", { method: "GET" });
      return data.history;
    }
  });

  async function updateArea() {
    const result = await syncLocation();
    if (result.ok) await history.refetch();
  }

  return (
    <Screen>
      <View className="gap-5">
        <AppHeader />
        <PageHeader title="Le tue aree" subtitle="Luoghi visitati, senza conservare il percorso GPS." />
        <Button label="Aggiorna area attuale" icon="navigate-outline" variant="secondary" onPress={() => void updateArea()} />
        {history.isLoading ? <View className="h-32 rounded-card bg-surface" /> : null}
        {history.isError ? (
          <View className="rounded-card border border-danger bg-surface p-4">
            <Text className="font-semibold text-danger">Aree non caricate</Text>
            <Text className="mt-1 text-sm leading-5 text-muted">{getFriendlyError(history.error, "Aggiorna l'area e riprova.")}</Text>
          </View>
        ) : null}
        {history.data?.length === 0 ? (
          <View className="rounded-card border border-border bg-surface p-4">
            <Text className="font-semibold text-ink">Nessuna area ancora</Text>
            <Text className="mt-1 text-sm leading-5 text-muted">Premi Aggiorna area per creare la prima cronologia locale.</Text>
          </View>
        ) : null}
        {history.data?.map((item) => (
          <Pressable
            key={item.id}
            accessibilityRole="button"
            onPress={() => setSelectedAreaId(selectedAreaId === item.id ? null : item.id)}
            className={`rounded-card border p-4 ${selectedAreaId === item.id ? "border-primary bg-surface" : "border-border bg-white"}`}
          >
            <View className="flex-row items-start gap-3">
              <View className="h-10 w-10 items-center justify-center rounded-card bg-surface"><Ionicons name="location-outline" size={20} color="#16808a" /></View>
              <View className="flex-1">
                <Text className="font-semibold text-ink">{item.areas?.name ?? "Area"}</Text>
                <Text className="mt-1 text-sm text-muted">{item.areas?.city ?? "Citta"} · ultima visita {new Date(item.last_seen_at).toLocaleDateString("it-IT")}</Text>
                <View className="mt-3 flex-row flex-wrap gap-3">
                  <Text className="text-xs font-semibold text-muted">{item.post_count} post</Text>
                  <Text className="text-xs font-semibold text-muted">{item.comment_count} commenti</Text>
                  <Text className="text-xs font-semibold text-muted">{item.connection_count} chat</Text>
                </View>
              </View>
              <Ionicons name={selectedAreaId === item.id ? "chevron-up" : "chevron-down"} size={20} color="#62717a" />
            </View>
            {selectedAreaId === item.id ? (
              <View className="mt-4 gap-3 border-t border-border pt-4">
                <Text className="text-sm leading-5 text-muted">Storico generalizzato: puoi rivedere post, commenti e connessioni nate in quest'area senza coordinate precise.</Text>
                <View className="flex-row gap-2">
                  <Button label="Post area" className="flex-1" onPress={() => router.push("/(tabs)/feed")} />
                  <Button label="Chat nate qui" variant="secondary" className="flex-1" onPress={() => router.push("/(tabs)/chats")} />
                </View>
              </View>
            ) : null}
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}
