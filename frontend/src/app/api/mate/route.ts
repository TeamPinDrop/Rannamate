import { NextResponse } from "next/server";
import { RECIPES, RECIPE_BY_ID } from "@/lib/data/recipes";
import { ingredient } from "@/lib/data/ingredients";
import { conflicts, GEMINI_SCHEMA, normaliseRecipe, type AiRecipe, type AiReply } from "@/lib/mate/ai-schema";

/**
 * Server-side bridge to a generative model ("Mate's own brain").
 * Keys live in .env.local and never reach the browser.
 *   GEMINI_API_KEY  (preferred)  — optional GEMINI_MODEL
 *   ANTHROPIC_API_KEY            — optional ANTHROPIC_MODEL
 * Without a key it answers 501 and the UI falls back to the offline brain.
 * In Phase 3 this logic moves behind NestJS → FastAPI unchanged.
 */
export const dynamic = "force-dynamic";

// Fast, reliable model first; others are fallbacks. A model that is slow or unreachable is skipped.
const GEMINI_MODELS = ["gemini-3.6-flash", "gemini-3.5-flash-lite", "gemini-flash-latest", "gemini-3.8-flash"];
const FIRST_TRY_MS = 18_000;
/** Models that told us their quota is used up are skipped until this time (ms). */
const cooledUntil = new Map<string, number>();
const NEXT_TRY_MS = 10_000;
/** Whole request must finish well before the browser gives up (35 s). */
const BUDGET_MS = 28_000;

interface Body {
  messages: { who: "user" | "mate"; text: string }[];
  recipeId: string | null;
  aiRecipe?: AiRecipe | null; // when the current recipe was invented by Mate
  step: number;
  cooking: boolean;
  pantry: string[];
  persona: "mild" | "masala" | "chatpata";
  lang: "en" | "hinglish";
  allergies: string[];
  diets: string[];
}

const PERSONA_PROMPT = {
  mild: "Calm, warm and clear, like a patient home-cooking teacher. Minimal emoji.",
  masala: "Friendly, upbeat and playful, like a fun friend who loves cooking. A couple of emoji are fine.",
  chatpata: "Extra chatpata: dramatic, funny, high-energy Indian street-food-vendor energy with food puns and emoji (🔥🌶️🍳). Still genuinely useful.",
};

function describeCurrent(b: Body) {
  if (b.aiRecipe) {
    const r = b.aiRecipe;
    return `CURRENT RECIPE (invented by you earlier): ${r.name}, serves ${r.servings}. ${b.cooking ? `User is COOKING NOW, on step ${b.step + 1} of ${r.steps.length}.` : "Not cooking yet."}
Ingredients: ${r.ingredients.map((i) => `${i.name} ${i.quantity} ${i.unit}${i.optional ? " (optional)" : ""}`).join("; ")}
Steps:\n${r.steps.map((s, i) => `${i + 1}. ${s.text}`).join("\n")}`;
  }
  const r = b.recipeId ? RECIPE_BY_ID[b.recipeId] : null;
  if (!r) return "No recipe selected yet.";
  return `CURRENT RECIPE: ${r.name} (catalog id ${r.id}), serves ${r.servings}. ${b.cooking ? `User is COOKING NOW, on step ${b.step + 1} of ${r.steps.length}.` : "Not cooking yet."}
Ingredients: ${r.ingredients.map((i) => `${ingredient(i.ingredientId).name} ${i.quantity} ${i.unit}${i.optional ? " (optional)" : ""}`).join("; ")}
Steps:\n${r.steps.map((s, i) => `${i + 1}. ${s.text}${s.timer ? ` [~${s.timer}s]` : ""}`).join("\n")}
Known swaps: ${r.substitutions.map((s) => `${ingredient(s.ingredientId).name} → ${s.options.join(" / ")}`).join("; ")}`;
}

function systemPrompt(b: Body) {
  const catalog = RECIPES.map(
    (r) => `${r.id} | ${r.name} | ${r.cuisine} | ${r.prepMin + r.cookMin} min | needs: ${r.ingredients.filter((i) => !i.optional).map((i) => ingredient(i.ingredientId).name).join(", ")}`,
  ).join("\n");

  return `You are "Mate", the talking cooking companion inside the RANNAMATE app. You are a creative, experienced home cook who knows Indian and world cuisines deeply.
Personality: ${PERSONA_PROMPT[b.persona]}
Language for "reply": ${b.lang === "hinglish" ? "casual Hinglish (Hindi in Roman script mixed with English)" : "English (an occasional Hindi food word is fine)"}. Recipe names/steps in "created" may be in simple English.
"reply" is read aloud: 1-4 short sentences, max ~70 words, no markdown, no lists.

USER CONTEXT
Pantry: ${b.pantry.length ? b.pantry.map((i) => ingredient(i).name).join(", ") : "unknown — use what they tell you in chat"}.
HARD SAFETY RULES: never use these allergens in any form: ${b.allergies.join(", ") || "none"}. Diet: ${b.diets.join(", ") || "no restriction"}. Always give safe cooking guidance (cook meat/eggs through, warn about hot oil).

APP CATALOG (id | name | cuisine | time | needs):
${catalog}

${describeCurrent(b)}

HOW TO ANSWER (respond with JSON matching the schema):
- When the user lists ingredients or a craving: if a catalog recipe fits well (they have almost everything), put its id in "suggest". If nothing fits well — or they ask for something new/creative — INVENT a real, tasty, cookable recipe in "created" that mainly uses THEIR ingredients plus common pantry staples (salt, oil, basic spices, lemon). Prefer authentic dishes when they exist (e.g. onion + cucumber + puffed rice → Jhal Muri / Bhel). Realistic quantities and times; 4-8 clear steps; set timerSeconds on steps that involve waiting.
- In "reply" say what you made and why it suits their ingredients; mention anything optional they're missing.
- "focus": a catalog id when discussing one catalog recipe.
- "startCooking": true when they want to start cooking (works for catalog or created recipes). Then also set goToStep 1 and read step 1 in reply.
- During cooking, for next/back/repeat set "goToStep" (1-based) and include that step's text in reply.
- Timers → timerSeconds + timerLabel. Substitutions → swapFrom + swapOptions. "for N people" → servings N.
- Off-topic questions: answer in one line and steer back to food.`;
}

async function callGemini(key: string, system: string, history: Body["messages"], hot: boolean, extra?: string) {
  const models = process.env.GEMINI_MODEL ? [process.env.GEMINI_MODEL, ...GEMINI_MODELS] : GEMINI_MODELS;
  const deadline = Date.now() + BUDGET_MS;
  const contents = history.map((m) => ({ role: m.who === "user" ? "user" : "model", parts: [{ text: m.text }] }));
  if (extra) contents.push({ role: "user", parts: [{ text: extra }] });
  let lastErr = "ai_error";
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const usable = models.filter((m) => (cooledUntil.get(m) ?? 0) < Date.now());
  for (const [i, model] of (usable.length ? usable : models).entries()) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const left = Math.min(deadline - Date.now(), i === 0 && attempt === 0 ? FIRST_TRY_MS : NEXT_TRY_MS);
      if (left < 3000) throw new Error(lastErr === "ai_error" ? "Gemini took too long to answer" : lastErr);
      const t0 = Date.now();
      let res: Response;
      try {
        res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
          method: "POST",
          signal: AbortSignal.timeout(left),
          headers: { "Content-Type": "application/json", "x-goog-api-key": key },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: system }] },
            contents,
            generationConfig: {
              temperature: hot ? 1 : 0.8,
              maxOutputTokens: 4096,
              responseMimeType: "application/json",
              responseSchema: GEMINI_SCHEMA,
              // Gemini 3.x "thinks" before answering; a low level keeps replies fast for a voice chat
              ...(model.startsWith("gemini-3") && attempt === 0 ? { thinkingConfig: { thinkingLevel: "low" } } : {}),
            },
          }),
        });
      } catch (e) {
        lastErr = e instanceof Error && e.name === "TimeoutError" ? "Gemini took too long to answer" : `Can't reach Gemini (${e instanceof Error ? e.message : "network error"})`;
        console.error(`[mate] ${model}: ${lastErr} — trying the next model`);
        break; // next model
      }
      const data = await res.json().catch(() => ({}));
      console.log(`[mate] ${model} → HTTP ${res.status} in ${Date.now() - t0} ms`);
      if (res.ok) {
        const text = (data.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? "").join("");
        if (text.trim()) return { text, model };
        lastErr = "Gemini returned an empty answer";
        break;
      }
      lastErr = data?.error?.message ?? `HTTP ${res.status}`;
      console.error(`[mate] ${model} error: ${lastErr}`);
      // a bad key won't work on any model — stop right away
      if ((res.status === 401 || res.status === 403 || res.status === 400) && !/not found|not supported|no longer available|model/i.test(lastErr)) throw new Error(lastErr);
      // daily/minute quota used up → skip this model for a while instead of retrying it on every message
      if (res.status === 429 && /quota|per day|limit/i.test(lastErr)) {
        const wait = /per ?day|PerDay|daily/i.test(lastErr) ? 60 * 60_000 : 60_000;
        cooledUntil.set(model, Date.now() + wait);
        console.log(`[mate] ${model} quota reached — skipping it for ${wait / 60_000} min`);
        break;
      }
      // overloaded / rate-limited → one quick retry on the same model, then move on
      if ((res.status === 503 || res.status === 429 || res.status === 500) && attempt === 0) { await sleep(1200); continue; }
      break;
    }
  }
  throw new Error(lastErr);
}

async function callClaude(key: string, system: string, history: Body["messages"], extra?: string) {
  const model = process.env.ANTHROPIC_MODEL || "claude-haiku-5-5";
  const msgs = history.map((m) => ({ role: m.who === "user" ? "user" : "assistant", content: m.text }));
  while (msgs.length && msgs[0].role !== "user") msgs.shift();
  if (extra) msgs.push({ role: "user", content: extra });
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    signal: AbortSignal.timeout(BUDGET_MS),
    headers: { "Content-Type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model,
      max_tokens: 2048,
      system: `${system}\n\nRespond with ONLY a JSON object (no prose around it) with these keys: reply, suggest, focus, startCooking, goToStep, timerSeconds, timerLabel, swapFrom, swapOptions, servings, created{name,emoji,tagline,cuisine,difficulty,prepMinutes,cookMinutes,servings,ingredients[{name,quantity,unit,optional,note}],steps[{text,timerSeconds}],tip}.`,
      messages: msgs,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message ?? `HTTP ${res.status}`);
  return { text: (data.content ?? []).map((c: { text?: string }) => c.text ?? "").join(""), model };
}

function parse(text: string): AiReply {
  if (!text.trim()) return { reply: "Hmm, my brain went blank for a second — could you say that again?" };
  try {
    const json = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
    const o = JSON.parse(json) as AiReply;
    if (typeof o.reply === "string") return o;
  } catch { /* fall through */ }
  return { reply: text.replace(/[{}"]/g, "").slice(0, 600) };
}

export async function POST(req: Request) {
  const gemini = process.env.GEMINI_API_KEY?.trim();
  const anthropic = process.env.ANTHROPIC_API_KEY?.trim();
  if (!gemini && !anthropic) return NextResponse.json({ error: "no_ai_key" }, { status: 501 });

  let body: Body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "bad_request" }, { status: 400 }); }
  body.allergies ??= [];
  body.diets ??= [];
  const history = (body.messages ?? []).slice(-14).filter((m) => m.text?.trim());
  const system = systemPrompt(body);
  const ask = (extra?: string) => (gemini ? callGemini(gemini, system, history, body.persona === "chatpata", extra) : callClaude(anthropic!, system, history, extra));

  const started = Date.now();
  try {
    let { text, model } = await ask();
    let out = parse(text);
    let created = normaliseRecipe(out.created);

    // safety net: never show a recipe that breaks an allergy/diet — ask once more, then drop it
    let problems = created ? conflicts(created, body.allergies, body.diets) : [];
    if (problems.length && Date.now() - started > 9000) {
      created = null;
      out.reply = "That idea used something you're allergic to, so I've left it out — ask me again for a safe version!";
      problems = [];
    }
    if (problems.length) {
      ({ text, model } = await ask(`Your recipe used ${problems.join(", ")}, which this user must avoid. Create a different recipe without them.`));
      out = parse(text);
      created = normaliseRecipe(out.created);
      problems = created ? conflicts(created, body.allergies, body.diets) : [];
      if (problems.length) {
        created = null;
        out.reply = "I couldn't make a version that's safe for your allergies with those ingredients — tell me a few more and I'll try again!";
      }
    }

    const suggest = (out.suggest ?? []).filter((id) => RECIPE_BY_ID[id]).slice(0, 3);
    const focus = out.focus && RECIPE_BY_ID[out.focus] ? out.focus : undefined;
    return NextResponse.json({
      reply: out.reply,
      suggest,
      focus,
      startCooking: !!out.startCooking,
      goToStep: Number(out.goToStep) || 0,
      timerSeconds: Math.min(7200, Math.max(0, Number(out.timerSeconds) || 0)),
      timerLabel: out.timerLabel || "Timer",
      swapFrom: out.swapFrom || undefined,
      swapOptions: (out.swapOptions ?? []).slice(0, 4),
      servings: Math.min(20, Math.max(0, Number(out.servings) || 0)),
      created,
      provider: gemini ? "gemini" : "claude",
      model,
    } satisfies AiReply & { provider: string; model: string });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "ai_unreachable";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

export async function GET() {
  const provider = process.env.GEMINI_API_KEY?.trim() ? "gemini" : process.env.ANTHROPIC_API_KEY?.trim() ? "claude" : null;
  return NextResponse.json({ live: !!provider, provider });
}
