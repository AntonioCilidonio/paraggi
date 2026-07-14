import { audit, jsonResponse, readJson, requireUser, withHttp } from "../_shared/http.ts";
import { sendPushToUsers } from "../_shared/push.ts";

type Payload = {
  chatId: string;
  body: string;
};

Deno.serve(await withHttp(async (req) => {
  const { user, userClient, adminClient } = await requireUser(req);
  const payload = await readJson<Payload>(req);

  const { data: status, error: statusError } = await userClient.rpc("refresh_chat_status", { chat_id_input: payload.chatId });
  if (statusError) return jsonResponse({ error: "chat_status_failed", details: statusError.message }, 400);
  if (status !== "active") return jsonResponse({ error: "chat_not_active", status }, 403);

  const { data, error } = await adminClient.from("private_messages").insert({
    chat_id: payload.chatId,
    sender_id: user.id,
    body: payload.body
  }).select("id, chat_id, sender_id, body, created_at").single();

  if (error) return jsonResponse({ error: "send_message_failed", details: error.message }, 400);

  await adminClient.from("private_chats").update({ last_message_at: new Date().toISOString() }).eq("id", payload.chatId);
  const { data: chat } = await adminClient.from("private_chats").select("user_a_id,user_b_id").eq("id", payload.chatId).single();
  const recipientId = chat ? (chat.user_a_id === user.id ? chat.user_b_id : chat.user_a_id) : null;
  if (recipientId) {
    const deepLink = `/chat/${payload.chatId}`;
    await adminClient.from("notifications").insert({
      user_id: recipientId,
      type: "private_message",
      title: "Nuovo messaggio",
      body: "Hai ricevuto un messaggio in una chat privata.",
      deep_link: deepLink
    });
    await sendPushToUsers(adminClient, [recipientId], {
      title: "Nuovo messaggio",
      body: "Hai ricevuto un messaggio in una chat privata.",
      data: { type: "private_message", chatId: payload.chatId, deepLink }
    });

    const { data: recipientProfile } = await adminClient.from("profiles").select("display_name").eq("id", recipientId).single();
    if (recipientProfile?.display_name === "Marta Test") {
      const replyBody = "Perfetto, chat attiva. Se ti allontani, Paraggi blocchera l'invio ma lascera lo storico visibile.";
      await adminClient.from("private_messages").insert({
        chat_id: payload.chatId,
        sender_id: recipientId,
        body: replyBody
      });
      await adminClient.from("private_chats").update({ last_message_at: new Date().toISOString() }).eq("id", payload.chatId);
    }
  }
  await audit(adminClient, { actorId: user.id, eventType: "chat", action: "send_private_message", targetTable: "private_messages", targetId: data.id });
  return jsonResponse({ message: data }, 201);
}));
