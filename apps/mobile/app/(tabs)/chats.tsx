import { useQuery } from "@tanstack/react-query";
import { Link } from "expo-router";
import { Text, View } from "react-native";
import { Screen } from "@/components/Screen";
import { supabase } from "@/services/supabase";

type ChatRow = {
  id: string;
  status: string;
  last_distance_meters: number | null;
  last_message_at: string | null;
  updated_at: string;
};

export default function ChatsScreen() {
  const chats = useQuery({
    queryKey: ["chats"],
    queryFn: async () => {
      const { data, error } = await supabase.from("private_chats").select("id,status,last_distance_meters,last_message_at,updated_at").order("updated_at", { ascending: false });
      if (error) throw error;
      return data as ChatRow[];
    }
  });

  return (
    <Screen>
      <View className="mt-4 gap-4">
        <View>
          <Text className="text-2xl font-bold text-ink">Chat private</Text>
          <Text className="mt-1 text-sm leading-5 text-muted">Lo storico resta, l'invio messaggi vive solo nella prossimita.</Text>
        </View>
        {chats.data?.length === 0 ? (
          <View className="rounded-card border border-border bg-surface p-4">
            <Text className="font-semibold text-ink">Nessuna chat ancora</Text>
            <Text className="mt-1 text-sm text-muted">Commenta un post vicino e richiedi una connessione privata.</Text>
          </View>
        ) : null}
        <View className="gap-3">
          {chats.data?.map((chat) => (
            <Link key={chat.id} href={`/chat/${chat.id}`} className="rounded-card border border-border bg-surface p-4">
              <Text className="font-semibold text-ink">{chat.status === "active" ? "Chat attiva" : "Chat sospesa"}</Text>
              <Text className="mt-1 text-sm text-muted">{chat.last_distance_meters ? `Ultima distanza ${chat.last_distance_meters} m` : "Distanza in verifica"}</Text>
            </Link>
          ))}
        </View>
      </View>
    </Screen>
  );
}

