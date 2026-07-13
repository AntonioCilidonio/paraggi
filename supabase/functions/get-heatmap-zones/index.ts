import { jsonResponse, requireUser, withHttp } from "../_shared/http.ts";

type LatestLocationRow = {
  location_id: string;
};

Deno.serve(await withHttp(async (req) => {
  const { user, adminClient } = await requireUser(req);
  const url = new URL(req.url);
  const requestedRadius = Number(url.searchParams.get("radiusMeters") ?? "1000");
  const radiusMeters = [100, 500, 1000, 5000].includes(requestedRadius) ? requestedRadius : 1000;

  const { data: latestLocations, error: locationError } = await adminClient
    .rpc("latest_trusted_location", { for_user_id: user.id });

  if (locationError) {
    return jsonResponse({ error: "heatmap_failed", details: locationError.message }, 400);
  }

  if (!(latestLocations as LatestLocationRow[] | null)?.length) {
    return jsonResponse({ zones: [], needsLocation: true, radiusMeters });
  }

  const { data, error } = await adminClient
    .rpc("get_heatmap_zones", {
      for_user_id: user.id,
      radius_meters: radiusMeters
    });

  if (error) return jsonResponse({ error: "heatmap_failed", details: error.message }, 400);

  return jsonResponse({
    zones: data ?? [],
    needsLocation: false,
    radiusMeters
  });
}));
