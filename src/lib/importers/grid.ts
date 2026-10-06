import { findHeaderRow, headerScore, mapRows, type ParseResult } from "./rows";
import { isOrdersExport, ordersToTrades } from "./orders";

/** Parse a header-plus-rows grid from any tabular source: trade list or orders export. */
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
  if (isOrdersExport(headers)) return ordersToTrades(headers, body, source);
  return { ...mapRows(headers, body), source };
}
