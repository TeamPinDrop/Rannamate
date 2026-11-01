import { ING_BY_ID, INGREDIENTS } from "./data/ingredients";
import { RECIPE_BY_ID } from "./data/recipes";
import type { AiRecipe } from "./mate/ai-schema";
import { ALLERGEN_WORDS } from "./mate/ai-schema";
import type { Allergen, Cuisine, Recipe, Unit } from "./types";

/**
 * Recipes invented by the live AI become first-class app recipes: they're
 * registered next to the catalog (so cook mode, favourites and the planner work)
 * and remembered in this browser. In Phase 3 they'll be saved via the backend.
 */
const KEY = "rannamate:ai-recipes";
const PALETTES: [string, string][] = [
  ["#F2B33D", "#C4561E"], ["#9CC56A", "#2E6B4A"], ["#E5763A", "#8A2B1A"], ["#F3DE8A", "#B88A44"],
  ["#E2442F", "#7E1A16"], ["#A9C46C", "#1F4D3A"], ["#F28A5B", "#8E2A1E"], ["#D99A3C", "#3E6B2A"],
];
const EMOJI: [RegExp, string][] = [
  [/puffed|murmura|muri|rice/, "🍚"], [/cucumber/, "🥒"], [/onion/, "🧅"], [/tomato/, "🍅"], [/potato/, "🥔"], [/chilli|chili/, "🌶️"],
  [/lemon|lime/, "🍋"], [/coriander|mint|herb|leaves/, "🌿"], [/peanut|nut/, "🥜"], [/egg/, "🥚"], [/milk|curd|yogurt|cream/, "🥛"],
  [/cheese|paneer/, "🧀"], [/garlic/, "🧄"], [/ginger/, "🫚"], [/carrot/, "🥕"], [/corn/, "🌽"], [/oil|ghee/, "🫗"], [/salt|masala|spice|powder|chaat/, "🧂"],
  [/bread|roti|flour/, "🍞"], [/chicken/, "🍗"], [/fish/, "🐟"], [/mushroom/, "🍄"], [/sev|namkeen|bhujia/, "🥨"],
];

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);

function hash(s: string) {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0;
  return Math.abs(h);
}

function ingredientIdFor(name: string): string {
  const n = name.toLowerCase().trim();
  const match = INGREDIENTS.find(
    (i) => i.name.toLowerCase() === n || n === `${i.name.toLowerCase()}s` || i.aliases?.some((a) => a === n) || (n.length > 3 && i.name.toLowerCase().split(" (")[0] === n.replace(/s$/, "")),
  );
  if (match) return match.id;
  const id = `x-${slug(name)}`;
  if (!ING_BY_ID[id]) {
    ING_BY_ID[id] = {
      id,
      name: name.charAt(0).toUpperCase() + name.slice(1),
      emoji: EMOJI.find(([re]) => re.test(n))?.[1] ?? "🥄",
      category: "Other",
      defaultUnit: "pcs",
    };
  }
  return id;
}

function toRecipe(id: string, r: AiRecipe): Recipe {
  const names = r.ingredients.map((i) => i.name.toLowerCase());
  const allergens = (Object.entries(ALLERGEN_WORDS) as [Allergen, string[]][])
    .filter(([, words]) => names.some((n) => words.some((w) => n.includes(w))))
    .map(([a]) => a);
  return {
    id,
    name: r.name,
    tagline: r.tagline || "Created by Mate from your ingredients",
    emoji: r.emoji,
    palette: PALETTES[hash(r.name) % PALETTES.length],
    cuisine: r.cuisine as Cuisine,
    moods: [],
    diets: [],
    allergens,
    difficulty: r.difficulty,
    prepMin: r.prepMinutes,
    cookMin: r.cookMinutes,
    servings: r.servings,
    equipment: [[]],
    ingredients: r.ingredients.map((i) => ({ ingredientId: ingredientIdFor(i.name), quantity: i.quantity, unit: i.unit as Unit, optional: i.optional, note: i.note })),
    steps: r.steps.map((s, k) => ({ text: s.text, timer: s.timerSeconds || undefined, tip: k === r.steps.length - 1 && r.tip ? r.tip : undefined })),
    substitutions: [],
    weather: "any",
  };
}

interface Stored { id: string; recipe: AiRecipe; at: number }

function readAll(): Stored[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? "[]") as Stored[]; } catch { return []; }
}

let loaded = false;
export function loadAiRecipes() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  for (const s of readAll()) if (!RECIPE_BY_ID[s.id]) RECIPE_BY_ID[s.id] = toRecipe(s.id, s.recipe);
}

export function registerAiRecipe(r: AiRecipe): string {
  loadAiRecipes();
  const id = `ai-${slug(r.name) || "dish"}-${Date.now().toString(36).slice(-4)}`;
  RECIPE_BY_ID[id] = toRecipe(id, r);
  try {
    const all = [{ id, recipe: r, at: Date.now() }, ...readAll()].slice(0, 40);
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch { /* storage full or blocked — recipe still works this session */ }
  return id;
}

export function getAiRecipe(id: string): AiRecipe | null {
  if (!id.startsWith("ai-")) return null;
  return readAll().find((s) => s.id === id)?.recipe ?? null;
}

export const isAiRecipe = (id: string | null | undefined) => !!id && id.startsWith("ai-");
