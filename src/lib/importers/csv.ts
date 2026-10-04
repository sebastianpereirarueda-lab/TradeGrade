import Papa from "papaparse";
import { parseGrid, type ParseResult } from "./rows";

export function parseTradesCsv(text: string, source = "CSV"): ParseResult {
  const parsed = Papa.parse<string[]>(text, { skipEmptyLines: true });
  return parseGrid(parsed.data, source);
}
