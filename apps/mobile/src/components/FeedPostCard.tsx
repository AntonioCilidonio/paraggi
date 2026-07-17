import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";
import {
  PostAttachments,
  type PostAttachment,
} from "@/components/PostAttachments";
import { PostCategoryPill } from "@/components/PostCategoryPill";
import { getAvatarUrl } from "@/services/avatar";
import { getPostCategoryTheme } from "@/design/postCategories";

export type FeedPost = {
  id: string;
  author_id?: string;
  display_name: string;
  avatar_path?: string | null;
  category: string;
  body: string;
  area_name?: string | null;
  city?: string | null;
  distance_meters: number | null;
  expires_at: string;
  comment_count: number;
  reputation_score: number;
  created_at: string;
  attachments?: PostAttachment[];
};

function formatDistance(distance: number | null) {
  if (distance === null) return "Distanza non disponibile";
  if (distance >= 1000) return `${(distance / 1000).toFixed(1)} km`;
  return `${distance} m`;
}

export function FeedPostCard({
  post,
  mediaMode = "preview",
}: {
  post: FeedPost;
  mediaMode?: "preview" | "full";
}) {
  const minutesLeft = Math.max(
    0,
    Math.round((new Date(post.expires_at).getTime() - Date.now()) / 60000),
  );
  const initial = post.display_name.slice(0, 1).toUpperCase();
  const avatarUrl = getAvatarUrl(post.avatar_path);
  const categoryTheme = getPostCategoryTheme(post.category);

  return (
    <View className={`gap-2.5 rounded-card p-3 ${categoryTheme.surfaceClass}`}>
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1 flex-row gap-3">
          {avatarUrl ? (
            <Pressable
              accessibilityRole="imagebutton"
              accessibilityLabel={`Apri la foto profilo di ${post.display_name}`}
              onPress={(event) => {
                event.stopPropagation();
                router.push({ pathname: "/media-view", params: { url: avatarUrl, label: post.display_name } });
              }}
              className="h-10 w-10 overflow-hidden rounded-full bg-surface"
            >
              <Image source={{ uri: avatarUrl }} contentFit="cover" cachePolicy="memory-disk" style={{ width: 40, height: 40 }} />
            </Pressable>
          ) : (
            <View className="h-10 w-10 items-center justify-center rounded-full bg-white/70">
              <Text className="font-bold text-primary">{initial}</Text>
            </View>
          )}
          <View className="flex-1">
              <Text className="font-medium text-ink">{post.display_name}</Text>
            <Text className="mt-1 text-xs text-muted" numberOfLines={1}>
              {post.area_name ?? "Area vicina"}
              {post.city ? `, ${post.city}` : ""} ·{" "}
              {formatDistance(post.distance_meters)}
            </Text>
          </View>
        </View>
        <PostCategoryPill category={post.category} />
      </View>
      <Text className="text-base leading-6 text-ink">{post.body}</Text>
      <PostAttachments
        attachments={post.attachments}
        compact={mediaMode === "preview"}
      />
      <View className="flex-row items-center gap-4 border-t border-ink/10 pt-2.5">
        <View className="flex-row items-center gap-1">
          <Ionicons name="chatbubble-outline" size={15} color="#62717a" />
          <Text className="text-xs font-medium text-muted">
            {post.comment_count}
          </Text>
        </View>
        <View className="flex-row items-center gap-1">
          <Ionicons name="time-outline" size={16} color="#62717a" />
          <Text className="text-xs font-medium text-muted">
            {minutesLeft < 60
              ? `${minutesLeft} min`
              : `${Math.ceil(minutesLeft / 60)} h`}
          </Text>
        </View>
        <View className="ml-auto flex-row items-center gap-1">
          <Ionicons name="shield-checkmark-outline" size={15} color="#3b82c4" />
          <Text className="text-xs font-medium text-primary">
            Affidabilita {post.reputation_score}
          </Text>
        </View>
      </View>
    </View>
  );
}
