import { audit, jsonResponse, readJson, requireUser, withHttp } from "../_shared/http.ts";
import { calculateLocationTrust, type LocationPayload } from "../_shared/location.ts";

Deno.serve(await withHttp(async (req) => {
  const { user, adminClient } = await requireUser(req);
  const payload = await readJson<LocationPayload & {
    deviceId?: string;
    areaId?: string;
    areaName?: string;
    city?: string;
    countryCode?: string;
    placeLabel?: string;
  }>(req);
  const trust = calculateLocationTrust(payload);
  const emailName = user.email?.split("@")[0] || "Utente";
  const displayName = emailName.length >= 2 ? emailName.slice(0, 40) : "Utente";

  await adminClient.from("profiles").upsert({
    id: user.id,
    display_name: displayName
  }, { onConflict: "id", ignoreDuplicates: true });

  let areaId = payload.areaId;
  if (!areaId) {
    const roundedLatitude = Math.round(payload.latitude * 100) / 100;
    const roundedLongitude = Math.round(payload.longitude * 100) / 100;
    const geohash = `${roundedLatitude.toFixed(2)}:${roundedLongitude.toFixed(2)}`;
    const areaName = payload.areaName || payload.city || "Area vicina";
    const normalizeAreaPart = (value?: string) => (value ?? "").trim().replace(/\s+/g, " ").toLocaleLowerCase("it-IT");
    const canonicalKey = `${normalizeAreaPart(areaName)}|${normalizeAreaPart(payload.city)}|${(payload.countryCode || "IT").toUpperCase()}`;

    const { data: canonicalArea } = await adminClient
      .from("areas")
      .select("id,name,city")
      .eq("canonical_key", canonicalKey)
      .maybeSingle();

    const { data: geohashArea } = canonicalArea?.id
      ? { data: null }
      : await adminClient
        .from("areas")
        .select("id,name,city")
        .eq("geohash", geohash)
        .maybeSingle();
    const area = canonicalArea ?? geohashArea;

    if (area?.id) {
      areaId = area.id;
      const hasWeakName = /^\s*\d+[a-z]?\s*$/i.test(area.name ?? "") || (area.name ?? "").toLowerCase() === "area vicina";
      if (hasWeakName && areaName !== "Area vicina") {
        await adminClient.from("areas").update({
          name: areaName,
          city: payload.city ?? area.city,
          place_label: payload.placeLabel
        }).eq("id", area.id);
      }
    } else {
      const { data: createdArea, error: createAreaError } = await adminClient.from("areas").insert({
        name: areaName,
        city: payload.city,
        country_code: payload.countryCode || "IT",
        place_label: payload.placeLabel,
        centroid: `POINT(${payload.longitude} ${payload.latitude})`,
        geohash
      }).select("id").single();

      if (createAreaError?.code === "23505") {
        const { data: existingArea } = await adminClient
          .from("areas")
          .select("id")
          .eq("canonical_key", canonicalKey)
          .single();
        areaId = existingArea?.id;
      } else {
        areaId = createdArea?.id;
      }
    }
  }

  const { data, error } = await adminClient.from("user_locations").insert({
    user_id: user.id,
    device_id: payload.deviceId,
    area_id: areaId,
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

  if (areaId) {
    await adminClient.from("area_history").upsert({
      user_id: user.id,
      area_id: areaId,
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
