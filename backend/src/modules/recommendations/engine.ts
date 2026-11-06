/**
 * Hybrid recommender — transparent rule-based core (mirrors frontend/src/lib/recommend.ts).
 *
 *   R = wI·I + wM·M + wC·C + wW·W + wT·T + wP·P + wH·H     (default 0.35/0.15/0.15/0.10/0.10/0.10/0.05)
 *
 *   I  ingredient availability   share of essential (non-optional, non-staple) ingredients you have
 *   M  mood                      recipe fits a selected mood
 *   C  craving / cuisine         recipe matches the asked-for cuisine or the words of a free-text craving
 *   W  weather / context         warm dishes when it's cold, cool ones when it's hot
 *   T  cooking time              within the time limit (partial credit when a little over)
 *   P  preferences               difficulty preference
 *   H  history                   favourites (1.0) and recently cooked (0.6)
 *
 * A component only counts when the user actually gave that signal; the remaining weights are
 * renormalised, so nothing is invented. Allergies, diets and missing equipment are HARD exclusions —
 * an excluded recipe is never returned, whatever its score.
 */
import type { Allergen, Diet, Equipment, Ingredient, Recipe } from '../../domain/types';

export type Weights = Record<'I' | 'M' | 'C' | 'W' | 'T' | 'P' | 'H', number>;
type C = keyof Weights;

export interface RecoInput {
  have: string[];
  moods: string[];
  cuisines: string[];
  craving?: string;
  maxTime?: number | null;
  difficulty: string[];
  equipment: Equipment[];
  allergies: Allergen[];
  diets: Diet[];
  weather?: 'hot' | 'cold' | null;
  favourites: string[];
  history: string[];
}

export interface Scored {
  recipe: Recipe; score: number; ingredientMatch: number;
  available: string[]; missing: string[]; missingOptional: string[];
  substitutions: { ingredientId: string; options: string[] }[];
  components: Partial<Record<C, number>>; reasons: string[]; matchesAllFilters: boolean;
}

const STOP = new Set(['something', 'some', 'want', 'with', 'and', 'the', 'a', 'an', 'for', 'like', 'feel', 'craving', 'food', 'dish', 'i', 'me', 'my', 'to', 'of', 'in', 'really', 'very']);
export const cravingTerms = (s?: string) => (s ?? '').toLowerCase().replace(/[^a-z\s-]/g, ' ').split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w)).slice(0, 8);

export function excludeReason(r: Recipe, i: RecoInput): string | null {
  const allergen = r.allergens.find((a) => i.allergies.includes(a));
  if (allergen) return `contains ${allergen} (allergy)`;
  const diet = i.diets.find((d) => !r.diets.includes(d));
  if (diet) return `not ${diet}`;
  if (i.equipment.length && !r.equipment.some((g) => g.every((e) => i.equipment.includes(e)))) return "needs equipment you don't have";
  return null;
}

export function score(recipes: Recipe[], ingredients: Map<string, Ingredient>, i: RecoInput, W: Weights) {
  const have = new Set(i.have);
  const terms = cravingTerms(i.craving);
  const results: Scored[] = [];
  const excluded: { id: string; name: string; reason: string }[] = [];

  for (const r of recipes) {
    const why = excludeReason(r, i);
    if (why) { excluded.push({ id: r.id, name: r.name, reason: why }); continue; }

    const req = r.ingredients.filter((x) => !x.optional && !ingredients.get(x.ingredientId)?.staple);
    const available = req.filter((x) => have.has(x.ingredientId)).map((x) => x.ingredientId);
    const missing = req.filter((x) => !have.has(x.ingredientId)).map((x) => x.ingredientId);
    const missingOptional = r.ingredients.filter((x) => x.optional && !have.has(x.ingredientId)).map((x) => x.ingredientId);
    const ingredientMatch = req.length ? available.length / req.length : 1;
    const c: Partial<Record<C, number>> = {};
    const reasons: string[] = [];
    let all = true;

    if (i.have.length) {
      c.I = ingredientMatch;
      if (ingredientMatch === 1) reasons.push('You have every essential ingredient');
      else if (ingredientMatch >= 0.6) reasons.push(`You have ${available.length} of ${req.length} essentials`);
    }

    const moods = i.moods.filter((m) => m !== 'surprise');
    if (i.moods.includes('surprise') && !moods.length) c.M = 1;
    else if (moods.length) {
      const hit = moods.filter((m) => (r.moods as string[]).includes(m));
      c.M = hit.length ? 1 : 0;
      if (hit.length) reasons.push(`Fits your ${hit.join(' & ')} mood`); else all = false;
    }

    if (i.cuisines.length || terms.length) {
      const cuisineHit = i.cuisines.includes(r.cuisine);
      const hay = [r.name, r.tagline, r.cuisine, ...r.moods, ...r.ingredients.map((x) => ingredients.get(x.ingredientId)?.name ?? '')].join(' ').toLowerCase();
      const termHits = terms.filter((t) => hay.includes(t) || hay.includes(t.replace(/s$/, '')));
      const cravingScore = terms.length ? termHits.length / terms.length : 0;
      c.C = Math.max(cuisineHit ? 1 : 0, cravingScore);
      if (cuisineHit) reasons.push(`${r.cuisine} — as you asked`);
      if (termHits.length) reasons.push(`Matches your craving for ${termHits.join(', ')}`);
      if (i.cuisines.length && !cuisineHit) all = false;
    }

    if (i.weather && r.weather && r.weather !== 'any') {
      c.W = (i.weather === 'cold' && r.weather === 'warm') || (i.weather === 'hot' && r.weather === 'cool') ? 1 : 0;
      if (c.W) reasons.push(i.weather === 'cold' ? 'Warming for a cold day' : 'Cooling for a hot day');
    }

    if (i.maxTime) {
      const t = r.prepMin + r.cookMin;
      c.T = t <= i.maxTime ? 1 : Math.max(0, 1 - (t - i.maxTime) / i.maxTime);
      if (t <= i.maxTime) reasons.push(`Ready in ${t} min`); else all = false;
    }

    if (i.difficulty.length) {
      c.P = i.difficulty.includes(r.difficulty) ? 1 : 0;
      if (!c.P) all = false;
    }

    if (i.favourites.length || i.history.length) {
      const fav = i.favourites.includes(r.id);
      const cooked = i.history.includes(r.id);
      c.H = fav ? 1 : cooked ? 0.6 : 0;
      if (fav) reasons.push('One of your favourites'); else if (cooked) reasons.push('You cooked this recently');
    }

    const keys = Object.keys(c) as C[];
    const wSum = keys.reduce((a, k) => a + W[k], 0);
    const s = wSum ? keys.reduce((a, k) => a + W[k] * (c[k] ?? 0), 0) / wSum : 0;
    const missingSet = new Set([...missing, ...missingOptional]);
    results.push({
      recipe: r, score: Math.round(s * 1000) / 1000, ingredientMatch, available, missing, missingOptional,
      substitutions: r.substitutions.filter((x) => missingSet.has(x.ingredientId)), components: c, reasons, matchesAllFilters: all,
    });
  }

  results.sort((a, b) => b.score - a.score || b.ingredientMatch - a.ingredientMatch || a.recipe.prepMin + a.recipe.cookMin - (b.recipe.prepMin + b.recipe.cookMin));
  return { results, excluded };
}
