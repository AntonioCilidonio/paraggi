import { jsonResponse, requireUser, withHttp } from "../_shared/http.ts";

Deno.serve(await withHttp(async (req) => {
  const { user, adminClient } = await requireUser(req);

  const { data: requests, error: requestsError } = await adminClient
    .from("connection_requests")
    .select("id,post_id,requester_id,recipient_id,status,message,created_at,profiles!connection_requests_requester_id_fkey(display_name,reputation_score)")
    .eq("recipient_id", user.id)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (requestsError) return jsonResponse({ error: "requests_failed", details: requestsError.message }, 400);

  const { data: chats, error: chatsError } = await adminClient
    .from("private_chats")
    .select("id,user_a_id,user_b_id,status,last_distance_meters,last_message_at,updated_at")
    .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`)
    .order("updated_at", { ascending: false });

  if (chatsError) return jsonResponse({ error: "chats_failed", details: chatsError.message }, 400);

  const otherUserIds = Array.from(new Set((chats ?? []).map((chat) => chat.user_a_id === user.id ? chat.user_b_id : chat.user_a_id)));
  const { data: profiles } = otherUserIds.length
    ? await adminClient.from("profiles").select("id,display_name,reputation_score").in("id", otherUserIds)
    : { data: [] };

  const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
  const seenUsers = new Set<string>();
  const decoratedChats = (chats ?? []).flatMap((chat) => {
    const otherUserId = chat.user_a_id === user.id ? chat.user_b_id : chat.user_a_id;
    if (seenUsers.has(otherUserId)) return [];
    seenUsers.add(otherUserId);
    return [{
      ...chat,
      other_user_id: otherUserId,
      other_profile: profileById.get(otherUserId) ?? null
    }];
  });

  return jsonResponse({ requests: requests ?? [], chats: decoratedChats });
}));
