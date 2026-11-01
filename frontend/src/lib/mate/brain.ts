import { INGREDIENTS, ingredient } from "../data/ingredients";
import { RECIPES, RECIPE_BY_ID, totalTime } from "../data/recipes";
import { localMateReply } from "../mate-local";
import { recommend } from "../recommend";
import { DEFAULT_FILTERS } from "../store";
import type { Allergen, Cuisine, Diet, Filters, Mood } from "../types";
import { decorate, FALLBACK, GREETINGS, JOKES, line, pick } from "./persona";
import type { MateCard, MateContext, MateTurn } from "./types";

/**
 * RANNAMATE's built-in "brain": a rule-based conversational engine that works
 * with zero API keys. It understands ingredients, cravings, cuisines, time limits,
 * recipe names and cook-along commands, and answers with rich cards.
 */

const RECIPE_KEYWORDS: Record<string, string[]> = {
  "masala-omelette": ["omelette", "omelet", "anda", "masala omelette"],
  "aloo-jeera": ["jeera aloo", "aloo jeera", "jeera"],
  "tomato-egg-fried-rice": ["fried rice", "egg rice"],
  "dal-tadka": ["dal tadka", "dal", "daal", "tadka"],
  poha: ["poha"],
  "jhal-muri": ["jhal muri", "jhalmuri", "bhel", "bhelpuri", "chaat", "murmura chaat"],
  "pasta-pomodoro": ["pasta", "pomodoro", "spaghetti"],
  "paneer-bhurji": ["bhurji", "paneer bhurji"],
  "veg-hakka-noodles": ["noodles", "hakka", "chowmein", "chow mein"],
  "chana-salad": ["salad", "chickpea salad", "chana salad"],
  "egg-curry": ["egg curry", "anda curry"],
  "mushroom-stir-fry": ["mushroom stir", "garlic mushroom", "mushroom fry"],
  "veg-quesadilla": ["quesadilla"],
  "thai-green-veg-curry": ["coconut curry", "thai curry", "thai"],
  "banana-oat-smoothie": ["smoothie", "shake"],
  "garlic-butter-prawns": ["prawn", "prawns", "shrimp", "jhinga"],
  "chicken-teriyaki-bowl": ["teriyaki", "chicken bowl"],
};

const MOOD_WORDS: [RegExp, Mood][] = [
  [/spic|teekh|hot|chatpat|fiery|chilli/, "spicy"],
  [/quick|fast|jaldi|hurry|easy|lazy/, "quick"],
  [/healthy|light|diet|fresh|clean/, "healthy"],
  [/comfort|cozy|cosy|soul|rainy|baarish/, "comfort"],
  [/protein|gym|muscle/, "protein"],
  [/special|fancy|date|party|impress|celebrat/, "special"],
  [/refresh|summer|garmi|cool/, "light"],
];

const CUISINE_WORDS: [RegExp, Cuisine][] = [
  [/indian|desi|ghar ka/, "Indian"], [/italian/, "Italian"], [/chinese|indo-chinese/, "Chinese"],
  [/mexican/, "Mexican"], [/thai/, "Thai"], [/japanese/, "Japanese"], [/continental/, "Continental"], [/mediterranean|greek/, "Mediterranean"],
];

const DIET_WORDS: [RegExp, Diet][] = [
  [/vegan/, "vegan"], [/\bveg\b|vegetarian|no meat|shakahari/, "vegetarian"], [/gluten/, "gluten-free"],
  [/dairy[- ]free|no dairy|lactose/, "dairy-free"], [/low[- ]carb|keto/, "low-carb"],
];

function esc(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function findIngredients(q: string): string[] {
  let s = ` ${q.toLowerCase()} `;
  const found = new Set<string>();
  // longest names first, and consume what matched — so "puffed rice" isn't also read as "rice"
  const candidates = INGREDIENTS.filter((i) => !i.staple)
    .flatMap((i) => {
      const base = i.name.toLowerCase().split(" (")[0];
      return [i.name.toLowerCase(), base, base.split(" / ")[0], ...(i.aliases ?? [])].filter(Boolean).map((n) => ({ id: i.id, n }));
    })
    .sort((a, b) => b.n.length - a.n.length);
  for (const { id, n } of candidates) {
    const re = new RegExp(`([^a-z])${esc(n)}(e?s)?(?=[^a-z])`, "g");
    if (re.test(s)) { found.add(id); s = s.replace(re, "$1 "); }
  }
  // common Hindi words
  const hindi: Record<string, string> = { tamatar: "tomato", pyaaz: "onion", pyaz: "onion", anda: "egg", ande: "egg", chawal: "rice", lehsun: "garlic", adrak: "ginger", gajar: "carrot", doodh: "milk", makhan: "butter", kheera: "cucumber", nimbu: "lemon", mirch: "green-chilli", aloo: "potato" };
  for (const [w, id] of Object.entries(hindi)) if (new RegExp(`\\b${w}\\b`).test(s)) found.add(id);
  return Array.from(found);
}

function findRecipe(q: string): string | null {
  const s = q.toLowerCase();
  let best: string | null = null;
  let bestLen = 0;
  for (const [id, kws] of Object.entries(RECIPE_KEYWORDS)) {
    for (const k of kws) if (s.includes(k) && k.length > bestLen) { best = id; bestLen = k.length; }
  }
  for (const r of RECIPES) if (s.includes(r.name.toLowerCase())) return r.id;
  return best;
}

const has = (q: string, re: RegExp) => re.test(q);

function recipesTurn(ctx: MateContext, filters: Filters, pantry: string[], intro: string, empty: string): MateTurn {
  const { results } = recommend({
    pantry: pantry.map((id) => ({ ingredientId: id, quantity: 1, unit: "pcs" })),
    filters,
    allergies: ctx.allergies as Allergen[],
    profileDiets: ctx.diets as Diet[],
    favourites: [],
    history: [],
  });
  const strict = results.filter((r) => r.matchesAllFilters);
  const pool = !pantry.length && strict.length ? strict : results;
  const good = pool.filter((r) => (pantry.length ? r.ingredientMatch >= 0.34 : true) && (r.matchesAllFilters || !pantry.length ? true : r.ingredientMatch > 0.6));
  const top = (good.length ? good : pool).slice(0, 3);
  if (!top.length) return { text: decorate(empty, ctx.persona, ctx.lang, { opener: false }), cards: [], effects: {}, mood: "thinking" };
  const matches = pantry.length ? Object.fromEntries(top.map((r) => [r.recipe.id, Math.round(r.ingredientMatch * 100)])) : undefined;
  const best = top[0];
  const why = pantry.length
    ? best.missing.length === 0
      ? `${best.recipe.name} needs nothing extra — you have every essential!`
      : `${best.recipe.name} is closest; you'd only need ${best.missing.map((m) => ingredient(m).name.toLowerCase()).join(", ")}.`
    : `${best.recipe.name} is my top pick (${totalTime(best.recipe)} min).`;
  return {
    text: decorate(`${intro} ${why}`, ctx.persona, ctx.lang, { closer: true }),
    cards: [{ type: "recipes", ids: top.map((r) => r.recipe.id), matches }],
    effects: {},
    mood: "excited",
  };
}

function stepTurn(ctx: MateContext, id: string, index: number, prefix = ""): MateTurn {
  const r = RECIPE_BY_ID[id];
  const s = r.steps[index];
  const cards: MateCard[] = [{ type: "step", id, index }];
  if (s.timer) cards.push({ type: "timer", seconds: s.timer, label: `Step ${index + 1}` });
  const tail = index === r.steps.length - 1 ? (ctx.lang === "hinglish" ? " Yeh last step hai!" : " This is the last step!") : "";
  return {
    text: `${prefix}Step ${index + 1} of ${r.steps.length}: ${s.text}${s.tip ? ` Tip: ${s.tip}` : ""}${tail}`,
    cards,
    effects: { setRecipe: id, setStep: index, setCooking: true },
    mood: "happy",
  };
}

export function think(input: string, ctx: MateContext): MateTurn {
  const q = input.toLowerCase().trim().replace(/^(hey |hi |ok )?(rannamate|mate)[,!\s]*/i, "");
  const { persona: P, lang: L } = ctx;
  const hi = L === "hinglish";
  const current = ctx.recipeId ? RECIPE_BY_ID[ctx.recipeId] : null;

  // ---------- cook-along commands ----------
  if (current && ctx.cooking) {
    if (has(q, /^(next|aage|agla|done|ho gaya|hogaya|what'?s next|next step|continue)\b/) || has(q, /\bnext step\b/)) {
      if (ctx.step >= current.steps.length - 1) {
        return { text: decorate(hi ? `${current.name} taiyaar hai! 🎉 Plate karo aur enjoy karo.` : `${current.name} is ready! 🎉 Plate it up and enjoy.`, P, L), cards: [], effects: { setCooking: false }, mood: "excited" };
      }
      return stepTurn(ctx, current.id, ctx.step + 1, hi ? "Chalo aage! " : "Next up! ");
    }
    const jump = q.match(/(?:go to |jump to )?step (\d+)/);
    if (jump) {
      const n = Math.min(current.steps.length, Math.max(1, Number(jump[1]))) - 1;
      return stepTurn(ctx, current.id, n);
    }
    if (has(q, /^(back|previous|pichla|go back)\b/)) return stepTurn(ctx, current.id, Math.max(0, ctx.step - 1));
    if (has(q, /^(repeat|again|phir se|dobara)\b/)) return stepTurn(ctx, current.id, ctx.step);
    if (has(q, /\b(timer|start timer)\b/)) {
      const s = current.steps[ctx.step];
      return s.timer
        ? { text: hi ? `Timer laga diya — ${Math.round(s.timer / 60) || 1} minute. Main bata dunga! ⏱️` : `Timer's on — about ${Math.round(s.timer / 60) || 1} min. I'll shout when it's done! ⏱️`, cards: [{ type: "timer", seconds: s.timer, label: `Step ${ctx.step + 1}` }], effects: {}, mood: "happy" }
        : { text: hi ? "Is step mein timer ki zaroorat nahi — bas cue dekho." : "No timer needed for this step — just watch for the cue.", cards: [], effects: {} };
    }
    if (has(q, /\b(stop cooking|exit|quit|band karo)\b/)) return { text: hi ? "Cook-along band. Jab chaho phir shuru karna!" : "Cook-along paused. Say \"let's cook\" to jump back in.", cards: [], effects: { setCooking: false } };
  }

  // ---------- small talk ----------
  if (q.length < 22 && has(q, /^(hi|hello|hey|namaste|yo|hola|good (morning|evening|afternoon))\b/)) {
    return { text: line(GREETINGS, P, L), cards: [], effects: {}, mood: "happy" };
  }
  if (has(q, /joke|funny|make me laugh|hasao/)) return { text: pick(JOKES), cards: [], effects: {}, mood: "excited" };
  if (has(q, /^(thanks|thank you|thx|shukriya|dhanyavaad)/)) {
    return { text: decorate(hi ? "Koi baat nahi! Khana banao, khush raho. 😄" : "Anytime! Happy cooking. 😄", P, L, { opener: false }), cards: [], effects: {}, mood: "happy" };
  }
  if (has(q, /who are you|what can you do|help|kya kar sakte/)) {
    return {
      text: hi
        ? "Main Mate hoon! Ingredients batao toh recipe dhoondhunga, craving batao toh suggest karunga, recipe ke steps bolke sikhaunga, timer lagaunga, aur substitutes bhi dunga. Mic dabao aur bolo! 🎙️"
        : "I'm Mate! Tell me your ingredients and I'll find recipes, describe a craving and I'll suggest dishes, then I'll walk you through every step out loud — with timers, swaps and serving sizes. Tap the mic and just talk! 🎙️",
      cards: [], effects: {}, mood: "happy",
    };
  }

  // ---------- start cook-along ----------
  const named = findRecipe(q);
  if (has(q, /(let'?s cook|start cooking|cook (it|this)|begin|shuru|bana(te|o) (hain|na)|cook along|start)/)) {
    const id = named ?? ctx.recipeId;
    if (!id) return { text: hi ? "Pehle batao kya banana hai! 🍳" : "Tell me what to cook first! Pick a recipe or tell me your ingredients. 🍳", cards: [], effects: {} };
    const r = RECIPE_BY_ID[id];
    return stepTurn(ctx, id, 0, decorate(hi ? `${r.name} — chalo shuru! ` : `${r.name}, here we go! `, P, L, { opener: P !== "mild" }) + " ");
  }

  // ---------- servings scaling ----------
  const serve = q.match(/(?:for|serve|serves|feed|log|people|persons)\s*(\d+)|(\d+)\s*(?:people|persons|log|servings|portions)/);
  if (serve && (named || current)) {
    const n = Number(serve[1] ?? serve[2]);
    const id = named ?? current!.id;
    return { text: decorate(hi ? `${n} logon ke liye quantities yeh rahi:` : `Here are the quantities for ${n}:`, P, L), cards: [{ type: "ingredients", id, servings: n }], effects: { setRecipe: id }, mood: "happy" };
  }

  // ---------- recipe focus ----------
  const askingAbout = named && !has(q, /instead|without|replace|substitute/);
  if (askingAbout) {
    const r = RECIPE_BY_ID[named!];
    return {
      text: decorate(
        hi
          ? `${r.name}! ${r.tagline}. ${r.prepMin + r.cookMin} minute, ${r.steps.length} steps. Bolo "let's cook" aur main step-by-step bataunga.`
          : `${r.name} — ${r.tagline.toLowerCase()}. About ${r.prepMin + r.cookMin} minutes over ${r.steps.length} steps. Say "let's cook" and I'll guide you through it.`,
        P, L,
      ),
      cards: [{ type: "recipe", id: r.id }],
      effects: { setRecipe: r.id, setCooking: false, setStep: 0 },
      mood: "excited",
    };
  }

  // ---------- recipe questions about the current dish (subs, salt, spice…) ----------
  if (current && has(q, /instead|without|replace|substitute|swap|don'?t have|nahi hai|salt|namak|spic|less|more|oven|how long|kitna|ingredient|serve/)) {
    const ingIds = findIngredients(q);
    const sub = current.substitutions.find((s) => ingIds.includes(s.ingredientId));
    const r = localMateReply(input, current, ctx.step);
    const cards: MateCard[] = sub ? [{ type: "swap", from: sub.ingredientId, options: sub.options }] : [];
    const startsWarm = /^(absolutely|sure|good news|you can)/i.test(r.text);
    return { text: decorate(r.text.replace(/^I'm running in offline mode.*$/, ""), P, L, { opener: P !== "mild" && !startsWarm }), cards, effects: {}, mood: "thinking" };
  }

  // ---------- find recipes ----------
  const ings = findIngredients(q);
  const filters: Filters = { ...DEFAULT_FILTERS, moods: [], cuisines: [], diets: [] };
  for (const [re, m] of MOOD_WORDS) if (re.test(q)) filters.moods.push(m);
  for (const [re, c] of CUISINE_WORDS) if (re.test(q)) filters.cuisines.push(c);
  for (const [re, d] of DIET_WORDS) if (re.test(q)) filters.diets.push(d);
  const mins = q.match(/(\d+)\s*(min|minute|mins)/);
  if (mins) filters.maxTime = Number(mins[1]);
  if (has(q, /breakfast|nashta/)) filters.moods.push("light");

  if (has(q, /surprise|random|anything|kuch bhi|you choose|tum batao/)) {
    const r = pick(RECIPES.filter((x) => !x.allergens.some((a) => ctx.allergies.includes(a))));
    return {
      text: decorate(hi ? `Drumroll… 🥁 aaj banega ${r.name}! ${r.tagline}.` : `Drumroll… 🥁 today it's ${r.name}! ${r.tagline}.`, P, L, { closer: true }),
      cards: [{ type: "recipe", id: r.id }],
      effects: { setRecipe: r.id, setCooking: false, setStep: 0 },
      mood: "excited",
    };
  }

  const usePantry = has(q, /my (kitchen|pantry|fridge)|what (can|should) i (make|cook)|mere (paas|kitchen)/) && ings.length === 0;
  if (usePantry) {
    if (!ctx.pantry.length) return { text: hi ? "Aapka kitchen abhi khaali hai! My Kitchen mein ingredients add karo ya mujhe yahin bata do. 🧺" : "Your kitchen list is empty! Add ingredients in My Kitchen, or just tell me here — like \"I have eggs, onion and rice\". 🧺", cards: [], effects: {} };
    return recipesTurn(ctx, filters, ctx.pantry, hi ? `Aapke kitchen ke ${ctx.pantry.length} ingredients se:` : `From the ${ctx.pantry.length} ingredients in your kitchen:`, "Nothing fits yet — add a few more ingredients!");
  }

  if (ings.length) {
    const names = ings.map((i) => ingredient(i).name.toLowerCase());
    const list = names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names.at(-1)}` : names[0];
    return recipesTurn(ctx, filters, ings, hi ? `${list} se yeh bana sakte ho:` : `With ${list}, you can make these:`, hi ? "Inse kuch match nahi hua — ek do aur ingredients batao?" : "Hmm, nothing matches those yet — tell me a couple more ingredients?");
  }

  if (filters.moods.length || filters.cuisines.length || filters.diets.length || filters.maxTime) {
    const bits = [...filters.moods, ...filters.cuisines, ...filters.diets, filters.maxTime ? `under ${filters.maxTime} min` : ""].filter(Boolean).join(", ");
    return recipesTurn(ctx, filters, [], hi ? `${bits} ke liye mere picks:` : `My picks for ${bits}:`, "Nothing fits all of that — try loosening one thing?");
  }

  if (current) {
    const r = localMateReply(input, current, ctx.step);
    if (!r.text.startsWith("I'm running in offline mode")) return { text: r.text, cards: [], effects: {}, mood: "thinking" };
  }

  return { text: line(FALLBACK, P, L), cards: [], effects: {}, mood: "thinking" };
}
