const fallbackSupabaseUrl = "https://muadzpawrxcivogtxwto.supabase.co";
const fallbackSupabaseAnonKey = "sb_publishable_l4TjR6G8pWYGlLlnOG-TaQ_MTnYd5Yj";

export const env = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? fallbackSupabaseUrl,
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? fallbackSupabaseAnonKey
};

export const demoMode =
  !env.supabaseUrl ||
  !env.supabaseAnonKey ||
  env.supabaseUrl.includes("replace-with-project") ||
  env.supabaseAnonKey.includes("replace-with") ||
  env.supabaseAnonKey.length < 20;

export function assertEnv() {
  if (demoMode) {
    console.warn("Supabase environment is not configured. Running Paraggi in demo mode.");
  }
}
