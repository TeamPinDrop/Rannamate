import type { Recipe } from "./types";
import { localMateReply, type MateAction } from "./mate-local";

/**
 * The frontend only ever talks to the NestJS backend (port 4000).
 * The backend coordinates the FastAPI AI service — no AI keys live here.
 */
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

async function withTimeout<T>(p: (signal: AbortSignal) => Promise<T>, ms: number): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await p(ctrl.signal);
  } finally {
    clearTimeout(t);
  }
}

export interface MateReply {
  text: string;
  action?: MateAction;
  /** "ai" = generative model via backend, "offline" = built-in rule-based helper */
  source: "ai" | "offline";
}

export interface MateContext {
  recipe: Recipe | null;
  stepIndex: number;
  restrictions: string[];
}

export async function askMate(question: string, ctx: MateContext): Promise<MateReply> {
  try {
    const res = await withTimeout(
      (signal) =>
        fetch(`${API_URL}/api/assistant/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question,
            recipeId: ctx.recipe?.id ?? null,
            currentStep: ctx.stepIndex,
            restrictions: ctx.restrictions,
          }),
          signal,
        }),
      8000,
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as { text: string; action?: MateAction };
    return { text: data.text, action: data.action, source: "ai" };
  } catch {
    const local = localMateReply(question, ctx.recipe, ctx.stepIndex);
    return { ...local, source: "offline" };
  }
}

export interface Detection {
  ingredientId: string;
  confidence: number; // 0..1
}

export class ServiceUnavailableError extends Error {}

export async function detectIngredients(file: File): Promise<Detection[]> {
  const body = new FormData();
  body.append("image", file);
  let res: Response;
  try {
    res = await withTimeout((signal) => fetch(`${API_URL}/api/vision/detect`, { method: "POST", body, signal }), 20000);
  } catch {
    throw new ServiceUnavailableError(
      "The ingredient-recognition service isn't running yet. Start the backend and AI service (Phase 3–5), or add ingredients manually.",
    );
  }
  if (!res.ok) throw new ServiceUnavailableError(`Recognition failed (HTTP ${res.status}).`);
  const data = (await res.json()) as { detections: Detection[] };
  return data.detections;
}
