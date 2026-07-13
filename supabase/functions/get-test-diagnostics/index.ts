import { jsonResponse, requireUser, withHttp } from "../_shared/http.ts";

Deno.serve(await withHttp(async (req) => {
  const { user, adminClient } = await requireUser(req);

  const [
    profile,
    pushTokens,
    latestLocation,
    posts,
    comments,
    incomingRequests,
    outgoingRequests,
    chats,
    messages,
    notifications,
    clientErrors
  ] = await Promise.all([
    adminClient.from("profiles").select("id,display_name,status,reputation_score,search_radius_meters").eq("id", user.id).single(),
    adminClient.from("push_tokens").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("enabled", true),
    adminClient.from("user_locations").select("captured_at,accuracy_meters,trust_status,trust_score").eq("user_id", user.id).order("captured_at", { ascending: false }).limit(1).maybeSingle(),
    adminClient.from("posts").select("id", { count: "exact", head: true }).eq("author_id", user.id),
    adminClient.from("comments").select("id", { count: "exact", head: true }).eq("author_id", user.id),
    adminClient.from("connection_requests").select("id", { count: "exact", head: true }).eq("recipient_id", user.id).eq("status", "pending"),
    adminClient.from("connection_requests").select("id", { count: "exact", head: true }).eq("requester_id", user.id),
    adminClient.from("private_chats").select("id", { count: "exact", head: true }).or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`),
    adminClient.from("private_messages").select("id", { count: "exact", head: true }).eq("sender_id", user.id),
    adminClient.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", user.id).is("read_at", null),
    adminClient
      .from("client_error_events")
      .select("created_at,severity,source,message,context")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(5)
  ]);

  return jsonResponse({
    user: {
      id: user.id,
      email: user.email,
      profile: profile.data
    },
    readiness: {
      hasProfile: Boolean(profile.data),
      hasRecentLocation: Boolean(latestLocation.data),
      hasPushToken: (pushTokens.count ?? 0) > 0,
      canTestFeed: Boolean(latestLocation.data),
      canReceiveRemotePush: (pushTokens.count ?? 0) > 0,
      canUseRealtimeNotifications: true
    },
    counts: {
      enabledPushTokens: pushTokens.count ?? 0,
      ownPosts: posts.count ?? 0,
      ownComments: comments.count ?? 0,
      pendingIncomingRequests: incomingRequests.count ?? 0,
      outgoingRequests: outgoingRequests.count ?? 0,
      chats: chats.count ?? 0,
      sentMessages: messages.count ?? 0,
      unreadNotifications: notifications.count ?? 0
    },
    latestLocation: latestLocation.data,
    recentErrors: clientErrors.data ?? []
  });
}));
