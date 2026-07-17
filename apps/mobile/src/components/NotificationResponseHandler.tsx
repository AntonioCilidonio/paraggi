import * as Notifications from "expo-notifications";
import { useQueryClient } from "@tanstack/react-query";
import { type Href, router, usePathname, useRootNavigationState } from "expo-router";
import { useEffect, useRef } from "react";
import { markOpenedNotificationRead } from "@/services/notificationRead";
import { resolveNotificationRoute } from "@/services/notificationRouting";
import { supabase } from "@/services/supabase";

const handledResponseIds = new Set<string>();
const recentlyOpenedRoutes = new Map<string, number>();

export function NotificationResponseHandler() {
  const navigationState = useRootNavigationState();
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  const queryClient = useQueryClient();

  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  useEffect(() => {
    if (!navigationState?.key) return;

    async function openResponse(
      response: Notifications.NotificationResponse | null,
    ) {
      if (!response) return;
      const responseId = response.notification.request.identifier;
      if (handledResponseIds.has(responseId)) return;
      handledResponseIds.add(responseId);
      const data = response.notification.request.content.data ?? {};
      const route = resolveNotificationRoute(data);
      const now = Date.now();
      const openedAt = recentlyOpenedRoutes.get(route);
      recentlyOpenedRoutes.set(route, now);
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData.session) {
        await markOpenedNotificationRead(data, route, queryClient);
        await Notifications.dismissNotificationAsync(responseId).catch(() => undefined);
        if (pathnameRef.current !== route && (!openedAt || now - openedAt > 2500)) {
          router.navigate(route as Href);
        }
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
  }, [navigationState?.key, queryClient]);

  return null;
}
