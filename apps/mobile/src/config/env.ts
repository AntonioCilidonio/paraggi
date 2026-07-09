export const env = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? ""
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
