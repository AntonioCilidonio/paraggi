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

  const { data, error } = await adminClient.from("connection_requests").insert({
    post_id: payload.postId,
    comment_id: payload.commentId,
    requester_id: user.id,
    recipient_id: payload.recipientId,
    message: payload.message
  }).select("id, status, created_at").single();

  if (error) return jsonResponse({ error: "request_connection_failed", details: error.message }, 400);

  await adminClient.from("notifications").insert({
    user_id: payload.recipientId,
    type: "private_request",
    title: "Richiesta privata",
    body: "Una persona vicina vuole aprire una chat contestuale.",
    deep_link: "/requests"
  });
  await sendPushToUsers(adminClient, [payload.recipientId], {
    title: "Richiesta privata",
    body: "Una persona vicina vuole aprire una chat contestuale.",
    data: { type: "private_request", requestId: data.id }
  });

  await audit(adminClient, { actorId: user.id, eventType: "connection", action: "request_connection", targetTable: "connection_requests", targetId: data.id });
  return jsonResponse({ request: data }, 201);
}));
