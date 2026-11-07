/**
 * Cooking-safety classifier — the same rules as the frontend (frontend/src/lib/chill/engine.ts),
 * enforced again on the server so entertainment can't be requested during a dangerous step.
 */
export type StepSafety = { level: 'critical' | 'active' | 'passive'; reason?: string; note?: string };

const CRITICAL: [RegExp, string][] = [
  [/\bdeep[- ]?fr(y|ies|ying|ied)\b/i, 'deep frying'],
  [/\b(heat|warm)(s|ing)?\s+(the\s+|some\s+|a\s+little\s+|remaining\s+)?(\w+\s+)?(oil|ghee)\b/i, 'hot oil'],
  [/\bhot (oil|ghee)\b|\b(oil|ghee)\b[^.]*\b(shimmer|smok)/i, 'hot oil'],
  [/\bhot (pan|tawa|kadai|kadhai|wok|skillet)\b|\bmelt (the |some )?(butter|ghee)\b/i, 'a hot pan'],
  [/\b(pop|pops|popping|splutter|crackle|crackles|sizzle|sizzles)\b/i, 'spluttering hot oil'],
  [/\b(tadka|tempering)\b/i, 'pouring hot tempering'],
  [/\bfr(y|ies|ying)\b(?! pan)/i, 'frying'],
  [/\bflip\b/i, 'flipping in a hot pan'],
  [/\b(drain|strain)\b/i, 'draining hot liquid'],
  [/\bpour\b[^.]*\b(boiling|hot)\b/i, 'pouring boiling liquid'],
  [/\b(release|open)\b[^.]*\b(pressure|cooker)\b/i, 'opening a pressure cooker'],
  [/\bflamb/i, 'flambéing'],
  [/\b(take|remove|lift)\b[^.]*\b(out of|from) the (oven|grill|tandoor)\b/i, 'handling a hot oven'],
  [/\bcaramel/i, 'hot sugar'],
];
const KNIFE = /\b(chop|chopped|slice|dice|mince|julienne|cut|grate|peel)\b/i;
const ACTIVE: [RegExp, string][] = [
  [/\bstir[- ]?fr(y|ies|ying)\b/i, 'stir-frying'],
  [/\bhigh heat\b/i, 'cooking on high heat'],
  [/\b(stir|whisk)(ring)? (continuously|constantly|non-stop)\b|\bkeep stirring\b/i, 'constant stirring'],
  [/\bscramble/i, 'scrambling'],
  [/\bsaut[eé](e?d|ing)?(?![a-z])/i, 'sautéing (needs regular stirring)'],
];

export function classifyStep(text: string, timer?: number | null): StepSafety {
  for (const [re, reason] of CRITICAL) if (re.test(text)) return { level: 'critical', reason };
  if (!timer && KNIFE.test(text)) return { level: 'critical', reason: 'using a sharp knife' };
  for (const [re, reason] of ACTIVE) if (re.test(text)) return { level: 'active', reason };
  if (!timer) return { level: 'active', reason: 'hands-on step' };
  if (/\bpressure[- ]?cook|whistle/i.test(text)) return { level: 'passive', note: 'Keep an ear out for the whistles.' };
  return { level: 'passive' };
}

export const WRAP_UP_SECONDS = 45;
export const MIN_SECONDS: Record<string, number> = { trivia: 60, guess: 75, wyr: 45, 'wyr-react': 0, jokes: 30, riddles: 50, chat: 120, story: 240, song: 90 };
