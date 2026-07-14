import { audit, jsonResponse, readJson, requireUser, withHttp } from "../_shared/http.ts";

type Payload = {
  expoPushToken: string;
  platform: "ios" | "android" | "web";
  installationId: string;
  appVersion?: string;
  osVersion?: string;
  isEmulator?: boolean;
  isRootedOrJailbroken?: boolean;
};

Deno.serve(await withHttp(async (req) => {
  const { user, adminClient } = await requireUser(req);
  const payload = await readJson<Payload>(req);

  const { data: device, error: deviceError } = await adminClient.from("devices").upsert({
    user_id: user.id,
    platform: payload.platform,
    installation_id: payload.installationId,
    app_version: payload.appVersion,
    os_version: payload.osVersion,
    is_emulator: payload.isEmulator ?? false,
    is_rooted_or_jailbroken: payload.isRootedOrJailbroken ?? false,
    last_seen_at: new Date().toISOString()
  }, { onConflict: "user_id,installation_id" }).select("id").single();

  if (deviceError) return jsonResponse({ error: "device_register_failed", details: deviceError.message }, 400);

  const { data, error } = await adminClient.from("push_tokens").upsert({
    user_id: user.id,
    device_id: device.id,
    expo_push_token: payload.expoPushToken,
    enabled: true
  }, { onConflict: "expo_push_token" }).select("id").single();

  if (error) return jsonResponse({ error: "push_token_register_failed", details: error.message }, 400);
  await adminClient.from("profiles").update({ notification_consent_at: new Date().toISOString() }).eq("id", user.id);
  await audit(adminClient, { actorId: user.id, eventType: "system", action: "register_push_token", targetTable: "push_tokens", targetId: data.id });
  return jsonResponse({ pushToken: data });
}));
