import { audit, jsonResponse, readJson, requireUser, withHttp } from "../_shared/http.ts";

type Payload = { chatId: string };

Deno.serve(await withHttp(async (req) => {
  const { user, adminClient } = await requireUser(req);
  const payload = await readJson<Payload>(req);
  if (!payload.chatId) return jsonResponse({ error: "chat_id_required" }, 400);

  const { data: chat, error: chatError } = await adminClient
    .from("private_chats")
    .select("id,user_a_id,user_b_id,is_connected")
    .eq("id", payload.chatId)
    .maybeSingle();

  if (chatError) return jsonResponse({ error: "disconnect_chat_failed", details: chatError.message }, 400);
  if (!chat || (chat.user_a_id !== user.id && chat.user_b_id !== user.id)) {
    return jsonResponse({ error: "chat_not_found" }, 404);
  }
  if (!chat.is_connected) return jsonResponse({ disconnected: true, alreadyDisconnected: true });

  const { error } = await adminClient
    .from("private_chats")
    .update({
      is_connected: false,
      disconnected_at: new Date().toISOString(),
      disconnected_by_id: user.id,
      last_status_reason: "disconnected"
    })
    .eq("id", payload.chatId)
    .eq("is_connected", true);

  if (error) return jsonResponse({ error: "disconnect_chat_failed", details: error.message }, 400);

  await audit(adminClient, {
    actorId: user.id,
    eventType: "connection",
    action: "disconnect_chat",
    targetTable: "private_chats",
    targetId: payload.chatId
  });

  return jsonResponse({ disconnected: true });
}));
