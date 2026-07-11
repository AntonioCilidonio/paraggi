import { audit, jsonResponse, readJson, requireUser, withHttp } from "../_shared/http.ts";

type Payload = {
  postId: string;
};

function testEmail() {
  return `paraggi-test-${crypto.randomUUID()}@paraggi.local`;
}

Deno.serve(await withHttp(async (req) => {
  const { user, adminClient } = await requireUser(req);
  const payload = await readJson<Payload>(req);

  const { data: post, error: postError } = await adminClient
    .from("posts")
    .select("id,author_id,status,expires_at,area_id")
    .eq("id", payload.postId)
    .single();
  if (postError || !post || post.author_id !== user.id || post.status !== "active" || new Date(post.expires_at).getTime() <= Date.now()) {
    return jsonResponse({ error: "test_post_not_available" }, 400);
  }

  const { data: location } = await adminClient.rpc("latest_trusted_location", { for_user_id: user.id }).single();
  if (!location) return jsonResponse({ error: "valid_location_required" }, 403);

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
    bio: "Profilo automatico per testare interazioni e chat.",
    reputation_score: 27
  }, { onConflict: "id" });

  await adminClient.from("user_locations").insert({
    user_id: testUserId,
    area_id: location.area_id,
    position: location.location_position,
    accuracy_meters: 25,
    captured_at: new Date().toISOString(),
    trust_score: 100,
    trust_status: "trusted",
    anomaly_flags: ["test_neighbor"]
  });

  const { data: comment, error: commentError } = await adminClient.from("comments").insert({
    post_id: payload.postId,
    author_id: testUserId,
    body: "Ciao, sono qui vicino. Possiamo continuare in privato?"
  }).select("id,post_id,author_id,body,created_at").single();
  if (commentError) return jsonResponse({ error: "test_comment_failed", details: commentError.message }, 400);

  await adminClient.from("posts").update({ comment_count: 1 }).eq("id", payload.postId);

  const { data: requestRow, error: requestError } = await adminClient.from("connection_requests").insert({
    post_id: payload.postId,
    comment_id: comment.id,
    requester_id: testUserId,
    recipient_id: user.id,
    message: "Sono Marta Test, accetta per provare la chat privata."
  }).select("id,status,created_at").single();
  if (requestError) return jsonResponse({ error: "test_request_failed", details: requestError.message }, 400);

  await adminClient.from("notifications").insert([
    {
      user_id: user.id,
      type: "comment_received",
      title: "Nuovo commento vicino",
      body: "Marta Test ha commentato il tuo post.",
      deep_link: `/post/${payload.postId}`
    },
    {
      user_id: user.id,
      type: "private_request",
      title: "Richiesta privata",
      body: "Marta Test vuole aprire una chat contestuale.",
      deep_link: "/requests"
    }
  ]);

  await audit(adminClient, {
    actorId: user.id,
    eventType: "system",
    action: "create_test_interaction",
    targetTable: "connection_requests",
    targetId: requestRow.id,
    metadata: { testUserId, postId: payload.postId }
  });

  return jsonResponse({ comment, request: requestRow, testUser: { id: testUserId, displayName: "Marta Test" } }, 201);
}));
