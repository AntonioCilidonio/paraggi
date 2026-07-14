import { jsonResponse, requireUser, withHttp } from "../_shared/http.ts";

type AreaHistoryRow = {
  id: string;
  area_id: string;
  first_seen_at: string;
  last_seen_at: string;
  post_count: number;
  comment_count: number;
  connection_count: number;
  areas: unknown;
};

Deno.serve(await withHttp(async (req) => {
  const { user, adminClient } = await requireUser(req);

  const { data, error } = await adminClient
    .from("area_history")
    .select("id,area_id,first_seen_at,last_seen_at,post_count,comment_count,connection_count,areas(name,city,country_code,place_label)")
    .eq("user_id", user.id)
    .order("last_seen_at", { ascending: false })
    .limit(30);

  if (error) return jsonResponse({ error: "area_history_failed", details: error.message }, 400);

  const history = (data ?? []) as AreaHistoryRow[];
  const areaIds = history.map((item) => item.area_id);
  if (areaIds.length === 0) return jsonResponse({ history: [] });

  const { data: posts } = await adminClient
    .from("posts")
    .select("id,area_id,author_id")
    .in("area_id", areaIds)
    .limit(2000);

  const postRows = posts ?? [];
  const postIds = postRows.map((post) => post.id);
  const [{ data: comments }, { data: connections }] = postIds.length > 0
    ? await Promise.all([
      adminClient.from("comments").select("id,post_id,author_id").in("post_id", postIds).eq("author_id", user.id).limit(2000),
      adminClient.from("connection_requests").select("id,post_id,requester_id,recipient_id").in("post_id", postIds).or(`requester_id.eq.${user.id},recipient_id.eq.${user.id}`).limit(2000)
    ])
    : [{ data: [] }, { data: [] }];

  const areaByPost = new Map(postRows.map((post) => [post.id, post.area_id]));
  const counts = new Map<string, { posts: number; comments: number; connections: number }>();
  for (const areaId of areaIds) counts.set(areaId, { posts: 0, comments: 0, connections: 0 });

  for (const post of postRows) {
    if (post.author_id === user.id) counts.get(post.area_id)!.posts += 1;
  }
  for (const comment of comments ?? []) {
    const areaId = areaByPost.get(comment.post_id);
    if (areaId) counts.get(areaId)!.comments += 1;
  }
  for (const connection of connections ?? []) {
    const areaId = areaByPost.get(connection.post_id);
    if (areaId) counts.get(areaId)!.connections += 1;
  }

  return jsonResponse({
    history: history.map((item) => ({
      ...item,
      post_count: counts.get(item.area_id)?.posts ?? 0,
      comment_count: counts.get(item.area_id)?.comments ?? 0,
      connection_count: counts.get(item.area_id)?.connections ?? 0
    }))
  });
}));
