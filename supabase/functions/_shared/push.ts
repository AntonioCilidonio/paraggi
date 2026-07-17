import type { AdminClient } from "./http.ts";

type PushPayload = {
  title: string;
  body: string;
  data?: Record<string, unknown>;
  channelId?: string;
};

type ExpoReceipt = {
  status?: "ok" | "error";
  details?: { error?: string };
};

export async function sendPushToUsers(adminClient: AdminClient, userIds: string[], payload: PushPayload) {
  const recipients = Array.from(new Set(userIds.filter(Boolean)));
  if (recipients.length === 0) return { sent: 0 };

  const { data: rows, error } = await adminClient
    .from("push_tokens")
    .select("id,expo_push_token")
    .in("user_id", recipients)
    .eq("enabled", true);

  if (error || !rows?.length) return { sent: 0 };

  const response = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(rows.map((row) => ({
      to: row.expo_push_token,
      title: payload.title,
      body: payload.body,
      sound: "default",
      channelId: payload.channelId ?? "paraggi-local-v2",
      priority: "high",
      data: payload.data ?? {}
    })))
  });

  if (!response.ok) return { sent: 0 };
  const result = await response.json().catch(() => ({ data: [] })) as { data?: ExpoReceipt[] };
  const invalidIds = (result.data ?? []).flatMap((receipt, index) =>
    receipt.status === "error" && receipt.details?.error === "DeviceNotRegistered" ? [rows[index]?.id] : []
  ).filter(Boolean);

  if (invalidIds.length > 0) {
    await adminClient.from("push_tokens").update({ enabled: false }).in("id", invalidIds);
  }

  return { sent: rows.length - invalidIds.length };
}
