import { audit, jsonResponse, readJson, requireUser, withHttp } from "../_shared/http.ts";
import { sendPushToUsers } from "../_shared/push.ts";

type Payload = {
  postId?: string;
  chatId?: string;
  commentId?: string;
  recipientId: string;
  message?: string;
};

Deno.serve(await withHttp(async (req) => {
  const { user, adminClient } = await requireUser(req);
  const payload = await readJson<Payload>(req);

  if (!payload.recipientId) return jsonResponse({ error: "recipient_required" }, 400);
  if (payload.recipientId === user.id) return jsonResponse({ error: "cannot_request_self" }, 400);

  const participantPair = [user.id, payload.recipientId].sort().join(":");
  const { data: existingChat, error: existingChatError } = await adminClient
    .from("private_chats")
    .select("id,status,updated_at,is_connected,user_a_id,user_b_id,connection_request_id")
    .eq("participant_pair", participantPair)
    .maybeSingle();
  if (existingChatError) return jsonResponse({ error: "request_connection_failed", details: existingChatError.message }, 400);
  if (existingChat?.is_connected) return jsonResponse({ chat: existingChat, alreadyConnected: true });

  let postId = payload.postId;
  if (payload.chatId) {
    if (!existingChat || existingChat.id !== payload.chatId) {
      return jsonResponse({ error: "reconnect_chat_not_found" }, 404);
    }
    const isParticipant = existingChat.user_a_id === user.id || existingChat.user_b_id === user.id;
    const otherUserId = existingChat.user_a_id === user.id ? existingChat.user_b_id : existingChat.user_a_id;
    if (!isParticipant || otherUserId !== payload.recipientId || existingChat.is_connected) {
      return jsonResponse({ error: "reconnect_not_allowed" }, 403);
    }
    const { data: sourceRequest, error: sourceRequestError } = await adminClient
      .from("connection_requests")
      .select("post_id")
      .eq("id", existingChat.connection_request_id)
      .maybeSingle();
    if (sourceRequestError || !sourceRequest?.post_id) {
      return jsonResponse({ error: "reconnect_source_missing", details: sourceRequestError?.message }, 400);
    }
    postId = sourceRequest.post_id;
  } else {
    if (!postId) return jsonResponse({ error: "missing_post_id" }, 400);
    const { data: sourcePost, error: sourcePostError } = await adminClient
      .from("posts")
      .select("id,author_id")
      .eq("id", postId)
      .maybeSingle();
    if (sourcePostError || !sourcePost || sourcePost.author_id !== payload.recipientId) {
      return jsonResponse({ error: "connection_post_invalid", details: sourcePostError?.message }, 400);
    }
  }

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
    post_id: postId,
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
    body: existingChat ? "Una persona vuole ripristinare la vostra chat privata." : "Una persona vicina vuole aprire una chat contestuale.",
    deep_link: deepLink
  });
  await sendPushToUsers(adminClient, [payload.recipientId], {
    title: "Richiesta privata",
    body: existingChat ? "Una persona vuole ripristinare la vostra chat privata." : "Una persona vicina vuole aprire una chat contestuale.",
    data: { type: "private_request", requestId: data.id, deepLink }
  });

  await audit(adminClient, { actorId: user.id, eventType: "connection", action: "request_connection", targetTable: "connection_requests", targetId: data.id });
  return jsonResponse({ request: data }, 201);
}));
