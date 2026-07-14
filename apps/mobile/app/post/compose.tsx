import type { PostCategory, PostTtlMinutes } from "@paraggi/domain";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { router } from "expo-router";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Pressable, Text, TextInput, View } from "react-native";
import { Button } from "@/components/Button";
import { Screen } from "@/components/Screen";
import { demoMode } from "@/config/env";
import { useLocationSync } from "@/hooks/useLocationSync";
import { callFunction } from "@/services/api";
import { captureClientError } from "@/services/clientLogger";
import { getFriendlyError } from "@/services/errors";
import { sendLocalNotification } from "@/services/notifications";
import { supabase } from "@/services/supabase";
import { useAppStore } from "@/stores/appStore";

type Form = {
  category: PostCategory;
  body: string;
  ttlMinutes: PostTtlMinutes;
};

type MediaAttachment = {
  kind: "image" | "video" | "audio";
  uri: string;
  name: string;
  mimeType: string;
  durationSeconds?: number;
};

const categoryLabels: Record<PostCategory, string> = {
  question: "Domanda",
  information: "Informazione",
  lost_item: "Oggetto smarrito",
  help: "Aiuto",
  event: "Evento",
  social: "Social",
  emergency: "Emergenza"
};

const mediaLimits = {
  image: 10 * 1024 * 1024,
  video: 20 * 1024 * 1024,
  audio: 12 * 1024 * 1024
} as const;

function assertMediaSize(kind: keyof typeof mediaLimits, size?: number | null) {
  if (size && size > mediaLimits[kind]) throw { error: "media_too_large" };
}

export default function ComposePostScreen() {
  const addDemoPost = useAppStore((state) => state.addDemoPost);
  const radiusMeters = useAppStore((state) => state.radiusMeters);
  const syncLocation = useLocationSync();
  const [mediaAttachments, setMediaAttachments] = useState<MediaAttachment[]>([]);
  const [shareApproxLocation, setShareApproxLocation] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { control, handleSubmit, setValue, watch, formState } = useForm<Form>({
    defaultValues: { category: "question", body: "", ttlMinutes: 180 }
  });
  const selectedTtl = watch("ttlMinutes");
  const selectedCategory = watch("category");
  const postBody = watch("body");

  async function pickImage() {
    try {
      setErrorMessage(null);
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setErrorMessage("Permesso galleria negato. Abilitalo dalle impostazioni del telefono.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.72
      });
      if (result.canceled || !result.assets[0]) return;

      const asset = result.assets[0];
      assertMediaSize("image", asset.fileSize);
      setMediaAttachments((items) => [
        ...items.filter((item) => item.kind !== "image"),
        {
          kind: "image",
          uri: asset.uri,
          name: asset.fileName ?? `paraggi-image-${Date.now()}.jpg`,
          mimeType: asset.mimeType ?? "image/jpeg"
        }
      ]);
    } catch (error) {
      captureClientError("pick_image_failed", error);
      setErrorMessage(getFriendlyError(error, "Immagine non selezionata. Riprova con un file piu leggero."));
    }
  }

  async function pickVideo() {
    try {
      setErrorMessage(null);
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setErrorMessage("Permesso galleria negato. Abilitalo dalle impostazioni del telefono.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        videoMaxDuration: 30,
        quality: 0.5
      });
      if (result.canceled || !result.assets[0]) return;

      const asset = result.assets[0];
      assertMediaSize("video", asset.fileSize);
      setMediaAttachments((items) => [
      ...items.filter((item) => item.kind !== "video"),
      {
        kind: "video",
        uri: asset.uri,
        name: asset.fileName ?? `paraggi-video-${Date.now()}.mp4`,
        mimeType: asset.mimeType ?? "video/mp4",
        durationSeconds: asset.duration ? Math.round(asset.duration / 1000) : undefined
      }
      ]);
    } catch (error) {
      captureClientError("pick_video_failed", error);
      setErrorMessage(getFriendlyError(error, "Video non selezionato. Usa un video breve e leggero."));
    }
  }

  async function pickAudio() {
    try {
      setErrorMessage(null);
      const result = await DocumentPicker.getDocumentAsync({
        type: ["audio/mpeg", "audio/mp4", "audio/aac", "audio/wav"],
        copyToCacheDirectory: true,
        multiple: false
      });
      if (result.canceled || !result.assets[0]) return;

      const asset = result.assets[0];
      assertMediaSize("audio", asset.size);
      setMediaAttachments((items) => [
      ...items.filter((item) => item.kind !== "audio"),
      {
        kind: "audio",
        uri: asset.uri,
        name: asset.name ?? `paraggi-audio-${Date.now()}`,
        mimeType: asset.mimeType ?? "audio/mpeg"
      }
      ]);
    } catch (error) {
      captureClientError("pick_audio_failed", error);
      setErrorMessage(getFriendlyError(error, "Audio non selezionato. Riprova con un file piu leggero."));
    }
  }

  async function uploadMediaAttachments(items: MediaAttachment[]) {
    if (items.length === 0) return [];

    const { data } = await supabase.auth.getUser();
    if (!data.user) throw { error: "unauthenticated" };

    const uploaded: Array<Record<string, unknown>> = [];
    for (const item of items) {
      const safeName = item.name.replace(/[^a-zA-Z0-9._-]/g, "-");
      const storagePath = `${data.user.id}/${Date.now()}-${safeName}`;
      const response = await fetch(item.uri);
      if (!response.ok) throw { error: "media_upload_failed" };
      const bytes = await response.arrayBuffer();
      const { error } = await supabase.storage.from("post-media").upload(storagePath, bytes, {
        contentType: item.mimeType,
        upsert: false
      });
      if (error) throw error;
      uploaded.push({
        kind: item.kind,
        storagePath,
        mimeType: item.mimeType,
        durationSeconds: item.durationSeconds,
        label: item.name
      });
    }
    return uploaded;
  }

  async function submit(values: Form) {
    setErrorMessage(null);
    setStatusMessage("Preparo il post...");

    if (demoMode) {
      const post = addDemoPost(values);
      await sendLocalNotification("Nuovo post vicino", `${post.display_name}: ${post.body}`);
      router.replace("/(tabs)/feed");
      return;
    }

    try {
      const locationSync = await syncLocation();
      if (!locationSync.ok) {
        setErrorMessage(getFriendlyError(locationSync.reason, "Attiva il GPS prima di pubblicare."));
        setStatusMessage(null);
        return;
      }

      const attachments: Array<Record<string, unknown>> = [];
      if (shareApproxLocation) {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (permission.status === "granted") {
          const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          attachments.push({
            kind: "location",
            label: "Posizione condivisa dall'autore",
            latitude: current.coords.latitude,
            longitude: current.coords.longitude
          });
        }
      }

      if (mediaAttachments.length > 0) {
        setStatusMessage("Carico allegati...");
        attachments.push(...await uploadMediaAttachments(mediaAttachments));
      }

      setStatusMessage("Invio a Supabase...");
      await callFunction("create-post", { body: { ...values, attachments, radiusMeters } });
      router.replace("/(tabs)/feed");
    } catch (error) {
      captureClientError("compose_post_failed", error, {
        mediaCount: mediaAttachments.length,
        shareApproxLocation,
        selectedCategory: values.category,
        ttlMinutes: values.ttlMinutes
      });
      setStatusMessage(null);
      setErrorMessage(getFriendlyError(error, "Post non pubblicato. Controlla login, GPS e rete."));
    }
  }

  return (
    <Screen>
      <View className="gap-5">
        <View className="flex-row items-start gap-3 border-b border-border pb-4">
          <Pressable accessibilityRole="button" accessibilityLabel="Annulla nuovo post" onPress={() => router.back()} className="h-11 w-11 items-center justify-center rounded-card border border-border bg-white">
            <Ionicons name="close" size={22} color="#17232b" />
          </Pressable>
          <View className="flex-1">
            <Text className="text-2xl font-bold text-ink">Cosa succede qui?</Text>
            <Text className="mt-1 text-sm leading-5 text-muted">Condividi con le persone nel tuo raggio.</Text>
          </View>
        </View>
        <Controller control={control} name="body" render={({ field }) => (
          <TextInput
            multiline
            textAlignVertical="top"
            placeholder="Cosa vuoi chiedere o condividere qui?"
            className="min-h-40 rounded-card border border-border bg-white p-4 text-base leading-6 text-ink"
            value={field.value}
            onChangeText={field.onChange}
          />
        )} />
        <View className="gap-2">
          <Text className="font-semibold text-ink">Categoria</Text>
          <View className="flex-row flex-wrap gap-2">
            {(["question", "information", "lost_item", "help", "event", "social", "emergency"] as PostCategory[]).map((category) => (
              <Button key={category} label={categoryLabels[category]} variant={selectedCategory === category ? "primary" : "secondary"} onPress={() => setValue("category", category)} />
            ))}
          </View>
        </View>
        <View className="gap-2">
          <Text className="font-semibold text-ink">Scadenza</Text>
          <View className="flex-row gap-2">
            {([30, 180, 1440] as PostTtlMinutes[]).map((ttl) => (
              <Button key={ttl} label={ttl === 30 ? "30 min" : ttl === 180 ? "3 ore" : "24 ore"} variant={selectedTtl === ttl ? "primary" : "secondary"} onPress={() => setValue("ttlMinutes", ttl)} />
            ))}
          </View>
        </View>
        <View className="gap-3 border-t border-border pt-4">
          <View>
            <Text className="font-semibold text-ink">Allegati e posizione</Text>
            <Text className="mt-1 text-sm leading-5 text-muted">Facoltativo. Immagini fino a 10 MB, video fino a 20 MB e audio fino a 12 MB.</Text>
          </View>
          <View className="flex-row flex-wrap gap-2">
            <Button icon="image-outline" label={mediaAttachments.some((item) => item.kind === "image") ? "Immagine pronta" : "Immagine"} variant={mediaAttachments.some((item) => item.kind === "image") ? "primary" : "secondary"} onPress={() => void pickImage()} />
            <Button icon="videocam-outline" label={mediaAttachments.some((item) => item.kind === "video") ? "Video pronto" : "Video"} variant={mediaAttachments.some((item) => item.kind === "video") ? "primary" : "secondary"} onPress={() => void pickVideo()} />
            <Button icon="mic-outline" label={mediaAttachments.some((item) => item.kind === "audio") ? "Audio pronto" : "Audio"} variant={mediaAttachments.some((item) => item.kind === "audio") ? "primary" : "secondary"} onPress={() => void pickAudio()} />
            <Button icon="location-outline" label={shareApproxLocation ? "Posizione attiva" : "Posizione"} variant={shareApproxLocation ? "primary" : "secondary"} onPress={() => setShareApproxLocation((value) => !value)} />
          </View>
          {(mediaAttachments.length > 0 || shareApproxLocation) ? (
            <Text className="text-sm leading-5 text-muted">
              Allegati selezionati: {[
                ...mediaAttachments.map((item) => item.kind === "image" ? "immagine" : item.kind),
                shareApproxLocation ? "posizione" : null
              ].filter(Boolean).join(", ")}
            </Text>
          ) : null}
        </View>
        {statusMessage ? <Text className="rounded-card bg-primary/10 p-3 text-sm font-semibold text-primary">{statusMessage}</Text> : null}
        {errorMessage ? <Text className="rounded-card bg-danger/10 p-3 text-sm font-semibold text-danger">{errorMessage}</Text> : null}
        <Button label={formState.isSubmitting ? "Pubblico..." : "Pubblica nel raggio"} icon="send" loading={formState.isSubmitting} onPress={handleSubmit(submit)} disabled={formState.isSubmitting || !postBody.trim()} />
      </View>
    </Screen>
  );
}
