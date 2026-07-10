import { jsonResponse, requireUser, withHttp } from "../_shared/http.ts";

Deno.serve(await withHttp(async (req) => {
  const { user, userClient, adminClient } = await requireUser(req);
  const url = new URL(req.url);
  const chatId = url.searchParams.get("chatId");
  if (!chatId) return jsonResponse({ error: "chat_id_required" }, 400);

  const { data: status, error: statusError } = await userClient.rpc("refresh_chat_status", { chat_id_input: chatId });
  if (statusError) return jsonResponse({ error: "chat_status_failed", details: statusError.message }, 400);

  const { data: chat, error: chatError } = await adminClient
    .from("private_chats")
    .select("id,user_a_id,user_b_id,status,last_distance_meters,last_message_at,updated_at")
    .eq("id", chatId)
    .single();
  if (chatError || !chat || (chat.user_a_id !== user.id && chat.user_b_id !== user.id)) {
    return jsonResponse({ error: "chat_not_found" }, 404);
  }

  const { data: messages, error: messagesError } = await adminClient
    .from("private_messages")
    .select("id,sender_id,body,created_at,delivered_at,read_at")
    .eq("chat_id", chatId)
    .order("created_at", { ascending: true });
  if (messagesError) return jsonResponse({ error: "messages_failed", details: messagesError.message }, 400);

  return jsonResponse({ chat: { ...chat, status }, messages: messages ?? [] });
}));
