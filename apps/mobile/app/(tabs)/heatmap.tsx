import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Button } from "@/components/Button";
import { AppHeader } from "@/components/AppHeader";
import { PageHeader } from "@/components/PageHeader";
import { Screen } from "@/components/Screen";
import { StatusPill } from "@/components/StatusPill";
import { demoMode } from "@/config/env";
import { demoHeatmapZones } from "@/demo/data";
import { useLocationSync } from "@/hooks/useLocationSync";
import { callFunction } from "@/services/api";
import { openPostComposer } from "@/services/postComposerNavigation";
import { getFriendlyError } from "@/services/errors";
import { useAppStore } from "@/stores/appStore";

type HeatmapLevel = "high" | "medium" | "low";

type HeatmapZone = {
  id: string;
  name: string;
  city: string | null;
  post_count: number;
  comment_count: number;
  connection_count: number;
  activity_score: number;
  activity_level: HeatmapLevel;
  distance_meters: number;
  latest_activity_at: string | null;
};

type HeatmapResponse = {
  zones: HeatmapZone[];
  needsLocation: boolean;
  radiusMeters: number;
};

const levelMeta: Record<HeatmapLevel, { label: string; tone: "success" | "neutral" | "warning"; dotClass: string; ringClass: string; textClass: string }> = {
  high: {
    label: "molto attiva",
    tone: "success",
    dotClass: "bg-success",
    ringClass: "border-success bg-success/20",
    textClass: "text-success"
  },
  medium: {
    label: "attiva",
    tone: "neutral",
    dotClass: "bg-primary",
    ringClass: "border-primary bg-primary/20",
    textClass: "text-primary"
  },
  low: {
    label: "tranquilla",
    tone: "warning",
    dotClass: "bg-warning",
    ringClass: "border-warning bg-warning/25",
    textClass: "text-muted"
  }
};

function formatDistance(meters: number) {
  if (meters >= 1000) return `${(meters / 1000).toFixed(meters >= 1500 ? 1 : 0)} km`;
  return `${Math.max(10, Math.round(meters / 10) * 10)} m`;
}

function formatActivityTime(value: string | null) {
  if (!value) return "attivita recente";
  const minutes = Math.max(1, Math.round((Date.now() - new Date(value).getTime()) / 60000));
  if (minutes < 60) return `${minutes} min fa`;
  const hours = Math.round(minutes / 60);
  return `${hours} h fa`;
}

function explainLevel(zone: HeatmapZone) {
  if (zone.activity_level === "high") return "Qui ci sono molte conversazioni recenti: utile per domande rapide, eventi e avvisi.";
  if (zone.activity_level === "medium") return "Zona viva ma leggibile: abbastanza post per orientarti senza rumore.";
  return "Poche conversazioni attive: la zona e calma o i post sono quasi scaduti.";
}

export default function HeatmapScreen() {
  const radiusMeters = useAppStore((state) => state.radiusMeters);
  const lastLocationSyncAt = useAppStore((state) => state.lastLocationSyncAt);
  const lastLocationError = useAppStore((state) => state.lastLocationError);
  const syncLocation = useLocationSync();
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(demoHeatmapZones[0]?.id ?? null);
  const [isRefreshingLocation, setIsRefreshingLocation] = useState(false);

  const heatmap = useQuery({
    queryKey: ["heatmap-zones", radiusMeters],
    queryFn: async (): Promise<HeatmapResponse> => {
      if (demoMode) return { zones: demoHeatmapZones as HeatmapZone[], needsLocation: false, radiusMeters };
      return callFunction<HeatmapResponse>("get-heatmap-zones", { method: "GET", query: { radiusMeters } });
    }
  });

  const zones = heatmap.data?.zones ?? [];
  const selectedZone = useMemo(() => zones.find((zone) => zone.id === selectedZoneId) ?? zones[0] ?? null, [selectedZoneId, zones]);

  useEffect(() => {
    if (zones.length > 0 && !zones.some((zone) => zone.id === selectedZoneId)) {
      setSelectedZoneId(zones[0].id);
    }
  }, [selectedZoneId, zones]);

  async function refreshHeatmap() {
    setIsRefreshingLocation(true);
    const result = await syncLocation();
    setIsRefreshingLocation(false);
    if (result.ok) await heatmap.refetch();
  }

  const mapPositions = [
    { top: 34, left: 26 },
    { top: 178, right: 22 },
    { bottom: 40, left: 62 },
    { bottom: 24, right: 32 }
  ] as const;

  function bubbleSize(zone: HeatmapZone) {
    if (zone.activity_level === "high") return 142;
    if (zone.activity_level === "medium") return 108;
    return 82;
  }

  return (
    <Screen>
      <View className="gap-5">
        <AppHeader />
        <PageHeader title="Attivita vicina" subtitle="Zone aggregate, mai persone singole." action={<StatusPill label={`${formatDistance(radiusMeters)}`} tone="neutral" />} />

        <View className="gap-3">
          {heatmap.isLoading ? (
            <View className="border-y border-border py-8">
              <Text className="text-center font-semibold text-ink">Carico le zone...</Text>
            </View>
          ) : null}

          {!heatmap.isLoading && heatmap.data?.needsLocation ? (
            <View className="rounded-card border border-border p-5">
              <Text className="text-center text-lg font-bold text-ink">Serve il GPS</Text>
              <Text className="mt-2 text-center text-sm leading-5 text-muted">Aggiorna la posizione per calcolare le zone attive nel tuo raggio. Le coordinate restano nascoste.</Text>
              <View className="mt-4 w-full">
                <Button label={isRefreshingLocation ? "Aggiorno..." : "Aggiorna GPS"} onPress={() => void refreshHeatmap()} disabled={isRefreshingLocation} />
              </View>
            </View>
          ) : null}

          {!heatmap.isLoading && !heatmap.data?.needsLocation && zones.length === 0 ? (
            <View className="rounded-card border border-border p-5">
              <Text className="text-center text-lg font-bold text-ink">Nessuna zona calda</Text>
              <Text className="mt-2 text-center text-sm leading-5 text-muted">Nel raggio scelto non ci sono conversazioni attive. Puoi aumentare il raggio o pubblicare il primo post.</Text>
              <View className="mt-4 w-full">
                <Button label="Pubblica un post" onPress={openPostComposer} />
              </View>
            </View>
          ) : null}

          {!heatmap.isLoading && !heatmap.data?.needsLocation && zones.length > 0 ? (
            <View className="relative h-96 overflow-hidden rounded-card border border-border bg-surface">
              <View className="absolute left-[-40px] top-24 h-0.5 w-[480px] rotate-12 bg-border" />
              <View className="absolute left-[-45px] top-64 h-0.5 w-[480px] -rotate-12 bg-border" />
              <View className="absolute left-40 top-[-40px] h-[480px] w-0.5 rotate-12 bg-border" />
              {zones.slice(0, 4).map((zone, index) => {
                const size = bubbleSize(zone);
                const position = mapPositions[index] ?? mapPositions[0];
                const selected = selectedZone?.id === zone.id;
                const toneClass = zone.activity_level === "high" ? "border-success bg-success/20" : zone.activity_level === "medium" ? "border-primary bg-primary/20" : "border-warning bg-warning/20";
                return (
                  <Pressable
                    key={zone.id}
                    accessibilityRole="button"
                    accessibilityLabel={`${zone.name}, ${levelMeta[zone.activity_level].label}`}
                    onPress={() => setSelectedZoneId(zone.id)}
                    className={`absolute items-center justify-center rounded-full border-2 ${toneClass} ${selected ? "opacity-100" : "opacity-80"}`}
                    style={{ width: size, height: size, ...position }}
                  >
                    <Text className="px-2 text-center text-sm font-bold text-ink" numberOfLines={2}>{zone.name}</Text>
                    <Text className="mt-1 text-xs font-semibold text-muted">{zone.post_count} post</Text>
                  </Pressable>
                );
              })}
              <View className="absolute bottom-3 left-3 right-3 flex-row items-center justify-between rounded-card bg-white px-3 py-2">
                <Text className="text-xs font-semibold text-warning">● Tranquilla</Text>
                <Text className="text-xs font-semibold text-primary">● Attiva</Text>
                <Text className="text-xs font-semibold text-success">● Molto attiva</Text>
              </View>
            </View>
          ) : null}

          {selectedZone ? (
            <View className="rounded-card border border-border bg-white p-4">
              <View className="flex-row items-start justify-between gap-3">
                <View className="flex-1">
                  <Text className="font-semibold text-ink">{selectedZone.name}</Text>
                  <Text className="mt-1 text-sm text-muted">{selectedZone.city ?? "Area vicina"} - circa {formatDistance(selectedZone.distance_meters)}</Text>
                </View>
                <StatusPill label={levelMeta[selectedZone.activity_level].label} tone={levelMeta[selectedZone.activity_level].tone} />
              </View>
              <Text className="mt-3 text-sm leading-5 text-muted">{explainLevel(selectedZone)}</Text>
              <View className="mt-3 flex-row items-center gap-2">
                <Ionicons name="time-outline" size={15} color="#62717a" />
                <Text className="text-xs font-semibold text-muted">Ultima attivita: {formatActivityTime(selectedZone.latest_activity_at)}</Text>
              </View>
            </View>
          ) : null}
        </View>

        {heatmap.isError ? (
          <View className="rounded-card border border-danger bg-surface p-4">
            <Text className="font-semibold text-danger">Heatmap non caricata</Text>
            <Text className="mt-1 text-sm leading-5 text-muted">{getFriendlyError(heatmap.error, "Aggiorna il GPS e riprova.")}</Text>
          </View>
        ) : null}

        {lastLocationError ? (
          <View className="rounded-card border border-warning bg-surface p-4">
            <Text className="font-semibold text-ink">GPS da controllare</Text>
            <Text className="mt-1 text-sm leading-5 text-muted">{getFriendlyError(lastLocationError, "Posizione non aggiornata.")}</Text>
          </View>
        ) : null}

        <View className="flex-row gap-2">
          <Button label={isRefreshingLocation ? "Aggiorno..." : "Aggiorna zona"} icon="locate-outline" onPress={() => void refreshHeatmap()} disabled={isRefreshingLocation} className="flex-1" />
          <Button label="Post vicini" variant="secondary" icon="list-outline" onPress={() => router.push("/(tabs)/feed")} className="flex-1" />
        </View>

        {lastLocationSyncAt ? <Text className="text-xs text-muted">Ultimo aggiornamento GPS: {new Date(lastLocationSyncAt).toLocaleTimeString()}</Text> : null}
      </View>
    </Screen>
  );
}
