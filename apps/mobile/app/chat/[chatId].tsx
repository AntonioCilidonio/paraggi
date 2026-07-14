import type { ChatStatus } from "@paraggi/domain";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Alert, Pressable, Text, TextInput, View } from "react-native";
import { Button } from "@/components/Button";
import { ChatFrozenBanner } from "@/components/ChatFrozenBanner";
import { Screen } from "@/components/Screen";
import { demoMode } from "@/config/env";
import { demoChats, demoMessages } from "@/demo/data";
import { callFunction } from "@/services/api";
import { getFriendlyError } from "@/services/errors";
import { sendLocalNotification } from "@/services/notifications";
import { useRealtimeChannel } from "@/hooks/useRealtimeChannel";
import { useAppStore } from "@/stores/appStore";

type Message = {
  id: string;
  sender_id: string;
  body: string;
  created_at: string;
};

type ThreadResponse = {
  chat: {
    id: string;
    user_a_id?: string;
    user_b_id?: string;
    status: ChatStatus;
    is_connected?: boolean;
    last_distance_meters: number | null;
    other_profile?: { display_name: string; reputation_score: number } | null;
  };
  messages: Message[];
  currentUserId: string;
  disconnected?: boolean;
};

const emptyDemoMessages: Message[] = [];
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default function ChatDetailScreen() {
  const params = useLocalSearchParams<{ chatId?: string | string[] }>();
  const chatId = Array.isArray(params.chatId) ? params.chatId[0] : params.chatId;
  const hasChatId = typeof chatId === "string" && (demoMode ? chatId.length > 0 : uuidPattern.test(chatId));
  const queryClient = useQueryClient();
  const demoStatus = useAppStore((state) => state.demoChatStatusById[chatId ?? ""]);
  const demoExtraMessages = useAppStore((state) => state.demoMessagesByChat[chatId ?? ""] ?? emptyDemoMessages);
  const addDemoMessage = useAppStore((state) => state.addDemoMessage);
  const setDemoChatStatus = useAppStore((state) => state.setDemoChatStatus);
  const { control, handleSubmit, reset, watch } = useForm<{ body: string }>({ defaultValues: { body: "" } });
  const messageBody = watch("body");
  const [sendError, setSendError] = useState<string | null>(null);
  useRealtimeChannel(hasChatId ? { type: "chat-messages", chatId } : null);
  useRealtimeChannel(hasChatId ? { type: "chat-status", chatId } : null);

  const thread = useQuery<ThreadResponse>({
    queryKey: ["chat-thread", chatId, demoStatus, demoExtraMessages.length],
    enabled: hasChatId,
    refetchInterval: demoMode ? false : (query) => query.state.data?.disconnected ? false : 15000,
    queryFn: async () => {
      if (!hasChatId) throw new Error("Chat non ancora caricata.");
      if (demoMode) {
        const base = demoChats.find((item) => item.id === chatId) ?? demoChats[0];
        return {
          chat: { ...base, status: demoStatus ?? base.status, is_connected: true, other_profile: { display_name: chatId === "demo-active-chat" ? "Marta" : "Luca", reputation_score: 24 } },
          messages: [...demoMessages, ...demoExtraMessages],
          currentUserId: "me",
          disconnected: false
        };
      }
      return callFunction<ThreadResponse>("get-chat-messages", {
        method: "GET",
        query: { chatId }
      });
    }
  });

  const send = useMutation({
    mutationFn: async (values: { body: string }) => {
      setSendError(null);
      if (!hasChatId) throw new Error("Chat non ancora caricata.");
      if (demoMode) return { message: addDemoMessage(chatId ?? "demo-active-chat", values.body) };
      return callFunction("send-private-message", { body: { chatId, body: values.body } });
    },
    onSuccess: async () => {
      reset();
      await queryClient.invalidateQueries({ queryKey: ["chat-thread", chatId] });
    },
    onError: (error) => setSendError(getFriendlyError(error, "Messaggio non inviato. Controlla GPS, rete e vicinanza."))
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
    onError: (error) => setSendError(getFriendlyError(error, "Connessione non rimossa. Riprova."))
  });

  const status = thread.data?.chat.status ?? "frozen_permission";
  const isConnected = thread.data?.disconnected !== true && thread.data?.chat.is_connected !== false;
  const canSend = isConnected && status === "active";
  const otherName = thread.data?.chat.other_profile?.display_name ?? "Persona vicina";

  async function setDistanceStatus(nextStatus: ChatStatus) {
    if (!chatId) return;
    setDemoChatStatus(chatId, nextStatus);
    await queryClient.invalidateQueries({ queryKey: ["chat-thread", chatId] });
    await sendLocalNotification(
      nextStatus === "active" ? "Chat riattivata" : "Chat sospesa",
      nextStatus === "active" ? "Siete tornati entro il raggio condiviso." : "Siete fuori dal raggio: lo storico resta, nuovi messaggi bloccati."
    );
  }

  function confirmDisconnect() {
    Alert.alert(
      "Rimuovere la connessione?",
      `La chat con ${otherName} non comparira piu. Potrete riconnettervi con una nuova richiesta da un post.`,
      [
        { text: "Annulla", style: "cancel" },
        { text: "Rimuovi", style: "destructive", onPress: () => disconnect.mutate() }
      ]
    );
  }

  return (
    <Screen>
      <View className="gap-4">
        <View className="flex-row items-center gap-3 border-b border-border pb-4">
          <Pressable accessibilityRole="button" accessibilityLabel="Torna alle chat" onPress={() => router.back()} className="h-11 w-11 items-center justify-center rounded-card border border-border bg-white">
            <Ionicons name="arrow-back" size={21} color="#17232b" />
          </Pressable>
          <View className="h-11 w-11 items-center justify-center rounded-full bg-surface"><Ionicons name="person-outline" size={20} color="#16808a" /></View>
          <View className="flex-1">
            <Text className="text-lg font-bold text-ink">{otherName}</Text>
            <Text className="text-xs text-muted">{canSend ? "Connessi · potete scrivere" : "Connessi · messaggi sospesi dalla distanza"}</Text>
          </View>
          {isConnected ? (
            <Pressable accessibilityRole="button" accessibilityLabel={`Rimuovi connessione con ${otherName}`} disabled={disconnect.isPending} onPress={confirmDisconnect} className="h-11 w-11 items-center justify-center rounded-card border border-border bg-white disabled:opacity-50">
              <Ionicons name="person-remove-outline" size={20} color="#b42318" />
            </Pressable>
          ) : null}
        </View>
        {!hasChatId ? (
          <View className="rounded-card border border-danger p-4">
            <Text className="font-semibold text-danger">Chat non valida</Text>
            <Text className="mt-1 text-sm leading-5 text-muted">Torna all'elenco Chat e riapri la conversazione.</Text>
          </View>
        ) : null}
        {!isConnected ? (
          <View className="gap-3 rounded-card border border-border bg-surface p-4">
            <View className="flex-row items-start gap-3">
              <Ionicons name="person-remove-outline" size={21} color="#62717a" />
              <View className="flex-1">
                <Text className="font-semibold text-ink">Connessione rimossa</Text>
                <Text className="mt-1 text-sm leading-5 text-muted">Questa chat non e piu attiva. Potrete riconnettervi con una nuova richiesta da un post.</Text>
              </View>
            </View>
            <Button label="Torna alle connessioni" variant="secondary" onPress={() => router.replace("/(tabs)/chats")} />
          </View>
        ) : <ChatFrozenBanner status={status} />}
        {thread.isLoading ? <Text className="text-sm text-muted">Carico chat e messaggi...</Text> : null}
        {thread.isError ? (
          <View className="gap-3 rounded-card border border-danger bg-surface p-4">
            <View>
              <Text className="font-semibold text-danger">Chat non caricata</Text>
              <Text className="mt-1 text-sm leading-5 text-muted">{getFriendlyError(thread.error, "Controlla login, GPS e rete, poi riprova.")}</Text>
            </View>
            <Button label="Riprova" variant="secondary" onPress={() => void thread.refetch()} />
          </View>
        ) : null}
        {demoMode ? (
          <View className="flex-row gap-2">
            <Button label="Simula lontani" variant="secondary" onPress={() => void setDistanceStatus("frozen_distance")} />
            <Button label="Simula vicini" onPress={() => void setDistanceStatus("active")} />
          </View>
        ) : null}
        <View className="gap-3 py-2">
          {!thread.isLoading && !thread.isError && thread.data?.messages.length === 0 ? (
            <View className="items-center gap-2 py-10">
              <Ionicons name="chatbubbles-outline" size={28} color="#62717a" />
              <Text className="font-semibold text-ink">La conversazione inizia qui</Text>
              <Text className="text-center text-sm leading-5 text-muted">La connessione resta. Potete scrivere quando siete nel raggio condiviso.</Text>
            </View>
          ) : null}
          {thread.data?.messages.map((message) => (
            <View key={message.id} className={`rounded-card p-3 ${message.sender_id === thread.data?.currentUserId ? "ml-12 bg-primary" : "mr-12 bg-surface"}`}>
              <Text className={`text-base ${message.sender_id === thread.data?.currentUserId ? "text-white" : "text-ink"}`}>{message.body}</Text>
              <Text className={`mt-1 text-xs ${message.sender_id === thread.data?.currentUserId ? "text-white" : "text-muted"}`}>{new Date(message.created_at).toLocaleTimeString()}</Text>
            </View>
          ))}
        </View>
        {isConnected ? <View className="flex-row items-end gap-2 border-t border-border pt-4">
          <Controller control={control} name="body" render={({ field }) => (
            <TextInput editable={canSend} multiline placeholder={canSend ? "Messaggio" : "Torna vicino per scrivere"} className="min-h-12 flex-1 rounded-card border border-border bg-white px-3 py-3 text-ink" value={field.value} onChangeText={field.onChange} />
          )} />
          <Pressable accessibilityRole="button" accessibilityLabel="Invia messaggio" disabled={!canSend || !messageBody.trim() || send.isPending} onPress={handleSubmit((values) => send.mutate({ body: values.body.trim() }))} className="h-12 w-12 items-center justify-center rounded-card bg-primary disabled:opacity-50">
            <Ionicons name="send" size={19} color="#ffffff" />
          </Pressable>
        </View> : null}
        <View>
          {sendError ? <Text className="rounded-card bg-danger/10 p-3 text-sm font-semibold text-danger">{sendError}</Text> : null}
        </View>
      </View>
    </Screen>
  );
}
