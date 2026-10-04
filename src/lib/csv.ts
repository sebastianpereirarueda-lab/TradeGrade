import Papa from "papaparse";
import type { Trade, Direction } from "./types";
import { parseTimestamp } from "./dates";

/**
 * Column aliases, lower-cased and stripped of non-letters. The first header
 * matching an alias wins. This covers Topstep's trade list, Tradovate's
 * performance export and a generic hand-made sheet.
 */
const ALIASES: Record<keyof Trade, string[]> = {
  id: ["id", "tradeid", "tradenumber", "number"],
  contract: ["contract", "symbol", "instrument", "product", "contractname"],
  size: ["size", "qty", "quantity", "contracts", "lots", "filledqty"],
  entryTime: ["entrytime", "boughttimestamp", "opentime", "entrydate", "entry", "entrytimestamp"],
  exitTime: ["exittime", "soldtimestamp", "closetime", "exitdate", "exit", "exittimestamp"],
  entryPrice: ["entryprice", "buyprice", "openprice", "avgentry", "pricein"],
  exitPrice: ["exitprice", "sellprice", "closeprice", "avgexit", "priceout"],
  pnl: ["pl", "pnl", "profit", "profitloss", "netpl", "netpnl", "realizedpl", "grosspl"],
  commissions: ["commissions", "commission", "comm"],
  fees: ["fees", "fee", "exchangefees"],
  direction: ["direction", "side", "type", "longshort"],
};

function norm(h: string): string {
  return h.toLowerCase().replace(/[^a-z]/g, "");
}

function num(raw: unknown): number {
  if (raw === null || raw === undefined) return NaN;
  const s = String(raw).replace(/[$,\s]/g, "").replace(/^\((.*)\)$/, "-$1");
  if (s === "") return NaN;
  return Number(s);
}

function direction(raw: unknown, entry: number, exit: number, pnl: number): Direction {
  const s = String(raw ?? "").toLowerCase();
  if (s.startsWith("l") || s === "buy" || s === "b") return "Long";
  if (s.startsWith("s") || s === "sell") return "Short";
  // Infer from prices when the column is missing.
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
}

export function parseTradesCsv(text: string): ParseResult {
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });
  const headers = parsed.meta.fields ?? [];
  const columns: Partial<Record<keyof Trade, string>> = {};
  for (const key of Object.keys(ALIASES) as (keyof Trade)[]) {
    const found = headers.find((h) => ALIASES[key].includes(norm(h)));
    if (found) columns[key] = found;
  }
  const errors: string[] = [];
  const required: (keyof Trade)[] = ["entryTime", "exitTime", "pnl"];
  for (const r of required) if (!columns[r]) errors.push(`Missing a "${r}" column. Headers: ${headers.join(", ")}`);
  if (errors.length) return { trades: [], columns, skipped: 0, errors };

  const trades: Trade[] = [];
  let skipped = 0;
  parsed.data.forEach((row, i) => {
    const get = (k: keyof Trade) => (columns[k] ? row[columns[k]!] : undefined);
    const entryTime = parseTimestamp(String(get("entryTime") ?? ""));
    const exitTime = parseTimestamp(String(get("exitTime") ?? ""));
    const pnl = num(get("pnl"));
    if (!Number.isFinite(entryTime) || !Number.isFinite(exitTime) || !Number.isFinite(pnl)) {
      skipped += 1;
      return;
    }
    const entryPrice = num(get("entryPrice"));
    const exitPrice = num(get("exitPrice"));
    const size = num(get("size"));
    const id = String(get("id") ?? "").trim() || `${entryTime}-${exitTime}-${i}`;
    trades.push({
      id,
      contract: String(get("contract") ?? "").trim() || "?",
      size: Number.isFinite(size) && size > 0 ? size : 1,
      entryTime,
      exitTime,
      entryPrice: Number.isFinite(entryPrice) ? entryPrice : NaN,
      exitPrice: Number.isFinite(exitPrice) ? exitPrice : NaN,
      pnl,
      commissions: Math.abs(num(get("commissions"))) || 0,
      fees: Math.abs(num(get("fees"))) || 0,
      direction: direction(get("direction"), entryPrice, exitPrice, pnl),
    });
  });
  return { trades, columns, skipped, errors };
}

/** Merge incoming trades into existing ones, replacing duplicates by id. */
export function mergeTrades(existing: Trade[], incoming: Trade[]): Trade[] {
  const map = new Map(existing.map((t) => [t.id, t]));
  for (const t of incoming) map.set(t.id, t);
  return [...map.values()].sort((a, b) => a.exitTime - b.exitTime);
}
