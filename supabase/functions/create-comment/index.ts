import { audit, jsonResponse, readJson, requireUser, withHttp } from "../_shared/http.ts";

type CreateCommentPayload = {
  postId: string;
  body: string;
};

Deno.serve(await withHttp(async (req) => {
  const { user, adminClient } = await requireUser(req);
  const payload = await readJson<CreateCommentPayload>(req);

  const { data: post } = await adminClient.from("posts").select("id, author_id, status, expires_at, position").eq("id", payload.postId).single();
  if (!post || post.status !== "active" || new Date(post.expires_at).getTime() <= Date.now()) {
    return jsonResponse({ error: "post_not_commentable" }, 403);
  }

  const { data: location } = await adminClient.rpc("latest_trusted_location", { for_user_id: user.id }).single();
  if (!location) return jsonResponse({ error: "valid_location_required" }, 403);

  const { data, error } = await adminClient.from("comments").insert({
    post_id: payload.postId,
    author_id: user.id,
    body: payload.body
  }).select("id, post_id, author_id, body, created_at").single();

  if (error) return jsonResponse({ error: "create_comment_failed", details: error.message }, 400);

  await adminClient.from("notifications").insert({
    user_id: post.author_id,
    type: "comment_received",
    title: "Nuovo commento",
    body: "Qualcuno vicino ha commentato il tuo post.",
    deep_link: `/post/${payload.postId}`
  });

  await audit(adminClient, { actorId: user.id, eventType: "comment", action: "create_comment", targetTable: "comments", targetId: data.id });
  return jsonResponse({ comment: data }, 201);
}));

