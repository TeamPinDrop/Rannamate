import { RECIPE_BY_ID } from "../data/recipes";
import type { MateCard, MateEffects } from "./types";

/**
 * The live AI answers in plain text plus optional tags that the UI turns into cards:
 *   [[recipes:id1,id2]]  [[recipe:id]]  [[cook:id]]  [[step:3]]  [[timer:300|Simmer]]  [[swap:garlic|asafoetida;shallots]]  [[serves:id|4]]
 */
export function parseTags(raw: string, ctx: { recipeId: string | null }) {
  const cards: MateCard[] = [];
  const effects: MateEffects = {};
  let recipeId = ctx.recipeId;
  const text = raw.replace(/\[\[(\w+):([^\]]+)\]\]/g, (_, kind: string, val: string) => {
    const v = val.trim();
    switch (kind) {
      case "recipes": {
        const ids = v.split(",").map((s) => s.trim()).filter((id) => RECIPE_BY_ID[id]);
        if (ids.length) cards.push({ type: "recipes", ids: ids.slice(0, 3) });
        break;
      }
      case "recipe":
        if (RECIPE_BY_ID[v]) { cards.push({ type: "recipe", id: v }); effects.setRecipe = v; recipeId = v; effects.setCooking = false; effects.setStep = 0; }
        break;
      case "cook":
        if (RECIPE_BY_ID[v]) { recipeId = v; effects.setRecipe = v; effects.setCooking = true; effects.setStep = 0; cards.push({ type: "step", id: v, index: 0 }); }
        break;
      case "step": {
        const n = Number(v) - 1;
        if (recipeId && RECIPE_BY_ID[recipeId]?.steps[n]) { effects.setStep = n; effects.setCooking = true; cards.push({ type: "step", id: recipeId, index: n }); }
        break;
      }
      case "timer": {
        const [sec, label] = v.split("|");
        const s = Math.max(5, Math.min(7200, Number(sec)));
        if (s) cards.push({ type: "timer", seconds: s, label: label?.trim() || "Timer" });
        break;
      }
      case "swap": {
        const [from, opts] = v.split("|");
        if (opts) cards.push({ type: "swap", from: from.trim(), options: opts.split(";").map((o) => o.trim()).filter(Boolean) });
        break;
      }
      case "serves": {
        const [id, n] = v.split("|");
        if (RECIPE_BY_ID[id?.trim()] && Number(n) > 0) cards.push({ type: "ingredients", id: id.trim(), servings: Number(n) });
        break;
      }
    }
    return "";
  });
  return { text: text.replace(/\s{2,}/g, " ").trim(), cards, effects };
}
