import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Button } from "@/components/Button";
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
      <View className="mt-4 gap-4">
        <View>
          <Text className="text-2xl font-bold text-ink">Aree visitate</Text>
          <Text className="mt-1 text-sm leading-5 text-muted">Cronologia generalizzata per luogo, mai tracciati GPS.</Text>
        </View>
        <View className="rounded-card border border-border bg-surface p-4">
          <Text className="font-semibold text-ink">Area attuale</Text>
          <Text className="mt-1 text-sm leading-5 text-muted">Sincronizza il GPS per salvare una visita generalizzata. Le coordinate precise non vengono mostrate.</Text>
          <View className="mt-3">
            <Button label="Aggiorna area" variant="secondary" onPress={() => void updateArea()} />
          </View>
        </View>
        {history.isLoading ? <Text className="text-muted">Carico cronologia aree...</Text> : null}
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
            className={`rounded-card border p-4 ${selectedAreaId === item.id ? "border-primary bg-surface" : "border-border bg-surface"}`}
          >
            <View className="flex-row items-start justify-between gap-3">
              <View className="flex-1">
                <Text className="font-semibold text-ink">{item.areas?.name ?? "Area"}</Text>
                <Text className="mt-1 text-sm text-muted">{item.areas?.city ?? "Citta"} - ultima visita {new Date(item.last_seen_at).toLocaleDateString()}</Text>
                <Text className="mt-2 text-sm text-muted">{item.post_count} post - {item.comment_count} commenti - {item.connection_count} connessioni</Text>
              </View>
              <Text className="text-lg text-muted">{selectedAreaId === item.id ? "-" : "+"}</Text>
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
