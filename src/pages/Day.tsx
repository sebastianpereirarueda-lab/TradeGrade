import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { actions, emptyJournal, useAppState } from "../lib/store";
import { dayGrade, intradayCurve, summarize } from "../lib/stats";
import { dayKey, addDays, shortDateYear, weekdayName } from "../lib/dates";
import { fmtMoney, fmtPct } from "../lib/format";
import { Card, Empty, PnlText } from "../components/ui";
import { IntradayChart } from "../components/charts";
import { TradeTable } from "../components/TradeTable";
import type { DayJournal } from "../lib/types";

const PSYCH: { key: keyof DayJournal["psych"]; label: string; hint: string }[] = [
  { key: "discipline", label: "Discipline", hint: "Did I follow my process?" },
  { key: "patience", label: "Patience", hint: "Did I wait for my setups?" },
  { key: "emotion", label: "Emotional control", hint: "Was I calm after wins and losses?" },
];

export function DayPage() {
  const { date = "" } = useParams();
  const { trades, journals, rules, settings } = useAppState();
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(date);
  const dayTrades = useMemo(() => trades.filter((t) => dayKey(t.exitTime) === date), [trades, date]);
  const s = useMemo(() => summarize(dayTrades, settings.pnlIsNet), [dayTrades, settings.pnlIsNet]);
  const curve = useMemo(() => intradayCurve(dayTrades, settings.pnlIsNet), [dayTrades, settings.pnlIsNet]);

  const saved = journals[date];
  const [draft, setDraft] = useState<DayJournal>(saved ?? emptyJournal(date));
  const [savedAt, setSavedAt] = useState<number | null>(null);
  useEffect(() => {
    setDraft(journals[date] ?? emptyJournal(date));
    setSavedAt(null);
  }, [date, journals]);

  if (!valid) return <Empty>Bad date.</Empty>;
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved ?? emptyJournal(date));
  const grade = dayGrade(draft, rules);
  const enabledRules = rules.filter((r) => r.enabled);

  const save = () => {
    actions.saveJournal(draft);
    setSavedAt(Date.now());
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link className="btn" to={`/day/${addDays(date, -1)}`} aria-label="Previous day">
            ‹
          </Link>
          <h2 className="text-lg font-semibold">
            Day performance: {shortDateYear(date)} <span className="font-normal text-ink-3">{weekdayName(date)}</span>
          </h2>
          <Link className="btn" to={`/day/${addDays(date, 1)}`} aria-label="Next day">
            ›
          </Link>
        </div>
        <div className="flex items-center gap-4 text-sm text-ink-2">
          <span>
            Net <PnlText value={s.totalPnl} className="num font-semibold">{fmtMoney(s.totalPnl)}</PnlText>
          </span>
          <span>{s.tradeCount} trades</span>
          <span>Win {fmtPct(s.winRate, 0)}</span>
          {grade && (
            <span>
              Grade <span className="rounded bg-surface-2 px-1.5 font-semibold text-ink">{grade.letter}</span>
            </span>
          )}
          <Link to="/calendar" className="underline">
            Calendar
          </Link>
        </div>
      </div>

      <Card title="Intraday P&L">
        {curve.length ? <IntradayChart data={curve} /> : <Empty>No trades on this day.</Empty>}
      </Card>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Card title="Day journal">
          <textarea
            className="input min-h-72 w-full resize-y font-sans leading-6"
            placeholder="What happened? What did I do well, what will I do differently tomorrow?"
            value={draft.notes}
            onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
          />
          <div className="mt-3 flex items-center gap-3">
            <button className={`btn ${dirty ? "btn-accent" : ""}`} onClick={save} disabled={!dirty}>
              Save journal
            </button>
            {savedAt && !dirty && <span className="text-xs text-ink-3">Saved.</span>}
            {dirty && <span className="text-xs text-ink-3">Unsaved changes</span>}
          </div>
        </Card>

        <div className="space-y-4">
          <Card title="Rules checklist">
            {enabledRules.length === 0 ? (
              <Empty>
                No rules yet. <Link to="/rules" className="underline">Add some.</Link>
              </Empty>
            ) : (
              <ul className="space-y-2">
                {enabledRules.map((r) => {
                  const v = draft.rules[r.id];
                  return (
                    <li key={r.id} className="flex items-center justify-between gap-2 text-sm">
                      <span className={v === false ? "text-loss" : v === true ? "" : "text-ink-2"}>{r.text}</span>
                      <span className="flex shrink-0 gap-1">
                        <button
                          className={`btn !px-2 ${v === true ? "btn-active" : ""}`}
                          onClick={() => setDraft({ ...draft, rules: { ...draft.rules, [r.id]: true } })}
                          title="Followed"
                        >
                          ✓
                        </button>
                        <button
                          className={`btn !px-2 ${v === false ? "btn-active" : ""}`}
                          onClick={() => setDraft({ ...draft, rules: { ...draft.rules, [r.id]: false } })}
                          title="Broken"
                        >
                          ✕
                        </button>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card title="Psychology (1 = poor, 5 = excellent)">
            <div className="space-y-3">
              {PSYCH.map((p) => (
                <div key={p.key}>
                  <div className="flex items-center justify-between text-sm">
                    <span>{p.label}</span>
                    <span className="text-xs text-ink-3">{p.hint}</span>
                  </div>
                  <div className="mt-1 flex gap-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        className={`btn flex-1 !px-0 ${draft.psych[p.key] === n ? "btn-active" : ""}`}
                        onClick={() => setDraft({ ...draft, psych: { ...draft.psych, [p.key]: n } })}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      <Card title="Trades">
        <TradeTable trades={dayTrades} pnlIsNet={settings.pnlIsNet} />
      </Card>
    </div>
  );
}
