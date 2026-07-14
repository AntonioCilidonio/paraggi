import { audit, jsonResponse, readJson, requireUser, withHttp } from "../_shared/http.ts";
import { sendPushToUsers } from "../_shared/push.ts";

type Payload = {
  latitude: number;
  longitude: number;
  accuracyMeters?: number;
  radiusMeters?: 100 | 500 | 1000 | 5000 | 30000 | 60000;
  message?: string;
  sharePreciseCoordinates?: boolean;
};

Deno.serve(await withHttp(async (req) => {
  const { user, adminClient } = await requireUser(req);
  const payload = await readJson<Payload>(req);
  const radiusMeters = payload.radiusMeters ?? 500;
  const sharePreciseCoordinates = payload.sharePreciseCoordinates ?? true;
  const message = payload.message ?? "Richiesta urgente di aiuto nelle vicinanze";

  if (!Number.isFinite(payload.latitude) || !Number.isFinite(payload.longitude)) {
    return jsonResponse({ error: "invalid_coordinates" }, 400);
  }

  const { data: alert, error: alertError } = await adminClient.from("danger_alerts").insert({
    user_id: user.id,
    position: `POINT(${payload.longitude} ${payload.latitude})`,
    accuracy_meters: payload.accuracyMeters,
    radius_meters: radiusMeters,
    message,
    share_precise_coordinates: sharePreciseCoordinates
  }).select("id,created_at").single();

  if (alertError) return jsonResponse({ error: "danger_alert_failed", details: alertError.message }, 400);

  const { data: recipients, error: recipientsError } = await adminClient.rpc("nearby_users_for_point", {
    actor_user_id: user.id,
    latitude: payload.latitude,
    longitude: payload.longitude,
    radius_meters: radiusMeters
  });
  if (recipientsError) return jsonResponse({ error: "recipients_failed", details: recipientsError.message }, 400);

  const body = sharePreciseCoordinates
    ? `${message}. Coordinate: ${payload.latitude.toFixed(6)}, ${payload.longitude.toFixed(6)}`
    : `${message}. Apri Paraggi per vedere l'area approssimativa.`;

  const recipientIds = Array.from(new Set((recipients ?? []).map((recipient) => recipient.user_id)));
  const deepLink = `/danger/${alert.id}`;
  const rows = recipientIds.map((recipientId) => ({
    user_id: recipientId,
    type: "danger_alert",
    title: "Allarme pericolo vicino",
    body,
    deep_link: deepLink
  }));

  if (rows.length > 0) await adminClient.from("notifications").insert(rows);

  await sendPushToUsers(adminClient, recipientIds, {
    title: "Allarme pericolo vicino",
    body,
    channelId: "paraggi-alerts",
    data: {
      type: "danger_alert",
      alertId: alert.id,
      deepLink,
      latitude: sharePreciseCoordinates ? payload.latitude : undefined,
      longitude: sharePreciseCoordinates ? payload.longitude : undefined
    }
  });

  await audit(adminClient, {
    actorId: user.id,
    eventType: "security",
    action: "trigger_danger_alert",
    targetTable: "danger_alerts",
    targetId: alert.id,
    metadata: { radiusMeters, recipientCount: rows.length, sharePreciseCoordinates }
  });

  return jsonResponse({ alert, recipientCount: rows.length });
}));
