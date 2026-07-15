export type NotificationData = Record<string, unknown>;

function stringValue(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function normalizeDeepLink(value: string | null) {
  if (!value) return null;
  let route = value.trim();
  if (route.startsWith("paraggi://"))
    route = `/${route.slice("paraggi://".length)}`;
  route = route.replace(/^\/\(tabs\)\//, "/").split(/[?#]/, 1)[0];

  const staticRoutes = new Set([
    "/feed",
    "/chats",
    "/history",
    "/profile",
    "/heatmap",
    "/notifications",
  ]);
  if (staticRoutes.has(route)) return route;
  if (/^\/(post|chat|danger)\/[a-zA-Z0-9-]+$/.test(route)) return route;
  return null;
}

export function resolveNotificationRoute(
  data: NotificationData,
  storedDeepLink?: string | null,
) {
  const deepLink = normalizeDeepLink(
    stringValue(data.deepLink) ??
      stringValue(data.deep_link) ??
      storedDeepLink ??
      null,
  );
  if (deepLink) return deepLink;

  const type = stringValue(data.type);
  const postId = stringValue(data.postId) ?? stringValue(data.post_id);
  const chatId = stringValue(data.chatId) ?? stringValue(data.chat_id);
  const alertId = stringValue(data.alertId) ?? stringValue(data.alert_id);

  if (
    (type === "comment_received" || type === "nearby_relevant_post") &&
    postId
  )
    return `/post/${postId}`;
  if (type === "private_request") return "/chats";
  if (
    (type === "request_accepted" ||
      type === "private_message" ||
      type === "chat_reactivated" ||
      type === "nearby_again") &&
    chatId
  ) {
    return `/chat/${chatId}`;
  }
  if (type === "danger_alert" && alertId) return `/danger/${alertId}`;
  return "/feed";
}
