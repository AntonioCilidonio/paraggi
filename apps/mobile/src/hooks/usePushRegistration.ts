import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { useCallback } from "react";
import { Platform } from "react-native";
import { demoMode } from "@/config/env";
import { callFunction } from "@/services/api";
import { sendLocalNotification } from "@/services/notifications";
import { useAppStore } from "@/stores/appStore";

export function usePushRegistration() {
  const setNotificationPermission = useAppStore((state) => state.setNotificationPermission);

  return useCallback(async () => {
    const permission = await Notifications.requestPermissionsAsync();
    setNotificationPermission(permission.status === "granted" ? "granted" : "denied");
    if (permission.status !== "granted") return;

    if (demoMode || !Device.isDevice) {
      await sendLocalNotification("Paraggi notifiche attive", "Riceverai avvisi demo per commenti, richieste e chat riattivate.");
      return;
    }

    const token = await Notifications.getExpoPushTokenAsync();
    await callFunction("register-push-token", {
      body: {
        expoPushToken: token.data,
        platform: Platform.OS,
        installationId: `${Platform.OS}-${Device.osInternalBuildId ?? "unknown"}`,
        appVersion: "0.1.0",
        osVersion: Device.osVersion,
        isEmulator: !Device.isDevice,
        isRootedOrJailbroken: false
      }
    });
  }, [setNotificationPermission]);
}
