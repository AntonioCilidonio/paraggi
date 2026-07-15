import { resolveNotificationRoute } from "./notificationRouting";

describe("resolveNotificationRoute", () => {
  it("opens a post from comment and nearby-post notifications", () => {
    expect(
      resolveNotificationRoute({ type: "comment_received", postId: "post-1" }),
    ).toBe("/post/post-1");
    expect(
      resolveNotificationRoute({
        type: "nearby_relevant_post",
        postId: "post-2",
      }),
    ).toBe("/post/post-2");
  });

  it("opens chats, requests and SOS destinations", () => {
    expect(resolveNotificationRoute({ type: "private_request" })).toBe(
      "/chats",
    );
    expect(
      resolveNotificationRoute({ type: "private_message", chatId: "chat-1" }),
    ).toBe("/chat/chat-1");
    expect(
      resolveNotificationRoute({ type: "danger_alert", alertId: "alert-1" }),
    ).toBe("/danger/alert-1");
  });

  it("prefers an explicit deep link and has a safe fallback", () => {
    expect(resolveNotificationRoute({ deepLink: "/chat/direct" })).toBe(
      "/chat/direct",
    );
    expect(resolveNotificationRoute({}, "/post/stored")).toBe("/post/stored");
    expect(
      resolveNotificationRoute({ deepLink: "paraggi://danger/alert-2" }),
    ).toBe("/danger/alert-2");
    expect(resolveNotificationRoute({}, "/(tabs)/chats")).toBe("/chats");
    expect(resolveNotificationRoute({ type: "unknown" })).toBe("/feed");
  });

  it("rejects unsupported stored routes instead of opening an unmatched page", () => {
    expect(
      resolveNotificationRoute(
        { type: "private_request" },
        "/route/che-non-esiste",
      ),
    ).toBe("/chats");
    expect(resolveNotificationRoute({}, "https://example.com/notifica")).toBe(
      "/feed",
    );
  });

  it("supports legacy snake-case notification payloads", () => {
    expect(
      resolveNotificationRoute({
        type: "comment_received",
        post_id: "post-legacy",
      }),
    ).toBe("/post/post-legacy");
    expect(
      resolveNotificationRoute({
        type: "private_message",
        chat_id: "chat-legacy",
      }),
    ).toBe("/chat/chat-legacy");
    expect(
      resolveNotificationRoute({ deep_link: "/danger/alert-legacy" }),
    ).toBe("/danger/alert-legacy");
  });
});
