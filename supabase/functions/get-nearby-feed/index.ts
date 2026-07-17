import { jsonResponse, requireUser, withHttp } from "../_shared/http.ts";
import { getPostAttachments } from "../_shared/postMedia.ts";

Deno.serve(await withHttp(async (req) => {
  const { userClient, adminClient } = await requireUser(req);
  const url = new URL(req.url);
  const radiusMeters = Number(url.searchParams.get("radiusMeters") ?? "500");
  const limit = Number(url.searchParams.get("limit") ?? "30");
  const areaName = url.searchParams.get("areaName")?.trim() || null;
  const areaCity = url.searchParams.get("areaCity")?.trim() || null;

  await adminClient.rpc("expire_old_posts");

  const { data, error } = await userClient.rpc("get_nearby_posts", {
    radius_meters: radiusMeters,
    page_limit: areaName ? 50 : limit
  });

  if (error) return jsonResponse({ error: "nearby_feed_failed", details: error.message }, 400);

  try {
    const posts = (data ?? []).filter((post) => {
      if (!areaName) return true;
      if (post.area_name !== areaName) return false;
      return !areaCity || post.city === areaCity;
    }).slice(0, Math.min(Math.max(limit, 1), 50));
    const attachments = await getPostAttachments(adminClient, posts.map((post) => post.id));
    return jsonResponse({ posts: posts.map((post) => ({ ...post, attachments: attachments.get(post.id) ?? [] })) });
  } catch (mediaError) {
    return jsonResponse({ error: "nearby_media_failed", details: mediaError instanceof Error ? mediaError.message : String(mediaError) }, 400);
  }
}));
