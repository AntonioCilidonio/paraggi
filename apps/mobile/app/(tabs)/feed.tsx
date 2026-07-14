import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";
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

export default function FeedScreen() {
  const radiusMeters = useAppStore((state) => state.radiusMeters);
  const localDemoPosts = useAppStore((state) => state.demoPosts);
  const lastLocationSyncAt = useAppStore((state) => state.lastLocationSyncAt);
  const syncLocation = useLocationSync();
  const feed = useQuery({
    queryKey: ["nearby-feed", radiusMeters, localDemoPosts.length],
    queryFn: async () => {
      if (demoMode) return { posts: [...localDemoPosts, ...demoPosts] };
      return callFunction<{ posts: FeedPost[] }>("get-nearby-feed", { method: "GET", query: { radiusMeters, limit: 30 } });
    },
    enabled: demoMode || Boolean(lastLocationSyncAt)
  });

  async function refreshPositionAndFeed() {
    const result = await syncLocation();
    if (result.ok) await feed.refetch();
  }

  return (
    <Screen>
      <View className="gap-5">
        <AppHeader />
        <PageHeader
          title="Vicino a te"
          subtitle="Conversazioni che esistono qui, adesso."
          action={<HeaderIconButton icon="add" label="Pubblica un post" onPress={() => router.push("/post/compose")} />}
        />
        <View className="flex-row items-center justify-between gap-3 rounded-card bg-surface px-3 py-2.5">
          <View className="flex-1 flex-row items-center gap-2">
            <Ionicons name={lastLocationSyncAt ? "location" : "location-outline"} size={18} color={lastLocationSyncAt ? "#16808a" : "#62717a"} />
            <Text className="text-sm font-medium text-ink">{lastLocationSyncAt ? `GPS attivo · raggio ${radiusMeters >= 1000 ? `${radiusMeters / 1000} km` : `${radiusMeters} m`}` : "Posizione da aggiornare"}</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Aggiorna posizione e feed" onPress={() => void (demoMode ? feed.refetch() : refreshPositionAndFeed())} className="min-h-11 justify-center px-2">
            <Ionicons name="refresh" size={19} color="#16808a" />
          </Pressable>
        </View>
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
    </Screen>
  );
}
