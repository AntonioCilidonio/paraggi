import { Ionicons } from "@expo/vector-icons";
import { useEvent } from "expo";
import { Image } from "expo-image";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { router } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import { Linking, Platform, Pressable, Text, View } from "react-native";
import { SafeMapPreview } from "@/components/SafeMapPreview";

export type PostAttachment = {
  id: string;
  post_id?: string;
  kind: "image" | "video" | "audio" | "location";
  mime_type?: string | null;
  duration_seconds?: number | null;
  label?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  url?: string | null;
};

function formatDuration(seconds?: number | null) {
  const value = Math.max(0, Math.round(seconds ?? 0));
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, "0")}`;
}

function AudioAttachmentView({ attachment }: { attachment: PostAttachment }) {
  const player = useAudioPlayer(attachment.url ? { uri: attachment.url } : null);
  const status = useAudioPlayerStatus(player);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={status.playing ? "Metti in pausa la nota vocale" : "Riproduci la nota vocale"}
      disabled={!attachment.url}
      onPress={() => status.playing ? player.pause() : player.play()}
      className="flex-row items-center gap-3 rounded-card bg-surface p-3"
    >
      <View className="h-11 w-11 items-center justify-center rounded-full bg-primary">
        <Ionicons name={status.playing ? "pause" : "play"} size={20} color="#ffffff" />
      </View>
      <View className="flex-1">
        <Text className="font-semibold text-ink">Nota vocale</Text>
        <Text className="mt-1 text-xs text-muted">
          {status.isLoaded ? `${formatDuration(status.currentTime)} / ${formatDuration(status.duration)}` : formatDuration(attachment.duration_seconds)}
        </Text>
      </View>
      <View className="flex-row items-end gap-1">
        {[12, 20, 15, 26, 18, 22, 13].map((height, index) => <View key={`${height}-${index}`} className="w-1 rounded-full bg-primary" style={{ height }} />)}
      </View>
    </Pressable>
  );
}

function VideoAttachmentView({ attachment }: { attachment: PostAttachment }) {
  const player = useVideoPlayer(attachment.url ? { uri: attachment.url } : null);
  const { isPlaying } = useEvent(player, "playingChange", { isPlaying: player.playing });

  return (
    <View className="overflow-hidden rounded-card bg-ink" style={{ aspectRatio: 16 / 9 }}>
      <VideoView player={player} nativeControls allowsFullscreen contentFit="contain" style={{ flex: 1 }} />
      {!isPlaying && attachment.url ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Riproduci video"
          onPress={() => player.play()}
          className="absolute inset-0 items-center justify-center bg-ink/10"
        >
          <View pointerEvents="none" className="h-16 w-16 items-center justify-center rounded-full bg-white/95">
            <Ionicons name="play" size={30} color="#1a2027" style={{ marginLeft: 3 }} />
          </View>
        </Pressable>
      ) : null}
    </View>
  );
}

function VideoAttachmentPreview({ attachment, onOpen }: { attachment: PostAttachment; onOpen?: () => void }) {
  const player = useVideoPlayer(attachment.url ? { uri: attachment.url } : null, (videoPlayer) => {
    videoPlayer.loop = false;
    videoPlayer.muted = true;
  });

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Apri il video nel dettaglio del post"
      onPress={(event) => {
        event.stopPropagation();
        onOpen?.();
      }}
      className="overflow-hidden rounded-card bg-ink"
      style={{ aspectRatio: 16 / 9 }}
    >
      <VideoView pointerEvents="none" player={player} nativeControls={false} contentFit="cover" style={{ flex: 1 }} />
      <View pointerEvents="none" className="absolute inset-0 items-center justify-center bg-ink/15">
        <View className="h-12 w-12 items-center justify-center rounded-full bg-white/90">
          <Ionicons name="play" size={23} color="#1a2027" style={{ marginLeft: 2 }} />
        </View>
      </View>
      <View pointerEvents="none" className="absolute bottom-2 right-2 rounded-card bg-ink/75 px-2 py-1">
        <Text className="text-xs font-semibold text-white">{formatDuration(attachment.duration_seconds)}</Text>
      </View>
    </Pressable>
  );
}

function LocationAttachmentView({ attachment, compact }: { attachment: PostAttachment; compact: boolean }) {
  const hasPosition = typeof attachment.latitude === "number" && typeof attachment.longitude === "number";
  const openNavigation = () => {
    if (!hasPosition) return;
    const label = encodeURIComponent("Posizione condivisa su Paraggi");
    const url = Platform.OS === "ios"
      ? `maps://?q=${label}&ll=${attachment.latitude},${attachment.longitude}`
      : `geo:${attachment.latitude},${attachment.longitude}?q=${attachment.latitude},${attachment.longitude}(${label})`;
    void Linking.openURL(url);
  };

  if (compact || !hasPosition) {
    return (
      <Pressable accessibilityRole="button" accessibilityLabel="Apri la posizione condivisa" disabled={!hasPosition} onPress={openNavigation} className="flex-row items-center gap-3 rounded-card bg-surface p-3">
        <View className="h-10 w-10 items-center justify-center rounded-card bg-white"><Ionicons name="location" size={21} color="#3b82c4" /></View>
        <View className="flex-1"><Text className="font-semibold text-ink">Posizione condivisa</Text><Text className="mt-1 text-xs text-muted">Area approssimativa, coordinate nascoste</Text></View>
        <Ionicons name="navigate-outline" size={20} color="#3b82c4" />
      </Pressable>
    );
  }

  return (
    <View className="gap-2">
      <SafeMapPreview latitude={attachment.latitude!} longitude={attachment.longitude!} title="Posizione condivisa" />
      <Pressable accessibilityRole="button" accessibilityLabel="Apri la posizione nel navigatore" onPress={openNavigation} className="min-h-11 flex-row items-center justify-center gap-2 rounded-card bg-surface px-4">
        <Ionicons name="navigate-outline" size={18} color="#3b82c4" />
        <Text className="font-semibold text-primary">Apri nel navigatore</Text>
      </Pressable>
    </View>
  );
}

export function PostAttachments({
  attachments,
  compact = false,
  enableImageViewer = true,
  onVideoPreviewPress
}: {
  attachments?: PostAttachment[];
  compact?: boolean;
  enableImageViewer?: boolean;
  onVideoPreviewPress?: () => void;
}) {
  if (!attachments?.length) return null;

  return (
    <View className="gap-3">
      {attachments.map((attachment) => {
        if (attachment.kind === "image" && attachment.url) {
          return (
            <Pressable
              key={attachment.id}
              accessibilityRole="imagebutton"
              accessibilityLabel="Apri immagine a schermo intero"
              disabled={!enableImageViewer}
              onPress={(event) => {
                event.stopPropagation();
                router.push({ pathname: "/media-view", params: { url: attachment.url!, label: attachment.label ?? "Immagine del post" } });
              }}
              className="overflow-hidden rounded-card bg-surface"
            >
              <Image
                source={{ uri: attachment.url }}
                contentFit="cover"
                cachePolicy="memory-disk"
                recyclingKey={attachment.id}
                style={{ width: "100%", aspectRatio: compact ? 16 / 10 : 4 / 3 }}
              />
              {enableImageViewer ? (
                <View className="absolute bottom-3 right-3 h-10 w-10 items-center justify-center rounded-card bg-ink/80">
                  <Ionicons name="expand-outline" size={20} color="#ffffff" />
                </View>
              ) : null}
            </Pressable>
          );
        }
        if (attachment.kind === "video") {
          return compact
            ? <VideoAttachmentPreview key={attachment.id} attachment={attachment} onOpen={onVideoPreviewPress} />
            : <VideoAttachmentView key={attachment.id} attachment={attachment} />;
        }
        if (attachment.kind === "audio") return <AudioAttachmentView key={attachment.id} attachment={attachment} />;
        if (attachment.kind === "location") return <LocationAttachmentView key={attachment.id} attachment={attachment} compact={compact} />;
        return null;
      })}
    </View>
  );
}
