"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ApiError, onSessionChange, restoreSession, session } from "@/services/api-client";
import { authApi } from "@/services/endpoints";
import type { User } from "@/services/types";
import { actions, getState, subscribeStore } from "@/lib/store";
import { authEnabled } from "./enabled";

/**
 * loading    – checking the session cookie (first paint after a reload)
 * signed-in  – a real session confirmed by the backend
 * signed-out – no session (or it ended)
 * offline    – the backend couldn't be reached, so we honestly don't know yet
 * disabled   – sign-in isn't available on this deployment (see lib/auth/enabled.ts)
 */
export type AuthStatus = "loading" | "signed-in" | "signed-out" | "offline" | "disabled";

interface AuthContextValue {
  status: AuthStatus;
  user: User | null;
  /** "memory" when the backend runs on its temporary in-memory store (development) */
  dataSource: string | null;
  signIn(email: string, password: string, remember: boolean): Promise<User>;
  signUp(input: { displayName: string; email: string; password: string }): Promise<User>;
  signOut(): Promise<void>;
  /** true right after the user pressed Sign Out (protected pages then go home instead of to Sign In) */
  signedOutByUser: boolean;
  retry(): void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const v = useContext(AuthContext);
  if (!v) throw new Error("useAuth must be used inside <AuthProvider>");
  return v;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<User | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [signedOutByUser, setSignedOutByUser] = useState(false);

  // the API client tells us whenever the session changes (sign-in, refresh, sign-out, "session ended")
  useEffect(() => onSessionChange((u) => { setUser(u); setStatus(u ? "signed-in" : "signed-out"); if (u) setSignedOutByUser(false); }), []);

  useEffect(() => {
    let alive = true;
    if (!authEnabled()) { setStatus("disabled"); return; } // no backend for this site yet → no network calls
    restoreSession().catch((e) => {
      if (!alive) return;
      setStatus(e instanceof ApiError && e.unavailable ? "offline" : "signed-out");
    });
    return () => { alive = false; };
  }, [attempt]);

  useProfileSync(user);

  const signIn = useCallback((email: string, password: string, remember: boolean) => authApi.login(email, password, remember), []);
  const signUp = useCallback((i: { displayName: string; email: string; password: string }) => authApi.register({ ...i, acceptTerms: true }), []);
  const signOut = useCallback(async () => { setSignedOutByUser(true); await authApi.logout(); }, []);
  const retry = useCallback(() => { setStatus("loading"); setAttempt((a) => a + 1); }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ status, user, dataSource: session.dataSource, signIn, signUp, signOut, signedOutByUser, retry }),
    [status, user, signIn, signUp, signOut, signedOutByUser, retry],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * While signed in, the account is the source of truth for name, allergies and diets:
 *  - on sign-in, the account's values are copied into the app (if the account has no allergies/diets
 *    yet but this browser does, the browser's choices are saved to the account instead)
 *  - afterwards, changes made on the Profile page are saved to the account (debounced)
 */
function useProfileSync(user: User | null) {
  const userId = user?.id ?? null;
  const userRef = useRef(user);
  userRef.current = user;

  useEffect(() => {
    if (!userId || !userRef.current) return;
    const server = userRef.current.profile;
    const local = getState().profile;
    const push: Parameters<typeof authApi.updateProfile>[0] = {};
    const next = { ...local, name: server.displayName || local.name };
    if (server.allergies.length || server.diets.length || (!local.allergies.length && !local.diets.length)) {
      next.allergies = server.allergies; next.diets = server.diets;
    } else {
      push.allergies = local.allergies; push.diets = local.diets;
    }
    actions.setProfile(next);
    if (Object.keys(push).length) authApi.updateProfile(push).catch(() => undefined);

    let last = JSON.stringify({ n: next.name, a: next.allergies, d: next.diets });
    let timer: ReturnType<typeof setTimeout> | undefined;
    const off = subscribeStore(() => {
      const p = getState().profile;
      const snap = JSON.stringify({ n: p.name, a: p.allergies, d: p.diets });
      if (snap === last) return;
      last = snap;
      clearTimeout(timer);
      timer = setTimeout(() => {
        const name = p.name.trim();
        authApi.updateProfile({ ...(name.length >= 1 ? { displayName: name.slice(0, 60) } : {}), allergies: p.allergies, diets: p.diets }).catch(() => undefined);
      }, 700);
    });
    return () => { off(); clearTimeout(timer); };
  }, [userId]);
}
