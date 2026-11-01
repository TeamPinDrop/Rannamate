export type Persona = "mild" | "masala" | "chatpata";
export type Lang = "en" | "hinglish";

export type MateCard =
  | { type: "recipes"; ids: string[]; matches?: Record<string, number> }
  | { type: "recipe"; id: string }
  | { type: "created"; id: string }
  | { type: "step"; id: string; index: number }
  | { type: "timer"; seconds: number; label: string }
  | { type: "swap"; from: string; options: string[] }
  | { type: "ingredients"; id: string; servings: number };

export interface MateEffects {
  setRecipe?: string | null;
  setStep?: number;
  setCooking?: boolean;
}

export interface MateTurn {
  text: string;
  cards: MateCard[];
  effects: MateEffects;
  mood?: "happy" | "excited" | "thinking" | "neutral";
}

export interface MateContext {
  recipeId: string | null;
  step: number;
  cooking: boolean;
  pantry: string[];
  persona: Persona;
  lang: Lang;
  allergies: string[];
  diets: string[];
}

export interface ChatMessage {
  id: string;
  who: "user" | "mate";
  text: string;
  cards?: MateCard[];
  source?: "ai" | "offline";
  at: number;
}
