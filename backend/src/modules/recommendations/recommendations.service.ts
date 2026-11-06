import { Inject, Injectable } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../../config/configuration';
import { REPO, type CookingSessionsRepository, type FavouritesRepository, type IngredientsRepository, type InventoryRepository, type RecipesRepository, type UsersRepository } from '../../database/repositories';
import type { Allergen, Diet } from '../../domain/types';
import { summary } from '../recipes/recipes.service';
import type { RecommendDto } from './recommendations.dto';
import { score } from './engine';

@Injectable()
export class RecommendationsService {
  constructor(
    @Inject(REPO.recipes) private readonly recipes: RecipesRepository,
    @Inject(REPO.ingredients) private readonly ingredients: IngredientsRepository,
    @Inject(REPO.inventory) private readonly inventory: InventoryRepository,
    @Inject(REPO.favourites) private readonly favourites: FavouritesRepository,
    @Inject(REPO.cookingSessions) private readonly sessions: CookingSessionsRepository,
    @Inject(REPO.users) private readonly users: UsersRepository,
    @Inject(APP_CONFIG) private readonly cfg: AppConfig,
  ) {}

  async recommend(dto: RecommendDto, userId?: string) {
    // signed-in users: profile restrictions, saved kitchen, favourites and history join in
    const profile = userId ? await this.users.getProfile(userId) : null;
    const allergies = [...new Set<Allergen>([...(dto.allergies ?? []), ...(profile?.allergies ?? [])])];
    const diets = [...new Set<Diet>([...(dto.diets ?? []), ...(profile?.diets ?? [])])];
    const have = dto.ingredientIds ?? (userId ? (await this.inventory.list(userId)).map((x) => x.ingredientId) : []);
    const favourites = userId ? (await this.favourites.list(userId)).map((f) => f.recipeId) : [];
    const history = userId ? await this.sessions.recentlyCompleted(userId, 20) : [];

    const candidates = await this.recipes.candidates({ excludeAllergens: [], requireDiets: [] });
    const ing = new Map((await this.ingredients.all()).map((i) => [i.id, i]));
    const { results, excluded } = score(candidates, ing, {
      have, moods: dto.moods ?? [], cuisines: dto.cuisines ?? [], craving: dto.craving, maxTime: dto.maxTime ?? null,
      difficulty: dto.difficulty ?? [], equipment: dto.equipment ?? [], allergies, diets, weather: dto.weather ?? null, favourites, history,
    }, this.cfg.recoWeights);

    const name = (id: string) => ing.get(id)?.name ?? id;
    return {
      weights: this.cfg.recoWeights,
      appliedRestrictions: { allergies, diets, equipment: dto.equipment ?? [] },
      usedInventory: dto.ingredientIds === undefined && !!userId,
      results: results.slice(0, dto.limit ?? 12).map((r) => ({
        recipe: summary(r.recipe), score: r.score, matchPct: Math.round(r.ingredientMatch * 100), components: r.components,
        reasons: r.reasons, matchesAllFilters: r.matchesAllFilters,
        available: r.available.map((id) => ({ id, name: name(id) })), missing: r.missing.map((id) => ({ id, name: name(id) })),
        missingOptional: r.missingOptional.map((id) => ({ id, name: name(id) })),
        substitutions: r.substitutions.map((s) => ({ ingredientId: s.ingredientId, name: name(s.ingredientId), options: s.options })),
      })),
      excludedCount: excluded.length,
      ...(dto.includeExcluded ? { excluded } : {}),
    };
  }
}
