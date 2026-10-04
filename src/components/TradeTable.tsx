import { Fragment, useState } from "react";
import type { Settings, Trade } from "../lib/types";
import { durationMs, netPnl } from "../lib/stats";
import { fmtDateTime, fmtDuration, fmtMoney, fmtPrice } from "../lib/format";
import { PnlText } from "./ui";

export function TradeTable({
  trades,
  settings,
  notes,
  onNote,
}: {
  trades: Trade[];
  settings: Settings;
  /** When given, a note column with inline editing is shown. */
  notes?: Record<string, string>;
  onNote?: (id: string, text: string) => void;
}) {
  const [open, setOpen] = useState<string | null>(null);
  if (!trades.length) return <div className="py-6 text-center text-sm text-ink-3">No trades.</div>;
  const th = "px-3 py-2 text-left text-xs font-medium text-ink-3 whitespace-nowrap";
  const td = "px-3 py-2 text-sm whitespace-nowrap num";
  const withNotes = !!onNote;
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-line">
            {withNotes && <th className={th}>Note</th>}
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
            const net = netPnl(t, settings);
            const note = notes?.[t.id] ?? "";
            const isOpen = open === t.id;
            return (
              <Fragment key={t.id}>
                <tr className="border-b border-line/60 hover:bg-surface-2">
                  {withNotes && (
                    <td className={td}>
                      <button
                        className={`btn !px-2 ${note ? "btn-active" : ""}`}
                        onClick={() => setOpen(isOpen ? null : t.id)}
                        title={note ? "Edit note" : "Add note"}
                        aria-expanded={isOpen}
                      >
                        ✎
                      </button>
                    </td>
                  )}
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
                {isOpen && onNote && (
                  <tr className="border-b border-line/60 bg-surface-2/50">
                    <td colSpan={14} className="px-3 py-2">
                      <textarea
                        className="input min-h-20 w-full resize-y text-sm"
                        autoFocus
                        placeholder="Why did I take this trade? What would I do differently?"
                        defaultValue={note}
                        onBlur={(e) => onNote(t.id, e.target.value)}
                      />
                      <div className="mt-1 text-xs text-ink-3">Saved when you click away.</div>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
