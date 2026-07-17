import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { AppHeader } from "@/components/AppHeader";
import { FeedPostCard, type FeedPost } from "@/components/FeedPostCard";
import { HeaderIconButton, PageHeader } from "@/components/PageHeader";
import { Screen } from "@/components/Screen";
import { demoMode } from "@/config/env";
import { demoPosts } from "@/demo/data";
import { callFunction } from "@/services/api";
import { getFriendlyError } from "@/services/errors";
import { useAppStore } from "@/stores/appStore";
import { useLocationSync } from "@/hooks/useLocationSync";
import { openPostComposer } from "@/services/postComposerNavigation";
import { stabilizePostAttachments } from "@/services/postAttachmentCache";
import { sortFeedPosts, type FeedSortDirection, type FeedSortField } from "@/services/feedSorting";

export default function FeedScreen() {
  const params = useLocalSearchParams<{ areaName?: string | string[]; areaCity?: string | string[] }>();
  const areaName = Array.isArray(params.areaName) ? params.areaName[0] : params.areaName;
  const areaCity = Array.isArray(params.areaCity) ? params.areaCity[0] : params.areaCity;
  const radiusMeters = useAppStore((state) => state.radiusMeters);
  const localDemoPosts = useAppStore((state) => state.demoPosts);
  const currentAreaName = useAppStore((state) => state.currentAreaName);
  const currentCity = useAppStore((state) => state.currentCity);
  const lastLocationSyncAt = useAppStore((state) => state.lastLocationSyncAt);
  const syncLocation = useLocationSync();
  const [isRefreshingLocation, setIsRefreshingLocation] = useState(false);
  const [sortField, setSortField] = useState<FeedSortField>("date");
  const [sortDirection, setSortDirection] = useState<FeedSortDirection>("desc");
  const feed = useQuery({
    queryKey: ["nearby-feed", radiusMeters, localDemoPosts.length, areaName, areaCity],
    queryFn: async () => {
      if (demoMode) return { posts: [...localDemoPosts, ...demoPosts].filter((post) => !areaName || (post.area_name === areaName && (!areaCity || post.city === areaCity))) };
      const result = await callFunction<{ posts: FeedPost[] }>("get-nearby-feed", { method: "GET", query: { radiusMeters, limit: 30, areaName, areaCity } });
      return { posts: result.posts.map(stabilizePostAttachments) };
    },
    enabled: demoMode || Boolean(lastLocationSyncAt)
  });
  const sortedPosts = useMemo(() => sortFeedPosts(feed.data?.posts ?? [], sortField, sortDirection), [feed.data?.posts, sortDirection, sortField]);

  function selectSort(field: FeedSortField) {
    if (sortField === field) {
      setSortDirection((direction) => direction === "asc" ? "desc" : "asc");
      return;
    }
    setSortField(field);
    setSortDirection(field === "date" ? "desc" : "asc");
  }

  useFocusEffect(useCallback(() => {
    if (demoMode || lastLocationSyncAt) void feed.refetch();
  }, [feed.refetch, lastLocationSyncAt]));

  async function refreshPositionAndFeed() {
    if (isRefreshingLocation) return;
    setIsRefreshingLocation(true);
    try {
      const result = await syncLocation();
      if (result.ok) await feed.refetch();
    } finally {
      setIsRefreshingLocation(false);
    }
  }

  return (
    <Screen>
      <View>
        <AppHeader />
        <View className="-mx-4 flex-row items-end gap-3 bg-primary-strong px-4 pb-4 pt-1">
          <View className="flex-1">
            <Text className="text-xs text-white/70">Sei nei dintorni di</Text>
            <Text className="mt-0.5 text-xl font-bold text-white">{currentAreaName ?? currentCity ?? "Area da aggiornare"}</Text>
            <Text className="mt-0.5 text-xs text-white/70">{lastLocationSyncAt ? `GPS attivo · entro ${radiusMeters >= 1000 ? `${radiusMeters / 1000} km` : `${radiusMeters} m`}` : "Posizione da aggiornare"}</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Aggiorna posizione e feed" accessibilityState={{ busy: isRefreshingLocation, disabled: isRefreshingLocation }} disabled={isRefreshingLocation} onPress={() => void (demoMode ? feed.refetch() : refreshPositionAndFeed())} className="h-11 w-11 items-center justify-center rounded-card bg-white/15">
            {isRefreshingLocation ? <ActivityIndicator size="small" color="#ffffff" /> : <Ionicons name="refresh" size={19} color="#ffffff" />}
          </Pressable>
        </View>
        <View className="gap-5 pt-5">
          <PageHeader
            title={areaName ?? "Vicino a te"}
            subtitle={areaName ? `Post della zona${areaCity ? ` · ${areaCity}` : ""}` : "Conversazioni attive ora"}
            action={<HeaderIconButton icon="add" label="Pubblica un post" onPress={openPostComposer} />}
          />
        <View className="gap-2">
          {areaName ? (
            <View className="flex-row items-center gap-2 rounded-card bg-primary-soft px-3 py-2">
              <Ionicons name="location" size={17} color="#3b82c4" />
              <Text className="flex-1 text-sm font-semibold text-primary" numberOfLines={1}>Filtro zona: {areaName}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Rimuovi filtro zona" onPress={() => router.replace("/(tabs)/feed")} className="h-10 w-10 items-center justify-center rounded-card bg-white">
                <Ionicons name="close" size={19} color="#1a2027" />
              </Pressable>
            </View>
          ) : null}
          <View className="flex-row gap-2">
            <Pressable accessibilityRole="button" accessibilityState={{ selected: sortField === "date" }} onPress={() => selectSort("date")} className={`min-h-11 flex-1 flex-row items-center justify-center gap-2 rounded-card border px-2 ${sortField === "date" ? "border-primary bg-primary-soft" : "border-border bg-white"}`}>
              <Ionicons name={sortDirection === "desc" && sortField === "date" ? "arrow-down" : "arrow-up"} size={16} color={sortField === "date" ? "#3b82c4" : "#62717a"} />
              <Text className={`text-xs font-semibold ${sortField === "date" ? "text-primary" : "text-muted"}`}>Data: {sortField === "date" && sortDirection === "asc" ? "meno recenti" : "recenti"}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityState={{ selected: sortField === "distance" }} onPress={() => selectSort("distance")} className={`min-h-11 flex-1 flex-row items-center justify-center gap-2 rounded-card border px-2 ${sortField === "distance" ? "border-primary bg-primary-soft" : "border-border bg-white"}`}>
              <Ionicons name={sortDirection === "desc" && sortField === "distance" ? "arrow-down" : "arrow-up"} size={16} color={sortField === "distance" ? "#3b82c4" : "#62717a"} />
              <Text className={`text-xs font-semibold ${sortField === "distance" ? "text-primary" : "text-muted"}`}>Distanza: {sortField === "distance" && sortDirection === "desc" ? "lontani" : "vicini"}</Text>
            </Pressable>
          </View>
        </View>
        {isRefreshingLocation ? <Text accessibilityLiveRegion="polite" className="-mt-3 text-xs font-medium text-primary">Aggiorno posizione e contenuti vicini...</Text> : null}
        {!demoMode && !lastLocationSyncAt ? (
          <View className="border-y border-border py-4">
            <Text className="font-semibold text-ink">Attiva il GPS per vedere la piazza</Text>
            <Text className="mt-1 text-sm leading-5 text-muted">Paraggi mostra post solo dopo una posizione valida. Premi Aggiorna posizione.</Text>
          </View>
        ) : null}
        {feed.isLoading ? (
          <View className="gap-3">
            {[0, 1].map((item) => <View key={item} className="h-40 rounded-card bg-surface" />)}
          </View>
        ) : null}
        {feed.isError ? (
          <View className="rounded-card border border-danger p-4">
            <Text className="font-semibold text-danger">Feed non caricato</Text>
            <Text className="mt-1 text-sm leading-5 text-muted">{getFriendlyError(feed.error, "Aggiorna il GPS e riprova.")}</Text>
          </View>
        ) : null}
        {feed.data?.posts.length === 0 ? (
          <View className="border-y border-border py-4">
            <Text className="font-semibold text-ink">La piazza qui e tranquilla</Text>
            <Text className="mt-1 text-sm leading-5 text-muted">Pubblica una domanda o aggiorna la posizione per scoprire cosa succede intorno.</Text>
          </View>
        ) : null}
        <View className="gap-3">
          {sortedPosts.map((post) => (
            <Pressable
              key={post.id}
              accessibilityRole="button"
              accessibilityLabel={`Apri post di ${post.display_name}`}
              onPress={() => router.push(`/post/${post.id}`)}
            >
              <FeedPostCard post={post} />
            </Pressable>
          ))}
        </View>
        </View>
      </View>
    </Screen>
  );
}
