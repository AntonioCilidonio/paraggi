import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { demoMode, env } from "@/config/env";

const supabaseUrl = demoMode ? "https://demo.supabase.co" : env.supabaseUrl;
const supabaseAnonKey = demoMode ? "demo-anon-key" : env.supabaseAnonKey;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false
  }
});
