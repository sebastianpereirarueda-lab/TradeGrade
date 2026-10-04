import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAppState } from "../lib/store";
import { dayGrade, firstWeekdayOffset, groupByDay, monthDays } from "../lib/stats";
import { fmtMoney, fmtMoneySigned } from "../lib/format";
import { monthLabel, todayKey } from "../lib/dates";
import { Card, PnlText } from "../components/ui";

export function CalendarPage() {
  const { trades, journals, rules, settings } = useAppState();
  const today = new Date();
  const [ym, setYm] = useState({ y: today.getFullYear(), m: today.getMonth() });
  const days = useMemo(() => groupByDay(trades, settings.pnlIsNet), [trades, settings.pnlIsNet]);
  const byDate = useMemo(() => new Map(days.map((d) => [d.date, d])), [days]);
  const keys = monthDays(ym.y, ym.m);
  const offset = firstWeekdayOffset(keys[0]);
  const monthTotal = keys.reduce((a, k) => a + (byDate.get(k)?.pnl ?? 0), 0);
  const monthTrades = keys.reduce((a, k) => a + (byDate.get(k)?.trades ?? 0), 0);
  const tk = todayKey();

  const shift = (n: number) => {
    const d = new Date(ym.y, ym.m + n, 1);
    setYm({ y: d.getFullYear(), m: d.getMonth() });
  };

  // Build weeks for weekly totals.
  const cells: (string | null)[] = [...Array<null>(offset).fill(null), ...keys];
  while (cells.length % 7) cells.push(null);
  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button className="btn" onClick={() => shift(-1)} aria-label="Previous month">
            ‹
          </button>
          <h2 className="min-w-44 text-center text-lg font-semibold">{monthLabel(ym.y, ym.m)}</h2>
          <button className="btn" onClick={() => shift(1)} aria-label="Next month">
            ›
          </button>
          <button className="btn" onClick={() => setYm({ y: today.getFullYear(), m: today.getMonth() })}>
            Today
          </button>
        </div>
        <div className="text-sm text-ink-2">
          Month: <PnlText value={monthTotal} className="num font-semibold">{fmtMoney(monthTotal)}</PnlText> · {monthTrades}{" "}
          trades
        </div>
      </div>

      <Card className="!p-3">
        <div className="grid grid-cols-[repeat(7,minmax(0,1fr))_88px] gap-1.5">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((w) => (
            <div key={w} className="px-2 py-1 text-xs text-ink-3">
              {w}
            </div>
          ))}
          <div className="px-2 py-1 text-right text-xs text-ink-3">Week</div>
          {weeks.map((week, wi) => {
            const wk = week.reduce((a, k) => a + (k ? (byDate.get(k)?.pnl ?? 0) : 0), 0);
            const wt = week.reduce((a, k) => a + (k ? (byDate.get(k)?.trades ?? 0) : 0), 0);
            return [
              ...week.map((k, i) => {
                if (!k) return <div key={`e${wi}-${i}`} className="min-h-24 rounded-md" />;
                const d = byDate.get(k);
                const g = dayGrade(journals[k], rules);
                const hasNotes = !!journals[k]?.notes?.trim();
                const tone = d ? (d.pnl > 0 ? "bg-profit/12 border-profit/30" : d.pnl < 0 ? "bg-loss/12 border-loss/30" : "") : "";
                return (
                  <Link
                    key={k}
                    to={`/day/${k}`}
                    className={`flex min-h-24 flex-col justify-between rounded-md border border-line p-2 transition hover:border-ink-3 ${tone} ${
                      k === tk ? "ring-1 ring-accent" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between text-xs text-ink-3">
                      <span>{Number(k.slice(-2))}</span>
                      <span className="flex gap-1">
                        {hasNotes && <span title="Has journal">✎</span>}
                        {g && (
                          <span className="rounded bg-surface-2 px-1 font-semibold text-ink-2" title="Day grade">
                            {g.letter}
                          </span>
                        )}
                      </span>
                    </div>
                    {d ? (
                      <div>
                        <PnlText value={d.pnl} className="num text-sm font-semibold">
                          {fmtMoneySigned(d.pnl)}
                        </PnlText>
                        <div className="text-[11px] text-ink-3">
                          {d.trades} trade{d.trades === 1 ? "" : "s"}
                        </div>
                      </div>
                    ) : (
                      <div className="text-[11px] text-ink-3/60">—</div>
                    )}
                  </Link>
                );
              }),
              <div key={`w${wi}`} className="flex min-h-24 flex-col justify-center rounded-md bg-surface-2/60 p-2 text-right">
                <PnlText value={wk} className="num text-sm font-semibold">
                  {wt ? fmtMoney(wk) : "—"}
                </PnlText>
                <div className="text-[11px] text-ink-3">{wt ? `${wt} trades` : ""}</div>
              </div>,
            ];
          })}
        </div>
      </Card>
    </div>
  );
}
