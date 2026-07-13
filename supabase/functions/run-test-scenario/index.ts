import { audit, jsonResponse, requireUser, withHttp } from "../_shared/http.ts";

function testEmail() {
  return `paraggi-scenario-${crypto.randomUUID()}@paraggi.local`;
}

Deno.serve(await withHttp(async (req) => {
  const { user, adminClient } = await requireUser(req);

  const { data: location } = await adminClient.rpc("latest_trusted_location", { for_user_id: user.id }).single();
  if (!location) return jsonResponse({ error: "valid_location_required" }, 403);
  if (location.trust_status === "blocked" || location.trust_status === "suspicious") {
    return jsonResponse({ error: "location_trust_too_low" }, 403);
  }

  const { data: createdUser, error: createUserError } = await adminClient.auth.admin.createUser({
    email: testEmail(),
    password: crypto.randomUUID(),
    email_confirm: true,
    user_metadata: { display_name: "Marta Test" }
  });
  if (createUserError || !createdUser.user) {
    return jsonResponse({ error: "test_user_create_failed", details: createUserError?.message }, 400);
  }

  const testUserId = createdUser.user.id;
  await adminClient.from("profiles").upsert({
    id: testUserId,
    display_name: "Marta Test",
    bio: "Profilo automatico per validare il flusso end-to-end.",
    reputation_score: 27
  }, { onConflict: "id" });

  await adminClient.from("user_locations").insert({
    user_id: testUserId,
    area_id: location.area_id,
    position: location.location_position,
    accuracy_meters: 20,
    captured_at: new Date().toISOString(),
    trust_score: 100,
    trust_status: "trusted",
    anomaly_flags: ["test_scenario_neighbor"]
  });

  const expiresAt = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();
  const { data: post, error: postError } = await adminClient.from("posts").insert({
    author_id: user.id,
    area_id: location.area_id,
    category: "question",
    body: "Test Paraggi end-to-end: post, commento, richiesta privata e chat.",
    position: location.location_position,
    expires_at: expiresAt
  }).select("id,body,created_at").single();
  if (postError) return jsonResponse({ error: "test_post_create_failed", details: postError.message }, 400);

  const { data: comment, error: commentError } = await adminClient.from("comments").insert({
    post_id: post.id,
    author_id: testUserId,
    body: "Sono Marta Test, commento pubblico creato dal self-test."
  }).select("id,body,created_at").single();
  if (commentError) return jsonResponse({ error: "test_comment_failed", details: commentError.message }, 400);

  await adminClient.from("posts").update({ comment_count: 1 }).eq("id", post.id);

  const { data: requestRow, error: requestError } = await adminClient.from("connection_requests").insert({
    post_id: post.id,
    comment_id: comment.id,
    requester_id: testUserId,
    recipient_id: user.id,
    status: "accepted",
    responded_at: new Date().toISOString(),
    message: "Richiesta test accettata automaticamente per aprire la chat."
  }).select("id,status,created_at").single();
  if (requestError) return jsonResponse({ error: "test_request_failed", details: requestError.message }, 400);

  const { data: chat, error: chatError } = await adminClient.from("private_chats").insert({
    connection_request_id: requestRow.id,
    user_a_id: testUserId,
    user_b_id: user.id,
    status: "active",
    radius_meters: 500,
    last_distance_meters: 0,
    last_status_reason: "test_scenario",
    last_message_at: new Date().toISOString()
  }).select("id,status,last_distance_meters").single();
  if (chatError) return jsonResponse({ error: "create_chat_failed", details: chatError.message }, 400);

  const { data: messages, error: messagesError } = await adminClient.from("private_messages").insert([
    {
      chat_id: chat.id,
      sender_id: testUserId,
      body: "Messaggio test da Marta: la chat privata e attiva."
    },
    {
      chat_id: chat.id,
      sender_id: user.id,
      body: "Risposta automatica: flusso end-to-end verificato."
    }
  ]).select("id,sender_id,body,created_at");
  if (messagesError) return jsonResponse({ error: "send_message_failed", details: messagesError.message }, 400);

  await adminClient.from("notifications").insert([
    {
      user_id: user.id,
      type: "comment_received",
      title: "Self-test commento",
      body: "Marta Test ha commentato il post di test.",
      deep_link: `/post/${post.id}`
    },
    {
      user_id: user.id,
      type: "request_accepted",
      title: "Self-test chat pronta",
      body: "La chat privata di test e stata aperta.",
      deep_link: `/chat/${chat.id}`
    }
  ]);

  await audit(adminClient, {
    actorId: user.id,
    eventType: "system",
    action: "run_test_scenario",
    targetTable: "private_chats",
    targetId: chat.id,
    metadata: { postId: post.id, commentId: comment.id, requestId: requestRow.id, testUserId }
  });

  return jsonResponse({
    post,
    comment,
    request: requestRow,
    chat,
    messages: messages ?? [],
    testUser: { id: testUserId, displayName: "Marta Test" }
  }, 201);
}));
