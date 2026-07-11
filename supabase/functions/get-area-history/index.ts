import { jsonResponse, requireUser, withHttp } from "../_shared/http.ts";

Deno.serve(await withHttp(async (req) => {
  const { user, adminClient } = await requireUser(req);

  const { data, error } = await adminClient
    .from("area_history")
    .select("id,area_id,first_seen_at,last_seen_at,post_count,comment_count,connection_count,areas(name,city,country_code,place_label)")
    .eq("user_id", user.id)
    .order("last_seen_at", { ascending: false })
    .limit(30);

  if (error) return jsonResponse({ error: "area_history_failed", details: error.message }, 400);

  const rows = await Promise.all((data ?? []).map(async (item) => {
    const [{ count: postCount }, { count: commentCount }, { count: connectionCount }] = await Promise.all([
      adminClient.from("posts").select("id", { count: "exact", head: true }).eq("area_id", item.area_id),
      adminClient.from("comments").select("id", { count: "exact", head: true }).in("post_id", await postIdsForArea(adminClient, item.area_id)),
      adminClient.from("connection_requests").select("id", { count: "exact", head: true }).eq("recipient_id", user.id)
    ]);

    return {
      ...item,
      post_count: postCount ?? item.post_count ?? 0,
      comment_count: commentCount ?? item.comment_count ?? 0,
      connection_count: connectionCount ?? item.connection_count ?? 0
    };
  }));

  return jsonResponse({ history: rows });
}));

async function postIdsForArea(adminClient: any, areaId: string) {
  const { data } = await adminClient.from("posts").select("id").eq("area_id", areaId).limit(200);
  const ids = (data ?? []).map((post) => post.id);
  return ids.length > 0 ? ids : ["00000000-0000-0000-0000-000000000000"];
}
