import type { PostCategory, PostTtlMinutes } from "@paraggi/domain";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { router } from "expo-router";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Text, TextInput, View } from "react-native";
import { Button } from "@/components/Button";
import { Screen } from "@/components/Screen";
import { demoMode } from "@/config/env";
import { useLocationSync } from "@/hooks/useLocationSync";
import { callFunction } from "@/services/api";
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

export default function ComposePostScreen() {
  const addDemoPost = useAppStore((state) => state.addDemoPost);
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

  async function pickImage() {
    setErrorMessage(null);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setErrorMessage("Permesso galleria negato. Abilitalo dalle impostazioni del telefono.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.82
    });
    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    setMediaAttachments((items) => [
      ...items.filter((item) => item.kind !== "image"),
      {
        kind: "image",
        uri: asset.uri,
        name: asset.fileName ?? `paraggi-image-${Date.now()}.jpg`,
        mimeType: asset.mimeType ?? "image/jpeg"
      }
    ]);
  }

  async function pickVideo() {
    setErrorMessage(null);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setErrorMessage("Permesso galleria negato. Abilitalo dalle impostazioni del telefono.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      videoMaxDuration: 30,
      quality: 0.7
    });
    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
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
  }

  async function pickAudio() {
    setErrorMessage(null);
    const result = await DocumentPicker.getDocumentAsync({
      type: ["audio/mpeg", "audio/mp4", "audio/aac", "audio/wav"],
      copyToCacheDirectory: true,
      multiple: false
    });
    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    setMediaAttachments((items) => [
      ...items.filter((item) => item.kind !== "audio"),
      {
        kind: "audio",
        uri: asset.uri,
        name: asset.name ?? `paraggi-audio-${Date.now()}`,
        mimeType: asset.mimeType ?? "audio/mpeg"
      }
    ]);
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
      const blob = await response.blob();
      const { error } = await supabase.storage.from("post-media").upload(storagePath, blob, {
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
      await callFunction("create-post", { body: { ...values, attachments } });
      router.replace("/(tabs)/feed");
    } catch (error) {
      setStatusMessage(null);
      setErrorMessage(getFriendlyError(error, "Post non pubblicato. Controlla login, GPS e rete."));
    }
  }

  return (
    <Screen>
      <View className="mt-4 gap-5">
        <View>
          <Text className="text-2xl font-bold text-ink">Nuovo post locale</Text>
          <Text className="mt-1 text-sm leading-5 text-muted">Sara visibile solo a persone vicine e scadra automaticamente.</Text>
        </View>
        <Controller control={control} name="body" render={({ field }) => (
          <TextInput
            multiline
            textAlignVertical="top"
            placeholder="Cosa vuoi chiedere o condividere qui?"
            className="min-h-36 rounded-card border border-border p-3 text-base text-ink"
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
        <View className="gap-3 rounded-card border border-border bg-surface p-4">
          <View>
            <Text className="font-semibold text-ink">Allegati e posizione</Text>
            <Text className="mt-1 text-sm leading-5 text-muted">Il GPS serve sempre per pubblicare. Puoi allegare una immagine, un video breve, un audio o una posizione volontaria.</Text>
          </View>
          <View className="flex-row flex-wrap gap-2">
            <Button label={mediaAttachments.some((item) => item.kind === "image") ? "Immagine pronta" : "Aggiungi immagine"} variant={mediaAttachments.some((item) => item.kind === "image") ? "primary" : "secondary"} onPress={() => void pickImage()} />
            <Button label={mediaAttachments.some((item) => item.kind === "video") ? "Video pronto" : "Aggiungi video"} variant={mediaAttachments.some((item) => item.kind === "video") ? "primary" : "secondary"} onPress={() => void pickVideo()} />
            <Button label={mediaAttachments.some((item) => item.kind === "audio") ? "Audio pronto" : "Aggiungi audio"} variant={mediaAttachments.some((item) => item.kind === "audio") ? "primary" : "secondary"} onPress={() => void pickAudio()} />
            <Button label={shareApproxLocation ? "GPS nel post attivo" : "Condividi GPS"} variant={shareApproxLocation ? "primary" : "secondary"} onPress={() => setShareApproxLocation((value) => !value)} />
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
        <Button label="Pubblica" onPress={handleSubmit(submit)} disabled={formState.isSubmitting} />
      </View>
    </Screen>
  );
}
