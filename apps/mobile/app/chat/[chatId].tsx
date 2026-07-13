import type { ChatStatus } from "@paraggi/domain";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { Controller, useForm } from "react-hook-form";
import { Text, TextInput, View } from "react-native";
import { Button } from "@/components/Button";
import { ChatFrozenBanner } from "@/components/ChatFrozenBanner";
import { Screen } from "@/components/Screen";
import { demoMode } from "@/config/env";
import { demoChats, demoMessages } from "@/demo/data";
import { callFunction } from "@/services/api";
import { sendLocalNotification } from "@/services/notifications";
import { supabase } from "@/services/supabase";
import { useRealtimeChannel } from "@/hooks/useRealtimeChannel";
import { useAppStore } from "@/stores/appStore";

type Message = {
  id: string;
  sender_id: string;
  body: string;
  created_at: string;
};

const emptyDemoMessages: Message[] = [];

export default function ChatDetailScreen() {
  const { chatId } = useLocalSearchParams<{ chatId: string }>();
  const queryClient = useQueryClient();
  const demoStatus = useAppStore((state) => state.demoChatStatusById[chatId ?? ""]);
  const demoExtraMessages = useAppStore((state) => state.demoMessagesByChat[chatId ?? ""] ?? emptyDemoMessages);
  const addDemoMessage = useAppStore((state) => state.addDemoMessage);
  const setDemoChatStatus = useAppStore((state) => state.setDemoChatStatus);
  const { control, handleSubmit, reset } = useForm<{ body: string }>({ defaultValues: { body: "" } });
  useRealtimeChannel(chatId ? { type: "chat-messages", chatId } : null);
  useRealtimeChannel(chatId ? { type: "chat-status", chatId } : null);

  const chat = useQuery({
    queryKey: ["chat", chatId, demoStatus],
    queryFn: async () => {
      if (demoMode) {
        const base = demoChats.find((item) => item.id === chatId) ?? demoChats[0];
        return { ...base, status: demoStatus ?? base.status };
      }
      const data = await callFunction<{ chat: { id: string; status: ChatStatus; last_distance_meters: number | null }; messages: Message[] }>("get-chat-messages", {
        method: "GET",
        query: { chatId }
      });
      return data.chat;
    }
  });

  const messages = useQuery({
    queryKey: ["messages", chatId, demoExtraMessages.length],
    queryFn: async () => {
      if (demoMode) return [...demoMessages, ...demoExtraMessages];
      const data = await callFunction<{ chat: { id: string; status: ChatStatus; last_distance_meters: number | null }; messages: Message[] }>("get-chat-messages", {
        method: "GET",
        query: { chatId }
      });
      return data.messages;
    }
  });

  const send = useMutation({
    mutationFn: async (values: { body: string }) => {
      if (demoMode) return { message: addDemoMessage(chatId ?? "demo-active-chat", values.body) };
      return callFunction("send-private-message", { body: { chatId, body: values.body } });
    },
    onSuccess: async () => {
      reset();
      await sendLocalNotification("Messaggio inviato", "Demo chat: il messaggio e stato salvato nello storico locale.");
      await queryClient.invalidateQueries({ queryKey: ["messages", chatId] });
      await queryClient.invalidateQueries({ queryKey: ["chat", chatId] });
    }
  });

  const status = chat.data?.status ?? "frozen_permission";
  const canSend = status === "active";

  async function setDistanceStatus(nextStatus: ChatStatus) {
    if (!chatId) return;
    setDemoChatStatus(chatId, nextStatus);
    await queryClient.invalidateQueries({ queryKey: ["chat", chatId] });
    await sendLocalNotification(
      nextStatus === "active" ? "Chat riattivata" : "Chat sospesa",
      nextStatus === "active" ? "Siete tornati entro il raggio condiviso." : "Siete fuori dal raggio: lo storico resta, nuovi messaggi bloccati."
    );
  }

  return (
    <Screen>
      <View className="mt-4 gap-4">
        <View>
          <Text className="text-2xl font-bold text-ink">Chat privata</Text>
          <Text className="mt-1 text-sm leading-5 text-muted">La conversazione vive solo mentre la prossimita e valida.</Text>
        </View>
        <ChatFrozenBanner status={status} />
        {demoMode ? (
          <View className="flex-row gap-2">
            <Button label="Simula lontani" variant="secondary" onPress={() => void setDistanceStatus("frozen_distance")} />
            <Button label="Simula vicini" onPress={() => void setDistanceStatus("active")} />
          </View>
        ) : null}
        <View className="gap-3">
          {messages.data?.map((message) => (
            <View key={message.id} className={`rounded-card p-3 ${message.sender_id === "me" ? "ml-8 bg-primary" : "mr-8 border border-border bg-surface"}`}>
              <Text className={`text-base ${message.sender_id === "me" ? "text-white" : "text-ink"}`}>{message.body}</Text>
              <Text className={`mt-1 text-xs ${message.sender_id === "me" ? "text-white" : "text-muted"}`}>{new Date(message.created_at).toLocaleTimeString()}</Text>
            </View>
          ))}
        </View>
        <View className="gap-2">
          <Controller control={control} name="body" render={({ field }) => (
            <TextInput
              editable={canSend}
              placeholder={canSend ? "Messaggio" : "Torna vicino per scrivere"}
              className="min-h-12 rounded-card border border-border px-3 text-ink"
              value={field.value}
              onChangeText={field.onChange}
            />
          )} />
          <Button label="Invia" disabled={!canSend || send.isPending} onPress={handleSubmit((values) => send.mutate(values))} />
        </View>
      </View>
    </Screen>
  );
}
