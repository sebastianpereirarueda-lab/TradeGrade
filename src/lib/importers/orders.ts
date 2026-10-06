/**
 * Build round-trip trades from an orders / fills export (one row per order),
 * such as Topstep's "Export orders" or Tradovate's Orders report. Filled
 * orders are matched first-in-first-out per contract; P&L comes from the
 * contract's point value. Orders exports carry no commissions or fees, so the
 * resulting trades are gross.
 */
import type { Direction, Trade } from "../types";
import { parseDateOnly } from "../dates";
import { pointValue } from "../contracts";
import { normHeader, num, time, type ParseResult } from "./rows";

const COLS = {
  id: ["id", "orderid", "order"],
  contract: ["contractname", "contract", "symbol", "instrument", "product"],
  status: ["status", "orderstatus"],
  side: ["side", "bs", "buysell", "action"],
  qty: ["filledqty", "filledquantity", "size", "qty", "quantity"],
  price: ["executeprice", "avgprice", "avgfillprice", "averageprice", "fillprice", "filledprice", "executionprice"],
  fillTime: ["filledat", "filltime", "filledtime", "executiontime"],
  tradeDay: ["tradeday", "tradingday"],
} as const;
type Col = keyof typeof COLS;

function find(headers: string[], col: Col): number {
  return headers.findIndex((h) => (COLS[col] as readonly string[]).includes(h));
}

/** True when the header row looks like an orders export rather than a trade list. */
export function isOrdersExport(headers: unknown[]): boolean {
  const h = headers.map(normHeader);
  const hasExit = h.some((x) => ["exittime", "exitedat", "soldtimestamp", "closetime", "exitdate"].includes(x));
  return !hasExit && find(h, "status") >= 0 && find(h, "side") >= 0 && find(h, "price") >= 0 && find(h, "fillTime") >= 0;
}

function sideOf(raw: unknown): 1 | -1 | 0 {
  const s = String(raw ?? "").trim().toLowerCase();
  if (["bid", "buy", "b", "long"].includes(s)) return 1;
  if (["ask", "sell", "s", "short"].includes(s)) return -1;
  return 0;
}

interface Fill {
  id: string;
  contract: string;
  side: 1 | -1;
  qty: number;
  price: number;
  time: number;
  tradeDay: string | null;
  row: number;
}

interface Lot {
  fill: Fill;
  qty: number; // remaining, positive
}

const round2 = (x: number) => Math.round(x * 100) / 100;

export function ordersToTrades(headers: unknown[], rows: unknown[][], source = "Orders"): ParseResult {
  const h = headers.map(normHeader);
  const idx = Object.fromEntries((Object.keys(COLS) as Col[]).map((c) => [c, find(h, c)])) as Record<Col, number>;
  const columns: ParseResult["columns"] = {};
  if (idx.contract >= 0) columns.contract = String(headers[idx.contract]);
  if (idx.qty >= 0) columns.size = String(headers[idx.qty]);
  if (idx.fillTime >= 0) columns.entryTime = columns.exitTime = String(headers[idx.fillTime]);
  if (idx.price >= 0) columns.entryPrice = columns.exitPrice = String(headers[idx.price]);
  if (idx.side >= 0) columns.direction = String(headers[idx.side]);
  if (idx.tradeDay >= 0) columns.tradeDay = String(headers[idx.tradeDay]);

  const errors: string[] = [];
  const notes: string[] = [];
  const get = (r: unknown[], c: Col) => (idx[c] >= 0 ? r[idx[c]] : undefined);

  let ignored = 0;
  let skipped = 0;
  const fills: Fill[] = [];
  rows.forEach((r, i) => {
    if (!r.some((c) => String(c ?? "").trim() !== "")) return;
    const status = String(get(r, "status") ?? "").trim().toLowerCase();
    if (status && status !== "filled" && status !== "fill" && status !== "complete" && status !== "completed") {
      ignored++;
      return;
    }
    const side = sideOf(get(r, "side"));
    const qty = Math.abs(num(get(r, "qty")));
    const price = num(get(r, "price"));
    const t = time(get(r, "fillTime"));
    const contract = String(get(r, "contract") ?? "").trim();
    if (!side || !qty || !Number.isFinite(price) || !Number.isFinite(t) || !contract) {
      skipped++;
      return;
    }
    const dayRaw = get(r, "tradeDay");
    fills.push({
      id: String(get(r, "id") ?? "").trim() || `row${i + 1}`,
      contract,
      side,
      qty,
      price,
      time: t,
      tradeDay: dayRaw === undefined || dayRaw === "" ? null : parseDateOnly(String(dayRaw)),
      row: i,
    });
  });
  fills.sort((a, b) => a.time - b.time || a.row - b.row);

  const unknown = new Set<string>();
  const open = new Map<string, Lot[]>();
  const trades: Trade[] = [];
  for (const f of fills) {
    const pv = pointValue(f.contract);
    if (pv === undefined) {
      unknown.add(f.contract);
      continue;
    }
    const lots = open.get(f.contract) ?? [];
    let remaining = f.qty;
    while (remaining > 0 && lots.length && lots[0].fill.side !== f.side) {
      const lot = lots[0];
      const q = Math.min(remaining, lot.qty);
      const long = lot.fill.side === 1;
      const points = (f.price - lot.fill.price) * (long ? 1 : -1);
      const direction: Direction = long ? "Long" : "Short";
      trades.push({
        id: `${lot.fill.id}-${f.id}${lot.qty !== lot.fill.qty || q !== f.qty ? `-${q}` : ""}`,
        contract: f.contract,
        size: q,
        entryTime: lot.fill.time,
        exitTime: f.time,
        entryPrice: lot.fill.price,
        exitPrice: f.price,
        pnl: round2(points * q * pv),
        commissions: 0,
        fees: 0,
        direction,
        ...(f.tradeDay ? { tradeDay: f.tradeDay } : {}),
      });
      lot.qty -= q;
      remaining -= q;
      if (lot.qty === 0) lots.shift();
    }
    if (remaining > 0) lots.push({ fill: { ...f }, qty: remaining });
    open.set(f.contract, lots);
  }

  if (unknown.size) {
    errors.push(
      `No point value known for ${[...unknown].join(", ")}, so those fills were left out. Use the trades export for these contracts.`,
    );
  }
  const stillOpen = [...open.entries()].filter(([, l]) => l.length);
  if (stillOpen.length) {
    notes.push(
      `Still open at the end of the file: ${stillOpen
        .map(([c, l]) => `${l.reduce((a, x) => a + x.qty, 0)} ${c}`)
        .join(", ")}. Those are not counted until a later export closes them.`,
    );
  }
  notes.unshift(
    `Orders export: built ${trades.length} trades from ${fills.length} filled orders` +
      (ignored ? `, ignored ${ignored} cancelled or rejected` : "") +
      ". Orders exports have no commissions or fees, so P&L is gross; the trades export gives exact net P&L.",
  );
  return { trades, columns, skipped, errors, notes, source };
}
