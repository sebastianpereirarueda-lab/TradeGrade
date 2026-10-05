/**
 * Journal attachments (screenshots, videos, voice notes) stored as Blobs in
 * IndexedDB. localStorage is far too small for media; IndexedDB holds hundreds
 * of megabytes per origin and keeps Blobs as-is.
 */
import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import { getAuth } from "./auth";

const DB_NAME = "tradegrade-media";
const BUCKET = "media";
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

async function putLocal(row: StoredAttachment): Promise<void> {
  const s = await store("readwrite");
  await request(s.put(row));
}

/* ---------- cloud mirror (only when signed in and configured) ---------- */

function cloud(): { client: NonNullable<typeof supabase>; userId: string } | null {
  const user = getAuth().user;
  if (!supabase || !user) return null;
  return { client: supabase, userId: user.id };
}

async function uploadToCloud(row: StoredAttachment): Promise<void> {
  const c = cloud();
  if (!c) return;
  const path = `${c.userId}/${row.id}`;
  const up = await c.client.storage.from(BUCKET).upload(path, row.blob, { contentType: row.type, upsert: true });
  if (up.error) throw up.error;
  const ins = await c.client.from("attachments").upsert({
    id: row.id,
    user_id: c.userId,
    date: row.date,
    name: row.name,
    type: row.type,
    size: row.size,
    created_at: new Date(row.createdAt).toISOString(),
  });
  if (ins.error) throw ins.error;
}

async function removeFromCloud(id: string): Promise<void> {
  const c = cloud();
  if (!c) return;
  await c.client.storage.from(BUCKET).remove([`${c.userId}/${id}`]);
  await c.client.from("attachments").delete().eq("id", id);
}

interface RemoteRow {
  id: string;
  date: string;
  name: string;
  type: string;
  size: number;
  created_at: string;
}

/** Download any attachments for `date` the account has that this device lacks. */
async function pullRemoteForDate(date: string): Promise<boolean> {
  const c = cloud();
  if (!c) return false;
  const { data, error } = await c.client.from("attachments").select("*").eq("date", date);
  if (error || !data?.length) return false;
  const localIds = new Set((await listAttachments(date)).map((a) => a.id));
  let added = false;
  for (const r of data as RemoteRow[]) {
    if (localIds.has(r.id)) continue;
    const dl = await c.client.storage.from(BUCKET).download(`${c.userId}/${r.id}`);
    if (dl.error || !dl.data) continue;
    const blob = dl.data.type ? dl.data : new Blob([dl.data], { type: r.type });
    await putLocal({ id: r.id, date: r.date, name: r.name, type: r.type, size: r.size, createdAt: new Date(r.created_at).getTime(), blob });
    added = true;
  }
  return added;
}

async function remoteDates(): Promise<string[]> {
  const c = cloud();
  if (!c) return [];
  const { data } = await c.client.from("attachments").select("date");
  return (data ?? []).map((r) => String((r as { date: string }).date));
}

/** After sign-in: upload every local attachment the account does not have yet. */
export async function pushLocalMedia(): Promise<void> {
  const c = cloud();
  if (!c) return;
  const { data } = await c.client.from("attachments").select("id");
  const remote = new Set((data ?? []).map((r) => String((r as { id: string }).id)));
  const s = await store("readonly");
  const all = await request(s.getAll() as IDBRequest<StoredAttachment[]>);
  for (const row of all) if (!remote.has(row.id)) await uploadToCloud(row).catch(() => undefined);
}

/* ---------- CRUD ---------- */

export async function addAttachment(date: string, blob: Blob, name: string): Promise<Attachment> {
  const meta: Attachment = {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    date,
    name,
    type: blob.type || "application/octet-stream",
    size: blob.size,
    createdAt: Date.now(),
  };
  const row: StoredAttachment = { ...meta, blob };
  await putLocal(row);
  emit();
  await uploadToCloud(row); // throws so the UI can say the cloud copy failed
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
  await removeFromCloud(id).catch(() => undefined);
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
    void load().then(async () => {
      if (await pullRemoteForDate(date).catch(() => false)) {
        if (!cancelled) await load();
      }
    });
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
    const load = async () => {
      const local = await attachmentDates().catch(() => new Set<string>());
      for (const d of await remoteDates().catch(() => [] as string[])) local.add(d);
      setDates(local);
    };
    void load();
    return onMediaChange(() => void load());
  }, []);
  return dates;
}
