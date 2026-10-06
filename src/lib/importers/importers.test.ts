import { describe, expect, it } from "vitest";
import { utils, write } from "xlsx";
import { parseTradesXlsx } from "./xlsx";
import { headerColumns, itemsToGrid, tokenize, type TextItem } from "./pdf";
import { parseGrid } from "./grid";
import { parseTradesCsv } from "./csv";
import { parseTimestamp } from "../dates";

const HEADERS = ["ID", "Contract", "Size", "Entry Time", "Exit Time", "Duration", "Entry Price", "Exit Price", "P&L", "Commissions", "Fees", "Direction"];
const ROW = ["31558224", "ESZ26", 1, "September 30 2026 @ 7:59:06 pm", "September 30 2026 @ 8:24:31 pm", "00:25:24", "7,743.50", "7,735.00", "$425.00", "$-1.00", "$-2.78", "Short"];

describe("xlsx importer", () => {
  it("reads a workbook with a title row above the header", () => {
    const wb = utils.book_new();
    const ws = utils.aoa_to_sheet([["Trade list export"], [], HEADERS, ROW, ["31558356", "MNQZ26", 3, new Date(2026, 8, 30, 19, 58, 5), new Date(2026, 8, 30, 20, 27, 9), "", 30817.75, 30775.25, 255, -1.5, -2.16, "Short"]]);
    utils.book_append_sheet(wb, ws, "Trades");
    const buf = write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
    const r = parseTradesXlsx(buf, "test.xlsx");
    expect(r.errors).toEqual([]);
    expect(r.trades).toHaveLength(2);
    expect(r.trades[0]).toMatchObject({ id: "31558224", contract: "ESZ26", pnl: 425, commissions: 1 });
    expect(r.trades[1]).toMatchObject({ id: "31558356", size: 3, pnl: 255, fees: 2.16 });
    expect(r.trades[1].entryTime).toBe(new Date(2026, 8, 30, 19, 58, 5).getTime());
  });
});

describe("pdf table rebuild", () => {
  it("tokenizes Topstep-style merged text runs", () => {
    const toks = tokenize("31558224 ESZ26 1 September 30 2026 @ 7:59:06 pm September 30 2026 @ 8:24:31 pm 00:25:24 7,743.50 7,735.00 $425.00 $-1.00 $-2.78 Short");
    expect(toks.map((t) => t.type)).toEqual(["number", "word", "number", "datetime", "datetime", "duration", "number", "number", "money", "money", "money", "word"]);
  });

  it("reads header phrases into column keys", () => {
    expect(headerColumns("ID Contract Size Entry Time Exit Time Duration Entry Price Exit Price P&L Commissions Fees Direction".split(" "))).toEqual([
      "id", "contract", "size", "entryTime", "exitTime", "duration", "entryPrice", "exitPrice", "pnl", "commissions", "fees", "direction",
    ]);
    expect(headerColumns(["Journal", "ID", "Symbol", "Qty", "Bought", "Timestamp", "Sold", "Timestamp", "Net", "P/L"])).toEqual([
      "unknown", "id", "contract", "size", "entryTime", "exitTime", "pnl",
    ]);
  });

  it("rebuilds a printed table with merged runs and a wrapped header, across pages", () => {
    // Exactly what pdf.js returns for a Chrome-printed Topstep trade list.
    const page1: TextItem[] = [
      { str: "Day Performance: 10/01/26", x: 5, y: 599.5, w: 107.8 },
      { str: "ID", x: 7.5, y: 560.6, w: 10 },
      { str: "Contract Size Entry Time", x: 57.2, y: 560.6, w: 123 },
      { str: "Exit Time", x: 287.6, y: 560.6, w: 44.4 },
      { str: "Duration", x: 446.7, y: 560.6, w: 41.2 },
      { str: "Entry", x: 512, y: 566.2, w: 25.6 },
      { str: "Price", x: 513.1, y: 554.9, w: 24.5 },
      { str: "Exit", x: 568.9, y: 566.2, w: 18.4 },
      { str: "Price", x: 562.7, y: 554.9, w: 24.5 },
      { str: "P&L Commissions", x: 611.8, y: 560.6, w: 90.9 },
      { str: "Fees Direction", x: 718.1, y: 560.6, w: 71.4 },
      { str: "31558224 ESZ26", x: 7.5, y: 530.5, w: 80.3 },
      { str: "1", x: 103.4, y: 530.5, w: 5.6 },
      { str: "September 30 2026 @ 7:59:06 pm September 30 2026 @ 8:24:31 pm 00:25:24", x: 128.5, y: 530.5, w: 357.2 },
      { str: "7,743.50", x: 498.6, y: 530.5, w: 39.1 },
      { str: "7,735.00", x: 548.2, y: 530.5, w: 39.1 },
      { str: "$425.00", x: 595.6, y: 530.5, w: 36.3 },
      { str: "$-1.00", x: 674.2, y: 530.5, w: 28.4 },
      { str: "$-2.78 Short", x: 712.5, y: 530.5, w: 57.4 },
      { str: " ", x: 87.8, y: 530.5, w: 24.9 },
    ];
    const page2: TextItem[] = [
      { str: "ID", x: 7.5, y: -100, w: 10 },
      { str: "Contract Size Entry Time Exit Time Duration Entry Price Exit Price P&L Commissions Fees Direction", x: 57, y: -100, w: 700 },
      { str: "31558356 MNQZ26 3", x: 7.5, y: -130, w: 101.5 },
      { str: "September 30 2026 @ 7:58:05 pm September 30 2026 @ 8:27:09 pm 00:29:04", x: 128.5, y: -130, w: 357.2 },
      { str: "30,817.75 30,775.25 $255.00 $-1.50 $-2.16 Short", x: 498, y: -130, w: 250 },
    ];
    const grid = itemsToGrid([...page2, ...page1]);
    expect(grid).toHaveLength(3);
    const r = parseGrid(grid, "test.pdf");
    expect(r.errors).toEqual([]);
    expect(r.trades).toHaveLength(2);
    expect(r.trades[0]).toMatchObject({ id: "31558224", contract: "ESZ26", size: 1, entryPrice: 7743.5, exitPrice: 7735, pnl: 425, commissions: 1, fees: 2.78, direction: "Short" });
    expect(r.trades[0].entryTime).toBe(new Date(2026, 8, 30, 19, 59, 6).getTime());
    expect(r.trades[0].exitTime).toBe(new Date(2026, 8, 30, 20, 24, 31).getTime());
    expect(r.trades[1]).toMatchObject({ id: "31558356", contract: "MNQZ26", size: 3, entryPrice: 30817.75, pnl: 255 });
  });
});

describe("Topstep export CSV", () => {
  const csv = [
    "Id,ContractName,EnteredAt,ExitedAt,EntryPrice,ExitPrice,Fees,PnL,Size,Type,TradeDay,TradeDuration,Commissions",
    "3127605808,MNQZ6,09/23/2026 09:02:54 -04:00,09/23/2026 09:30:00 -04:00,30952.750000000,31010.750000000,2.16000,-348.000000000,3,Short,09/23/2026 00:00:00 -05:00,00:27:05.7686110,1.50000",
    "3130410223,MNQZ6,09/23/2026 18:30:08 -04:00,09/23/2026 18:32:20 -04:00,30781.250000000,30795.000000000,3.60000,-137.500000000,5,Short,09/24/2026 00:00:00 -05:00,00:02:11.2465110,2.50000",
    "3155822416,ESZ6,09/30/2026 19:59:06 -04:00,09/30/2026 20:24:31 -04:00,7743.500000000,7735.000000000,2.78000,425.000000000,1,Short,10/01/2026 00:00:00 -05:00,00:25:24.4241880,1.00000",
  ].join("\n");

  it("maps every column including the broker's trade day", () => {
    const r = parseTradesCsv(csv, "trades_export.csv");
    expect(r.errors).toEqual([]);
    expect(r.trades).toHaveLength(3);
    expect(r.trades[0]).toMatchObject({
      id: "3127605808", contract: "MNQZ6", size: 3, entryPrice: 30952.75, exitPrice: 31010.75,
      fees: 2.16, pnl: -348, commissions: 1.5, direction: "Short", tradeDay: "2026-09-23",
    });
    expect(r.trades[1].tradeDay).toBe("2026-09-24"); // 6:30 PM trade belongs to the next session
    expect(r.trades[2]).toMatchObject({ contract: "ESZ6", pnl: 425, fees: 2.78, commissions: 1, tradeDay: "2026-10-01" });
  });

  it("honours explicit UTC offsets so the instant is exact in any browser zone", () => {
    expect(parseTimestamp("09/23/2026 09:02:54 -04:00")).toBe(Date.UTC(2026, 8, 23, 13, 2, 54));
    expect(parseTimestamp("09/23/2026 09:02:54 +0530")).toBe(Date.UTC(2026, 8, 23, 3, 32, 54));
    expect(parseTimestamp("2026-09-23T09:02:54Z")).toBe(Date.UTC(2026, 8, 23, 9, 2, 54));
    expect(parseTimestamp("September 30 2026 @ 7:59:06 pm -04:00")).toBe(Date.UTC(2026, 8, 30, 23, 59, 6));
  });
});
