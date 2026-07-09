import { decideChatProximity } from "./index";

describe("decideChatProximity", () => {
  it("keeps chat active when users are within range", () => {
    expect(decideChatProximity({
      distanceMeters: 82,
      radiusMeters: 100,
      hasValidLocationPermission: true,
      isModerationRestricted: false
    })).toMatchObject({ isWithinRange: true, chatStatus: "active" });
  });

  it("freezes chat when users are outside range", () => {
    expect(decideChatProximity({
      distanceMeters: 620,
      radiusMeters: 500,
      hasValidLocationPermission: true,
      isModerationRestricted: false
    })).toMatchObject({ isWithinRange: false, chatStatus: "frozen_distance" });
  });

  it("freezes chat when location permission is missing", () => {
    expect(decideChatProximity({
      distanceMeters: 10,
      radiusMeters: 100,
      hasValidLocationPermission: false,
      isModerationRestricted: false
    })).toMatchObject({ isWithinRange: false, chatStatus: "frozen_permission" });
  });

  it("prioritizes moderation restrictions", () => {
    expect(decideChatProximity({
      distanceMeters: 10,
      radiusMeters: 100,
      hasValidLocationPermission: true,
      isModerationRestricted: true
    })).toMatchObject({ isWithinRange: false, chatStatus: "frozen_moderation" });
  });
});

