/** Cook & Chill — shared types (client + server). */

export type ActivityId = "trivia" | "guess" | "wyr" | "jokes" | "facts" | "riddles" | "chat" | "story" | "song";
export type Level = "easy" | "medium" | "hard";

/** Where a piece of content came from. Shown to the user — library content is never passed off as live AI. */
export type ChillSource = "ai" | "library";

export interface TriviaQ { id: string; question: string; options: string[]; correct: number; explanation: string; difficulty: Level; topic?: string }
export interface GuessQ { id: string; answer: string; aliases: string[]; clues: string[]; emoji: string; ingredientId?: string }
export interface WyrQ { id: string; a: string; b: string; aEmoji?: string; bEmoji?: string }
export interface WyrReaction { reaction: string; followUp: string }
export interface Joke { id: string; setup: string; punchline: string; category: string }
export interface Fact { id: string; title: string; fact: string; emoji: string; tags: string[]; source: string }
export interface Riddle { id: string; riddle: string; answer: string; aliases: string[]; hint: string; difficulty: Level }
export interface StoryBeat { title: string; text: string; choices: string[]; ending: boolean }
export interface Song { title: string; style: string; lines: string[] }
export interface ChatReply { reply: string; cookingQuestion: boolean }

export interface ChillContext {
  recipeName: string;
  cuisine: string;
  stepText: string;
  nextStepText: string | null;
  remainingSec: number;
  ingredients: string[];
  pantry: string[];
  persona: "mild" | "masala" | "chatpata";
  lang: "en" | "hinglish";
  allergies: string[];
}

export type ChillRequest =
  | { activity: "trivia"; ctx: ChillContext; difficulty: Level; recent: string[] }
  | { activity: "guess"; ctx: ChillContext; difficulty: Level; recent: string[] }
  | { activity: "wyr"; ctx: ChillContext; recent: string[] }
  | { activity: "wyr-react"; ctx: ChillContext; question: { a: string; b: string }; picked: string }
  | { activity: "jokes"; ctx: ChillContext; recent: string[] }
  | { activity: "riddles"; ctx: ChillContext; difficulty: Level; recent: string[] }
  | { activity: "chat"; ctx: ChillContext; messages: { who: "user" | "mate"; text: string }[] }
  | { activity: "story"; ctx: ChillContext; prompt: string; beats: { text: string; choice?: string }[]; maxBeats: number }
  | { activity: "song"; ctx: ChillContext; topic: string; style: string };

export type ChillAiKind = ChillRequest["activity"];
