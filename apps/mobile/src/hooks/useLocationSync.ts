import * as Device from "expo-device";
import * as Location from "expo-location";
import { useCallback } from "react";
import { demoMode } from "@/config/env";
import { getFriendlyError } from "@/services/errors";
import { callFunction } from "@/services/api";
import { getLocationLabels } from "@/services/locationLabels";
import { useAppStore } from "@/stores/appStore";

export function useLocationSync() {
  const setLocationPermission = useAppStore((state) => state.setLocationPermission);
  const setLocationStatus = useAppStore((state) => state.setLocationStatus);

  return useCallback(async () => {
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      setLocationPermission(permission.status === "granted" ? "granted" : "denied");
      if (permission.status !== "granted") {
        setLocationStatus({ error: "permission_denied", syncedAt: null, accuracyMeters: null, trustStatus: null });
        return { ok: false as const, reason: "permission_denied" };
      }

      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced
      });
      const accuracyMeters = current.coords.accuracy ?? 999;
      const [place] = await Location.reverseGeocodeAsync({
        latitude: current.coords.latitude,
        longitude: current.coords.longitude
      }).catch(() => []);
      const { city, areaName, placeLabel } = getLocationLabels(place);

      if (demoMode) {
        setLocationStatus({
          syncedAt: new Date().toISOString(),
          accuracyMeters,
          trustStatus: "demo",
          error: null,
          areaName,
          city
        });
        return {
          ok: true as const,
          coordinates: {
            latitude: current.coords.latitude,
            longitude: current.coords.longitude
          },
          result: {
            area: "Area demo",
            city: "Bologna",
            accuracyMeters
          }
        };
      }

      const result = await callFunction<{
        location?: { trust_status?: string; captured_at?: string };
        trust?: { status?: string };
        area?: { name?: string | null; city?: string | null };
      }>("update-location", {
        body: {
          latitude: current.coords.latitude,
          longitude: current.coords.longitude,
          accuracyMeters,
          altitudeMeters: current.coords.altitude ?? undefined,
          speedMps: current.coords.speed ?? undefined,
          headingDegrees: current.coords.heading ?? undefined,
          capturedAt: new Date(current.timestamp).toISOString(),
          areaName,
          city,
          countryCode: place?.isoCountryCode ?? undefined,
          placeLabel,
          device: {
            isEmulator: !Device.isDevice,
            isRootedOrJailbroken: false
          }
        }
      });

      setLocationStatus({
        syncedAt: new Date().toISOString(),
        accuracyMeters,
        trustStatus: result.trust?.status ?? result.location?.trust_status ?? "uncertain",
        error: null,
        areaName: result.area?.name ?? areaName,
        city: result.area?.city ?? city
      });
      return {
        ok: true as const,
        coordinates: {
          latitude: current.coords.latitude,
          longitude: current.coords.longitude
        },
        result
      };
    } catch (error) {
      const reason = error && typeof error === "object" && "error" in error ? String((error as { error?: string }).error) : "location_unavailable";
      if (reason === "permission_denied") setLocationPermission("denied");
      setLocationStatus({ error: reason });
      return { ok: false as const, reason, message: getFriendlyError(error, "GPS non sincronizzato.") };
    }
  }, [setLocationPermission, setLocationStatus]);
}
