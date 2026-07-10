import { jsonResponse, requireUser, withHttp } from "../_shared/http.ts";

Deno.serve(await withHttp(async (req) => {
  const { userClient, adminClient } = await requireUser(req);
  const url = new URL(req.url);
  const postId = url.searchParams.get("postId");
  const radiusMeters = Number(url.searchParams.get("radiusMeters") ?? "500");

  if (!postId) return jsonResponse({ error: "missing_post_id" }, 400);

  const { data: nearbyPosts, error: nearbyError } = await userClient.rpc("get_nearby_posts", {
    radius_meters: radiusMeters,
    page_limit: 50
  });

  if (nearbyError) return jsonResponse({ error: "post_detail_failed", details: nearbyError.message }, 400);

  const post = (nearbyPosts ?? []).find((item: { id: string }) => item.id === postId);
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

  return jsonResponse({ post, comments: decoratedComments });
}));
