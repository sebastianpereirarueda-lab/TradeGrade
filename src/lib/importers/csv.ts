import Papa from "papaparse";
import { type ParseResult } from "./rows";
import { parseGrid } from "./grid";

export function parseTradesCsv(text: string, source = "CSV"): ParseResult {
  const parsed = Papa.parse<string[]>(text, { skipEmptyLines: true });
  return parseGrid(parsed.data, source);
}
