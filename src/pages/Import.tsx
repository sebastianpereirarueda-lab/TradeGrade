import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { actions, exportBackup, importBackup, useAppState } from "../lib/store";
import { mergeTrades, type ParseResult } from "../lib/importers";
import { sampleTrades } from "../lib/sample";
import { Card } from "../components/ui";
import { TradeTable } from "../components/TradeTable";
import { ImportDropzone } from "../components/ImportDropzone";

export function ImportPage() {
  const { trades, settings } = useAppState();
  const nav = useNavigate();
  const [result, setResult] = useState<ParseResult | null>(null);
  const [msg, setMsg] = useState("");

  const apply = (mode: "merge" | "replace") => {
    if (!result?.trades.length) return;
    actions.setTrades(mode === "replace" ? result.trades : mergeTrades(trades, result.trades));
    setMsg(`${result.trades.length} trades ${mode === "replace" ? "loaded" : "merged"}.`);
    setResult(null);
    nav("/");
  };

  const download = () => {
    const blob = new Blob([exportBackup()], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `tradegrade-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Import trades">
          <ImportDropzone
            compact
            onParsed={(r) => {
              setResult(r);
              setMsg("");
            }}
          />
          <p className="mt-3 text-xs text-ink-3">
            Works with Topstep's "Export trades" CSV, the printed trade list, and similar exports from other prop
            firms or Tradovate. Columns are matched by name; only entry time, exit time and P&amp;L are required.
            Re-importing the same file is safe: trades are matched by ID.
          </p>
          {result && (
            <div className="mt-3 text-sm">
              <div className="text-ink-2">
                {result.source}: {result.trades.length} trades parsed
                {result.skipped ? `, ${result.skipped} rows skipped` : ""}.
              </div>
              {result.errors.map((e) => (
                <div key={e} className="mt-1 text-loss">
                  {e}
                </div>
              ))}
              {result.trades.length > 0 && (
                <>
                  <div className="mt-1 text-xs text-ink-3">
                    Columns:{" "}
                    {Object.entries(result.columns)
                      .map(([k, v]) => `${k} ← "${v}"`)
                      .join(" · ")}
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button className="btn btn-accent" onClick={() => apply("merge")}>
                      Merge into existing ({trades.length})
                    </button>
                    <button className="btn" onClick={() => apply("replace")}>
                      Replace all
                    </button>
                  </div>
                  <div className="mt-3 max-h-64 overflow-auto rounded-md border border-line">
                    <TradeTable trades={result.trades.slice(0, 20)} settings={settings} />
                  </div>
                </>
              )}
            </div>
          )}
          {msg && <div className="mt-2 text-sm text-profit">{msg}</div>}
        </Card>

        <div className="space-y-4">
          <Card title="Settings">
            <label className="flex items-center justify-between gap-3 text-sm">
              Starting balance
              <input
                type="number"
                className="input w-36 text-right"
                value={settings.startingBalance}
                onChange={(e) => actions.setSettings({ startingBalance: Number(e.target.value) || 0 })}
              />
            </label>
            <label className="mt-3 flex items-center justify-between gap-3 text-sm">
              <span>
                Trading day starts at
                <span className="block text-xs text-ink-3">
                  Futures sessions open the evening before. 18:00 matches Topstep: a trade at 7 PM on the 30th
                  counts for the 1st. Set 0 for plain calendar days. Ignored when the export has its own
                  trade-day column, as Topstep's does.
                </span>
              </span>
              <select
                className="input w-28"
                value={settings.sessionStartHour}
                onChange={(e) => actions.setSettings({ sessionStartHour: Number(e.target.value) })}
              >
                {[0, 15, 16, 17, 18, 19, 20].map((h) => (
                  <option key={h} value={h}>
                    {String(h).padStart(2, "0")}:00
                  </option>
                ))}
              </select>
            </label>
            <label className="mt-3 flex items-center justify-between gap-3 text-sm">
              <span>
                P&amp;L column is already net
                <span className="block text-xs text-ink-3">Otherwise commissions and fees are subtracted.</span>
              </span>
              <input
                type="checkbox"
                checked={settings.pnlIsNet}
                onChange={(e) => actions.setSettings({ pnlIsNet: e.target.checked })}
              />
            </label>
          </Card>

          <Card title="Data">
            <div className="flex flex-wrap gap-2">
              <button
                className="btn"
                onClick={() => {
                  actions.setTrades(sampleTrades());
                  nav("/");
                }}
              >
                Load sample data
              </button>
              <button className="btn" onClick={download}>
                Download backup (JSON)
              </button>
              <label className="btn cursor-pointer">
                Restore backup
                <input
                  type="file"
                  accept="application/json"
                  className="hidden"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    try {
                      const next = importBackup(await f.text());
                      setMsg(`Restored ${next.trades.length} trades and ${Object.keys(next.journals).length} journal days.`);
                    } catch (err) {
                      setMsg(`Could not restore: ${(err as Error).message}`);
                    }
                  }}
                />
              </label>
              <button
                className="btn btn-danger"
                onClick={() => {
                  if (confirm("Delete all trades? Journals, notes and rules are kept.")) actions.clearTrades();
                }}
              >
                Clear trades
              </button>
              <button
                className="btn btn-danger"
                onClick={() => {
                  if (confirm("Reset everything: trades, journals, rules and settings?")) actions.resetAll();
                }}
              >
                Reset all
              </button>
            </div>
            <p className="mt-3 text-xs text-ink-3">
              Everything is stored in this browser only. Download a backup before clearing site data or switching
              machines. {trades.length} trades stored.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
