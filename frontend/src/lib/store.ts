"use client";
import { useSyncExternalStore } from "react";
import type { Filters, PantryItem, Profile } from "./types";
import { loadAiRecipes } from "./aiRecipes";

export interface AppState {
  pantry: PantryItem[];
  filters: Filters;
  profile: Profile;
  favourites: string[];
  history: { recipeId: string; at: number }[];
}

const KEY = "rannamate:v1";

export const DEFAULT_FILTERS: Filters = { moods: [], cuisines: [], maxTime: null, diets: [], difficulty: [], equipment: [] };

const DEFAULT_STATE: AppState = {
  pantry: [],
  filters: DEFAULT_FILTERS,
  profile: { name: "", allergies: [], diets: [] },
  favourites: [],
  history: [],
};

let state: AppState = DEFAULT_STATE;
let hydrated = false;
const listeners = new Set<() => void>();

function hydrate() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  loadAiRecipes();
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      const { plan: _oldPlan, ...saved } = JSON.parse(raw); // the retired Meal Planner's data is no longer kept
      void _oldPlan;
      state = { ...DEFAULT_STATE, ...saved };
    }
  } catch {
    /* storage unavailable — keep in-memory defaults */
  }
}

function persist() {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

export function setState(updater: (s: AppState) => AppState) {
  hydrate();
  state = updater(state);
  persist();
  listeners.forEach((l) => l());
}

export function getState() {
  hydrate();
  return state;
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}
/** for non-React code (e.g. syncing the signed-in profile to the server) */
export const subscribeStore = (l: () => void) => { const off = subscribe(l); return () => { off(); }; };

/** Server renders with defaults; the client hydrates from localStorage after mount. */
export function useStore<T>(selector: (s: AppState) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => selector(getState()),
    () => selector(DEFAULT_STATE),
  );
}

// ---- actions ----
export const actions = {
  addPantry(item: PantryItem) {
    setState((s) => {
      const exists = s.pantry.find((p) => p.ingredientId === item.ingredientId);
      const pantry = exists
        ? s.pantry.map((p) => (p.ingredientId === item.ingredientId ? { ...p, quantity: item.quantity, unit: item.unit } : p))
        : [...s.pantry, item];
      return { ...s, pantry };
    });
  },
  removePantry(id: string) {
    setState((s) => ({ ...s, pantry: s.pantry.filter((p) => p.ingredientId !== id) }));
  },
  togglePantry(id: string, unit: PantryItem["unit"], quantity = 1) {
    setState((s) => ({
      ...s,
      pantry: s.pantry.some((p) => p.ingredientId === id)
        ? s.pantry.filter((p) => p.ingredientId !== id)
        : [...s.pantry, { ingredientId: id, quantity, unit }],
    }));
  },
  clearPantry() {
    setState((s) => ({ ...s, pantry: [] }));
  },
  setFilters(patch: Partial<Filters>) {
    setState((s) => ({ ...s, filters: { ...s.filters, ...patch } }));
  },
  resetFilters() {
    setState((s) => ({ ...s, filters: DEFAULT_FILTERS }));
  },
  setProfile(patch: Partial<Profile>) {
    setState((s) => ({ ...s, profile: { ...s.profile, ...patch } }));
  },
  toggleFavourite(id: string) {
    setState((s) => ({
      ...s,
      favourites: s.favourites.includes(id) ? s.favourites.filter((f) => f !== id) : [...s.favourites, id],
    }));
  },
  logCooked(recipeId: string) {
    setState((s) => ({ ...s, history: [{ recipeId, at: Date.now() }, ...s.history].slice(0, 50) }));
  },
};
