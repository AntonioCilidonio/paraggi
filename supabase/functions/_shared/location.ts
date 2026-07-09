export type LocationPayload = {
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  altitudeMeters?: number;
  speedMps?: number;
  headingDegrees?: number;
  capturedAt: string;
  device?: {
    isEmulator?: boolean;
    isRootedOrJailbroken?: boolean;
  };
};

export function calculateLocationTrust(payload: LocationPayload) {
  let score = 100;
  const flags: string[] = [];
  const capturedAt = new Date(payload.capturedAt);
  const ageMs = Date.now() - capturedAt.getTime();

  if (!Number.isFinite(payload.latitude) || !Number.isFinite(payload.longitude)) {
    score -= 100;
    flags.push("invalid_coordinates");
  }

  if (Math.abs(payload.latitude) > 90 || Math.abs(payload.longitude) > 180) {
    score -= 100;
    flags.push("coordinates_out_of_bounds");
  }

  if (payload.accuracyMeters > 100) {
    score -= 25;
    flags.push("low_accuracy");
  }

  if (payload.accuracyMeters > 500) {
    score -= 35;
    flags.push("very_low_accuracy");
  }

  if (ageMs > 5 * 60 * 1000) {
    score -= 30;
    flags.push("stale_fix");
  }

  if ((payload.speedMps ?? 0) > 80) {
    score -= 30;
    flags.push("impossible_speed");
  }

  if (payload.device?.isEmulator) {
    score -= 35;
    flags.push("emulator");
  }

  if (payload.device?.isRootedOrJailbroken) {
    score -= 25;
    flags.push("root_or_jailbreak");
  }

  score = Math.max(0, Math.min(100, score));

  const status = score >= 75 ? "trusted" : score >= 45 ? "uncertain" : score >= 20 ? "suspicious" : "blocked";

  return { score, status, flags };
}

