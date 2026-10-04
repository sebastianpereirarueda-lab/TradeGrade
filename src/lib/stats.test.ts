import { describe, expect, it } from "vitest";
import { dayGrade, durationBuckets, groupByDay, netPnl, summarize } from "./stats";
import { parseTradesCsv } from "./importers/csv";
import { mergeTrades } from "./importers/rows";
import { parseTimestamp, rootSymbol, tradingDay } from "./dates";
import type { Settings, Trade } from "./types";

const GROSS: Settings = { startingBalance: 0, pnlIsNet: false, sessionStartHour: 0 };
const NET: Settings = { ...GROSS, pnlIsNet: true };

const base = (over: Partial<Trade>): Trade => ({
  id: "1",
  contract: "/MNQ",
  size: 1,
  entryTime: new Date(2026, 8, 29, 18, 0, 0).getTime(),
  exitTime: new Date(2026, 8, 29, 18, 5, 0).getTime(),
  entryPrice: 100,
  exitPrice: 110,
  pnl: 100,
  commissions: 1,
  fees: 1,
  direction: "Long",
  ...over,
});

describe("stats", () => {
  it("subtracts commissions and fees unless pnl is net", () => {
    const t = base({});
    expect(netPnl(t, GROSS)).toBe(98);
    expect(netPnl(t, NET)).toBe(100);
  });

  it("summarizes wins, losses, profit factor and day win rate", () => {
    const trades = [
      base({ id: "a", pnl: 200 }),
      base({ id: "b", pnl: -100, exitTime: new Date(2026, 8, 29, 19, 0).getTime() }),
      base({ id: "c", pnl: -52, entryTime: new Date(2026, 8, 30, 18, 0).getTime(), exitTime: new Date(2026, 8, 30, 18, 1).getTime() }),
    ];
    const s = summarize(trades, GROSS);
    expect(s.tradeCount).toBe(3);
    expect(s.wins).toBe(1);
    expect(s.losses).toBe(2);
    expect(s.totalPnl).toBeCloseTo(198 - 102 - 54);
    expect(s.profitFactor).toBeCloseTo(198 / 156);
    expect(s.dayCount).toBe(2);
    expect(s.winningDays).toBe(1);
    expect(s.dayWinRate).toBeCloseTo(0.5);
    expect(s.bestTrade?.trade.id).toBe("a");
    expect(s.worstTrade?.trade.id).toBe("b");
    expect(s.mostProfitable?.weekday).toBe("Tuesday");
    expect(s.leastProfitable?.weekday).toBe("Wednesday");
  });

  it("groups by exit day", () => {
    const days = groupByDay([base({}), base({ id: "2", pnl: -50 })], NET);
    expect(days).toHaveLength(1);
    expect(days[0].pnl).toBe(50);
    expect(days[0].wins).toBe(1);
  });

  it("buckets durations", () => {
    const b = durationBuckets([base({}), base({ id: "2", exitTime: base({}).entryTime + 10_000 })], NET);
    expect(b.find((x) => x.label === "5 min - 10 min")?.count).toBe(1);
    expect(b.find((x) => x.label === "Under 15 sec")?.count).toBe(1);
  });

  it("rolls evening trades into the next trading day", () => {
    const evening = new Date(2026, 8, 30, 19, 59, 6).getTime();
    expect(tradingDay(evening, 18)).toBe("2026-10-01");
    expect(tradingDay(evening, 0)).toBe("2026-09-30");
    const morning = new Date(2026, 9, 1, 9, 30).getTime();
    expect(tradingDay(morning, 18)).toBe("2026-10-01");
    const days = groupByDay([base({ exitTime: evening, entryTime: evening - 60_000 })], { ...NET, sessionStartHour: 18 });
    expect(days[0].date).toBe("2026-10-01");
  });

  it("prefers the export's own trade day over the rollover", () => {
    const t = base({ exitTime: new Date(2026, 8, 23, 9, 30).getTime(), tradeDay: "2026-09-24" });
    expect(groupByDay([t], { ...NET, sessionStartHour: 18 })[0].date).toBe("2026-09-24");
  });

  it("extracts root symbols", () => {
    expect(rootSymbol("ESZ26")).toBe("ES");
    expect(rootSymbol("MNQZ26")).toBe("MNQ");
    expect(rootSymbol("/MNQ")).toBe("MNQ");
    expect(rootSymbol("NQ")).toBe("NQ");
  });

  it("grades a day from psych ratings and rule adherence", () => {
    const rules = [
      { id: "r1", text: "a", enabled: true },
      { id: "r2", text: "b", enabled: true },
    ];
    expect(dayGrade(undefined, rules)).toBeNull();
    const g = dayGrade(
      { date: "2026-09-29", notes: "", rules: { r1: true, r2: true }, psych: { discipline: 5, patience: 5, emotion: 5 }, updatedAt: 0 },
      rules,
    );
    expect(g?.letter).toBe("A");
    const bad = dayGrade({ date: "x", notes: "", rules: { r1: false, r2: false }, psych: { discipline: 1 }, updatedAt: 0 }, rules);
    expect(bad?.letter).toBe("F");
  });
});

describe("csv", () => {
  it("parses US timestamps with and without AM/PM", () => {
    expect(parseTimestamp("09/29/2026 20:16:12")).toBe(new Date(2026, 8, 29, 20, 16, 12).getTime());
    expect(parseTimestamp("9/29/2026 8:16:12 PM")).toBe(new Date(2026, 8, 29, 20, 16, 12).getTime());
    expect(parseTimestamp("2026-09-29T20:16:12")).toBe(new Date(2026, 8, 29, 20, 16, 12).getTime());
    expect(Number.isNaN(parseTimestamp("nope"))).toBe(true);
  });

  it("parses Topstep dashboard timestamps", () => {
    expect(parseTimestamp("September 30 2026 @ 7:59:06 pm")).toBe(new Date(2026, 8, 30, 19, 59, 6).getTime());
    expect(parseTimestamp("Sep 30, 2026 7:59 PM")).toBe(new Date(2026, 8, 30, 19, 59, 0).getTime());
    expect(parseTimestamp("October 1 2026 @ 12:05:00 am")).toBe(new Date(2026, 9, 1, 0, 5, 0).getTime());
  });

  it("parses Topstep money formats like $-1.00 and 7,743.50", () => {
    const csv = [
      "ID,Contract,Size,Entry Time,Exit Time,Duration,Entry Price,Exit Price,P&L,Commissions,Fees,Direction",
      "31558224,ESZ26,1,September 30 2026 @ 7:59:06 pm,September 30 2026 @ 8:24:31 pm,00:25:24,\"7,743.50\",\"7,735.00\",$425.00,$-1.00,$-2.78,Short",
    ].join("\n");
    const r = parseTradesCsv(csv);
    expect(r.trades).toHaveLength(1);
    expect(r.trades[0]).toMatchObject({ entryPrice: 7743.5, exitPrice: 7735, pnl: 425, commissions: 1, fees: 2.78, direction: "Short" });
  });

  it("parses a Topstep-style trade list", () => {
    const csv = [
      "ID,Contract,Size,Entry Time,Exit Time,Duration,Entry Price,Exit Price,P&L,Commissions,Fees,Direction",
      "101,/MNQ,5,09/29/2026 20:10:00,09/29/2026 20:16:12,6m,30725,30665,\"$596.40\",$3.50,$3.70,Short",
      "102,/ES,5,10/01/2026 19:50:00,10/01/2026 19:52:26,2m,7730.75,7733.75,(763.90),3.50,3.70,Short",
      "bad,,,,,,,,,,,",
    ].join("\n");
    const r = parseTradesCsv(csv);
    expect(r.errors).toEqual([]);
    expect(r.skipped).toBe(1);
    expect(r.trades).toHaveLength(2);
    expect(r.trades[0]).toMatchObject({ id: "101", contract: "/MNQ", size: 5, pnl: 596.4, commissions: 3.5, fees: 3.7, direction: "Short" });
    expect(r.trades[1].pnl).toBe(-763.9);
  });

  it("infers direction when the column is missing", () => {
    const csv = "Entry Time,Exit Time,Entry Price,Exit Price,P&L\n09/29/2026 20:10,09/29/2026 20:11,100,90,50";
    const r = parseTradesCsv(csv);
    expect(r.trades[0].direction).toBe("Short");
  });

  it("reports missing required columns", () => {
    const r = parseTradesCsv("foo,bar\n1,2");
    expect(r.errors.length).toBeGreaterThan(0);
  });

  it("merges by id, replacing duplicates", () => {
    const merged = mergeTrades([base({ id: "1", pnl: 1 })], [base({ id: "1", pnl: 2 }), base({ id: "2" })]);
    expect(merged).toHaveLength(2);
    expect(merged.find((t) => t.id === "1")?.pnl).toBe(2);
  });
});
