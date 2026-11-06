import type { Recipe } from "./types";
import { localMateReply, type MateAction } from "./mate-local";
import { ApiError } from "@/services/api-client";
import { mateApi, scannerApi } from "@/services/endpoints";

/**
 * The frontend only ever talks to the NestJS backend (NEXT_PUBLIC_API_URL, default port 4000).
 * The backend coordinates the FastAPI AI service — no AI keys live here.
 * See src/services/ for the full typed API client.
 */
export { API_URL } from "@/services/api-client";

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

/** Cooking-mode Mate panel: asks the backend; falls back to the labelled offline helper if it can't answer. */
export async function askMate(question: string, ctx: MateContext): Promise<MateReply> {
  try {
    // recipes Mate invented in the browser ("ai-…") aren't in the backend catalogue
    const catalogRecipe = ctx.recipe && !ctx.recipe.id.startsWith("ai-") ? ctx.recipe : null;
    const data = await mateApi.chat({
      message: question.slice(0, 500),
      recipeId: catalogRecipe?.id,
      stepIndex: catalogRecipe ? ctx.stepIndex : undefined,
      allergies: ctx.restrictions.filter((r) => r.startsWith("allergy:")).map((r) => r.slice(8)),
      diets: ctx.restrictions.filter((r) => !r.startsWith("allergy:")),
    });
    return { text: data.reply, action: data.action ?? undefined, source: "ai" };
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

/** Kitchen photo scan → backend → AI service. Every result still needs the user's confirmation. */
export async function detectIngredients(file: File): Promise<Detection[]> {
  try {
    const r = await scannerApi.scan(file);
    return r.detections.map((d) => ({ ingredientId: d.ingredientId, confidence: d.confidence }));
  } catch (e) {
    if (!(e instanceof ApiError)) throw new ServiceUnavailableError("Something went wrong analysing the photo.");
    if (e.code === "BACKEND_UNREACHABLE" || e.code === "TIMEOUT")
      throw new ServiceUnavailableError("The ingredient-recognition service isn't running. Start the backend and AI service, or add ingredients manually.");
    if (e.code === "AI_SERVICE_NOT_CONFIGURED" || e.code === "AI_PROVIDER_NOT_CONFIGURED" || e.code === "AI_SERVICE_UNREACHABLE")
      throw new ServiceUnavailableError("Photo recognition isn't set up yet on the server — add ingredients manually for now.");
    // validation problems (wrong type, too large) and AI errors: show the server's message
    throw new ServiceUnavailableError(e.message);
  }
}
