import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { Controller, useForm } from "react-hook-form";
import { Text, TextInput, View } from "react-native";
import { Button } from "@/components/Button";
import { FeedPostCard } from "@/components/FeedPostCard";
import { Screen } from "@/components/Screen";
import { demoMode } from "@/config/env";
import { demoComments, demoPosts } from "@/demo/data";
import { callFunction } from "@/services/api";
import { sendLocalNotification } from "@/services/notifications";
import { supabase } from "@/services/supabase";
import { useRealtimeChannel } from "@/hooks/useRealtimeChannel";
import { useAppStore } from "@/stores/appStore";

type CommentRow = {
  id: string;
  author_id: string;
  display_name?: string;
  body: string;
  created_at: string;
};

export default function PostDetailScreen() {
  const { postId } = useLocalSearchParams<{ postId: string }>();
  const queryClient = useQueryClient();
  const localDemoPosts = useAppStore((state) => state.demoPosts);
  const localComments = useAppStore((state) => state.demoCommentsByPost[postId ?? ""] ?? []);
  const addDemoComment = useAppStore((state) => state.addDemoComment);
  const acceptDemoRequest = useAppStore((state) => state.acceptDemoRequest);
  const { control, handleSubmit, reset } = useForm<{ body: string }>({ defaultValues: { body: "" } });
  useRealtimeChannel(postId ? { type: "post-comments", postId } : null);
  const selectedPost = [...localDemoPosts, ...demoPosts].find((post) => post.id === postId);
  const comments = useQuery({
    queryKey: ["comments", postId, localComments.length],
    queryFn: async () => {
      if (demoMode) {
        return [...demoComments, ...localComments];
      }
      const { data, error } = await supabase.from("comments").select("id,author_id,body,created_at").eq("post_id", postId).order("created_at", { ascending: true });
      if (error) throw error;
      return data as CommentRow[];
    }
  });

  const createComment = useMutation({
    mutationFn: async (values: { body: string }) => {
      if (demoMode) return { comment: addDemoComment(postId, values.body) };
      return callFunction("create-comment", { body: { postId, body: values.body } });
    },
    onSuccess: async () => {
      reset();
      await sendLocalNotification("Nuovo commento", "Il tuo commento locale e stato aggiunto al post.");
      await queryClient.invalidateQueries({ queryKey: ["comments", postId] });
    }
  });

  async function requestPrivateConnection() {
    if (demoMode) {
      acceptDemoRequest("demo-request-1");
      await sendLocalNotification("Richiesta privata accettata", "Demo: la chat privata e pronta finche restate vicini.");
      return;
    }
    await callFunction("request-connection", { body: { postId } });
  }

  return (
    <Screen>
      <View className="mt-4 gap-4">
        <View>
          <Text className="text-2xl font-bold text-ink">Conversazione locale</Text>
          <Text className="mt-1 text-sm leading-5 text-muted">Prima commento pubblico, poi richiesta privata. Nessuna connessione permanente.</Text>
        </View>
        {selectedPost ? <FeedPostCard post={selectedPost} /> : null}
        <View className="flex-row gap-2">
          <Button label="Richiedi privato" variant="secondary" className="flex-1" onPress={() => void requestPrivateConnection()} />
          <Button label="Apri chat demo" className="flex-1" onPress={() => router.push("/chat/demo-active-chat")} />
        </View>
        {comments.data?.map((comment) => (
          <View key={comment.id} className="rounded-card border border-border bg-surface p-3">
            <Text className="mb-1 text-xs font-semibold text-muted">{comment.display_name ?? "Utente vicino"}</Text>
            <Text className="text-ink">{comment.body}</Text>
            <Text className="mt-1 text-xs text-muted">{new Date(comment.created_at).toLocaleString()}</Text>
          </View>
        ))}
        <Controller control={control} name="body" render={({ field }) => (
          <TextInput placeholder="Commenta pubblicamente" className="min-h-12 rounded-card border border-border px-3 text-ink" value={field.value} onChangeText={field.onChange} />
        )} />
        <Button label="Commenta" disabled={createComment.isPending} onPress={handleSubmit((values) => createComment.mutate(values))} />
      </View>
    </Screen>
  );
}
