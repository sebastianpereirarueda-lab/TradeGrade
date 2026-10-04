import { useMemo, useState } from "react";
import { actions, useAppState } from "../lib/store";
import {
  byHour,
  byWeekdayAll,
  groupByDay,
  netPnl,
  percentiles,
  pnlByGrade,
  pointsMoved,
  ruleStats,
} from "../lib/stats";
import { fmtMoney, fmtNum, fmtPct } from "../lib/format";
import { Card, Empty, PnlText } from "../components/ui";
import { HourPnlChart } from "../components/charts";

export function RulesPage() {
  const { rules, trades, journals, settings } = useAppState();
  const [text, setText] = useState("");
  const net = settings.pnlIsNet;

  const days = useMemo(() => groupByDay(trades, net), [trades, net]);
  const rs = useMemo(() => ruleStats(days, journals, rules), [days, journals, rules]);
  const grades = useMemo(() => pnlByGrade(days, journals, rules), [days, journals, rules]);
  const hours = useMemo(() => byHour(trades, net), [trades, net]);
  const weekdays = useMemo(() => byWeekdayAll(trades, net), [trades, net]);
  const stops = useMemo(() => {
    const byContract = new Map<string, { losses: number[]; wins: number[] }>();
    for (const t of trades) {
      if (!Number.isFinite(t.entryPrice) || !Number.isFinite(t.exitPrice)) continue;
      const pts = pointsMoved(t);
      const g = byContract.get(t.contract) ?? { losses: [], wins: [] };
      (netPnl(t, net) < 0 ? g.losses : g.wins).push(Math.abs(pts));
      byContract.set(t.contract, g);
    }
    return [...byContract.entries()].map(([c, g]) => ({ contract: c, loss: percentiles(g.losses), win: percentiles(g.wins) }));
  }, [trades, net]);

  const reviewed = Object.values(journals).filter((j) => Object.keys(j.rules).length || Object.keys(j.psych).length).length;

  const add = () => {
    const t = text.trim();
    if (!t) return;
    actions.setRules([...rules, { id: `r-${Date.now().toString(36)}`, text: t, enabled: true }]);
    setText("");
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="My rules">
          <p className="mb-3 text-xs text-ink-3">
            Grade each day against these on the day page. Disabled rules stay in history but drop out of new checklists.
          </p>
          <ul className="space-y-2">
            {rules.map((r) => (
              <li key={r.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={r.enabled}
                  onChange={(e) => actions.setRules(rules.map((x) => (x.id === r.id ? { ...x, enabled: e.target.checked } : x)))}
                  title="Enabled"
                />
                <input
                  className="input flex-1 !py-1"
                  value={r.text}
                  onChange={(e) => actions.setRules(rules.map((x) => (x.id === r.id ? { ...x, text: e.target.value } : x)))}
                />
                <button
                  className="btn btn-danger !px-2"
                  onClick={() => {
                    if (confirm(`Delete rule "${r.text}"? Past day reviews of it are kept but hidden.`))
                      actions.setRules(rules.filter((x) => x.id !== r.id));
                  }}
                  title="Delete"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex gap-2">
            <input
              className="input flex-1"
              placeholder="New rule, e.g. “No trades in the first 5 minutes”"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && add()}
            />
            <button className="btn btn-accent" onClick={add}>
              Add
            </button>
          </div>
        </Card>

        <Card title="Discipline vs results">
          {reviewed === 0 ? (
            <Empty>Grade a few days on their day pages and this fills in.</Empty>
          ) : (
            <>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-ink-3">
                    <th className="py-1 font-medium">Day grade</th>
                    <th className="py-1 text-right font-medium">Days</th>
                    <th className="py-1 text-right font-medium">Day win %</th>
                    <th className="py-1 text-right font-medium">Avg day P&amp;L</th>
                    <th className="py-1 text-right font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {grades.map((g) => (
                    <tr key={g.grade} className="border-t border-line/60">
                      <td className="py-1.5 font-semibold">{g.grade}</td>
                      <td className="py-1.5 text-right num">{g.days}</td>
                      <td className="py-1.5 text-right num">{fmtPct(g.winRate, 0)}</td>
                      <td className="py-1.5 text-right num">
                        <PnlText value={g.avgPnl}>{fmtMoney(g.avgPnl)}</PnlText>
                      </td>
                      <td className="py-1.5 text-right num">
                        <PnlText value={g.pnl}>{fmtMoney(g.pnl)}</PnlText>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <h4 className="mb-1 mt-4 text-xs text-ink-3">Per rule</h4>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-ink-3">
                    <th className="py-1 font-medium">Rule</th>
                    <th className="py-1 text-right font-medium">Followed</th>
                    <th className="py-1 text-right font-medium">Avg day when followed</th>
                    <th className="py-1 text-right font-medium">when broken</th>
                  </tr>
                </thead>
                <tbody>
                  {rs.map((r) => (
                    <tr key={r.rule.id} className="border-t border-line/60">
                      <td className="py-1.5">{r.rule.text}</td>
                      <td className="py-1.5 text-right num">
                        {r.reviewedDays ? `${fmtPct(r.adherence, 0)} (${r.followedDays}/${r.reviewedDays})` : "—"}
                      </td>
                      <td className="py-1.5 text-right num">
                        <PnlText value={r.pnlFollowed || 0}>{fmtMoney(r.pnlFollowed)}</PnlText>
                      </td>
                      <td className="py-1.5 text-right num">
                        <PnlText value={r.pnlBroken || 0}>{fmtMoney(r.pnlBroken)}</PnlText>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Net P&L by entry hour">
          {hours.length ? <HourPnlChart data={hours} /> : <Empty>No trades yet.</Empty>}
        </Card>
        <div className="space-y-4">
          <Card title="Net P&L by weekday">
            {weekdays.length ? (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-ink-3">
                    <th className="py-1 font-medium">Day</th>
                    <th className="py-1 text-right font-medium">Active days</th>
                    <th className="py-1 text-right font-medium">Trades</th>
                    <th className="py-1 text-right font-medium">Avg day</th>
                    <th className="py-1 text-right font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {weekdays.map((w) => (
                    <tr key={w.weekday} className="border-t border-line/60">
                      <td className="py-1.5">{w.weekday}</td>
                      <td className="py-1.5 text-right num">{w.activeDays}</td>
                      <td className="py-1.5 text-right num">{w.trades}</td>
                      <td className="py-1.5 text-right num">
                        <PnlText value={w.pnl}>{fmtMoney(w.pnl / w.activeDays)}</PnlText>
                      </td>
                      <td className="py-1.5 text-right num">
                        <PnlText value={w.pnl}>{fmtMoney(w.pnl)}</PnlText>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <Empty>No trades yet.</Empty>
            )}
          </Card>
          <Card title="Where your losses land (points per contract)">
            <p className="mb-2 text-xs text-ink-3">
              Half of your losing trades gave back less than the median. If your stop sits far beyond the 75th
              percentile, the extra room is mostly paying for the worst trades.
            </p>
            {stops.length ? (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-ink-3">
                    <th className="py-1 font-medium">Contract</th>
                    <th className="py-1 text-right font-medium">Losses</th>
                    <th className="py-1 text-right font-medium">Median</th>
                    <th className="py-1 text-right font-medium">75th</th>
                    <th className="py-1 text-right font-medium">90th</th>
                    <th className="py-1 text-right font-medium">Worst</th>
                    <th className="py-1 text-right font-medium">Median win</th>
                  </tr>
                </thead>
                <tbody>
                  {stops.map((s) => (
                    <tr key={s.contract} className="border-t border-line/60">
                      <td className="py-1.5">{s.contract}</td>
                      <td className="py-1.5 text-right num">{s.loss.n}</td>
                      <td className="py-1.5 text-right num">{fmtNum(s.loss.median)}</td>
                      <td className="py-1.5 text-right num">{fmtNum(s.loss.p75)}</td>
                      <td className="py-1.5 text-right num">{fmtNum(s.loss.p90)}</td>
                      <td className="py-1.5 text-right num">{fmtNum(s.loss.max)}</td>
                      <td className="py-1.5 text-right num">{fmtNum(s.win.median)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <Empty>Needs trades with entry and exit prices.</Empty>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
