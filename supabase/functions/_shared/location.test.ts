import { calculateLocationTrust } from "./location.ts";

Deno.test("trusted location gets high score", () => {
  const result = calculateLocationTrust({
    latitude: 45.46,
    longitude: 9.19,
    accuracyMeters: 15,
    capturedAt: new Date().toISOString()
  });

  if (result.status !== "trusted") throw new Error(`Expected trusted, got ${result.status}`);
});

Deno.test("emulator stale inaccurate location is suspicious or blocked", () => {
  const result = calculateLocationTrust({
    latitude: 45.46,
    longitude: 9.19,
    accuracyMeters: 800,
    capturedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    device: { isEmulator: true }
  });

  if (!["suspicious", "blocked"].includes(result.status)) {
    throw new Error(`Expected suspicious/blocked, got ${result.status}`);
  }
});

