import { useQuery } from "@tanstack/react-query";
import { Link } from "expo-router";
import { Text, View } from "react-native";
import { Button } from "@/components/Button";
import { FeedPostCard, type FeedPost } from "@/components/FeedPostCard";
import { Screen } from "@/components/Screen";
import { callFunction } from "@/services/api";
import { useAppStore } from "@/stores/appStore";
import { useLocationSync } from "@/hooks/useLocationSync";

export default function FeedScreen() {
  const radiusMeters = useAppStore((state) => state.radiusMeters);
  const syncLocation = useLocationSync();
  const feed = useQuery({
    queryKey: ["nearby-feed", radiusMeters],
    queryFn: async () => callFunction<{ posts: FeedPost[] }>("get-nearby-feed", { method: "GET", query: { radiusMeters, limit: 30 } })
  });

  return (
    <Screen>
      <View className="mt-4 gap-4">
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1">
            <Text className="text-2xl font-bold text-ink">Vicino a te</Text>
            <Text className="mt-1 text-sm leading-5 text-muted">Post visibili solo nel raggio condiviso. Coordinate sempre nascoste.</Text>
          </View>
          <Link href="/post/compose" className="rounded-card bg-primary px-4 py-3 font-semibold text-white">Post</Link>
        </View>
        <View className="flex-row gap-2">
          <Button label="Aggiorna posizione" variant="secondary" onPress={() => void syncLocation().then(() => feed.refetch())} />
          <Button label={`Raggio ${radiusMeters >= 1000 ? `${radiusMeters / 1000} km` : `${radiusMeters} m`}`} variant="secondary" />
        </View>
        {feed.isLoading ? <Text className="text-muted">Carico i post vicini...</Text> : null}
        {feed.data?.posts.length === 0 ? (
          <View className="rounded-card border border-border bg-surface p-4">
            <Text className="font-semibold text-ink">La piazza qui e tranquilla</Text>
            <Text className="mt-1 text-sm leading-5 text-muted">Pubblica una domanda o aggiorna la posizione per scoprire cosa succede intorno.</Text>
          </View>
        ) : null}
        <View className="gap-3">
          {feed.data?.posts.map((post) => <FeedPostCard key={post.id} post={post} />)}
        </View>
      </View>
    </Screen>
  );
}

