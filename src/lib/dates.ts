/** Local-time date helpers. Days are keyed as YYYY-MM-DD in the browser's zone. */

export function dayKey(ms: number | Date): string {
  const d = typeof ms === "number" ? new Date(ms) : ms;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseDayKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(key: string, n: number): string {
  const d = parseDayKey(key);
  d.setDate(d.getDate() + n);
  return dayKey(d);
}

export function todayKey(): string {
  return dayKey(new Date());
}

export const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export function weekdayName(key: string): string {
  return WEEKDAYS[parseDayKey(key).getDay()];
}

/** "09/23" style axis label. */
export function shortDate(key: string): string {
  const [, m, d] = key.split("-");
  return `${m}/${d}`;
}

/** "10/01/26" style heading. */
export function shortDateYear(key: string): string {
  const [y, m, d] = key.split("-");
  return `${m}/${d}/${y.slice(2)}`;
}

export function monthLabel(year: number, month0: number): string {
  return new Date(year, month0, 1).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}

/**
 * Parse a timestamp string from a CSV export. Accepts ISO 8601 and the
 * US "MM/DD/YYYY HH:MM:SS" (optionally with AM/PM) that Topstep/Tradovate emit.
 * Returns NaN when unparseable.
 */
export function parseTimestamp(raw: string): number {
  const s = raw.trim();
  if (!s) return NaN;
  const us = s.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:[ ,T]+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AaPp][Mm])?)?$/,
  );
  if (us) {
    const [, mo, d, yRaw, hRaw = "0", mi = "0", sec = "0", ampm] = us;
    let y = Number(yRaw);
    if (y < 100) y += 2000;
    let h = Number(hRaw);
    if (ampm) {
      const pm = ampm.toLowerCase() === "pm";
      if (pm && h < 12) h += 12;
      if (!pm && h === 12) h = 0;
    }
    return new Date(y, Number(mo) - 1, Number(d), h, Number(mi), Number(sec)).getTime();
  }
  const t = Date.parse(s);
  return Number.isNaN(t) ? NaN : t;
}
