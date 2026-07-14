import { audit, jsonResponse, readJson, requireUser, withHttp } from "../_shared/http.ts";
import { sendPushToUsers } from "../_shared/push.ts";

type Payload = {
  requestId: string;
  accept: boolean;
  radiusMeters?: 100 | 500 | 1000 | 5000 | 30000 | 60000;
};

Deno.serve(await withHttp(async (req) => {
  const { user, adminClient } = await requireUser(req);
  const payload = await readJson<Payload>(req);

  const { data: requestRow } = await adminClient.from("connection_requests").select("*").eq("id", payload.requestId).single();
  if (!requestRow || requestRow.recipient_id !== user.id || requestRow.status !== "pending") {
    return jsonResponse({ error: "request_not_respondable" }, 403);
  }

  const status = payload.accept ? "accepted" : "rejected";
  let chat = null;
  if (payload.accept) {
    const participantPair = [requestRow.requester_id, requestRow.recipient_id].sort().join(":");
    const { data: existingChat } = await adminClient.from("private_chats").select("*").eq("participant_pair", participantPair).maybeSingle();
    let chatCreated = false;
    if (existingChat) {
      const { data: reconnectedChat, error: reconnectError } = await adminClient
        .from("private_chats")
        .update({
          connection_request_id: payload.requestId,
          is_connected: true,
          status: "frozen_permission",
          disconnected_at: null,
          disconnected_by_id: null,
          last_status_reason: "connection_accepted"
        })
        .eq("id", existingChat.id)
        .select("*")
        .single();
      if (reconnectError || !reconnectedChat) {
        return jsonResponse({ error: "create_chat_failed", details: reconnectError?.message }, 400);
      }
      chat = reconnectedChat;
    } else {
      const { data, error } = await adminClient.from("private_chats").insert({
        connection_request_id: payload.requestId,
        user_a_id: requestRow.requester_id,
        user_b_id: requestRow.recipient_id,
        radius_meters: payload.radiusMeters ?? 500
      }).select("*").single();
      if (error?.code === "23505") {
        const racedChat = await adminClient.from("private_chats").select("*").eq("participant_pair", participantPair).maybeSingle();
        if (!racedChat.data) return jsonResponse({ error: "create_chat_failed", details: error.message }, 400);
        chat = racedChat.data;
      } else if (error || !data) {
        return jsonResponse({ error: "create_chat_failed", details: error?.message }, 400);
      } else {
        chat = data;
        chatCreated = true;
      }
    }
    if (!chat) return jsonResponse({ error: "create_chat_failed" }, 400);

    const { error: requestUpdateError } = await adminClient.from("connection_requests").update({
      status,
      responded_at: new Date().toISOString()
    }).eq("id", payload.requestId);
    if (requestUpdateError) {
      if (chatCreated) await adminClient.from("private_chats").delete().eq("id", chat.id);
      return jsonResponse({ error: "request_update_failed", details: requestUpdateError.message }, 400);
    }

    const deepLink = `/chat/${chat.id}`;
    await adminClient.from("notifications").insert({
      user_id: requestRow.requester_id,
      type: "request_accepted",
      title: "Richiesta accettata",
      body: "La chat privata e pronta finche siete vicini.",
      deep_link: deepLink
    });
    await sendPushToUsers(adminClient, [requestRow.requester_id], {
      title: "Richiesta accettata",
      body: "La chat privata e pronta finche siete vicini.",
      data: { type: "request_accepted", chatId: chat.id, deepLink }
    });
  } else {
    const { error: requestUpdateError } = await adminClient.from("connection_requests").update({
      status,
      responded_at: new Date().toISOString()
    }).eq("id", payload.requestId);
    if (requestUpdateError) return jsonResponse({ error: "request_update_failed", details: requestUpdateError.message }, 400);
  }

  await audit(adminClient, { actorId: user.id, eventType: "connection", action: status, targetTable: "connection_requests", targetId: payload.requestId });
  return jsonResponse({ status, chat });
}));
