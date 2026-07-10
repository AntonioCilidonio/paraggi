import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { demoMode } from "@/config/env";
import { supabase } from "@/services/supabase";

type RealtimeTarget =
  | { type: "post-comments"; postId: string }
  | { type: "chat-messages"; chatId: string }
  | { type: "chat-status"; chatId: string }
  | { type: "notifications"; userId: string };

export function useRealtimeChannel(target: RealtimeTarget | null) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!target || demoMode) return;

    const channelName = target.type === "post-comments"
      ? `post:${target.postId}:comments`
      : target.type === "chat-messages"
        ? `chat:${target.chatId}:messages`
        : target.type === "chat-status"
          ? `chat:${target.chatId}:status`
          : `user:${target.userId}:notifications`;

    const channel = supabase.channel(channelName);

    if (target.type === "post-comments") {
      channel.on("postgres_changes", { event: "*", schema: "public", table: "comments", filter: `post_id=eq.${target.postId}` }, () => {
        void queryClient.invalidateQueries({ queryKey: ["comments", target.postId] });
      });
    }

    if (target.type === "chat-messages") {
      channel.on("postgres_changes", { event: "*", schema: "public", table: "private_messages", filter: `chat_id=eq.${target.chatId}` }, () => {
        void queryClient.invalidateQueries({ queryKey: ["messages", target.chatId] });
      });
    }

    if (target.type === "chat-status") {
      channel.on("postgres_changes", { event: "UPDATE", schema: "public", table: "private_chats", filter: `id=eq.${target.chatId}` }, () => {
        void queryClient.invalidateQueries({ queryKey: ["chat", target.chatId] });
      });
    }

    if (target.type === "notifications") {
      channel.on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${target.userId}` }, () => {
        void queryClient.invalidateQueries({ queryKey: ["notifications", target.userId] });
      });
    }

    void channel.subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient, target]);
}
