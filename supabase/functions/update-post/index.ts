import { audit, jsonResponse, readJson, requireUser, withHttp } from "../_shared/http.ts";

type UpdatePostPayload = {
  postId: string;
  body: string;
  category: string;
};

const categories = ["question", "information", "lost_item", "help", "event", "social", "emergency"];

Deno.serve(await withHttp(async (req) => {
  const { user, adminClient } = await requireUser(req);
  const payload = await readJson<UpdatePostPayload>(req);
  const body = typeof payload.body === "string" ? payload.body.trim() : "";

  if (!payload.postId || body.length < 1 || body.length > 160 || !categories.includes(payload.category)) {
    return jsonResponse({ error: "invalid_post_content" }, 400);
  }

  const { data: post, error: postError } = await adminClient
    .from("posts")
    .select("id,author_id,status")
    .eq("id", payload.postId)
    .maybeSingle();
  if (postError) return jsonResponse({ error: "update_post_failed", details: postError.message }, 400);
  if (!post) return jsonResponse({ error: "post_not_found" }, 404);
  if (post.author_id !== user.id) return jsonResponse({ error: "forbidden" }, 403);
  if (post.status === "removed" || post.status === "shadow_hidden") {
    return jsonResponse({ error: "post_not_editable" }, 409);
  }

  const { data: updated, error } = await adminClient
    .from("posts")
    .update({ body, category: payload.category, updated_at: new Date().toISOString() })
    .eq("id", payload.postId)
    .eq("author_id", user.id)
    .select("id,category,body,status,expires_at,updated_at")
    .single();
  if (error) return jsonResponse({ error: "update_post_failed", details: error.message }, 400);

  await audit(adminClient, {
    actorId: user.id,
    eventType: "post",
    action: "update_post",
    targetTable: "posts",
    targetId: payload.postId,
  });
  return jsonResponse({ post: updated });
}));
