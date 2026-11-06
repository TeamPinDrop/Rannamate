"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Lock, Mail, RefreshCw } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useDraftField } from "@/lib/auth/draft";
import { authMessage, codeMessage, fieldErrors } from "@/lib/auth/messages";
import { safeReturnTo, withReturnTo } from "@/lib/auth/routes";
import { ApiError } from "@/services/api-client";
import { authApi, type AuthProviders } from "@/services/endpoints";
import { authEnabled } from "@/lib/auth/enabled";
import { stagger, Rise, useAuthShell } from "./AuthShell";
import { AuthCard, Checkbox, emailProblem, Field, GoogleButton, Notice, OrDivider, PasswordField, ShellLink, SubmitButton, type SubmitState } from "./controls";

export function useProviders() {
  const [p, setP] = useState<AuthProviders | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    if (!authEnabled()) return; // no backend for this site → don't ask it anything
    authApi.providers().then((v) => alive && setP(v)).catch(() => alive && setFailed(true));
    return () => { alive = false; };
  }, []);
  return { providers: p, failed };
}

/** Logged-in visitors don't need to see the auth pages: send them on (unless we're mid-success animation). */
export function useRedirectIfSignedIn(dest: string, paused: boolean) {
  const { status } = useAuth();
  const router = useRouter();
  useEffect(() => { if (status === "signed-in" && !paused) router.replace(dest); }, [status, paused, dest, router]);
}

export function OfflineNotice() {
  const { status, retry } = useAuth();
  return (
    <AnimatePresence>
      {status === "offline" && (
        <Notice tone="warn" action={<button type="button" onClick={retry} className="inline-flex items-center gap-1.5 text-[13px] font-bold underline-offset-4 hover:underline"><RefreshCw className="h-3.5 w-3.5" /> Try again</button>}>
          Can&apos;t reach the RANNAMATE server right now, so signing in won&apos;t work until it&apos;s running.
        </Notice>
      )}
    </AnimatePresence>
  );
}

export function SignInForm() {
  const params = useSearchParams();
  const returnTo = safeReturnTo(params.get("returnTo"));
  const { signIn } = useAuth();
  const { go } = useAuthShell();
  const { providers } = useProviders();
  const [email, setEmail] = useDraftField("email");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [touched, setTouched] = useState<{ email?: boolean; password?: boolean }>({});
  const [submitted, setSubmitted] = useState(false);
  const [state, setState] = useState<SubmitState>("idle");
  const [error, setError] = useState<string | null>(codeMessage(params.get("error")));
  const [serverFields, setServerFields] = useState<Record<string, string>>({});
  const [welcome, setWelcome] = useState("");
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  useRedirectIfSignedIn(returnTo, state !== "idle");

  const reset = params.get("reset") === "1";
  const ended = params.get("ended") === "1";

  const emailErr = (touched.email || submitted) ? emailProblem(email) ?? serverFields.email ?? null : null;
  const passErr = (touched.password || submitted) && !password ? "Enter your password" : null;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    setError(null);
    setServerFields({});
    if (emailProblem(email)) return emailRef.current?.focus();
    if (!password) return passwordRef.current?.focus();
    setState("loading");
    try {
      const user = await signIn(email.trim(), password, remember);
      setWelcome(user.profile.displayName.split(" ")[0] || "chef");
      setState("success");
      setPassword("");
      window.setTimeout(() => go(returnTo, { replace: true }), 900);
    } catch (err) {
      setState("idle");
      setServerFields(fieldErrors(err));
      setError(authMessage(err));
      if (err instanceof ApiError && err.code === "INVALID_CREDENTIALS") { setPassword(""); passwordRef.current?.focus(); }
    }
  }

  return (
    <AuthCard tabs="sign-in" tabHrefs={{ signIn: withReturnTo("/sign-in", returnTo), signUp: withReturnTo("/sign-up", returnTo) }}>
      <motion.div variants={stagger} initial="hidden" animate="show">
        <Rise><p className="eyebrow">Sign in</p></Rise>
        <Rise>
          <h1 className="h-display mt-2 text-[2.15rem] leading-[1.05] text-forest sm:text-[2.6rem]">
            Welcome Back, <em className="text-burgundy">Food Mate!</em>
          </h1>
        </Rise>
        <Rise><p className="mt-3 text-[15px] text-forest/75">Your kitchen is waiting. Sign in and continue your culinary journey.</p></Rise>

        <div className="mt-6 space-y-3">
          <AnimatePresence>
            {reset && !error && <Notice tone="success">Your password was changed. Sign in with your new password.</Notice>}
            {ended && !error && <Notice tone="info">You were signed out. Sign in again to continue.</Notice>}
            {error && <Notice tone="error">{error}</Notice>}
          </AnimatePresence>
          <OfflineNotice />
        </div>

        <form onSubmit={onSubmit} noValidate className="mt-4 space-y-4" aria-label="Sign in">
          <Rise>
            <Field ref={emailRef} label="Email address" icon={Mail} type="email" name="email" autoComplete="email" inputMode="email" autoCapitalize="none" spellCheck={false}
              value={email} onChange={(e) => setEmail(e.target.value)} onBlur={() => setTouched((t) => ({ ...t, email: true }))}
              error={emailErr} valid={!!email && !emailProblem(email)} maxLength={190} />
          </Rise>
          <Rise>
            <PasswordField ref={passwordRef} label="Password" icon={Lock} name="password" autoComplete="current-password" maxLength={72}
              value={password} onChange={(e) => setPassword(e.target.value)} onBlur={() => setTouched((t) => ({ ...t, password: true }))} error={passErr} />
          </Rise>
          <Rise className="flex items-center justify-between gap-3 pt-0.5">
            <Checkbox checked={remember} onChange={setRemember}>Remember me</Checkbox>
            <ShellLink href={withReturnTo("/forgot-password", returnTo)} className="text-sm font-bold text-burgundy underline-offset-4 hover:underline">Forgot password?</ShellLink>
          </Rise>
          <Rise className="pt-1">
            <SubmitButton state={state} loadingText="Signing you in…" successText={`Welcome back, ${welcome}!`}>Sign In</SubmitButton>
          </Rise>
          {providers?.google && (
            <>
              <Rise><OrDivider /></Rise>
              <Rise><GoogleButton href={authApi.googleStartUrl(returnTo)} /></Rise>
            </>
          )}
        </form>

        <Rise>
          <p className="mt-7 text-center text-sm text-forest/75">
            Don&apos;t have an account?{" "}
            <ShellLink href={withReturnTo("/sign-up", returnTo)} className="font-bold text-burgundy underline-offset-4 hover:underline">Sign Up</ShellLink>
          </p>
        </Rise>
      </motion.div>
    </AuthCard>
  );
}
