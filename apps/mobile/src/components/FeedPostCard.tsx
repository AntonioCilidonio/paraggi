import { Ionicons } from "@expo/vector-icons";
import { Text, View } from "react-native";
import { StatusPill } from "@/components/StatusPill";

export type FeedPost = {
  id: string;
  author_id?: string;
  display_name: string;
  avatar_path?: string | null;
  category: string;
  body: string;
  area_name?: string | null;
  city?: string | null;
  distance_meters: number;
  expires_at: string;
  comment_count: number;
  reputation_score: number;
  created_at: string;
};

const categoryLabels: Record<string, string> = {
  question: "Domanda",
  information: "Informazione",
  lost_item: "Oggetto smarrito",
  help: "Aiuto",
  event: "Evento",
  social: "Socializzazione",
  emergency: "Emergenza"
};

function formatDistance(distance: number) {
  if (distance >= 1000) return `${(distance / 1000).toFixed(1)} km`;
  return `${distance} m`;
}

export function FeedPostCard({ post }: { post: FeedPost }) {
  const minutesLeft = Math.max(0, Math.round((new Date(post.expires_at).getTime() - Date.now()) / 60000));
  const initial = post.display_name.slice(0, 1).toUpperCase();

  return (
    <View className="gap-3 rounded-card border border-border bg-white p-4">
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1 flex-row gap-3">
          <View className="h-10 w-10 items-center justify-center rounded-full bg-primary">
            <Text className="font-bold text-white">{initial}</Text>
          </View>
          <View className="flex-1">
            <Text className="font-semibold text-ink">{post.display_name}</Text>
            <Text className="mt-1 text-sm text-muted">{post.area_name ?? "Area vicina"} · {formatDistance(post.distance_meters)}</Text>
          </View>
        </View>
        <StatusPill label={categoryLabels[post.category] ?? post.category} tone={post.category === "emergency" ? "danger" : "neutral"} />
      </View>
      <Text className="text-base leading-6 text-ink">{post.body}</Text>
      <View className="flex-row items-center gap-4 border-t border-border pt-3">
        <View className="flex-row items-center gap-1">
          <Ionicons name="chatbubble-outline" size={15} color="#62717a" />
          <Text className="text-xs font-semibold text-muted">{post.comment_count}</Text>
        </View>
        <View className="flex-row items-center gap-1">
          <Ionicons name="time-outline" size={16} color="#62717a" />
          <Text className="text-xs font-semibold text-muted">{minutesLeft < 60 ? `${minutesLeft} min` : `${Math.ceil(minutesLeft / 60)} h`}</Text>
        </View>
        <Text className="ml-auto text-xs font-semibold text-primary">Apri conversazione</Text>
      </View>
    </View>
  );
}
