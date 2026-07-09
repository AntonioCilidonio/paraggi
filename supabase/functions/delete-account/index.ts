import { audit, jsonResponse, requireUser, withHttp } from "../_shared/http.ts";

Deno.serve(await withHttp(async (req) => {
  const { user, adminClient } = await requireUser(req);

  await audit(adminClient, {
    actorId: user.id,
    eventType: "privacy",
    action: "delete_account_requested",
    targetTable: "profiles",
    targetId: user.id
  });

  await adminClient.from("profiles").update({
    status: "deleted",
    display_name: "Utente eliminato",
    bio: "",
    avatar_path: null,
    is_shadow_banned: true
  }).eq("id", user.id);

  const { error } = await adminClient.auth.admin.deleteUser(user.id);
  if (error) return jsonResponse({ error: "auth_delete_failed", details: error.message }, 400);

  return jsonResponse({ ok: true });
}));

