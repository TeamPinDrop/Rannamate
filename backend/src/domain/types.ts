/**
 * Domain types shared by the API. They mirror the approved frontend's data structures
 * (frontend/src/lib/types.ts, lib/tastory/types.ts) so the UI can consume responses directly.
 * IDs are strings in the API; the MySQL repositories will convert to the real key types once mapped.
 */
export const CUISINES = ['Indian', 'Italian', 'Chinese', 'Mexican', 'Thai', 'Japanese', 'Continental', 'Mediterranean'] as const;
export const MOODS = ['comfort', 'spicy', 'healthy', 'quick', 'special', 'light', 'protein', 'surprise'] as const;
export const DIETS = ['vegetarian', 'vegan', 'gluten-free', 'dairy-free', 'high-protein', 'low-carb'] as const;
export const DIFFICULTIES = ['Beginner', 'Intermediate', 'Advanced'] as const;
export const EQUIPMENT = ['gas', 'induction', 'oven', 'microwave', 'airfryer', 'pressure', 'pan'] as const;
export const ALLERGENS = ['gluten', 'dairy', 'egg', 'nuts', 'soy', 'shellfish', 'fish'] as const;
export const UNITS = ['pcs', 'g', 'kg', 'ml', 'l', 'tsp', 'tbsp', 'cup', 'bunch'] as const;
export const CATEGORIES = ['Vegetables', 'Fruits', 'Grains', 'Rice & Pulses', 'Dairy', 'Meat & Seafood', 'Spices', 'Oils & Sauces', 'Other'] as const;
export const LANGS = ['en', 'hinglish'] as const;
export const PERSONAS = ['mild', 'masala', 'chatpata'] as const;

export type Cuisine = (typeof CUISINES)[number];
export type Mood = (typeof MOODS)[number];
export type Diet = (typeof DIETS)[number];
export type Difficulty = (typeof DIFFICULTIES)[number];
export type Equipment = (typeof EQUIPMENT)[number];
export type Allergen = (typeof ALLERGENS)[number];
export type Unit = (typeof UNITS)[number];
export type Category = (typeof CATEGORIES)[number];

export interface Ingredient { id: string; name: string; emoji: string; category: Category; defaultUnit: Unit; staple?: boolean; aliases?: string[] }

export interface RecipeIngredient { ingredientId: string; quantity: number; unit: Unit; optional?: boolean; note?: string }
export interface RecipeStep { text: string; timer?: number; tip?: string }
export interface Recipe {
  id: string; name: string; tagline: string; emoji: string; palette: [string, string];
  cuisine: Cuisine; moods: Mood[]; diets: Diet[]; allergens: Allergen[]; difficulty: Difficulty;
  prepMin: number; cookMin: number; servings: number;
  equipment: Equipment[][]; ingredients: RecipeIngredient[]; steps: RecipeStep[];
  substitutions: { ingredientId: string; options: string[] }[];
  weather?: 'warm' | 'cool' | 'any';
}

/** passwordHash is null for accounts created with Google that never set a password */
export interface User { id: string; email: string; passwordHash: string | null; googleSub: string | null; active: boolean; createdAt: string; updatedAt: string }
/** Password-reset token: only a SHA-256 hash is stored; single use; expires. */
export interface PasswordReset { id: string; userId: string; tokenHash: string; expiresAt: string; usedAt: string | null; createdAt: string }
export interface Profile {
  userId: string; displayName: string; allergies: Allergen[]; diets: Diet[];
  preferredLanguage: (typeof LANGS)[number]; matePersona: (typeof PERSONAS)[number]; updatedAt: string;
}
export interface AuthSession { id: string; userId: string; tokenHash: string; expiresAt: string; revokedAt: string | null; createdAt: string; replacedBy?: string | null }

export interface InventoryItem { id: string; userId: string; ingredientId: string; quantity: number; unit: Unit; expiresOn: string | null; createdAt: string; updatedAt: string }
export interface Favourite { userId: string; recipeId: string; createdAt: string }

export type SessionStatus = 'active' | 'completed' | 'cancelled' | 'abandoned';
export interface CookingSession {
  id: string; userId: string; recipeId: string; status: SessionStatus; currentStep: number;
  steps: { index: number; completedAt: string | null }[];
  startedAt: string; updatedAt: string; endedAt: string | null;
}

export interface MemoryPhoto { id: string; storageKey: string; contentType: string; bytes: number; alt: string; createdAt: string }
export interface Memory {
  id: string; userId: string; dish: string; date: string; caption: string; notes: string;
  rating: number | null; tags: string[]; favourite: boolean; recipeId: string | null;
  /** photos[0] is the cover */
  photos: MemoryPhoto[];
  createdAt: string; updatedAt: string;
}
