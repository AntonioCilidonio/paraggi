import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

export async function configureNotifications() {
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
  }
}

export async function requestNotificationPermission() {
  const current = await Notifications.getPermissionsAsync();
  if (current.status === "granted") return true;

  const requested = await Notifications.requestPermissionsAsync();
  return requested.status === "granted";
}

export async function sendLocalNotification(title: string, body: string) {
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
}
