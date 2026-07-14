import { audit, jsonResponse, readJson, requireUser, withHttp } from "../_shared/http.ts";
import { sendPushToUsers } from "../_shared/push.ts";

type Payload = {
  postId: string;
  commentId?: string;
  recipientId: string;
  message?: string;
};

Deno.serve(await withHttp(async (req) => {
  const { user, adminClient } = await requireUser(req);
  const payload = await readJson<Payload>(req);

  if (payload.recipientId === user.id) return jsonResponse({ error: "cannot_request_self" }, 400);

  const participantPair = [user.id, payload.recipientId].sort().join(":");
  const { data: existingChat } = await adminClient
    .from("private_chats")
    .select("id,status,updated_at,is_connected")
    .eq("participant_pair", participantPair)
    .maybeSingle();
  if (existingChat?.is_connected) return jsonResponse({ chat: existingChat, alreadyConnected: true });

  const findPendingRequest = () => adminClient
    .from("connection_requests")
    .select("id,status,created_at,requester_id,recipient_id")
    .eq("status", "pending")
    .or(`and(requester_id.eq.${user.id},recipient_id.eq.${payload.recipientId}),and(requester_id.eq.${payload.recipientId},recipient_id.eq.${user.id})`)
    .limit(1)
    .maybeSingle();

  const existing = await findPendingRequest();
  if (existing.data) {
    return jsonResponse({ request: existing.data, alreadyPending: true });
  }

  const { data, error } = await adminClient.from("connection_requests").insert({
    post_id: payload.postId,
    comment_id: payload.commentId,
    requester_id: user.id,
    recipient_id: payload.recipientId,
    message: payload.message
  }).select("id, status, created_at").single();

  if (error) {
    // A simultaneous retry can win after the initial lookup. Treat that race as
    // an idempotent success instead of exposing a database constraint error.
    if (error.code === "23505") {
      const racedRequest = await findPendingRequest();
      if (racedRequest.data) {
        return jsonResponse({ request: racedRequest.data, alreadyPending: true });
      }
    }
    return jsonResponse({ error: "request_connection_failed", details: error.message }, 400);
  }

  const deepLink = "/chats";
  await adminClient.from("notifications").insert({
    user_id: payload.recipientId,
    type: "private_request",
    title: "Richiesta privata",
    body: "Una persona vicina vuole aprire una chat contestuale.",
    deep_link: deepLink
  });
  await sendPushToUsers(adminClient, [payload.recipientId], {
    title: "Richiesta privata",
    body: "Una persona vicina vuole aprire una chat contestuale.",
    data: { type: "private_request", requestId: data.id, deepLink }
  });

  await audit(adminClient, { actorId: user.id, eventType: "connection", action: "request_connection", targetTable: "connection_requests", targetId: data.id });
  return jsonResponse({ request: data }, 201);
}));
