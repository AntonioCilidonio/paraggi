import { supabase } from "@/services/supabase";

export function getAvatarUrl(path?: string | null) {
  if (!path) return null;
  if (/^https?:\/\//.test(path)) return path;
  return supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
}
