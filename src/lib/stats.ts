import type { Trade, DateRange, DayJournal, Rule, Settings } from "./types";
import { dayKey, tradingDay, weekdayName, parseDayKey, WEEKDAYS } from "./dates";

/** Net P&L of a trade after commissions and fees (unless pnl is already net). */
export function netPnl(t: Trade, s: Settings): number {
  return s.pnlIsNet ? t.pnl : t.pnl - t.commissions - t.fees;
}

/** Trading day of a trade (by exit time, with the session rollover applied). */
export function tradeDay(t: Trade, s: Settings): string {
  return tradingDay(t.exitTime, s.sessionStartHour);
}

export function durationMs(t: Trade): number {
  return t.exitTime - t.entryTime;
}

export function filterByRange(trades: Trade[], range: DateRange, s: Settings): Trade[] {
  return trades.filter((t) => {
    const k = tradeDay(t, s);
    if (range.from && k < range.from) return false;
    if (range.to && k > range.to) return false;
    return true;
  });
}

export function sortByExit(trades: Trade[]): Trade[] {
  return [...trades].sort((a, b) => a.exitTime - b.exitTime);
}

export interface DaySummary {
  date: string;
  pnl: number;
  trades: number;
  wins: number;
  lots: number;
}

export function groupByDay(trades: Trade[], s: Settings): DaySummary[] {
  const map = new Map<string, DaySummary>();
  for (const t of trades) {
    const k = tradeDay(t, s);
    const p = netPnl(t, s);
    const day = map.get(k) ?? { date: k, pnl: 0, trades: 0, wins: 0, lots: 0 };
    day.pnl += p;
    day.trades += 1;
    day.wins += p > 0 ? 1 : 0;
    day.lots += t.size;
    map.set(k, day);
  }
  return [...map.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
}

export interface CumPoint {
  date: string;
  daily: number;
  cumulative: number;
}

export function cumulativeByDay(days: DaySummary[]): CumPoint[] {
  let run = 0;
  return days.map((d) => {
    run += d.pnl;
    return { date: d.date, daily: d.pnl, cumulative: run };
  });
}

export interface TradeExtreme {
  trade: Trade;
  pnl: number;
}

export interface WeekdayStat {
  weekday: string;
  pnl: number;
  trades: number;
  activeDays: number;
}

export interface Summary {
  totalPnl: number;
  tradeCount: number;
  wins: number;
  losses: number;
  breakeven: number;
  winRate: number;
  grossProfit: number;
  grossLoss: number; // positive magnitude
  profitFactor: number;
  avgWin: number;
  avgLoss: number; // negative number
  avgWinLossRatio: number;
  dayCount: number;
  winningDays: number;
  dayWinRate: number;
  bestDayPct: number; // best day pnl / total profit of winning days
  totalLots: number;
  avgDuration: number;
  avgWinDuration: number;
  avgLossDuration: number;
  longCount: number;
  shortCount: number;
  longPct: number;
  bestTrade: TradeExtreme | null;
  worstTrade: TradeExtreme | null;
  mostActive: WeekdayStat | null;
  mostProfitable: WeekdayStat | null;
  leastProfitable: WeekdayStat | null;
}

function avg(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN;
}

export function summarize(trades: Trade[], s: Settings): Summary {
  const pnls = trades.map((t) => netPnl(t, s));
  const winsArr = trades.filter((t) => netPnl(t, s) > 0);
  const lossArr = trades.filter((t) => netPnl(t, s) < 0);
  const grossProfit = winsArr.reduce((a, t) => a + netPnl(t, s), 0);
  const grossLoss = -lossArr.reduce((a, t) => a + netPnl(t, s), 0);
  const days = groupByDay(trades, s);
  const winningDays = days.filter((d) => d.pnl > 0);
  const bestDay = winningDays.reduce((m, d) => Math.max(m, d.pnl), 0);

  let best: TradeExtreme | null = null;
  let worst: TradeExtreme | null = null;
  for (const t of trades) {
    const p = netPnl(t, s);
    if (!best || p > best.pnl) best = { trade: t, pnl: p };
    if (!worst || p < worst.pnl) worst = { trade: t, pnl: p };
  }

  const byWeekday = new Map<string, WeekdayStat & { days: Set<string> }>();
  for (const d of days) {
    const w = weekdayName(d.date);
    const s = byWeekday.get(w) ?? { weekday: w, pnl: 0, trades: 0, activeDays: 0, days: new Set() };
    s.pnl += d.pnl;
    s.trades += d.trades;
    s.days.add(d.date);
    byWeekday.set(w, s);
  }
  const weekdays = [...byWeekday.values()].map((s) => ({ ...s, activeDays: s.days.size }));
  const pick = (f: (a: WeekdayStat, b: WeekdayStat) => boolean) =>
    weekdays.reduce<WeekdayStat | null>((m, s) => (m === null || f(s, m) ? s : m), null);

  const longCount = trades.filter((t) => t.direction === "Long").length;
  const avgWin = avg(winsArr.map((t) => netPnl(t, s)));
  const avgLoss = avg(lossArr.map((t) => netPnl(t, s)));

  return {
    totalPnl: pnls.reduce((a, b) => a + b, 0),
    tradeCount: trades.length,
    wins: winsArr.length,
    losses: lossArr.length,
    breakeven: trades.length - winsArr.length - lossArr.length,
    winRate: trades.length ? winsArr.length / trades.length : NaN,
    grossProfit,
    grossLoss,
    profitFactor: grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : NaN,
    avgWin,
    avgLoss,
    avgWinLossRatio: avgLoss < 0 ? avgWin / -avgLoss : NaN,
    dayCount: days.length,
    winningDays: winningDays.length,
    dayWinRate: days.length ? winningDays.length / days.length : NaN,
    bestDayPct: grossProfit > 0 && winningDays.length ? bestDay / winningDays.reduce((a, d) => a + d.pnl, 0) : NaN,
    totalLots: trades.reduce((a, t) => a + t.size, 0),
    avgDuration: avg(trades.map(durationMs)),
    avgWinDuration: avg(winsArr.map(durationMs)),
    avgLossDuration: avg(lossArr.map(durationMs)),
    longCount,
    shortCount: trades.length - longCount,
    longPct: trades.length ? longCount / trades.length : NaN,
    bestTrade: best,
    worstTrade: worst,
    mostActive: pick((a, b) => a.trades > b.trades),
    mostProfitable: pick((a, b) => a.pnl > b.pnl),
    leastProfitable: pick((a, b) => a.pnl < b.pnl),
  };
}

/* ---------- Duration buckets ---------- */

export const DURATION_BUCKETS: { label: string; maxMs: number }[] = [
  { label: "Under 15 sec", maxMs: 15_000 },
  { label: "15-45 sec", maxMs: 45_000 },
  { label: "45 sec - 1 min", maxMs: 60_000 },
  { label: "1 min - 2 min", maxMs: 2 * 60_000 },
  { label: "2 min - 5 min", maxMs: 5 * 60_000 },
  { label: "5 min - 10 min", maxMs: 10 * 60_000 },
  { label: "10 min - 30 min", maxMs: 30 * 60_000 },
  { label: "30 min - 1 hour", maxMs: 60 * 60_000 },
  { label: "1 hour - 2 hours", maxMs: 2 * 3_600_000 },
  { label: "2 hours - 4 hours", maxMs: 4 * 3_600_000 },
  { label: "4 hours and up", maxMs: Infinity },
];

export interface BucketStat {
  label: string;
  count: number;
  wins: number;
  winRate: number; // NaN when empty
  pnl: number;
}

export function durationBuckets(trades: Trade[], s: Settings): BucketStat[] {
  const out = DURATION_BUCKETS.map((b) => ({ label: b.label, count: 0, wins: 0, winRate: NaN, pnl: 0 }));
  for (const t of trades) {
    const d = durationMs(t);
    const i = DURATION_BUCKETS.findIndex((b) => d < b.maxMs);
    const b = out[i === -1 ? out.length - 1 : i];
    const p = netPnl(t, s);
    b.count += 1;
    b.wins += p > 0 ? 1 : 0;
    b.pnl += p;
  }
  for (const b of out) b.winRate = b.count ? b.wins / b.count : NaN;
  return out;
}

/* ---------- Time of day ---------- */

export interface HourStat {
  hour: number; // 0-23 local, by entry time
  label: string;
  count: number;
  wins: number;
  winRate: number;
  pnl: number;
}

export function byHour(trades: Trade[], s: Settings): HourStat[] {
  const out: HourStat[] = Array.from({ length: 24 }, (_, h) => ({
    hour: h,
    label: `${String(h).padStart(2, "0")}:00`,
    count: 0,
    wins: 0,
    winRate: NaN,
    pnl: 0,
  }));
  for (const t of trades) {
    const h = new Date(t.entryTime).getHours();
    const p = netPnl(t, s);
    out[h].count += 1;
    out[h].wins += p > 0 ? 1 : 0;
    out[h].pnl += p;
  }
  for (const b of out) b.winRate = b.count ? b.wins / b.count : NaN;
  return out.filter((b) => b.count > 0);
}

export function byWeekdayAll(trades: Trade[], s: Settings): WeekdayStat[] {
  const days = groupByDay(trades, s);
  return WEEKDAYS.map((w) => {
    const mine = days.filter((d) => weekdayName(d.date) === w);
    return {
      weekday: w,
      pnl: mine.reduce((a, d) => a + d.pnl, 0),
      trades: mine.reduce((a, d) => a + d.trades, 0),
      activeDays: mine.length,
    };
  }).filter((w) => w.activeDays > 0);
}

/* ---------- Intraday curve for one day ---------- */

export interface IntradayPoint {
  time: number;
  pnl: number;
}

export function intradayCurve(trades: Trade[], s: Settings): IntradayPoint[] {
  const sorted = sortByExit(trades);
  if (!sorted.length) return [];
  let run = 0;
  const pts: IntradayPoint[] = [{ time: sorted[0].entryTime, pnl: 0 }];
  for (const t of sorted) {
    run += netPnl(t, s);
    pts.push({ time: t.exitTime, pnl: run });
  }
  return pts;
}

/* ---------- Loss size (points) distribution: stop-loss guidance ---------- */

export function pointsMoved(t: Trade): number {
  const raw = t.exitPrice - t.entryPrice;
  return t.direction === "Long" ? raw : -raw;
}

export interface Percentiles {
  n: number;
  median: number;
  p75: number;
  p90: number;
  max: number;
}

export function percentiles(xs: number[]): Percentiles {
  const s = [...xs].sort((a, b) => a - b);
  const q = (p: number) => (s.length ? s[Math.min(s.length - 1, Math.floor(p * (s.length - 1)))] : NaN);
  return { n: s.length, median: q(0.5), p75: q(0.75), p90: q(0.9), max: s.length ? s[s.length - 1] : NaN };
}

/* ---------- Discipline: rules & psychology vs results ---------- */

export interface RuleStat {
  rule: Rule;
  reviewedDays: number;
  followedDays: number;
  adherence: number; // followed / reviewed
  pnlFollowed: number; // avg day pnl when followed
  pnlBroken: number; // avg day pnl when broken
}

export function ruleStats(days: DaySummary[], journals: Record<string, DayJournal>, rules: Rule[]): RuleStat[] {
  return rules
    .filter((r) => r.enabled)
    .map((rule) => {
      const followed: number[] = [];
      const broken: number[] = [];
      for (const d of days) {
        const j = journals[d.date];
        if (!j || !(rule.id in j.rules)) continue;
        (j.rules[rule.id] ? followed : broken).push(d.pnl);
      }
      return {
        rule,
        reviewedDays: followed.length + broken.length,
        followedDays: followed.length,
        adherence: followed.length + broken.length ? followed.length / (followed.length + broken.length) : NaN,
        pnlFollowed: avg(followed),
        pnlBroken: avg(broken),
      };
    });
}

/** Letter grade for a day from its psych ratings and rule adherence. */
export function dayGrade(j: DayJournal | undefined, rules: Rule[]): { letter: string; score: number } | null {
  if (!j) return null;
  const psych = [j.psych.discipline, j.psych.patience, j.psych.emotion].filter(
    (x): x is number => typeof x === "number",
  );
  const enabled = rules.filter((r) => r.enabled);
  const reviewed = enabled.filter((r) => r.id in j.rules);
  if (!psych.length && !reviewed.length) return null;
  const parts: number[] = [];
  if (psych.length) parts.push((avg(psych) - 1) / 4); // 0..1
  if (reviewed.length) parts.push(reviewed.filter((r) => j.rules[r.id]).length / reviewed.length);
  const score = avg(parts);
  const letter = score >= 0.9 ? "A" : score >= 0.75 ? "B" : score >= 0.6 ? "C" : score >= 0.45 ? "D" : "F";
  return { letter, score };
}

export interface GradeBucket {
  grade: string;
  days: number;
  pnl: number;
  avgPnl: number;
  winRate: number;
}

export function pnlByGrade(days: DaySummary[], journals: Record<string, DayJournal>, rules: Rule[]): GradeBucket[] {
  const map = new Map<string, DaySummary[]>();
  for (const d of days) {
    const g = dayGrade(journals[d.date], rules);
    if (!g) continue;
    map.set(g.letter, [...(map.get(g.letter) ?? []), d]);
  }
  return ["A", "B", "C", "D", "F"]
    .filter((g) => map.has(g))
    .map((g) => {
      const ds = map.get(g)!;
      const pnl = ds.reduce((a, d) => a + d.pnl, 0);
      return {
        grade: g,
        days: ds.length,
        pnl,
        avgPnl: pnl / ds.length,
        winRate: ds.filter((d) => d.pnl > 0).length / ds.length,
      };
    });
}

export function monthDays(year: number, month0: number): string[] {
  const out: string[] = [];
  const d = new Date(year, month0, 1);
  while (d.getMonth() === month0) {
    out.push(dayKey(d));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

export function firstWeekdayOffset(key: string): number {
  return parseDayKey(key).getDay();
}
