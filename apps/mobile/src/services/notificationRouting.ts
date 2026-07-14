export type NotificationData = Record<string, unknown>;

function stringValue(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function resolveNotificationRoute(data: NotificationData, storedDeepLink?: string | null) {
  const deepLink = stringValue(data.deepLink) ?? storedDeepLink;
  if (deepLink?.startsWith("/")) return deepLink;

  const type = stringValue(data.type);
  const postId = stringValue(data.postId);
  const chatId = stringValue(data.chatId);
  const alertId = stringValue(data.alertId);

  if ((type === "comment_received" || type === "nearby_relevant_post") && postId) return `/post/${postId}`;
  if (type === "private_request") return "/(tabs)/chats";
  if ((type === "request_accepted" || type === "private_message" || type === "chat_reactivated" || type === "nearby_again") && chatId) {
    return `/chat/${chatId}`;
  }
  if (type === "danger_alert" && alertId) return `/danger/${alertId}`;
  return "/(tabs)/feed";
}
