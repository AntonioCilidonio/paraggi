import { audit, jsonResponse, readJson, requireUser, withHttp } from "../_shared/http.ts";

type Payload = {
  blockedUserId: string;
};

Deno.serve(await withHttp(async (req) => {
  const { user, adminClient } = await requireUser(req);
  const payload = await readJson<Payload>(req);

  if (payload.blockedUserId === user.id) return jsonResponse({ error: "cannot_block_self" }, 400);

  const { error } = await adminClient.from("user_blocks").upsert({
    blocker_id: user.id,
    blocked_id: payload.blockedUserId
  });

  if (error) return jsonResponse({ error: "block_failed", details: error.message }, 400);
  await audit(adminClient, { actorId: user.id, eventType: "moderation", action: "block_user", targetTable: "profiles", targetId: payload.blockedUserId });
  return jsonResponse({ ok: true });
}));

