import { jsonResponse, requireUser, withHttp } from "../_shared/http.ts";

Deno.serve(await withHttp(async (req) => {
  const { user, adminClient } = await requireUser(req);
  const areaId = new URL(req.url).searchParams.get("areaId");
  if (!areaId) return jsonResponse({ error: "area_id_required" }, 400);

  const { data: storedHistory, error: historyError } = await adminClient
    .from("area_history")
    .select("id,area_id,first_seen_at,last_seen_at,areas(name,city,country_code,place_label)")
    .eq("user_id", user.id)
    .eq("area_id", areaId)
    .maybeSingle();

  if (historyError) return jsonResponse({ error: "area_detail_failed", details: historyError.message }, 400);
  let history = storedHistory;
  if (!history) {
    const { data: area, error: areaError } = await adminClient
      .from("areas")
      .select("id,name,city,country_code,place_label")
      .eq("id", areaId)
      .maybeSingle();
    if (areaError) return jsonResponse({ error: "area_detail_failed", details: areaError.message }, 400);
    if (!area) return jsonResponse({ error: "area_not_found" }, 404);
    const now = new Date().toISOString();
    history = {
      id: null,
      area_id: area.id,
      first_seen_at: now,
      last_seen_at: now,
      areas: area
    };
  }

  const { data: areaPosts } = await adminClient
    .from("posts")
    .select("id,author_id,category,body,status,expires_at,comment_count,created_at")
    .eq("area_id", areaId)
    .order("created_at", { ascending: false })
    .limit(500);

  const allPosts = areaPosts ?? [];
  const postIds = allPosts.map((post) => post.id);
  const ownPosts = allPosts.filter((post) => post.author_id === user.id).slice(0, 30);
  const [{ data: comments }, { data: connections }] = postIds.length > 0
    ? await Promise.all([
      adminClient.from("comments").select("id,post_id,body,created_at").in("post_id", postIds).eq("author_id", user.id).order("created_at", { ascending: false }).limit(60),
      adminClient.from("connection_requests").select("id,post_id,requester_id,recipient_id,status,created_at").in("post_id", postIds).or(`requester_id.eq.${user.id},recipient_id.eq.${user.id}`).order("created_at", { ascending: false }).limit(60)
    ])
    : [{ data: [] }, { data: [] }];

  const postById = new Map(allPosts.map((post) => [post.id, post]));
  const otherUserIds = [...new Set((connections ?? []).map((connection) => connection.requester_id === user.id ? connection.recipient_id : connection.requester_id))];
  const requestIds = (connections ?? []).map((connection) => connection.id);
  const [{ data: profiles }, { data: chats }] = await Promise.all([
    otherUserIds.length > 0
      ? adminClient.from("profiles").select("id,display_name,reputation_score").in("id", otherUserIds)
      : Promise.resolve({ data: [] }),
    requestIds.length > 0
      ? adminClient.from("private_chats").select("id,connection_request_id,status").in("connection_request_id", requestIds)
      : Promise.resolve({ data: [] })
  ]);
  const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
  const chatByRequest = new Map((chats ?? []).map((chat) => [chat.connection_request_id, chat]));

  return jsonResponse({
    history,
    posts: ownPosts,
    comments: (comments ?? []).map((comment) => ({ ...comment, post: postById.get(comment.post_id) ?? null })),
    connections: (connections ?? []).map((connection) => {
      const otherUserId = connection.requester_id === user.id ? connection.recipient_id : connection.requester_id;
      return { ...connection, post: postById.get(connection.post_id) ?? null, other_profile: profileById.get(otherUserId) ?? null, chat: chatByRequest.get(connection.id) ?? null };
    })
  });
}));
