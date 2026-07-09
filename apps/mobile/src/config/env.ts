export const env = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? ""
};

export function assertEnv() {
  if (!env.supabaseUrl || !env.supabaseAnonKey) {
    console.warn("Supabase environment is not configured.");
  }
}

