import { Global, Logger, Module, type Provider } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../config/configuration';
import { REPO } from './repositories';
import * as mem from './memory/memory.repositories';
import { unmapped } from './mysql/mysql.repositories';

type Area = { token: symbol; memory: new () => object; area: string };
const AREAS: Area[] = [
  { token: REPO.users, memory: mem.MemoryUsersRepository, area: 'users & profiles (users, user_profiles)' },
  { token: REPO.authSessions, memory: mem.MemoryAuthSessionsRepository, area: 'sign-in sessions' },
  { token: REPO.passwordResets, memory: mem.MemoryPasswordResetsRepository, area: 'password-reset tokens' },
  { token: REPO.recipes, memory: mem.MemoryRecipesRepository, area: 'recipes (recipes, recipe_ingredients, recipe_steps, recipe_dietary_tags, recipe_allergens)' },
  { token: REPO.ingredients, memory: mem.MemoryIngredientsRepository, area: 'the ingredient catalogue' },
  { token: REPO.inventory, memory: mem.MemoryInventoryRepository, area: 'kitchen inventory (user_inventory)' },
  { token: REPO.favourites, memory: mem.MemoryFavouritesRepository, area: 'favourites' },
  { token: REPO.cookingSessions, memory: mem.MemoryCookingSessionsRepository, area: 'cooking sessions (cooking_sessions, cooking_step_progress)' },
  { token: REPO.memories, memory: mem.MemoryMemoriesRepository, area: 'Tastory memories' },
];

/**
 * Chooses the persistence implementation once, at startup, from DATA_SOURCE.
 * There is no runtime fallback: if MySQL is selected and unavailable, requests fail with 503.
 */
@Global()
@Module({
  providers: AREAS.map<Provider>((a) => ({
    provide: a.token,
    inject: [APP_CONFIG],
    useFactory: (cfg: AppConfig) => (cfg.dataSource === 'memory' ? new a.memory() : unmapped(a.area, cfg)),
  })),
  exports: AREAS.map((a) => a.token),
})
export class DatabaseModule {
  constructor() {
    const ds = process.env.DATA_SOURCE ?? 'mysql';
    if (ds === 'memory' && process.env.NODE_ENV !== 'test') {
      new Logger('Database').warn('DATA_SOURCE=memory — using the TEMPORARY in-memory store. Nothing is saved to MySQL and all data is lost on restart.');
    }
  }
}
