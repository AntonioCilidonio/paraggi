import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { Button } from "@/components/Button";
import { AppHeader } from "@/components/AppHeader";
import { Screen } from "@/components/Screen";
import { StatusPill } from "@/components/StatusPill";
import { demoMode } from "@/config/env";
import { demoPosts } from "@/demo/data";
import { callFunction } from "@/services/api";
import { getFriendlyError } from "@/services/errors";

type AreaPost = {
  id: string;
  category: string;
  body: string;
  status: string;
  comment_count: number;
  created_at: string;
};

type AreaComment = {
  id: string;
  post_id: string;
  body: string;
  created_at: string;
  post: AreaPost | null;
};

type AreaConnection = {
  id: string;
  status: string;
  created_at: string;
  post: AreaPost | null;
  other_profile: { display_name: string; reputation_score: number } | null;
  chat: { id: string; status: string } | null;
};

type AreaDetail = {
  history: {
    first_seen_at: string;
    last_seen_at: string;
    areas: { name: string; city: string | null; country_code: string; place_label?: string | null } | null;
  };
  posts: AreaPost[];
  comments: AreaComment[];
  connections: AreaConnection[];
};

const categoryLabels: Record<string, string> = {
  question: "Domanda",
  information: "Informazione",
  lost_item: "Oggetto smarrito",
  help: "Aiuto",
  event: "Evento",
  social: "Social",
  emergency: "Emergenza"
};

export default function AreaDetailScreen() {
  const params = useLocalSearchParams<{ areaId?: string | string[] }>();
  const areaId = Array.isArray(params.areaId) ? params.areaId[0] : params.areaId;
  const detail = useQuery({
    queryKey: ["area-detail", areaId],
    enabled: Boolean(areaId),
    queryFn: async (): Promise<AreaDetail> => {
      if (demoMode) {
        const now = new Date().toISOString();
        return {
          history: { first_seen_at: now, last_seen_at: now, areas: { name: areaId === "demo-area-2" ? "Fiera Verona" : "Centro Bologna", city: areaId === "demo-area-2" ? "Verona" : "Bologna", country_code: "IT" } },
          posts: demoPosts.slice(0, 2).map((post) => ({ ...post, status: "active" })),
          comments: [],
          connections: []
        };
      }
      return callFunction<AreaDetail>("get-area-detail", { method: "GET", query: { areaId: areaId! } });
    }
  });

  const area = detail.data?.history.areas;
  return (
    <Screen showBottomBar>
      <View className="gap-6">
        <AppHeader />
        <View className="flex-row items-center gap-3 pb-1">
          <Pressable accessibilityRole="button" accessibilityLabel="Torna alle aree" onPress={() => router.back()} className="h-11 w-11 items-center justify-center rounded-card border border-border bg-white">
            <Ionicons name="arrow-back" size={21} color="#1a2027" />
          </Pressable>
          <View className="flex-1">
            <Text className="text-xl font-bold text-ink">{area?.name ?? "Dettaglio area"}</Text>
            <Text className="mt-1 text-sm text-muted">{area?.city ?? "Attivita personale nel luogo"}</Text>
          </View>
        </View>

        {detail.isLoading ? <View className="h-32 rounded-card bg-surface" /> : null}
        {detail.isError ? (
          <View className="gap-3 rounded-card border border-danger bg-surface p-4">
            <Text className="font-semibold text-danger">Area non caricata</Text>
            <Text className="text-sm leading-5 text-muted">{getFriendlyError(detail.error, "Controlla la rete e riprova.")}</Text>
            <Button label="Riprova" variant="secondary" onPress={() => void detail.refetch()} />
          </View>
        ) : null}

        {detail.data ? (
          <>
            <View className="flex-row justify-between rounded-card bg-primary-soft p-4">
              <View><Text className="text-xl font-bold text-ink">{detail.data.posts.length}</Text><Text className="text-xs text-muted">Post</Text></View>
              <View><Text className="text-xl font-bold text-ink">{detail.data.comments.length}</Text><Text className="text-xs text-muted">Commenti</Text></View>
              <View><Text className="text-xl font-bold text-ink">{detail.data.connections.length}</Text><Text className="text-xs text-muted">Connessioni</Text></View>
              <View><Text className="text-sm font-bold text-ink">{new Date(detail.data.history.last_seen_at).toLocaleDateString("it-IT")}</Text><Text className="text-xs text-muted">Ultima visita</Text></View>
            </View>

            <View className="gap-3 rounded-card bg-white p-4">
              <Text className="text-lg font-bold text-ink">I tuoi post</Text>
              {detail.data.posts.length === 0 ? <Text className="text-sm leading-5 text-muted">Non hai ancora pubblicato in quest'area.</Text> : null}
              {detail.data.posts.map((post) => (
                <Pressable key={post.id} accessibilityRole="button" onPress={() => router.push(`/post/${post.id}`)} className="border-b border-border py-3 last:border-b-0">
                  <View className="flex-row items-center justify-between gap-3"><Text className="text-xs font-semibold text-primary">{categoryLabels[post.category] ?? post.category}</Text><Text className="text-xs text-muted">{new Date(post.created_at).toLocaleDateString("it-IT")}</Text></View>
                  <Text className="mt-2 text-sm leading-5 text-ink" numberOfLines={3}>{post.body}</Text>
                  <Text className="mt-2 text-xs font-semibold text-muted">{post.comment_count} commenti</Text>
                </Pressable>
              ))}
            </View>

            <View className="gap-3 rounded-card bg-white p-4">
              <Text className="text-lg font-bold text-ink">I tuoi commenti</Text>
              {detail.data.comments.length === 0 ? <Text className="text-sm leading-5 text-muted">Nessun commento lasciato in quest'area.</Text> : null}
              {detail.data.comments.map((comment) => (
                <Pressable key={comment.id} accessibilityRole="button" onPress={() => router.push(`/post/${comment.post_id}`)} className="flex-row gap-3 border-b border-border py-3">
                  <Ionicons name="chatbubble-outline" size={19} color="#3b82c4" />
                  <View className="flex-1"><Text className="text-sm leading-5 text-ink">{comment.body}</Text><Text className="mt-1 text-xs text-muted">{new Date(comment.created_at).toLocaleDateString("it-IT")}</Text></View>
                </Pressable>
              ))}
            </View>

            <View className="gap-3 rounded-card bg-white p-4">
              <Text className="text-lg font-bold text-ink">Connessioni nate qui</Text>
              {detail.data.connections.length === 0 ? <Text className="text-sm leading-5 text-muted">Nessuna connessione privata nata in quest'area.</Text> : null}
              {detail.data.connections.map((connection) => (
                <Pressable key={connection.id} accessibilityRole="button" disabled={!connection.chat?.id} onPress={() => connection.chat?.id && router.push(`/chat/${connection.chat.id}`)} className="flex-row items-center gap-3 border-b border-border py-3">
                  <View className="h-10 w-10 items-center justify-center rounded-full bg-surface"><Ionicons name="person-outline" size={19} color="#3b82c4" /></View>
                  <View className="flex-1"><Text className="font-semibold text-ink">{connection.other_profile?.display_name ?? "Persona vicina"}</Text><Text className="mt-1 text-xs text-muted">{connection.post?.body ?? "Connessione di vicinanza"}</Text></View>
                  <StatusPill label={connection.chat?.status === "active" ? "Attiva" : connection.status === "accepted" ? "Accettata" : "Conclusa"} tone={connection.chat?.status === "active" ? "success" : "neutral"} />
                </Pressable>
              ))}
            </View>
          </>
        ) : null}
      </View>
    </Screen>
  );
}
