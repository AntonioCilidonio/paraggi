import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

export async function configureNotifications() {
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true
      })
    });

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("paraggi-local", {
        name: "Notifiche Paraggi",
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 220, 120, 220],
        lightColor: "#3b82c4"
      });
      await Notifications.setNotificationChannelAsync("paraggi-alerts", {
        name: "Allarmi Paraggi",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 500, 180, 500, 180, 700],
        lightColor: "#b42318",
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC
      });
    }
  } catch {
    // Notification support can vary across Android devices. The app must keep running.
  }
}

export async function requestNotificationPermission() {
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.status === "granted") return true;

    const requested = await Notifications.requestPermissionsAsync();
    return requested.status === "granted";
  } catch {
    return false;
  }
}

export async function sendLocalNotification(
  title: string,
  body: string,
  data: Record<string, unknown> = {}
) {
  try {
    await configureNotifications();
    const granted = await requestNotificationPermission();
    if (!granted) return false;

    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: true,
        data
      },
      trigger: null
    });

    return true;
  } catch {
    return false;
  }
}

export async function setAppBadgeCount(count: number) {
  try {
    return await Notifications.setBadgeCountAsync(
      Math.max(0, Math.floor(count)),
    );
  } catch {
    return false;
  }
}

export async function dismissPresentedChatNotifications(chatId: string) {
  try {
    const presented = await Notifications.getPresentedNotificationsAsync();
    const matching = presented.filter((notification) => {
      const data = notification.request.content.data ?? {};
      const notificationChatId = data.chatId ?? data.chat_id;
      const deepLink = data.deepLink ?? data.deep_link;
      return (
        notificationChatId === chatId ||
        deepLink === `/chat/${chatId}`
      );
    });

    await Promise.all(
      matching.map((notification) =>
        Notifications.dismissNotificationAsync(notification.request.identifier),
      ),
    );
  } catch {
    // Some Android launchers do not expose presented notifications.
  }
}

export async function clearPresentedNotifications() {
  try {
    await Notifications.dismissAllNotificationsAsync();
    await setAppBadgeCount(0);
  } catch {
    // Clearing the in-app state must not depend on launcher badge support.
  }
}
