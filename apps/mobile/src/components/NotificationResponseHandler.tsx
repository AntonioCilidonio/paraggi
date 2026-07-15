import * as Notifications from "expo-notifications";
import { type Href, router, useRootNavigationState } from "expo-router";
import { useEffect, useRef } from "react";
import { resolveNotificationRoute } from "@/services/notificationRouting";
import { supabase } from "@/services/supabase";

export function NotificationResponseHandler() {
  const navigationState = useRootNavigationState();
  const handledResponseId = useRef<string | null>(null);

  useEffect(() => {
    if (!navigationState?.key) return;

    async function openResponse(
      response: Notifications.NotificationResponse | null,
    ) {
      if (
        !response ||
        handledResponseId.current === response.notification.request.identifier
      )
        return;
      handledResponseId.current = response.notification.request.identifier;
      const data = response.notification.request.content.data ?? {};
      const route = resolveNotificationRoute(data);
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData.session) {
        router.push(route as Href);
        return;
      }
      router.replace({ pathname: "/(auth)/login", params: { next: route } });
    }

    void Notifications.getLastNotificationResponseAsync().then(
      (response) => void openResponse(response),
    );
    const subscription = Notifications.addNotificationResponseReceivedListener(
      (response) => void openResponse(response),
    );
    return () => subscription.remove();
  }, [navigationState?.key]);

  return null;
}
