import { jsonResponse, requireUser, withHttp } from "../_shared/http.ts";

Deno.serve(await withHttp(async (req) => {
  const { user, adminClient } = await requireUser(req);

  const { data: pendingRequests, error: requestsError } = await adminClient
    .from("connection_requests")
    .select("id,post_id,requester_id,recipient_id,status,message,created_at,profiles!connection_requests_requester_id_fkey(display_name,reputation_score)")
    .eq("status", "pending")
    .or(`requester_id.eq.${user.id},recipient_id.eq.${user.id}`)
    .order("created_at", { ascending: false });

  if (requestsError) return jsonResponse({ error: "requests_failed", details: requestsError.message }, 400);

  const { data: chats, error: chatsError } = await adminClient
    .from("private_chats")
    .select("id,user_a_id,user_b_id,status,last_distance_meters,last_message_at,updated_at,is_connected")
    .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`)
    .order("updated_at", { ascending: false });

  if (chatsError) return jsonResponse({ error: "chats_failed", details: chatsError.message }, 400);

  const { data: unreadRows, error: unreadError } = await adminClient
    .rpc("get_chat_unread_counts", { for_user_id: user.id });
  if (unreadError) return jsonResponse({ error: "chats_failed", details: unreadError.message }, 400);
  const unreadByChat = new Map((unreadRows ?? []).map((row) => [row.chat_id, row.unread_count]));

  const otherUserIds = Array.from(new Set((chats ?? []).map((chat) => chat.user_a_id === user.id ? chat.user_b_id : chat.user_a_id)));
  const { data: profiles } = otherUserIds.length
    ? await adminClient.from("profiles").select("id,display_name,reputation_score").in("id", otherUserIds)
    : { data: [] };

  const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
  const pendingByOtherUser = new Map((pendingRequests ?? []).map((request) => {
    const otherUserId = request.requester_id === user.id ? request.recipient_id : request.requester_id;
    return [otherUserId, request];
  }));
  const seenUsers = new Set<string>();
  const decoratedChats = (chats ?? []).flatMap((chat) => {
    const otherUserId = chat.user_a_id === user.id ? chat.user_b_id : chat.user_a_id;
    if (seenUsers.has(otherUserId)) return [];
    seenUsers.add(otherUserId);
    return [{
      ...chat,
      unread_count: unreadByChat.get(chat.id) ?? 0,
      other_user_id: otherUserId,
      other_profile: profileById.get(otherUserId) ?? null,
      reconnect_request_status: pendingByOtherUser.has(otherUserId)
        ? pendingByOtherUser.get(otherUserId)?.requester_id === user.id ? "outgoing" : "incoming"
        : null
    }];
  });

  const incomingRequests = (pendingRequests ?? []).filter((request) => request.recipient_id === user.id);
  const totalUnread = decoratedChats.reduce((total, chat) => total + chat.unread_count, 0);
  return jsonResponse({ requests: incomingRequests, chats: decoratedChats, totalUnread });
}));
