/**
 * Journal attachments (screenshots, videos, voice notes) stored as Blobs in
 * IndexedDB. localStorage is far too small for media; IndexedDB holds hundreds
 * of megabytes per origin and keeps Blobs as-is.
 */
import { useEffect, useState } from "react";

const DB_NAME = "tradegrade-media";
const STORE = "attachments";

export interface Attachment {
  id: string;
  date: string; // trading day YYYY-MM-DD
  name: string;
  type: string; // MIME type
  size: number;
  createdAt: number;
}

export interface StoredAttachment extends Attachment {
  blob: Blob;
}

export interface AttachmentView extends Attachment {
  url: string; // object URL, revoked when the view unmounts
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const store = req.result.createObjectStore(STORE, { keyPath: "id" });
      store.createIndex("date", "date", { unique: false });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function request<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

async function store(mode: IDBTransactionMode): Promise<IDBObjectStore> {
  const db = await openDb();
  return db.transaction(STORE, mode).objectStore(STORE);
}

/* ---------- change notifications ---------- */

const listeners = new Set<() => void>();
function emit() {
  listeners.forEach((l) => l());
}
export function onMediaChange(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

/* ---------- CRUD ---------- */

export function kindOf(type: string): "image" | "video" | "audio" | "other" {
  if (type.startsWith("image/")) return "image";
  if (type.startsWith("video/")) return "video";
  if (type.startsWith("audio/")) return "audio";
  return "other";
}

export async function addAttachment(date: string, blob: Blob, name: string): Promise<Attachment> {
  const meta: Attachment = {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    date,
    name,
    type: blob.type || "application/octet-stream",
    size: blob.size,
    createdAt: Date.now(),
  };
  const s = await store("readwrite");
  await request(s.add({ ...meta, blob } satisfies StoredAttachment));
  emit();
  return meta;
}

export async function listAttachments(date: string): Promise<StoredAttachment[]> {
  const s = await store("readonly");
  const rows = await request(s.index("date").getAll(date) as IDBRequest<StoredAttachment[]>);
  return rows.sort((a, b) => a.createdAt - b.createdAt);
}

export async function deleteAttachment(id: string): Promise<void> {
  const s = await store("readwrite");
  await request(s.delete(id));
  emit();
}

/** Every trading day that has at least one attachment. */
export async function attachmentDates(): Promise<Set<string>> {
  const s = await store("readonly");
  const dates = new Set<string>();
  await new Promise<void>((resolve, reject) => {
    // A key cursor on the index yields index keys (dates) without loading blobs.
    const req = s.index("date").openKeyCursor(null, "nextunique");
    req.onsuccess = () => {
      const cur = req.result;
      if (!cur) return resolve();
      dates.add(String(cur.key));
      cur.continue();
    };
    req.onerror = () => reject(req.error);
  });
  return dates;
}

export async function countAttachments(): Promise<number> {
  const s = await store("readonly");
  return request(s.count());
}

/** Ask the browser not to evict our data under storage pressure. Best effort. */
export async function persistStorage(): Promise<boolean> {
  try {
    if (navigator.storage?.persist) return await navigator.storage.persist();
  } catch {
    /* ignore */
  }
  return false;
}

export async function storageEstimate(): Promise<{ usage: number; quota: number } | null> {
  try {
    if (!navigator.storage?.estimate) return null;
    const e = await navigator.storage.estimate();
    return { usage: e.usage ?? 0, quota: e.quota ?? 0 };
  } catch {
    return null;
  }
}

/* ---------- hooks ---------- */

/** Attachments for one day, as object URLs. Re-reads when media changes. */
export function useAttachments(date: string): { items: AttachmentView[]; loading: boolean } {
  const [items, setItems] = useState<AttachmentView[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let urls: string[] = [];
    let cancelled = false;
    const load = async () => {
      const rows = await listAttachments(date).catch(() => [] as StoredAttachment[]);
      if (cancelled) return;
      urls.forEach((u) => URL.revokeObjectURL(u));
      urls = rows.map((r) => URL.createObjectURL(r.blob));
      setItems(rows.map(({ blob: _b, ...meta }, i) => ({ ...meta, url: urls[i] })));
      setLoading(false);
    };
    void load();
    const off = onMediaChange(() => void load());
    return () => {
      cancelled = true;
      off();
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [date]);
  return { items, loading };
}

export function useAttachmentDates(): Set<string> {
  const [dates, setDates] = useState<Set<string>>(new Set());
  useEffect(() => {
    const load = () => attachmentDates().then(setDates).catch(() => undefined);
    void load();
    return onMediaChange(() => void load());
  }, []);
  return dates;
}
