import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { Screen } from "@/components/Screen";
import { Button } from "@/components/Button";
import { demoMode } from "@/config/env";
import { demoChats } from "@/demo/data";
import { sendLocalNotification } from "@/services/notifications";
import { supabase } from "@/services/supabase";
import { useAppStore } from "@/stores/appStore";

type ChatRow = {
  id: string;
  status: string;
  last_distance_meters: number | null;
  last_message_at: string | null;
  updated_at: string;
};

export default function ChatsScreen() {
  const demoStatusById = useAppStore((state) => state.demoChatStatusById);
  const requests = useAppStore((state) => state.demoRequests);
  const acceptDemoRequest = useAppStore((state) => state.acceptDemoRequest);
  const declineDemoRequest = useAppStore((state) => state.declineDemoRequest);
  const chats = useQuery({
    queryKey: ["chats", demoStatusById],
    queryFn: async () => {
      if (demoMode) {
        return demoChats.map((chat) => ({
          ...chat,
          status: demoStatusById[chat.id] ?? chat.status
        }));
      }
      const { data, error } = await supabase.from("private_chats").select("id,status,last_distance_meters,last_message_at,updated_at").order("updated_at", { ascending: false });
      if (error) throw error;
      return data as ChatRow[];
    }
  });

  async function accept(requestId: string) {
    acceptDemoRequest(requestId);
    await sendLocalNotification("Richiesta accettata", "La chat privata e ora attiva entro il raggio condiviso.");
    await chats.refetch();
  }

  async function decline(requestId: string) {
    declineDemoRequest(requestId);
    await sendLocalNotification("Richiesta rifiutata", "La connessione privata non e stata aperta.");
  }

  return (
    <Screen>
      <View className="mt-4 gap-4">
        <View>
          <Text className="text-2xl font-bold text-ink">Chat private</Text>
          <Text className="mt-1 text-sm leading-5 text-muted">Lo storico resta, l'invio messaggi vive solo nella prossimita.</Text>
        </View>
        {demoMode ? (
          <View className="gap-3">
            <Text className="font-semibold text-ink">Richieste private</Text>
            {requests.map((request) => (
              <View key={request.id} className="gap-3 rounded-card border border-border bg-surface p-4">
                <View>
                  <Text className="font-semibold text-ink">{request.from}</Text>
                  <Text className="mt-1 text-sm leading-5 text-muted">{request.reason}</Text>
                  <Text className="mt-1 text-xs text-muted">Distanza approssimativa {request.distance_meters} m · stato {request.status}</Text>
                </View>
                {request.status === "pending" ? (
                  <View className="flex-row gap-2">
                    <Button label="Accetta" onPress={() => void accept(request.id)} />
                    <Button label="Rifiuta" variant="secondary" onPress={() => void decline(request.id)} />
                  </View>
                ) : null}
              </View>
            ))}
          </View>
        ) : null}
        {chats.data?.length === 0 ? (
          <View className="rounded-card border border-border bg-surface p-4">
            <Text className="font-semibold text-ink">Nessuna chat ancora</Text>
            <Text className="mt-1 text-sm text-muted">Commenta un post vicino e richiedi una connessione privata.</Text>
          </View>
        ) : null}
        <View className="gap-3">
          {chats.data?.map((chat) => (
            <Pressable
              key={chat.id}
              accessibilityRole="button"
              accessibilityLabel={chat.status === "active" ? "Apri chat attiva" : "Apri chat sospesa"}
              onPress={() => router.push(`/chat/${chat.id}`)}
              className="rounded-card border border-border bg-surface p-4"
            >
              <View className="flex-row items-center justify-between gap-3">
                <View className="flex-1">
                  <Text className="font-semibold text-ink">{chat.status === "active" ? "Chat attiva" : "Chat sospesa"}</Text>
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
