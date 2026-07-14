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
    const { data, error } = await adminClient.from("private_chats").insert({
      connection_request_id: payload.requestId,
      user_a_id: requestRow.requester_id,
      user_b_id: requestRow.recipient_id,
      radius_meters: payload.radiusMeters ?? 500
    }).select("*").single();
    if (error) return jsonResponse({ error: "create_chat_failed", details: error.message }, 400);
    chat = data;

    const { error: requestUpdateError } = await adminClient.from("connection_requests").update({
      status,
      responded_at: new Date().toISOString()
    }).eq("id", payload.requestId);
    if (requestUpdateError) {
      await adminClient.from("private_chats").delete().eq("id", data.id);
      return jsonResponse({ error: "request_update_failed", details: requestUpdateError.message }, 400);
    }

    await adminClient.from("notifications").insert({
      user_id: requestRow.requester_id,
      type: "request_accepted",
      title: "Richiesta accettata",
      body: "La chat privata e pronta finche siete vicini.",
      deep_link: `/chat/${data.id}`
    });
    await sendPushToUsers(adminClient, [requestRow.requester_id], {
      title: "Richiesta accettata",
      body: "La chat privata e pronta finche siete vicini.",
      data: { type: "request_accepted", chatId: data.id }
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
