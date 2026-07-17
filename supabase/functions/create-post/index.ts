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
  const body = typeof payload.body === "string" ? payload.body.trim() : "";
  const categories = ["question", "information", "lost_item", "help", "event", "social", "emergency"];
  if (body.length < 1 || body.length > 160 || !categories.includes(payload.category)) {
    return jsonResponse({ error: "invalid_post_content" }, 400);
  }
  const attachments = payload.attachments ?? [];
  const ownedStoragePaths = attachments.flatMap((attachment) =>
    attachment.storagePath?.startsWith(`${user.id}/`) ? [attachment.storagePath] : []
  );
  const cleanupOwnedUploads = async () => {
    if (ownedStoragePaths.length > 0) await adminClient.storage.from("post-media").remove(ownedStoragePaths);
  };

  const invalidAttachment = attachments.some((attachment) => {
    if (attachment.kind === "location") {
      return typeof attachment.latitude !== "number" || typeof attachment.longitude !== "number"
        || !Number.isFinite(attachment.latitude) || !Number.isFinite(attachment.longitude)
        || Math.abs(attachment.latitude) > 90 || Math.abs(attachment.longitude) > 180;
    }
    return !attachment.storagePath?.startsWith(`${user.id}/`) || !attachment.mimeType;
  });
  if (attachments.length > 4 || invalidAttachment) {
    await cleanupOwnedUploads();
    return jsonResponse({ error: "invalid_attachments" }, 400);
  }

  const { data: location } = await adminClient.rpc("latest_trusted_location", { for_user_id: user.id }).single();
  if (!location) {
    await cleanupOwnedUploads();
    return jsonResponse({ error: "valid_location_required" }, 403);
  }
  if (location.trust_status === "blocked" || location.trust_status === "suspicious") {
    await cleanupOwnedUploads();
    return jsonResponse({ error: "location_trust_too_low" }, 403);
  }

  const expiresAt = new Date(Date.now() + payload.ttlMinutes * 60 * 1000).toISOString();
  const { data, error } = await adminClient.from("posts").insert({
    author_id: user.id,
    area_id: location.area_id,
    category: payload.category,
    body,
    position: location.location_position,
    expires_at: expiresAt
  }).select("id, category, body, expires_at, created_at").single();

  if (error) {
    await cleanupOwnedUploads();
    return jsonResponse({ error: "create_post_failed", details: error.message }, 400);
  }

  if (attachments.length > 0) {
    const rows = attachments.map((attachment) => ({
      post_id: data.id,
      author_id: user.id,
      kind: attachment.kind,
      storage_path: attachment.storagePath,
      mime_type: attachment.mimeType,
      duration_seconds: attachment.durationSeconds,
      label: attachment.label,
      approximate_position: attachment.kind === "location" && typeof attachment.latitude === "number" && typeof attachment.longitude === "number"
        ? `POINT(${attachment.longitude} ${attachment.latitude})`
        : undefined
    }));

    const { error: attachmentError } = await adminClient.from("post_attachments").insert(rows);
    if (attachmentError) {
      await adminClient.from("posts").delete().eq("id", data.id);
      await cleanupOwnedUploads();
      return jsonResponse({ error: "create_attachments_failed", details: attachmentError.message }, 400);
    }
  }

  if (payload.radiusMeters) {
    await adminClient.from("profiles").update({ search_radius_meters: payload.radiusMeters }).eq("id", user.id);
  }

  const { data: nearbyUsers } = await adminClient.rpc("nearby_users_for_post", { post_id_input: data.id });
  const recipientIds = Array.from(new Set((nearbyUsers ?? []).map((recipient) => recipient.user_id)));
  let pushedDevices = 0;
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
    const pushResult = await sendPushToUsers(adminClient, recipientIds, {
      title: "Nuovo post vicino",
      body,
      data: { type: "nearby_relevant_post", postId: data.id, deepLink }
    });
    pushedDevices = pushResult.sent;
  }

  await audit(adminClient, {
    actorId: user.id,
    eventType: "post",
    action: "create_post",
    targetTable: "posts",
    targetId: data.id,
    metadata: { notifiedUsers: recipientIds.length, pushedDevices }
  });
  return jsonResponse({ post: data, notifiedUsers: recipientIds.length, pushedDevices }, 201);
}));
