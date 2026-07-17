import { audit, jsonResponse, readJson, requireUser, withHttp } from "../_shared/http.ts";

type DeletePostPayload = { postId: string };

Deno.serve(await withHttp(async (req) => {
  const { user, adminClient } = await requireUser(req);
  const payload = await readJson<DeletePostPayload>(req);
  if (!payload.postId) return jsonResponse({ error: "missing_post_id" }, 400);

  const { data: post, error: postError } = await adminClient
    .from("posts")
    .select("id,author_id,status,body")
    .eq("id", payload.postId)
    .maybeSingle();
  if (postError) return jsonResponse({ error: "delete_post_failed", details: postError.message }, 400);
  if (!post) return jsonResponse({ deleted: true });
  if (post.author_id !== user.id) return jsonResponse({ error: "forbidden" }, 403);

  const { data: attachments } = await adminClient
    .from("post_attachments")
    .select("storage_path")
    .eq("post_id", payload.postId)
    .eq("author_id", user.id);
  const paths = (attachments ?? []).flatMap((attachment) =>
    attachment.storage_path?.startsWith(`${user.id}/`) ? [attachment.storage_path] : []
  );

  const { error } = await adminClient
    .from("posts")
    .update({
      status: "removed",
      body: String(post.body).trim().slice(0, 160) || "Post rimosso",
      updated_at: new Date().toISOString(),
    })
    .eq("id", payload.postId)
    .eq("author_id", user.id);
  if (error) return jsonResponse({ error: "delete_post_failed", details: error.message }, 400);

  await adminClient.from("post_attachments").delete().eq("post_id", payload.postId);
  if (paths.length > 0) await adminClient.storage.from("post-media").remove(paths);
  await adminClient.from("notifications").delete().eq("deep_link", `/post/${payload.postId}`);
  await audit(adminClient, {
    actorId: user.id,
    eventType: "post",
    action: "remove_post",
    targetTable: "posts",
    targetId: payload.postId,
  });
  return jsonResponse({ deleted: true });
}));
