import { useQuery } from "@tanstack/react-query";
import { Text, View } from "react-native";
import { Screen } from "@/components/Screen";
import { supabase } from "@/services/supabase";

type AreaHistory = {
  id: string;
  first_seen_at: string;
  last_seen_at: string;
  post_count: number;
  comment_count: number;
  connection_count: number;
  areas: { name: string; city: string | null; country_code: string } | null;
};

export default function HistoryScreen() {
  const history = useQuery({
    queryKey: ["area-history"],
    queryFn: async () => {
      const { data, error } = await supabase.from("area_history").select("*, areas(name,city,country_code)").order("last_seen_at", { ascending: false });
      if (error) throw error;
      return data as AreaHistory[];
    }
  });

  return (
    <Screen>
      <View className="mt-4 gap-4">
        <View>
          <Text className="text-2xl font-bold text-ink">Aree visitate</Text>
          <Text className="mt-1 text-sm leading-5 text-muted">Cronologia generalizzata per luogo, mai tracciati GPS.</Text>
        </View>
        {history.data?.map((item) => (
          <View key={item.id} className="rounded-card border border-border bg-surface p-4">
            <Text className="font-semibold text-ink">{item.areas?.name ?? "Area"}</Text>
            <Text className="mt-1 text-sm text-muted">{item.areas?.city ?? "Citta"} · ultima visita {new Date(item.last_seen_at).toLocaleDateString()}</Text>
            <Text className="mt-2 text-sm text-muted">{item.post_count} post · {item.comment_count} commenti · {item.connection_count} connessioni</Text>
          </View>
        ))}
      </View>
    </Screen>
  );
}

