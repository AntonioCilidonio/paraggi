import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Button } from "@/components/Button";
import { Screen } from "@/components/Screen";
import { StatusPill } from "@/components/StatusPill";
import { demoMode } from "@/config/env";
import { demoHeatmapZones } from "@/demo/data";
import { useLocationSync } from "@/hooks/useLocationSync";
import { callFunction } from "@/services/api";
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

const heatPositions: Array<{ left: `${number}%`; top: `${number}%`; size: number }> = [
  { left: "8%", top: "18%", size: 112 },
  { left: "58%", top: "30%", size: 94 },
  { left: "25%", top: "56%", size: 78 },
  { left: "66%", top: "8%", size: 70 },
  { left: "46%", top: "58%", size: 64 },
  { left: "12%", top: "42%", size: 58 }
];

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

  return (
    <Screen>
      <View className="mt-4 gap-4">
        <View>
          <Text className="text-2xl font-bold text-ink">Mappa attivita</Text>
          <Text className="mt-1 text-sm leading-5 text-muted">Calore aggregato dei post vicini. Nessun marker persona, nessuna coordinata visibile.</Text>
        </View>

        <View className="rounded-card border border-border bg-surface p-4">
          <View className="flex-row items-start justify-between gap-3">
            <View className="flex-1">
              <Text className="font-semibold text-ink">Cosa significa il calore</Text>
              <Text className="mt-1 text-sm leading-5 text-muted">Piu colore = piu post, commenti e richieste nate in una zona negli ultimi minuti. La posizione resta generalizzata per area.</Text>
            </View>
            <StatusPill label={`${formatDistance(radiusMeters)} raggio`} tone="neutral" />
          </View>
          <View className="mt-4 flex-row gap-2">
            <View className="flex-1 rounded-card border border-border bg-bg p-3">
              <View className="h-2 rounded-full bg-success" />
              <Text className="mt-2 text-xs font-semibold text-ink">Molto attiva</Text>
            </View>
            <View className="flex-1 rounded-card border border-border bg-bg p-3">
              <View className="h-2 rounded-full bg-primary" />
              <Text className="mt-2 text-xs font-semibold text-ink">Attiva</Text>
            </View>
            <View className="flex-1 rounded-card border border-border bg-bg p-3">
              <View className="h-2 rounded-full bg-warning" />
              <Text className="mt-2 text-xs font-semibold text-ink">Tranquilla</Text>
            </View>
          </View>
        </View>

        <View className="h-96 overflow-hidden rounded-card border border-border bg-surface">
          <View className="absolute left-0 right-0 top-0 h-full bg-primary/5" />
          <View className="absolute left-6 right-6 top-16 h-px bg-border" />
          <View className="absolute left-6 right-6 top-36 h-px bg-border" />
          <View className="absolute left-6 right-6 top-56 h-px bg-border" />
          <View className="absolute bottom-0 left-0 right-0 h-20 bg-bg/70" />

          {heatmap.isLoading ? (
            <View className="absolute inset-0 items-center justify-center px-8">
              <Text className="text-center font-semibold text-ink">Carico zone attive...</Text>
              <Text className="mt-2 text-center text-sm leading-5 text-muted">Uso solo dati aggregati per area.</Text>
            </View>
          ) : null}

          {!heatmap.isLoading && heatmap.data?.needsLocation ? (
            <View className="absolute inset-0 items-center justify-center px-8">
              <Text className="text-center text-lg font-bold text-ink">Serve il GPS</Text>
              <Text className="mt-2 text-center text-sm leading-5 text-muted">Aggiorna la posizione per calcolare le zone attive nel tuo raggio. Le coordinate restano nascoste.</Text>
              <View className="mt-4 w-full">
                <Button label={isRefreshingLocation ? "Aggiorno..." : "Aggiorna GPS"} onPress={() => void refreshHeatmap()} disabled={isRefreshingLocation} />
              </View>
            </View>
          ) : null}

          {!heatmap.isLoading && !heatmap.data?.needsLocation && zones.length === 0 ? (
            <View className="absolute inset-0 items-center justify-center px-8">
              <Text className="text-center text-lg font-bold text-ink">Nessuna zona calda</Text>
              <Text className="mt-2 text-center text-sm leading-5 text-muted">Nel raggio scelto non ci sono conversazioni attive. Puoi aumentare il raggio o pubblicare il primo post.</Text>
              <View className="mt-4 w-full">
                <Button label="Pubblica un post" onPress={() => router.push("/post/compose")} />
              </View>
            </View>
          ) : null}

          {zones.slice(0, 6).map((zone, index) => {
            const position = heatPositions[index];
            const meta = levelMeta[zone.activity_level];
            const isSelected = selectedZone?.id === zone.id;
            const size = Math.min(position.size + Math.max(0, zone.activity_score - 8), 136);

            return (
              <Pressable
                key={zone.id}
                accessibilityRole="button"
                accessibilityLabel={`Seleziona ${zone.name}, ${meta.label}`}
                onPress={() => setSelectedZoneId(zone.id)}
                className={`absolute items-center justify-center rounded-full border ${meta.ringClass} ${isSelected ? "border-2 opacity-100" : "border opacity-80"}`}
                style={{ left: position.left, top: position.top, width: size, height: size }}
              >
                <View className={`h-5 w-5 rounded-full ${meta.dotClass}`} />
                <Text className={`mt-1 px-2 text-center text-xs font-bold ${meta.textClass}`} numberOfLines={1}>{zone.name}</Text>
              </Pressable>
            );
          })}

          {selectedZone ? (
            <View className="absolute bottom-4 left-4 right-4 rounded-card border border-border bg-bg p-4">
              <View className="flex-row items-start justify-between gap-3">
                <View className="flex-1">
                  <Text className="font-semibold text-ink">{selectedZone.name}</Text>
                  <Text className="mt-1 text-sm text-muted">{selectedZone.city ?? "Area vicina"} - circa {formatDistance(selectedZone.distance_meters)}</Text>
                </View>
                <StatusPill label={levelMeta[selectedZone.activity_level].label} tone={levelMeta[selectedZone.activity_level].tone} />
              </View>
              <Text className="mt-3 text-sm leading-5 text-muted">{explainLevel(selectedZone)}</Text>
              <View className="mt-3 flex-row gap-2">
                <Text className="rounded-full bg-surface px-3 py-2 text-xs font-semibold text-ink">{selectedZone.post_count} post</Text>
                <Text className="rounded-full bg-surface px-3 py-2 text-xs font-semibold text-ink">{selectedZone.comment_count} commenti</Text>
                <Text className="rounded-full bg-surface px-3 py-2 text-xs font-semibold text-ink">{formatActivityTime(selectedZone.latest_activity_at)}</Text>
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
          <Button label={isRefreshingLocation ? "Aggiorno..." : "Aggiorna mappa"} onPress={() => void refreshHeatmap()} disabled={isRefreshingLocation} className="flex-1" />
          <Button label="Post vicini" variant="secondary" onPress={() => router.push("/(tabs)/feed")} className="flex-1" />
        </View>

        <View className="gap-3">
          <Text className="font-semibold text-ink">Zone nel tuo raggio</Text>
          {zones.map((zone) => {
            const meta = levelMeta[zone.activity_level];
            return (
              <Pressable
                key={zone.id}
                accessibilityRole="button"
                onPress={() => setSelectedZoneId(zone.id)}
                className={`rounded-card border p-4 ${selectedZoneId === zone.id ? "border-primary bg-surface" : "border-border bg-surface"}`}
              >
                <View className="flex-row items-center justify-between gap-3">
                  <View className="flex-1">
                    <Text className="font-semibold text-ink">{zone.name}</Text>
                    <Text className="mt-1 text-sm text-muted">{zone.post_count} post - {zone.comment_count} commenti - circa {formatDistance(zone.distance_meters)}</Text>
                  </View>
                  <StatusPill label={meta.label} tone={meta.tone} />
                </View>
              </Pressable>
            );
          })}
          {lastLocationSyncAt ? <Text className="text-xs text-muted">Ultimo aggiornamento GPS: {new Date(lastLocationSyncAt).toLocaleTimeString()}</Text> : null}
        </View>
      </View>
    </Screen>
  );
}
