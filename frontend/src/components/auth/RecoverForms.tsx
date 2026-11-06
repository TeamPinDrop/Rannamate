"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Lock, Mail, MailCheck, ShieldCheck, TimerReset } from "lucide-react";
import { useDraftField } from "@/lib/auth/draft";
import { authMessage } from "@/lib/auth/messages";
import { safeReturnTo, withReturnTo } from "@/lib/auth/routes";
import { authApi } from "@/services/endpoints";
import { stagger, Rise, useAuthShell } from "./AuthShell";
import { AuthCard, emailProblem, Field, Notice, PasswordField, passwordProblem, PasswordStrength, ShellLink, SubmitButton, type SubmitState } from "./controls";
import { useProviders } from "./SignInForm";

function BackToSignIn({ returnTo }: { returnTo: string }) {
  return (
    <ShellLink href={withReturnTo("/sign-in", returnTo)} className="inline-flex items-center gap-1.5 text-sm font-bold text-burgundy underline-offset-4 hover:underline">
      <ArrowLeft className="h-4 w-4" /> Back to Sign In
    </ShellLink>
  );
}

const RESEND_SECONDS = 60;

export function ForgotPasswordForm() {
  const params = useSearchParams();
  const returnTo = safeReturnTo(params.get("returnTo"));
  const { providers, failed } = useProviders();
  const [email, setEmail] = useDraftField("email");
  const [touched, setTouched] = useState(false);
  const [state, setState] = useState<SubmitState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const [wait, setWait] = useState(0);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  async function send(e?: FormEvent) {
    e?.preventDefault();
    setTouched(true);
    setError(null);
    if (emailProblem(email)) return ref.current?.focus();
    setState("loading");
    try {
      const r = await authApi.forgotPassword(email.trim());
      setSent(r.message);
      setWait(RESEND_SECONDS);
    } catch (err) {
      setError(authMessage(err));
    } finally {
      setState("idle");
    }
  }

  const unavailable = providers && !providers.passwordReset;
  return (
    <AuthCard>
      <motion.div variants={stagger} initial="hidden" animate="show">
        <Rise><BackToSignIn returnTo={returnTo} /></Rise>
        <Rise><p className="eyebrow mt-6">Forgot password</p></Rise>
        <Rise><h1 className="h-display mt-2 text-[2.1rem] leading-[1.05] text-forest sm:text-[2.4rem]">Let&apos;s get you <em className="text-burgundy">back in.</em></h1></Rise>
        <Rise><p className="mt-3 text-[15px] text-forest/75">Enter the email you signed up with and we&apos;ll send a secure link to choose a new password.</p></Rise>

        <div className="mt-6 space-y-3">
          <AnimatePresence>
            {failed && <Notice tone="warn">Can&apos;t reach the RANNAMATE server right now. Please try again once it&apos;s running.</Notice>}
            {error && <Notice tone="error">{error}</Notice>}
          </AnimatePresence>
        </div>

        <AnimatePresence mode="wait">
          {unavailable ? (
            // honest: no email service → no "send" button that would pretend to work
            <motion.div key="off" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-4 rounded-2xl bg-white/50 p-5 ring-1 ring-white/80">
              <p className="font-display text-lg font-semibold text-forest">Password reset by email isn&apos;t available yet</p>
              <p className="mt-1.5 text-sm leading-relaxed text-forest/75">This RANNAMATE server doesn&apos;t have an email service set up, so it can&apos;t send reset links. Please contact the site owner, or try again later.</p>
            </motion.div>
          ) : sent ? (
            <motion.div key="sent" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="mt-4 rounded-2xl bg-forest/[0.07] p-5 ring-1 ring-forest/15" role="status">
              <motion.div initial={{ scale: 0, rotate: -20 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 300, damping: 16 }} className="grid h-12 w-12 place-items-center rounded-2xl bg-forest text-cream-50">
                <MailCheck className="h-6 w-6" />
              </motion.div>
              <p className="mt-3 font-display text-lg font-semibold text-forest">Check your inbox</p>
              <p className="mt-1 text-sm leading-relaxed text-forest/75">{sent} Don&apos;t forget your spam folder.</p>
              <button type="button" onClick={() => send()} disabled={wait > 0 || state === "loading"}
                className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-burgundy underline-offset-4 enabled:hover:underline disabled:cursor-not-allowed disabled:text-forest/45">
                <TimerReset className="h-4 w-4" /> {wait > 0 ? `Send again in ${wait}s` : state === "loading" ? "Sending…" : "Send again"}
              </button>
            </motion.div>
          ) : (
            <motion.form key="form" onSubmit={send} noValidate className="mt-4 space-y-4" aria-label="Request a password reset link" exit={{ opacity: 0, y: -8 }}>
              <Rise>
                <Field ref={ref} label="Email address" icon={Mail} type="email" name="email" autoComplete="email" inputMode="email" autoCapitalize="none" spellCheck={false} maxLength={190}
                  value={email} onChange={(e) => setEmail(e.target.value)} onBlur={() => setTouched(true)} error={touched ? emailProblem(email) : null} valid={!!email && !emailProblem(email)} />
              </Rise>
              <Rise>
                <SubmitButton state={state} loadingText="Sending the link…" successText="Sent" disabled={!providers}>Send Reset Link</SubmitButton>
              </Rise>
            </motion.form>
          )}
        </AnimatePresence>
      </motion.div>
    </AuthCard>
  );
}

export function ResetPasswordForm() {
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const { go } = useAuthShell();
  const [check, setCheck] = useState<"checking" | "valid" | "invalid" | "offline">("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [state, setState] = useState<SubmitState>("idle");
  const [error, setError] = useState<string | null>(null);
  const pRef = useRef<HTMLInputElement>(null);
  const cRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!/^[A-Za-z0-9_-]{40,64}$/.test(token)) { setCheck("invalid"); return; }
    authApi.checkResetToken(token).then((r) => setCheck(r.valid ? "valid" : "invalid")).catch(() => setCheck("offline"));
  }, [token]);

  const pErr = submitted || password ? passwordProblem(password) : null;
  const cErr = confirm || submitted ? (!confirm ? "Confirm your new password" : confirm !== password ? "Passwords don't match" : null) : null;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    setError(null);
    if (passwordProblem(password)) return pRef.current?.focus();
    if (!confirm || confirm !== password) return cRef.current?.focus();
    setState("loading");
    try {
      await authApi.resetPassword(token, password);
      setState("success");
      setPassword(""); setConfirm("");
      window.setTimeout(() => go("/sign-in?reset=1", { replace: true }), 1100);
    } catch (err) {
      setState("idle");
      setError(authMessage(err));
    }
  }

  return (
    <AuthCard>
      <motion.div variants={stagger} initial="hidden" animate="show">
        <Rise><BackToSignIn returnTo="/" /></Rise>
        <Rise><p className="eyebrow mt-6">Reset password</p></Rise>
        <Rise><h1 className="h-display mt-2 text-[2.1rem] leading-[1.05] text-forest sm:text-[2.4rem]">Choose a <em className="text-burgundy">new password.</em></h1></Rise>
        <Rise><p className="mt-3 text-[15px] text-forest/75">Make it something you haven&apos;t used here before. Changing it signs you out on every device.</p></Rise>

        <div className="mt-6 space-y-3"><AnimatePresence>{error && <Notice tone="error">{error}</Notice>}</AnimatePresence></div>

        {check === "checking" && <div className="mt-4 h-40 animate-pulse rounded-2xl bg-white/40" aria-label="Checking your link" />}
        {check === "offline" && <Notice tone="warn">Can&apos;t reach the RANNAMATE server to check this link. Please try again once it&apos;s running.</Notice>}
        {check === "invalid" && (
          <div className="mt-4 rounded-2xl bg-white/50 p-5 ring-1 ring-white/80">
            <p className="font-display text-lg font-semibold text-forest">This link has expired or was already used</p>
            <p className="mt-1.5 text-sm text-forest/75">Reset links work once and only for a short time.</p>
            <ShellLink href="/forgot-password" className="btn-primary mt-4">Request a new link</ShellLink>
          </div>
        )}
        {check === "valid" && (
          <form onSubmit={onSubmit} noValidate className="mt-4 space-y-4" aria-label="Set a new password">
            {/* lets password managers store the new password for the right account */}
            <input type="text" name="username" autoComplete="username" hidden readOnly value="" />
            <Rise>
              <PasswordField ref={pRef} label="New password" icon={Lock} name="new-password" autoComplete="new-password" maxLength={72} value={password} onChange={(e) => setPassword(e.target.value)} error={pErr} />
              <PasswordStrength password={password} />
            </Rise>
            <Rise>
              <PasswordField ref={cRef} label="Confirm new password" icon={ShieldCheck} name="confirm-password" autoComplete="new-password" maxLength={72} value={confirm} onChange={(e) => setConfirm(e.target.value)} error={cErr}
                hint={!cErr && confirm && confirm === password ? "Passwords match" : undefined} />
            </Rise>
            <Rise className="pt-1"><SubmitButton state={state} loadingText="Saving…" successText="Password changed!">Save New Password</SubmitButton></Rise>
          </form>
        )}
      </motion.div>
    </AuthCard>
  );
}
