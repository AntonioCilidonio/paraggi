import {
  audit,
  jsonResponse,
  readJson,
  requireUser,
  withHttp,
} from "../_shared/http.ts";
import { sendPushToUsers } from "../_shared/push.ts";

type Payload = {
  chatId: string;
  body?: string;
  attachment?: {
    kind: "image" | "video" | "audio";
    storagePath: string;
    mimeType?: string;
    durationSeconds?: number;
    label?: string;
  };
};

Deno.serve(
  await withHttp(async (req) => {
    const { user, adminClient } = await requireUser(req);
    const payload = await readJson<Payload>(req);
    const body = payload.body?.trim() ?? "";
    if (!payload.chatId)
      return jsonResponse({ error: "chat_id_required" }, 400);
    if (!body && !payload.attachment)
      return jsonResponse({ error: "message_content_required" }, 400);
    if (body.length > 2000)
      return jsonResponse({ error: "message_too_long" }, 400);

    const { data: connectedChat } = await adminClient
      .from("private_chats")
      .select("id,user_a_id,user_b_id,is_connected")
      .eq("id", payload.chatId)
      .maybeSingle();
    if (
      !connectedChat ||
      (connectedChat.user_a_id !== user.id &&
        connectedChat.user_b_id !== user.id)
    ) {
      return jsonResponse({ error: "chat_not_found" }, 404);
    }
    if (!connectedChat.is_connected)
      return jsonResponse({ error: "chat_disconnected" }, 410);

    const attachment = payload.attachment;
    if (attachment) {
      if (!(["image", "video", "audio"] as const).includes(attachment.kind)) {
        return jsonResponse({ error: "invalid_attachment_kind" }, 400);
      }
      const expectedPrefix = `${user.id}/${payload.chatId}/`;
      if (!attachment.storagePath?.startsWith(expectedPrefix)) {
        return jsonResponse({ error: "invalid_attachment_path" }, 400);
      }
      const { data: objects, error: objectError } = await adminClient.storage
        .from("chat-media")
        .list(`${user.id}/${payload.chatId}`, {
          search: attachment.storagePath.split("/").pop(),
        });
      if (
        objectError ||
        !objects?.some((object) =>
          attachment.storagePath.endsWith(`/${object.name}`),
        )
      ) {
        return jsonResponse({ error: "attachment_not_uploaded" }, 400);
      }
    }

    const { data, error } = await adminClient
      .from("private_messages")
      .insert({
        chat_id: payload.chatId,
        sender_id: user.id,
        body,
        attachment_kind: attachment?.kind ?? null,
        attachment_storage_path: attachment?.storagePath ?? null,
        attachment_mime_type: attachment?.mimeType ?? null,
        attachment_duration_seconds: attachment?.durationSeconds ?? null,
        attachment_label: attachment?.label?.slice(0, 160) ?? null,
      })
      .select(
        "id, chat_id, sender_id, body, attachment_kind, attachment_storage_path, attachment_mime_type, attachment_duration_seconds, attachment_label, created_at",
      )
      .single();

    if (error)
      return jsonResponse(
        { error: "send_message_failed", details: error.message },
        400,
      );

    await adminClient
      .from("private_chats")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", payload.chatId);
    const recipientId =
      connectedChat.user_a_id === user.id
        ? connectedChat.user_b_id
        : connectedChat.user_a_id;
    if (recipientId) {
      const deepLink = `/chat/${payload.chatId}`;
      await adminClient.from("notifications").insert({
        user_id: recipientId,
        type: "private_message",
        title: "Nuovo messaggio",
        body: attachment
          ? "Hai ricevuto un nuovo allegato in chat."
          : "Hai ricevuto un messaggio in una chat privata.",
        deep_link: deepLink,
      });
      await sendPushToUsers(adminClient, [recipientId], {
        title: "Nuovo messaggio",
        body: attachment
          ? "Hai ricevuto un nuovo allegato in chat."
          : "Hai ricevuto un messaggio in una chat privata.",
        data: { type: "private_message", chatId: payload.chatId, deepLink },
      });
    }
    await audit(adminClient, {
      actorId: user.id,
      eventType: "chat",
      action: "send_private_message",
      targetTable: "private_messages",
      targetId: data.id,
    });
    return jsonResponse({ message: data }, 201);
  }),
);
