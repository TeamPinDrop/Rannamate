export type IngredientCategory =
  | "Vegetables"
  | "Fruits"
  | "Grains"
  | "Rice & Pulses"
  | "Dairy"
  | "Meat & Seafood"
  | "Spices"
  | "Oils & Sauces"
  | "Other";

export type Unit = "pcs" | "g" | "kg" | "ml" | "l" | "tsp" | "tbsp" | "cup" | "bunch";

export interface Ingredient {
  id: string;
  name: string;
  emoji: string;
  category: IngredientCategory;
  defaultUnit: Unit;
  /** Pantry staples (salt, water, oil) are assumed available and don't count against a match. */
  staple?: boolean;
  aliases?: string[];
}

export interface PantryItem {
  ingredientId: string;
  quantity: number;
  unit: Unit;
}

export type Mood = "comfort" | "spicy" | "healthy" | "quick" | "special" | "light" | "protein" | "surprise";
export type Cuisine =
  | "Indian" | "Italian" | "Chinese" | "Mexican" | "Thai" | "Japanese" | "Continental" | "Mediterranean";
export type Diet = "vegetarian" | "vegan" | "gluten-free" | "dairy-free" | "high-protein" | "low-carb";
export type Difficulty = "Beginner" | "Intermediate" | "Advanced";
export type Equipment = "gas" | "induction" | "oven" | "microwave" | "airfryer" | "pressure" | "pan";
export type Allergen = "gluten" | "dairy" | "egg" | "nuts" | "soy" | "shellfish" | "fish";

export interface RecipeIngredient {
  ingredientId: string;
  quantity: number;
  unit: Unit;
  optional?: boolean;
  note?: string;
}

export interface RecipeStep {
  text: string;
  /** seconds, when the step involves waiting */
  timer?: number;
  tip?: string;
}

export interface Substitution {
  ingredientId: string;
  options: string[];
}

export interface Recipe {
  id: string;
  name: string;
  tagline: string;
  emoji: string;
  /** two colours used to paint the dish art */
  palette: [string, string];
  cuisine: Cuisine;
  moods: Mood[];
  diets: Diet[];
  allergens: Allergen[];
  difficulty: Difficulty;
  prepMin: number;
  cookMin: number;
  servings: number;
  /** Any ONE of these is sufficient (stovetop recipes work on gas or induction) */
  equipment: Equipment[][];
  ingredients: RecipeIngredient[];
  steps: RecipeStep[];
  substitutions: Substitution[];
  /** "warm" dishes suit cold/rainy weather, "cool" suit hot weather */
  weather?: "warm" | "cool" | "any";
}

export interface Filters {
  moods: Mood[];
  cuisines: Cuisine[];
  maxTime: number | null; // minutes, null = no restriction
  diets: Diet[];
  difficulty: Difficulty[];
  equipment: Equipment[];
}

export interface Profile {
  name: string;
  allergies: Allergen[];
  diets: Diet[];
}

