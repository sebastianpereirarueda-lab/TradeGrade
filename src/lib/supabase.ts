import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** Null when the deployment has no Supabase project configured: the app then stays local-only. */
export const supabase: SupabaseClient | null =
  url && key
    ? createClient(url, key, {
        auth: { flowType: "pkce", persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      })
    : null;

export const authConfigured = supabase !== null;

/** Where OAuth and magic links return to: the app's own URL without any route. */
export function redirectUrl(): string {
  return `${window.location.origin}${window.location.pathname}`;
}
