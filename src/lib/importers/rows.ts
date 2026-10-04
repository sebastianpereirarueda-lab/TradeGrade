import type { Trade, Direction } from "../types";
import { parseDateOnly, parseTimestamp } from "../dates";

/**
 * Column aliases, lower-cased and stripped of non-letters. The first header
 * matching an alias wins. Covers Topstep's trade list, Tradovate's
 * performance export, and a generic hand-made sheet.
 */
const ALIASES: Record<keyof Trade, string[]> = {
  id: ["id", "tradeid", "tradenumber", "number", "orderid"],
  contract: ["contract", "symbol", "instrument", "product", "contractname", "ticker"],
  size: ["size", "qty", "quantity", "contracts", "lots", "filledqty", "volume"],
  entryTime: ["entrytime", "enteredat", "entered", "boughttimestamp", "opentime", "entrydate", "entry", "entrytimestamp", "opened", "open"],
  exitTime: ["exittime", "exitedat", "exited", "soldtimestamp", "closetime", "exitdate", "exit", "exittimestamp", "closed", "close"],
  entryPrice: ["entryprice", "buyprice", "openprice", "avgentry", "pricein", "entryavg"],
  exitPrice: ["exitprice", "sellprice", "closeprice", "avgexit", "priceout", "exitavg"],
  pnl: ["pl", "pnl", "profit", "profitloss", "netpl", "netpnl", "realizedpl", "grosspl", "realized"],
  commissions: ["commissions", "commission", "comm"],
  fees: ["fees", "fee", "exchangefees"],
  direction: ["direction", "side", "type", "longshort", "buysell"],
  tradeDay: ["tradeday", "tradingday", "sessiondate", "session"],
};

/** Trade field for a normalised header, if it is a known alias. */
export function aliasKey(norm: string): keyof Trade | undefined {
  for (const key of Object.keys(ALIASES) as (keyof Trade)[]) if (ALIASES[key].includes(norm)) return key;
  return undefined;
}

export function normHeader(h: unknown): string {
  return String(h ?? "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
}

/** How many of the given cells look like known trade-list headers. */
export function headerScore(cells: unknown[]): number {
  const all = new Set(Object.values(ALIASES).flat());
  return cells.filter((c) => all.has(normHeader(c))).length;
}

export function detectColumns(headers: unknown[]): Partial<Record<keyof Trade, number>> {
  const columns: Partial<Record<keyof Trade, number>> = {};
  const normed = headers.map(normHeader);
  for (const key of Object.keys(ALIASES) as (keyof Trade)[]) {
    const idx = normed.findIndex((h) => ALIASES[key].includes(h));
    if (idx !== -1) columns[key] = idx;
  }
  return columns;
}

export function num(raw: unknown): number {
  if (raw === null || raw === undefined) return NaN;
  if (typeof raw === "number") return raw;
  const s = String(raw)
    .replace(/[$,\s]/g, "")
    .replace(/^\((.*)\)$/, "-$1")
    .replace(/^\$?-\$?/, "-");
  if (s === "") return NaN;
  return Number(s);
}

export function time(raw: unknown): number {
  if (raw instanceof Date) return raw.getTime();
  if (typeof raw === "number") {
    // Epoch milliseconds or seconds from a spreadsheet cell.
    if (raw > 1e11) return raw;
    if (raw > 1e8) return raw * 1000;
    return NaN;
  }
  return parseTimestamp(String(raw ?? ""));
}

function direction(raw: unknown, entry: number, exit: number, pnl: number): Direction {
  const s = String(raw ?? "")
    .trim()
    .toLowerCase();
  if (s.startsWith("l") || s === "buy" || s === "b") return "Long";
  if (s.startsWith("s") || s === "sell") return "Short";
  if (Number.isFinite(entry) && Number.isFinite(exit) && entry !== exit) {
    return (exit > entry) === pnl >= 0 ? "Long" : "Short";
  }
  return "Long";
}

export interface ParseResult {
  trades: Trade[];
  columns: Partial<Record<keyof Trade, string>>;
  skipped: number;
  errors: string[];
  source?: string;
}

/** Turn a header row plus data rows into trades. Shared by every importer. */
export function mapRows(headers: unknown[], rows: unknown[][]): ParseResult {
  const idx = detectColumns(headers);
  const columns: Partial<Record<keyof Trade, string>> = {};
  for (const [k, i] of Object.entries(idx)) columns[k as keyof Trade] = String(headers[i]);
  const errors: string[] = [];
  const required: (keyof Trade)[] = ["entryTime", "exitTime", "pnl"];
  for (const r of required) {
    if (idx[r] === undefined) errors.push(`Missing a "${r}" column. Found: ${headers.map(String).join(", ")}`);
  }
  if (errors.length) return { trades: [], columns, skipped: 0, errors };

  const trades: Trade[] = [];
  let skipped = 0;
  rows.forEach((row, i) => {
    const get = (k: keyof Trade) => (idx[k] === undefined ? undefined : row[idx[k]!]);
    const entryTime = time(get("entryTime"));
    const exitTime = time(get("exitTime"));
    const pnl = num(get("pnl"));
    if (!Number.isFinite(entryTime) || !Number.isFinite(exitTime) || !Number.isFinite(pnl)) {
      if (row.some((c) => String(c ?? "").trim() !== "")) skipped += 1;
      return;
    }
    const entryPrice = num(get("entryPrice"));
    const exitPrice = num(get("exitPrice"));
    const size = num(get("size"));
    const id = String(get("id") ?? "").trim() || `${entryTime}-${exitTime}-${i}`;
    const tradeDayRaw = get("tradeDay");
    const tradeDay =
      tradeDayRaw instanceof Date
        ? parseDateOnly(`${tradeDayRaw.getFullYear()}-${String(tradeDayRaw.getMonth() + 1).padStart(2, "0")}-${String(tradeDayRaw.getDate()).padStart(2, "0")}`)
        : parseDateOnly(String(tradeDayRaw ?? ""));
    trades.push({
      id,
      contract: String(get("contract") ?? "").trim() || "?",
      size: Number.isFinite(size) && size > 0 ? Math.abs(size) : 1,
      entryTime,
      exitTime,
      entryPrice: Number.isFinite(entryPrice) ? entryPrice : NaN,
      exitPrice: Number.isFinite(exitPrice) ? exitPrice : NaN,
      pnl,
      commissions: Math.abs(num(get("commissions"))) || 0,
      fees: Math.abs(num(get("fees"))) || 0,
      direction: direction(get("direction"), entryPrice, exitPrice, pnl),
      ...(tradeDay ? { tradeDay } : {}),
    });
  });
  return { trades, columns, skipped, errors };
}

/** Find the header row in a grid (first row with 3+ recognised headers). */
export function findHeaderRow(grid: unknown[][]): number {
  for (let i = 0; i < Math.min(grid.length, 50); i++) {
    if (headerScore(grid[i]) >= 3) return i;
  }
  return -1;
}

export function parseGrid(grid: unknown[][], source: string): ParseResult {
  const h = findHeaderRow(grid);
  if (h === -1) {
    return {
      trades: [],
      columns: {},
      skipped: 0,
      errors: [`${source}: could not find a header row with trade columns (entry time, exit time, P&L...).`],
      source,
    };
  }
  const headers = grid[h];
  const body = grid.slice(h + 1).filter((r) => headerScore(r) < 3); // drop repeated headers (PDF pages)
  return { ...mapRows(headers, body), source };
}

/** Merge incoming trades into existing ones, replacing duplicates by id. */
export function mergeTrades(existing: Trade[], incoming: Trade[]): Trade[] {
  const map = new Map(existing.map((t) => [t.id, t]));
  for (const t of incoming) map.set(t.id, t);
  return [...map.values()].sort((a, b) => a.exitTime - b.exitTime);
}
