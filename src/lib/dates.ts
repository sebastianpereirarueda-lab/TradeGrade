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
const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, sept: 8, oct: 9, nov: 10, dec: 11,
};

function withClock(y: number, mo: number, d: number, hRaw = "0", mi = "0", sec = "0", ampm?: string): number {
  let h = Number(hRaw);
  if (ampm) {
    const pm = ampm.toLowerCase() === "pm";
    if (pm && h < 12) h += 12;
    if (!pm && h === 12) h = 0;
  }
  return new Date(y, mo, d, h, Number(mi), Number(sec)).getTime();
}

export function parseTimestamp(raw: string): number {
  const s = raw.trim().replace(/\s+/g, " ");
  if (!s) return NaN;
  // "September 30 2026 @ 7:59:06 pm" / "Sep 30, 2026 7:59 PM" (Topstep dashboard)
  const words = s.match(
    /^([A-Za-z]{3,9})\.? (\d{1,2}),? (\d{4})(?: ?(?:@|at|,)? ?(\d{1,2}):(\d{2})(?::(\d{2}))? ?([AaPp][Mm])?)?$/,
  );
  if (words) {
    const mo = MONTHS[words[1].toLowerCase().slice(0, 4)] ?? MONTHS[words[1].toLowerCase().slice(0, 3)];
    if (mo !== undefined) return withClock(Number(words[3]), mo, Number(words[2]), words[4], words[5], words[6], words[7]);
  }
  const us = s.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:[ ,T]+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AaPp][Mm])?)?$/,
  );
  if (us) {
    const [, mo, d, yRaw, hRaw, mi, sec, ampm] = us;
    let y = Number(yRaw);
    if (y < 100) y += 2000;
    return withClock(y, Number(mo) - 1, Number(d), hRaw, mi, sec, ampm);
  }
  const t = Date.parse(s);
  return Number.isNaN(t) ? NaN : t;
}

/**
 * The trading day a timestamp belongs to. Futures sessions open the evening
 * before (18:00 ET for CME), so with `sessionStartHour` = 18 anything from
 * 6 PM onwards counts as the next calendar day, matching Topstep's reports.
 * With an hour at or before noon, times before it belong to the previous day.
 */
export function tradingDay(ms: number, sessionStartHour: number): string {
  const d = new Date(ms);
  const h = d.getHours();
  if (sessionStartHour > 12) {
    if (h >= sessionStartHour) d.setDate(d.getDate() + 1);
  } else if (h < sessionStartHour) {
    d.setDate(d.getDate() - 1);
  }
  return dayKey(d);
}

/** "ESZ26" -> "ES", "/MNQ" -> "MNQ", "MNQZ26" -> "MNQ". */
export function rootSymbol(contract: string): string {
  const c = contract.replace(/^\//, "").toUpperCase();
  const m = c.match(/^([A-Z0-9]+?)[FGHJKMNQUVXZ]\d{1,2}$/);
  return m ? m[1] : c;
}
