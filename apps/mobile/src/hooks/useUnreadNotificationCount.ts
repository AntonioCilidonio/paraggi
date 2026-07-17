import { useQuery } from "@tanstack/react-query";
import { demoMode } from "@/config/env";
import { supabase } from "@/services/supabase";

export function useUnreadNotificationCount() {
  return useQuery({
    queryKey: ["notifications", "unread-count"],
    refetchInterval: demoMode ? false : 30_000,
    queryFn: async () => {
      if (demoMode) return 0;
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth.user) return 0;
      const { count, error } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", auth.user.id)
        .is("read_at", null);
      if (error) throw error;
      return count ?? 0;
    },
  });
}
