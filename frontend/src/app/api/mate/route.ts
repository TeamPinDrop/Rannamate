import { NextResponse } from "next/server";
import { RECIPES, RECIPE_BY_ID } from "@/lib/data/recipes";
import { ingredient } from "@/lib/data/ingredients";

/**
 * Server-side proxy to a generative model. Keys are read from .env.local and never
 * reach the browser. Supports Google Gemini (GEMINI_API_KEY) or Anthropic Claude
 * (ANTHROPIC_API_KEY). With no key it returns 501 and the UI uses the built-in brain.
 * In Phase 3 this moves behind the NestJS backend unchanged.
 */
export const dynamic = "force-dynamic";

interface Body {
  messages: { who: "user" | "mate"; text: string }[];
  recipeId: string | null;
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
  chatpata: "Extra chatpata: dramatic, funny, high-energy Indian street-food-vendor energy, food puns and emoji (🔥🌶️🍳). Still genuinely useful.",
};

function systemPrompt(b: Body) {
  const catalog = RECIPES.map(
    (r) => `${r.id} | ${r.name} | ${r.cuisine} | ${r.prepMin + r.cookMin} min | ${r.difficulty} | moods: ${r.moods.join(",")} | diets: ${r.diets.join(",")} | allergens: ${r.allergens.join(",") || "none"} | needs: ${r.ingredients.filter((i) => !i.optional).map((i) => ingredient(i.ingredientId).name).join(", ")}`,
  ).join("\n");
  const r = b.recipeId ? RECIPE_BY_ID[b.recipeId] : null;
  const current = r
    ? `CURRENT RECIPE: ${r.name} (${r.id}), serves ${r.servings}. ${b.cooking ? `User is COOKING NOW, on step ${b.step + 1} of ${r.steps.length}.` : "Not cooking yet."}
Ingredients: ${r.ingredients.map((i) => `${ingredient(i.ingredientId).name} ${i.quantity} ${i.unit}${i.optional ? " (optional)" : ""}`).join("; ")}
Steps:\n${r.steps.map((s, i) => `${i + 1}. ${s.text}${s.timer ? ` [~${s.timer}s]` : ""}`).join("\n")}
Known swaps: ${r.substitutions.map((s) => `${ingredient(s.ingredientId).name} → ${s.options.join(" / ")}`).join("; ")}`
    : "No recipe selected yet.";

  return `You are "Mate", the voice cooking companion inside the RANNAMATE app. Personality: ${PERSONA_PROMPT[b.persona]}
Language: ${b.lang === "hinglish" ? "Reply in casual Hinglish (Hindi words in Roman script mixed with English)." : "Reply in English (an occasional Hindi word is fine)."}
Your replies are also read aloud, so keep them SHORT: 1–4 sentences, max ~80 words, no markdown, no bullet lists.

User pantry: ${b.pantry.length ? b.pantry.map((i) => ingredient(i).name).join(", ") : "unknown"}.
HARD RULES: never suggest anything containing these allergens: ${b.allergies.join(", ") || "none"}. Diet: ${b.diets.join(", ") || "no restriction"}.
Only recommend recipes from this catalog (id | name | cuisine | time | difficulty | moods | diets | allergens | needs):
${catalog}

${current}

UI TAGS — append them at the END of your reply when useful; the app renders them as interactive cards. Use exact ids only.
[[recipes:id1,id2,id3]] suggest up to 3 recipes
[[recipe:id]] focus on one recipe (shows its card)
[[cook:id]] start the step-by-step cook-along at step 1 (use when the user wants to start cooking)
[[step:N]] jump to step N of the current recipe (use for next/previous/repeat during cooking; also say the step text)
[[timer:SECONDS|label]] start a countdown
[[swap:ingredient name|option 1;option 2]] show a substitution card
[[serves:id|N]] show scaled ingredient quantities for N people
If the user asks about something unrelated to food or cooking, answer briefly and steer back to cooking.`;
}

export async function POST(req: Request) {
  const gemini = process.env.GEMINI_API_KEY;
  const anthropic = process.env.ANTHROPIC_API_KEY;
  if (!gemini && !anthropic) return NextResponse.json({ error: "no_ai_key" }, { status: 501 });

  let body: Body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "bad_request" }, { status: 400 }); }
  const history = body.messages.slice(-12).filter((m) => m.text.trim());
  const system = systemPrompt(body);

  try {
    if (gemini) {
      const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": gemini },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: history.map((m) => ({ role: m.who === "user" ? "user" : "model", parts: [{ text: m.text }] })),
          generationConfig: { temperature: body.persona === "chatpata" ? 1 : 0.7, maxOutputTokens: 600 },
        }),
      });
      const data = await res.json();
      if (!res.ok) return NextResponse.json({ error: data?.error?.message ?? "ai_error" }, { status: 502 });
      const text = (data.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? "").join("");
      return NextResponse.json({ text, provider: "gemini" });
    }
    const model = process.env.ANTHROPIC_MODEL || "claude-haiku-5-5";
    const msgs = history.map((m) => ({ role: m.who === "user" ? "user" : "assistant", content: m.text }));
    while (msgs.length && msgs[0].role !== "user") msgs.shift();
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": anthropic!, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model, max_tokens: 600, system, messages: msgs }),
    });
    const data = await res.json();
    if (!res.ok) return NextResponse.json({ error: data?.error?.message ?? "ai_error" }, { status: 502 });
    const text = (data.content ?? []).map((c: { text?: string }) => c.text ?? "").join("");
    return NextResponse.json({ text, provider: "claude" });
  } catch {
    return NextResponse.json({ error: "ai_unreachable" }, { status: 502 });
  }
}

export async function GET() {
  const provider = process.env.GEMINI_API_KEY ? "gemini" : process.env.ANTHROPIC_API_KEY ? "claude" : null;
  return NextResponse.json({ live: !!provider, provider });
}
