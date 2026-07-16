import type { ErrorBoundaryProps } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useEffect, useMemo, useRef } from "react";
import { Pressable, Text, View } from "react-native";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/Button";
import { PageHeader } from "@/components/PageHeader";
import { Screen } from "@/components/Screen";
import { demoMode } from "@/config/env";
import { demoHistory } from "@/demo/data";
import { callFunction } from "@/services/api";
import { deduplicateAreas, normalizeAreaHistory, type AreaHistory } from "@/services/areaHistory";
import { captureClientError } from "@/services/clientLogger";
import { getFriendlyError } from "@/services/errors";

export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const loggedMessageRef = useRef<string | null>(null);

  useEffect(() => {
    if (loggedMessageRef.current === error.message) return;
    loggedMessageRef.current = error.message;
    captureClientError("area_history_screen_error", error, {}, "fatal");
  }, [error]);

  return (
    <Screen>
      <View className="mt-4 gap-4">
        <Text className="text-2xl font-bold text-ink">Aree non disponibili</Text>
        <Text className="text-sm leading-5 text-muted">La schermata non si e aperta correttamente. Puoi riprovare senza chiudere l'app.</Text>
        <View className="rounded-card border border-danger bg-surface p-4">
          <Text className="font-semibold text-danger">Errore schermata</Text>
          <Text className="mt-1 text-sm leading-5 text-muted">{error.message}</Text>
        </View>
        <Button label="Riprova" onPress={retry} />
      </View>
    </Screen>
  );
}

export default function HistoryScreen() {
  const history = useQuery({
    queryKey: ["area-history"],
    queryFn: async () => {
      if (demoMode) return demoHistory as AreaHistory[];
      const data = await callFunction<{ history: AreaHistory[] }>("get-area-history", { method: "GET" });
      return normalizeAreaHistory(data.history);
    }
  });
  const areas = useMemo(() => deduplicateAreas(history.data ?? []), [history.data]);

  return (
    <Screen>
      <View className="gap-5">
        <AppHeader />
        <PageHeader title="Le tue aree" subtitle="I luoghi in cui hai partecipato, senza salvare il percorso GPS." />

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

        <View className="gap-3">
          {areas.map((item) => (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              accessibilityLabel={`Apri attivita di ${item.areas?.name ?? "questa area"}`}
              onPress={() => router.push(`/area/${item.area_id}`)}
              className="rounded-card bg-white p-4"
            >
              <View className="flex-row items-start gap-3">
                <View className="h-11 w-11 items-center justify-center rounded-card bg-primary-soft"><Ionicons name="location-outline" size={21} color="#3b82c4" /></View>
                <View className="flex-1">
                  <Text className="font-semibold text-ink">{item.areas?.name ?? "Area"}</Text>
                  <Text className="mt-1 text-sm text-muted">{item.areas?.city ?? "Italia"} · visita {new Date(item.last_seen_at).toLocaleDateString("it-IT")}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#536a6e" />
              </View>
              <View className="mt-3 flex-row gap-2">
                <View className="flex-1 rounded-card bg-bg px-2 py-2"><Text className="text-center text-xs font-semibold text-muted">{item.post_count} post</Text></View>
                <View className="flex-1 rounded-card bg-bg px-2 py-2"><Text className="text-center text-xs font-semibold text-muted">{item.comment_count} commenti</Text></View>
                <View className="flex-1 rounded-card bg-bg px-2 py-2"><Text className="text-center text-xs font-semibold text-muted">{item.connection_count} chat</Text></View>
              </View>
            </Pressable>
          ))}
        </View>
      </View>
    </Screen>
  );
}
