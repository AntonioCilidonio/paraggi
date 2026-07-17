import { Ionicons } from "@expo/vector-icons";
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";
import * as FileSystem from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { Button } from "@/components/Button";
import { AppHeader } from "@/components/AppHeader";
import { PostAttachments } from "@/components/PostAttachments";
import { Screen } from "@/components/Screen";
import { demoMode, env } from "@/config/env";
import { demoChats, demoMessages } from "@/demo/data";
import { useRealtimeChannel } from "@/hooks/useRealtimeChannel";
import { callFunction } from "@/services/api";
import { captureClientError } from "@/services/clientLogger";
import { getFriendlyError } from "@/services/errors";
import { getAvatarUrl } from "@/services/avatar";
import { dismissPresentedChatNotifications } from "@/services/notifications";
import { supabase } from "@/services/supabase";
import { useAppStore } from "@/stores/appStore";

type AttachmentKind = "image" | "video" | "audio";

type LocalAttachment = {
  kind: AttachmentKind;
  uri: string;
  name: string;
  mimeType: string;
  durationSeconds?: number;
};

type Message = {
  id: string;
  sender_id: string;
  body: string;
  created_at: string;
  delivered_at?: string | null;
  read_at?: string | null;
  attachment_kind?: AttachmentKind | null;
  attachment_url?: string | null;
  attachment_mime_type?: string | null;
  attachment_duration_seconds?: number | null;
  attachment_label?: string | null;
};

type ThreadResponse = {
  chat: {
    id: string;
    is_connected?: boolean;
    other_profile?: { display_name: string; reputation_score: number; avatar_path?: string | null } | null;
  };
  messages: Message[];
  currentUserId: string;
  disconnected?: boolean;
};

const emptyDemoMessages: Message[] = [];
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const mediaLimits: Record<AttachmentKind, number> = {
  image: 10 * 1024 * 1024,
  video: 20 * 1024 * 1024,
  audio: 12 * 1024 * 1024,
};

function attachmentLabel(kind: AttachmentKind) {
  if (kind === "image") return "Foto";
  if (kind === "video") return "Video";
  return "Nota vocale";
}

export default function ChatDetailScreen() {
  const params = useLocalSearchParams<{ chatId?: string | string[] }>();
  const chatId = Array.isArray(params.chatId)
    ? params.chatId[0]
    : params.chatId;
  const hasChatId =
    typeof chatId === "string" &&
    (demoMode ? chatId.length > 0 : uuidPattern.test(chatId));
  const queryClient = useQueryClient();
  const demoExtraMessages = useAppStore(
    (state) => state.demoMessagesByChat[chatId ?? ""] ?? emptyDemoMessages,
  );
  const addDemoMessage = useAppStore((state) => state.addDemoMessage);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder, 200);
  const stoppingRecordingRef = useRef(false);
  const [body, setBody] = useState("");
  const [attachment, setAttachment] = useState<LocalAttachment | null>(null);
  const [attachmentMenuOpen, setAttachmentMenuOpen] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  useRealtimeChannel(hasChatId ? { type: "chat-messages", chatId } : null);

  const thread = useQuery<ThreadResponse>({
    queryKey: ["chat-thread", chatId, demoExtraMessages.length],
    enabled: hasChatId,
    refetchInterval: demoMode ? false : 15000,
    queryFn: async () => {
      if (!hasChatId) throw new Error("Chat non ancora caricata.");
      if (demoMode) {
        const base =
          demoChats.find((item) => item.id === chatId) ?? demoChats[0];
        return {
          chat: {
            ...base,
            is_connected: true,
            other_profile: {
              display_name: chatId === "demo-active-chat" ? "Marta" : "Luca",
              reputation_score: 24,
            },
          },
          messages: [...demoMessages, ...demoExtraMessages],
          currentUserId: "me",
          disconnected: false,
        };
      }
      return callFunction<ThreadResponse>("get-chat-messages", {
        method: "GET",
        query: { chatId },
      });
    },
  });

  useEffect(() => {
    if (demoMode || !thread.dataUpdatedAt || !chatId) return;
    void dismissPresentedChatNotifications(chatId);
    void queryClient.invalidateQueries({ queryKey: ["chats"] });
    void queryClient.invalidateQueries({ queryKey: ["notifications"] });
  }, [chatId, queryClient, thread.dataUpdatedAt]);

  async function uploadAttachment(item: LocalAttachment) {
    const { data } = await supabase.auth.getSession();
    if (!data.session?.user || !chatId) throw { error: "unauthenticated" };
    const safeName = item.name.replace(/[^a-zA-Z0-9._-]/g, "-");
    const storagePath = `${data.session.user.id}/${chatId}/${Date.now()}-${safeName}`;
    const encodedPath = storagePath
      .split("/")
      .map(encodeURIComponent)
      .join("/");
    const response = await FileSystem.uploadAsync(
      `${env.supabaseUrl}/storage/v1/object/chat-media/${encodedPath}`,
      item.uri,
      {
        httpMethod: "POST",
        uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
        headers: {
          Authorization: `Bearer ${data.session.access_token}`,
          apikey: env.supabaseAnonKey,
          "Content-Type": item.mimeType,
          "cache-control": "max-age=3600",
          "x-upsert": "false",
        },
      },
    );
    if (response.status < 200 || response.status >= 300) {
      captureClientError(
        "chat_media_upload_failed",
        new Error(`${response.status}:${response.body.slice(0, 120)}`),
        { chatId, kind: item.kind },
      );
      throw { error: "media_upload_failed" };
    }
    return storagePath;
  }

  const send = useMutation({
    mutationFn: async () => {
      setSendError(null);
      if (!hasChatId) throw new Error("Chat non ancora caricata.");
      if (!body.trim() && !attachment)
        throw new Error("Scrivi un messaggio o aggiungi un allegato.");
      if (demoMode)
        return {
          message: addDemoMessage(
            chatId ?? "demo-active-chat",
            body.trim() || attachmentLabel(attachment!.kind),
          ),
        };

      let uploadedPath: string | null = null;
      try {
        if (attachment) uploadedPath = await uploadAttachment(attachment);
        return await callFunction("send-private-message", {
          body: {
            chatId,
            body: body.trim(),
            attachment:
              attachment && uploadedPath
                ? {
                    kind: attachment.kind,
                    storagePath: uploadedPath,
                    mimeType: attachment.mimeType,
                    durationSeconds: attachment.durationSeconds,
                    label: attachment.name,
                  }
                : undefined,
          },
        });
      } catch (error) {
        if (uploadedPath)
          await supabase.storage.from("chat-media").remove([uploadedPath]);
        throw error;
      }
    },
    onSuccess: async () => {
      setBody("");
      setAttachment(null);
      setAttachmentMenuOpen(false);
      await queryClient.invalidateQueries({
        queryKey: ["chat-thread", chatId],
      });
      await queryClient.invalidateQueries({ queryKey: ["chats"] });
    },
    onError: (error) => {
      captureClientError("send_private_message_failed", error, {
        chatId,
        hasAttachment: Boolean(attachment),
      });
      setSendError(
        getFriendlyError(
          error,
          "Messaggio non inviato. Controlla la rete e riprova.",
        ),
      );
    },
  });

  const disconnect = useMutation({
    mutationFn: async () => {
      if (!hasChatId) throw new Error("Chat non ancora caricata.");
      if (demoMode) return { disconnected: true };
      return callFunction("disconnect-chat", { body: { chatId } });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["chats"] });
      router.replace("/(tabs)/chats");
    },
    onError: (error) =>
      setSendError(
        getFriendlyError(error, "Connessione non rimossa. Riprova."),
      ),
  });

  const isConnected =
    thread.data?.disconnected !== true &&
    thread.data?.chat.is_connected !== false;
  const otherName = thread.data?.chat.other_profile?.display_name ?? "Persona";
  const otherAvatarUrl = getAvatarUrl(thread.data?.chat.other_profile?.avatar_path);

  function setPickedAsset(asset: ImagePicker.ImagePickerAsset) {
    const kind: AttachmentKind = asset.type === "video" ? "video" : "image";
    if (asset.fileSize && asset.fileSize > mediaLimits[kind])
      throw { error: "media_too_large" };
    setAttachment({
      kind,
      uri: asset.uri,
      name:
        asset.fileName ??
        `paraggi-${kind}-${Date.now()}.${kind === "video" ? "mp4" : "jpg"}`,
      mimeType:
        asset.mimeType ?? (kind === "video" ? "video/mp4" : "image/jpeg"),
      durationSeconds: asset.duration
        ? Math.round(asset.duration / 1000)
        : undefined,
    });
    setAttachmentMenuOpen(false);
  }

  async function pickFromLibrary() {
    try {
      setSendError(null);
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) throw new Error("Permesso galleria negato.");
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        quality: 0.72,
        videoMaxDuration: 30,
      });
      if (!result.canceled && result.assets[0])
        setPickedAsset(result.assets[0]);
    } catch (error) {
      setSendError(getFriendlyError(error, "Allegato non selezionato."));
    }
  }

  async function takePhoto() {
    try {
      setSendError(null);
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) throw new Error("Permesso fotocamera negato.");
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.72,
      });
      if (!result.canceled && result.assets[0])
        setPickedAsset(result.assets[0]);
    } catch (error) {
      setSendError(getFriendlyError(error, "Foto non acquisita."));
    }
  }

  const stopVoiceRecording = useCallback(async () => {
    if (stoppingRecordingRef.current || !recorder.isRecording) return;
    stoppingRecordingRef.current = true;
    try {
      const durationSeconds = Math.max(
        1,
        Math.round(recorderState.durationMillis / 1000),
      );
      await recorder.stop();
      if (!recorder.uri) throw new Error("recording_file_missing");
      setAttachment({
        kind: "audio",
        uri: recorder.uri,
        name: `nota-vocale-${Date.now()}.m4a`,
        mimeType: "audio/mp4",
        durationSeconds,
      });
      await setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
      });
      setAttachmentMenuOpen(false);
    } catch (error) {
      setSendError(getFriendlyError(error, "Nota vocale non salvata."));
    } finally {
      stoppingRecordingRef.current = false;
    }
  }, [recorder, recorderState.durationMillis]);

  async function toggleVoiceRecording() {
    if (recorder.isRecording) return stopVoiceRecording();
    try {
      setSendError(null);
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) throw new Error("Permesso microfono negato.");
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });
      await recorder.prepareToRecordAsync();
      recorder.record();
    } catch (error) {
      setSendError(getFriendlyError(error, "Registrazione non avviata."));
    }
  }

  useEffect(() => {
    if (recorderState.isRecording && recorderState.durationMillis >= 60_000)
      void stopVoiceRecording();
  }, [
    recorderState.durationMillis,
    recorderState.isRecording,
    stopVoiceRecording,
  ]);

  function confirmDisconnect() {
    Alert.alert(
      "Rimuovere la connessione?",
      `Lo storico con ${otherName} restera visibile, ma non potrete piu scrivere finche non accetterete una nuova richiesta.`,
      [
        { text: "Annulla", style: "cancel" },
        {
          text: "Rimuovi",
          style: "destructive",
          onPress: () => disconnect.mutate(),
        },
      ],
    );
  }

  return (
    <Screen scroll={false} showBottomBar>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <AppHeader />
        <View className="mt-4 flex-row items-center gap-3 border-b border-border pb-3">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Torna alle chat"
            onPress={() => router.back()}
            className="h-11 w-11 items-center justify-center rounded-card border border-border bg-white"
          >
            <Ionicons name="arrow-back" size={21} color="#1a2027" />
          </Pressable>
          <Pressable
            accessibilityRole={otherAvatarUrl && isConnected ? "imagebutton" : undefined}
            accessibilityLabel={otherAvatarUrl && isConnected ? `Apri la foto profilo di ${otherName}` : undefined}
            disabled={!otherAvatarUrl || !isConnected}
            onPress={() => otherAvatarUrl && router.push({ pathname: "/media-view", params: { url: otherAvatarUrl, label: otherName } })}
            className="h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-primary-soft"
          >
            {otherAvatarUrl ? (
              <Image source={{ uri: otherAvatarUrl }} contentFit="cover" cachePolicy="memory-disk" style={{ width: 44, height: 44 }} />
            ) : (
              <Text className="font-bold text-primary">{otherName.slice(0, 1).toUpperCase()}</Text>
            )}
          </Pressable>
          <View className="flex-1">
            <Text className="text-lg font-bold text-ink">{otherName}</Text>
            <Text className="text-xs text-muted">Chat privata attiva</Text>
          </View>
          {isConnected ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Rimuovi connessione con ${otherName}`}
              disabled={disconnect.isPending}
              onPress={confirmDisconnect}
              className="h-11 w-11 items-center justify-center rounded-card border border-border bg-white disabled:opacity-50"
            >
              <Ionicons
                name="person-remove-outline"
                size={20}
                color="#b84037"
              />
            </Pressable>
          ) : null}
        </View>

        {!hasChatId || thread.isError ? (
          <View className="mt-4 gap-3 rounded-card border border-danger bg-surface p-4">
            <Text className="font-semibold text-danger">Chat non caricata</Text>
            <Text className="text-sm leading-5 text-muted">
              {!hasChatId
                ? "Torna all'elenco Chat e riapri la conversazione."
                : getFriendlyError(
                    thread.error,
                    "Controlla login e rete, poi riprova.",
                  )}
            </Text>
            <Button
              label="Riprova"
              variant="secondary"
              onPress={() => void thread.refetch()}
            />
          </View>
        ) : null}

        {!isConnected ? (
          <View className="mt-4 gap-2 rounded-card border border-border bg-surface p-4">
            <Text className="font-semibold text-ink">Connessione rimossa</Text>
            <Text className="text-sm leading-5 text-muted">
              Lo storico resta disponibile in sola lettura. Puoi riconnetterti
              dall'elenco Chat.
            </Text>
          </View>
        ) : null}

        <FlatList
          className="flex-1"
          data={thread.data?.messages ?? []}
          keyExtractor={(message) => message.id}
          contentContainerStyle={{
            paddingVertical: 16,
            flexGrow: 1,
            justifyContent:
              (thread.data?.messages.length ?? 0) === 0
                ? "center"
                : "flex-start",
          }}
          ItemSeparatorComponent={() => <View className="h-2" />}
          ListEmptyComponent={
            thread.isLoading ? (
              <Text className="text-center text-sm text-muted">
                Carico i messaggi...
              </Text>
            ) : (
              <View className="items-center gap-2 px-6 py-10">
                <Ionicons
                  name="chatbubbles-outline"
                  size={30}
                  color="#62717a"
                />
                <Text className="font-semibold text-ink">
                  La conversazione inizia qui
                </Text>
                <Text className="text-center text-sm leading-5 text-muted">
                  Scrivi un messaggio oppure condividi una foto, un video o una
                  nota vocale.
                </Text>
              </View>
            )
          }
          renderItem={({ item: message }) => {
            const isMine = message.sender_id === thread.data?.currentUserId;
            const media = message.attachment_kind
              ? [
                  {
                    id: `${message.id}-attachment`,
                    kind: message.attachment_kind,
                    url: message.attachment_url,
                    label: message.attachment_label,
                    mime_type: message.attachment_mime_type,
                    duration_seconds: message.attachment_duration_seconds,
                  },
                ]
              : [];
            return (
              <View
                className={`max-w-[78%] gap-2 rounded-card p-2.5 ${isMine ? "self-end bg-primary-soft" : "self-start bg-white"}`}
              >
                {media.length > 0 ? (
                  <PostAttachments attachments={media} />
                ) : null}
                {message.body ? (
                  <Text
                    className="text-base leading-5 text-ink"
                  >
                    {message.body}
                  </Text>
                ) : null}
                <View className="flex-row items-center justify-end gap-1">
                  <Text
                    className="text-xs text-muted"
                  >
                    {new Date(message.created_at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </Text>
                  {isMine ? (
                    <Ionicons
                      name={message.read_at ? "checkmark-done" : "checkmark"}
                      size={14}
                      color="#526a72"
                    />
                  ) : null}
                </View>
              </View>
            );
          }}
        />

        {isConnected ? (
          <View className="gap-2 border-t border-border bg-bg pt-3">
            {attachment ? (
              <View className="gap-2 rounded-card border border-border bg-white p-3">
                <View className="flex-row items-center justify-between">
                  <Text className="font-semibold text-ink">
                    {attachmentLabel(attachment.kind)} pronta
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Rimuovi allegato"
                    onPress={() => setAttachment(null)}
                    className="h-10 w-10 items-center justify-center rounded-card bg-surface"
                  >
                    <Ionicons name="close" size={20} color="#1a2027" />
                  </Pressable>
                </View>
                <PostAttachments
                  enableImageViewer={false}
                  attachments={[
                    {
                      id: "preview",
                      kind: attachment.kind,
                      url: attachment.uri,
                      label: attachment.name,
                      mime_type: attachment.mimeType,
                      duration_seconds: attachment.durationSeconds,
                    },
                  ]}
                />
              </View>
            ) : null}
            {attachmentMenuOpen ? (
              <View className="flex-row justify-around rounded-card border border-border bg-white p-2">
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Scatta una foto"
                  onPress={() => void takePhoto()}
                  className="min-h-14 min-w-20 items-center justify-center gap-1"
                >
                  <Ionicons name="camera-outline" size={23} color="#3b82c4" />
                  <Text className="text-xs font-semibold text-ink">
                    Fotocamera
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Scegli foto o video"
                  onPress={() => void pickFromLibrary()}
                  className="min-h-14 min-w-20 items-center justify-center gap-1"
                >
                  <Ionicons name="images-outline" size={23} color="#3b82c4" />
                  <Text className="text-xs font-semibold text-ink">
                    Galleria
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    recorderState.isRecording
                      ? "Termina nota vocale"
                      : "Registra nota vocale"
                  }
                  onPress={() => void toggleVoiceRecording()}
                  className="min-h-14 min-w-20 items-center justify-center gap-1"
                >
                  <Ionicons
                    name={
                      recorderState.isRecording ? "stop-circle" : "mic-outline"
                    }
                    size={23}
                    color={recorderState.isRecording ? "#b84037" : "#3b82c4"}
                  />
                  <Text className="text-xs font-semibold text-ink">
                    {recorderState.isRecording
                      ? `${Math.floor(recorderState.durationMillis / 1000)}s`
                      : "Audio"}
                  </Text>
                </Pressable>
              </View>
            ) : null}
            <View className="flex-row items-end gap-2 pb-2">
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Aggiungi allegato"
                accessibilityState={{ expanded: attachmentMenuOpen }}
                onPress={() => setAttachmentMenuOpen((value) => !value)}
                className="h-12 w-12 items-center justify-center rounded-card border border-border bg-white"
              >
                <Ionicons
                  name={attachmentMenuOpen ? "close" : "add"}
                  size={24}
                  color="#3b82c4"
                />
              </Pressable>
              <TextInput
                multiline
                maxLength={2000}
                placeholder="Messaggio"
                className="max-h-28 min-h-12 flex-1 rounded-card border border-border bg-white px-3 py-3 text-ink"
                value={body}
                onChangeText={setBody}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Invia messaggio"
                disabled={
                  (!body.trim() && !attachment) ||
                  send.isPending ||
                  recorderState.isRecording
                }
                onPress={() => send.mutate()}
                className="h-12 w-12 items-center justify-center rounded-card bg-accent disabled:opacity-50"
              >
                <Ionicons name="send" size={19} color="#ffffff" />
              </Pressable>
            </View>
          </View>
        ) : null}
        {sendError ? (
          <Text className="mb-2 rounded-card bg-danger/10 p-3 text-sm font-semibold text-danger">
            {sendError}
          </Text>
        ) : null}
      </KeyboardAvoidingView>
    </Screen>
  );
}
