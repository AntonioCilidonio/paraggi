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
    tone: "neutral",
    dotClass: "bg-primary",
    ringClass: "border-primary bg-primary/25",
    textClass: "text-primary"
  },
  medium: {
    label: "attiva",
    tone: "neutral",
    dotClass: "bg-warning",
    ringClass: "border-warning bg-warning/20",
    textClass: "text-warning"
  },
  low: {
    label: "tranquilla",
    tone: "warning",
    dotClass: "bg-muted",
    ringClass: "border-muted bg-white/50",
    textClass: "text-muted"
  }
};

function formatDistance(meters: number) {
  if (meters >= 1000) return `${(meters / 1000).toFixed(meters >= 1500 ? 1 : 0)} km`;
  return `${Math.max(10, Math.round(meters / 10) * 10)} m`;
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
            <View className="relative h-96 overflow-hidden rounded-card bg-primary-soft">
              <View className="absolute left-[-40px] top-24 h-0.5 w-[480px] rotate-12 bg-border" />
              <View className="absolute left-[-45px] top-64 h-0.5 w-[480px] -rotate-12 bg-border" />
              <View className="absolute left-40 top-[-40px] h-[480px] w-0.5 rotate-12 bg-border" />
              {zones.slice(0, 4).map((zone, index) => {
                const size = bubbleSize(zone);
                const position = mapPositions[index] ?? mapPositions[0];
                const selected = selectedZone?.id === zone.id;
                const toneClass = zone.activity_level === "high" ? "border-primary bg-primary/25" : zone.activity_level === "medium" ? "border-warning bg-warning/20" : "border-muted bg-white/50";
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
              <View className="absolute bottom-3 left-3 right-3 flex-row items-center justify-between rounded-card bg-primary-strong px-3 py-2">
                <Text className="text-xs font-semibold text-white/70">● Tranquilla</Text>
                <Text className="text-xs font-semibold text-white">● Attiva</Text>
                <Text className="text-xs font-semibold text-primary-soft">● Molto attiva</Text>
              </View>
            </View>
          ) : null}

          {zones.length > 0 ? (
            <View className="overflow-hidden rounded-card bg-white px-3">
              {zones.slice(0, 4).map((zone) => (
                <Pressable
                  key={zone.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Seleziona ${zone.name}`}
                  onPress={() => setSelectedZoneId(zone.id)}
                  className="flex-row items-center gap-3 border-b border-border py-3 last:border-b-0"
                >
                  <View className="h-10 w-10 items-center justify-center rounded-full bg-primary-soft">
                    <Text className="font-medium text-primary">{zone.name.slice(0, 1).toUpperCase()}</Text>
                  </View>
                  <View className="flex-1">
                    <Text className="font-medium text-ink">{zone.name}</Text>
                    <Text className="mt-0.5 text-xs text-muted">{zone.post_count} post · circa {formatDistance(zone.distance_meters)}</Text>
                  </View>
                  {zone.activity_level === "high" ? <StatusPill label="Molto attiva" tone="success" /> : <Ionicons name="chevron-forward" size={18} color="#7f8791" />}
                </Pressable>
              ))}
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
