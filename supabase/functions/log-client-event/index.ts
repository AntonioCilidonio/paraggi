import { getSupabase, jsonResponse, readJson, withHttp } from "../_shared/http.ts";

type ClientEventPayload = {
  severity?: "debug" | "info" | "warning" | "error" | "fatal";
  source?: string;
  message?: string;
  stack?: string;
  context?: Record<string, unknown>;
  appVersion?: string;
  platform?: string;
  deviceModel?: string;
  osVersion?: string;
};

Deno.serve(await withHttp(async (req) => {
  const { userClient, adminClient } = getSupabase(req);
  const payload = await readJson<ClientEventPayload>(req);
  const { data } = await userClient.auth.getUser();

  const message = (payload.message ?? "Unknown client event").slice(0, 1000);
  const source = (payload.source ?? "mobile").slice(0, 80);
  const severity = payload.severity ?? "error";

  const { error } = await adminClient.from("client_error_events").insert({
    user_id: data.user?.id,
    severity,
    source,
    message,
    stack: payload.stack,
    context: payload.context ?? {},
    app_version: payload.appVersion,
    platform: payload.platform,
    device_model: payload.deviceModel,
    os_version: payload.osVersion
  });

  if (error) return jsonResponse({ error: "client_event_insert_failed", details: error.message }, 400);
  return jsonResponse({ ok: true }, 201);
}));
