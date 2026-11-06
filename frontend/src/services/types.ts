/** Response shapes of the RANNAMATE backend (see backend/docs/API.md). */
import type { Allergen, Cuisine, Diet, Difficulty, Mood, Unit } from "@/lib/types";

export interface Profile { displayName: string; allergies: Allergen[]; diets: Diet[]; preferredLanguage: "en" | "hinglish"; matePersona: "mild" | "masala" | "chatpata"; updatedAt: string }
export interface User { id: string; email: string; createdAt: string; signIn: { password: boolean; google: boolean }; profile: Profile }

export interface RecipeSummary { id: string; name: string; tagline: string; emoji: string; palette: [string, string]; cuisine: Cuisine; moods: Mood[]; diets: Diet[]; allergens: Allergen[]; difficulty: Difficulty; prepMin: number; cookMin: number; totalMin: number; servings: number }
export interface RecipeDetail extends RecipeSummary {
  ingredients: { ingredientId: string; name: string; emoji: string; quantity: number; unit: Unit; optional?: boolean; note?: string; staple: boolean }[];
  steps: { index: number; text: string; timerSeconds: number | null; tip: string | null }[];
  substitutions: { ingredientId: string; options: string[] }[];
}
export interface InventoryItem { id: string; ingredientId: string; name: string; emoji: string; category: string; quantity: number; unit: Unit; expiresOn: string | null; expired: boolean }
export interface Recommendation {
  recipe: RecipeSummary; score: number; matchPct: number; reasons: string[]; matchesAllFilters: boolean;
  components: Partial<Record<"I" | "M" | "C" | "W" | "T" | "P" | "H", number>>;
  available: { id: string; name: string }[]; missing: { id: string; name: string }[];
}
export interface CookingSession { id: string; recipeId: string; status: "active" | "completed" | "cancelled" | "abandoned"; currentStep: number; steps: { index: number; completedAt: string | null }[]; totalSteps: number; completedSteps: number; progress: number; startedAt: string; endedAt: string | null }
export interface MemoryPhoto { id: string; alt: string; contentType: string; bytes: number; url: string; expiresAt: string }
export interface Memory { id: string; dish: string; date: string; caption: string; notes: string; rating: number | null; tags: string[]; favourite: boolean; recipeId: string | null; coverPhotoId: string | null; photos: MemoryPhoto[]; createdAt: string; updatedAt: string }
export interface ScanResult { detections: { ingredientId: string; name: string; emoji: string; label: string; confidence: number; status: "likely" | "uncertain" }[]; unmatched: { label: string; confidence: number }[]; requiresConfirmation: true; message: string }
export interface MateReply { reply: string; action: "next" | "prev" | "repeat" | "start-timer" | "pause-timer" | null; goToStep: number | null; timerSeconds: number | null; swap: { from: string; options: string[] } | null; source: "ai" }
