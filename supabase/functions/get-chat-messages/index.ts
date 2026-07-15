import { jsonResponse, requireUser, withHttp } from "../_shared/http.ts";

Deno.serve(
  await withHttp(async (req) => {
    const { user, adminClient } = await requireUser(req);
    const url = new URL(req.url);
    const chatId = url.searchParams.get("chatId");
    if (!chatId) return jsonResponse({ error: "chat_id_required" }, 400);

    const { data: chat, error: chatError } = await adminClient
      .from("private_chats")
      .select(
        "id,user_a_id,user_b_id,status,last_distance_meters,last_message_at,updated_at,is_connected",
      )
      .eq("id", chatId)
      .maybeSingle();
    if (
      chatError ||
      !chat ||
      (chat.user_a_id !== user.id && chat.user_b_id !== user.id)
    ) {
      return jsonResponse({ error: "chat_not_found" }, 404);
    }
    const otherUserId =
      chat.user_a_id === user.id ? chat.user_b_id : chat.user_a_id;
    const { data: otherProfile } = await adminClient
      .from("profiles")
      .select("id,display_name,avatar_path,reputation_score")
      .eq("id", otherUserId)
      .maybeSingle();

    if (!chat.is_connected) {
      return jsonResponse({
        chat: { ...chat, other_profile: otherProfile },
        messages: [],
        currentUserId: user.id,
        disconnected: true,
      });
    }

    const { data: messages, error: messagesError } = await adminClient
      .from("private_messages")
      .select(
        "id,sender_id,body,created_at,delivered_at,read_at,attachment_kind,attachment_storage_path,attachment_mime_type,attachment_duration_seconds,attachment_label",
      )
      .eq("chat_id", chatId)
      .order("created_at", { ascending: true });
    if (messagesError)
      return jsonResponse(
        { error: "messages_failed", details: messagesError.message },
        400,
      );

    await adminClient
      .from("private_messages")
      .update({
        delivered_at: new Date().toISOString(),
        read_at: new Date().toISOString(),
      })
      .eq("chat_id", chatId)
      .neq("sender_id", user.id)
      .is("read_at", null);

    const decoratedMessages = await Promise.all(
      (messages ?? []).map(async (message) => {
        if (!message.attachment_storage_path)
          return { ...message, attachment_url: null };
        const signed = await adminClient.storage
          .from("chat-media")
          .createSignedUrl(message.attachment_storage_path, 60 * 60);
        return {
          ...message,
          attachment_url: signed.error ? null : signed.data.signedUrl,
        };
      }),
    );

    return jsonResponse({
      chat: { ...chat, status: "active", other_profile: otherProfile },
      messages: decoratedMessages,
      currentUserId: user.id,
      disconnected: false,
    });
  }),
);
