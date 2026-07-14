import { jsonResponse, requireUser, withHttp } from "../_shared/http.ts";
import { getPostAttachments } from "../_shared/postMedia.ts";

Deno.serve(await withHttp(async (req) => {
  const { user, userClient, adminClient } = await requireUser(req);
  const url = new URL(req.url);
  const postId = url.searchParams.get("postId");
  const requestedRadius = Number(url.searchParams.get("radiusMeters") ?? "500");

  if (!postId) return jsonResponse({ error: "missing_post_id" }, 400);

  const { data: profile } = await adminClient
    .from("profiles")
    .select("search_radius_meters")
    .eq("id", user.id)
    .maybeSingle();
  const allowedRadii = [100, 500, 1000, 5000, 30000, 60000];
  const savedRadius = Number(profile?.search_radius_meters);
  const radiusMeters = allowedRadii.includes(savedRadius)
    ? savedRadius
    : allowedRadii.includes(requestedRadius) ? requestedRadius : 500;

  await adminClient.rpc("expire_old_posts");

  const { data: post, error: postError } = await userClient
    .rpc("get_post_detail_for_user", {
      post_id_input: postId,
      radius_meters: radiusMeters
    })
    .maybeSingle();
  if (postError) return jsonResponse({ error: "post_detail_failed", details: postError.message }, 400);
  if (!post) return jsonResponse({ error: "post_not_visible" }, 404);

  const { data: comments, error: commentsError } = await adminClient
    .from("comments")
    .select("id,author_id,body,created_at,profiles!comments_author_id_fkey(display_name)")
    .eq("post_id", postId)
    .eq("status", "active")
    .order("created_at", { ascending: true });

  if (commentsError) return jsonResponse({ error: "comments_failed", details: commentsError.message }, 400);

  const decoratedComments = (comments ?? []).map((comment) => ({
    id: comment.id,
    author_id: comment.author_id,
    body: comment.body,
    created_at: comment.created_at,
    display_name: comment.profiles?.display_name ?? "Utente vicino"
  }));

  try {
    const attachments = await getPostAttachments(adminClient, [postId]);
    return jsonResponse({ post: { ...post, attachments: attachments.get(postId) ?? [] }, comments: decoratedComments });
  } catch (mediaError) {
    return jsonResponse({ error: "post_media_failed", details: mediaError instanceof Error ? mediaError.message : String(mediaError) }, 400);
  }
}));
