import * as Device from "expo-device";
import * as Location from "expo-location";
import { useCallback } from "react";
import { callFunction } from "@/services/api";
import { useAppStore } from "@/stores/appStore";

export function useLocationSync() {
  const setLocationPermission = useAppStore((state) => state.setLocationPermission);

  return useCallback(async () => {
    const permission = await Location.requestForegroundPermissionsAsync();
    setLocationPermission(permission.status === "granted" ? "granted" : "denied");
    if (permission.status !== "granted") return { ok: false as const, reason: "permission_denied" };

    const current = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced
    });

    const result = await callFunction("update-location", {
      body: {
        latitude: current.coords.latitude,
        longitude: current.coords.longitude,
        accuracyMeters: current.coords.accuracy ?? 999,
        altitudeMeters: current.coords.altitude ?? undefined,
        speedMps: current.coords.speed ?? undefined,
        headingDegrees: current.coords.heading ?? undefined,
        capturedAt: new Date(current.timestamp).toISOString(),
        device: {
          isEmulator: !Device.isDevice,
          isRootedOrJailbroken: false
        }
      }
    });

    return { ok: true as const, result };
  }, [setLocationPermission]);
}

