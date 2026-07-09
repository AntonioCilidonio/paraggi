import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { Controller, useForm } from "react-hook-form";
import { Text, TextInput, View } from "react-native";
import { Button } from "@/components/Button";
import { Screen } from "@/components/Screen";
import { demoMode } from "@/config/env";
import { callFunction } from "@/services/api";
import { supabase } from "@/services/supabase";
import { useRealtimeChannel } from "@/hooks/useRealtimeChannel";

type CommentRow = {
  id: string;
  author_id: string;
  body: string;
  created_at: string;
};

export default function PostDetailScreen() {
  const { postId } = useLocalSearchParams<{ postId: string }>();
  const queryClient = useQueryClient();
  const { control, handleSubmit, reset } = useForm<{ body: string }>({ defaultValues: { body: "" } });
  useRealtimeChannel(postId ? { type: "post-comments", postId } : null);
  const comments = useQuery({
    queryKey: ["comments", postId],
    queryFn: async () => {
      if (demoMode) {
        return [
          { id: "demo-comment-1", author_id: "demo-luca", body: "Confermo, il bus passa ancora ma con 10 minuti di ritardo.", created_at: new Date().toISOString() },
          { id: "demo-comment-2", author_id: "demo-marta", body: "Grazie, informazione utilissima.", created_at: new Date().toISOString() }
        ];
      }
      const { data, error } = await supabase.from("comments").select("id,author_id,body,created_at").eq("post_id", postId).order("created_at", { ascending: true });
      if (error) throw error;
      return data as CommentRow[];
    }
  });

  const createComment = useMutation({
    mutationFn: async (values: { body: string }) => {
      if (demoMode) return { comment: { id: "demo-new-comment", body: values.body } };
      return callFunction("create-comment", { body: { postId, body: values.body } });
    },
    onSuccess: async () => {
      reset();
      await queryClient.invalidateQueries({ queryKey: ["comments", postId] });
    }
  });

  return (
    <Screen>
      <View className="mt-4 gap-4">
        <Text className="text-2xl font-bold text-ink">Commenti</Text>
        {comments.data?.map((comment) => (
          <View key={comment.id} className="rounded-card bg-surface p-3">
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
