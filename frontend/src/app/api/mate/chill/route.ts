import { NextResponse } from "next/server";
import { callClaude, callGemini, extractJson, llmProvider } from "@/lib/mate/llm-server";
import {
  shuffleOptions, storyBeatsFor, validChat, validGuess, validJoke, validRiddle, validSong, validStory, validTrivia, validWyr, validWyrReaction,
} from "@/lib/chill/engine";
import type { ChillContext, ChillRequest } from "@/lib/chill/types";

/**
 * Cook & Chill — Mate's entertainment brain while food is cooking.
 *   GET  /api/mate/chill            → { live, provider }
 *   POST /api/mate/chill  (ChillRequest) → { source: "ai", data } | 501 no key | 422 invalid AI output | 502 AI unreachable
 * The client falls back to the curated library (and labels it) on any non-200.
 * Food Facts are served only from the curated library, so no facts are ever invented.
 * The AI here never controls the cooking timer and never declares food "done".
 */
export const dynamic = "force-dynamic";

const PERSONA = {
  mild: "calm, warm and gentle; minimal emoji",
  masala: "friendly, upbeat and playful; a couple of emoji are fine",
  chatpata: "dramatic, funny, high-energy street-food-vendor energy with food puns; still kind",
};

const clip = (v: unknown, n: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, n);

function cleanCtx(c: Partial<ChillContext> | undefined): ChillContext {
  const list = (v: unknown, n: number) => (Array.isArray(v) ? v.map((x) => clip(x, 40)).filter(Boolean).slice(0, n) : []);
  return {
    recipeName: clip(c?.recipeName, 80) || "a home-cooked dish",
    cuisine: clip(c?.cuisine, 30),
    stepText: clip(c?.stepText, 300),
    nextStepText: c?.nextStepText ? clip(c.nextStepText, 300) : null,
    remainingSec: Math.max(0, Math.min(7200, Number(c?.remainingSec) || 0)),
    ingredients: list(c?.ingredients, 20),
    pantry: list(c?.pantry, 30),
    persona: c?.persona === "mild" || c?.persona === "chatpata" ? c.persona : "masala",
    lang: c?.lang === "hinglish" ? "hinglish" : "en",
    allergies: list(c?.allergies, 10),
  };
}

function system(c: ChillContext) {
  return `You are "Mate", the friendly AI cooking companion inside the RANNAMATE app, now in COOK & CHILL mode: the user's food is cooking and they're waiting, so you keep them entertained for a few minutes.
Personality: ${PERSONA[c.persona]}.
Language: ${c.lang === "hinglish" ? "casual Hinglish (Hindi in Roman script mixed with English)" : "English (an occasional Hindi food word is fine)"}.
Everything you write is shown on screen and may be read aloud: short, plain text, no markdown.

CONTEXT
Cooking: ${c.recipeName}${c.cuisine ? ` (${c.cuisine})` : ""}. Current step: "${c.stepText}". Time left on the user's timer: about ${Math.max(1, Math.round(c.remainingSec / 60))} min.
Ingredients in this recipe: ${c.ingredients.join(", ") || "unknown"}. Pantry: ${c.pantry.join(", ") || "unknown"}.

RULES
- Family-friendly. No offensive, mean or adult humour; no stereotypes about any region, religion, caste, gender or nationality.
- Facts (trivia answers, explanations, ingredient clues) must be well-established and verifiable. If you're not sure something is true, pick a different question.
- Never reproduce, quote or parody existing songs, lyrics, poems, books or films, and never imitate a specific real artist. Everything creative must be original.
- You never control the cooking timer and you never tell the user the food is done — they must always check it themselves.
- Respond with JSON matching the requested schema only.`;
}

const STR = { type: "STRING" } as const;
const ARR_STR = { type: "ARRAY", items: STR } as const;
const SCHEMAS: Record<ChillRequest["activity"], { schema: object; keys: string }> = {
  trivia: { keys: "question, options[4], correctIndex (0-3), explanation, difficulty, topic", schema: { type: "OBJECT", properties: { question: STR, options: ARR_STR, correctIndex: { type: "INTEGER" }, explanation: STR, difficulty: { type: "STRING", enum: ["easy", "medium", "hard"] }, topic: STR }, required: ["question", "options", "correctIndex", "explanation"] } },
  guess: { keys: "answer, aliases[], clues[3], emoji", schema: { type: "OBJECT", properties: { answer: STR, aliases: ARR_STR, clues: ARR_STR, emoji: STR }, required: ["answer", "aliases", "clues", "emoji"] } },
  wyr: { keys: "optionA, optionB, emojiA, emojiB", schema: { type: "OBJECT", properties: { optionA: STR, optionB: STR, emojiA: STR, emojiB: STR }, required: ["optionA", "optionB"] } },
  "wyr-react": { keys: "reaction, followUp", schema: { type: "OBJECT", properties: { reaction: STR, followUp: STR }, required: ["reaction"] } },
  jokes: { keys: "setup, punchline, category", schema: { type: "OBJECT", properties: { setup: STR, punchline: STR, category: STR }, required: ["setup", "punchline"] } },
  riddles: { keys: "riddle, answer, aliases[], hint, difficulty", schema: { type: "OBJECT", properties: { riddle: STR, answer: STR, aliases: ARR_STR, hint: STR, difficulty: { type: "STRING", enum: ["easy", "medium", "hard"] } }, required: ["riddle", "answer", "aliases", "hint"] } },
  chat: { keys: "reply, cookingQuestion (boolean)", schema: { type: "OBJECT", properties: { reply: STR, cookingQuestion: { type: "BOOLEAN" } }, required: ["reply", "cookingQuestion"] } },
  story: { keys: "title, text, choices[2], ending (boolean)", schema: { type: "OBJECT", properties: { title: STR, text: STR, choices: ARR_STR, ending: { type: "BOOLEAN" } }, required: ["title", "text", "choices", "ending"] } },
  song: { keys: "title, style, lines[]", schema: { type: "OBJECT", properties: { title: STR, style: STR, lines: ARR_STR }, required: ["title", "style", "lines"] } },
};

const avoid = (recent: string[]) => (recent.length ? ` Do NOT repeat any of these recent items: ${recent.slice(0, 15).map((r) => `"${clip(r, 90)}"`).join("; ")}.` : "");

/** The single user turn that asks for this activity. */
function instruction(r: ChillRequest, c: ChillContext): { text: string; temperature: number; history?: { who: "user" | "mate"; text: string }[] } {
  switch (r.activity) {
    case "trivia":
      return { temperature: 0.9, text: `Ask ONE ${r.difficulty} multiple-choice food trivia question. Vary the topic among Indian cuisine, world cuisines, food history, ingredients, cooking techniques, spices and herbs, famous dishes and food traditions — sometimes about ${c.recipeName} or its ingredients. Exactly 4 short options, exactly one correct, correctIndex is its 0-based position. One-sentence explanation.${avoid(r.recent)}` };
    case "guess":
      return { temperature: 0.9, text: `Play "Guess the Ingredient" (${r.difficulty}). Choose ONE common ingredient${c.ingredients.length ? `, preferably one of: ${c.ingredients.join(", ")}` : ""}. Write exactly 3 clues in first person ("I am…"), from vague to obvious. The clues must NOT contain the ingredient's name or any of its aliases. aliases: other common names, including Hindi names. emoji: one emoji for it.${avoid(r.recent)}` };
    case "wyr":
      return { temperature: 1, text: `Ask ONE playful food-themed "Would you rather" question as two options (each under 10 words, no "would you rather" prefix). Make it fit someone who likes ${c.cuisine || "all kinds of"} food.${avoid(r.recent)}` };
    case "wyr-react":
      return { temperature: 1, text: `The user was asked "Would you rather: ${clip(r.question.a, 90)} OR ${clip(r.question.b, 90)}" and picked "${clip(r.picked, 90)}". Give a playful 1-2 sentence reaction to their choice, and a short light follow-up question.` };
    case "jokes":
      return { temperature: 1, text: `Tell ONE short, clean, original-feeling cooking or food joke (setup + punchline), ideally playing on ${c.recipeName} or its ingredients.${avoid(r.recent)}` };
    case "riddles":
      return { temperature: 0.9, text: `Ask ONE short ${r.difficulty} food riddle whose answer is a food or kitchen item. The riddle must not contain the answer. Include aliases (other names, Hindi names) and one helpful hint.${avoid(r.recent)}` };
    case "chat": {
      const history = r.messages.slice(-12).map((m) => ({ who: m.who, text: clip(m.text, 500) })).filter((m) => m.text);
      return { temperature: 0.9, history, text: "Reply naturally to the user's last message as a warm, funny friend — 1-3 sentences. Don't push games or quizzes; just chat. You may ask a light question back. If their message is a real question about the food they're cooking right now (doneness, salt, heat, what to do next), set cookingQuestion true, answer briefly and safely, and remind them to check the food themselves." };
    }
    case "story": {
      const beat = r.beats.length + 1;
      const max = storyMax(r, c);
      const mustEnd = beat >= max;
      const so = r.beats.map((b, i) => `Part ${i + 1}: ${clip(b.text, 600)}${b.choice ? `\nThe user chose: ${clip(b.choice, 80)}` : ""}`).join("\n");
      return {
        temperature: 1,
        text: `${r.beats.length ? `Continue this short interactive story.\n${so}\n` : `Start a short, original, funny interactive kitchen story about: ${clip(r.prompt, 120) || `an adventure involving ${c.ingredients.slice(0, 3).join(", ") || "a curious vegetable"}`}.`}
This is part ${beat} of ${max}. Write 2-4 sentences (under 90 words). ${mustEnd ? "This part MUST bring the story to a clear, satisfying ending: set ending true and choices []." : "End on a small decision: give exactly 2 short choices (under 8 words each), ending false."} Keep the same title.`,
      };
    }
    case "song":
      return { temperature: 1, text: `Write a SHORT, ORIGINAL, funny ${clip(r.style, 30) || "kitchen jingle"} about: ${clip(r.topic, 120) || c.recipeName}. Mention ${c.recipeName}${c.ingredients.length ? ` and some of: ${c.ingredients.slice(0, 6).join(", ")}` : ""}. 4-8 short lines, simple rhymes, singable. Do not reuse any existing song's lyrics, tune references or structure, and don't name real artists.` };
  }
}

const storyMax = (r: Extract<ChillRequest, { activity: "story" }>, c: ChillContext) => Math.max(2, Math.min(4, Number(r.maxBeats) || storyBeatsFor(c.remainingSec)));

function validate(r: ChillRequest, c: ChillContext, raw: unknown) {
  switch (r.activity) {
    case "trivia": { const q = validTrivia(raw); return q ? shuffleOptions(q) : null; }
    case "guess": return validGuess(raw);
    case "wyr": return validWyr(raw);
    case "wyr-react": return validWyrReaction(raw);
    case "jokes": return validJoke(raw);
    case "riddles": return validRiddle(raw);
    case "chat": return validChat(raw);
    case "story": return validStory(raw, r.beats.length + 1 >= storyMax(r, c));
    case "song": return validSong(raw);
  }
}

export async function POST(req: Request) {
  const p = llmProvider();
  if (!p) return NextResponse.json({ error: "no_ai_key" }, { status: 501 });

  let r: ChillRequest;
  try { r = await req.json(); } catch { return NextResponse.json({ error: "bad_request" }, { status: 400 }); }
  if (!r || typeof r !== "object" || !(r.activity in SCHEMAS)) return NextResponse.json({ error: "unknown_activity" }, { status: 400 });
  const c = cleanCtx(r.ctx);
  if ("recent" in r) r.recent = Array.isArray(r.recent) ? r.recent.map((x) => clip(x, 120)).slice(0, 20) : [];
  if (r.activity === "chat" && (!Array.isArray(r.messages) || !r.messages.length)) return NextResponse.json({ error: "no_messages" }, { status: 400 });
  if (r.activity === "story" && !Array.isArray(r.beats)) r.beats = [];

  const ins = instruction(r, c);
  // one user turn carries the instruction; in a chat it rides along with the user's last message
  const history = [...(ins.history ?? [])];
  const last = history[history.length - 1];
  if (last?.who === "user") history[history.length - 1] = { ...last, text: `${last.text}\n\n[${ins.text}]` };
  else history.push({ who: "user", text: ins.text });
  const { schema, keys } = SCHEMAS[r.activity];
  try {
    const out = p.kind === "gemini"
      ? await callGemini(p.key, system(c), history, { schema, temperature: ins.temperature, maxTokens: 1024, budgetMs: 20_000 })
      : await callClaude(p.key, system(c), history, { jsonHint: `Respond with ONLY a JSON object with keys: ${keys}.`, maxTokens: 800, temperature: ins.temperature, budgetMs: 20_000 });
    const data = validate(r, c, extractJson(out.text));
    if (!data) {
      console.error(`[chill] ${r.activity}: model output failed validation`);
      return NextResponse.json({ error: "invalid_ai_output" }, { status: 422 });
    }
    return NextResponse.json({ source: "ai", data, provider: p.kind, model: out.model });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "ai_unreachable" }, { status: 502 });
  }
}

export async function GET() {
  const p = llmProvider();
  return NextResponse.json({ live: !!p, provider: p?.kind ?? null });
}
