import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { Button } from "@/components/Button";
import { FeedPostCard, type FeedPost } from "@/components/FeedPostCard";
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
      <View className="mt-4 gap-4">
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1">
            <Text className="text-2xl font-bold text-ink">Vicino a te</Text>
            <Text className="mt-1 text-sm leading-5 text-muted">Post visibili solo nel raggio condiviso. Coordinate sempre nascoste.</Text>
          </View>
          <Button label="Pubblica" icon="add" onPress={() => router.push("/post/compose")} />
        </View>
        <View className="flex-row items-center justify-between gap-3 border-y border-border py-3">
          <View className="flex-1 flex-row items-center gap-2">
            <Ionicons name={lastLocationSyncAt ? "location" : "location-outline"} size={18} color={lastLocationSyncAt ? "#16808a" : "#62717a"} />
            <Text className="text-sm text-muted">{lastLocationSyncAt ? `Raggio ${radiusMeters >= 1000 ? `${radiusMeters / 1000} km` : `${radiusMeters} m`}` : "Posizione da aggiornare"}</Text>
          </View>
          <Pressable accessibilityRole="button" onPress={() => void (demoMode ? feed.refetch() : refreshPositionAndFeed())} className="min-h-11 justify-center px-2">
            <Text className="font-semibold text-primary">Aggiorna</Text>
          </Pressable>
        </View>
        {demoMode ? (
          <View className="border-y border-border py-4">
            <Text className="font-semibold text-ink">Modalita demo APK</Text>
            <Text className="mt-1 text-sm leading-5 text-muted">Supabase non e ancora collegato: puoi navigare l'esperienza con dati locali realistici.</Text>
          </View>
        ) : null}
        {!demoMode && !lastLocationSyncAt ? (
          <View className="border-y border-border py-4">
            <Text className="font-semibold text-ink">Attiva il GPS per vedere la piazza</Text>
            <Text className="mt-1 text-sm leading-5 text-muted">Paraggi mostra post solo dopo una posizione valida. Premi Aggiorna posizione.</Text>
          </View>
        ) : null}
        {feed.isLoading ? <Text className="text-muted">Carico i post vicini...</Text> : null}
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
