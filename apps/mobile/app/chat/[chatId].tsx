import type { ChatStatus } from "@paraggi/domain";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Pressable, Text, TextInput, View } from "react-native";
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

  const thread = useQuery({
    queryKey: ["chat-thread", chatId, demoStatus, demoExtraMessages.length],
    enabled: hasChatId,
    refetchInterval: demoMode ? false : 15000,
    queryFn: async () => {
      if (!hasChatId) throw new Error("Chat non ancora caricata.");
      if (demoMode) {
        const base = demoChats.find((item) => item.id === chatId) ?? demoChats[0];
        return {
          chat: { ...base, status: demoStatus ?? base.status },
          messages: [...demoMessages, ...demoExtraMessages],
          currentUserId: "me"
        };
      }
      return callFunction<{ chat: { id: string; user_a_id: string; user_b_id: string; status: ChatStatus; last_distance_meters: number | null }; messages: Message[]; currentUserId: string }>("get-chat-messages", {
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

  const status = thread.data?.chat.status ?? "frozen_permission";
  const canSend = status === "active";

  async function setDistanceStatus(nextStatus: ChatStatus) {
    if (!chatId) return;
    setDemoChatStatus(chatId, nextStatus);
    await queryClient.invalidateQueries({ queryKey: ["chat-thread", chatId] });
    await sendLocalNotification(
      nextStatus === "active" ? "Chat riattivata" : "Chat sospesa",
      nextStatus === "active" ? "Siete tornati entro il raggio condiviso." : "Siete fuori dal raggio: lo storico resta, nuovi messaggi bloccati."
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
            <Text className="text-lg font-bold text-ink">Conversazione vicina</Text>
            <Text className="text-xs text-muted">{canSend ? "Attiva · siete nel raggio" : "Sospesa · storico disponibile"}</Text>
          </View>
        </View>
        {!hasChatId ? (
          <View className="rounded-card border border-danger p-4">
            <Text className="font-semibold text-danger">Chat non valida</Text>
            <Text className="mt-1 text-sm leading-5 text-muted">Torna all'elenco Chat e riapri la conversazione.</Text>
          </View>
        ) : null}
        <ChatFrozenBanner status={status} />
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
          {thread.data?.messages.map((message) => (
            <View key={message.id} className={`rounded-card p-3 ${message.sender_id === thread.data?.currentUserId ? "ml-12 bg-primary" : "mr-12 bg-surface"}`}>
              <Text className={`text-base ${message.sender_id === thread.data?.currentUserId ? "text-white" : "text-ink"}`}>{message.body}</Text>
              <Text className={`mt-1 text-xs ${message.sender_id === thread.data?.currentUserId ? "text-white" : "text-muted"}`}>{new Date(message.created_at).toLocaleTimeString()}</Text>
            </View>
          ))}
        </View>
        <View className="flex-row items-end gap-2 border-t border-border pt-4">
          <Controller control={control} name="body" render={({ field }) => (
            <TextInput editable={canSend} multiline placeholder={canSend ? "Messaggio" : "Torna vicino per scrivere"} className="min-h-12 flex-1 rounded-card border border-border bg-white px-3 py-3 text-ink" value={field.value} onChangeText={field.onChange} />
          )} />
          <Pressable accessibilityRole="button" accessibilityLabel="Invia messaggio" disabled={!canSend || !messageBody.trim() || send.isPending} onPress={handleSubmit((values) => send.mutate({ body: values.body.trim() }))} className="h-12 w-12 items-center justify-center rounded-card bg-primary disabled:opacity-50">
            <Ionicons name="send" size={19} color="#ffffff" />
          </Pressable>
        </View>
        <View>
          {sendError ? <Text className="rounded-card bg-danger/10 p-3 text-sm font-semibold text-danger">{sendError}</Text> : null}
        </View>
      </View>
    </Screen>
  );
}
