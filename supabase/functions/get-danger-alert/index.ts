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
  const { data: alertOwner } = await adminClient.from("danger_alerts").select("user_id,moderation_status").eq("id", alertId).single();
  const { data: feedbackRows } = await adminClient.from("danger_alert_feedback").select("reporter_id,verdict").eq("alert_id", alertId);
  return jsonResponse({
    alert: {
      ...data,
      moderation_status: alertOwner?.moderation_status ?? "unreviewed",
      viewer_is_author: alertOwner?.user_id === user.id,
      viewer_feedback: (feedbackRows ?? []).find((item) => item.reporter_id === user.id)?.verdict ?? null,
      helpful_count: (feedbackRows ?? []).filter((item) => item.verdict === "helpful").length,
      false_alarm_count: (feedbackRows ?? []).filter((item) => item.verdict === "false_alarm").length
    }
  });
}));
