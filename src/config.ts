const mode = (import.meta.env.VITE_MODE || "dev").toLowerCase();
const isProd = mode === "prod";

export const MODE = isProd ? "prod" : "dev";

export const BACKEND_URL = isProd
  ? import.meta.env.VITE_BACKEND_URL_PROD || "https://x.kupe.in"
  : import.meta.env.VITE_BACKEND_URL_DEV || "http://127.0.0.1:8000";

export const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY || "";
export const POSTHOG_HOST = import.meta.env.VITE_POSTHOG_HOST || "https://us.i.posthog.com";

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "";
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
