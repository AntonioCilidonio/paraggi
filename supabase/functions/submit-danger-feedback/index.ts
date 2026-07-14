import { audit, jsonResponse, readJson, requireUser, withHttp } from "../_shared/http.ts";

type Payload = {
  alertId: string;
  verdict: "helpful" | "false_alarm";
};

Deno.serve(await withHttp(async (req) => {
  const { user, adminClient } = await requireUser(req);
  const payload = await readJson<Payload>(req);
  if (!payload.alertId || !["helpful", "false_alarm"].includes(payload.verdict)) {
    return jsonResponse({ error: "invalid_danger_feedback" }, 400);
  }

  const { data: visibleAlert } = await adminClient.rpc("get_visible_danger_alert", {
    alert_id_input: payload.alertId,
    viewer_user_id: user.id
  }).maybeSingle();
  if (!visibleAlert) return jsonResponse({ error: "danger_alert_not_visible" }, 404);

  const { data: alert } = await adminClient
    .from("danger_alerts")
    .select("id,user_id,moderation_status,penalty_applied_at,reward_applied_at")
    .eq("id", payload.alertId)
    .single();
  if (!alert) return jsonResponse({ error: "danger_alert_not_visible" }, 404);
  if (alert.user_id === user.id) return jsonResponse({ error: "cannot_review_own_sos" }, 400);

  const { error: feedbackError } = await adminClient.from("danger_alert_feedback").upsert({
    alert_id: payload.alertId,
    reporter_id: user.id,
    verdict: payload.verdict,
    updated_at: new Date().toISOString()
  }, { onConflict: "alert_id,reporter_id" });
  if (feedbackError) return jsonResponse({ error: "danger_feedback_failed", details: feedbackError.message }, 400);

  const { data: feedbackRows } = await adminClient
    .from("danger_alert_feedback")
    .select("verdict")
    .eq("alert_id", payload.alertId);
  const helpfulCount = (feedbackRows ?? []).filter((item) => item.verdict === "helpful").length;
  const falseAlarmCount = (feedbackRows ?? []).filter((item) => item.verdict === "false_alarm").length;

  let blockedUntil: string | null = null;
  if (falseAlarmCount >= 2 && !alert.penalty_applied_at) {
    const now = new Date().toISOString();
    const { data: penalizedAlert } = await adminClient.from("danger_alerts").update({
      active: false,
      resolved_at: now,
      moderation_status: "false_alarm",
      penalty_applied_at: now
    }).eq("id", payload.alertId).is("penalty_applied_at", null).select("id").maybeSingle();

    if (penalizedAlert) {
      const { data: profile } = await adminClient.from("profiles")
        .select("sos_false_alarm_strikes")
        .eq("id", alert.user_id)
        .single();
      const strikes = (profile?.sos_false_alarm_strikes ?? 0) + 1;
      const blockHours = strikes > 1 ? 72 : 24;
      blockedUntil = new Date(Date.now() + blockHours * 60 * 60 * 1000).toISOString();
      await adminClient.from("profiles").update({
        sos_false_alarm_strikes: strikes,
        sos_blocked_until: blockedUntil
      }).eq("id", alert.user_id);
      await adminClient.rpc("adjust_reputation", { user_id_input: alert.user_id, delta_input: -10 });
      await adminClient.from("reputation_events").insert({
        user_id: alert.user_id,
        delta: -10,
        reason: "sos_false_alarm_confirmed"
      });
    }
  } else if (helpfulCount >= 2 && alert.moderation_status === "unreviewed" && !alert.reward_applied_at) {
    const now = new Date().toISOString();
    const { data: rewardedAlert } = await adminClient.from("danger_alerts").update({
      moderation_status: "confirmed_helpful",
      reward_applied_at: now
    }).eq("id", payload.alertId).is("reward_applied_at", null).eq("moderation_status", "unreviewed").select("id").maybeSingle();
    if (rewardedAlert) {
      await adminClient.rpc("adjust_reputation", { user_id_input: alert.user_id, delta_input: 3 });
      await adminClient.from("reputation_events").insert({
        user_id: alert.user_id,
        delta: 3,
        reason: "sos_helpful_confirmed"
      });
    }
  }

  await audit(adminClient, {
    actorId: user.id,
    eventType: "moderation",
    action: `danger_feedback_${payload.verdict}`,
    targetTable: "danger_alerts",
    targetId: payload.alertId,
    metadata: { helpfulCount, falseAlarmCount, blockedUntil }
  });

  return jsonResponse({ verdict: payload.verdict, helpfulCount, falseAlarmCount, blockedUntil });
}));
