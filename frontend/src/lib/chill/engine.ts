/**
 * Cook & Chill — pure logic shared by the client and the /api/mate/chill route.
 * No React, no browser APIs.
 */
import type { ActivityId, ChatReply, GuessQ, Joke, Level, Riddle, Song, StoryBeat, TriviaQ, WyrQ, WyrReaction } from "./types";
import { CHAT_STARTERS, GUESS, JOKES, RIDDLES, SONG_TEMPLATES, TRIVIA, WYR, WYR_FOLLOWUPS, WYR_REACTIONS } from "./library";

// ---------------------------------------------------------------- activities

export interface ActivityMeta {
  id: ActivityId;
  title: string;
  blurb: string;
  emoji: string;
  /** Don't start this activity with less than this much time left on the timer. */
  minSeconds: number;
  /** a soft accent used for the card glow */
  glow: string;
}

export const ACTIVITIES: ActivityMeta[] = [
  { id: "trivia", title: "Food Trivia", blurb: "Quick-fire questions on cuisines, spices and food history", emoji: "🧠", minSeconds: 60, glow: "#C9A227" },
  { id: "guess", title: "Guess the Ingredient", blurb: "Clue by clue — who am I?", emoji: "🔍", minSeconds: 75, glow: "#5FA36A" },
  { id: "wyr", title: "Would You Rather?", blurb: "Two tasty choices, zero right answers", emoji: "⚖️", minSeconds: 45, glow: "#D9774B" },
  { id: "jokes", title: "Cooking Jokes", blurb: "Short, silly and kitchen-safe", emoji: "😄", minSeconds: 30, glow: "#E0B04A" },
  { id: "facts", title: "Food Facts", blurb: "Surprising, true and tied to your dish", emoji: "💡", minSeconds: 30, glow: "#7FB5A8" },
  { id: "riddles", title: "Mini Riddles", blurb: "Little brain-teasers with hints", emoji: "🧩", minSeconds: 50, glow: "#9C6ADE" },
  { id: "chat", title: "Fun Conversations", blurb: "Just chat with Mate about food and life", emoji: "💬", minSeconds: 120, glow: "#F5DABF" },
  { id: "story", title: "Interactive Stories", blurb: "A tiny tale where you choose what happens", emoji: "📖", minSeconds: 240, glow: "#B04A55" },
  { id: "song", title: "Singing Activities", blurb: "Original, silly kitchen songs written for you", emoji: "🎤", minSeconds: 90, glow: "#E2442F" },
];
export const ACTIVITY_BY_ID = Object.fromEntries(ACTIVITIES.map((a) => [a.id, a])) as Record<ActivityId, ActivityMeta>;

// ---------------------------------------------------------------- timer intelligence

/** Below this many seconds no new activity starts — Mate wraps up and prepares the next step. */
export const WRAP_UP_SECONDS = 45;
/** Minimum time left for Mate to offer the invitation at all. */
export const INVITE_MIN_SECONDS = 60;

export type Tier = "long" | "medium" | "short" | "wrap";
export function tierFor(sec: number): Tier {
  if (sec < WRAP_UP_SECONDS) return "wrap";
  if (sec < 180) return "short";
  if (sec < 480) return "medium";
  return "long";
}

/** Activities that suit the time left, best first. */
export function recommended(sec: number): ActivityId[] {
  const t = tierFor(sec);
  if (t === "long") return ["story", "trivia", "chat", "song"];
  if (t === "medium") return ["trivia", "guess", "song", "riddles"];
  if (t === "short") return ["jokes", "facts", "wyr", "riddles"];
  return [];
}

export const canStart = (id: ActivityId, sec: number) => sec >= WRAP_UP_SECONDS && sec >= ACTIVITY_BY_ID[id].minSeconds;

/** How many story beats fit in the time left. */
export const storyBeatsFor = (sec: number) => (sec >= 480 ? 4 : sec >= 240 ? 3 : 2);

export const fmtLeft = (sec: number) => (sec >= 90 ? `${Math.round(sec / 60)} min` : `${Math.max(0, Math.round(sec))} sec`);

// ---------------------------------------------------------------- cooking safety

export type StepSafety = { level: "critical" | "active" | "passive"; reason?: string; note?: string };

const CRITICAL: [RegExp, string][] = [
  [/\bdeep[- ]?fr(y|ies|ying|ied)\b/i, "deep frying"],
  [/\b(heat|warm)(s|ing)?\s+(the\s+|some\s+|a\s+little\s+|remaining\s+)?(\w+\s+)?(oil|ghee)\b/i, "hot oil"],
  [/\bhot (oil|ghee)\b|\b(oil|ghee)\b[^.]*\b(shimmer|smok)/i, "hot oil"],
  [/\bhot (pan|tawa|kadai|kadhai|wok|skillet)\b|\bmelt (the |some )?(butter|ghee)\b/i, "a hot pan"],
  [/\b(pop|pops|popping|splutter|crackle|crackles|sizzle|sizzles)\b/i, "spluttering hot oil"],
  [/\b(tadka|tempering)\b/i, "pouring hot tempering"],
  [/\bfr(y|ies|ying)\b(?! pan)/i, "frying"],
  [/\bflip\b/i, "flipping in a hot pan"],
  [/\b(drain|strain)\b/i, "draining hot liquid"],
  [/\bpour\b[^.]*\b(boiling|hot)\b/i, "pouring boiling liquid"],
  [/\b(release|open)\b[^.]*\b(pressure|cooker)\b/i, "opening a pressure cooker"],
  [/\bflamb/i, "flambéing"],
  [/\b(take|remove|lift)\b[^.]*\b(out of|from) the (oven|grill|tandoor)\b/i, "handling a hot oven"],
  [/\bcaramel/i, "hot sugar"],
];
const KNIFE = /\b(chop|chopped|slice|dice|mince|julienne|cut|grate|peel)\b/i;
const ACTIVE: [RegExp, string][] = [
  [/\bstir[- ]?fr(y|ies|ying)\b/i, "stir-frying"],
  [/\bhigh heat\b/i, "cooking on high heat"],
  [/\b(stir|whisk)(ring)? (continuously|constantly|non-stop)\b|\bkeep stirring\b/i, "constant stirring"],
  [/\bscramble/i, "scrambling"],
];

/**
 * Is it OK to entertain during this step? Hazard checks run first. A knife word only blocks
 * entertainment when the step has no waiting period (when it does, the cutting happens after the timer).
 */
export function classifyStep(text: string, timer?: number | null): StepSafety {
  for (const [re, reason] of CRITICAL) if (re.test(text)) return { level: "critical", reason };
  if (!timer && KNIFE.test(text)) return { level: "critical", reason: "using a sharp knife" };
  for (const [re, reason] of ACTIVE) if (re.test(text)) return { level: "active", reason };
  if (!timer) return { level: "active", reason: "hands-on step" };
  if (/\bpressure[- ]?cook|whistle/i.test(text)) return { level: "passive", note: "Keep an ear out for the whistles." };
  return { level: "passive" };
}

// ---------------------------------------------------------------- answer matching

export const norm = (s: string) =>
  s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9\s]/g, " ")
    .replace(/\b(is it|it is|it s|its|i think|maybe|my answer is|the answer is|answer|a|an|the|um|uh|hmm)\b/g, " ")
    .replace(/\s+/g, " ").trim();

function lev(a: string, b: string) {
  if (Math.abs(a.length - b.length) > 2) return 99;
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

/** Forgiving answer check: exact, contained phrase, plural, or a small typo / mishearing. */
export function isMatch(input: string, answers: string[]) {
  const s = norm(input);
  if (!s) return false;
  const words = s.split(" ");
  return answers.map(norm).filter(Boolean).some((ans) => {
    const sing = ans.replace(/(es|s)$/, "");
    if (s === ans || s.includes(ans) || (sing.length > 3 && s.includes(sing))) return true;
    const tol = ans.length > 6 ? 2 : ans.length > 3 ? 1 : 0;
    if (!tol) return false;
    const n = ans.split(" ").length;
    for (let i = 0; i + n <= words.length; i++) if (lev(words.slice(i, i + n).join(" "), ans) <= tol) return true;
    return false;
  });
}

/** Maps "B", "option b", "bee" or the option's own text to an index. */
export function pickOption(input: string, options: string[]): number | null {
  const raw = input.toLowerCase().trim().replace(/[.!?]/g, "");
  const letter = raw.match(/^(?:option|answer|letter)?\s*([abcd])$/) ?? raw.match(/^(?:option|answer|letter)\s+([abcd])\b/);
  if (letter) return "abcd".indexOf(letter[1]);
  const spoken: Record<string, number> = { ay: 0, eh: 0, bee: 1, be: 1, see: 2, sea: 2, si: 2, dee: 3, de: 3 };
  if (raw in spoken) return spoken[raw];
  const ordinal = raw.match(/\b(first|second|third|fourth|last)\b/);
  if (ordinal) return ({ first: 0, second: 1, third: 2, fourth: 3, last: options.length - 1 } as Record<string, number>)[ordinal[1]];
  const i = options.findIndex((o) => isMatch(raw, [o]));
  return i >= 0 ? i : null;
}

/** Voice commands that work in every activity. */
export function voiceCommand(text: string): "stop" | "pause" | "next" | "hint" | "repeat" | "reveal" | null {
  const t = text.toLowerCase().trim();
  if (/^(stop|stop it|enough|that'?s enough|stop (the )?(game|story|song|fun)|back to cooking|end( it)?)\b/.test(t)) return "stop";
  if (/^(pause|hold on|wait|one (sec|second|minute))\b/.test(t)) return "pause";
  if (/^(skip|next( one| question)?|another( one)?|new one)\b/.test(t)) return "next";
  if (/^(hint|give me a hint|clue|another clue|help)\b/.test(t)) return "hint";
  if (/^(repeat|say (it|that) again|again)\b/.test(t)) return "repeat";
  if (/^(i give up|tell me|reveal|show (me )?(the )?answer)\b/.test(t)) return "reveal";
  return null;
}

/** Does a message in Fun Conversation sound like a real question about the food on the stove? */
export const COOKING_Q = /\b(how (much|long|many)|is it (done|ready|cooked)|should i|can i (add|use|skip|replace)|too (salty|spicy|thick|thin)|burn(ing|t)?|stuck|undercooked|raw|next step|what (do|should) i do|temperature|flame|heat)\b/i;

// ---------------------------------------------------------------- validation of AI output

const s = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");
const arr = (v: unknown) => (Array.isArray(v) ? v : []);
const lvl = (v: unknown): Level => (v === "easy" || v === "medium" || v === "hard" ? v : "medium");
const rid = (p: string) => `${p}-ai-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export function shuffleOptions(q: TriviaQ): TriviaQ {
  const order = q.options.map((_, i) => i).sort(() => Math.random() - 0.5);
  return { ...q, options: order.map((i) => q.options[i]), correct: order.indexOf(q.correct) };
}

export function validTrivia(raw: unknown): TriviaQ | null {
  const r = (raw ?? {}) as Record<string, unknown>;
  const question = s(r.question, 220);
  const options = arr(r.options).map((o) => s(o, 80)).filter(Boolean);
  const correct = Number(r.correctIndex);
  if (!question || options.length !== 4 || new Set(options.map(norm)).size !== 4) return null;
  if (!Number.isInteger(correct) || correct < 0 || correct > 3) return null;
  return { id: rid("t"), question, options, correct, explanation: s(r.explanation, 240) || "", difficulty: lvl(r.difficulty), topic: s(r.topic, 40) || undefined };
}

export function validGuess(raw: unknown): GuessQ | null {
  const r = (raw ?? {}) as Record<string, unknown>;
  const answer = s(r.answer, 40);
  const clues = arr(r.clues).map((c) => s(c, 160)).filter(Boolean).slice(0, 4);
  if (!answer || clues.length < 3) return null;
  // a clue must never give the answer away
  const key = norm(answer).split(" ").filter((w) => w.length > 2);
  if (clues.some((c) => key.some((k) => norm(c).split(" ").includes(k) || norm(c).includes(k.replace(/(es|s)$/, ""))))) return null;
  const aliases = Array.from(new Set([answer, ...arr(r.aliases).map((a) => s(a, 40))].filter(Boolean)));
  return { id: rid("g"), answer, aliases, clues, emoji: s(r.emoji, 8) || "🥄" };
}

export function validWyr(raw: unknown): WyrQ | null {
  const r = (raw ?? {}) as Record<string, unknown>;
  const a = s(r.optionA, 90), b = s(r.optionB, 90);
  if (!a || !b || norm(a) === norm(b)) return null;
  return { id: rid("w"), a, b, aEmoji: s(r.emojiA, 8) || undefined, bEmoji: s(r.emojiB, 8) || undefined };
}

export function validWyrReaction(raw: unknown): WyrReaction | null {
  const r = (raw ?? {}) as Record<string, unknown>;
  const reaction = s(r.reaction, 260);
  return reaction ? { reaction, followUp: s(r.followUp, 160) } : null;
}

export function validJoke(raw: unknown): Joke | null {
  const r = (raw ?? {}) as Record<string, unknown>;
  const setup = s(r.setup, 180), punchline = s(r.punchline, 180);
  return setup && punchline ? { id: rid("j"), setup, punchline, category: s(r.category, 30) || "kitchen" } : null;
}

export function validRiddle(raw: unknown): Riddle | null {
  const r = (raw ?? {}) as Record<string, unknown>;
  const riddle = s(r.riddle, 260), answer = s(r.answer, 40);
  if (!riddle || !answer) return null;
  if (norm(riddle).split(" ").includes(norm(answer))) return null;
  const aliases = Array.from(new Set([answer, ...arr(r.aliases).map((a) => s(a, 40))].filter(Boolean)));
  return { id: rid("r"), riddle, answer, aliases, hint: s(r.hint, 160) || "Think about what's in your kitchen.", difficulty: lvl(r.difficulty) };
}

export function validChat(raw: unknown): ChatReply | null {
  const r = (raw ?? {}) as Record<string, unknown>;
  const reply = s(r.reply, 600);
  return reply ? { reply, cookingQuestion: !!r.cookingQuestion } : null;
}

export function validStory(raw: unknown, mustEnd: boolean): StoryBeat | null {
  const r = (raw ?? {}) as Record<string, unknown>;
  const text = s(r.text, 900);
  if (!text) return null;
  const ending = mustEnd || !!r.ending;
  const choices = ending ? [] : arr(r.choices).map((c) => s(c, 70)).filter(Boolean).slice(0, 2);
  if (!ending && choices.length < 2) return null;
  return { title: s(r.title, 70) || "A Kitchen Tale", text, choices, ending };
}

export function validSong(raw: unknown): Song | null {
  const r = (raw ?? {}) as Record<string, unknown>;
  const lines = arr(r.lines).map((l) => s(l, 90)).filter(Boolean).slice(0, 12);
  if (lines.length < 4) return null;
  return { title: s(r.title, 60) || "A Kitchen Song", style: s(r.style, 30) || "jingle", lines };
}

// ---------------------------------------------------------------- library pickers (offline fallback)

const pickFresh = <T extends { id: string }>(pool: T[], recent: string[]) => {
  const fresh = pool.filter((x) => !recent.includes(x.id));
  const from = fresh.length ? fresh : pool;
  return from[Math.floor(Math.random() * from.length)];
};
const rand = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

export function libraryTrivia(level: Level, recent: string[]) {
  const pool = TRIVIA.filter((q) => q.difficulty === level);
  return shuffleOptions(pickFresh(pool.length ? pool : TRIVIA, recent));
}

/** Prefers ingredients from the recipe on the stove. */
export function libraryGuess(level: Level, recent: string[], recipeIngredientIds: string[]) {
  const inRecipe = GUESS.filter((g) => g.ingredientId && recipeIngredientIds.includes(g.ingredientId) && !recent.includes(g.id));
  const g = inRecipe.length && Math.random() < 0.75 ? rand(inRecipe) : pickFresh(GUESS, recent);
  // harder = fewer clues before the obvious one
  return level === "hard" ? { ...g, clues: g.clues.slice(0, 3) } : g;
}

export const libraryWyr = (recent: string[]) => pickFresh(WYR, recent);
export const libraryWyrReaction = (): WyrReaction => ({ reaction: rand(WYR_REACTIONS), followUp: rand(WYR_FOLLOWUPS) });
export const libraryJoke = (recent: string[]) => pickFresh(JOKES, recent);
export function libraryRiddle(level: Level, recent: string[]) {
  const pool = RIDDLES.filter((r) => r.difficulty === level);
  return pickFresh(pool.length >= 3 ? pool : RIDDLES, recent);
}
export function libraryChat(text: string, turn: number): ChatReply {
  if (COOKING_Q.test(text)) return { reply: "That sounds like a question about your food — tap “Ask Cooking Mate” and I'll answer it properly.", cookingQuestion: true };
  return { reply: `${turn === 0 ? "Love that!" : rand(["Ha, nice!", "Ooh, tell me more sometime.", "That's a great one.", "I like the way you think."])} ${CHAT_STARTERS[(turn + 1) % CHAT_STARTERS.length]}`, cookingQuestion: false };
}

const cap = (x: string) => x.charAt(0).toUpperCase() + x.slice(1);
/** Fills an original song template with the user's ingredients and dish. */
export function librarySong(style: string, dish: string, ingredients: string[]): Song {
  const t = SONG_TEMPLATES.find((x) => x.style === style) ?? rand(SONG_TEMPLATES);
  const pool = ingredients.filter((i) => i.split(" ").length <= 2);
  const A = cap(pool[0] ?? "Tomato"), B = cap(pool[1] ?? pool[0] ?? "Onion");
  const fill = (l: string) => l.replace(/\{A\}/g, A).replace(/\{B\}/g, B).replace(/\{D\}/g, dish);
  return { title: fill(t.title), style: t.style, lines: t.lines.map(fill) };
}

// ---------------------------------------------------------------- points & achievements

export const POINTS = {
  triviaCorrect: { easy: 10, medium: 15, hard: 20 } as Record<Level, number>,
  guessSolved: 15,
  riddleSolved: 15,
  hintCost: 4,
  participation: 2,
};

export interface ChillStats {
  points: number;
  triviaCorrect: number;
  triviaBestStreak: number;
  riddlesSolved: number;
  ingredientsGuessed: number;
  songs: number;
  stories: number;
  activitiesTried: ActivityId[];
  rounds: number;
}

export const EMPTY_STATS: ChillStats = { points: 0, triviaCorrect: 0, triviaBestStreak: 0, riddlesSolved: 0, ingredientsGuessed: 0, songs: 0, stories: 0, activitiesTried: [], rounds: 0 };

export const ACHIEVEMENTS: { id: string; title: string; emoji: string; desc: string; test: (s: ChillStats) => boolean }[] = [
  { id: "junior-chef", title: "Junior Chef", emoji: "🧑‍🍳", desc: "Finish your first Cook & Chill round", test: (s) => s.rounds >= 1 },
  { id: "food-genius", title: "Food Genius", emoji: "🧠", desc: "Answer 10 trivia questions correctly", test: (s) => s.triviaCorrect >= 10 },
  { id: "quiz-master", title: "Quiz Master", emoji: "🏆", desc: "Get 5 trivia answers right in a row", test: (s) => s.triviaBestStreak >= 5 },
  { id: "riddle-champion", title: "Riddle Champion", emoji: "🧩", desc: "Solve 5 riddles", test: (s) => s.riddlesSolved >= 5 },
  { id: "kitchen-explorer", title: "Kitchen Explorer", emoji: "🧭", desc: "Try 5 different activities", test: (s) => s.activitiesTried.length >= 5 },
  { id: "singing-chef", title: "Singing Chef", emoji: "🎤", desc: "Get Mate to write you a song", test: (s) => s.songs >= 1 },
];
