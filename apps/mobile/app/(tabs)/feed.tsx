import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
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

export default function FeedScreen() {
  const radiusMeters = useAppStore((state) => state.radiusMeters);
  const localDemoPosts = useAppStore((state) => state.demoPosts);
  const currentAreaName = useAppStore((state) => state.currentAreaName);
  const currentCity = useAppStore((state) => state.currentCity);
  const lastLocationSyncAt = useAppStore((state) => state.lastLocationSyncAt);
  const syncLocation = useLocationSync();
  const [isRefreshingLocation, setIsRefreshingLocation] = useState(false);
  const feed = useQuery({
    queryKey: ["nearby-feed", radiusMeters, localDemoPosts.length],
    queryFn: async () => {
      if (demoMode) return { posts: [...localDemoPosts, ...demoPosts] };
      const result = await callFunction<{ posts: FeedPost[] }>("get-nearby-feed", { method: "GET", query: { radiusMeters, limit: 30 } });
      return { posts: result.posts.map(stabilizePostAttachments) };
    },
    enabled: demoMode || Boolean(lastLocationSyncAt)
  });

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
            title="Vicino a te"
            subtitle="Conversazioni attive ora"
            action={<HeaderIconButton icon="add" label="Pubblica un post" onPress={openPostComposer} />}
          />
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
          {feed.data?.posts.map((post) => (
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
