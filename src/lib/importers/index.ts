import type { ParseResult } from "./rows";
import { parseTradesCsv } from "./csv";

export type { ParseResult } from "./rows";
export { mergeTrades } from "./rows";

export const ACCEPT = ".csv,.tsv,.txt,.xlsx,.xlsm,.xls,.pdf,text/csv,application/pdf,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** Parse a trade export of any supported type. Heavy parsers load on demand. */
export async function parseTradesFile(file: File): Promise<ParseResult> {
  const ext = file.name.toLowerCase().split(".").pop() ?? "";
  const source = file.name;
  try {
    if (ext === "pdf" || file.type === "application/pdf") {
      const { parseTradesPdf } = await import("./pdf");
      return await parseTradesPdf(await file.arrayBuffer(), source);
    }
    if (["xlsx", "xlsm", "xls"].includes(ext) || file.type.includes("spreadsheet") || file.type.includes("ms-excel")) {
      const { parseTradesXlsx } = await import("./xlsx");
      return parseTradesXlsx(await file.arrayBuffer(), source);
    }
    return parseTradesCsv(await file.text(), source);
  } catch (err) {
    return { trades: [], columns: {}, skipped: 0, errors: [`${source}: ${(err as Error).message}`], source };
  }
}
