import { describe, expect, it } from "vitest";
import { parseTradesCsv } from "./csv";
import { isOrdersExport } from "./orders";

const HEADER =
  "Id,AccountName,ContractName,Status,Type,Size,Side,CreatedAt,TradeDay,FilledAt,CancelledAt,TriggeredAt,StopPrice,LimitPrice,ExecutePrice,TriggeredPrice,PositionDisposition,CreationDisposition,RejectionReason,ExchangeOrderId,PlatformOrderId";
const row = (id: string, contract: string, status: string, size: number, side: string, filled: string, price: string, disp = "") =>
  `${id},ACCT,${contract},${status},Market,${size},${side},10/06/2026 08:00:00 -04:00,10/06/2026 00:00:00 -05:00,${filled},,,,,${price},,${disp},Trader,,,`;

describe("orders export", () => {
  it("is recognised from its headers", () => {
    expect(isOrdersExport(HEADER.split(","))).toBe(true);
    expect(isOrdersExport("Id,ContractName,EnteredAt,ExitedAt,PnL,Side,Status,ExecutePrice,FilledAt".split(","))).toBe(false);
  });

  it("pairs fills FIFO per contract, out of order rows, longs and shorts, and ignores non-fills", () => {
    const csv = [
      "﻿" + HEADER,
      row("2", "MNQZ6", "Filled", 3, "Ask", "10/06/2026 08:42:02 -04:00", "31467.500000000", "Closing"),
      row("1", "MNQZ6", "Filled", 3, "Bid", "10/06/2026 08:39:26 -04:00", "31482.916666667", "Opening"),
      row("9", "MNQZ6", "Rejected", 3, "Bid", "", ""),
      row("8", "MNQZ6", "Cancelled", 3, "Ask", "", ""),
      row("3", "MNQZ6", "Filled", 3, "Ask", "10/06/2026 08:43:10 -04:00", "31469.500000000", "Opening"),
      row("4", "MNQZ6", "Filled", 3, "Bid", "10/06/2026 08:50:19 -04:00", "31478.000000000", "Closing"),
      row("5", "NQZ6", "Filled", 1, "Bid", "10/06/2026 10:16:10 -04:00", "31562.000000000", "Opening"),
      row("6", "NQZ6", "Filled", 1, "Ask", "10/06/2026 10:19:01 -04:00", "31547.500000000", "Closing"),
    ].join("\r\n");
    const r = parseTradesCsv(csv, "orders_export.csv");
    expect(r.errors).toEqual([]);
    expect(r.trades).toHaveLength(3);
    const [a, b, c] = r.trades;
    expect(a).toMatchObject({ id: "1-2", contract: "MNQZ6", size: 3, direction: "Long", entryPrice: 31482.916666667, exitPrice: 31467.5, pnl: -92.5, tradeDay: "2026-10-06", fees: 0, commissions: 0 });
    expect(b).toMatchObject({ id: "3-4", direction: "Short", pnl: -51 });
    expect(c).toMatchObject({ id: "5-6", contract: "NQZ6", size: 1, pnl: -290 });
    expect(a.entryTime).toBe(Date.UTC(2026, 9, 6, 12, 39, 26));
    expect(r.notes?.[0]).toMatch(/built 3 trades from 6 filled orders, ignored 2/);
  });

  it("splits partial closes and scale-ins, and reports positions left open", () => {
    const csv = [
      HEADER,
      row("1", "MESZ6", "Filled", 2, "Bid", "10/06/2026 09:00:00 -04:00", "6000.00"),
      row("2", "MESZ6", "Filled", 1, "Bid", "10/06/2026 09:01:00 -04:00", "6002.00"),
      row("3", "MESZ6", "Filled", 2, "Ask", "10/06/2026 09:05:00 -04:00", "6010.00"),
      row("4", "MESZ6", "Filled", 3, "Ask", "10/06/2026 09:06:00 -04:00", "6012.00"), // closes 1, opens 2 short
    ].join("\n");
    const r = parseTradesCsv(csv);
    expect(r.trades.map((t) => [t.size, t.direction, t.pnl])).toEqual([
      [2, "Long", 100], // (6010-6000)*2*$5
      [1, "Long", 50], // (6012-6002)*1*$5
    ]);
    expect(r.notes?.join(" ")).toMatch(/Still open .*2 MESZ6/);
  });

  it("names contracts it cannot price", () => {
    const csv = [HEADER, row("1", "ZZZZ6", "Filled", 1, "Bid", "10/06/2026 09:00:00 -04:00", "10"), row("2", "ZZZZ6", "Filled", 1, "Ask", "10/06/2026 09:01:00 -04:00", "11")].join("\n");
    const r = parseTradesCsv(csv);
    expect(r.trades).toHaveLength(0);
    expect(r.errors[0]).toMatch(/ZZZZ6/);
  });

  it("reads Tradovate-style orders columns", () => {
    const csv = [
      "orderId,Account,Order ID,B/S,Contract,Product,avgPrice,filledQty,Fill Time,Status,Limit Price,Stop Price,Quantity,Text,Type",
      "1,ACC,1, Buy,MNQZ6,MNQ,21000.25,1,10/06/2026 09:00:00, Filled,,,1,,Market",
      "2,ACC,2, Sell,MNQZ6,MNQ,21010.25,1,10/06/2026 09:03:00, Filled,,,1,,Market",
    ].join("\n");
    const r = parseTradesCsv(csv);
    expect(r.errors).toEqual([]);
    expect(r.trades).toHaveLength(1);
    expect(r.trades[0]).toMatchObject({ direction: "Long", pnl: 20, size: 1 });
  });
});
