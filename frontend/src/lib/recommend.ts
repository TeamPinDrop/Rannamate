import { ingredient } from "./data/ingredients";
import { RECIPES, totalTime } from "./data/recipes";
import type { Allergen, Diet, Filters, PantryItem, Recipe } from "./types";

/**
 * Rule-based recommender (Phase 4 baseline, mirrored later in the AI service).
 *
 *   R = 0.35·I + 0.15·M + 0.15·C + 0.10·W + 0.10·T + 0.10·P + 0.05·H
 *
 * A component only participates when we actually have a signal for it
 * (e.g. no mood selected → M is excluded, no weather data → W is excluded).
 * The remaining weights are renormalised so scores stay in 0..1 and nothing
 * is invented. Allergies and explicit dietary restrictions are applied as
 * HARD exclusions before ranking. Equipment is also a hard requirement when
 * the user has told us what they own.
 */
export const WEIGHTS = { I: 0.35, M: 0.15, C: 0.15, W: 0.1, T: 0.1, P: 0.1, H: 0.05 } as const;
type Component = keyof typeof WEIGHTS;

export interface ScoreContext {
  pantry: PantryItem[];
  filters: Filters;
  allergies: Allergen[];
  profileDiets: Diet[];
  favourites: string[];
  history: { recipeId: string }[];
  weather?: "hot" | "cold" | null;
}

export interface Recommendation {
  recipe: Recipe;
  score: number; // 0..1
  /** share of required (non-optional, non-staple) ingredients the user has */
  ingredientMatch: number; // 0..1
  available: string[];
  missing: string[];
  missingOptional: string[];
  substitutions: { ingredientId: string; options: string[] }[];
  components: Partial<Record<Component, number>>;
  reasons: string[];
  matchesAllFilters: boolean;
}

export interface Exclusion {
  recipe: Recipe;
  reason: string;
}

const required = (r: Recipe) => r.ingredients.filter((i) => !i.optional && !ingredient(i.ingredientId).staple);

export function recommend(ctx: ScoreContext): { results: Recommendation[]; excluded: Exclusion[] } {
  const have = new Set(ctx.pantry.map((p) => p.ingredientId));
  const diets = Array.from(new Set([...ctx.filters.diets, ...ctx.profileDiets]));
  const results: Recommendation[] = [];
  const excluded: Exclusion[] = [];

  for (const recipe of RECIPES) {
    // ---- hard exclusions ----
    const allergen = recipe.allergens.find((a) => ctx.allergies.includes(a));
    if (allergen) { excluded.push({ recipe, reason: `contains ${allergen} (allergy)` }); continue; }
    const diet = diets.find((d) => !recipe.diets.includes(d));
    if (diet) { excluded.push({ recipe, reason: `not ${diet}` }); continue; }
    if (ctx.filters.equipment.length) {
      const ok = recipe.equipment.some((group) => group.every((e) => ctx.filters.equipment.includes(e)));
      if (!ok) { excluded.push({ recipe, reason: "needs equipment you don't have" }); continue; }
    }

    // ---- components ----
    const req = required(recipe);
    const available = req.filter((i) => have.has(i.ingredientId)).map((i) => i.ingredientId);
    const missing = req.filter((i) => !have.has(i.ingredientId)).map((i) => i.ingredientId);
    const missingOptional = recipe.ingredients
      .filter((i) => i.optional && !have.has(i.ingredientId))
      .map((i) => i.ingredientId);
    const ingredientMatch = req.length ? available.length / req.length : 1;

    const c: Partial<Record<Component, number>> = {};
    const reasons: string[] = [];
    let allFilters = true;

    if (ctx.pantry.length) {
      c.I = ingredientMatch;
      if (ingredientMatch === 1) reasons.push("You have every essential ingredient");
      else if (ingredientMatch >= 0.6) reasons.push(`You have ${available.length} of ${req.length} essentials`);
    }

    const moods = ctx.filters.moods.filter((m) => m !== "surprise");
    if (ctx.filters.moods.includes("surprise") && !moods.length) {
      c.M = 1;
    } else if (moods.length) {
      const hit = moods.filter((m) => recipe.moods.includes(m));
      c.M = hit.length ? 1 : 0;
      if (hit.length) reasons.push(`Fits your ${hit.join(" & ")} mood`);
      else allFilters = false;
    }

    if (ctx.filters.cuisines.length) {
      c.C = ctx.filters.cuisines.includes(recipe.cuisine) ? 1 : 0;
      if (c.C) reasons.push(`${recipe.cuisine} — as you asked`);
      else allFilters = false;
    }

    if (ctx.weather && recipe.weather && recipe.weather !== "any") {
      c.W = (ctx.weather === "cold" && recipe.weather === "warm") || (ctx.weather === "hot" && recipe.weather === "cool") ? 1 : 0;
    }

    if (ctx.filters.maxTime) {
      const t = totalTime(recipe);
      c.T = t <= ctx.filters.maxTime ? 1 : Math.max(0, 1 - (t - ctx.filters.maxTime) / ctx.filters.maxTime);
      if (t <= ctx.filters.maxTime) reasons.push(`Ready in ${t} min`);
      else allFilters = false;
    }

    if (ctx.filters.difficulty.length) {
      c.P = ctx.filters.difficulty.includes(recipe.difficulty) ? 1 : 0;
      if (!c.P) allFilters = false;
    }

    if (ctx.favourites.length || ctx.history.length) {
      const cooked = ctx.history.some((h) => h.recipeId === recipe.id);
      const fav = ctx.favourites.includes(recipe.id);
      c.H = fav ? 1 : cooked ? 0.6 : 0;
      if (fav) reasons.push("One of your favourites");
    }

    const keys = Object.keys(c) as Component[];
    const wSum = keys.reduce((a, k) => a + WEIGHTS[k], 0);
    const score = wSum ? keys.reduce((a, k) => a + WEIGHTS[k] * (c[k] ?? 0), 0) / wSum : 0;

    const missingSet = new Set([...missing, ...missingOptional]);
    const substitutions = recipe.substitutions.filter((s) => missingSet.has(s.ingredientId));

    results.push({
      recipe, score, ingredientMatch, available, missing, missingOptional, substitutions,
      components: c, reasons, matchesAllFilters: allFilters,
    });
  }

  results.sort((a, b) => b.score - a.score || b.ingredientMatch - a.ingredientMatch || totalTime(a.recipe) - totalTime(b.recipe));
  return { results, excluded };
}

export function matchFor(recipe: Recipe, pantry: PantryItem[]) {
  const have = new Set(pantry.map((p) => p.ingredientId));
  const req = required(recipe);
  const available = req.filter((i) => have.has(i.ingredientId)).length;
  return { pct: req.length ? Math.round((available / req.length) * 100) : 100, available, total: req.length };
}
