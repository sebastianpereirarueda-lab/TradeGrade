import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { redirectUrl, supabase } from "./supabase";

export interface AuthState {
  user: User | null;
  loading: boolean;
}

let current: AuthState = { user: null, loading: !!supabase };
const listeners = new Set<() => void>();

function set(next: AuthState) {
  current = next;
  listeners.forEach((l) => l());
}

if (supabase) {
  void supabase.auth.getSession().then(({ data }) => set({ user: data.session?.user ?? null, loading: false }));
  supabase.auth.onAuthStateChange((_event, session: Session | null) => {
    set({ user: session?.user ?? null, loading: false });
  });
}

export function getAuth(): AuthState {
  return current;
}

export function onAuthChange(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useAuth(): AuthState {
  const [state, setState] = useState(current);
  useEffect(() => onAuthChange(() => setState(current)), []);
  return state;
}

function need() {
  if (!supabase) throw new Error("Sign-in is not configured for this deployment.");
  return supabase;
}

export async function signInWithPassword(email: string, password: string) {
  const { error } = await need().auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function signUp(email: string, password: string): Promise<"signed-in" | "confirm-email"> {
  const { data, error } = await need().auth.signUp({ email, password, options: { emailRedirectTo: redirectUrl() } });
  if (error) throw error;
  return data.session ? "signed-in" : "confirm-email";
}

export async function sendMagicLink(email: string) {
  const { error } = await need().auth.signInWithOtp({ email, options: { emailRedirectTo: redirectUrl() } });
  if (error) throw error;
}

export async function signInWithGoogle() {
  const { error } = await need().auth.signInWithOAuth({ provider: "google", options: { redirectTo: redirectUrl() } });
  if (error) throw error;
}

export async function resetPassword(email: string) {
  const { error } = await need().auth.resetPasswordForEmail(email, { redirectTo: redirectUrl() });
  if (error) throw error;
}

export async function signOut() {
  await need().auth.signOut();
}
