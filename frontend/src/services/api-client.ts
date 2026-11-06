import type { User } from "./types";
/**
 * The ONLY place the frontend talks to the RANNAMATE backend (NestJS, /api/v1).
 * The frontend never talks to MySQL or the AI service directly and holds no secrets.
 *
 *  - base URL from NEXT_PUBLIC_API_URL (default http://localhost:4000)
 *  - unwraps `{ data, meta }`, turns `{ error: { code, message } }` into ApiError
 *  - attaches the in-memory access token when signed in and refreshes it once on TOKEN_EXPIRED
 *  - session refresh/sign-in/out go through /auth with the httpOnly cookie + CSRF header (see below)
 *  - de-duplicates identical in-flight submissions (double clicks)
 */
export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/+$/, "");
export const API_BASE = `${API_URL}/api/v1`;

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: unknown) { super(message); }
  /** backend/AI not running, not configured, or unreachable */
  get unavailable() { return this.status === 0 || this.status === 502 || this.status === 503 || this.status === 504; }
}

export interface PageMeta { page: number; pageSize: number; total: number; totalPages: number }
export interface Page<T> { items: T[]; meta: PageMeta }

// ---- session
// The long-lived refresh token is ONLY in an httpOnly cookie the browser holds for the backend
// (JavaScript can't read it). The short-lived access token and the CSRF token live in memory only —
// never in localStorage or sessionStorage. After a reload they are recovered via GET /auth/csrf + POST /auth/refresh.
let accessToken: string | null = null;
let csrfToken: string | null = null;
let dataSource: string | null = null;

export interface AuthPayload { user: User; accessToken: string; expiresIn: number; csrfToken: string }
type Listener = (user: User | null) => void;
const listeners = new Set<Listener>();
/** the auth context subscribes, so a refresh or a "session ended" anywhere updates the whole app */
export function onSessionChange(l: Listener) { listeners.add(l); return () => { listeners.delete(l); }; }
const emit = (u: User | null) => listeners.forEach((l) => l(u));

export const session = {
  get access() { return accessToken; },
  /** "memory" when the backend runs on its temporary in-memory store (development) */
  get dataSource() { return dataSource; },
  accept(p: AuthPayload) { accessToken = p.accessToken; csrfToken = p.csrfToken; emit(p.user); },
  clear() { accessToken = null; emit(null); },
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** low-level call to /auth/* — sends cookies and the CSRF header; one automatic retry if the CSRF token went stale */
async function authFetch(path: string, init: { method: "GET" | "POST"; body?: unknown }, retried = false): Promise<Response> {
  if (init.method === "POST" && !csrfToken) await fetchCsrf();
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/auth${path}`, {
      method: init.method, credentials: "include", cache: "no-store",
      headers: { ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}), ...(init.method === "POST" && csrfToken ? { "X-CSRF-Token": csrfToken } : {}) },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      signal: AbortSignal.timeout(15_000),
    });
  } catch (e) {
    const timeout = e instanceof DOMException && e.name === "TimeoutError";
    throw new ApiError(0, timeout ? "TIMEOUT" : "BACKEND_UNREACHABLE", timeout ? "The server took too long to answer." : "Can't reach the RANNAMATE server right now.");
  }
  dataSource = res.headers.get("X-Data-Source") ?? dataSource;
  if (res.status === 403 && !retried) {
    const j = await res.clone().json().catch(() => ({}));
    if (j?.error?.code === "CSRF_FAILED") { csrfToken = null; return authFetch(path, init, true); }
  }
  return res;
}

async function fetchCsrf(): Promise<{ csrfToken: string; hasSession: boolean }> {
  const res = await authFetch("/csrf", { method: "GET" });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, j?.error?.code ?? "HTTP_ERROR", j?.error?.message ?? "Security check failed.");
  csrfToken = j.data.csrfToken;
  return j.data;
}

/** POST /auth/* with JSON; returns `data` or throws ApiError */
export async function authPost<T>(path: string, body?: unknown): Promise<T> {
  const res = await authFetch(path, { method: "POST", body: body ?? {} });
  if (res.status === 204) return undefined as T;
  const j = await res.json().catch(() => ({}));
  if (!res.ok) { const e = j?.error ?? {}; throw new ApiError(res.status, e.code ?? "HTTP_ERROR", e.message ?? `Request failed (HTTP ${res.status})`, e.details); }
  return j.data as T;
}
export async function authGet<T>(path: string): Promise<T> {
  const res = await authFetch(path, { method: "GET" });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) { const e = j?.error ?? {}; throw new ApiError(res.status, e.code ?? "HTTP_ERROR", e.message ?? `Request failed (HTTP ${res.status})`); }
  return j.data as T;
}

let refreshing: Promise<User | null> | null = null;
/**
 * Single-flight session refresh from the httpOnly cookie. Resolves the user, or null when there is no
 * valid session. Network problems are thrown (so "offline" is never mistaken for "signed out").
 */
export function refreshSession(): Promise<User | null> {
  refreshing ??= (async () => {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const p = await authPost<AuthPayload>("/refresh");
        session.accept(p);
        return p.user;
      } catch (e) {
        if (e instanceof ApiError && e.code === "REFRESH_RACE" && attempt === 0) { await sleep(400); continue; } // another tab just rotated it
        if (e instanceof ApiError && e.status === 401) { session.clear(); return null; }
        throw e;
      }
    }
    session.clear();
    return null;
  })().finally(() => { refreshing = null; });
  return refreshing;
}

/** on page load: is there a session cookie at all? (avoids a pointless refresh call for visitors) */
export async function restoreSession(): Promise<User | null> {
  const c = await fetchCsrf();
  if (!c.hasSession) { session.clear(); return null; }
  return refreshSession();
}

async function tryRefresh(): Promise<boolean> {
  try { return !!(await refreshSession()); } catch { return false; }
}

const inflight = new Map<string, Promise<unknown>>();

export interface RequestOptions { method?: "GET" | "POST" | "PATCH" | "DELETE"; body?: unknown; form?: FormData; query?: Record<string, string | number | boolean | undefined | null>; timeoutMs?: number; signal?: AbortSignal; auth?: boolean }

async function raw<T>(path: string, o: RequestOptions, retried = false): Promise<{ data: T; meta?: PageMeta }> {
  const qs = o.query ? Object.entries(o.query).filter(([, v]) => v !== undefined && v !== null && v !== "").map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join("&") : "";
  const headers: Record<string, string> = {};
  if (o.body !== undefined) headers["Content-Type"] = "application/json";
  if (o.auth !== false && accessToken) headers.Authorization = `Bearer ${accessToken}`;
  const signals = [AbortSignal.timeout(o.timeoutMs ?? 15_000), ...(o.signal ? [o.signal] : [])];
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}${qs ? `?${qs}` : ""}`, {
      method: o.method ?? "GET", headers, body: o.form ?? (o.body !== undefined ? JSON.stringify(o.body) : undefined),
      signal: AbortSignal.any ? AbortSignal.any(signals) : signals[0],
    });
  } catch (e) {
    const timeout = e instanceof DOMException && e.name === "TimeoutError";
    throw new ApiError(0, timeout ? "TIMEOUT" : "BACKEND_UNREACHABLE", timeout ? "The server took too long to answer." : "Can't reach the RANNAMATE server.");
  }
  if (res.status === 204) return { data: undefined as T };
  const json = await res.json().catch(() => ({}));
  if (res.ok) return json;
  const err = json?.error ?? {};
  if (res.status === 401 && err.code === "TOKEN_EXPIRED" && !retried && (await tryRefresh())) return raw<T>(path, o, true);
  if (res.status === 401 && err.code === "SESSION_ENDED") session.clear(); // signed out elsewhere (logout, password reset)
  throw new ApiError(res.status, err.code ?? "HTTP_ERROR", err.message ?? `Request failed (HTTP ${res.status})`, err.details);
}

export const api = {
  async get<T>(path: string, o: Omit<RequestOptions, "method" | "body"> = {}) { return (await raw<T>(path, o)).data; },
  async page<T>(path: string, o: Omit<RequestOptions, "method" | "body"> = {}): Promise<Page<T>> { const r = await raw<T[]>(path, o); return { items: r.data, meta: r.meta! }; },
  /** identical concurrent submissions share one request */
  send<T>(method: "POST" | "PATCH" | "DELETE", path: string, o: Omit<RequestOptions, "method"> = {}): Promise<T> {
    const key = `${method} ${path} ${o.form ? "form" : JSON.stringify(o.body ?? null)}`;
    const existing = inflight.get(key) as Promise<T> | undefined;
    if (existing) return existing;
    const p = raw<T>(path, { ...o, method }).then((r) => r.data).finally(() => inflight.delete(key));
    inflight.set(key, p);
    return p;
  },
  /** absolute URL for a signed media path returned by the API */
  mediaUrl: (relative: string) => `${API_URL}${relative}`,
};
