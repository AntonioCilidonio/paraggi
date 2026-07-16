import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { type Href, router } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { Button } from "@/components/Button";
import { AppHeader } from "@/components/AppHeader";
import { Screen } from "@/components/Screen";
import { demoMode } from "@/config/env";
import { resolveNotificationRoute } from "@/services/notificationRouting";
import { clearPresentedNotifications } from "@/services/notifications";
import { supabase } from "@/services/supabase";

type NotificationRow = {
  id: string;
  type: string;
  title: string;
  body: string;
  deep_link: string | null;
  read_at: string | null;
  created_at: string;
};

const iconByType: Record<string, keyof typeof Ionicons.glyphMap> = {
  comment_received: "chatbubble-ellipses-outline",
  nearby_relevant_post: "radio-outline",
  private_request: "person-add-outline",
  request_accepted: "checkmark-circle-outline",
  private_message: "chatbubbles-outline",
  chat_reactivated: "wifi-outline",
  nearby_again: "navigate-outline",
  danger_alert: "warning-outline"
};

export default function NotificationsScreen() {
  const queryClient = useQueryClient();
  const notifications = useQuery({
    queryKey: ["notifications", "current"],
    queryFn: async () => {
      if (demoMode) return [] as NotificationRow[];
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth.user) throw authError ?? new Error("session_required");
      const { data, error } = await supabase
        .from("notifications")
        .select("id,type,title,body,deep_link,read_at,created_at")
        .eq("user_id", auth.user.id)
        .order("created_at", { ascending: false })
        .limit(60);
      if (error) throw error;
      return (data ?? []) as NotificationRow[];
    }
  });

  async function openNotification(notification: NotificationRow) {
    if (!notification.read_at && !demoMode) {
      await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", notification.id);
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
    }
    router.push(resolveNotificationRoute({ type: notification.type }, notification.deep_link) as Href);
  }

  async function markAllRead() {
    if (demoMode) return;
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;
    await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", auth.user.id).is("read_at", null);
    await queryClient.invalidateQueries({ queryKey: ["notifications"] });
    await clearPresentedNotifications();
    await queryClient.invalidateQueries({ queryKey: ["chats"] });
  }

  return (
    <Screen showBottomBar>
      <View className="gap-5">
        <AppHeader />
        <View className="flex-row items-center justify-between gap-3 pb-1">
          <Pressable accessibilityRole="button" accessibilityLabel="Torna indietro" onPress={() => router.back()} className="h-11 w-11 items-center justify-center rounded-card border border-border bg-white">
            <Ionicons name="arrow-back" size={21} color="#1a2027" />
          </Pressable>
          <View className="flex-1">
            <Text className="text-xl font-bold text-ink">Notifiche</Text>
          </View>
          {notifications.data?.some((item) => !item.read_at) ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Segna tutte come lette" onPress={() => void markAllRead()} className="h-11 w-11 items-center justify-center rounded-card border border-border bg-white">
              <Ionicons name="checkmark-done" size={21} color="#3b82c4" />
            </Pressable>
          ) : null}
        </View>

        {notifications.isLoading ? <Text className="text-muted">Carico le notifiche...</Text> : null}
        {notifications.isError ? (
          <View className="gap-3 rounded-card border border-danger bg-surface p-4">
            <Text className="font-semibold text-danger">Notifiche non disponibili</Text>
            <Text className="text-sm leading-5 text-muted">Controlla la connessione e riprova.</Text>
            <Button label="Riprova" variant="secondary" onPress={() => void notifications.refetch()} />
          </View>
        ) : null}
        {!notifications.isLoading && notifications.data?.length === 0 ? (
          <View className="items-center gap-3 py-14">
            <View className="h-14 w-14 items-center justify-center rounded-full bg-surface"><Ionicons name="notifications-outline" size={27} color="#62717a" /></View>
            <Text className="text-lg font-semibold text-ink">Tutto tranquillo qui vicino</Text>
            <Text className="max-w-72 text-center text-sm leading-5 text-muted">Commenti, richieste private, nuovi post e SOS compariranno qui.</Text>
          </View>
        ) : null}
        <View className="gap-2">
          {notifications.data?.map((notification) => (
            <Pressable
              key={notification.id}
              accessibilityRole="button"
              accessibilityLabel={`${notification.title}. ${notification.body}`}
              onPress={() => void openNotification(notification)}
              className={`flex-row items-start gap-3 rounded-card p-4 ${notification.type === "danger_alert" ? "bg-category-emergency" : notification.type === "comment_received" ? "bg-category-question" : notification.type === "private_request" || notification.type === "request_accepted" ? "bg-category-help" : notification.type === "nearby_relevant_post" ? "bg-category-information" : "bg-white"}`}
            >
              <View className="h-10 w-10 items-center justify-center rounded-card bg-white/70">
                <Ionicons name={iconByType[notification.type] ?? "notifications-outline"} size={21} color={notification.type === "danger_alert" ? "#b84037" : "#3b82c4"} />
              </View>
              <View className="flex-1">
                <View className="flex-row items-center gap-2">
                  <Text className="flex-1 font-semibold text-ink">{notification.title}</Text>
                  {!notification.read_at ? <View className="h-2 w-2 rounded-full bg-primary" /> : null}
                </View>
                <Text className="mt-1 text-sm leading-5 text-muted">{notification.body}</Text>
                <Text className="mt-2 text-xs text-muted">{new Date(notification.created_at).toLocaleString("it-IT", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#62717a" />
            </Pressable>
          ))}
        </View>
      </View>
    </Screen>
  );
}
