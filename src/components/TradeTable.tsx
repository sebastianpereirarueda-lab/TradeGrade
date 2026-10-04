import type { Trade } from "../lib/types";
import { durationMs, netPnl } from "../lib/stats";
import { fmtDateTime, fmtDuration, fmtMoney, fmtPrice } from "../lib/format";
import { PnlText } from "./ui";

export function TradeTable({ trades, pnlIsNet }: { trades: Trade[]; pnlIsNet: boolean }) {
  if (!trades.length) return <div className="py-6 text-center text-sm text-ink-3">No trades.</div>;
  const th = "px-3 py-2 text-left text-xs font-medium text-ink-3 whitespace-nowrap";
  const td = "px-3 py-2 text-sm whitespace-nowrap num";
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-line">
            <th className={th}>ID</th>
            <th className={th}>Contract</th>
            <th className={th}>Size</th>
            <th className={th}>Entry time</th>
            <th className={th}>Exit time</th>
            <th className={th}>Duration</th>
            <th className={th}>Entry price</th>
            <th className={th}>Exit price</th>
            <th className={th}>P&amp;L</th>
            <th className={th}>Commissions</th>
            <th className={th}>Fees</th>
            <th className={th}>Net</th>
            <th className={th}>Direction</th>
          </tr>
        </thead>
        <tbody>
          {trades.map((t) => {
            const net = netPnl(t, pnlIsNet);
            return (
              <tr key={t.id} className="border-b border-line/60 hover:bg-surface-2">
                <td className={td}>{t.id}</td>
                <td className={td}>{t.contract}</td>
                <td className={td}>{t.size}</td>
                <td className={td}>{fmtDateTime(t.entryTime)}</td>
                <td className={td}>{fmtDateTime(t.exitTime)}</td>
                <td className={td}>{fmtDuration(durationMs(t))}</td>
                <td className={td}>{fmtPrice(t.entryPrice)}</td>
                <td className={td}>{fmtPrice(t.exitPrice)}</td>
                <td className={td}>
                  <PnlText value={t.pnl}>{fmtMoney(t.pnl)}</PnlText>
                </td>
                <td className={td}>{fmtMoney(t.commissions)}</td>
                <td className={td}>{fmtMoney(t.fees)}</td>
                <td className={td}>
                  <PnlText value={net}>{fmtMoney(net)}</PnlText>
                </td>
                <td className={td}>{t.direction}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
