"use client";
/**
 * Cook & Chill persistence (this browser, like the rest of RANNAMATE until Phase 3).
 * The shape mirrors the planned tables so it can move to the backend unchanged:
 *   sessions      → entertainment_sessions + entertainment_activity_history
 *   stats         → user_fun_scores
 *   achievements  → user_achievements
 *   recent        → per-activity "recently shown" ids, to avoid repeats
 * Only ids/metadata are stored — never every AI-generated message.
 */
import { useSyncExternalStore } from "react";
import { ACHIEVEMENTS, EMPTY_STATS, POINTS, type ChillStats } from "./engine";
import type { ActivityId, Level } from "./types";

export interface ActivityLog { activity: ActivityId; startedAt: number; endedAt?: number; rounds: number; points: number; source: "ai" | "library" | "mixed" }
export interface ChillSessionRec { id: string; recipeId: string; startedAt: number; endedAt?: number; endReason?: "timer" | "safety" | "user" | "left"; activities: ActivityLog[] }

export interface ChillState {
  stats: ChillStats;
  achievements: { id: string; at: number }[];
  recent: Partial<Record<ActivityId, string[]>>;
  sessions: ChillSessionRec[];
  prefs: { showPoints: boolean };
}

const KEY = "rannamate:chill:v1";
const DEFAULT: ChillState = { stats: EMPTY_STATS, achievements: [], recent: {}, sessions: [], prefs: { showPoints: true } };

let state: ChillState = DEFAULT;
let hydrated = false;
const listeners = new Set<() => void>();

function hydrate() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<ChillState>;
      state = { ...DEFAULT, ...p, stats: { ...EMPTY_STATS, ...p.stats }, prefs: { ...DEFAULT.prefs, ...p.prefs } };
    }
  } catch { /* storage unavailable — keep in memory */ }
}
function set(fn: (s: ChillState) => ChillState) {
  hydrate();
  state = fn(state);
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* ignore */ }
  listeners.forEach((l) => l());
}
export function getChill() { hydrate(); return state; }
export function useChill<T>(sel: (s: ChillState) => T): T {
  return useSyncExternalStore(
    (l) => { listeners.add(l); return () => listeners.delete(l); },
    () => sel(getChill()),
    () => sel(DEFAULT),
  );
}

export type ChillEvent =
  | { type: "trivia"; correct: boolean; level: Level }
  | { type: "guess"; solved: boolean; hints: number }
  | { type: "riddle"; solved: boolean; hints: number }
  | { type: "song" }
  | { type: "story" }
  | { type: "round" };

let streak = 0;

/** Applies an event; returns points earned and any newly unlocked achievements. */
export function record(sessionId: string | null, activity: ActivityId, ev: ChillEvent): { points: number; unlocked: typeof ACHIEVEMENTS } {
  let pts = 0;
  const before = getChill().stats;
  const st: ChillStats = { ...before, activitiesTried: before.activitiesTried.includes(activity) ? before.activitiesTried : [...before.activitiesTried, activity] };
  switch (ev.type) {
    case "trivia":
      if (ev.correct) { pts = POINTS.triviaCorrect[ev.level]; st.triviaCorrect++; streak++; st.triviaBestStreak = Math.max(st.triviaBestStreak, streak); } else streak = 0;
      break;
    case "guess":
      if (ev.solved) { pts = Math.max(5, POINTS.guessSolved - ev.hints * POINTS.hintCost); st.ingredientsGuessed++; }
      break;
    case "riddle":
      if (ev.solved) { pts = Math.max(5, POINTS.riddleSolved - ev.hints * POINTS.hintCost); st.riddlesSolved++; }
      break;
    case "song": st.songs++; pts = POINTS.participation; break;
    case "story": st.stories++; pts = POINTS.participation; break;
    case "round": pts = POINTS.participation; break;
  }
  st.rounds++;
  st.points += pts;
  const had = new Set(getChill().achievements.map((a) => a.id));
  const unlocked = ACHIEVEMENTS.filter((a) => !had.has(a.id) && a.test(st));
  set((s) => ({
    ...s,
    stats: st,
    achievements: [...s.achievements, ...unlocked.map((a) => ({ id: a.id, at: Date.now() }))],
    sessions: s.sessions.map((x) => {
      if (x.id !== sessionId) return x;
      const acts = [...x.activities];
      const last = acts[acts.length - 1];
      if (last && last.activity === activity && !last.endedAt) acts[acts.length - 1] = { ...last, rounds: last.rounds + 1, points: last.points + pts };
      return { ...x, activities: acts };
    }),
  }));
  return { points: pts, unlocked };
}

export function remember(activity: ActivityId, id: string) {
  set((s) => ({ ...s, recent: { ...s.recent, [activity]: [id, ...(s.recent[activity] ?? []).filter((x) => x !== id)].slice(0, 30) } }));
}
export const recentFor = (activity: ActivityId) => getChill().recent[activity] ?? [];

export function startSession(recipeId: string) {
  const id = `cs-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  set((s) => ({ ...s, sessions: [{ id, recipeId, startedAt: Date.now(), activities: [] }, ...s.sessions].slice(0, 40) }));
  return id;
}
export function startActivity(sessionId: string, activity: ActivityId) {
  set((s) => ({
    ...s,
    sessions: s.sessions.map((x) => {
      if (x.id !== sessionId) return x;
      const acts = x.activities.map((a) => (a.endedAt ? a : { ...a, endedAt: Date.now() }));
      return { ...x, activities: [...acts, { activity, startedAt: Date.now(), rounds: 0, points: 0, source: "library" as const }] };
    }),
  }));
}
export function markSource(sessionId: string, src: "ai" | "library") {
  set((s) => ({
    ...s,
    sessions: s.sessions.map((x) => {
      if (x.id !== sessionId || !x.activities.length) return x;
      const acts = [...x.activities];
      const l = acts[acts.length - 1];
      acts[acts.length - 1] = { ...l, source: l.rounds === 0 ? src : l.source === src ? src : "mixed" };
      return { ...x, activities: acts };
    }),
  }));
}
export function endSession(sessionId: string, reason: ChillSessionRec["endReason"]) {
  set((s) => ({
    ...s,
    sessions: s.sessions.map((x) => (x.id !== sessionId || x.endedAt ? x : { ...x, endedAt: Date.now(), endReason: reason, activities: x.activities.map((a) => (a.endedAt ? a : { ...a, endedAt: Date.now() })) })),
  }));
}
export function setShowPoints(v: boolean) { set((s) => ({ ...s, prefs: { ...s.prefs, showPoints: v } })); }
