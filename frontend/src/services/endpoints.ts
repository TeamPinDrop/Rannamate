/**
 * Typed calls for every backend feature. Connected in the UI today: sign-in/sign-up/password reset/
 * Google (auth pages), the account profile (allergies, diets, name), scanner + Cooking Mate (lib/api.ts).
 * Kitchen, favourites, sessions and Tastory still save in the browser; their calls below are ready
 * for when MySQL is mapped (moving them now would lose data on every backend restart in memory mode).
 */
import { api, API_BASE, authGet, authPost, session, type AuthPayload } from "./api-client";
import type { CookingSession, InventoryItem, MateReply, Memory, RecipeDetail, RecipeSummary, Recommendation, ScanResult, User } from "./types";

export interface AuthProviders { password: boolean; google: boolean; passwordReset: boolean }

/** Sign-in flows. Every call that touches the session cookie carries the CSRF header (authPost). */
export const authApi = {
  providers: () => authGet<AuthProviders>("/providers"),
  async register(input: { displayName: string; email: string; password: string; acceptTerms: true }) { const p = await authPost<AuthPayload>("/register", input); session.accept(p); return p.user; },
  async login(email: string, password: string, remember: boolean) { const p = await authPost<AuthPayload>("/login", { email, password, remember }); session.accept(p); return p.user; },
  async logout() { try { await authPost<void>("/logout"); } finally { session.clear(); } },
  forgotPassword: (email: string) => authPost<{ message: string }>("/password/forgot", { email }),
  checkResetToken: (token: string) => authPost<{ valid: boolean }>("/password/reset/check", { token }),
  resetPassword: (token: string, password: string) => authPost<{ email: string; message: string }>("/password/reset", { token, password }),
  /** browser navigation target for "Continue with Google" (only rendered when providers().google) */
  googleStartUrl: (returnTo: string, link?: string) => `${API_BASE}/auth/google/start?${new URLSearchParams({ returnTo, remember: "1", ...(link ? { link } : {}) })}`,
  googleLinkTicket: () => api.send<{ ticket: string }>("POST", "/auth/google/link-ticket"),
  me: () => api.get<User>("/auth/me"),
  updateProfile: (patch: Partial<Pick<User["profile"], "displayName" | "allergies" | "diets" | "preferredLanguage" | "matePersona">>) => api.send<User>("PATCH", "/users/me", { body: patch }),
};

export const recipesApi = {
  list: (q: { q?: string; cuisine?: string; maxTime?: number; difficulty?: string; diet?: string; mood?: string; page?: number; pageSize?: number } = {}) => api.page<RecipeSummary>("/recipes", { query: q }),
  get: (id: string) => api.get<RecipeDetail>(`/recipes/${encodeURIComponent(id)}`),
  discovery: () => api.get<{ totalRecipes: number; cuisines: { id: string; count: number }[]; moods: { id: string; count: number }[] }>("/discovery"),
};

export const ingredientsApi = {
  search: (q: string, category?: string) => api.page<{ id: string; name: string; emoji: string; category: string }>("/ingredients", { query: { q, category } }),
};

export const inventoryApi = {
  list: () => api.get<InventoryItem[]>("/inventory"),
  add: (ingredientId: string, quantity: number, unit?: string, expiresOn?: string | null) => api.send<InventoryItem>("POST", "/inventory", { body: { ingredientId, quantity, unit, expiresOn } }),
  update: (id: string, patch: { quantity?: number; unit?: string; expiresOn?: string | null }) => api.send<InventoryItem>("PATCH", `/inventory/${id}`, { body: patch }),
  remove: (id: string) => api.send<void>("DELETE", `/inventory/${id}`),
};

export const recommendationsApi = {
  recommend: (body: { ingredientIds?: string[]; moods?: string[]; cuisines?: string[]; craving?: string; maxTime?: number; difficulty?: string[]; equipment?: string[]; diets?: string[]; allergies?: string[]; limit?: number }) =>
    api.send<{ results: Recommendation[]; excludedCount: number; weights: Record<string, number> }>("POST", "/recommendations", { body }),
};

export const favouritesApi = {
  list: () => api.get<{ recipe: RecipeSummary; addedAt: string }[]>("/favourites"),
  add: (recipeId: string) => api.send("POST", "/favourites", { body: { recipeId } }),
  remove: (recipeId: string) => api.send<void>("DELETE", `/favourites/${encodeURIComponent(recipeId)}`),
};

export const cookingApi = {
  start: (recipeId: string) => api.send<CookingSession>("POST", "/cooking-sessions", { body: { recipeId } }),
  active: () => api.get<CookingSession | null>("/cooking-sessions/active"),
  moveTo: (id: string, currentStep: number) => api.send<CookingSession>("PATCH", `/cooking-sessions/${id}`, { body: { currentStep } }),
  completeStep: (id: string, step: number) => api.send<CookingSession>("POST", `/cooking-sessions/${id}/steps/${step}/complete`),
  complete: (id: string) => api.send<CookingSession>("POST", `/cooking-sessions/${id}/complete`),
  cancel: (id: string) => api.send<CookingSession>("POST", `/cooking-sessions/${id}/cancel`),
};

export const mateApi = {
  chat: (body: { message: string; recipeId?: string; stepIndex?: number; history?: { who: "user" | "mate"; text: string }[]; allergies?: string[]; diets?: string[]; persona?: string; lang?: string }) =>
    api.send<MateReply>("POST", "/cooking-mate/chat", { body, timeoutMs: 30_000 }),
};

export const scannerApi = {
  scan: (image: File) => { const form = new FormData(); form.append("image", image); return api.send<ScanResult>("POST", "/scanner/ingredients", { form, timeoutMs: 30_000 }); },
};

export const memoriesApi = {
  list: (q: { q?: string; filter?: "all" | "favourites" | "recent" | "top"; sort?: "newest" | "oldest" | "rating" | "az"; page?: number; pageSize?: number } = {}) => api.page<Memory>("/memories", { query: q }),
  timeline: (q: { q?: string; filter?: string } = {}) => api.get<{ total: number; groups: { month: string; label: string; count: number; items: Memory[] }[] }>("/memories/timeline", { query: q }),
  statistics: () => api.get<{ memories: number; photos: number; favourites: number; latestDate: string | null }>("/memories/statistics"),
  get: (id: string) => api.get<Memory>(`/memories/${id}`),
  create: (fields: { dish: string; date?: string; caption?: string; notes?: string; rating?: number | null; tags?: string[]; favourite?: boolean; recipeId?: string }, photos: File[]) => {
    const form = new FormData();
    Object.entries(fields).forEach(([k, v]) => { if (v !== undefined && v !== null) form.append(k, k === "tags" ? JSON.stringify(v) : String(v)); });
    photos.forEach((p) => form.append("photos", p));
    return api.send<Memory>("POST", "/memories", { form, timeoutMs: 60_000 });
  },
  update: (id: string, patch: Partial<Pick<Memory, "dish" | "date" | "caption" | "notes" | "rating" | "tags" | "favourite" | "recipeId">>) => api.send<Memory>("PATCH", `/memories/${id}`, { body: patch }),
  remove: (id: string) => api.send<void>("DELETE", `/memories/${id}`),
  setFavourite: (id: string, favourite?: boolean) => api.send<Memory>("PATCH", `/memories/${id}/favourite`, { body: favourite === undefined ? {} : { favourite } }),
  addPhotos: (id: string, photos: File[]) => { const form = new FormData(); photos.forEach((p) => form.append("photos", p)); return api.send<Memory>("POST", `/memories/${id}/photos`, { form, timeoutMs: 60_000 }); },
  removePhoto: (id: string, photoId: string) => api.send<Memory>("DELETE", `/memories/${id}/photos/${photoId}`),
  setCover: (id: string, photoId: string) => api.send<Memory>("PATCH", `/memories/${id}/cover`, { body: { photoId } }),
  reorder: (id: string, photoIds: string[]) => api.send<Memory>("PATCH", `/memories/${id}/photos/order`, { body: { photoIds } }),
};
