/**
 * GPA-style scorecards: each metric is graded 0.0–4.0 against the user's own
 * A and F targets, then combined as a weighted average.
 */
import type { DateRange, DayJournal, Rule, Scorecard, ScorecardComponent, Settings, Trade } from "./types";
import { netPnl, sortByExit, summarize, groupByDay, tradeDay } from "./stats";
import { addDays, parseDayKey } from "./dates";
import { fmtMoney, fmtNum, fmtPct } from "./format";

export type Unit = "pct" | "money" | "ratio" | "rating" | "count";
export type MetricGroup = "Performance" | "Risk" | "Discipline";

export interface MetricDef {
  label: string;
  group: MetricGroup;
  unit: Unit;
  /** Default target that earns an A (4.0) and value that earns an F (0.0). */
  a: number;
  f: number;
  help: string;
}

export const METRICS = {
  netPnl: { label: "Net P&L", group: "Performance", unit: "money", a: 2000, f: -1000, help: "Total net profit in the period." },
  avgDayPnl: { label: "Average day P&L", group: "Performance", unit: "money", a: 300, f: -200, help: "Net P&L per trading day." },
  expectancy: { label: "Expectancy per trade", group: "Performance", unit: "money", a: 50, f: -25, help: "Average net P&L per trade." },
  winRate: { label: "Trade win %", group: "Performance", unit: "pct", a: 0.6, f: 0.35, help: "Share of trades that made money." },
  dayWinRate: { label: "Day win %", group: "Performance", unit: "pct", a: 0.7, f: 0.3, help: "Share of trading days that ended green." },
  profitFactor: { label: "Profit factor", group: "Performance", unit: "ratio", a: 2, f: 0.8, help: "Gross profit divided by gross loss." },
  avgWinLoss: { label: "Avg win / avg loss", group: "Performance", unit: "ratio", a: 2, f: 0.7, help: "Size of the average win against the average loss." },
  maxDrawdown: { label: "Max drawdown", group: "Risk", unit: "money", a: 500, f: 3000, help: "Largest drop from a P&L peak, trade by trade. Lower is better." },
  worstDay: { label: "Worst day", group: "Risk", unit: "money", a: -300, f: -1500, help: "The most negative trading day." },
  largestLoss: { label: "Largest losing trade", group: "Risk", unit: "money", a: -200, f: -1000, help: "The single worst trade." },
  bestDayShare: { label: "Best day % of profit", group: "Risk", unit: "pct", a: 0.3, f: 0.7, help: "How much of the profit came from one day. Lower means more consistent." },
  tradesPerDay: { label: "Trades per day", group: "Risk", unit: "count", a: 5, f: 15, help: "Average number of trades on a trading day. Lower guards against overtrading." },
  ruleAdherence: { label: "Rules followed", group: "Discipline", unit: "pct", a: 0.95, f: 0.6, help: "Share of checklist rules marked followed, of all rules reviewed on trading days." },
  checklistDays: { label: "Checklist completed", group: "Discipline", unit: "pct", a: 0.9, f: 0.3, help: "Share of trading days where every rule was checked off." },
  journalDays: { label: "Journaled", group: "Discipline", unit: "pct", a: 0.9, f: 0.3, help: "Share of trading days with a written journal entry." },
  routineDays: { label: "Checklist and journal", group: "Discipline", unit: "pct", a: 0.9, f: 0.3, help: "Share of trading days with the full checklist and a journal entry." },
  psychAvg: { label: "Psychology rating", group: "Discipline", unit: "rating", a: 4.5, f: 2, help: "Average of discipline, patience and emotional control ratings on trading days, 1 to 5." },
} satisfies Record<string, MetricDef>;

export type MetricId = keyof typeof METRICS;
export const METRIC_IDS = Object.keys(METRICS) as MetricId[];
export const GROUPS: MetricGroup[] = ["Performance", "Risk", "Discipline"];

export function isMetricId(x: string): x is MetricId {
  return x in METRICS;
}

/* ---------- context ---------- */

export interface ScoreInput {
  trades: Trade[]; // already filtered to the range
  journals: Record<string, DayJournal>;
  rules: Rule[];
  settings: Settings;
  range: DateRange;
}

interface Ctx {
  trades: Trade[];
  journals: Record<string, DayJournal>;
  enabledRules: Rule[];
  settings: Settings;
  days: string[]; // traded days, the days discipline metrics are measured over
}

function inRange(d: string, r: DateRange): boolean {
  return (!r.from || d >= r.from) && (!r.to || d <= r.to);
}

/**
 * Days the discipline metrics are measured over: the days the trader traded.
 * A day without trades needs no checklist or journal, so it never counts against them.
 */
export function tradedDays(input: ScoreInput): string[] {
  return [...new Set(input.trades.map((t) => tradeDay(t, input.settings)))].sort();
}

export function maxDrawdown(trades: Trade[], s: Settings): number {
  let run = 0;
  let peak = 0;
  let dd = 0;
  for (const t of sortByExit(trades)) {
    run += netPnl(t, s);
    peak = Math.max(peak, run);
    dd = Math.max(dd, peak - run);
  }
  return trades.length ? dd : NaN;
}

function checklistDone(j: DayJournal | undefined, rules: Rule[]): boolean {
  return !!j && rules.length > 0 && rules.every((r) => r.id in j.rules);
}
function journaled(j: DayJournal | undefined): boolean {
  return !!j && j.notes.trim().length > 0;
}
const share = (n: number, d: number) => (d > 0 ? n / d : NaN);

export function metricValue(id: MetricId, c: Ctx): number {
  const { trades, settings, journals, enabledRules, days } = c;
  switch (id) {
    case "netPnl":
    case "avgDayPnl":
    case "expectancy":
    case "winRate":
    case "dayWinRate":
    case "profitFactor":
    case "avgWinLoss":
    case "bestDayShare":
    case "tradesPerDay": {
      if (!trades.length) return NaN;
      const s = summarize(trades, settings);
      if (id === "netPnl") return s.totalPnl;
      if (id === "avgDayPnl") return s.totalPnl / s.dayCount;
      if (id === "expectancy") return s.totalPnl / s.tradeCount;
      if (id === "winRate") return s.winRate;
      if (id === "dayWinRate") return s.dayWinRate;
      if (id === "profitFactor") return s.profitFactor;
      if (id === "avgWinLoss") return s.avgWinLossRatio;
      if (id === "bestDayShare") return s.bestDayPct;
      return s.tradeCount / s.dayCount;
    }
    case "maxDrawdown":
      return maxDrawdown(trades, settings);
    case "worstDay": {
      const ds = groupByDay(trades, settings);
      return ds.length ? Math.min(...ds.map((d) => d.pnl)) : NaN;
    }
    case "largestLoss":
      return trades.length ? Math.min(...trades.map((t) => netPnl(t, settings))) : NaN;
    case "ruleAdherence": {
      let followed = 0;
      let reviewed = 0;
      for (const d of days) {
        const j = journals[d];
        if (!j) continue;
        for (const r of enabledRules) {
          if (!(r.id in j.rules)) continue;
          reviewed++;
          if (j.rules[r.id]) followed++;
        }
      }
      return share(followed, reviewed);
    }
    case "checklistDays":
      return enabledRules.length ? share(days.filter((d) => checklistDone(journals[d], enabledRules)).length, days.length) : NaN;
    case "journalDays":
      return share(days.filter((d) => journaled(journals[d])).length, days.length);
    case "routineDays":
      return enabledRules.length
        ? share(days.filter((d) => checklistDone(journals[d], enabledRules) && journaled(journals[d])).length, days.length)
        : NaN;
    case "psychAvg": {
      const xs = days.flatMap((d) => {
        const p = journals[d]?.psych;
        return p ? [p.discipline, p.patience, p.emotion].filter((x): x is number => typeof x === "number") : [];
      });
      return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN;
    }
  }
}

/* ---------- grading ---------- */

/** Grade points 0–4: `a` earns 4, `f` earns 0, linear between, clamped. Works in either direction. */
export function gradePoints(value: number, a: number, f: number): number {
  if (Number.isNaN(value)) return NaN;
  if (a === f) return value === a ? 4 : 0;
  if (!Number.isFinite(value)) return (value > 0) === a > f ? 4 : 0;
  const t = (value - f) / (a - f);
  return Math.max(0, Math.min(1, t)) * 4;
}

export function letterFor(gpa: number): string {
  if (!Number.isFinite(gpa)) return "–";
  const scale: [number, string][] = [
    [3.85, "A"], [3.5, "A-"], [3.15, "B+"], [2.85, "B"], [2.5, "B-"], [2.15, "C+"],
    [1.85, "C"], [1.5, "C-"], [1.15, "D+"], [0.85, "D"], [0.5, "D-"],
  ];
  return scale.find(([min]) => gpa >= min)?.[1] ?? "F";
}

export interface ComponentScore {
  component: ScorecardComponent;
  def: MetricDef | undefined;
  value: number;
  points: number; // NaN when there is no data
  share: number; // of the counted weight, 0–1
}

export interface ScorecardResult {
  gpa: number;
  letter: string;
  parts: ComponentScore[];
  counted: number;
  days: number;
}

export function scoreScorecard(sc: Scorecard, input: ScoreInput): ScorecardResult {
  const days = tradedDays(input);
  const ctx: Ctx = {
    trades: input.trades,
    journals: input.journals,
    enabledRules: input.rules.filter((r) => r.enabled),
    settings: input.settings,
    days,
  };
  const raw = sc.components.map((component) => {
    const def = isMetricId(component.metric) ? METRICS[component.metric] : undefined;
    const value = def ? metricValue(component.metric as MetricId, ctx) : NaN;
    return { component, def, value, points: gradePoints(value, component.a, component.f) };
  });
  const live = raw.filter((p) => Number.isFinite(p.points) && p.component.weight > 0);
  const total = live.reduce((a, p) => a + p.component.weight, 0);
  const gpa = total > 0 ? live.reduce((a, p) => a + p.points * p.component.weight, 0) / total : NaN;
  return {
    gpa,
    letter: letterFor(gpa),
    parts: raw.map((p) => ({ ...p, share: total > 0 && Number.isFinite(p.points) ? p.component.weight / total : 0 })),
    counted: live.length,
    days: days.length,
  };
}

/** GPA for each Monday-starting week of the range that has activity, oldest first. */
export function weeklyGpa(sc: Scorecard, input: ScoreInput, maxWeeks = 8): { week: string; gpa: number }[] {
  const all = tradedDays(input);
  if (!all.length) return [];
  const monday = (d: string) => addDays(d, -((parseDayKey(d).getDay() + 6) % 7));
  const weeks = [...new Set(all.map(monday))].sort().slice(-maxWeeks);
  return weeks
    .map((w) => {
      const end = addDays(w, 6);
      const from = input.range.from && input.range.from > w ? input.range.from : w;
      const to = input.range.to && input.range.to < end ? input.range.to : end;
      const range = { from, to };
      const trades = input.trades.filter((t) => inRange(tradeDay(t, input.settings), range));
      return { week: w, gpa: scoreScorecard(sc, { ...input, trades, range }).gpa };
    })
    .filter((x) => Number.isFinite(x.gpa));
}

/* ---------- formatting and defaults ---------- */

export function formatMetric(id: string, v: number): string {
  if (!isMetricId(id)) return "—";
  if (Number.isNaN(v)) return "no data";
  const unit = METRICS[id].unit;
  if (unit === "pct") return fmtPct(v, 0);
  if (unit === "money") return fmtMoney(v);
  if (unit === "rating") return `${fmtNum(v, 1)} / 5`;
  if (unit === "ratio") return Number.isFinite(v) ? fmtNum(v, 2) : "∞";
  return fmtNum(v, 1);
}

/** Factor between stored values and what the user types (percent shown as 0–100). */
export function inputScale(id: string): number {
  return isMetricId(id) && METRICS[id].unit === "pct" ? 100 : 1;
}

export function newComponent(metric: MetricId, weight = 10): ScorecardComponent {
  const d = METRICS[metric];
  return { id: `c-${metric}-${Math.random().toString(36).slice(2, 7)}`, metric, weight, a: d.a, f: d.f };
}

export function defaultScorecards(): Scorecard[] {
  const c = (m: MetricId, w: number): ScorecardComponent => ({ ...newComponent(m, w), id: `c-${m}` });
  return [
    {
      id: "sc-overall",
      name: "Overall GPA",
      components: [
        c("winRate", 15),
        c("profitFactor", 20),
        c("avgWinLoss", 15),
        c("dayWinRate", 10),
        c("bestDayShare", 10),
        c("ruleAdherence", 15),
        c("routineDays", 15),
      ],
    },
  ];
}
