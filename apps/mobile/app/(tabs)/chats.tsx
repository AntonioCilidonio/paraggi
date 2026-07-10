import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { Screen } from "@/components/Screen";
import { Button } from "@/components/Button";
import { demoMode } from "@/config/env";
import { demoChats } from "@/demo/data";
import { callFunction } from "@/services/api";
import { sendLocalNotification } from "@/services/notifications";
import { useAppStore } from "@/stores/appStore";

type ChatRow = {
  id: string;
  status: string;
  last_distance_meters: number | null;
  last_message_at: string | null;
  updated_at: string;
  other_profile?: { display_name: string; reputation_score: number } | null;
};

type RequestRow = {
  id: string;
  requester_id?: string;
  status: string;
  message?: string | null;
  created_at: string;
  profiles?: { display_name: string; reputation_score: number } | null;
  from?: string;
  reason?: string;
};

function requestName(request: RequestRow): string {
  return request.profiles?.display_name ?? request.from ?? "Persona vicina";
}

function requestReason(request: RequestRow): string {
  return request.reason ?? request.message ?? "Vuole aprire una chat privata contestuale.";
}

export default function ChatsScreen() {
  const demoStatusById = useAppStore((state) => state.demoChatStatusById);
  const requests = useAppStore((state) => state.demoRequests);
  const acceptDemoRequest = useAppStore((state) => state.acceptDemoRequest);
  const declineDemoRequest = useAppStore((state) => state.declineDemoRequest);
  const chats = useQuery({
    queryKey: ["chats", demoStatusById],
    queryFn: async () => {
      if (demoMode) {
        return {
          requests,
          chats: demoChats.map((chat) => ({
            ...chat,
            status: demoStatusById[chat.id] ?? chat.status,
            other_profile: { display_name: chat.id === "demo-active-chat" ? "Marta" : "Luca", reputation_score: 24 }
          }))
        };
      }
      return callFunction<{ requests: RequestRow[]; chats: ChatRow[] }>("get-chat-inbox", { method: "GET" });
    }
  });

  async function accept(requestId: string) {
    if (demoMode) {
      acceptDemoRequest(requestId);
    } else {
      await callFunction("respond-connection", { body: { requestId, accept: true } });
    }
    await sendLocalNotification("Richiesta accettata", "La chat privata e ora attiva entro il raggio condiviso.");
    await chats.refetch();
  }

  async function decline(requestId: string) {
    if (demoMode) {
      declineDemoRequest(requestId);
    } else {
      await callFunction("respond-connection", { body: { requestId, accept: false } });
    }
    await sendLocalNotification("Richiesta rifiutata", "La connessione privata non e stata aperta.");
    await chats.refetch();
  }

  return (
    <Screen>
      <View className="mt-4 gap-4">
        <View>
          <Text className="text-2xl font-bold text-ink">Chat private</Text>
          <Text className="mt-1 text-sm leading-5 text-muted">Lo storico resta, l'invio messaggi vive solo nella prossimita.</Text>
        </View>
        <View className="gap-3">
          <Text className="font-semibold text-ink">Richieste private</Text>
          {(chats.data?.requests ?? []).length === 0 ? (
            <View className="rounded-card border border-border bg-surface p-4">
              <Text className="font-semibold text-ink">Nessuna richiesta in attesa</Text>
              <Text className="mt-1 text-sm text-muted">Quando qualcuno chiede di proseguire in privato, comparira qui.</Text>
            </View>
          ) : null}
          {(chats.data?.requests ?? []).map((request) => (
            <View key={request.id} className="gap-3 rounded-card border border-border bg-surface p-4">
              <View>
                <Text className="font-semibold text-ink">{requestName(request)}</Text>
                <Text className="mt-1 text-sm leading-5 text-muted">{requestReason(request)}</Text>
                <Text className="mt-1 text-xs text-muted">Stato {request.status}</Text>
              </View>
              {request.status === "pending" ? (
                <View className="flex-row gap-2">
                  <Button label="Accetta" className="flex-1" onPress={() => void accept(request.id)} />
                  <Button label="Rifiuta" variant="secondary" className="flex-1" onPress={() => void decline(request.id)} />
                </View>
              ) : null}
            </View>
          ))}
        </View>
        {chats.data?.chats.length === 0 ? (
          <View className="rounded-card border border-border bg-surface p-4">
            <Text className="font-semibold text-ink">Nessuna chat ancora</Text>
            <Text className="mt-1 text-sm text-muted">Commenta un post vicino e richiedi una connessione privata.</Text>
          </View>
        ) : null}
        <View className="gap-3">
          {chats.data?.chats.map((chat) => (
            <Pressable
              key={chat.id}
              accessibilityRole="button"
              accessibilityLabel={chat.status === "active" ? "Apri chat attiva" : "Apri chat sospesa"}
              onPress={() => router.push(`/chat/${chat.id}`)}
              className="rounded-card border border-border bg-surface p-4"
            >
              <View className="flex-row items-center justify-between gap-3">
                <View className="flex-1">
                  <Text className="font-semibold text-ink">{chat.other_profile?.display_name ?? (chat.status === "active" ? "Chat attiva" : "Chat sospesa")}</Text>
                  <Text className="mt-1 text-sm text-muted">{chat.last_distance_meters ? `Ultima distanza ${chat.last_distance_meters} m` : "Distanza in verifica"}</Text>
                </View>
                <Text className="text-lg text-muted">&gt;</Text>
              </View>
            </Pressable>
          ))}
        </View>
      </View>
    </Screen>
  );
}
