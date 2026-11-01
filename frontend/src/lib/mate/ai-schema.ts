/** Shape the live AI must answer in (shared by the server route and the client). */

export interface AiIngredient {
  name: string;
  quantity: number;
  unit: string;
  optional?: boolean;
  note?: string;
}

export interface AiStep {
  text: string;
  timerSeconds?: number;
}

export interface AiRecipe {
  name: string;
  emoji: string;
  tagline: string;
  cuisine: string;
  difficulty: "Beginner" | "Intermediate" | "Advanced";
  prepMinutes: number;
  cookMinutes: number;
  servings: number;
  ingredients: AiIngredient[];
  steps: AiStep[];
  tip?: string;
}

export interface AiReply {
  reply: string;
  suggest?: string[];
  focus?: string;
  startCooking?: boolean;
  goToStep?: number;
  timerSeconds?: number;
  timerLabel?: string;
  swapFrom?: string;
  swapOptions?: string[];
  servings?: number;
  created?: AiRecipe | null;
}

/** Gemini `responseSchema` (OpenAPI subset). */
export const GEMINI_SCHEMA = {
  type: "OBJECT",
  properties: {
    reply: { type: "STRING", description: "What Mate says (spoken aloud). 1-4 short sentences, no markdown." },
    suggest: { type: "ARRAY", items: { type: "STRING" }, description: "Up to 3 catalog recipe ids to show as cards." },
    focus: { type: "STRING", description: "One catalog recipe id to focus on, or empty." },
    startCooking: { type: "BOOLEAN", description: "true when the user wants to start cooking the current/focused/created recipe." },
    goToStep: { type: "INTEGER", description: "1-based step to show during cooking (next/back/repeat), 0 if none." },
    timerSeconds: { type: "INTEGER", description: "Start a countdown of this many seconds, 0 if none." },
    timerLabel: { type: "STRING" },
    swapFrom: { type: "STRING", description: "Ingredient being substituted, if any." },
    swapOptions: { type: "ARRAY", items: { type: "STRING" } },
    servings: { type: "INTEGER", description: "Show the current recipe scaled to this many people, 0 if not asked." },
    created: {
      type: "OBJECT",
      nullable: true,
      description: "A NEW recipe you invent when no catalog recipe fits the user's ingredients well. Omit otherwise.",
      properties: {
        name: { type: "STRING" },
        emoji: { type: "STRING", description: "One food emoji." },
        tagline: { type: "STRING", description: "Under 12 words." },
        cuisine: { type: "STRING" },
        difficulty: { type: "STRING", enum: ["Beginner", "Intermediate", "Advanced"] },
        prepMinutes: { type: "INTEGER" },
        cookMinutes: { type: "INTEGER" },
        servings: { type: "INTEGER" },
        ingredients: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              name: { type: "STRING" },
              quantity: { type: "NUMBER" },
              unit: { type: "STRING", description: "pcs, g, ml, tsp, tbsp, cup, bunch or pinch" },
              optional: { type: "BOOLEAN" },
              note: { type: "STRING" },
            },
            required: ["name", "quantity", "unit"],
          },
        },
        steps: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: { text: { type: "STRING" }, timerSeconds: { type: "INTEGER" } },
            required: ["text"],
          },
        },
        tip: { type: "STRING" },
      },
      required: ["name", "emoji", "tagline", "cuisine", "difficulty", "prepMinutes", "cookMinutes", "servings", "ingredients", "steps"],
    },
  },
  required: ["reply"],
} as const;

/** Words that reveal an allergen or diet conflict in free-text ingredient names. */
export const ALLERGEN_WORDS: Record<string, string[]> = {
  dairy: ["milk", "butter", "cheese", "paneer", "curd", "yogurt", "yoghurt", "dahi", "cream", "ghee", "khoya", "malai"],
  gluten: ["wheat", "flour", "atta", "maida", "bread", "pasta", "noodle", "semolina", "rava", "suji", "barley", "soy sauce", "tortilla", "roti"],
  egg: ["egg", "anda"],
  nuts: ["peanut", "cashew", "almond", "walnut", "pistachio", "pista", "hazelnut", "groundnut", "kaju", "badam"],
  soy: ["soy", "tofu", "soya", "edamame"],
  shellfish: ["prawn", "shrimp", "crab", "lobster", "jhinga"],
  fish: ["fish", "salmon", "tuna", "rohu", "hilsa", "anchovy", "machli"],
};
export const MEAT_WORDS = ["chicken", "mutton", "lamb", "beef", "pork", "bacon", "ham", "fish", "prawn", "shrimp", "crab", "meat", "keema", "salmon", "tuna"];

export function conflicts(r: AiRecipe, allergies: string[], diets: string[]): string[] {
  const names = r.ingredients.map((i) => i.name.toLowerCase());
  const hit = (words: string[]) => names.find((n) => words.some((w) => n.includes(w)));
  const out: string[] = [];
  for (const a of allergies) {
    const h = hit(ALLERGEN_WORDS[a] ?? [a]);
    if (h) out.push(`${h} (allergy: ${a})`);
  }
  if (diets.includes("vegetarian") || diets.includes("vegan")) {
    const h = hit(MEAT_WORDS);
    if (h) out.push(`${h} (not vegetarian)`);
  }
  if (diets.includes("vegan")) {
    const h = hit([...ALLERGEN_WORDS.dairy, ...ALLERGEN_WORDS.egg, "honey"]);
    if (h) out.push(`${h} (not vegan)`);
  }
  if (diets.includes("gluten-free")) {
    const h = hit(ALLERGEN_WORDS.gluten);
    if (h) out.push(`${h} (contains gluten)`);
  }
  if (diets.includes("dairy-free")) {
    const h = hit(ALLERGEN_WORDS.dairy);
    if (h) out.push(`${h} (contains dairy)`);
  }
  return out;
}

const clampN = (v: unknown, lo: number, hi: number, d: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;
};
const str = (v: unknown, max: number, d = "") => (typeof v === "string" ? v.trim().slice(0, max) : d);

/** Clamp/clean whatever the model returned so the UI can trust it. */
export function normaliseRecipe(raw: unknown): AiRecipe | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const ingredients = (Array.isArray(r.ingredients) ? r.ingredients : [])
    .slice(0, 20)
    .map((i: Record<string, unknown>) => ({
      name: str(i?.name, 60),
      quantity: clampN(i?.quantity, 0, 5000, 1),
      unit: str(i?.unit, 12, "pcs") || "pcs",
      optional: !!i?.optional,
      note: str(i?.note, 60) || undefined,
    }))
    .filter((i) => i.name);
  const steps = (Array.isArray(r.steps) ? r.steps : [])
    .slice(0, 12)
    .map((s: Record<string, unknown>) => ({ text: str(s?.text, 400), timerSeconds: clampN(s?.timerSeconds, 0, 3 * 3600, 0) || undefined }))
    .filter((s) => s.text);
  const name = str(r.name, 60);
  if (!name || ingredients.length < 2 || steps.length < 2) return null;
  const diff = ["Beginner", "Intermediate", "Advanced"].includes(r.difficulty as string) ? (r.difficulty as AiRecipe["difficulty"]) : "Beginner";
  return {
    name,
    emoji: str(r.emoji, 8, "🍽️") || "🍽️",
    tagline: str(r.tagline, 90),
    cuisine: str(r.cuisine, 30, "Fusion") || "Fusion",
    difficulty: diff,
    prepMinutes: clampN(r.prepMinutes, 0, 600, 10),
    cookMinutes: clampN(r.cookMinutes, 0, 600, 10),
    servings: clampN(r.servings, 1, 20, 2),
    ingredients,
    steps,
    tip: str(r.tip, 200) || undefined,
  };
}
