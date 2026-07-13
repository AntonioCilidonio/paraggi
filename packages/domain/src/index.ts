export type RadiusMeters = 100 | 500 | 1000 | 5000 | 30000 | 60000;

export type LocationTrustStatus = "trusted" | "uncertain" | "suspicious" | "blocked";

export type ChatStatus =
  | "active"
  | "frozen_distance"
  | "frozen_permission"
  | "frozen_moderation"
  | "closed";

export type PostCategory =
  | "question"
  | "information"
  | "lost_item"
  | "help"
  | "event"
  | "social"
  | "emergency";

export type PostTtlMinutes = 30 | 180 | 1440;

export const SUPPORTED_RADII_METERS: readonly RadiusMeters[] = [100, 500, 1000, 5000, 30000, 60000];

export const POST_TTL_MINUTES: readonly PostTtlMinutes[] = [30, 180, 1440];
