import type { ChatStatus, RadiusMeters } from "@paraggi/domain";

export type ProximityDecision = {
  readonly isWithinRange: boolean;
  readonly chatStatus: ChatStatus;
  readonly distanceMetersApprox: number;
};

export type ProximityPolicyInput = {
  readonly distanceMeters: number;
  readonly radiusMeters: RadiusMeters;
  readonly hasValidLocationPermission: boolean;
  readonly isModerationRestricted: boolean;
};

export function decideChatProximity(input: ProximityPolicyInput): ProximityDecision {
  const distanceMetersApprox = Math.round(input.distanceMeters / 10) * 10;

  if (input.isModerationRestricted) {
    return { isWithinRange: false, chatStatus: "frozen_moderation", distanceMetersApprox };
  }

  if (!input.hasValidLocationPermission) {
    return { isWithinRange: false, chatStatus: "frozen_permission", distanceMetersApprox };
  }

  const isWithinRange = input.distanceMeters <= input.radiusMeters;

  return {
    isWithinRange,
    chatStatus: isWithinRange ? "active" : "frozen_distance",
    distanceMetersApprox
  };
}
