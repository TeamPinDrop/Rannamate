import { RECIPE_BY_ID } from "../data/recipes";
import { registerAiRecipe } from "../aiRecipes";
import type { AiReply } from "./ai-schema";
import type { MateCard, MateTurn } from "./types";

/** Turn the live AI's structured answer into chat cards + state changes. */
export function fromAi(d: AiReply, current: string | null): MateTurn {
  const cards: MateCard[] = [];
  const effects: MateTurn["effects"] = {};
  let id = current;

  if (d.created) {
    id = registerAiRecipe(d.created);
    cards.push({ type: "created", id });
    Object.assign(effects, { setRecipe: id, setCooking: false, setStep: 0 });
  }
  if (d.suggest?.length) cards.push({ type: "recipes", ids: d.suggest });
  if (d.focus && !d.created) {
    id = d.focus;
    cards.push({ type: "recipe", id });
    Object.assign(effects, { setRecipe: id, setCooking: false, setStep: 0 });
  }

  const r = id ? RECIPE_BY_ID[id] : null;
  if (r && (d.startCooking || (d.goToStep ?? 0) > 0)) {
    const idx = Math.min(r.steps.length - 1, Math.max(0, (d.goToStep || 1) - 1));
    cards.push({ type: "step", id: r.id, index: idx });
    Object.assign(effects, { setRecipe: r.id, setCooking: true, setStep: idx });
  }
  if (d.timerSeconds) cards.push({ type: "timer", seconds: d.timerSeconds, label: d.timerLabel || "Timer" });
  if (d.swapFrom && d.swapOptions?.length) cards.push({ type: "swap", from: d.swapFrom, options: d.swapOptions });
  if (r && d.servings) cards.push({ type: "ingredients", id: r.id, servings: d.servings });

  return { text: d.reply || "🙂", cards, effects, mood: d.created ? "excited" : "happy" };
}
