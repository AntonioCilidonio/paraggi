import { jsonResponse, requireUser, withHttp } from "../_shared/http.ts";

Deno.serve(await withHttp(async (req) => {
  const { user, adminClient } = await requireUser(req);
  const [profile, posts, comments, requests, chats, history] = await Promise.all([
    adminClient.from("profiles").select("*").eq("id", user.id).single(),
    adminClient.from("posts").select("id, category, body, status, expires_at, created_at").eq("author_id", user.id),
    adminClient.from("comments").select("id, post_id, body, status, created_at").eq("author_id", user.id),
    adminClient.from("connection_requests").select("*").or(`requester_id.eq.${user.id},recipient_id.eq.${user.id}`),
    adminClient.from("private_chats").select("id, status, created_at, updated_at").or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`),
    adminClient.from("area_history").select("*, areas(name, city, country_code)").eq("user_id", user.id)
  ]);

  return jsonResponse({
    exportedAt: new Date().toISOString(),
    profile: profile.data,
    posts: posts.data ?? [],
    comments: comments.data ?? [],
    connectionRequests: requests.data ?? [],
    privateChats: chats.data ?? [],
    areaHistory: history.data ?? []
  });
}));
