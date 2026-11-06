"use client";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Loader2, LogOut } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { authMessage } from "@/lib/auth/messages";
import { authApi } from "@/services/endpoints";
import { useProviders } from "./SignInForm";

const GOOGLE_RESULT: Record<string, { tone: "ok" | "err"; text: string }> = {
  linked: { tone: "ok", text: "Google is now connected — you can use it to sign in." },
  GOOGLE_ALREADY_LINKED: { tone: "err", text: "That Google account is already connected to a different RANNAMATE account." },
  GOOGLE_OTHER_ACCOUNT_LINKED: { tone: "err", text: "A different Google account is already connected to your account." },
};

/** Who's signed in, how they sign in, and a real sign-out. Shown at the top of the Profile page. */
export function AccountCard() {
  const { user, signOut, dataSource } = useAuth();
  const { providers } = useProviders();
  const params = useSearchParams();
  const [busy, setBusy] = useState<"out" | "google" | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (!user) return null;

  const welcome = params.get("welcome") === "1";
  const google = GOOGLE_RESULT[params.get("google") ?? ""];
  const name = user.profile.displayName || user.email.split("@")[0];

  async function onSignOut() {
    setBusy("out");
    setError(null);
    try {
      await signOut(); // the protected page then takes you home
    } catch (e) {
      setBusy(null);
      setError(authMessage(e));
    }
  }
  async function connectGoogle() {
    setBusy("google");
    setError(null);
    try {
      const { ticket } = await authApi.googleLinkTicket();
      window.location.assign(authApi.googleStartUrl("/profile", ticket));
    } catch (e) {
      setBusy(null);
      setError(authMessage(e));
    }
  }

  return (
    <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="glass-strong mb-6 overflow-hidden rounded-[2rem]">
      <AnimatePresence>
        {(welcome || google) && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} className={`overflow-hidden px-6 py-3 text-sm font-semibold ${google?.tone === "err" ? "bg-burgundy/10 text-burgundy" : "bg-forest text-cream-50"}`} role="status">
            {google ? google.text : `Welcome to RANNAMATE, ${name.split(" ")[0]}! Set your allergies and diets below — every recipe will respect them.`}
          </motion.div>
        )}
      </AnimatePresence>
      <div className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <span aria-hidden className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-burgundy font-display text-2xl font-semibold text-cream-50 shadow-[0_12px_28px_-12px_rgba(108,21,30,0.7)]">
            {name.charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="truncate font-display text-xl font-semibold text-forest">{name}</p>
            <p className="truncate text-sm text-forest/70">{user.email}</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5 text-[11px] font-bold uppercase tracking-[0.12em]">
              {user.signIn.password && <span className="inline-flex items-center gap-1 rounded-full bg-forest/10 px-2.5 py-1 text-forest"><Check className="h-3 w-3" /> Password</span>}
              {user.signIn.google && <span className="inline-flex items-center gap-1 rounded-full bg-forest/10 px-2.5 py-1 text-forest"><Check className="h-3 w-3" /> Google</span>}
              <span className="rounded-full bg-white/50 px-2.5 py-1 text-forest/60">Since {new Date(user.createdAt).toLocaleDateString(undefined, { month: "short", year: "numeric" })}</span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {providers?.google && !user.signIn.google && (
            <button onClick={connectGoogle} disabled={busy !== null} className="btn-ghost">
              {busy === "google" && <Loader2 className="h-4 w-4 animate-spin" />} Connect Google
            </button>
          )}
          <button onClick={onSignOut} disabled={busy !== null} className="btn-primary">
            {busy === "out" ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />} Sign Out
          </button>
        </div>
      </div>
      {error && <p role="alert" className="px-6 pb-4 text-sm font-semibold text-burgundy">{error}</p>}
      {dataSource === "memory" && (
        <p className="border-t border-white/60 px-6 py-3 text-[12px] text-forest/60">Development server: this account lives in memory and disappears when the backend restarts.</p>
      )}
    </motion.section>
  );
}
