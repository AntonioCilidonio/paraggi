import { audit, jsonResponse, readJson, requireUser, withHttp } from "../_shared/http.ts";

type Payload = {
  requestId: string;
  accept: boolean;
  radiusMeters?: 100 | 500 | 1000 | 5000;
};

Deno.serve(await withHttp(async (req) => {
  const { user, adminClient } = await requireUser(req);
  const payload = await readJson<Payload>(req);

  const { data: requestRow } = await adminClient.from("connection_requests").select("*").eq("id", payload.requestId).single();
  if (!requestRow || requestRow.recipient_id !== user.id || requestRow.status !== "pending") {
    return jsonResponse({ error: "request_not_respondable" }, 403);
  }

  const status = payload.accept ? "accepted" : "rejected";
  await adminClient.from("connection_requests").update({ status, responded_at: new Date().toISOString() }).eq("id", payload.requestId);

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

    await adminClient.from("notifications").insert({
      user_id: requestRow.requester_id,
      type: "request_accepted",
      title: "Richiesta accettata",
      body: "La chat privata e pronta finche siete vicini.",
      deep_link: `/chat/${data.id}`
    });
  }

  await audit(adminClient, { actorId: user.id, eventType: "connection", action: status, targetTable: "connection_requests", targetId: payload.requestId });
  return jsonResponse({ status, chat });
}));

