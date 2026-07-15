import { router } from "expo-router";

let navigationLocked = false;

export function openPostComposer() {
  if (navigationLocked) return;
  navigationLocked = true;
  router.navigate("/post/compose");
  setTimeout(() => {
    navigationLocked = false;
  }, 500);
}
