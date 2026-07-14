import { Ionicons } from "@expo/vector-icons";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { router } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import { Image, Linking, Platform, Pressable, Text, View } from "react-native";
import MapView, { Marker } from "react-native-maps";

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
  return (
    <View className="overflow-hidden rounded-card bg-ink" style={{ aspectRatio: 16 / 9 }}>
      <VideoView player={player} nativeControls allowsFullscreen contentFit="contain" style={{ flex: 1 }} />
    </View>
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
        <View className="h-10 w-10 items-center justify-center rounded-card bg-white"><Ionicons name="location" size={21} color="#16808a" /></View>
        <View className="flex-1"><Text className="font-semibold text-ink">Posizione condivisa</Text><Text className="mt-1 text-xs text-muted">Area approssimativa, coordinate nascoste</Text></View>
        <Ionicons name="navigate-outline" size={20} color="#16808a" />
      </Pressable>
    );
  }

  return (
    <View className="gap-2">
      <View className="overflow-hidden rounded-card border border-border" style={{ height: 220 }}>
        <MapView
          style={{ flex: 1 }}
          initialRegion={{ latitude: attachment.latitude!, longitude: attachment.longitude!, latitudeDelta: 0.008, longitudeDelta: 0.008 }}
          scrollEnabled={false}
          zoomEnabled={false}
        >
          <Marker coordinate={{ latitude: attachment.latitude!, longitude: attachment.longitude! }} title="Posizione condivisa" pinColor="#16808a" />
        </MapView>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Apri la posizione nel navigatore" onPress={openNavigation} className="min-h-11 flex-row items-center justify-center gap-2 rounded-card bg-surface px-4">
        <Ionicons name="navigate-outline" size={18} color="#16808a" />
        <Text className="font-semibold text-primary">Apri nel navigatore</Text>
      </Pressable>
    </View>
  );
}

export function PostAttachments({ attachments, compact = false, enableImageViewer = true }: { attachments?: PostAttachment[]; compact?: boolean; enableImageViewer?: boolean }) {
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
              <Image source={{ uri: attachment.url }} resizeMode="cover" className="w-full" style={{ aspectRatio: compact ? 16 / 10 : 4 / 3 }} />
              {enableImageViewer ? (
                <View className="absolute bottom-3 right-3 h-10 w-10 items-center justify-center rounded-card bg-ink/80">
                  <Ionicons name="expand-outline" size={20} color="#ffffff" />
                </View>
              ) : null}
            </Pressable>
          );
        }
        if (attachment.kind === "video") {
          return compact ? (
            <View key={attachment.id} className="flex-row items-center gap-3 rounded-card bg-ink p-3">
              <View className="h-10 w-10 items-center justify-center rounded-full bg-white"><Ionicons name="play" size={20} color="#17232b" /></View>
              <Text className="flex-1 font-semibold text-white">Video allegato · apri il post</Text>
              <Text className="text-xs text-white">{formatDuration(attachment.duration_seconds)}</Text>
            </View>
          ) : <VideoAttachmentView key={attachment.id} attachment={attachment} />;
        }
        if (attachment.kind === "audio") return <AudioAttachmentView key={attachment.id} attachment={attachment} />;
        if (attachment.kind === "location") return <LocationAttachmentView key={attachment.id} attachment={attachment} compact={compact} />;
        return null;
      })}
    </View>
  );
}
