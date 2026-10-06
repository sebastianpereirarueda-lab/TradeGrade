import { read, utils } from "xlsx";
import { type ParseResult } from "./rows";
import { parseGrid } from "./grid";

/** Parse every sheet of a workbook and keep the one with the most trades. */
export function parseTradesXlsx(data: ArrayBuffer, source = "Excel"): ParseResult {
  const wb = read(data, { type: "array", cellDates: true });
  let best: ParseResult | null = null;
  for (const name of wb.SheetNames) {
    const sheet = wb.Sheets[name];
    const grid = utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: "" });
    const r = parseGrid(grid, `${source} / ${name}`);
    if (!best || r.trades.length > best.trades.length) best = r;
  }
  return best ?? { trades: [], columns: {}, skipped: 0, errors: [`${source}: workbook has no sheets.`], source };
}
