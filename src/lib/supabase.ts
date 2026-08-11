import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "../config";

const url = SUPABASE_URL;
const anonKey = SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // Avoid createClient throwing ("supabaseUrl is required") on a blank screen.
  // Auth/dashboard still fail until VITE_SUPABASE_* are set in .env.
  console.warn(
    "VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are not set; auth and dashboard reads will fail.",
  );
}

// HMR can re-evaluate this module; reuse one client to avoid
// "Multiple GoTrueClient instances" under the same storage key.
const globalForSupabase = globalThis as typeof globalThis & {
  __kupeSupabase?: SupabaseClient;
};

export const supabase =
  globalForSupabase.__kupeSupabase ??
  createClient(url || "http://127.0.0.1:54321", anonKey || "missing-anon-key");

globalForSupabase.__kupeSupabase = supabase;
