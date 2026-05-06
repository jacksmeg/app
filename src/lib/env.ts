export const env = {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL?.trim() ?? "",
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ?? "",
  siteUrl: import.meta.env.VITE_SITE_URL?.trim() ?? (typeof window !== "undefined" ? window.location.origin : "http://localhost:5173"),
};

export const hasSupabaseConfig = Boolean(env.supabaseUrl && env.supabaseAnonKey);
