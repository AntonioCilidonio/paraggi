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
import { getFriendlyError } from "@/services/errors";
import { sendLocalNotification } from "@/services/notifications";
import { useRealtimeChannel } from "@/hooks/useRealtimeChannel";
import { useAppStore } from "@/stores/appStore";
import { type FeedPost } from "@/components/FeedPostCard";

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
  const radiusMeters = useAppStore((state) => state.radiusMeters);
  const localComments = useAppStore((state) => state.demoCommentsByPost[postId ?? ""] ?? []);
  const addDemoComment = useAppStore((state) => state.addDemoComment);
  const acceptDemoRequest = useAppStore((state) => state.acceptDemoRequest);
  const { control, handleSubmit, reset } = useForm<{ body: string }>({ defaultValues: { body: "" } });
  useRealtimeChannel(postId ? { type: "post-comments", postId } : null);
  const detail = useQuery({
    queryKey: ["post-detail", postId, radiusMeters, localComments.length],
    queryFn: async () => {
      if (demoMode) {
        const post = [...localDemoPosts, ...demoPosts].find((item) => item.id === postId) ?? null;
        return { post, comments: [...demoComments, ...localComments] };
      }
      return callFunction<{ post: FeedPost; comments: CommentRow[] }>("get-post-detail", { method: "GET", query: { postId, radiusMeters } });
    }
  });
  const selectedPost = detail.data?.post;
  const comments = detail.data?.comments ?? [];

  const createComment = useMutation({
    mutationFn: async (values: { body: string }) => {
      if (demoMode) return { comment: addDemoComment(postId, values.body) };
      return callFunction("create-comment", { body: { postId, body: values.body } });
    },
    onSuccess: async () => {
      reset();
      await sendLocalNotification("Nuovo commento", "Il tuo commento locale e stato aggiunto al post.");
      await queryClient.invalidateQueries({ queryKey: ["post-detail", postId] });
    }
  });

  async function requestPrivateConnection() {
    if (demoMode) {
      acceptDemoRequest("demo-request-1");
      await sendLocalNotification("Richiesta privata accettata", "Demo: la chat privata e pronta finche restate vicini.");
      return;
    }

    if (!selectedPost?.author_id) {
      await sendLocalNotification("Richiesta non inviata", "Autore del post non disponibile.");
      return;
    }

    await callFunction("request-connection", {
      body: {
        postId,
        recipientId: selectedPost.author_id,
        message: "Vorrei aprire una chat privata contestuale."
      }
    });
    await sendLocalNotification("Richiesta inviata", "La persona vicina potra accettare o rifiutare.");
  }

  return (
    <Screen>
      <View className="mt-4 gap-4">
        <View>
          <Text className="text-2xl font-bold text-ink">Conversazione locale</Text>
          <Text className="mt-1 text-sm leading-5 text-muted">Prima commento pubblico, poi richiesta privata. Nessuna connessione permanente.</Text>
        </View>
        {detail.isError ? (
          <View className="rounded-card border border-danger bg-surface p-4">
            <Text className="font-semibold text-danger">Post non caricato</Text>
            <Text className="mt-1 text-sm leading-5 text-muted">{getFriendlyError(detail.error, "Aggiorna il GPS dal feed e riprova.")}</Text>
          </View>
        ) : null}
        {selectedPost ? <FeedPostCard post={selectedPost} /> : null}
        <View className="flex-row gap-2">
          <Button label="Richiedi privato" variant="secondary" className="flex-1" onPress={() => void requestPrivateConnection()} />
          <Button label="Apri chat demo" className="flex-1" onPress={() => router.push("/chat/demo-active-chat")} />
        </View>
        {comments.map((comment) => (
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
