import type { PostCategory, PostTtlMinutes } from "@paraggi/domain";
import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from "expo-audio";
import * as FileSystem from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Pressable, Text, TextInput, View } from "react-native";
import { Button } from "@/components/Button";
import { PostAttachments } from "@/components/PostAttachments";
import { getPostCategoryTheme, postCategoryOrder } from "@/design/postCategories";
import { Screen } from "@/components/Screen";
import { demoMode, env } from "@/config/env";
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
  id: string;
  kind: "image" | "video" | "audio";
  uri: string;
  name: string;
  mimeType: string;
  durationSeconds?: number;
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
  const queryClient = useQueryClient();
  const addDemoPost = useAppStore((state) => state.addDemoPost);
  const radiusMeters = useAppStore((state) => state.radiusMeters);
  const syncLocation = useLocationSync();
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder, 200);
  const stoppingRecordingRef = useRef(false);
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
          id: `local-image-${Date.now()}`,
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
          id: `local-video-${Date.now()}`,
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

  const stopVoiceRecording = useCallback(async () => {
    if (stoppingRecordingRef.current || !recorder.isRecording) return;
    stoppingRecordingRef.current = true;
    try {
      const durationSeconds = Math.max(1, Math.round(recorderState.durationMillis / 1000));
      await recorder.stop();
      if (!recorder.uri) throw new Error("recording_file_missing");
      const recordingUri = recorder.uri;
      setMediaAttachments((items) => [
        ...items.filter((item) => item.kind !== "audio"),
        {
          id: `local-audio-${Date.now()}`,
          kind: "audio",
          uri: recordingUri,
          name: `nota-vocale-${Date.now()}.m4a`,
          mimeType: "audio/mp4",
          durationSeconds
        }
      ]);
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      setStatusMessage("Nota vocale pronta.");
    } catch (error) {
      captureClientError("stop_voice_recording_failed", error);
      setErrorMessage("Non sono riuscito a salvare la nota vocale. Riprova.");
    } finally {
      stoppingRecordingRef.current = false;
    }
  }, [recorder, recorderState.durationMillis]);

  async function toggleVoiceRecording() {
    if (recorder.isRecording) {
      await stopVoiceRecording();
      return;
    }

    try {
      setErrorMessage(null);
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        setErrorMessage("Permesso microfono negato. Puoi abilitarlo dalle impostazioni del telefono.");
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setStatusMessage("Registrazione in corso. Tocca di nuovo per terminare.");
    } catch (error) {
      captureClientError("start_voice_recording_failed", error);
      setErrorMessage("Registrazione non avviata. Controlla il permesso microfono.");
    }
  }

  useEffect(() => {
    if (recorderState.isRecording && recorderState.durationMillis >= 60_000) void stopVoiceRecording();
  }, [recorderState.durationMillis, recorderState.isRecording, stopVoiceRecording]);

  async function toggleLocationAttachment() {
    if (shareApproxLocation) {
      setShareApproxLocation(false);
      return;
    }

    setErrorMessage(null);
    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.status !== "granted") {
      setErrorMessage("Permesso posizione negato. Abilitalo dalle impostazioni del telefono.");
      return;
    }
    setShareApproxLocation(true);
    setStatusMessage("Posizione approssimativa pronta. Non mostreremo le coordinate nel post.");
  }

  async function uploadMediaAttachments(items: MediaAttachment[]) {
    if (items.length === 0) return [];

    const { data } = await supabase.auth.getSession();
    if (!data.session?.user) throw { error: "unauthenticated" };

    const uploaded: Array<Record<string, unknown>> = [];
    const uploadedPaths: string[] = [];
    try {
      for (const item of items) {
        const safeName = item.name.replace(/[^a-zA-Z0-9._-]/g, "-");
        const storagePath = `${data.session.user.id}/${Date.now()}-${safeName}`;
        const encodedPath = storagePath.split("/").map(encodeURIComponent).join("/");
        const response = await FileSystem.uploadAsync(`${env.supabaseUrl}/storage/v1/object/post-media/${encodedPath}`, item.uri, {
          httpMethod: "POST",
          uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
          headers: {
            Authorization: `Bearer ${data.session.access_token}`,
            apikey: env.supabaseAnonKey,
            "Content-Type": item.mimeType,
            "cache-control": "max-age=3600",
            "x-upsert": "false"
          }
        });
        if (response.status < 200 || response.status >= 300) {
          throw new Error(`media_upload_failed:${response.status}:${response.body.slice(0, 160)}`);
        }
        uploadedPaths.push(storagePath);
        uploaded.push({
          kind: item.kind,
          storagePath,
          mimeType: item.mimeType,
          durationSeconds: item.durationSeconds,
          label: item.name
        });
      }
      return uploaded;
    } catch (error) {
      if (uploadedPaths.length > 0) await supabase.storage.from("post-media").remove(uploadedPaths);
      throw error;
    }
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
            latitude: Math.round(current.coords.latitude * 1000) / 1000,
            longitude: Math.round(current.coords.longitude * 1000) / 1000
          });
        }
      }

      if (mediaAttachments.length > 0) {
        setStatusMessage("Carico allegati...");
        attachments.push(...await uploadMediaAttachments(mediaAttachments));
      }

      setStatusMessage("Invio a Supabase...");
      await callFunction("create-post", { body: { ...values, attachments, radiusMeters } });
      setStatusMessage("Post pubblicato. Aggiorno la piazza...");
      setMediaAttachments([]);
      await queryClient.invalidateQueries({ queryKey: ["nearby-feed"], refetchType: "none" });
      if (router.canGoBack()) router.back();
      else router.replace("/(tabs)/feed");
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
            {postCategoryOrder.map((category) => {
              const theme = getPostCategoryTheme(category);
              const selected = selectedCategory === category;
              return (
                <Pressable
                  key={category}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  onPress={() => setValue("category", category)}
                  className={`min-h-11 flex-row items-center gap-1.5 rounded-full border px-3 ${theme.backgroundClass} ${selected ? theme.borderClass : "border-transparent"}`}
                >
                  <Ionicons name={theme.icon} size={16} color={theme.iconColor} />
                  <Text className={`text-sm font-semibold ${theme.textClass}`}>{theme.label}</Text>
                  {selected ? <Ionicons name="checkmark-circle" size={16} color={theme.iconColor} /> : null}
                </Pressable>
              );
            })}
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
            <Button
              icon={recorderState.isRecording ? "stop" : "mic-outline"}
              label={recorderState.isRecording ? `Termina ${Math.floor(recorderState.durationMillis / 1000)}s` : mediaAttachments.some((item) => item.kind === "audio") ? "Registra di nuovo" : "Nota vocale"}
              variant={recorderState.isRecording || mediaAttachments.some((item) => item.kind === "audio") ? "primary" : "secondary"}
              onPress={() => void toggleVoiceRecording()}
            />
            <Button icon="location-outline" label={shareApproxLocation ? "Posizione attiva" : "Posizione"} variant={shareApproxLocation ? "primary" : "secondary"} onPress={() => void toggleLocationAttachment()} />
          </View>
          {(mediaAttachments.length > 0 || shareApproxLocation) ? (
            <Text className="text-sm leading-5 text-muted">
              Allegati selezionati: {[
                ...mediaAttachments.map((item) => item.kind === "image" ? "immagine" : item.kind),
                shareApproxLocation ? "posizione" : null
              ].filter(Boolean).join(", ")}
            </Text>
          ) : null}
          {mediaAttachments.length > 0 ? (
            <View className="gap-3">
              <PostAttachments enableImageViewer={false} attachments={mediaAttachments.map((item) => ({
                id: item.id,
                kind: item.kind,
                url: item.uri,
                label: item.name,
                mime_type: item.mimeType,
                duration_seconds: item.durationSeconds
              }))} />
              <View className="flex-row flex-wrap gap-2">
                {mediaAttachments.map((item) => (
                  <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`Rimuovi ${item.kind}`} onPress={() => setMediaAttachments((items) => items.filter((candidate) => candidate.id !== item.id))} className="min-h-11 flex-row items-center gap-2 rounded-card border border-border bg-white px-3">
                    <Ionicons name="trash-outline" size={17} color="#b42318" />
                    <Text className="text-sm font-semibold text-danger">Rimuovi {item.kind === "audio" ? "nota vocale" : item.kind}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}
        </View>
        {statusMessage ? <Text className="rounded-card bg-primary/10 p-3 text-sm font-semibold text-primary">{statusMessage}</Text> : null}
        {errorMessage ? <Text className="rounded-card bg-danger/10 p-3 text-sm font-semibold text-danger">{errorMessage}</Text> : null}
        <Button
          label={recorderState.isRecording ? "Termina prima la nota vocale" : formState.isSubmitting ? "Pubblico..." : "Pubblica nel raggio"}
          icon="send"
          loading={formState.isSubmitting}
          onPress={handleSubmit(submit)}
          disabled={formState.isSubmitting || recorderState.isRecording || !postBody.trim()}
        />
      </View>
    </Screen>
  );
}
