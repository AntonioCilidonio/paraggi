import type { QueryClient } from "@tanstack/react-query";
import { supabase } from "@/services/supabase";
import { dismissPresentedRouteNotifications, setAppBadgeCount } from "@/services/notifications";

function stringValue(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

export async function markOpenedNotificationRead(
  data: Record<string, unknown>,
  route: string,
  queryClient: QueryClient,
) {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return;

  const notificationId = stringValue(data.notificationId) ?? stringValue(data.notification_id);
  let update = supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", auth.user.id)
    .is("read_at", null);

  if (notificationId) update = update.eq("id", notificationId);
  else update = update.eq("deep_link", route);
  await update;

  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", auth.user.id)
    .is("read_at", null);
  queryClient.setQueryData(["notifications", "unread-count"], count ?? 0);
  await Promise.all([
    setAppBadgeCount(count ?? 0),
    dismissPresentedRouteNotifications(route),
  ]);
  await queryClient.invalidateQueries({ queryKey: ["notifications"] });
}
