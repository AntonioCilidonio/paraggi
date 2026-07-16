type CoordinateInput = {
  latitude?: unknown;
  longitude?: unknown;
};

export type SafeCoordinates = {
  latitude: number;
  longitude: number;
};

export function getSafeDangerCoordinates(
  input: CoordinateInput | null | undefined,
): SafeCoordinates | null {
  const latitude = Number(input?.latitude);
  const longitude = Number(input?.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude < -90 || latitude > 90) return null;
  if (longitude < -180 || longitude > 180) return null;
  return { latitude, longitude };
}
