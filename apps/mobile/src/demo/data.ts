import type { ChatStatus } from "@paraggi/domain";
import type { FeedPost } from "@/components/FeedPostCard";

export const isDemoMode = (url: string, anonKey: string) =>
  !url ||
  !anonKey ||
  url.includes("replace-with-project") ||
  anonKey.includes("replace-with") ||
  anonKey.length < 20;

export const demoPosts: FeedPost[] = [
  {
    id: "demo-question",
    author_id: "demo-marta",
    display_name: "Marta",
    avatar_path: null,
    category: "question",
    body: "Qualcuno sa se il bus per la fiera passa ancora da via Rizzoli?",
    area_name: "Piazza Maggiore",
    city: "Bologna",
    distance_meters: 120,
    expires_at: new Date(Date.now() + 42 * 60 * 1000).toISOString(),
    comment_count: 8,
    reputation_score: 18,
    created_at: new Date(Date.now() - 12 * 60 * 1000).toISOString()
  },
  {
    id: "demo-help",
    author_id: "demo-luca",
    display_name: "Luca",
    avatar_path: null,
    category: "help",
    body: "Ho trovato un mazzo di chiavi vicino alla fermata. Le tengo al bar all'angolo.",
    area_name: "Stazione Centrale",
    city: "Bologna",
    distance_meters: 430,
    expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    comment_count: 3,
    reputation_score: 41,
    created_at: new Date(Date.now() - 25 * 60 * 1000).toISOString()
  },
  {
    id: "demo-emergency",
    author_id: "demo-giulia",
    display_name: "Giulia",
    avatar_path: null,
    category: "emergency",
    body: "Attenzione: uscita laterale della sala eventi temporaneamente chiusa.",
    area_name: "Fiera",
    city: "Bologna",
    distance_meters: 760,
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    comment_count: 12,
    reputation_score: 64,
    created_at: new Date(Date.now() - 8 * 60 * 1000).toISOString()
  }
];

export const demoChats = [
  {
    id: "demo-active-chat",
    status: "active" as ChatStatus,
    last_distance_meters: 90,
    last_message_at: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: "demo-frozen-chat",
    status: "frozen_distance" as ChatStatus,
    last_distance_meters: 820,
    last_message_at: new Date(Date.now() - 38 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 4 * 60 * 1000).toISOString()
  }
];

export const demoMessages = [
  {
    id: "demo-msg-1",
    sender_id: "demo-marta",
    body: "Ciao, sei ancora vicino alla stazione?",
    created_at: new Date(Date.now() - 7 * 60 * 1000).toISOString()
  },
  {
    id: "demo-msg-2",
    sender_id: "me",
    body: "Si, sono a circa cento metri. Ti raggiungo davanti al bar.",
    created_at: new Date(Date.now() - 5 * 60 * 1000).toISOString()
  }
];

export const demoHistory = [
  {
    id: "demo-area-1",
    first_seen_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    last_seen_at: new Date().toISOString(),
    post_count: 4,
    comment_count: 13,
    connection_count: 2,
    areas: { name: "Centro Bologna", city: "Bologna", country_code: "IT" }
  },
  {
    id: "demo-area-2",
    first_seen_at: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
    last_seen_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    post_count: 1,
    comment_count: 5,
    connection_count: 1,
    areas: { name: "Fiera Verona", city: "Verona", country_code: "IT" }
  }
];

export const demoHeatmapZones = [
  {
    id: "demo-heatmap-centro",
    name: "Centro Bologna",
    city: "Bologna",
    post_count: 7,
    comment_count: 18,
    connection_count: 3,
    activity_score: 45,
    activity_level: "high",
    distance_meters: 180,
    latest_activity_at: new Date(Date.now() - 8 * 60 * 1000).toISOString()
  },
  {
    id: "demo-heatmap-stazione",
    name: "Stazione Centrale",
    city: "Bologna",
    post_count: 4,
    comment_count: 9,
    connection_count: 1,
    activity_score: 23,
    activity_level: "medium",
    distance_meters: 430,
    latest_activity_at: new Date(Date.now() - 18 * 60 * 1000).toISOString()
  },
  {
    id: "demo-heatmap-parco",
    name: "Parco",
    city: "Bologna",
    post_count: 1,
    comment_count: 2,
    connection_count: 0,
    activity_score: 5,
    activity_level: "low",
    distance_meters: 920,
    latest_activity_at: new Date(Date.now() - 48 * 60 * 1000).toISOString()
  }
];

export const demoComments = [
  {
    id: "demo-comment-1",
    author_id: "demo-luca",
    display_name: "Luca",
    body: "Confermo, il bus passa ancora ma con 10 minuti di ritardo.",
    created_at: new Date(Date.now() - 6 * 60 * 1000).toISOString()
  },
  {
    id: "demo-comment-2",
    author_id: "demo-marta",
    display_name: "Marta",
    body: "Grazie, informazione utilissima.",
    created_at: new Date(Date.now() - 2 * 60 * 1000).toISOString()
  }
];

export const demoConnectionRequests = [
  {
    id: "demo-request-1",
    from: "Marta",
    reason: "Vuole continuare in privato sul percorso per la fiera.",
    distance_meters: 130,
    created_at: new Date(Date.now() - 4 * 60 * 1000).toISOString()
  }
];
