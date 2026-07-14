import * as Notifications from "expo-notifications";
import { type Href, router, useRootNavigationState } from "expo-router";
import { useEffect, useRef } from "react";
import { resolveNotificationRoute } from "@/services/notificationRouting";

export function NotificationResponseHandler() {
  const navigationState = useRootNavigationState();
  const handledResponseId = useRef<string | null>(null);

  useEffect(() => {
    if (!navigationState?.key) return;

    function openResponse(response: Notifications.NotificationResponse | null) {
      if (!response || handledResponseId.current === response.notification.request.identifier) return;
      handledResponseId.current = response.notification.request.identifier;
      const data = response.notification.request.content.data ?? {};
      router.push(resolveNotificationRoute(data) as Href);
    }

    void Notifications.getLastNotificationResponseAsync().then(openResponse);
    const subscription = Notifications.addNotificationResponseReceivedListener(openResponse);
    return () => subscription.remove();
  }, [navigationState?.key]);

  return null;
}
