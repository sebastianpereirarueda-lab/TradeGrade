import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Validate the configured Supabase project URL. It must be an https URL of a
 * different site than the app itself; a common mistake is pasting the app's
 * own address, which turns every sign-in into a 404 on the app's host.
 */
export function cleanSupabaseUrl(raw: string | undefined, appOrigin?: string): string | null {
  const value = (raw ?? "").trim().replace(/\/+$/, "");
  if (!value) return null;
  let u: URL;
  try {
    u = new URL(value);
  } catch {
    return null;
  }
  if (u.protocol !== "https:" && u.hostname !== "localhost" && u.hostname !== "127.0.0.1") return null;
  if (appOrigin && u.origin === appOrigin) return null;
  if (u.pathname !== "/" && u.pathname !== "") return null; // a project URL has no path
  return u.origin;
}

const appOrigin = typeof window !== "undefined" ? window.location.origin : undefined;
const rawUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const url = cleanSupabaseUrl(rawUrl, appOrigin);
const key = ((import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? "").trim() || undefined;

if (rawUrl && !url) {
  console.error(
    `TradeGrade: VITE_SUPABASE_URL "${rawUrl}" is not a Supabase project URL (expected https://<ref>.supabase.co). Sign-in is disabled.`,
  );
}

/** Null when the deployment has no valid Supabase project configured: the app then stays local-only. */
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
