/**
 * IN-MEMORY REPOSITORIES — DEVELOPMENT AND TESTS ONLY (DATA_SOURCE=memory).
 * Everything here is lost when the process stops. The recipe/ingredient catalog is loaded from
 * fixtures/catalog.json, a copy of the frontend's built-in catalog — not production content.
 * This store is never used as a fallback when MySQL is unavailable.
 */
import { randomUUID } from 'node:crypto';
import type { AuthSession, CookingSession, Favourite, Ingredient, InventoryItem, Memory, PasswordReset, Profile, Recipe, User } from '../../domain/types';
import { Errors } from '../../common/errors';
import type {
  AuthSessionsRepository, CookingSessionsRepository, FavouritesRepository, IngredientsRepository, InventoryRepository,
  MemoriesRepository, PasswordResetsRepository, RecipeQuery, RecipesRepository, UsersRepository,
} from '../repositories';
import catalog from './fixtures/catalog.json';

const now = () => new Date().toISOString();
const clone = <T>(x: T): T => structuredClone(x);
const RECIPES = catalog.recipes as unknown as Recipe[];
const INGREDIENTS = catalog.ingredients as unknown as Ingredient[];
const ING = new Map(INGREDIENTS.map((i) => [i.id, i]));
const total = (r: Recipe) => r.prepMin + r.cookMin;

export class MemoryUsersRepository implements UsersRepository {
  private users = new Map<string, User>();
  private profiles = new Map<string, Profile>();
  async findById(id: string) { return clone(this.users.get(id) ?? null); }
  async findByEmail(email: string) { return clone([...this.users.values()].find((u) => u.email === email) ?? null); }
  async findByGoogleSub(sub: string) { return clone([...this.users.values()].find((u) => u.googleSub === sub) ?? null); }
  async create(i: { email: string; passwordHash: string | null; displayName: string; googleSub?: string | null }) {
    if ([...this.users.values()].some((u) => u.email === i.email)) throw Errors.conflict('EMAIL_TAKEN', 'An account with this email already exists.');
    const u: User = { id: randomUUID(), email: i.email, passwordHash: i.passwordHash, googleSub: i.googleSub ?? null, createdAt: now(), updatedAt: now() };
    this.users.set(u.id, u);
    this.profiles.set(u.id, { userId: u.id, displayName: i.displayName, allergies: [], diets: [], preferredLanguage: 'en', matePersona: 'masala', updatedAt: now() });
    return clone(u);
  }
  async setPasswordHash(userId: string, passwordHash: string) { const u = this.users.get(userId); if (u) { u.passwordHash = passwordHash; u.updatedAt = now(); } }
  async linkGoogle(userId: string, googleSub: string) { const u = this.users.get(userId); if (u) { u.googleSub = googleSub; u.updatedAt = now(); } }
  async getProfile(userId: string) { return clone(this.profiles.get(userId) ?? null); }
  async updateProfile(userId: string, patch: Partial<Profile>) {
    const p = { ...this.profiles.get(userId)!, ...patch, userId, updatedAt: now() };
    this.profiles.set(userId, p);
    return clone(p);
  }
}

export class MemoryAuthSessionsRepository implements AuthSessionsRepository {
  private rows = new Map<string, AuthSession>();
  async create(s: Omit<AuthSession, 'createdAt' | 'revokedAt'>) { const r = { ...s, revokedAt: null, createdAt: now() }; this.rows.set(s.id, r); return clone(r); }
  async findById(id: string) { return clone(this.rows.get(id) ?? null); }
  async revoke(id: string, replacedBy: string | null = null) { const r = this.rows.get(id); if (r && !r.revokedAt) { r.revokedAt = now(); r.replacedBy = replacedBy; } }
  async revokeAllForUser(userId: string) { for (const r of this.rows.values()) if (r.userId === userId && !r.revokedAt) r.revokedAt = now(); }
}

export class MemoryPasswordResetsRepository implements PasswordResetsRepository {
  private rows = new Map<string, PasswordReset>();
  async create(r: Omit<PasswordReset, 'createdAt' | 'usedAt'>) { const row = { ...r, usedAt: null, createdAt: now() }; this.rows.set(r.id, row); return clone(row); }
  async findByTokenHash(h: string) { return clone([...this.rows.values()].find((r) => r.tokenHash === h) ?? null); }
  async consume(id: string) { const r = this.rows.get(id); if (!r || r.usedAt) return false; r.usedAt = now(); return true; }
  async invalidateAllForUser(userId: string) { for (const r of this.rows.values()) if (r.userId === userId && !r.usedAt) r.usedAt = now(); }
  async latestForUser(userId: string) { return clone([...this.rows.values()].filter((r) => r.userId === userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null); }
}

export class MemoryRecipesRepository implements RecipesRepository {
  async search(q: RecipeQuery) {
    const terms = (q.q ?? '').toLowerCase().split(/\s+/).filter(Boolean);
    const hay = (r: Recipe) => [r.name, r.tagline, r.cuisine, ...r.moods, ...r.ingredients.map((i) => ING.get(i.ingredientId)?.name ?? '')].join(' ').toLowerCase();
    const items = RECIPES.filter((r) =>
      terms.every((t) => hay(r).includes(t)) &&
      (!q.cuisine || r.cuisine === q.cuisine) &&
      (!q.maxTime || total(r) <= q.maxTime) &&
      (!q.difficulty || r.difficulty === q.difficulty) &&
      (!q.diet || r.diets.includes(q.diet as never)) &&
      (!q.mood || r.moods.includes(q.mood as never)),
    );
    return { items: clone(items.slice((q.page - 1) * q.pageSize, q.page * q.pageSize)), total: items.length };
  }
  async findById(id: string) { return clone(RECIPES.find((r) => r.id === id) ?? null); }
  async findByIds(ids: string[]) { return clone(RECIPES.filter((r) => ids.includes(r.id))); }
  async candidates(f: { excludeAllergens: string[]; requireDiets: string[] }) {
    return clone(RECIPES.filter((r) => !r.allergens.some((a) => f.excludeAllergens.includes(a)) && f.requireDiets.every((d) => r.diets.includes(d as never))));
  }
}

export class MemoryIngredientsRepository implements IngredientsRepository {
  async search(q: { q?: string; category?: string; page: number; pageSize: number }) {
    const s = (q.q ?? '').trim().toLowerCase();
    const items = INGREDIENTS.filter((i) => (!q.category || i.category === q.category) && (!s || i.name.toLowerCase().includes(s) || i.aliases?.some((a) => a.toLowerCase().includes(s))));
    return { items: clone(items.slice((q.page - 1) * q.pageSize, q.page * q.pageSize)), total: items.length };
  }
  async findById(id: string) { return clone(ING.get(id) ?? null); }
  async findByIds(ids: string[]) { return clone(ids.map((id) => ING.get(id)).filter(Boolean) as Ingredient[]); }
  async all() { return clone(INGREDIENTS); }
  async categories() { return [...catalog.categories]; }
}

export class MemoryInventoryRepository implements InventoryRepository {
  private rows = new Map<string, InventoryItem>();
  async list(userId: string) { return clone([...this.rows.values()].filter((r) => r.userId === userId).sort((a, b) => a.createdAt.localeCompare(b.createdAt))); }
  async findById(userId: string, id: string) { const r = this.rows.get(id); return r && r.userId === userId ? clone(r) : null; }
  async findByIngredient(userId: string, ingredientId: string) { return clone([...this.rows.values()].find((r) => r.userId === userId && r.ingredientId === ingredientId) ?? null); }
  async create(i: Omit<InventoryItem, 'id' | 'createdAt' | 'updatedAt'>) { const r = { ...i, id: randomUUID(), createdAt: now(), updatedAt: now() }; this.rows.set(r.id, r); return clone(r); }
  async update(userId: string, id: string, patch: Partial<InventoryItem>) {
    const r = this.rows.get(id);
    if (!r || r.userId !== userId) return null;
    Object.assign(r, patch, { updatedAt: now() });
    return clone(r);
  }
  async delete(userId: string, id: string) { const r = this.rows.get(id); if (!r || r.userId !== userId) return false; this.rows.delete(id); return true; }
}

export class MemoryFavouritesRepository implements FavouritesRepository {
  private rows: Favourite[] = [];
  async list(userId: string) { return clone(this.rows.filter((f) => f.userId === userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))); }
  async add(userId: string, recipeId: string) {
    if (this.rows.some((f) => f.userId === userId && f.recipeId === recipeId)) return { created: false };
    this.rows.push({ userId, recipeId, createdAt: now() });
    return { created: true };
  }
  async remove(userId: string, recipeId: string) { const n = this.rows.length; this.rows = this.rows.filter((f) => !(f.userId === userId && f.recipeId === recipeId)); return this.rows.length < n; }
  async has(userId: string, recipeId: string) { return this.rows.some((f) => f.userId === userId && f.recipeId === recipeId); }
}

export class MemoryCookingSessionsRepository implements CookingSessionsRepository {
  private rows = new Map<string, CookingSession>();
  async create(s: Omit<CookingSession, 'id' | 'startedAt' | 'updatedAt'>) { const r = { ...s, id: randomUUID(), startedAt: now(), updatedAt: now() }; this.rows.set(r.id, r); return clone(r); }
  async findById(userId: string, id: string) { const r = this.rows.get(id); return r && r.userId === userId ? clone(r) : null; }
  async findActive(userId: string) { return clone([...this.rows.values()].find((r) => r.userId === userId && r.status === 'active') ?? null); }
  async update(userId: string, id: string, patch: Partial<CookingSession>) {
    const r = this.rows.get(id);
    if (!r || r.userId !== userId) return null;
    Object.assign(r, patch, { updatedAt: now() });
    return clone(r);
  }
  async recentlyCompleted(userId: string, limit: number) {
    return [...this.rows.values()].filter((r) => r.userId === userId && r.status === 'completed').sort((a, b) => (b.endedAt ?? '').localeCompare(a.endedAt ?? '')).slice(0, limit).map((r) => r.recipeId);
  }
}

export class MemoryMemoriesRepository implements MemoriesRepository {
  private rows = new Map<string, Memory>();
  async list(userId: string) { return clone([...this.rows.values()].filter((m) => m.userId === userId)); }
  async findById(userId: string, id: string) { const m = this.rows.get(id); return m && m.userId === userId ? clone(m) : null; }
  async create(m: Omit<Memory, 'id' | 'createdAt' | 'updatedAt'>) { const r = { ...m, id: randomUUID(), createdAt: now(), updatedAt: now() }; this.rows.set(r.id, r); return clone(r); }
  async update(userId: string, id: string, patch: Partial<Memory>) {
    const m = this.rows.get(id);
    if (!m || m.userId !== userId) return null;
    Object.assign(m, patch, { updatedAt: now() });
    return clone(m);
  }
  async delete(userId: string, id: string) { const m = this.rows.get(id); if (!m || m.userId !== userId) return false; this.rows.delete(id); return true; }
}
