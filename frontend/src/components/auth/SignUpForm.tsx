"use client";
import { useRef, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Lock, Mail, ShieldCheck, UserRound, X } from "lucide-react";
import { Modal } from "@/components/tastory/ui";
import { useAuth } from "@/lib/auth/AuthProvider";
import { clearDraft, useDraftField } from "@/lib/auth/draft";
import { authMessage, fieldErrors } from "@/lib/auth/messages";
import { safeReturnTo, withReturnTo } from "@/lib/auth/routes";
import { ApiError } from "@/services/api-client";
import { authApi } from "@/services/endpoints";
import { stagger, Rise, useAuthShell } from "./AuthShell";
import { AuthCard, Checkbox, emailProblem, Field, GoogleButton, Notice, OrDivider, PasswordField, passwordProblem, PasswordStrength, ShellLink, SubmitButton, type SubmitState } from "./controls";
import { OfflineNotice, useProviders, useRedirectIfSignedIn } from "./SignInForm";

const nameProblem = (v: string) => {
  const n = v.trim();
  if (!n) return "Enter your name";
  if (n.length < 2) return "Name must be at least 2 characters";
  if (n.length > 60) return "Name must be at most 60 characters";
  return null;
};

export function SignUpForm() {
  const params = useSearchParams();
  const returnTo = safeReturnTo(params.get("returnTo"));
  const dest = returnTo !== "/" ? returnTo : "/profile?welcome=1";
  const { signUp, dataSource } = useAuth();
  const { go } = useAuthShell();
  const { providers } = useProviders();
  const [name, setName] = useDraftField("name");
  const [email, setEmail] = useDraftField("email");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [terms, setTerms] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitted, setSubmitted] = useState(false);
  const [state, setState] = useState<SubmitState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [taken, setTaken] = useState<string | null>(null);
  const [server, setServer] = useState<Record<string, string>>({});
  const refs = { name: useRef<HTMLInputElement>(null), email: useRef<HTMLInputElement>(null), password: useRef<HTMLInputElement>(null), confirm: useRef<HTMLInputElement>(null) };
  useRedirectIfSignedIn(returnTo, state !== "idle");

  const show = (k: string) => touched[k] || submitted;
  const errs = {
    name: nameProblem(name) ?? server.name ?? null,
    email: emailProblem(email) ?? (taken && taken === email.trim().toLowerCase() ? "An account with this email already exists." : null) ?? server.email ?? null,
    password: passwordProblem(password) ?? server.password ?? null,
    confirm: !confirm ? "Confirm your password" : confirm !== password ? "Passwords don't match" : null,
    terms: terms ? null : "Please accept the Terms to continue",
  };
  // confirm shows live as soon as you start typing it
  const confirmErr = confirm || show("confirm") ? errs.confirm : null;
  const blur = (k: string) => () => setTouched((t) => ({ ...t, [k]: true }));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    setError(null);
    setServer({});
    const first = (["name", "email", "password", "confirm"] as const).find((k) => errs[k]);
    if (first) return refs[first].current?.focus();
    if (errs.terms) return;
    setState("loading");
    try {
      await signUp({ displayName: name.trim().replace(/\s+/g, " "), email: email.trim(), password });
      setState("success");
      setPassword(""); setConfirm("");
      clearDraft();
      window.setTimeout(() => go(dest, { replace: true }), 1000);
    } catch (err) {
      setState("idle");
      if (err instanceof ApiError && err.code === "EMAIL_TAKEN") { setTaken(email.trim().toLowerCase()); refs.email.current?.focus(); return; }
      setServer(fieldErrors(err));
      setError(authMessage(err));
    }
  }

  return (
    <AuthCard tabs="sign-up" tabHrefs={{ signIn: withReturnTo("/sign-in", returnTo), signUp: withReturnTo("/sign-up", returnTo) }}>
      <motion.div variants={stagger} initial="hidden" animate="show">
        <Rise><p className="eyebrow">Create your account</p></Rise>
        <Rise>
          <h1 className="h-display mt-2 text-[2.15rem] leading-[1.05] text-forest sm:text-[2.5rem]">
            Let&apos;s Cook Up Something <em className="text-burgundy">Amazing!</em>
          </h1>
        </Rise>
        <Rise><p className="mt-3 text-[15px] text-forest/75">Join RANNAMATE and discover a smarter, more exciting way to cook.</p></Rise>

        <div className="mt-6 space-y-3">
          <AnimatePresence>{error && <Notice tone="error">{error}</Notice>}</AnimatePresence>
          <OfflineNotice />
        </div>

        <form onSubmit={onSubmit} noValidate className="mt-4 space-y-4" aria-label="Create account">
          <Rise>
            <Field ref={refs.name} label="Full name" icon={UserRound} name="name" autoComplete="name" maxLength={60}
              value={name} onChange={(e) => setName(e.target.value)} onBlur={blur("name")} error={show("name") ? errs.name : null} valid={!errs.name} />
          </Rise>
          <Rise>
            <Field ref={refs.email} label="Email address" icon={Mail} type="email" name="email" autoComplete="email" inputMode="email" autoCapitalize="none" spellCheck={false} maxLength={190}
              value={email} onChange={(e) => setEmail(e.target.value)} onBlur={blur("email")}
              error={show("email") || taken ? errs.email : null} valid={!errs.email} />
            <AnimatePresence>
              {taken && taken === email.trim().toLowerCase() && (
                <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden px-2 pt-1 text-[13px] text-forest/75">
                  Is it yours? <ShellLink href={withReturnTo("/sign-in", returnTo)} className="font-bold text-burgundy underline-offset-4 hover:underline">Sign in instead</ShellLink>
                </motion.p>
              )}
            </AnimatePresence>
          </Rise>
          <Rise>
            <PasswordField ref={refs.password} label="Password" icon={Lock} name="new-password" autoComplete="new-password" maxLength={72}
              value={password} onChange={(e) => setPassword(e.target.value)} onBlur={blur("password")} error={show("password") && password ? errs.password : show("password") && !password ? "Enter a password" : null} />
            <PasswordStrength password={password} />
          </Rise>
          <Rise>
            <PasswordField ref={refs.confirm} label="Confirm password" icon={ShieldCheck} name="confirm-password" autoComplete="new-password" maxLength={72}
              value={confirm} onChange={(e) => setConfirm(e.target.value)} onBlur={blur("confirm")} error={confirmErr}
              hint={!confirmErr && confirm && confirm === password ? "Passwords match" : undefined} />
          </Rise>
          <Rise>
            <Checkbox checked={terms} onChange={setTerms} error={submitted ? errs.terms : null}>
              I agree to the{" "}
              <button type="button" onClick={(e) => { e.preventDefault(); setShowTerms(true); }} className="font-bold text-burgundy underline underline-offset-4">Terms &amp; Privacy</button>
            </Checkbox>
          </Rise>
          <Rise className="pt-1">
            <SubmitButton state={state} loadingText="Creating your account…" successText="You're in — welcome!">Create Account</SubmitButton>
          </Rise>
          {providers?.google && (
            <>
              <Rise><OrDivider /></Rise>
              <Rise><GoogleButton href={authApi.googleStartUrl(dest)} label="Sign up with Google" /></Rise>
            </>
          )}
          {dataSource === "memory" && (
            <Rise><p className="px-1 text-[12px] leading-snug text-forest/55">Development server: accounts are kept in memory and disappear when the backend restarts.</p></Rise>
          )}
        </form>

        <Rise>
          <p className="mt-7 text-center text-sm text-forest/75">
            Already have an account?{" "}
            <ShellLink href={withReturnTo("/sign-in", returnTo)} className="font-bold text-burgundy underline-offset-4 hover:underline">Sign In</ShellLink>
          </p>
        </Rise>
      </motion.div>
      <TermsModal open={showTerms} onClose={() => setShowTerms(false)} onAccept={() => { setTerms(true); setShowTerms(false); }} />
    </AuthCard>
  );
}

/**
 * Plain-language summary of what an account means in this app, accurate to how it works today.
 * (Site owner: link your full legal Terms and Privacy Policy here before a public launch.)
 */
function TermsModal({ open, onClose, onAccept }: { open: boolean; onClose: () => void; onAccept: () => void }) {
  return (
    <Modal open={open} onClose={onClose} label="Terms and Privacy" className="max-w-lg rounded-t-[2rem] bg-cream-50 shadow-glass-lg sm:rounded-[2rem]">
      <div className="relative p-6 sm:p-8">
        <button onClick={onClose} aria-label="Close" className="absolute right-4 top-4 rounded-full p-2 text-forest/60 hover:bg-forest/5 hover:text-forest"><X className="h-5 w-5" /></button>
        <p className="eyebrow">Terms &amp; Privacy</p>
        <h2 className="h-display mt-2 text-2xl text-forest">The short version</h2>
        <ul className="mt-4 space-y-2.5 text-sm leading-relaxed text-forest/80">
          <li><b>What we keep:</b> your name, email, a securely hashed password (never the password itself) and the preferences you set — allergies, diets and Cooking Mate settings.</li>
          <li><b>Cookies:</b> one secure, HTTP-only cookie keeps you signed in, plus a security cookie that protects sign-in forms. No advertising trackers.</li>
          <li><b>Cooking guidance:</b> recipes, allergy filters and Cooking Mate tips are helpful suggestions, not medical or dietary advice — always check labels for allergens.</li>
          <li><b>Your control:</b> you can sign out on this device at any time; resetting your password signs you out everywhere.</li>
          <li><b>Be kind:</b> use RANNAMATE for your own cooking, and don&apos;t try to access other people&apos;s accounts.</li>
        </ul>
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button onClick={onClose} className="btn-ghost">Close</button>
          <button onClick={onAccept} className="btn-primary" data-autofocus>I agree</button>
        </div>
      </div>
    </Modal>
  );
}
