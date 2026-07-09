import type { RadiusMeters } from "@paraggi/domain";
import { create } from "zustand";

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
  setRadius: (radiusMeters: RadiusMeters) => void;
  setLocationPermission: (state: PermissionState) => void;
  setNotificationPermission: (state: PermissionState) => void;
  enqueueOfflineAction: (action: QueuedAction) => void;
  clearOfflineAction: (id: string) => void;
};

export const useAppStore = create<AppStore>((set) => ({
  radiusMeters: 500,
  locationPermission: "unknown",
  notificationPermission: "unknown",
  offlineQueue: [],
  setRadius: (radiusMeters) => set({ radiusMeters }),
  setLocationPermission: (locationPermission) => set({ locationPermission }),
  setNotificationPermission: (notificationPermission) => set({ notificationPermission }),
  enqueueOfflineAction: (action) => set((state) => ({ offlineQueue: [...state.offlineQueue, action] })),
  clearOfflineAction: (id) => set((state) => ({ offlineQueue: state.offlineQueue.filter((action) => action.id !== id) }))
}));

