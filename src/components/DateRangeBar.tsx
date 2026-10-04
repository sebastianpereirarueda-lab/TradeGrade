import type { DateRange } from "../lib/types";
import { addDays, todayKey } from "../lib/dates";

type Preset = "today" | "week" | "month" | "all";

export function presetRange(p: Preset): DateRange {
  const today = todayKey();
  switch (p) {
    case "today":
      return { from: today, to: today };
    case "week":
      return { from: addDays(today, -6), to: today };
    case "month":
      return { from: addDays(today, -29), to: today };
    default:
      return { from: null, to: null };
  }
}

function isPreset(r: DateRange, p: Preset): boolean {
  const x = presetRange(p);
  return x.from === r.from && x.to === r.to;
}

export function DateRangeBar({ range, onChange }: { range: DateRange; onChange: (r: DateRange) => void }) {
  const presets: { key: Preset; label: string }[] = [
    { key: "today", label: "Today" },
    { key: "week", label: "Last week" },
    { key: "month", label: "Last month" },
    { key: "all", label: "All" },
  ];
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="flex items-center gap-2 text-xs text-ink-3">
        From
        <input
          type="date"
          className="input"
          value={range.from ?? ""}
          onChange={(e) => onChange({ ...range, from: e.target.value || null })}
        />
      </label>
      <label className="flex items-center gap-2 text-xs text-ink-3">
        To
        <input
          type="date"
          className="input"
          value={range.to ?? ""}
          onChange={(e) => onChange({ ...range, to: e.target.value || null })}
        />
      </label>
      <div className="ml-1 flex gap-1">
        {presets.map((p) => (
          <button
            key={p.key}
            className={`btn ${isPreset(range, p.key) ? "btn-active" : ""}`}
            onClick={() => onChange(presetRange(p.key))}
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}
