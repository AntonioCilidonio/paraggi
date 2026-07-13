import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { useCallback } from "react";
import { Platform } from "react-native";
import { demoMode } from "@/config/env";
import { callFunction } from "@/services/api";
import { captureClientError } from "@/services/clientLogger";
import { configureNotifications, sendLocalNotification } from "@/services/notifications";
import { useAppStore } from "@/stores/appStore";

export function usePushRegistration() {
  const setNotificationPermission = useAppStore((state) => state.setNotificationPermission);

  return useCallback(async () => {
    try {
      await configureNotifications();
      const permission = await Notifications.requestPermissionsAsync();
      setNotificationPermission(permission.status === "granted" ? "granted" : "denied");
      if (permission.status !== "granted") return { ok: false as const, reason: "permission_denied" };

      if (demoMode || !Device.isDevice) {
        await sendLocalNotification("Paraggi notifiche attive", "Riceverai avvisi demo per commenti, richieste e chat riattivate.");
        return { ok: true as const, demo: true };
      }

      const projectId = Constants.easConfig?.projectId ?? Constants.expoConfig?.extra?.eas?.projectId;
      const token = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
      await callFunction("register-push-token", {
        body: {
          expoPushToken: token.data,
          platform: Platform.OS,
          installationId: `${Platform.OS}-${Device.osInternalBuildId ?? Device.modelId ?? "unknown"}`,
          appVersion: "0.1.0",
          osVersion: Device.osVersion,
          isEmulator: !Device.isDevice,
          isRootedOrJailbroken: false
        }
      });
      await sendLocalNotification("Paraggi notifiche attive", "Token push registrato. Gli SOS vicini possono arrivare su questo dispositivo.");
      return { ok: true as const, tokenPreview: token.data.slice(0, 24) };
    } catch (error) {
      captureClientError("push_registration_failed", error);
      setNotificationPermission("denied");
      return { ok: false as const, reason: "registration_failed" };
    }
  }, [setNotificationPermission]);
}
