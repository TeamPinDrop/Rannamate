import { Inject, Injectable } from '@nestjs/common';
import { Errors } from '../../common/errors';
import { Paginated } from '../../common/utils/pagination';
import { REPO, type IngredientsRepository, type RecipesRepository } from '../../database/repositories';
import { CUISINES, DIETS, DIFFICULTIES, MOODS, type Recipe } from '../../domain/types';
import type { RecipeQueryDto } from './recipes.dto';

export const summary = (r: Recipe) => ({
  id: r.id, name: r.name, tagline: r.tagline, emoji: r.emoji, palette: r.palette, cuisine: r.cuisine, moods: r.moods,
  diets: r.diets, allergens: r.allergens, difficulty: r.difficulty, prepMin: r.prepMin, cookMin: r.cookMin,
  totalMin: r.prepMin + r.cookMin, servings: r.servings,
});

@Injectable()
export class RecipesService {
  constructor(@Inject(REPO.recipes) private readonly recipes: RecipesRepository, @Inject(REPO.ingredients) private readonly ingredients: IngredientsRepository) {}

  async list(q: RecipeQueryDto) {
    const { items, total } = await this.recipes.search(q);
    return new Paginated(items.map(summary), total, q.page, q.pageSize);
  }

  async get(id: string) {
    const r = await this.recipes.findById(id);
    if (!r) throw Errors.notFound('Recipe');
    return r;
  }

  /** Full detail: ingredients resolved to name/emoji, steps, swaps, dietary & allergen info. */
  async detail(id: string) {
    const r = await this.get(id);
    return { ...summary(r), equipment: r.equipment, weather: r.weather ?? 'any', ingredients: await this.ingredientsOf(r), steps: this.steps(r), substitutions: r.substitutions, nutrition: null };
  }

  async ingredientsOf(r: Recipe) {
    const ing = new Map((await this.ingredients.findByIds(r.ingredients.map((i) => i.ingredientId))).map((i) => [i.id, i]));
    return r.ingredients.map((i) => ({ ...i, name: ing.get(i.ingredientId)?.name ?? i.ingredientId, emoji: ing.get(i.ingredientId)?.emoji ?? '🥄', staple: !!ing.get(i.ingredientId)?.staple }));
  }

  steps(r: Recipe) { return r.steps.map((s, index) => ({ index, text: s.text, timerSeconds: s.timer ?? null, tip: s.tip ?? null })); }

  /** Facets for the Discover page. Counts come from the actual catalogue. */
  async discovery() {
    const { items } = await this.recipes.search({ page: 1, pageSize: 10_000 });
    const count = <T extends string>(vals: readonly T[], pick: (r: Recipe) => T[]) => vals.map((v) => ({ id: v, count: items.filter((r) => pick(r).includes(v)).length }));
    return {
      totalRecipes: items.length,
      cuisines: count(CUISINES, (r) => [r.cuisine]),
      moods: count(MOODS, (r) => r.moods),
      diets: count(DIETS, (r) => r.diets),
      difficulties: count(DIFFICULTIES, (r) => [r.difficulty]),
      ingredientCategories: await this.ingredients.categories(),
    };
  }
}
