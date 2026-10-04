import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAppState } from "../lib/store";
import type { DateRange } from "../lib/types";
import { cumulativeByDay, durationBuckets, filterByRange, groupByDay, netPnl, summarize, tradeDay } from "../lib/stats";
import { fmtDateTime, fmtDuration, fmtMoney, fmtNum, fmtPct, fmtPrice } from "../lib/format";
import { DateRangeBar, presetRange } from "../components/DateRangeBar";
import { Card, Empty, PnlText, StatTile } from "../components/ui";
import { ImportDropzone } from "../components/ImportDropzone";
import { actions } from "../lib/store";
import { mergeTrades } from "../lib/importers";
import { Donut, HalfGauge, SplitBar } from "../components/gauges";
import {
  BalanceChart,
  CumulativePnlChart,
  DailyPnlChart,
  DurationCountChart,
  DurationWinRateChart,
} from "../components/charts";

function TradeLine({ pnl, trade }: { pnl: number; trade: import("../lib/types").Trade }) {
  return (
    <div className="text-right text-xs leading-5 text-ink-2">
      <div>
        {trade.direction} {trade.size} {trade.contract} @ {fmtPrice(trade.entryPrice)}
      </div>
      <div>Exited @ {fmtPrice(trade.exitPrice)}</div>
      <div>{fmtDateTime(trade.exitTime)}</div>
      <span className="sr-only">{fmtMoney(pnl)}</span>
    </div>
  );
}

export function Dashboard() {
  const { trades, settings } = useAppState();
  const [range, setRange] = useState<DateRange>(presetRange("month"));

  const filtered = useMemo(() => filterByRange(trades, range, settings), [trades, range, settings]);
  const s = useMemo(() => summarize(filtered, settings), [filtered, settings]);
  const days = useMemo(() => groupByDay(filtered, settings), [filtered, settings]);
  const cum = useMemo(() => cumulativeByDay(days), [days]);
  const buckets = useMemo(() => durationBuckets(filtered, settings), [filtered, settings]);
  const balance = useMemo(() => {
    // Balance before the range = starting balance + everything that closed earlier.
    const before = trades
      .filter((t) => range.from && tradeDay(t, settings) < range.from)
      .reduce((a, t) => a + netPnl(t, settings), 0);
    return cum.map((p) => ({ date: p.date, balance: settings.startingBalance + before + p.cumulative }));
  }, [cum, trades, range.from, settings]);

  if (!trades.length) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 py-10">
        <div className="text-center">
          <h2 className="text-2xl font-semibold">Your trading, graded.</h2>
          <p className="mt-2 text-sm text-ink-2">
            Drop the trade export from your prop firm and get the Topstep-style stats, a calendar with a journal for
            every day, and a grade for how well you followed your own rules. Nothing leaves your browser.
          </p>
        </div>
        <ImportDropzone
          onParsed={(r) => {
            if (r.trades.length) actions.setTrades(mergeTrades(trades, r.trades));
            else alert(r.errors.join("\n") || "No trades found in that file.");
          }}
        />
        <div className="text-center text-sm text-ink-3">
          or{" "}
          <Link to="/import" className="underline">
            load sample data
          </Link>{" "}
          to look around first.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <DateRangeBar range={range} onChange={setRange} />

      {!filtered.length ? (
        <Card>
          <Empty>No trades in this date range.</Empty>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <StatTile title="Total P&L" value={fmtMoney(s.totalPnl)} tone={s.totalPnl} />
            <StatTile
              title="Trade win %"
              value={fmtPct(s.winRate)}
              side={<HalfGauge a={s.wins} b={s.losses} />}
              sub={`${s.wins} wins · ${s.losses} losses${s.breakeven ? ` · ${s.breakeven} flat` : ""}`}
            />
            <Card title="Avg win / avg loss">
              <SplitBar a={Math.max(0, s.avgWin || 0)} b={Math.max(0, -s.avgLoss || 0)} />
              <div className="mt-3 flex items-end justify-between">
                <div className="tile-value">{fmtNum(s.avgWinLossRatio)}</div>
                <div className="text-right text-lg">
                  <PnlText value={1}>{fmtMoney(s.avgWin)}</PnlText>{" "}
                  <PnlText value={-1}>{fmtMoney(s.avgLoss)}</PnlText>
                </div>
              </div>
            </Card>
            <StatTile
              title="Day win %"
              value={fmtPct(s.dayWinRate)}
              sub={`${s.winningDays} of ${s.dayCount} days`}
            />
            <Card title="Profit factor">
              <div className="flex items-center justify-between">
                <div className="tile-value">{Number.isFinite(s.profitFactor) ? fmtNum(s.profitFactor) : "∞"}</div>
                <div className="flex items-center gap-3 text-sm">
                  <PnlText value={1}>{fmtMoney(s.grossProfit)}</PnlText>
                  <Donut a={s.grossProfit} b={s.grossLoss} />
                  <PnlText value={-1}>{fmtMoney(-s.grossLoss)}</PnlText>
                </div>
              </div>
            </Card>
            <StatTile title="Best day % of total profit" value={fmtPct(s.bestDayPct)} />
          </div>

          <Card title="Daily account balance">
            <BalanceChart data={balance} />
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="Daily net cumulative P&L">
              <CumulativePnlChart data={cum} />
            </Card>
            <Card title="Net daily P&L">
              <DailyPnlChart data={cum} />
            </Card>
            <Card title="Trade duration analysis">
              <DurationCountChart data={buckets} />
            </Card>
            <Card title="Win rate by duration">
              <DurationWinRateChart data={buckets} />
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <Card title="Most active day">
              <div className="flex items-start justify-between gap-3">
                <div className="tile-value">{s.mostActive?.weekday ?? "—"}</div>
                {s.mostActive && (
                  <div className="text-right text-xs leading-5 text-ink-2">
                    <div>{s.mostActive.activeDays} active days</div>
                    <div>{s.mostActive.trades} total trades</div>
                    <div>{fmtNum(s.mostActive.trades / s.mostActive.activeDays)} avg trades/day</div>
                  </div>
                )}
              </div>
            </Card>
            <Card title="Most profitable day">
              <div className="flex items-start justify-between gap-3">
                <div className="tile-value">{s.mostProfitable?.weekday ?? "—"}</div>
                {s.mostProfitable && (
                  <PnlText value={s.mostProfitable.pnl} className="text-lg num">
                    {fmtMoney(s.mostProfitable.pnl)}
                  </PnlText>
                )}
              </div>
            </Card>
            <Card title="Least profitable day">
              <div className="flex items-start justify-between gap-3">
                <div className="tile-value">{s.leastProfitable?.weekday ?? "—"}</div>
                {s.leastProfitable && (
                  <PnlText value={s.leastProfitable.pnl} className="text-lg num">
                    {fmtMoney(s.leastProfitable.pnl)}
                  </PnlText>
                )}
              </div>
            </Card>
            <StatTile title="Total number of trades" value={s.tradeCount} />
            <StatTile title="Total number of lots traded" value={s.totalLots} />
            <StatTile title="Average trade duration" value={fmtDuration(s.avgDuration)} />
            <StatTile title="Average win duration" value={fmtDuration(s.avgWinDuration)} />
            <StatTile title="Average loss duration" value={fmtDuration(s.avgLossDuration)} />
            <Card title="Trade direction %">
              <div className="flex items-center justify-between">
                <div>
                  <div className="tile-value">{fmtPct(s.longPct)}</div>
                  <div className="text-xs text-ink-3">long</div>
                </div>
                <div className="flex items-center gap-2 text-xs text-ink-2 num">
                  <span>{s.shortCount}</span>
                  <Donut a={s.longCount} b={s.shortCount} />
                  <span>{s.longCount}</span>
                </div>
              </div>
            </Card>
            <StatTile title="Avg winning trade" value={fmtMoney(s.avgWin)} tone={1} />
            <StatTile title="Avg losing trade" value={fmtMoney(s.avgLoss)} tone={-1} />
            <div className="hidden md:block" />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card title="Best trade">
              <div className="flex items-end justify-between gap-3">
                <div className="tile-value profit">{s.bestTrade ? fmtMoney(s.bestTrade.pnl) : "—"}</div>
                {s.bestTrade && <TradeLine pnl={s.bestTrade.pnl} trade={s.bestTrade.trade} />}
              </div>
            </Card>
            <Card title="Worst trade">
              <div className="flex items-end justify-between gap-3">
                <div className="tile-value loss">{s.worstTrade ? fmtMoney(s.worstTrade.pnl) : "—"}</div>
                {s.worstTrade && <TradeLine pnl={s.worstTrade.pnl} trade={s.worstTrade.trade} />}
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
