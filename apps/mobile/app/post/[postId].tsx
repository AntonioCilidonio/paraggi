import type { ErrorBoundaryProps } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Pressable, Text, TextInput, View } from "react-native";
import { Button } from "@/components/Button";
import { FeedPostCard } from "@/components/FeedPostCard";
import { Screen } from "@/components/Screen";
import { demoMode } from "@/config/env";
import { demoComments, demoPosts } from "@/demo/data";
import { callFunction } from "@/services/api";
import { captureClientError } from "@/services/clientLogger";
import { getFriendlyError } from "@/services/errors";
import { sendLocalNotification } from "@/services/notifications";
import { supabase } from "@/services/supabase";
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

const emptyDemoComments: CommentRow[] = [];

export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const loggedMessageRef = useRef<string | null>(null);

  useEffect(() => {
    if (loggedMessageRef.current === error.message) return;
    loggedMessageRef.current = error.message;
    captureClientError("post_detail_screen_error", error, {}, "fatal");
  }, [error.message]);

  return (
    <Screen>
      <View className="mt-4 gap-4">
        <View>
          <Text className="text-2xl font-bold text-ink">Post non disponibile</Text>
          <Text className="mt-1 text-sm leading-5 text-muted">La conversazione non si e aperta correttamente. Puoi riprovare senza chiudere l'app.</Text>
        </View>
        <View className="rounded-card border border-danger bg-surface p-4">
          <Text className="font-semibold text-danger">Errore schermata</Text>
          <Text className="mt-1 text-sm leading-5 text-muted">{error.message}</Text>
        </View>
        <Button label="Riprova" onPress={retry} />
      </View>
    </Screen>
  );
}

export default function PostDetailScreen() {
  const params = useLocalSearchParams<{ postId?: string | string[] }>();
  const postId = Array.isArray(params.postId) ? params.postId[0] : params.postId;
  const hasPostId = typeof postId === "string" && postId.length > 0;
  const queryClient = useQueryClient();
  const localDemoPosts = useAppStore((state) => state.demoPosts);
  const radiusMeters = useAppStore((state) => state.radiusMeters);
  const localComments = useAppStore((state) => state.demoCommentsByPost[postId ?? ""] ?? emptyDemoComments);
  const addDemoComment = useAppStore((state) => state.addDemoComment);
  const acceptDemoRequest = useAppStore((state) => state.acceptDemoRequest);
  const [commentError, setCommentError] = useState<string | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [testStatus, setTestStatus] = useState<string | null>(null);
  const { control, handleSubmit, reset } = useForm<{ body: string }>({ defaultValues: { body: "" } });
  useRealtimeChannel(postId ? { type: "post-comments", postId } : null);
  const detail = useQuery({
    queryKey: ["post-detail", postId, radiusMeters],
    enabled: hasPostId,
    queryFn: async () => {
      if (!hasPostId) throw new Error("Post non ancora caricato.");
      if (demoMode) {
        const post = [...localDemoPosts, ...demoPosts].find((item) => item.id === postId) ?? null;
        return { post, comments: [...demoComments, ...localComments] };
      }
      return callFunction<{ post: FeedPost; comments: CommentRow[] }>("get-post-detail", { method: "GET", query: { postId, radiusMeters } });
    }
  });
  const currentUser = useQuery({
    queryKey: ["current-user"],
    enabled: !demoMode,
    queryFn: async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error) throw error;
      return data.user;
    }
  });
  const selectedPost = detail.data?.post;
  const comments = detail.data?.comments ?? [];
  const isOwnPost = demoMode || Boolean(selectedPost?.author_id && selectedPost.author_id === currentUser.data?.id);

  const createComment = useMutation({
    mutationFn: async (values: { body: string }) => {
      setCommentError(null);
      if (!postId) throw new Error("Post non ancora caricato.");
      if (demoMode) return { comment: addDemoComment(postId, values.body) };
      if (!selectedPost) throw new Error("Post non ancora caricato.");
      return callFunction("create-comment", { body: { postId, body: values.body } });
    },
    onSuccess: async () => {
      reset();
      await sendLocalNotification("Nuovo commento", "Il tuo commento locale e stato aggiunto al post.");
      await queryClient.invalidateQueries({ queryKey: ["post-detail", postId] });
      await queryClient.invalidateQueries({ queryKey: ["nearby-feed"] });
    },
    onError: (error) => {
      setCommentError(getFriendlyError(error, "Commento non inviato. Aggiorna GPS e riprova."));
    }
  });

  async function requestPrivateConnection() {
    setConnectionError(null);
    if (demoMode) {
      acceptDemoRequest("demo-request-1");
      await sendLocalNotification("Richiesta privata accettata", "Demo: la chat privata e pronta finche restate vicini.");
      return;
    }

    if (!selectedPost?.author_id) {
      await sendLocalNotification("Richiesta non inviata", "Autore del post non disponibile.");
      return;
    }

    try {
      await callFunction("request-connection", {
        body: {
          postId,
          recipientId: selectedPost.author_id,
          message: "Vorrei aprire una chat privata contestuale."
        }
      });
      await sendLocalNotification("Richiesta inviata", "La persona vicina potra accettare o rifiutare.");
    } catch (error) {
      setConnectionError(getFriendlyError(error, "Richiesta privata non inviata. Riprova."));
    }
  }

  const canComment = Boolean(postId && selectedPost && !detail.isLoading && !detail.isError);

  async function createTestInteraction() {
    if (!postId || !selectedPost) return;
    setTestStatus("Creo una persona test vicina...");
    try {
      await callFunction("create-test-interaction", { body: { postId } });
      await sendLocalNotification("Richiesta privata test", "Marta Test ha commentato e ti ha inviato una richiesta privata.");
      await queryClient.invalidateQueries({ queryKey: ["post-detail", postId] });
      setTestStatus("Richiesta test creata. Vai nella tab Chat e accettala.");
    } catch (error) {
      setTestStatus(getFriendlyError(error, "Non sono riuscito a creare l'interazione test."));
    }
  }

  return (
    <Screen>
      <View className="gap-5">
        <View className="flex-row items-start justify-between gap-3 border-b border-border pb-4">
          <View className="flex-1">
            <Pressable accessibilityRole="button" accessibilityLabel="Torna al feed" onPress={() => router.back()} className="mb-3 h-11 w-11 items-center justify-center rounded-card border border-border bg-white">
              <Ionicons name="arrow-back" size={21} color="#17232b" />
            </Pressable>
            <Text className="text-2xl font-bold text-ink">Conversazione</Text>
            <Text className="mt-1 text-sm leading-5 text-muted">Commento pubblico, poi chat privata di vicinanza.</Text>
          </View>
        </View>
        {detail.isError ? (
          <View className="rounded-card border border-danger bg-surface p-4">
            <Text className="font-semibold text-danger">Post non caricato</Text>
            <Text className="mt-1 text-sm leading-5 text-muted">{getFriendlyError(detail.error, "Aggiorna il GPS dal feed e riprova.")}</Text>
          </View>
        ) : null}
        {detail.isLoading ? <Text className="text-muted">Carico post e commenti...</Text> : null}
        {selectedPost ? <FeedPostCard post={selectedPost} /> : null}
        {!isOwnPost ? <Button label="Richiedi chat privata" icon="chatbubble-outline" variant="secondary" disabled={!selectedPost} onPress={() => void requestPrivateConnection()} /> : null}
        {demoMode ? <Button label="Apri chat demo" icon="chatbubbles-outline" onPress={() => router.push("/chat/demo-active-chat")} /> : null}
        {!demoMode && isOwnPost ? (
          <View className="gap-2 rounded-card border border-border bg-surface p-4">
            <Text className="font-semibold text-ink">Test interazione</Text>
            <Text className="text-sm leading-5 text-muted">Crea una persona vicina che commenta il post e ti manda una richiesta privata.</Text>
            <Button label="Crea richiesta test" variant="secondary" disabled={!selectedPost} onPress={() => void createTestInteraction()} />
            {testStatus ? <Text className="text-sm leading-5 text-muted">{testStatus}</Text> : null}
          </View>
        ) : null}
        {connectionError ? <Text className="rounded-card bg-danger/10 p-3 text-sm font-semibold text-danger">{connectionError}</Text> : null}
        {comments.map((comment) => (
          <View key={comment.id} className="flex-row items-start gap-3">
            <View className="h-9 w-9 items-center justify-center rounded-full bg-surface"><Text className="font-bold text-primary">{(comment.display_name ?? "U").slice(0, 1).toUpperCase()}</Text></View>
            <View className="flex-1 rounded-card bg-surface p-3">
              <Text className="mb-1 text-xs font-semibold text-muted">{comment.display_name ?? "Utente vicino"} · {new Date(comment.created_at).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}</Text>
              <Text className="text-ink">{comment.body}</Text>
            </View>
          </View>
        ))}
        <View className="flex-row items-end gap-2 border-t border-border pt-4">
          <Controller control={control} name="body" render={({ field }) => (
            <TextInput editable={canComment} multiline placeholder={canComment ? "Commenta pubblicamente" : "Carica il post prima di commentare"} className="min-h-12 flex-1 rounded-card border border-border bg-white px-3 py-3 text-ink" value={field.value} onChangeText={field.onChange} />
          )} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Invia commento"
            accessibilityState={{ disabled: !canComment || createComment.isPending }}
            disabled={!canComment || createComment.isPending}
            onPress={handleSubmit((values) => createComment.mutate(values))}
            className="h-12 w-12 items-center justify-center rounded-card bg-primary disabled:opacity-50"
          >
            <Ionicons name="send" size={19} color="#ffffff" />
          </Pressable>
        </View>
        {commentError ? <Text className="rounded-card bg-danger/10 p-3 text-sm font-semibold text-danger">{commentError}</Text> : null}
      </View>
    </Screen>
  );
}
