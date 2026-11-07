/**
 * Repository contracts. Services depend only on these — never on a concrete store.
 * Two implementations exist:
 *   - memory/  explicit in-memory store for development and tests (DATA_SOURCE=memory)
 *   - mysql/   the ranna_mate database (DATA_SOURCE=mysql) — stubs until the schema is verified
 * All user-owned queries take the owner's id, so ownership is enforced at the data boundary too.
 */
import type { AuthSession, CookingSession, Favourite, Ingredient, InventoryItem, Memory, PasswordReset, Profile, Recipe, User } from '../../domain/types';

export interface RecipeQuery {
  q?: string; cuisine?: string; maxTime?: number; difficulty?: string; diet?: string; mood?: string;
  page: number; pageSize: number;
}

export interface UsersRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  /** the account that signs in with this Google identity (MySQL: auth_provider='google' + the verified email) */
  findByGoogle(sub: string, email: string): Promise<User | null>;
  /** must fail with a conflict if the email already exists (unique index in MySQL) */
  create(input: { email: string; passwordHash: string | null; displayName: string; googleSub?: string | null }): Promise<User>;
  setPasswordHash(userId: string, passwordHash: string): Promise<void>;
  /** connect Google to an existing account; false when the database can't record it */
  linkGoogle(userId: string, googleSub: string): Promise<boolean>;
  getProfile(userId: string): Promise<Profile | null>;
  updateProfile(userId: string, patch: Partial<Omit<Profile, 'userId' | 'updatedAt'>>): Promise<Profile>;
}

export interface AuthSessionsRepository {
  /** the repository assigns the id (MySQL: AUTO_INCREMENT user_session_id) */
  create(s: { userId: string; tokenHash: string; expiresAt: string }): Promise<AuthSession>;
  findById(id: string): Promise<AuthSession | null>;
  findByTokenHash(tokenHash: string): Promise<AuthSession | null>;
  revoke(id: string, replacedBy?: string | null): Promise<void>;
  revokeAllForUser(userId: string): Promise<void>;
}

export interface PasswordResetsRepository {
  /** false when the database has no table for reset tokens (the app then says reset isn't available) */
  readonly available: boolean;
  create(r: Omit<PasswordReset, 'createdAt' | 'usedAt'>): Promise<PasswordReset>;
  findByTokenHash(tokenHash: string): Promise<PasswordReset | null>;
  /** atomically marks the token used; returns false if it was already used (single use) */
  consume(id: string): Promise<boolean>;
  /** marks every unused token of the user as used (a newer one was issued or the password changed) */
  invalidateAllForUser(userId: string): Promise<void>;
  latestForUser(userId: string): Promise<PasswordReset | null>;
}

export interface RecipesRepository {
  search(q: RecipeQuery): Promise<{ items: Recipe[]; total: number }>;
  findById(id: string): Promise<Recipe | null>;
  findByIds(ids: string[]): Promise<Recipe[]>;
  /** candidates for the recommender; a SQL implementation should pre-filter hard exclusions */
  candidates(filter: { excludeAllergens: string[]; requireDiets: string[] }): Promise<Recipe[]>;
}

export interface IngredientsRepository {
  search(q: { q?: string; category?: string; page: number; pageSize: number }): Promise<{ items: Ingredient[]; total: number }>;
  findById(id: string): Promise<Ingredient | null>;
  findByIds(ids: string[]): Promise<Ingredient[]>;
  all(): Promise<Ingredient[]>;
  categories(): Promise<string[]>;
}

export interface InventoryRepository {
  list(userId: string): Promise<InventoryItem[]>;
  findById(userId: string, id: string): Promise<InventoryItem | null>;
  findByIngredient(userId: string, ingredientId: string): Promise<InventoryItem | null>;
  create(item: Omit<InventoryItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<InventoryItem>;
  update(userId: string, id: string, patch: Partial<Pick<InventoryItem, 'quantity' | 'unit' | 'expiresOn'>>): Promise<InventoryItem | null>;
  delete(userId: string, id: string): Promise<boolean>;
}

export interface FavouritesRepository {
  list(userId: string): Promise<Favourite[]>;
  add(userId: string, recipeId: string): Promise<{ created: boolean }>;
  remove(userId: string, recipeId: string): Promise<boolean>;
  has(userId: string, recipeId: string): Promise<boolean>;
}

export interface CookingSessionsRepository {
  create(s: Omit<CookingSession, 'id' | 'startedAt' | 'updatedAt'>): Promise<CookingSession>;
  findById(userId: string, id: string): Promise<CookingSession | null>;
  findActive(userId: string): Promise<CookingSession | null>;
  update(userId: string, id: string, patch: Partial<Pick<CookingSession, 'status' | 'currentStep' | 'steps' | 'endedAt'>>): Promise<CookingSession | null>;
  /** recently completed recipe ids, newest first — feeds the recommender's history signal */
  recentlyCompleted(userId: string, limit: number): Promise<string[]>;
}

export interface MemoriesRepository {
  list(userId: string): Promise<Memory[]>;
  findById(userId: string, id: string): Promise<Memory | null>;
  create(m: Omit<Memory, 'id' | 'createdAt' | 'updatedAt'>): Promise<Memory>;
  update(userId: string, id: string, patch: Partial<Omit<Memory, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>): Promise<Memory | null>;
  delete(userId: string, id: string): Promise<boolean>;
}

export const REPO = {
  users: Symbol('UsersRepository'),
  authSessions: Symbol('AuthSessionsRepository'),
  passwordResets: Symbol('PasswordResetsRepository'),
  recipes: Symbol('RecipesRepository'),
  ingredients: Symbol('IngredientsRepository'),
  inventory: Symbol('InventoryRepository'),
  favourites: Symbol('FavouritesRepository'),
  cookingSessions: Symbol('CookingSessionsRepository'),
  memories: Symbol('MemoriesRepository'),
} as const;
