import { aliasKey, headerScore, mapRows, normHeader, type ParseResult } from "./rows";
import type { Trade } from "../types";

export interface TextItem {
  str: string;
  x: number;
  y: number;
  w: number;
}

interface Line {
  y: number;
  items: TextItem[];
}

type ColKey = keyof Trade | "duration" | "unknown";
type TokType = "datetime" | "duration" | "money" | "number" | "word";
interface Tok {
  type: TokType;
  text: string;
}

/* ---------- lines ---------- */

export function groupLines(items: TextItem[], yTol = 3): Line[] {
  const lines: Line[] = [];
  for (const it of items) {
    if (!it.str.trim()) continue;
    const line = lines.find((l) => Math.abs(l.y - it.y) <= yTol);
    if (line) line.items.push(it);
    else lines.push({ y: it.y, items: [it] });
  }
  for (const l of lines) l.items.sort((a, b) => a.x - b.x);
  return lines.sort((a, b) => b.y - a.y); // top of page first
}

/* ---------- header ---------- */

/**
 * Column keys from header words, matching alias phrases of up to three words
 * ("entry time", "avg entry", "p&l"). Unrecognised words become "unknown"
 * columns so the data tokens still line up.
 */
export function headerColumns(words: string[]): ColKey[] {
  const cols: ColKey[] = [];
  let i = 0;
  while (i < words.length) {
    let matched = false;
    for (let n = Math.min(3, words.length - i); n >= 1; n--) {
      const norm = normHeader(words.slice(i, i + n).join(""));
      const key = norm === "duration" ? "duration" : aliasKey(norm);
      if (key) {
        cols.push(key);
        i += n;
        matched = true;
        break;
      }
    }
    if (!matched) {
      if (normHeader(words[i])) cols.push("unknown");
      i += 1;
    }
  }
  return cols;
}

/** Merge a window of lines into header cells: items overlapping in x belong to one (wrapped) cell. */
function headerCells(lines: Line[]): string[] {
  const cells: { x0: number; x1: number; parts: { y: number; str: string }[] }[] = [];
  for (const l of lines) {
    for (const it of l.items) {
      const x1 = it.x + it.w;
      const cell = cells.find((c) => it.x < c.x1 - 1 && x1 > c.x0 + 1);
      if (cell) {
        cell.parts.push({ y: it.y, str: it.str });
        cell.x0 = Math.min(cell.x0, it.x);
        cell.x1 = Math.max(cell.x1, x1);
      } else cells.push({ x0: it.x, x1, parts: [{ y: it.y, str: it.str }] });
    }
  }
  return cells
    .sort((a, b) => a.x0 - b.x0)
    .map((c) => c.parts.sort((a, b) => b.y - a.y).map((p) => p.str).join(" "));
}

function words(cells: string[]): string[] {
  return cells.join(" ").split(/\s+/).filter(Boolean);
}

/** Find the header: the 1–3 line window (within 20px) that yields the most distinct known columns. */
function findHeader(lines: Line[]): { cols: ColKey[]; endIndex: number } | null {
  let best: { cols: ColKey[]; endIndex: number; known: number } | null = null;
  for (let i = 0; i < lines.length; i++) {
    const windows = [[i], [i, i + 1], [i - 1, i, i + 1]].map((w) => w.filter((j) => j >= 0 && j < lines.length));
    for (const w of windows) {
      const ls = w.map((j) => lines[j]);
      if (ls[ls.length - 1].y < ls[0].y - 20) continue;
      const cols = headerColumns(words(headerCells(ls)));
      const known = new Set(cols.filter((c) => c !== "unknown")).size;
      // A header needs the three required fields; the earliest best window wins.
      if (known >= 3 && (!best || known > best.known)) best = { cols, endIndex: Math.max(...w), known };
    }
  }
  return best;
}

/* ---------- tokens ---------- */

const PATTERNS: [TokType, RegExp][] = [
  ["datetime", /^[A-Za-z]{3,9}\.? \d{1,2},? \d{4}(?: ?(?:@|at|,)? ?\d{1,2}:\d{2}(?::\d{2})? ?(?:[AaPp][Mm])?)?/],
  ["datetime", /^\d{1,2}\/\d{1,2}\/\d{2,4}(?:[ ,T]+\d{1,2}:\d{2}(?::\d{2})? ?(?:[AaPp][Mm])?)?/],
  ["datetime", /^\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)?/],
  ["duration", /^\d{1,3}:\d{2}(?::\d{2})?(?![\d:])/],
  ["money", /^\(?-?\$ ?-?[\d,]*\.?\d+\)?/],
  ["number", /^\(?-?[\d,]*\.?\d+\)?%?(?![\w:])/],
  ["word", /^\S+/],
];

export function tokenize(text: string): Tok[] {
  const toks: Tok[] = [];
  let rest = text.trim();
  while (rest) {
    let hit = false;
    for (const [type, re] of PATTERNS) {
      const m = rest.match(re);
      if (m && m[0]) {
        toks.push({ type, text: m[0].trim() });
        rest = rest.slice(m[0].length).trimStart();
        hit = true;
        break;
      }
    }
    if (!hit) rest = rest.slice(1).trimStart();
  }
  return toks;
}

const ACCEPTS: Record<ColKey, TokType[]> = {
  id: ["number", "word"],
  contract: ["word"],
  size: ["number"],
  entryTime: ["datetime"],
  exitTime: ["datetime"],
  entryPrice: ["number", "money"],
  exitPrice: ["number", "money"],
  pnl: ["money", "number"],
  commissions: ["money", "number"],
  fees: ["money", "number"],
  direction: ["word"],
  duration: ["duration"],
  unknown: ["datetime", "duration", "money", "number", "word"],
};

/** Align a line's tokens to the header columns, left to right. */
export function alignRow(cols: ColKey[], toks: Tok[]): string[] {
  const row: string[] = Array(cols.length).fill("");
  let j = 0;
  for (let c = 0; c < cols.length && j < toks.length; c++) {
    const col = cols[c];
    const tok = toks[j];
    if (!ACCEPTS[col].includes(tok.type)) continue;
    if (col === "unknown") {
      const next = cols[c + 1];
      if (next && ACCEPTS[next].includes(tok.type)) continue; // let the known column have it
    }
    row[c] = tok.text;
    j++;
  }
  return row;
}

/* ---------- grid ---------- */

/** Rebuild a trade table from positioned text items (all pages, top to bottom). */
export function itemsToGrid(items: TextItem[]): unknown[][] {
  const lines = groupLines(items);
  const header = findHeader(lines);
  if (!header) return [];
  const grid: unknown[][] = [header.cols.map((c) => (c === "unknown" ? "" : c))];
  for (const line of lines.slice(header.endIndex + 1)) {
    const text = line.items.map((i) => i.str).join(" ");
    if (headerScore(text.split(/\s+/)) >= 3) continue; // repeated header on a later page
    const toks = tokenize(text);
    if (toks.filter((t) => t.type === "datetime").length < 2) continue; // not a trade row
    grid.push(alignRow(header.cols, toks));
  }
  return grid;
}

export async function parseTradesPdf(data: ArrayBuffer, source = "PDF"): Promise<ParseResult> {
  const pdfjs = await import("pdfjs-dist");
  const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const doc = await pdfjs.getDocument({ data }).promise;
  const items: TextItem[] = [];
  let yOffset = 0;
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const height = page.view[3] - page.view[1];
    for (const it of content.items) {
      if (!("str" in it)) continue;
      items.push({ str: it.str, x: it.transform[4], y: it.transform[5] - yOffset, w: it.width });
    }
    yOffset += height + 50; // keep pages in reading order, never overlapping
  }
  const grid = itemsToGrid(items);
  if (!grid.length) {
    return {
      trades: [],
      columns: {},
      skipped: 0,
      errors: [`${source}: could not find a trade table (a header with entry time, exit time and P&L).`],
      source,
    };
  }
  return { ...mapRows(grid[0], grid.slice(1)), source };
}
