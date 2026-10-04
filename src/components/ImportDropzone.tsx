import { useState, type DragEvent } from "react";
import { ACCEPT, parseTradesFile, type ParseResult } from "../lib/importers";

/** Click-or-drop file picker that parses CSV, Excel or PDF trade exports. */
export function ImportDropzone({ onParsed, compact = false }: { onParsed: (r: ParseResult) => void; compact?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);

  const handle = async (files: FileList | null) => {
    const f = files?.[0];
    if (!f) return;
    setBusy(true);
    try {
      onParsed(await parseTradesFile(f));
    } finally {
      setBusy(false);
    }
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    void handle(e.dataTransfer.files);
  };

  return (
    <label
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
      className={`block cursor-pointer rounded-lg border border-dashed text-center transition ${
        over ? "border-accent bg-accent/5" : "border-ink-3/60 hover:border-ink-2"
      } ${compact ? "px-4 py-5" : "px-6 py-10"}`}
    >
      <input type="file" accept={ACCEPT} className="hidden" onChange={(e) => void handle(e.target.files)} />
      <div className="text-sm font-medium">{busy ? "Reading file…" : "Drop your trade export here, or click to choose"}</div>
      <div className="mt-1 text-xs text-ink-3">CSV, Excel (.xlsx) or PDF from Topstep or any prop firm</div>
    </label>
  );
}
