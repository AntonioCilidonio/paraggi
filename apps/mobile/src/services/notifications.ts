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
        name: "Paraggi test",
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 220, 120, 220],
        lightColor: "#16808a"
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
    // Notification support can vary across Android test devices. The app must keep running.
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

export async function sendLocalNotification(title: string, body: string) {
  try {
    const granted = await requestNotificationPermission();
    if (!granted) return false;

    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: true
      },
      trigger: null
    });

    return true;
  } catch {
    return false;
  }
}
