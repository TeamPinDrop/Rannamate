import { ingredient, INGREDIENTS } from "./data/ingredients";
import type { Recipe } from "./types";

export type MateAction = "next" | "prev" | "repeat" | "start-timer" | "pause-timer";

const fmt = (sec: number) => (sec >= 60 ? `${Math.round(sec / 60)} minute${sec >= 120 ? "s" : ""}` : `${sec} seconds`);

function findIngredient(q: string) {
  const s = q.toLowerCase();
  return INGREDIENTS.find(
    (i) => s.includes(i.name.toLowerCase()) || i.aliases?.some((a) => new RegExp(`\\b${a}\\b`).test(s)),
  );
}

const GENERIC_SUBS: Record<string, string> = {
  garlic: "a small pinch of asafoetida (hing) or some toasted shallots, depending on the flavour you want",
  butter: "the same amount of oil or ghee — use a neutral oil if you want it dairy-free",
  onion: "a little extra garlic or a pinch of asafoetida for savoury depth",
  "green-chilli": "a pinch of red chilli powder or black pepper",
  tomato: "a spoon of tomato purée, or a little curd/lemon for tanginess",
  cream: "milk thickened with a little flour, or cashew paste",
  egg: "for binding, a tablespoon of curd or mashed banana; for scrambles, crumbled paneer or tofu",
  lemon: "a splash of vinegar or a pinch of amchur",
  "soy-sauce": "salt with a dash of vinegar",
  coriander: "spring onion greens or simply skip it",
  milk: "oat or almond milk, or water with a spoon of curd",
};

/**
 * Offline, rule-based fallback used when the backend / generative AI is not running.
 * It only answers from the selected recipe's data — it never invents facts it doesn't have.
 */
export function localMateReply(question: string, recipe: Recipe | null, step: number): { text: string; action?: MateAction } {
  const q = question.toLowerCase().trim();
  if (!recipe) {
    if (/hello|hi\b|hey/.test(q)) return { text: "Hi! Pick a recipe and I'll guide you step by step. Head to Discover to find one from your ingredients." };
    return { text: "Choose a recipe first so I know what we're cooking — then ask me about steps, substitutions, timing or spice." };
  }
  const s = recipe.steps[step];
  const total = recipe.steps.length;

  if (/\b(next|what('?s| is) next|after this|done with this|continue)\b/.test(q)) {
    if (step >= total - 1) return { text: "That was the last step — plate it up and enjoy! Tap Finish when you're done." };
    const n = recipe.steps[step + 1];
    return { text: `Step ${step + 2}: ${n.text}${n.timer ? ` That takes about ${fmt(n.timer)} — say "start timer" when you're ready.` : ""}`, action: "next" };
  }
  if (/\b(previous|go back|last step|before this)\b/.test(q)) {
    if (step === 0) return { text: "We're on the first step already." };
    return { text: `Back to step ${step}: ${recipe.steps[step - 1].text}`, action: "prev" };
  }
  if (/\b(repeat|again|say that|current step|where am i)\b/.test(q)) {
    return { text: `Step ${step + 1} of ${total}: ${s.text}${s.tip ? ` Tip: ${s.tip}` : ""}`, action: "repeat" };
  }
  if (/\b(start|set) (the )?timer\b/.test(q)) {
    return s.timer
      ? { text: `Starting a ${fmt(s.timer)} timer for this step.`, action: "start-timer" }
      : { text: "This step doesn't need a timer — just follow the cues described." };
  }
  if (/\b(pause|stop) (the )?timer\b/.test(q)) return { text: "Timer paused.", action: "pause-timer" };

  // substitutions
  const subMatch = /(without|instead of|replace|substitute|don'?t have|no |out of|swap)/.test(q);
  const ing = findIngredient(q);
  if (subMatch && ing) {
    if (/oven/.test(q)) return { text: "No oven needed for this one — it's cooked on the stovetop." };
    const fromRecipe = recipe.substitutions.find((x) => x.ingredientId === ing.id);
    const inRecipe = recipe.ingredients.find((x) => x.ingredientId === ing.id);
    if (!inRecipe) return { text: `${recipe.name} doesn't use ${ing.name.toLowerCase()}, so you're fine.` };
    if (inRecipe.optional) return { text: `${ing.name} is optional here — you can simply leave it out${fromRecipe ? `, or use ${fromRecipe.options.join(" or ")}` : ""}.` };
    if (fromRecipe) return { text: `Absolutely — instead of ${ing.name.toLowerCase()} you can use ${fromRecipe.options.join(", or ")}.` };
    if (GENERIC_SUBS[ing.id]) return { text: `You can try ${GENERIC_SUBS[ing.id]}. The flavour will shift a little, but it'll work.` };
    return { text: `${ing.name} is fairly central to ${recipe.name}. I'd suggest picking a different recipe from Discover, or I can help once the AI service is connected.` };
  }
  if (/oven/.test(q)) {
    const needs = recipe.equipment.some((g) => g.includes("oven"));
    return { text: needs ? "You can bake this in a covered heavy pan on low heat instead, checking more often." : "Good news — this recipe doesn't use an oven at all." };
  }

  if (/\bsalt\b/.test(q)) {
    const salt = recipe.ingredients.find((i) => i.ingredientId === "salt");
    return { text: salt ? `The recipe uses about ${salt.quantity} ${salt.unit} of salt for ${recipe.servings} serving${recipe.servings > 1 ? "s" : ""}. Add most of it, taste, then adjust at the end.` : "This recipe doesn't call for added salt — taste at the end and adjust." };
  }
  if (/(less|reduce|not too|mild).*(spic|hot|chilli)|(spic|hot).*(less|reduce)/.test(q)) {
    return { text: "To make it milder, halve the chillies and remove their seeds, skip chilli powder or flakes, and finish with a spoon of curd or cream if it suits the dish." };
  }
  if (/(more|extra|add).*(spic|chilli|hot|heat)/.test(q)) {
    const has = recipe.ingredients.find((i) => ["green-chilli", "chilli-powder", "chilli-flakes"].includes(i.ingredientId));
    return { text: has ? `Sure — add one more ${ingredient(has.ingredientId).name.toLowerCase()} at the same stage the recipe adds it, so the heat cooks in evenly. Taste before adding more.` : "Add a pinch of chilli flakes or black pepper near the end, tasting as you go." };
  }
  if (/how long|how much time|minutes|when is it done/.test(q)) {
    return s.timer
      ? { text: `This step takes about ${fmt(s.timer)}. ${s.tip ?? "Watch for the cue described in the step."}` }
      : { text: `There's no fixed time for this step — follow the cue: "${s.text}". The whole recipe takes about ${recipe.prepMin + recipe.cookMin} minutes.` };
  }
  if (/ingredient|what do i need|shopping/.test(q)) {
    return { text: `You'll need: ${recipe.ingredients.map((i) => `${ingredient(i.ingredientId).name}${i.optional ? " (optional)" : ""}`).join(", ")}.` };
  }
  if (/serve|serving|portion/.test(q)) return { text: `This makes ${recipe.servings} serving${recipe.servings > 1 ? "s" : ""}.` };
  if (/thank/.test(q)) return { text: "Happy cooking! I'm right here if you need me." };

  return {
    text: `I'm running in offline mode, so I can help with steps ("next", "repeat"), timers, salt, spice level and substitutions for ${recipe.name}. Richer answers need the AI service.`,
  };
}
