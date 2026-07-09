import { audit, jsonResponse, readJson, requireUser, withHttp } from "../_shared/http.ts";

type Payload = {
  targetType: "user" | "post" | "comment" | "message";
  targetId: string;
  reason: string;
  details?: string;
};

Deno.serve(await withHttp(async (req) => {
  const { user, adminClient } = await requireUser(req);
  const payload = await readJson<Payload>(req);

  const { data, error } = await adminClient.from("reports").insert({
    reporter_id: user.id,
    target_type: payload.targetType,
    target_id: payload.targetId,
    reason: payload.reason,
    details: payload.details ?? ""
  }).select("id, status, created_at").single();

  if (error) return jsonResponse({ error: "report_failed", details: error.message }, 400);
  await audit(adminClient, { actorId: user.id, eventType: "moderation", action: "report_content", targetTable: "reports", targetId: data.id });
  return jsonResponse({ report: data }, 201);
}));

