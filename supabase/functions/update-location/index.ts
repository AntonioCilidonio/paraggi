import { audit, jsonResponse, readJson, requireUser, withHttp } from "../_shared/http.ts";
import { calculateLocationTrust, type LocationPayload } from "../_shared/location.ts";

Deno.serve(await withHttp(async (req) => {
  const { user, adminClient } = await requireUser(req);
  const payload = await readJson<LocationPayload & { deviceId?: string; areaId?: string }>(req);
  const trust = calculateLocationTrust(payload);

  const { data, error } = await adminClient.from("user_locations").insert({
    user_id: user.id,
    device_id: payload.deviceId,
    area_id: payload.areaId,
    position: `POINT(${payload.longitude} ${payload.latitude})`,
    accuracy_meters: payload.accuracyMeters,
    altitude_meters: payload.altitudeMeters,
    speed_mps: payload.speedMps,
    heading_degrees: payload.headingDegrees,
    captured_at: payload.capturedAt,
    trust_score: trust.score,
    trust_status: trust.status,
    anomaly_flags: trust.flags
  }).select("id, area_id, trust_score, trust_status, captured_at").single();

  if (error) return jsonResponse({ error: "location_insert_failed", details: error.message }, 400);

  if (payload.areaId) {
    await adminClient.from("area_history").upsert({
      user_id: user.id,
      area_id: payload.areaId,
      last_seen_at: new Date().toISOString()
    }, { onConflict: "user_id,area_id" });
  }

  await audit(adminClient, {
    actorId: user.id,
    eventType: "location",
    action: "update_location",
    targetTable: "user_locations",
    targetId: data.id,
    metadata: { trust }
  });

  return jsonResponse({ location: data, trust });
}));

