import { useMemo, useState } from "react";
import type { DateRange, Scorecard, ScorecardComponent, Trade } from "../lib/types";
import { actions, useAppState } from "../lib/store";
import {
  GROUPS,
  METRICS,
  METRIC_IDS,
  defaultScorecards,
  formatMetric,
  inputScale,
  isMetricId,
  letterFor,
  newComponent,
  scoreScorecard,
  weeklyGpa,
  type MetricId,
  type ScorecardResult,
} from "../lib/scorecard";
import { shortDate } from "../lib/dates";
import { fmtNum } from "../lib/format";
import { Card } from "./ui";

const ACTIVE_KEY = "tradegrade:active-scorecard";

function tone(points: number): string {
  if (!Number.isFinite(points)) return "var(--color-line)";
  if (points >= 3) return "var(--color-profit)";
  if (points >= 2) return "var(--color-accent)";
  return "var(--color-loss)";
}

function Meter({ points, height = 8 }: { points: number; height?: number }) {
  const w = Number.isFinite(points) ? (points / 4) * 100 : 0;
  return (
    <div className="w-full overflow-hidden rounded-full bg-white/10" style={{ height }} aria-hidden>
      <div className="h-full rounded-full" style={{ width: `${w}%`, background: tone(points) }} />
    </div>
  );
}

function NumberInput({
  value,
  onChange,
  label,
  suffix,
}: {
  value: number;
  onChange: (v: number) => void;
  label: string;
  suffix?: string;
}) {
  const [text, setText] = useState(String(value));
  return (
    <label className="flex items-center gap-1 text-xs text-ink-3">
      {label}
      <input
        className="input w-20 !px-2 !py-1 text-right text-sm"
        inputMode="decimal"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          const n = Number(e.target.value);
          if (e.target.value.trim() !== "" && Number.isFinite(n)) onChange(n);
        }}
        onBlur={() => setText(String(value))}
        aria-label={label}
      />
      {suffix && <span>{suffix}</span>}
    </label>
  );
}

function round(n: number) {
  return Math.round(n * 1000) / 1000;
}

function ComponentRow({
  part,
  editing,
  onChange,
  onRemove,
}: {
  part: ScorecardResult["parts"][number];
  editing: boolean;
  onChange: (c: ScorecardComponent) => void;
  onRemove: () => void;
}) {
  const c = part.component;
  const def = part.def;
  const scale = inputScale(c.metric);
  const unitSuffix = def?.unit === "pct" ? "%" : def?.unit === "money" ? "$" : undefined;
  return (
    <li className="border-t border-white/5 py-2.5">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1.5 sm:grid-cols-[minmax(0,14rem)_6.5rem_minmax(6rem,1fr)_2.5rem_3.5rem]">
        <div className="min-w-0">
          <div className="truncate text-sm">{def?.label ?? c.metric}</div>
          {editing && def && <div className="text-xs text-ink-3">{def.help}</div>}
        </div>
        <div className="num text-right text-sm sm:text-left">{formatMetric(c.metric, part.value)}</div>
        <div className="col-span-2 sm:col-span-1">
          <Meter points={part.points} />
        </div>
        <div className="num text-sm font-semibold" title="Grade for this metric">
          {Number.isFinite(part.points) ? letterFor(part.points) : "–"}
        </div>
        <div className="num text-right text-xs text-ink-3" title="Share of the overall score">
          {Number.isFinite(part.points) && c.weight > 0 ? `${Math.round(part.share * 100)}%` : "—"}
        </div>
      </div>
      {editing && (
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <NumberInput label="Weight" value={c.weight} onChange={(v) => onChange({ ...c, weight: Math.max(0, v) })} />
          <NumberInput
            label="A at"
            suffix={unitSuffix}
            value={round(c.a * scale)}
            onChange={(v) => onChange({ ...c, a: v / scale })}
          />
          <NumberInput
            label="F at"
            suffix={unitSuffix}
            value={round(c.f * scale)}
            onChange={(v) => onChange({ ...c, f: v / scale })}
          />
          {def && (c.a !== def.a || c.f !== def.f) && (
            <button className="text-xs text-ink-3 underline" onClick={() => onChange({ ...c, a: def.a, f: def.f })}>
              Reset targets
            </button>
          )}
          <button className="btn btn-danger ml-auto !px-2" onClick={onRemove} title="Remove metric" aria-label="Remove metric">
            ✕
          </button>
        </div>
      )}
    </li>
  );
}

function AddMetric({ used, onAdd }: { used: Set<string>; onAdd: (m: MetricId) => void }) {
  const available = METRIC_IDS.filter((m) => !used.has(m));
  if (!available.length) return <span className="text-xs text-ink-3">Every metric is in this scorecard.</span>;
  return (
    <select
      className="input text-sm"
      value=""
      onChange={(e) => {
        if (isMetricId(e.target.value)) onAdd(e.target.value);
      }}
      aria-label="Add a metric"
    >
      <option value="" disabled>
        Add a metric…
      </option>
      {GROUPS.map((g) => (
        <optgroup key={g} label={g}>
          {available
            .filter((m) => METRICS[m].group === g)
            .map((m) => (
              <option key={m} value={m}>
                {METRICS[m].label}
              </option>
            ))}
        </optgroup>
      ))}
    </select>
  );
}

function WeeklyTrend({ weeks }: { weeks: { week: string; gpa: number }[] }) {
  if (weeks.length < 2) return null;
  return (
    <div>
      <div className="mb-1 text-xs text-ink-3">By week</div>
      <div className="flex h-20 items-end gap-1.5">
        {weeks.map((w) => (
          <div key={w.week} className="flex w-8 flex-col items-center gap-1" title={`Week of ${w.week}: ${fmtNum(w.gpa, 2)}`}>
            <span className="num text-[10px] text-ink-2">{fmtNum(w.gpa, 1)}</span>
            <div className="w-full rounded-t" style={{ height: `${Math.max(4, (w.gpa / 4) * 44)}px`, background: tone(w.gpa) }} />
            <span className="text-[10px] text-ink-3">{shortDate(w.week)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** GPA-style scorecards at the top of the dashboard, scored over the selected date range. */
export function Scorecards({ trades, range }: { trades: Trade[]; range: DateRange }) {
  const { scorecards, journals, rules, settings } = useAppState();
  const [activeId, setActiveId] = useState<string>(() => {
    try {
      return localStorage.getItem(ACTIVE_KEY) ?? "";
    } catch {
      return "";
    }
  });
  const [editing, setEditing] = useState(false);
  const active = scorecards.find((s) => s.id === activeId) ?? scorecards[0];

  const select = (id: string) => {
    setActiveId(id);
    try {
      localStorage.setItem(ACTIVE_KEY, id);
    } catch {
      /* per-viewer convenience only */
    }
  };
  const save = (next: Scorecard) => actions.setScorecards(scorecards.map((s) => (s.id === next.id ? next : s)));
  const create = (base?: Scorecard) => {
    const sc: Scorecard = base
      ? { ...base, id: `sc-${Date.now().toString(36)}`, name: `${base.name} copy`, components: base.components.map((c) => ({ ...c })) }
      : { id: `sc-${Date.now().toString(36)}`, name: `Scorecard ${scorecards.length + 1}`, components: [] };
    actions.setScorecards([...scorecards, sc]);
    select(sc.id);
    setEditing(true);
  };

  const input = useMemo(() => ({ trades, journals, rules, settings, range }), [trades, journals, rules, settings, range]);
  const result = useMemo(() => (active ? scoreScorecard(active, input) : null), [active, input]);
  const weeks = useMemo(() => (active ? weeklyGpa(active, input) : []), [active, input]);

  if (!active || !result) {
    return (
      <Card title="Scorecards">
        <p className="text-sm text-ink-2">
          No scorecards yet. A scorecard grades the metrics you choose and combines them into one GPA.
        </p>
        <div className="mt-3 flex gap-2">
          <button className="btn btn-accent" onClick={() => create()}>
            Create scorecard
          </button>
          <button className="btn" onClick={() => actions.setScorecards(defaultScorecards())}>
            Restore Overall GPA
          </button>
        </div>
      </Card>
    );
  }

  const used = new Set(active.components.map((c) => c.metric));
  return (
    <Card>
      <div className="flex flex-wrap items-center gap-1.5">
        {scorecards.map((s) => (
          <button
            key={s.id}
            className={`rounded-md px-3 py-1.5 text-sm ${s.id === active.id ? "bg-white/12 text-ink" : "text-ink-2 hover:text-ink"}`}
            onClick={() => {
              select(s.id);
              setEditing(false);
            }}
          >
            {s.name}
          </button>
        ))}
        <button className="rounded-md px-3 py-1.5 text-sm text-ink-3 hover:text-ink" onClick={() => create()}>
          + New scorecard
        </button>
      </div>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-6">
        <div className="min-w-56">
          {editing ? (
            <input
              className="input mb-2 w-full text-sm"
              value={active.name}
              onChange={(e) => save({ ...active, name: e.target.value })}
              aria-label="Scorecard name"
            />
          ) : (
            <div className="card-title">{active.name}</div>
          )}
          <div className="flex items-baseline gap-3">
            <span className="text-5xl font-semibold leading-none num">{Number.isFinite(result.gpa) ? fmtNum(result.gpa, 2) : "–"}</span>
            <span className="text-sm text-ink-3">of 4.00</span>
            <span className="rounded-md bg-white/10 px-2 py-0.5 text-xl font-semibold">{result.letter}</span>
          </div>
          <div className="mt-3 w-full max-w-72">
            <Meter points={result.gpa} height={10} />
          </div>
          <div className="mt-2 text-xs text-ink-3">
            {result.counted} of {active.components.length} metrics scored over {result.days} trading day
            {result.days === 1 ? "" : "s"} in this range.
          </div>
        </div>
        <WeeklyTrend weeks={weeks} />
      </div>

      {active.components.length > 0 ? (
        <ul className="mt-4">
          {result.parts.map((p) => (
            <ComponentRow
              key={p.component.id}
              part={p}
              editing={editing}
              onChange={(c) => save({ ...active, components: active.components.map((x) => (x.id === c.id ? c : x)) })}
              onRemove={() => save({ ...active, components: active.components.filter((x) => x.id !== p.component.id) })}
            />
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-ink-2">Add the metrics you want graded with the menu below.</p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/5 pt-3">
        <AddMetric used={used} onAdd={(m) => save({ ...active, components: [...active.components, newComponent(m)] })} />
        <button className={`btn ${editing ? "btn-active" : ""}`} onClick={() => setEditing(!editing)}>
          {editing ? "Done" : "Customize"}
        </button>
        {editing && (
          <>
            <button className="btn" onClick={() => create(active)}>
              Duplicate
            </button>
            <button
              className="btn btn-danger"
              onClick={() => {
                if (confirm(`Delete the scorecard "${active.name}"?`)) {
                  actions.setScorecards(scorecards.filter((s) => s.id !== active.id));
                  setEditing(false);
                }
              }}
            >
              Delete
            </button>
          </>
        )}
        <span className="ml-auto text-xs text-ink-3">
          Each metric scores 4.0 at its A target and 0.0 at its F target. Checklist and journal metrics count only days you
          traded.
        </span>
      </div>
    </Card>
  );
}
