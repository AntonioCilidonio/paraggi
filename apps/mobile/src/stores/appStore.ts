import type { ChatStatus, PostCategory, PostTtlMinutes, RadiusMeters } from "@paraggi/domain";
import { create } from "zustand";
import type { FeedPost } from "@/components/FeedPostCard";

export type DemoComment = {
  id: string;
  author_id: string;
  display_name: string;
  body: string;
  created_at: string;
};

export type DemoMessage = {
  id: string;
  sender_id: string;
  body: string;
  created_at: string;
};

export type DemoConnectionRequest = {
  id: string;
  from: string;
  reason: string;
  distance_meters: number;
  created_at: string;
  status: "pending" | "accepted" | "declined";
};

type PermissionState = "unknown" | "granted" | "denied";

type QueuedAction = {
  id: string;
  type: "create-post" | "create-comment" | "send-private-message";
  payload: Record<string, unknown>;
  createdAt: string;
};

type AppStore = {
  radiusMeters: RadiusMeters;
  locationPermission: PermissionState;
  notificationPermission: PermissionState;
  offlineQueue: QueuedAction[];
  demoPosts: FeedPost[];
  demoCommentsByPost: Record<string, DemoComment[]>;
  demoMessagesByChat: Record<string, DemoMessage[]>;
  demoChatStatusById: Record<string, ChatStatus>;
  demoRequests: DemoConnectionRequest[];
  setRadius: (radiusMeters: RadiusMeters) => void;
  setLocationPermission: (state: PermissionState) => void;
  setNotificationPermission: (state: PermissionState) => void;
  enqueueOfflineAction: (action: QueuedAction) => void;
  clearOfflineAction: (id: string) => void;
  addDemoPost: (post: { category: PostCategory; body: string; ttlMinutes: PostTtlMinutes }) => FeedPost;
  addDemoComment: (postId: string, body: string) => DemoComment;
  addDemoMessage: (chatId: string, body: string) => DemoMessage;
  setDemoChatStatus: (chatId: string, status: ChatStatus) => void;
  acceptDemoRequest: (requestId: string) => void;
  declineDemoRequest: (requestId: string) => void;
  resetDemoScenario: () => void;
};

const nowIso = () => new Date().toISOString();

function makeDemoPost(values: { category: PostCategory; body: string; ttlMinutes: PostTtlMinutes }): FeedPost {
  return {
    id: `demo-post-${Date.now()}`,
    author_id: "me",
    display_name: "Tu",
    avatar_path: null,
    category: values.category,
    body: values.body,
    area_name: "Area demo",
    city: "Bologna",
    distance_meters: 35,
    expires_at: new Date(Date.now() + values.ttlMinutes * 60 * 1000).toISOString(),
    comment_count: 0,
    reputation_score: 12,
    created_at: nowIso()
  };
}

export const useAppStore = create<AppStore>((set) => ({
  radiusMeters: 500,
  locationPermission: "unknown",
  notificationPermission: "unknown",
  offlineQueue: [],
  demoPosts: [],
  demoCommentsByPost: {},
  demoMessagesByChat: {},
  demoChatStatusById: {},
  demoRequests: [
    {
      id: "demo-request-1",
      from: "Marta",
      reason: "Vuole continuare in privato sul percorso per la fiera.",
      distance_meters: 130,
      created_at: nowIso(),
      status: "pending"
    }
  ],
  setRadius: (radiusMeters) => set({ radiusMeters }),
  setLocationPermission: (locationPermission) => set({ locationPermission }),
  setNotificationPermission: (notificationPermission) => set({ notificationPermission }),
  enqueueOfflineAction: (action) => set((state) => ({ offlineQueue: [...state.offlineQueue, action] })),
  clearOfflineAction: (id) => set((state) => ({ offlineQueue: state.offlineQueue.filter((action) => action.id !== id) })),
  addDemoPost: (values) => {
    const post = makeDemoPost(values);
    set((state) => ({ demoPosts: [post, ...state.demoPosts] }));
    return post;
  },
  addDemoComment: (postId, body) => {
    const comment = {
      id: `demo-comment-${Date.now()}`,
      author_id: "me",
      display_name: "Tu",
      body,
      created_at: nowIso()
    };
    set((state) => ({
      demoCommentsByPost: {
        ...state.demoCommentsByPost,
        [postId]: [...(state.demoCommentsByPost[postId] ?? []), comment]
      },
      demoPosts: state.demoPosts.map((post) => post.id === postId ? { ...post, comment_count: post.comment_count + 1 } : post)
    }));
    return comment;
  },
  addDemoMessage: (chatId, body) => {
    const message = {
      id: `demo-message-${Date.now()}`,
      sender_id: "me",
      body,
      created_at: nowIso()
    };
    set((state) => ({
      demoMessagesByChat: {
        ...state.demoMessagesByChat,
        [chatId]: [...(state.demoMessagesByChat[chatId] ?? []), message]
      }
    }));
    return message;
  },
  setDemoChatStatus: (chatId, status) => set((state) => ({
    demoChatStatusById: { ...state.demoChatStatusById, [chatId]: status }
  })),
  acceptDemoRequest: (requestId) => set((state) => ({
    demoRequests: state.demoRequests.map((request) => request.id === requestId ? { ...request, status: "accepted" } : request),
    demoChatStatusById: { ...state.demoChatStatusById, "demo-active-chat": "active" }
  })),
  declineDemoRequest: (requestId) => set((state) => ({
    demoRequests: state.demoRequests.map((request) => request.id === requestId ? { ...request, status: "declined" } : request)
  })),
  resetDemoScenario: () => set({
    demoPosts: [],
    demoCommentsByPost: {},
    demoMessagesByChat: {},
    demoChatStatusById: {},
    demoRequests: [
      {
        id: "demo-request-1",
        from: "Marta",
        reason: "Vuole continuare in privato sul percorso per la fiera.",
        distance_meters: 130,
        created_at: nowIso(),
        status: "pending"
      }
    ]
  })
}));
