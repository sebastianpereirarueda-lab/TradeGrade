import { useSyncExternalStore } from "react";
import type { AppState, DayJournal, Rule, Settings, Trade } from "./types";

const KEY = "trading-dashboard:v1";

export const DEFAULT_RULES: Rule[] = [
  { id: "r-plan", text: "Only took trades from my written plan", enabled: true },
  { id: "r-stop", text: "Honored every stop loss, no widening", enabled: true },
  { id: "r-size", text: "Stayed within max position size", enabled: true },
  { id: "r-revenge", text: "No revenge trading after a loss", enabled: true },
  { id: "r-limit", text: "Stopped at daily loss limit / profit target", enabled: true },
  { id: "r-window", text: "Only traded during my session window", enabled: true },
];

const DEFAULT_SETTINGS: Settings = { startingBalance: 50_000, pnlIsNet: false };

function emptyState(): AppState {
  return { trades: [], journals: {}, rules: DEFAULT_RULES, settings: DEFAULT_SETTINGS };
}

function load(): AppState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw) as Partial<AppState>;
    return {
      trades: parsed.trades ?? [],
      journals: parsed.journals ?? {},
      rules: parsed.rules ?? DEFAULT_RULES,
      settings: { ...DEFAULT_SETTINGS, ...(parsed.settings ?? {}) },
    };
  } catch {
    return emptyState();
  }
}

let state: AppState = load();
const listeners = new Set<() => void>();

function commit(next: AppState) {
  state = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (e) {
    console.error("Could not persist state", e);
  }
  listeners.forEach((l) => l());
}

export function getState(): AppState {
  return state;
}

export function useAppState(): AppState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
}

export const actions = {
  setTrades(trades: Trade[]) {
    commit({ ...state, trades });
  },
  clearTrades() {
    commit({ ...state, trades: [] });
  },
  saveJournal(j: DayJournal) {
    commit({ ...state, journals: { ...state.journals, [j.date]: { ...j, updatedAt: Date.now() } } });
  },
  setRules(rules: Rule[]) {
    commit({ ...state, rules });
  },
  setSettings(patch: Partial<Settings>) {
    commit({ ...state, settings: { ...state.settings, ...patch } });
  },
  replaceAll(next: AppState) {
    commit(next);
  },
  resetAll() {
    commit(emptyState());
  },
};

export function emptyJournal(date: string): DayJournal {
  return { date, notes: "", rules: {}, psych: {}, updatedAt: 0 };
}

export function exportBackup(): string {
  return JSON.stringify(state, null, 2);
}

export function importBackup(text: string): AppState {
  const parsed = JSON.parse(text) as Partial<AppState>;
  if (!Array.isArray(parsed.trades)) throw new Error("Backup has no trades array");
  const next: AppState = {
    trades: parsed.trades,
    journals: parsed.journals ?? {},
    rules: parsed.rules ?? DEFAULT_RULES,
    settings: { ...DEFAULT_SETTINGS, ...(parsed.settings ?? {}) },
  };
  commit(next);
  return next;
}
