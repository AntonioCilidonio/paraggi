import { audit, jsonResponse, readJson, requireUser, withHttp } from "../_shared/http.ts";
import { sendPushToUsers } from "../_shared/push.ts";

type CreatePostPayload = {
  category: string;
  body: string;
  ttlMinutes: 30 | 180 | 1440;
  attachments?: Array<{
    kind: "image" | "video" | "audio" | "location";
    storagePath?: string;
    mimeType?: string;
    durationSeconds?: number;
    label?: string;
    latitude?: number;
    longitude?: number;
  }>;
  radiusMeters?: 100 | 500 | 1000 | 5000 | 30000 | 60000;
};

Deno.serve(await withHttp(async (req) => {
  const { user, adminClient } = await requireUser(req);
  const payload = await readJson<CreatePostPayload>(req);

  const { data: location } = await adminClient.rpc("latest_trusted_location", { for_user_id: user.id }).single();
  if (!location) return jsonResponse({ error: "valid_location_required" }, 403);
  if (location.trust_status === "blocked" || location.trust_status === "suspicious") {
    return jsonResponse({ error: "location_trust_too_low" }, 403);
  }

  const expiresAt = new Date(Date.now() + payload.ttlMinutes * 60 * 1000).toISOString();
  const { data, error } = await adminClient.from("posts").insert({
    author_id: user.id,
    area_id: location.area_id,
    category: payload.category,
    body: payload.body,
    position: location.location_position,
    expires_at: expiresAt
  }).select("id, category, body, expires_at, created_at").single();

  if (error) return jsonResponse({ error: "create_post_failed", details: error.message }, 400);

  const attachments = payload.attachments ?? [];
  if (attachments.length > 0) {
    const rows = attachments.map((attachment) => ({
      post_id: data.id,
      author_id: user.id,
      kind: attachment.kind,
      storage_path: attachment.storagePath,
      mime_type: attachment.mimeType,
      duration_seconds: attachment.durationSeconds,
      label: attachment.label,
      approximate_position: attachment.kind === "location" && attachment.latitude && attachment.longitude
        ? `POINT(${attachment.longitude} ${attachment.latitude})`
        : undefined
    }));

    const { error: attachmentError } = await adminClient.from("post_attachments").insert(rows);
    if (attachmentError) return jsonResponse({ error: "create_attachments_failed", details: attachmentError.message }, 400);
  }

  if (payload.radiusMeters) {
    await adminClient.from("profiles").update({ search_radius_meters: payload.radiusMeters }).eq("id", user.id);
  }

  const { data: nearbyUsers } = await adminClient.rpc("nearby_users_for_post", { post_id_input: data.id });
  const recipientIds = Array.from(new Set((nearbyUsers ?? []).map((recipient) => recipient.user_id)));
  if (recipientIds.length > 0) {
    const deepLink = `/post/${data.id}`;
    const { data: author } = await adminClient.from("profiles").select("display_name").eq("id", user.id).maybeSingle();
    const body = `${author?.display_name ?? "Una persona vicina"} ha pubblicato qualcosa nel tuo raggio.`;
    await adminClient.from("notifications").insert(recipientIds.map((recipientId) => ({
      user_id: recipientId,
      type: "nearby_relevant_post",
      title: "Nuovo post vicino",
      body,
      deep_link: deepLink
    })));
    await sendPushToUsers(adminClient, recipientIds, {
      title: "Nuovo post vicino",
      body,
      data: { type: "nearby_relevant_post", postId: data.id, deepLink }
    });
  }

  await audit(adminClient, { actorId: user.id, eventType: "post", action: "create_post", targetTable: "posts", targetId: data.id });
  return jsonResponse({ post: data, notifiedUsers: recipientIds.length }, 201);
}));
