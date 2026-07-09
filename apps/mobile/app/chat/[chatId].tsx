import type { ChatStatus } from "@paraggi/domain";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { Controller, useForm } from "react-hook-form";
import { Text, TextInput, View } from "react-native";
import { Button } from "@/components/Button";
import { ChatFrozenBanner } from "@/components/ChatFrozenBanner";
import { Screen } from "@/components/Screen";
import { callFunction } from "@/services/api";
import { supabase } from "@/services/supabase";
import { useRealtimeChannel } from "@/hooks/useRealtimeChannel";

type Message = {
  id: string;
  sender_id: string;
  body: string;
  created_at: string;
};

export default function ChatDetailScreen() {
  const { chatId } = useLocalSearchParams<{ chatId: string }>();
  const queryClient = useQueryClient();
  const { control, handleSubmit, reset } = useForm<{ body: string }>({ defaultValues: { body: "" } });
  useRealtimeChannel(chatId ? { type: "chat-messages", chatId } : null);
  useRealtimeChannel(chatId ? { type: "chat-status", chatId } : null);

  const chat = useQuery({
    queryKey: ["chat", chatId],
    queryFn: async () => {
      const { data, error } = await supabase.from("private_chats").select("*").eq("id", chatId).single();
      if (error) throw error;
      return data as { id: string; status: ChatStatus; last_distance_meters: number | null };
    }
  });

  const messages = useQuery({
    queryKey: ["messages", chatId],
    queryFn: async () => {
      const { data, error } = await supabase.from("private_messages").select("id,sender_id,body,created_at").eq("chat_id", chatId).order("created_at", { ascending: true });
      if (error) throw error;
      return data as Message[];
    }
  });

  const send = useMutation({
    mutationFn: async (values: { body: string }) => callFunction("send-private-message", { body: { chatId, body: values.body } }),
    onSuccess: async () => {
      reset();
      await queryClient.invalidateQueries({ queryKey: ["messages", chatId] });
      await queryClient.invalidateQueries({ queryKey: ["chat", chatId] });
    }
  });

  const status = chat.data?.status ?? "frozen_permission";
  const canSend = status === "active";

  return (
    <Screen>
      <View className="mt-4 gap-4">
        <ChatFrozenBanner status={status} />
        <View className="gap-3">
          {messages.data?.map((message) => (
            <View key={message.id} className="rounded-card bg-surface p-3">
              <Text className="text-base text-ink">{message.body}</Text>
              <Text className="mt-1 text-xs text-muted">{new Date(message.created_at).toLocaleTimeString()}</Text>
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
