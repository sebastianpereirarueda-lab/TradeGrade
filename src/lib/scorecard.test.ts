import { describe, expect, it } from "vitest";
import { defaultScorecards, gradePoints, letterFor, maxDrawdown, scoreScorecard, weeklyGpa, newComponent, formatMetric } from "./scorecard";
import type { DayJournal, Rule, Scorecard, Settings, Trade } from "./types";

const S: Settings = { startingBalance: 0, pnlIsNet: true, sessionStartHour: 0 };
const t = (id: string, day: number, pnl: number, hour = 10): Trade => ({
  id, contract: "MNQZ6", size: 1, direction: "Long", entryPrice: 1, exitPrice: 1, commissions: 0, fees: 0, pnl,
  entryTime: new Date(2026, 9, day, hour, 0).getTime(), exitTime: new Date(2026, 9, day, hour, 5).getTime(),
});
const rules: Rule[] = [
  { id: "r1", text: "a", enabled: true },
  { id: "r2", text: "b", enabled: true },
  { id: "r3", text: "off", enabled: false },
];
const j = (date: string, notes: string, r: Record<string, boolean>, psych: DayJournal["psych"] = {}): DayJournal => ({ date, notes, rules: r, psych, updatedAt: 1 });
const card = (...parts: [string, number, number, number][]): Scorecard => ({
  id: "x", name: "x",
  components: parts.map(([metric, weight, a, f]) => ({ id: metric, metric, weight, a, f })),
});

describe("grading", () => {
  it("interpolates between F and A in either direction and clamps", () => {
    expect(gradePoints(0.6, 0.6, 0.35)).toBe(4);
    expect(gradePoints(0.35, 0.6, 0.35)).toBe(0);
    expect(gradePoints(0.475, 0.6, 0.35)).toBeCloseTo(2);
    expect(gradePoints(0.9, 0.6, 0.35)).toBe(4);
    expect(gradePoints(1750, 500, 3000)).toBeCloseTo(2); // lower is better
    expect(gradePoints(Infinity, 2, 0.8)).toBe(4);
    expect(Number.isNaN(gradePoints(NaN, 1, 0))).toBe(true);
  });
  it("maps GPA to letters", () => {
    expect(letterFor(4)).toBe("A");
    expect(letterFor(3.6)).toBe("A-");
    expect(letterFor(3.0)).toBe("B");
    expect(letterFor(2.2)).toBe("C+");
    expect(letterFor(0.2)).toBe("F");
    expect(letterFor(NaN)).toBe("–");
  });
});

describe("scorecards", () => {
  const trades = [t("1", 5, 100), t("2", 5, -50), t("3", 6, 200), t("4", 7, -100)]; // Mon 5, Tue 6, Wed 7 Oct 2026
  const journals: Record<string, DayJournal> = {
    "2026-10-05": j("2026-10-05", "plan held", { r1: true, r2: true }, { discipline: 5, patience: 4 }),
    "2026-10-06": j("2026-10-06", "", { r1: true, r2: false }),
    "2026-10-07": j("2026-10-07", "chased", { r1: false }),
    "2026-10-08": j("2026-10-08", "no trades today, reviewed charts", { r1: true, r2: true }), // not traded
  };
  const input = { trades, journals, rules, settings: S, range: { from: null, to: null } };

  it("weights grades and skips metrics without data", () => {
    // winRate 2/4 = 0.5 -> (0.5-0.35)/(0.6-0.35)*4 = 2.4 ; psych avg 4.5 -> 4 ; worstDay with no trades n/a
    const r = scoreScorecard(card(["winRate", 30, 0.6, 0.35], ["psychAvg", 10, 4.5, 2]), input);
    expect(r.gpa).toBeCloseTo((2.4 * 30 + 4 * 10) / 40);
    const empty = scoreScorecard(card(["worstDay", 10, -300, -1500], ["winRate", 0, 0.6, 0.35]), { ...input, trades: [] });
    expect(Number.isNaN(empty.gpa)).toBe(true);
    expect(empty.letter).toBe("–");
  });

  it("measures checklist and journal only on days that were traded", () => {
    const r = scoreScorecard(
      card(["checklistDays", 1, 1, 0], ["journalDays", 1, 1, 0], ["routineDays", 1, 1, 0], ["ruleAdherence", 1, 1, 0]),
      input,
    );
    const v = Object.fromEntries(r.parts.map((p) => [p.component.metric, p.value]));
    expect(r.days).toBe(3); // the 8th has a journal but no trades, so it does not count
    expect(v.checklistDays).toBeCloseTo(2 / 3); // 5th and 6th fully reviewed; 7th missing r2
    expect(v.journalDays).toBeCloseTo(2 / 3); // 5th and 7th have notes
    expect(v.routineDays).toBeCloseTo(1 / 3); // only the 5th has both
    expect(v.ruleAdherence).toBeCloseTo(3 / 5); // followed r1,r2 (5th), r1 (6th) of 5 reviewed
  });

  it("computes risk metrics", () => {
    expect(maxDrawdown([t("a", 5, 100), t("b", 5, -150, 11), t("c", 5, 30, 12), t("d", 5, -40, 13)], S)).toBe(160);
    const r = scoreScorecard(card(["worstDay", 1, -300, -1500], ["largestLoss", 1, -200, -1000], ["tradesPerDay", 1, 5, 15]), input);
    const v = Object.fromEntries(r.parts.map((p) => [p.component.metric, p.value]));
    expect(v.worstDay).toBe(-100);
    expect(v.largestLoss).toBe(-100);
    expect(v.tradesPerDay).toBeCloseTo(4 / 3);
  });

  it("scores the default card and gives a weekly trend", () => {
    const [sc] = defaultScorecards();
    const r = scoreScorecard(sc, input);
    expect(r.counted).toBe(sc.components.length);
    expect(r.gpa).toBeGreaterThanOrEqual(0);
    expect(r.gpa).toBeLessThanOrEqual(4);
    const weekly = weeklyGpa(sc, { ...input, trades: [...trades, t("5", 13, 50)] });
    expect(weekly.map((w) => w.week)).toEqual(["2026-10-05", "2026-10-12"]);
  });

  it("formats values and builds components with catalog defaults", () => {
    expect(newComponent("winRate")).toMatchObject({ metric: "winRate", a: 0.6, f: 0.35, weight: 10 });
    expect(formatMetric("winRate", 0.524)).toBe("52%");
    expect(formatMetric("psychAvg", 4.25)).toBe("4.3 / 5");
    expect(formatMetric("profitFactor", Infinity)).toBe("∞");
    expect(formatMetric("netPnl", NaN)).toBe("no data");
  });
});
