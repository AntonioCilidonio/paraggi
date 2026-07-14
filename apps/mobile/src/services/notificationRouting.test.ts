import { resolveNotificationRoute } from "./notificationRouting";

describe("resolveNotificationRoute", () => {
  it("opens a post from comment and nearby-post notifications", () => {
    expect(resolveNotificationRoute({ type: "comment_received", postId: "post-1" })).toBe("/post/post-1");
    expect(resolveNotificationRoute({ type: "nearby_relevant_post", postId: "post-2" })).toBe("/post/post-2");
  });

  it("opens chats, requests and SOS destinations", () => {
    expect(resolveNotificationRoute({ type: "private_request" })).toBe("/(tabs)/chats");
    expect(resolveNotificationRoute({ type: "private_message", chatId: "chat-1" })).toBe("/chat/chat-1");
    expect(resolveNotificationRoute({ type: "danger_alert", alertId: "alert-1" })).toBe("/danger/alert-1");
  });

  it("prefers an explicit deep link and has a safe fallback", () => {
    expect(resolveNotificationRoute({ deepLink: "/chat/direct" })).toBe("/chat/direct");
    expect(resolveNotificationRoute({}, "/post/stored")).toBe("/post/stored");
    expect(resolveNotificationRoute({ type: "unknown" })).toBe("/(tabs)/feed");
  });
});
