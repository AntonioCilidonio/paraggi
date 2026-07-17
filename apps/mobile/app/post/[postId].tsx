import type { ErrorBoundaryProps } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Alert, Pressable, Text, TextInput, View } from "react-native";
import { Button } from "@/components/Button";
import { AppHeader } from "@/components/AppHeader";
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
import { stabilizePostAttachments } from "@/services/postAttachmentCache";
import { type FeedPost } from "@/components/FeedPostCard";
import { POST_BODY_MAX_LENGTH } from "@/constants/posts";

type CommentRow = {
  id: string;
  author_id: string;
  display_name?: string;
  body: string;
  created_at: string;
  rating?: -1 | 1 | null;
};

type PostDetailData = {
  post: FeedPost | null;
  comments: CommentRow[];
  canComment: boolean;
  connection?: {
    state: "none" | "connected" | "pending_outgoing" | "pending_incoming" | "disconnected";
    chatId: string | null;
    requestId: string | null;
  };
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
          <Text className="text-2xl font-bold text-ink">
            Post non disponibile
          </Text>
          <Text className="mt-1 text-sm leading-5 text-muted">
            La conversazione non si e aperta correttamente. Puoi riprovare senza
            chiudere l'app.
          </Text>
        </View>
        <View className="rounded-card border border-danger bg-surface p-4">
          <Text className="font-semibold text-danger">Errore schermata</Text>
          <Text className="mt-1 text-sm leading-5 text-muted">
            {error.message}
          </Text>
        </View>
        <Button label="Riprova" onPress={retry} />
      </View>
    </Screen>
  );
}

export default function PostDetailScreen() {
  const params = useLocalSearchParams<{ postId?: string | string[] }>();
  const postId = Array.isArray(params.postId)
    ? params.postId[0]
    : params.postId;
  const hasPostId = typeof postId === "string" && postId.length > 0;
  const queryClient = useQueryClient();
  const localDemoPosts = useAppStore((state) => state.demoPosts);
  const radiusMeters = useAppStore((state) => state.radiusMeters);
  const localComments = useAppStore(
    (state) => state.demoCommentsByPost[postId ?? ""] ?? emptyDemoComments,
  );
  const addDemoComment = useAppStore((state) => state.addDemoComment);
  const acceptDemoRequest = useAppStore((state) => state.acceptDemoRequest);
  const [commentError, setCommentError] = useState<string | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [editingPost, setEditingPost] = useState(false);
  const [editBody, setEditBody] = useState("");
  const { control, handleSubmit, reset } = useForm<{ body: string }>({
    defaultValues: { body: "" },
  });
  useRealtimeChannel(postId ? { type: "post-comments", postId } : null);
  const detailQueryKey = ["post-detail", postId, radiusMeters] as const;
  const detail = useQuery({
    queryKey: detailQueryKey,
    enabled: hasPostId,
    queryFn: async () => {
      if (!hasPostId) throw new Error("Post non ancora caricato.");
      if (demoMode) {
        const post =
          [...localDemoPosts, ...demoPosts].find(
            (item) => item.id === postId,
          ) ?? null;
        return {
          post,
          canComment: Boolean(
            post && new Date(post.expires_at).getTime() > Date.now(),
          ),
          comments: [
            ...demoComments.map((comment) => ({ ...comment, rating: null as -1 | 1 | null })),
            ...localComments,
          ],
          connection: { state: "none" as const, chatId: null, requestId: null },
        };
      }
      const result = await callFunction<PostDetailData>(
        "get-post-detail",
        { method: "GET", query: { postId, radiusMeters } },
      );
      return result.post ? { ...result, post: stabilizePostAttachments(result.post) } : result;
    },
  });
  const currentUser = useQuery({
    queryKey: ["current-user"],
    enabled: !demoMode,
    queryFn: async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error) throw error;
      return data.user;
    },
  });
  const selectedPost = detail.data?.post;
  const comments = detail.data?.comments ?? [];
  const connection = detail.data?.connection;
  const activeChatId = connection?.state === "connected" ? connection.chatId : null;
  const isOwnPost =
    demoMode ||
    Boolean(
      selectedPost?.author_id &&
      selectedPost.author_id === currentUser.data?.id,
    );

  const createComment = useMutation({
    mutationFn: async (values: { body: string }) => {
      setCommentError(null);
      if (!postId) throw new Error("Post non ancora caricato.");
      if (demoMode) return { comment: addDemoComment(postId, values.body) };
      if (!selectedPost) throw new Error("Post non ancora caricato.");
      return callFunction("create-comment", {
        body: { postId, body: values.body },
      });
    },
    onSuccess: async () => {
      reset();
      await queryClient.invalidateQueries({
        queryKey: ["post-detail", postId],
      });
      await queryClient.invalidateQueries({ queryKey: ["nearby-feed"] });
    },
    onError: (error) => {
      setCommentError(
        getFriendlyError(
          error,
          "Commento non inviato. Aggiorna GPS e riprova.",
        ),
      );
    },
  });

  const rateComment = useMutation({
    mutationFn: async ({ commentId, rating }: { commentId: string; rating: -1 | 1 }) => {
      setCommentError(null);
      if (demoMode) return { rating, reputation: 100, reputationDelta: rating };
      return callFunction<{ rating: -1 | 1; reputationScore: number; reputationDelta: number }>("rate-comment", {
        body: { commentId, rating },
      });
    },
    onMutate: async ({ commentId, rating }) => {
      await queryClient.cancelQueries({ queryKey: detailQueryKey });
      const previous = queryClient.getQueryData<PostDetailData>(detailQueryKey);
      queryClient.setQueryData<PostDetailData>(detailQueryKey, (current) =>
        current
          ? {
              ...current,
              comments: current.comments.map((comment) =>
                comment.id === commentId ? { ...comment, rating } : comment,
              ),
            }
          : current,
      );
      return { previous };
    },
    onSuccess: async (result, variables) => {
      queryClient.setQueryData<PostDetailData>(detailQueryKey, (current) =>
        current
          ? {
              ...current,
              comments: current.comments.map((comment) =>
                comment.id === variables.commentId
                  ? { ...comment, rating: result.rating }
                  : comment,
              ),
            }
          : current,
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["post-detail", postId] }),
        queryClient.invalidateQueries({ queryKey: ["profile-summary"] }),
        queryClient.invalidateQueries({ queryKey: ["nearby-feed"] }),
      ]);
    },
    onError: (error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(detailQueryKey, context.previous);
      }
      setCommentError(getFriendlyError(error, "Valutazione non salvata. Riprova."));
    },
  });

  const updatePost = useMutation({
    mutationFn: async () => {
      const body = editBody.trim();
      if (!postId || !selectedPost || body.length < 1 || body.length > POST_BODY_MAX_LENGTH) {
        throw { error: "invalid_post_content" };
      }
      return callFunction("update-post", {
        body: { postId, body, category: selectedPost.category },
      });
    },
    onSuccess: async () => {
      setEditingPost(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["post-detail", postId] }),
        queryClient.invalidateQueries({ queryKey: ["nearby-feed"] }),
        queryClient.invalidateQueries({ queryKey: ["area-history"] }),
      ]);
    },
    onError: (error) => setCommentError(getFriendlyError(error, "Modifica non salvata. Riprova.")),
  });

  const deletePost = useMutation({
    mutationFn: async () => {
      if (!postId) throw new Error("Post non ancora caricato.");
      return callFunction("delete-post", { body: { postId } });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["nearby-feed"] }),
        queryClient.invalidateQueries({ queryKey: ["area-history"] }),
        queryClient.invalidateQueries({ queryKey: ["notifications"] }),
      ]);
      router.replace("/(tabs)/feed");
    },
    onError: (error) => setCommentError(getFriendlyError(error, "Post non eliminato. Riprova.")),
  });

  function beginEditingPost() {
    if (!selectedPost) return;
    setCommentError(null);
    setEditBody(selectedPost.body);
    setEditingPost(true);
  }

  function confirmDeletePost() {
    Alert.alert(
      "Elimina post",
      "Il post non sara piu visibile. Le chat gia attive resteranno disponibili.",
      [
        { text: "Annulla", style: "cancel" },
        { text: "Elimina", style: "destructive", onPress: () => deletePost.mutate() },
      ],
    );
  }

  async function requestPrivateConnection() {
    setConnectionError(null);
    if (demoMode) {
      acceptDemoRequest("demo-request-1");
      await sendLocalNotification(
        "Richiesta privata accettata",
        "Demo: la chat privata e pronta finche restate vicini.",
      );
      return;
    }

    if (!selectedPost?.author_id) {
      await sendLocalNotification(
        "Richiesta non inviata",
        "Autore del post non disponibile.",
      );
      return;
    }

    try {
      const result = await callFunction<{
        chat?: { id: string };
        alreadyConnected?: boolean;
        alreadyPending?: boolean;
      }>("request-connection", {
        body: {
          postId,
          recipientId: selectedPost.author_id,
          message: "Vorrei aprire una chat privata contestuale.",
        },
      });
      if (result.alreadyConnected && result.chat?.id) {
        router.push(`/chat/${result.chat.id}`);
        return;
      }
      await detail.refetch();
      await queryClient.invalidateQueries({ queryKey: ["chats"] });
    } catch (error) {
      setConnectionError(
        getFriendlyError(error, "Richiesta privata non inviata. Riprova."),
      );
    }
  }

  const canComment = Boolean(
    postId &&
    selectedPost &&
    detail.data?.canComment &&
    !detail.isLoading &&
    !detail.isError,
  );

  return (
    <Screen showBottomBar keyboardAware>
      <View className="gap-5">
        <AppHeader />
        <View className="flex-row items-center gap-3 pb-1">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Torna al feed"
            onPress={() => router.back()}
            className="h-11 w-11 items-center justify-center rounded-card border border-border bg-white"
          >
            <Ionicons name="arrow-back" size={21} color="#1a2027" />
          </Pressable>
          <Text className="text-xl font-bold text-ink">Conversazione</Text>
        </View>
        {detail.isError ? (
          <View className="gap-3 rounded-card border border-border bg-surface p-4">
            <View className="flex-row items-start gap-3">
              <Ionicons name="document-outline" size={22} color="#62717a" />
              <View className="flex-1">
                <Text className="font-semibold text-ink">
                  Post non disponibile
                </Text>
                <Text className="mt-1 text-sm leading-5 text-muted">
                  {getFriendlyError(
                    detail.error,
                    "Il contenuto potrebbe essere scaduto o rimosso.",
                  )}
                </Text>
              </View>
            </View>
            <View className="flex-row gap-2">
              <Button
                label="Riprova"
                variant="secondary"
                className="flex-1"
                onPress={() => void detail.refetch()}
              />
              <Button
                label="Notifiche"
                className="flex-1"
                onPress={() => router.replace("/notifications")}
              />
            </View>
          </View>
        ) : null}
        {detail.isLoading ? (
          <Text className="text-muted">Carico post e commenti...</Text>
        ) : null}
        {selectedPost ? (
          <FeedPostCard post={selectedPost} mediaMode="full" />
        ) : null}
        {selectedPost && isOwnPost && !demoMode ? (
          editingPost ? (
            <View className="gap-3 rounded-card border border-border bg-white p-4">
              <Text className="font-semibold text-ink">Modifica il post</Text>
              <TextInput
                multiline
                maxLength={POST_BODY_MAX_LENGTH}
                textAlignVertical="top"
                value={editBody}
                onChangeText={setEditBody}
                className="min-h-24 rounded-card border border-border bg-bg p-3 text-ink"
              />
              <Text className="text-right text-xs text-muted">{editBody.length}/{POST_BODY_MAX_LENGTH}</Text>
              <View className="flex-row gap-2">
                <Button label="Annulla" variant="secondary" className="flex-1" onPress={() => setEditingPost(false)} />
                <Button
                  label="Salva"
                  icon="checkmark"
                  className="flex-1"
                  loading={updatePost.isPending}
                  disabled={!editBody.trim() || editBody.trim().length > POST_BODY_MAX_LENGTH}
                  onPress={() => updatePost.mutate()}
                />
              </View>
            </View>
          ) : (
            <View className="flex-row gap-2">
              <Button label="Modifica" icon="create-outline" variant="secondary" className="flex-1" onPress={beginEditingPost} />
              <Button label="Elimina" icon="trash-outline" variant="danger" className="flex-1" loading={deletePost.isPending} onPress={confirmDeletePost} />
            </View>
          )
        ) : null}
        {!isOwnPost ? (
          <Button
            label={activeChatId
              ? "Vai alla chat privata"
              : connection?.state === "pending_outgoing"
                ? "Richiesta inviata"
                : connection?.state === "pending_incoming"
                  ? "Rispondi alla richiesta"
                  : "Richiedi chat privata"}
            icon={activeChatId ? "chatbubbles" : connection?.state?.startsWith("pending") ? "time-outline" : "chatbubble-outline"}
            variant="secondary"
            disabled={!selectedPost || detail.isLoading || connection?.state === "pending_outgoing"}
            onPress={() =>
              activeChatId
                ? router.push(`/chat/${activeChatId}`)
                : connection?.state === "pending_incoming"
                  ? router.push("/(tabs)/chats")
                : void requestPrivateConnection()
            }
          />
        ) : null}
        {connectionError ? (
          <Text className="rounded-card bg-danger/10 p-3 text-sm font-semibold text-danger">
            {connectionError}
          </Text>
        ) : null}
        {comments.map((comment) => (
          <View key={comment.id} className="flex-row items-start gap-3">
            <View className="h-9 w-9 items-center justify-center rounded-full bg-white">
              <Text className="font-bold text-primary">
                {(comment.display_name ?? "U").slice(0, 1).toUpperCase()}
              </Text>
            </View>
            <View className="flex-1 rounded-card bg-primary-soft p-3">
              <Text className="mb-1 text-xs font-semibold text-muted">
                {comment.display_name ?? "Utente vicino"} ·{" "}
                {new Date(comment.created_at).toLocaleTimeString("it-IT", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </Text>
              <Text className="text-ink">{comment.body}</Text>
              {isOwnPost && comment.author_id !== currentUser.data?.id ? (
                <View className="mt-3 flex-row items-center gap-2 border-t border-ink/10 pt-2">
                  <Text className="mr-auto text-xs font-medium text-muted">Commento utile?</Text>
                  {([-1, 1] as const).map((rating) => {
                    const selected = comment.rating === rating;
                    const isUp = rating === 1;
                    return (
                      <Pressable
                        key={rating}
                        accessibilityRole="button"
                        accessibilityLabel={isUp ? "Valuta positivamente il commento" : "Valuta negativamente il commento"}
                        accessibilityState={{ selected, disabled: rateComment.isPending }}
                        disabled={rateComment.isPending}
                        onPress={() => rateComment.mutate({ commentId: comment.id, rating })}
                        className={`h-11 w-11 items-center justify-center rounded-card border ${selected ? "border-primary bg-primary" : "border-border bg-white"}`}
                      >
                        <Ionicons
                          name={selected ? (isUp ? "thumbs-up" : "thumbs-down") : (isUp ? "thumbs-up-outline" : "thumbs-down-outline")}
                          size={19}
                          color={selected ? "#ffffff" : "#62717a"}
                        />
                      </Pressable>
                    );
                  })}
                </View>
              ) : comment.rating ? (
                <View className="mt-2 flex-row items-center gap-1.5">
                  <Ionicons name={comment.rating === 1 ? "thumbs-up" : "thumbs-down"} size={14} color="#62717a" />
                  <Text className="text-xs text-muted">Valutato dall'autore del post</Text>
                </View>
              ) : null}
            </View>
          </View>
        ))}
        {selectedPost && !canComment ? (
          <View className="flex-row items-start gap-3 rounded-card bg-category-event-surface p-3">
            <Ionicons name="archive-outline" size={20} color="#3f4852" />
            <View className="flex-1">
              <Text className="font-semibold text-category-event-ink">Post storico</Text>
              <Text className="mt-1 text-sm leading-5 text-muted">
                La conversazione resta consultabile, ma non accetta nuovi commenti.
              </Text>
            </View>
          </View>
        ) : null}
        <View className="flex-row items-end gap-2 border-t border-border bg-bg pt-4">
          <Controller
            control={control}
            name="body"
            render={({ field }) => (
              <TextInput
                editable={canComment}
                multiline
                placeholder={
                  canComment
                    ? "Commenta pubblicamente"
                    : selectedPost
                      ? "Commenti chiusi per questo post"
                      : "Carica il post prima di commentare"
                }
                className="min-h-12 flex-1 rounded-card border border-border bg-white px-3 py-3 text-ink"
                value={field.value}
                onChangeText={field.onChange}
              />
            )}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Invia commento"
            accessibilityState={{
              disabled: !canComment || createComment.isPending,
            }}
            disabled={!canComment || createComment.isPending}
            onPress={handleSubmit((values) => createComment.mutate(values))}
            className="h-12 w-12 items-center justify-center rounded-card bg-accent disabled:opacity-50"
          >
            <Ionicons name="send" size={19} color="#ffffff" />
          </Pressable>
        </View>
        {commentError ? (
          <Text className="rounded-card bg-danger/10 p-3 text-sm font-semibold text-danger">
            {commentError}
          </Text>
        ) : null}
      </View>
    </Screen>
  );
}
