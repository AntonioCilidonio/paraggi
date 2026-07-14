import { jsonResponse, requireUser, withHttp } from "../_shared/http.ts";

Deno.serve(await withHttp(async (req) => {
  const { user, adminClient } = await requireUser(req);
  const alertId = new URL(req.url).searchParams.get("alertId");
  if (!alertId) return jsonResponse({ error: "missing_alert_id" }, 400);

  const { data, error } = await adminClient.rpc("get_visible_danger_alert", {
    alert_id_input: alertId,
    viewer_user_id: user.id
  }).maybeSingle();

  if (error) return jsonResponse({ error: "danger_alert_failed", details: error.message }, 400);
  if (!data) return jsonResponse({ error: "danger_alert_not_visible" }, 404);
  return jsonResponse({ alert: data });
}));
