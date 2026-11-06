import catalog from '../../database/memory/fixtures/catalog.json';
import { DEFAULT_RECO_WEIGHTS } from '../../config/configuration';
import type { Ingredient, Recipe } from '../../domain/types';
import { cravingTerms, score, type RecoInput } from './engine';

const recipes = catalog.recipes as unknown as Recipe[];
const ing = new Map((catalog.ingredients as unknown as Ingredient[]).map((i) => [i.id, i]));
const base: RecoInput = { have: [], moods: [], cuisines: [], difficulty: [], equipment: [], allergies: [], diets: [], favourites: [], history: [] };
const run = (p: Partial<RecoInput>) => score(recipes, ing, { ...base, ...p }, DEFAULT_RECO_WEIGHTS);

describe('recommendation engine', () => {
  it('never returns a recipe containing an allergen', () => {
    const { results, excluded } = run({ allergies: ['egg', 'dairy'] });
    expect(results.some((r) => r.recipe.allergens.includes('egg') || r.recipe.allergens.includes('dairy'))).toBe(false);
    expect(excluded.find((e) => e.id === 'masala-omelette')?.reason).toBe('contains egg (allergy)');
  });

  it('treats diets as hard restrictions', () => {
    const { results } = run({ diets: ['vegan'] });
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((r) => r.recipe.diets.includes('vegan'))).toBe(true);
  });

  it('excludes recipes that need equipment the user lacks', () => {
    const { results } = run({ equipment: ['microwave'] });
    expect(results.every((r) => r.recipe.equipment.some((g) => g.every((e) => e === 'microwave')))).toBe(true);
  });

  it('ranks the recipe you can fully make first and explains why', () => {
    const omelette = recipes.find((r) => r.id === 'masala-omelette')!;
    const have = omelette.ingredients.filter((i) => !i.optional).map((i) => i.ingredientId);
    const top = run({ have }).results[0];
    expect(top.recipe.id).toBe('masala-omelette');
    expect(top.ingredientMatch).toBe(1);
    expect(top.reasons).toContain('You have every essential ingredient');
  });

  it('only uses signals the user gave (renormalised weights, score in 0..1)', () => {
    const { results } = run({ moods: ['quick'] });
    for (const r of results) {
      expect(Object.keys(r.components)).toEqual(['M']);
      expect(r.score).toBe(r.recipe.moods.includes('quick') ? 1 : 0);
    }
  });

  it('uses the free-text craving', () => {
    expect(cravingTerms('I really want something with paneer')).toEqual(['paneer']);
    const top = run({ craving: 'paneer' }).results[0];
    expect(top.recipe.id).toBe('paneer-bhurji');
    expect(top.reasons.join(' ')).toMatch(/craving for paneer/);
  });

  it('gives partial time credit and flags filter misses', () => {
    const r = run({ maxTime: 10 }).results.find((x) => x.recipe.prepMin + x.recipe.cookMin > 10)!;
    expect(r.components.T).toBeLessThan(1);
    expect(r.matchesAllFilters).toBe(false);
  });

  it('favourites outrank merely-cooked recipes in history', () => {
    const { results } = run({ favourites: ['poha'], history: ['dal-tadka'] });
    expect(results[0].recipe.id).toBe('poha');
    expect(results.find((r) => r.recipe.id === 'dal-tadka')!.components.H).toBe(0.6);
  });
});
