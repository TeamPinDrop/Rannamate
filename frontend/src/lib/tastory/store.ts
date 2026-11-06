"use client";
/**
 * Tastory metadata store — localStorage in this browser (photos themselves live in IndexedDB,
 * see photos.ts). It is NOT synced to an account or the cloud.
 */
import { useSyncExternalStore } from "react";
import { allPhotoKeys, deletePhotos } from "./photos";
import { SAMPLE_MEMORIES } from "./samples";
import type { FilterMode, Memory, SortMode } from "./types";

const KEY = "rannamate:tastory:v1";
interface State { memories: Memory[]; seeded: boolean }
const EMPTY: State = { memories: [], seeded: false };

let state: State = EMPTY;
let hydrated = false;
const listeners = new Set<() => void>();

function hydrate() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<State>;
      state = { memories: Array.isArray(p.memories) ? p.memories : [], seeded: !!p.seeded };
    }
  } catch { /* storage unavailable — keep in memory */ }
  // first visit: show the clearly-labelled sample journal
  if (!state.seeded) { state = { memories: SAMPLE_MEMORIES, seeded: true }; persist(); }
}
function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* quota/private mode — keep in memory */ }
}
function set(fn: (s: State) => State) {
  hydrate();
  state = fn(state);
  persist();
  listeners.forEach((l) => l());
}

export function useMemories(): { memories: Memory[]; ready: boolean } {
  const memories = useSyncExternalStore(
    (l) => { listeners.add(l); return () => listeners.delete(l); },
    () => { hydrate(); return state.memories; },
    () => EMPTY.memories,
  );
  const ready = useSyncExternalStore(() => () => {}, () => true, () => false);
  return { memories, ready };
}
export const getMemory = (id: string) => { hydrate(); return state.memories.find((m) => m.id === id); };

export const newId = (p = "m") => `${p}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export const tastory = {
  add(m: Memory) { set((s) => ({ ...s, memories: [m, ...s.memories] })); },
  update(id: string, patch: Partial<Memory>) {
    set((s) => ({ ...s, memories: s.memories.map((m) => (m.id === id ? { ...m, ...patch, updatedAt: Date.now() } : m)) }));
  },
  toggleFavourite(id: string) {
    set((s) => ({ ...s, memories: s.memories.map((m) => (m.id === id ? { ...m, favourite: !m.favourite } : m)) }));
  },
  /** Removes the memory from the journal; its photos are purged separately (after the undo window). */
  remove(id: string): { memory: Memory; index: number } | null {
    hydrate();
    const index = state.memories.findIndex((m) => m.id === id);
    if (index < 0) return null;
    const memory = state.memories[index];
    set((s) => ({ ...s, memories: s.memories.filter((x) => x.id !== id) }));
    return { memory, index };
  },
  purgePhotos(m: Memory) {
    return deletePhotos(m.photos.filter((p) => p.kind === "local").map((p) => p.id)).catch(() => undefined);
  },
  /** Deletes stored photos that no memory points to (e.g. the tab closed during an undo window). */
  async collectGarbage() {
    hydrate();
    const used = new Set(state.memories.flatMap((m) => m.photos.map((p) => p.id)));
    const keys = await allPhotoKeys().catch(() => [] as string[]);
    await deletePhotos(keys.filter((k) => !used.has(k))).catch(() => undefined);
  },
  /** Restores a memory removed a moment ago (its local photos are only deleted after the undo window). */
  restore(m: Memory, index: number) {
    set((s) => { const list = [...s.memories]; list.splice(Math.min(index, list.length), 0, m); return { ...s, memories: list }; });
  },
  removeSamples() { set((s) => ({ ...s, memories: s.memories.filter((m) => !m.sample) })); },
};

// ---------------------------------------------------------------- queries

export function searchText(m: Memory) {
  return [m.dish, m.caption, m.notes, ...m.tags].join(" ").toLowerCase();
}

const RECENT_DAYS = 30;
export function applyView(list: Memory[], q: string, filter: FilterMode, sort: SortMode) {
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
  const now = Date.now();
  let out = list.filter((m) => terms.every((t) => searchText(m).includes(t)));
  if (filter === "favourites") out = out.filter((m) => m.favourite);
  if (filter === "recent") out = out.filter((m) => now - m.createdAt <= RECENT_DAYS * 86_400_000);
  if (filter === "top") out = out.filter((m) => (m.rating ?? 0) >= 4);
  const byDate = (a: Memory, b: Memory) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt;
  out = [...out].sort(
    sort === "newest" ? (a, b) => byDate(b, a)
      : sort === "oldest" ? byDate
        : sort === "rating" ? (a, b) => (b.rating ?? 0) - (a.rating ?? 0) || byDate(b, a)
          : (a, b) => a.dish.localeCompare(b.dish, undefined, { sensitivity: "base" }),
  );
  return out;
}
export const RECENT_LABEL = `Added in the last ${RECENT_DAYS} days`;

export function stats(list: Memory[]) {
  const latest = list.reduce<string | null>((d, m) => (!d || m.date > d ? m.date : d), null);
  return {
    memories: list.length,
    photos: list.reduce((n, m) => n + m.photos.length, 0),
    favourites: list.filter((m) => m.favourite).length,
    latest,
    samples: list.filter((m) => m.sample).length,
  };
}

export const parseDate = (d: string) => { const [y, m, day] = d.split("-").map(Number); return new Date(y, (m || 1) - 1, day || 1); };
export const fmtDate = (d: string, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }) =>
  parseDate(d).toLocaleDateString("en-IN", opts);
export const todayISO = () => { const t = new Date(); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`; };

export function groupByMonth(list: Memory[]) {
  const groups: { key: string; label: string; items: Memory[] }[] = [];
  for (const m of list) {
    const key = m.date.slice(0, 7);
    let g = groups[groups.length - 1];
    if (!g || g.key !== key) { g = { key, label: fmtDate(m.date, { month: "long", year: "numeric" }), items: [] }; groups.push(g); }
    g.items.push(m);
  }
  return groups;
}
