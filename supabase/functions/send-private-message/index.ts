import { audit, jsonResponse, readJson, requireUser, withHttp } from "../_shared/http.ts";

type Payload = {
  chatId: string;
  body: string;
};

Deno.serve(await withHttp(async (req) => {
  const { user, adminClient } = await requireUser(req);
  const payload = await readJson<Payload>(req);

  const { data: status, error: statusError } = await adminClient.rpc("refresh_chat_status", { chat_id_input: payload.chatId });
  if (statusError) return jsonResponse({ error: "chat_status_failed", details: statusError.message }, 400);
  if (status !== "active") return jsonResponse({ error: "chat_not_active", status }, 403);

  const { data, error } = await adminClient.from("private_messages").insert({
    chat_id: payload.chatId,
    sender_id: user.id,
    body: payload.body
  }).select("id, chat_id, sender_id, body, created_at").single();

  if (error) return jsonResponse({ error: "send_message_failed", details: error.message }, 400);

  await adminClient.from("private_chats").update({ last_message_at: new Date().toISOString() }).eq("id", payload.chatId);
  await audit(adminClient, { actorId: user.id, eventType: "chat", action: "send_private_message", targetTable: "private_messages", targetId: data.id });
  return jsonResponse({ message: data }, 201);
}));

