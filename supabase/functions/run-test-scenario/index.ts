import { audit, HttpError, jsonResponse, readJson, requireUser, withHttp } from "../_shared/http.ts";
import { getOrCreateTestPersona, resetTestPersonaPassword } from "../_shared/test-persona.ts";

type Payload = {
  latitude: number;
  longitude: number;
};

type Check = {
  name: string;
  status: "passed";
};

function currentToken(req: Request) {
  return (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
}

Deno.serve(await withHttp(async (req) => {
  const { user, adminClient } = await requireUser(req);
  const payload = await readJson<Payload>(req);
  const checks: Check[] = [];
  const scenarioStartedAt = new Date().toISOString();

  if (!Number.isFinite(payload.latitude) || !Number.isFinite(payload.longitude)
    || Math.abs(payload.latitude) > 90 || Math.abs(payload.longitude) > 180) {
    return jsonResponse({ error: "invalid_coordinates" }, 400);
  }

  const { data: location } = await adminClient.rpc("latest_trusted_location", { for_user_id: user.id }).single();
  if (!location) return jsonResponse({ error: "valid_location_required" }, 403);
  if (location.trust_status === "blocked" || location.trust_status === "suspicious") {
    return jsonResponse({ error: "location_trust_too_low" }, 403);
  }

  const { data: rateLimitAllowed, error: rateLimitError } = await adminClient.rpc("consume_rate_limit", {
    key_input: `e2e:${user.id}`,
    action_input: "run_test_scenario",
    limit_input: 5,
    window_seconds: 3600
  });
  if (rateLimitError) return jsonResponse({ error: "test_rate_limit_failed", details: rateLimitError.message }, 500);
  if (!rateLimitAllowed) return jsonResponse({ error: "test_rate_limit_exceeded" }, 429);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const callerToken = currentToken(req);
  if (!supabaseUrl || !anonKey || !callerToken) throw new HttpError(500, "test_environment_missing");

  async function invoke<T>(name: string, token: string, options: {
    method?: "GET" | "POST";
    body?: unknown;
    query?: Record<string, string | number>;
  } = {}): Promise<T> {
    const query = options.query ? `?${new URLSearchParams(Object.entries(options.query).map(([key, value]) => [key, String(value)])).toString()}` : "";
    const response = await fetch(`${supabaseUrl}/functions/v1/${name}${query}`, {
      method: options.method ?? "POST",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body)
    });
    const text = await response.text();
    let data: unknown = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { raw: text.slice(0, 500) };
    }
    if (!response.ok || (data && typeof data === "object" && "error" in data)) {
      throw new HttpError(502, "nested_function_failed", { functionName: name, status: response.status, response: data });
    }
    return data as T;
  }

  async function runStep<T>(name: string, action: () => Promise<T>, verify?: (value: T) => boolean): Promise<T> {
    try {
      const value = await action();
      if (verify && !verify(value)) throw new Error("verification_failed");
      checks.push({ name, status: "passed" });
      return value;
    } catch (error) {
      throw new HttpError(502, "test_step_failed", {
        step: name,
        cause: error instanceof Error ? error.message : String(error),
        details: error instanceof HttpError ? error.details : undefined,
        passedChecks: checks
      });
    }
  }

  const persona = await getOrCreateTestPersona(adminClient, user.id);
  const email = persona.email;
  const password = await resetTestPersonaPassword(adminClient, persona.id);
  checks.push({ name: "create_test_user", status: "passed" });
  const testUserId = persona.id;

  await adminClient.from("profiles").update({
    display_name: "Marta Test",
    bio: "Profilo automatico per validare il flusso end-to-end.",
    reputation_score: 27
  }).eq("id", testUserId);

  const authResponse = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: anonKey, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });
  const authData = await authResponse.json() as { access_token?: string; error_description?: string };
  if (!authResponse.ok || !authData.access_token) {
    throw new HttpError(502, "test_user_login_failed", { details: authData.error_description });
  }
  checks.push({ name: "login_test_user", status: "passed" });
  const testToken = authData.access_token;

  const participantPair = [testUserId, user.id].sort().join(":");
  await adminClient
    .from("private_chats")
    .update({
      is_connected: false,
      status: "frozen_permission",
      disconnected_at: new Date().toISOString(),
      disconnected_by_id: user.id,
      last_status_reason: "self_test_reset"
    })
    .eq("participant_pair", participantPair)
    .eq("is_connected", true);
  await adminClient
    .from("connection_requests")
    .update({ status: "rejected", responded_at: new Date().toISOString() })
    .eq("status", "pending")
    .or(`and(requester_id.eq.${testUserId},recipient_id.eq.${user.id}),and(requester_id.eq.${user.id},recipient_id.eq.${testUserId})`);

  await runStep("sync_test_user_location", () => invoke("update-location", testToken, {
    body: {
      latitude: payload.latitude,
      longitude: payload.longitude,
      accuracyMeters: 10,
      capturedAt: new Date().toISOString(),
      areaName: "Area test Paraggi",
      city: "Test locale",
      countryCode: "IT",
      device: { isEmulator: false, isRootedOrJailbroken: false }
    }
  }));

  const createdPost = await runStep<{ post: { id: string; body: string; created_at: string } }>("create_post_api", () => invoke("create-post", callerToken, {
    body: {
      category: "question",
      body: "Test Paraggi end-to-end: post, commento, richiesta privata e chat.",
      ttlMinutes: 180
    }
  }), (value) => Boolean(value.post?.id));
  const postId = createdPost.post.id;

  await runStep<{ posts: Array<{ id: string }> }>("nearby_feed_api", () => invoke("get-nearby-feed", testToken, {
    method: "GET",
    query: { radiusMeters: 500, limit: 30 }
  }), (value) => value.posts.some((post) => post.id === postId));

  await runStep<{ post: { id: string }; comments: unknown[] }>("post_detail_before_comment", () => invoke("get-post-detail", testToken, {
    method: "GET",
    query: { postId, radiusMeters: 500 }
  }), (value) => value.post?.id === postId);

  const createdComment = await runStep<{ comment: { id: string } }>("create_comment_api", () => invoke("create-comment", testToken, {
    body: { postId, body: "Sono Marta Test, commento pubblico creato dal self-test." }
  }), (value) => Boolean(value.comment?.id));
  const commentId = createdComment.comment.id;

  await runStep<{ post: { id: string }; comments: Array<{ id: string }> }>("post_detail_after_comment", () => invoke("get-post-detail", callerToken, {
    method: "GET",
    query: { postId, radiusMeters: 500 }
  }), (value) => value.comments.some((comment) => comment.id === commentId));

  const createdRequest = await runStep<{ request: { id: string; status: string } }>("request_connection_api", () => invoke("request-connection", testToken, {
    body: {
      postId,
      commentId,
      recipientId: user.id,
      message: "Richiesta test per aprire una chat contestuale."
    }
  }), (value) => value.request?.status === "pending");
  const requestId = createdRequest.request.id;

  await runStep<{ requests: Array<{ id: string }>; chats: unknown[] }>("recipient_inbox_request", () => invoke("get-chat-inbox", callerToken, { method: "GET" }),
    (value) => value.requests.some((request) => request.id === requestId));

  const accepted = await runStep<{ status: string; chat: { id: string } }>("accept_connection_api", () => invoke("respond-connection", callerToken, {
    body: { requestId, accept: true, radiusMeters: 500 }
  }), (value) => value.status === "accepted" && Boolean(value.chat?.id));
  const chatId = accepted.chat.id;

  await runStep<{ requests: unknown[]; chats: Array<{ id: string }> }>("requester_inbox_chat", () => invoke("get-chat-inbox", testToken, { method: "GET" }),
    (value) => value.chats.some((chat) => chat.id === chatId));

  await runStep("send_message_test_user", () => invoke("send-private-message", testToken, {
    body: { chatId, body: "Messaggio reale da Marta Test." }
  }));
  await runStep("send_message_current_user", () => invoke("send-private-message", callerToken, {
    body: { chatId, body: "Risposta reale dell'utente corrente." }
  }));

  const thread = await runStep<{ chat: { id: string; status: string }; messages: Array<{ id: string; sender_id: string; body: string }> }>("read_chat_messages_api",
    () => invoke("get-chat-messages", callerToken, { method: "GET", query: { chatId } }),
    (value) => value.chat?.id === chatId && value.chat.status === "active" && value.messages.length >= 2);

  const [{ count: callerNotifications }, { count: testNotifications }, { count: pushTokens }] = await Promise.all([
    adminClient.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", user.id).gte("created_at", scenarioStartedAt),
    adminClient.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", testUserId).gte("created_at", scenarioStartedAt),
    adminClient.from("push_tokens").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("enabled", true)
  ]);
  if ((callerNotifications ?? 0) < 2 || (testNotifications ?? 0) < 1) {
    throw new HttpError(502, "test_step_failed", { step: "notification_rows", callerNotifications, testNotifications, passedChecks: checks });
  }
  checks.push({ name: "notification_rows", status: "passed" });

  await audit(adminClient, {
    actorId: user.id,
    eventType: "system",
    action: "run_test_scenario",
    targetTable: "private_chats",
    targetId: chatId,
    metadata: { postId, commentId, requestId, testUserId, checks: checks.map((check) => check.name), pushTokenReady: (pushTokens ?? 0) > 0 }
  });

  return jsonResponse({
    passed: true,
    checks,
    post: createdPost.post,
    comment: createdComment.comment,
    request: createdRequest.request,
    chat: { ...thread.chat, id: chatId },
    messages: thread.messages,
    notifications: {
      currentUser: callerNotifications ?? 0,
      testUser: testNotifications ?? 0,
      remotePushReady: (pushTokens ?? 0) > 0
    },
    testUser: { id: testUserId, displayName: "Marta Test" }
  }, 201);
}));
