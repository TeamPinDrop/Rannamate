"use client";
/**
 * Photo storage for Tastory — in this browser only (IndexedDB). Nothing is uploaded anywhere.
 * Object URLs don't survive a refresh, so the Blob itself is stored and a fresh URL is
 * created on demand (and revoked when no longer needed).
 */
import { useEffect, useState } from "react";
import type { PhotoRef } from "./types";

const DB = "rannamate-tastory";
const STORE = "photos";

let dbp: Promise<IDBDatabase> | null = null;
function db(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") return Promise.reject(new Error("This browser can't store photos (IndexedDB unavailable)."));
  dbp ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => { dbp = null; reject(req.error ?? new Error("Couldn't open photo storage")); };
  });
  return dbp;
}

function tx<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  return db().then((d) => new Promise<T | undefined>((resolve, reject) => {
    const t = d.transaction(STORE, mode);
    const r = run(t.objectStore(STORE));
    t.oncomplete = () => resolve(r ? r.result : undefined);
    t.onerror = () => reject(t.error ?? new Error("Photo storage error"));
    t.onabort = () => reject(t.error ?? new Error("Photo storage was interrupted — the browser may be out of space."));
  }));
}

export const putPhoto = (id: string, blob: Blob) => tx("readwrite", (s) => { s.put(blob, id); });
export const getPhoto = (id: string) => tx<Blob>("readonly", (s) => s.get(id)) as Promise<Blob | undefined>;
export const allPhotoKeys = () => tx<IDBValidKey[]>("readonly", (s) => s.getAllKeys()).then((k) => (k ?? []).map(String));
export const deletePhotos = (ids: string[]) => (ids.length ? tx("readwrite", (s) => { ids.forEach((id) => s.delete(id)); }) : Promise.resolve(undefined));

// ---- object-URL cache, reference-counted so URLs are revoked when nothing shows them ----
const cache = new Map<string, { url: Promise<string | null>; refs: number }>();

function acquire(id: string) {
  let e = cache.get(id);
  if (!e) {
    e = { refs: 0, url: getPhoto(id).then((b) => (b ? URL.createObjectURL(b) : null)).catch(() => null) };
    cache.set(id, e);
  }
  e.refs++;
  return e.url;
}
function release(id: string) {
  const e = cache.get(id);
  if (!e) return;
  e.refs--;
  if (e.refs <= 0) {
    cache.delete(id);
    // revoke a little later so a quick re-render can't catch a dead URL
    setTimeout(() => { if (!cache.has(id)) e.url.then((u) => u && URL.revokeObjectURL(u)); }, 4000);
  }
}

/** Resolves a PhotoRef to something an <img> can show. `status: "missing"` → render the fallback. */
export function usePhotoSrc(p: PhotoRef | undefined) {
  const [state, setState] = useState<{ src: string | null; status: "loading" | "ready" | "missing" }>(() =>
    !p ? { src: null, status: "missing" } : p.kind === "remote" ? { src: p.url, status: "ready" } : { src: null, status: "loading" },
  );
  const key = p ? `${p.kind}:${p.id}` : "";
  useEffect(() => {
    if (!p) { setState({ src: null, status: "missing" }); return; }
    if (p.kind === "remote") { setState({ src: p.url, status: "ready" }); return; }
    let live = true;
    setState({ src: null, status: "loading" });
    acquire(p.id).then((url) => { if (live) setState(url ? { src: url, status: "ready" } : { src: null, status: "missing" }); });
    return () => { live = false; release(p.id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return state;
}

/** Saves the photo to the user's device. Uses the stored Blob for local photos. */
export async function downloadPhoto(p: PhotoRef, baseName: string) {
  const safe = baseName.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-").toLowerCase() || "tastory-photo";
  let blob: Blob | undefined;
  if (p.kind === "local") blob = await getPhoto(p.id);
  else {
    try { const r = await fetch(p.url, { mode: "cors" }); if (r.ok) blob = await r.blob(); } catch { /* fall through */ }
    if (!blob) { window.open(p.url, "_blank", "noopener"); return "opened" as const; }
  }
  if (!blob) throw new Error("This photo is no longer stored in this browser.");
  const ext = (blob.type.split("/")[1] || "jpg").replace("jpeg", "jpg").replace(/\+.*$/, "");
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${safe}.${ext}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return "saved" as const;
}
