/**
 * Cloud sync of the app state for signed-in users. One JSON row per user in
 * `user_data`; every local change is upserted (debounced), and on sign-in the
 * device and the account are reconciled once.
 */
import { useEffect, useState } from "react";
import { getAuth, onAuthChange } from "./auth";
import { supabase } from "./supabase";
import { actions, getState, subscribeStore } from "./store";
import type { AppState } from "./types";
import { pushLocalMedia } from "./media";

export type SyncStatus = "off" | "idle" | "saving" | "synced" | "error";

let status: SyncStatus = "off";
let lastError = "";
const listeners = new Set<() => void>();
function setStatus(s: SyncStatus, err = "") {
  status = s;
  lastError = err;
  listeners.forEach((l) => l());
}
export function useSyncStatus(): { status: SyncStatus; error: string } {
  const [, tick] = useState(0);
  useEffect(() => {
    listeners.add(() => tick((n) => n + 1));
    return () => {
      listeners.clear();
    };
  }, []);
  return { status, error: lastError };
}

const SYNCED_KEY = "tradegrade:synced-user";
let applyingRemote = false;
let timer: ReturnType<typeof setTimeout> | null = null;
let activeUser: string | null = null;

export function hasContent(s: AppState): boolean {
  return s.trades.length > 0 || Object.keys(s.journals).length > 0 || Object.keys(s.tradeNotes).length > 0;
}

/**
 * What to do when a user signs in on this device.
 * - "pull": take the account's data.
 * - "push": upload this device's data.
 * - "ask": both sides have content and this device never synced with this
 *   account before, so the person decides.
 */
export function decideInitialSync(
  local: AppState,
  remote: { data: AppState; updatedAt: number } | null,
  previouslySyncedWithUser: boolean,
): "pull" | "push" | "ask" {
  if (!remote) return "push";
  if (!hasContent(local)) return "pull";
  if (previouslySyncedWithUser) return (local.updatedAt ?? 0) > remote.updatedAt ? "push" : "pull";
  return "ask";
}

async function fetchRemote(userId: string): Promise<{ data: AppState; updatedAt: number } | null> {
  const { data, error } = await supabase!.from("user_data").select("data, updated_at").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { data: data.data as AppState, updatedAt: new Date(data.updated_at as string).getTime() };
}

async function pushNow(userId: string) {
  const state = getState();
  setStatus("saving");
  const { error } = await supabase!
    .from("user_data")
    .upsert({ user_id: userId, data: state, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) {
    setStatus("error", error.message);
    throw error;
  }
  setStatus("synced");
}

function schedulePush(userId: string) {
  if (timer) clearTimeout(timer);
  setStatus("saving");
  timer = setTimeout(() => void pushNow(userId).catch(() => undefined), 1200);
}

function applyRemote(data: AppState) {
  applyingRemote = true;
  try {
    // Older cloud copies predate scorecards; keep this device's rather than wiping them.
    actions.replaceAll({ ...data, scorecards: data.scorecards ?? getState().scorecards, updatedAt: Date.now() });
  } finally {
    applyingRemote = false;
  }
}

async function reconcile(userId: string) {
  setStatus("saving");
  const local = getState();
  const remote = await fetchRemote(userId);
  const previously = localStorage.getItem(SYNCED_KEY) === userId;
  let decision = decideInitialSync(local, remote, previously);
  if (decision === "ask" && remote) {
    const useCloud = window.confirm(
      `Your account already has ${remote.data.trades.length} trades (last saved ${new Date(remote.updatedAt).toLocaleString()}).\n` +
        `This device has ${local.trades.length} trades.\n\n` +
        `OK: use the account's data on this device.\nCancel: keep this device's data and upload it to the account.`,
    );
    decision = useCloud ? "pull" : "push";
  }
  if (decision === "pull" && remote) applyRemote(remote.data);
  else await pushNow(userId);
  localStorage.setItem(SYNCED_KEY, userId);
  setStatus("synced");
  void pushLocalMedia().catch(() => undefined);
}

/** Wire auth and store together. Call once at startup. No-op when unconfigured. */
export function startSync() {
  if (!supabase) return;
  const onAuth = () => {
    const user = getAuth().user;
    const id = user?.id ?? null;
    if (id === activeUser) return;
    activeUser = id;
    if (!id) {
      setStatus("off");
      return;
    }
    void reconcile(id).catch((e) => setStatus("error", (e as Error).message));
  };
  onAuthChange(onAuth);
  onAuth();
  subscribeStore(() => {
    if (!activeUser || applyingRemote) return;
    schedulePush(activeUser);
  });
}

export async function syncNow() {
  if (!activeUser) return;
  await pushNow(activeUser);
}
