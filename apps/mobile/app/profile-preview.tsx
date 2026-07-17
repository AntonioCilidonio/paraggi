import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/Button";
import { Screen } from "@/components/Screen";
import { demoMode } from "@/config/env";
import { callFunction } from "@/services/api";
import { getFriendlyError } from "@/services/errors";
import { supabase } from "@/services/supabase";
import { useAppStore } from "@/stores/appStore";

type ConnectionState = "none" | "connected" | "pending_outgoing" | "pending_incoming" | "disconnected";

type DetailResponse = {
  connection?: { state: ConnectionState; chatId: string | null; requestId: string | null };
};

function firstParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

export default function ProfilePreviewScreen() {
  const params = useLocalSearchParams<{
    userId?: string | string[];
    postId?: string | string[];
    displayName?: string | string[];
    avatarUrl?: string | string[];
    connected?: string | string[];
  }>();
  const userId = firstParam(params.userId);
  const postId = firstParam(params.postId);
  const displayName = firstParam(params.displayName) ?? "Persona vicina";
  const avatarUrl = firstParam(params.avatarUrl);
  const connectedFromChat = firstParam(params.connected) === "true";
  const radiusMeters = useAppStore((state) => state.radiusMeters);
  const queryClient = useQueryClient();

  const viewer = useQuery({
    queryKey: ["current-user", "profile-preview"],
    queryFn: async () => {
      if (demoMode) return { id: "me" };
      const { data } = await supabase.auth.getUser();
      return data.user;
    }
  });
  const detail = useQuery({
    queryKey: ["profile-preview", postId, radiusMeters],
    enabled: Boolean(postId) && !connectedFromChat,
    queryFn: async () => callFunction<DetailResponse>("get-post-detail", { method: "GET", query: { postId: postId!, radiusMeters } })
  });
  const connection = detail.data?.connection;
  const canView = connectedFromChat || viewer.data?.id === userId || connection?.state === "connected";
  const checkingAccess = !connectedFromChat && (viewer.isLoading || (Boolean(postId) && detail.isLoading));
  const initial = displayName.slice(0, 1).toUpperCase();

  const requestConnection = useMutation({
    mutationFn: async () => {
      if (!postId || !userId) throw new Error("Post o utente non disponibile.");
      return callFunction("request-connection", { body: { postId, recipientId: userId, message: "Vorrei aprire una chat privata contestuale." } });
    },
    onSuccess: async () => {
      await detail.refetch();
      await queryClient.invalidateQueries({ queryKey: ["chats"] });
    }
  });

  return (
    <Screen showBottomBar>
      <View className="gap-5">
        <AppHeader />
        <View className="flex-row items-center gap-3">
          <Pressable accessibilityRole="button" accessibilityLabel="Torna indietro" onPress={() => router.back()} className="h-11 w-11 items-center justify-center rounded-card border border-border bg-white">
            <Ionicons name="arrow-back" size={21} color="#1a2027" />
          </Pressable>
          <View className="flex-1">
            <Text className="text-xl font-bold text-ink">{displayName}</Text>
            <Text className="mt-1 text-sm text-muted">Profilo di vicinanza</Text>
          </View>
        </View>

        {checkingAccess ? (
          <View className="items-center gap-3 rounded-card border border-border bg-white p-8">
            <View className="h-16 w-16 rounded-full bg-primary-soft" />
            <Text className="font-semibold text-ink">Verifico la connessione...</Text>
            <Text className="text-center text-sm text-muted">La foto resta protetta finche il controllo non e completato.</Text>
          </View>
        ) : detail.isError && !connectedFromChat ? (
          <View className="gap-3 rounded-card border border-danger bg-white p-5">
            <Text className="font-semibold text-danger">Profilo non verificato</Text>
            <Text className="text-sm leading-5 text-muted">{getFriendlyError(detail.error, "Non riesco a verificare la connessione. Riprova.")}</Text>
            <Button label="Riprova" icon="refresh" onPress={() => void detail.refetch()} />
          </View>
        ) : canView ? (
          <View className="gap-3">
            {avatarUrl ? (
              <Pressable accessibilityRole="imagebutton" accessibilityLabel={`Apri la foto di ${displayName} a schermo intero`} onPress={() => router.push({ pathname: "/media-view", params: { url: avatarUrl, label: displayName } })} className="overflow-hidden rounded-card bg-surface" style={{ aspectRatio: 1 }}>
                <Image source={{ uri: avatarUrl }} contentFit="cover" cachePolicy="memory-disk" style={{ width: "100%", height: "100%" }} />
                <View className="absolute bottom-3 right-3 h-11 w-11 items-center justify-center rounded-card bg-ink/80">
                  <Ionicons name="expand-outline" size={21} color="#ffffff" />
                </View>
              </Pressable>
            ) : (
              <View className="items-center gap-3 rounded-card bg-primary-soft py-12">
                <View className="h-24 w-24 items-center justify-center rounded-full bg-white">
                  <Text className="text-4xl font-bold text-primary">{initial}</Text>
                </View>
                <Text className="font-semibold text-ink">Foto non ancora impostata</Text>
                <Text className="text-sm text-muted">La connessione privata e attiva.</Text>
              </View>
            )}
          </View>
        ) : (
          <View className="items-center gap-4 rounded-card border border-border bg-white p-6">
            <View className="h-16 w-16 items-center justify-center rounded-full bg-primary-soft">
              <Ionicons name="lock-closed" size={29} color="#3b82c4" />
            </View>
            <View className="gap-2">
              <Text className="text-center text-lg font-bold text-ink">Foto riservata alle connessioni</Text>
              <Text className="text-center text-sm leading-5 text-muted">La foto completa diventa visibile quando la richiesta di chat privata viene accettata.</Text>
            </View>
            {connection?.state === "pending_outgoing" ? (
              <Button label="Richiesta inviata" icon="time-outline" variant="secondary" disabled />
            ) : connection?.state === "pending_incoming" ? (
              <Button label="Rispondi alla richiesta" icon="chatbubbles-outline" onPress={() => router.push("/(tabs)/chats")} />
            ) : (
              <Button label={requestConnection.isPending ? "Invio richiesta..." : "Richiedi chat privata"} icon="person-add-outline" loading={requestConnection.isPending} disabled={!postId || !userId || requestConnection.isPending} onPress={() => requestConnection.mutate()} />
            )}
            {requestConnection.isError ? <Text className="text-center text-sm font-semibold text-danger">{getFriendlyError(requestConnection.error, "Richiesta non inviata. Riprova.")}</Text> : null}
          </View>
        )}
      </View>
    </Screen>
  );
}
