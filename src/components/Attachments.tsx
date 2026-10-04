import { useEffect, useRef, useState, type DragEvent } from "react";
import { addAttachment, deleteAttachment, kindOf, persistStorage, storageEstimate, useAttachments, type AttachmentView } from "../lib/media";
import { Card } from "./ui";

const ACCEPT = "image/*,video/*,audio/*";

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function fmtClock(sec: number): string {
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
}

/** Screenshots, videos and voice notes for one trading day. */
export function Attachments({ date }: { date: string }) {
  const { items } = useAttachments(date);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [lightbox, setLightbox] = useState<AttachmentView | null>(null);
  const [usage, setUsage] = useState<{ usage: number; quota: number } | null>(null);

  // Recording
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const canRecord = typeof MediaRecorder !== "undefined" && !!navigator.mediaDevices?.getUserMedia;

  useEffect(() => {
    void storageEstimate().then(setUsage);
  }, [items.length]);

  const add = async (files: Iterable<File>) => {
    setBusy(true);
    setError("");
    try {
      let added = 0;
      for (const f of files) {
        if (kindOf(f.type) === "other") continue;
        await addAttachment(date, f, f.name || `${kindOf(f.type)}-${Date.now()}`);
        added++;
      }
      if (added) void persistStorage();
      else setError("Only images, videos and audio files are supported.");
    } catch (e) {
      setError(`Could not save: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  // Paste a screenshot anywhere on the page.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "TEXTAREA" || target.tagName === "INPUT") && !e.clipboardData?.files.length) return;
      const files = [...(e.clipboardData?.files ?? [])].filter((f) => kindOf(f.type) !== "other");
      if (!files.length) return;
      e.preventDefault();
      void add(files.map((f, i) => (f.name && f.name !== "image.png" ? f : new File([f], `pasted-${date}-${Date.now()}-${i}.${f.type.split("/")[1] || "png"}`, { type: f.type }))));
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    void add(e.dataTransfer.files);
  };

  const startRecording = async () => {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"].find((m) => MediaRecorder.isTypeSupported(m));
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunks.current = [];
      rec.ondataavailable = (ev) => ev.data.size && chunks.current.push(ev.data);
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const type = rec.mimeType || "audio/webm";
        const blob = new Blob(chunks.current, { type });
        const ext = type.includes("mp4") ? "m4a" : type.includes("ogg") ? "ogg" : "webm";
        if (blob.size) await addAttachment(date, blob, `voice-note-${new Date().toISOString().slice(11, 19).replace(/:/g, "")}.${ext}`);
        setRecording(false);
      };
      rec.start();
      recorder.current = rec;
      setSeconds(0);
      setRecording(true);
    } catch (e) {
      setError(`Microphone unavailable: ${(e as Error).message}`);
    }
  };
  const stopRecording = () => recorder.current?.state !== "inactive" && recorder.current?.stop();
  useEffect(() => {
    if (!recording) return;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [recording]);

  return (
    <Card title="Attachments">
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
        className={`block cursor-pointer rounded-lg border border-dashed px-4 py-4 text-center transition ${
          over ? "border-accent bg-accent/5" : "border-ink-3/60 hover:border-ink-2"
        }`}
      >
        <input type="file" multiple accept={ACCEPT} className="hidden" onChange={(e) => e.target.files && void add(e.target.files)} />
        <div className="text-sm font-medium">{busy ? "Saving…" : "Drop screenshots, videos or audio here, or click to choose"}</div>
        <div className="mt-1 text-xs text-ink-3">You can also paste a screenshot anywhere on this page.</div>
      </label>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {canRecord &&
          (recording ? (
            <button className="btn btn-danger" onClick={stopRecording}>
              ■ Stop recording {fmtClock(seconds)}
            </button>
          ) : (
            <button className="btn" onClick={() => void startRecording()}>
              ● Record voice note
            </button>
          ))}
        {usage && usage.quota > 0 && (
          <span className="text-xs text-ink-3">
            {fmtBytes(usage.usage)} used of {fmtBytes(usage.quota)} available in this browser
          </span>
        )}
      </div>
      {error && <div className="mt-2 text-sm text-loss">{error}</div>}

      {items.length > 0 && (
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((a) => {
            const kind = kindOf(a.type);
            return (
              <li key={a.id} className="group relative overflow-hidden rounded-md border border-line bg-page">
                {kind === "image" && (
                  <button className="block w-full" onClick={() => setLightbox(a)} title="View full size">
                    <img src={a.url} alt={a.name} className="aspect-video w-full object-cover" />
                  </button>
                )}
                {kind === "video" && <video src={a.url} controls preload="metadata" className="aspect-video w-full bg-black" />}
                {kind === "audio" && (
                  <div className="flex aspect-video flex-col items-center justify-center gap-2 px-2">
                    <span className="text-2xl" aria-hidden>
                      🎙
                    </span>
                    <audio src={a.url} controls preload="metadata" className="w-full" />
                  </div>
                )}
                <div className="flex items-center justify-between gap-2 px-2 py-1.5 text-xs">
                  <span className="truncate text-ink-2" title={a.name}>
                    {a.name}
                  </span>
                  <span className="shrink-0 text-ink-3">{fmtBytes(a.size)}</span>
                </div>
                <div className="absolute right-1 top-1 flex gap-1 opacity-0 transition group-hover:opacity-100">
                  <a className="btn !px-2" href={a.url} download={a.name} title="Download">
                    ↓
                  </a>
                  <button
                    className="btn btn-danger !px-2"
                    title="Delete"
                    onClick={() => {
                      if (confirm(`Delete ${a.name}?`)) void deleteAttachment(a.id);
                    }}
                  >
                    ✕
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-6"
          onClick={() => setLightbox(null)}
          role="dialog"
          aria-label={lightbox.name}
        >
          <img src={lightbox.url} alt={lightbox.name} className="max-h-full max-w-full rounded-md shadow-2xl" />
        </div>
      )}
    </Card>
  );
}
