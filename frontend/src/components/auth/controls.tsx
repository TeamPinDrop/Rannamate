"use client";
import Link from "next/link";
import { forwardRef, useId, useState, type InputHTMLAttributes, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, ArrowRight, Check, CheckCircle2, Eye, EyeOff, Info, Loader2, type LucideIcon } from "lucide-react";
import { LogoMark, Wordmark } from "@/components/Logo";
import { useAuthShell } from "./AuthShell";

// ─────────────────────────── text field with floating label ───────────────────────────

interface FieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "placeholder"> {
  label: string;
  icon: LucideIcon;
  error?: string | null;
  hint?: ReactNode;
  valid?: boolean;
  trailing?: ReactNode;
}

export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field({ label, icon: Icon, error, hint, valid, trailing, id, className = "", ...input }, ref) {
  const auto = useId();
  const fid = id ?? auto;
  const msgId = `${fid}-msg`;
  return (
    <div className={className}>
      <motion.div
        animate={error ? { x: [0, -6, 6, -4, 4, 0] } : { x: 0 }}
        transition={{ duration: 0.4 }}
        className={`group relative rounded-2xl bg-white/55 ring-1 transition duration-300 focus-within:bg-white/85 focus-within:shadow-[0_10px_30px_-14px_rgba(15,61,58,0.45)] ${
          error ? "ring-burgundy/60" : "ring-white/80 focus-within:ring-forest/35"
        }`}
      >
        <Icon aria-hidden className={`pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 transition-colors ${error ? "text-burgundy" : "text-forest/45 group-focus-within:text-burgundy"}`} />
        <input
          ref={ref}
          id={fid}
          placeholder=" "
          aria-invalid={!!error}
          aria-describedby={error || hint ? msgId : undefined}
          className="auth-input peer h-[3.6rem] w-full rounded-2xl bg-transparent pb-2 pl-11 pr-12 pt-6 text-[15px] font-medium text-forest outline-none"
          {...input}
        />
        <label
          htmlFor={fid}
          className="pointer-events-none absolute left-11 top-1/2 origin-left -translate-y-1/2 text-[15px] text-forest/55 transition-all duration-200
            peer-focus:top-[1.05rem] peer-focus:text-[11px] peer-focus:font-bold peer-focus:uppercase peer-focus:tracking-[0.14em] peer-focus:text-burgundy/85
            peer-[:not(:placeholder-shown)]:top-[1.05rem] peer-[:not(:placeholder-shown)]:text-[11px] peer-[:not(:placeholder-shown)]:font-bold peer-[:not(:placeholder-shown)]:uppercase peer-[:not(:placeholder-shown)]:tracking-[0.14em] peer-[:not(:placeholder-shown)]:text-forest/60"
        >
          {label}
        </label>
        <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center">
          {trailing}
          <AnimatePresence>
            {valid && !error && !trailing && (
              <motion.span key="ok" initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0 }} className="mr-2 grid h-6 w-6 place-items-center rounded-full bg-forest text-cream-50">
                <Check className="h-3.5 w-3.5" strokeWidth={3} />
              </motion.span>
            )}
          </AnimatePresence>
        </div>
        {/* animated underline */}
        <span aria-hidden className="pointer-events-none absolute inset-x-5 bottom-0 h-[2px] origin-left scale-x-0 rounded-full bg-gradient-to-r from-burgundy via-burgundy-300 to-forest transition-transform duration-500 ease-out group-focus-within:scale-x-100" />
      </motion.div>
      <AnimatePresence initial={false}>
        {(error || hint) && (
          <motion.div key={error ? `e:${error}` : "hint"} id={msgId} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className={`flex items-start gap-1.5 px-2 pt-1.5 text-[13px] ${error ? "font-semibold text-burgundy" : "text-forest/65"}`} role={error ? "alert" : undefined}>
              {error && <AlertCircle aria-hidden className="mt-[2px] h-3.5 w-3.5 shrink-0" />}
              <span>{error ?? hint}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

/** password field with a show/hide toggle (the toggle is a real button, reachable by keyboard) */
export const PasswordField = forwardRef<HTMLInputElement, Omit<FieldProps, "type" | "trailing">>(function PasswordField(props, ref) {
  const [show, setShow] = useState(false);
  return (
    <Field
      {...props}
      ref={ref}
      type={show ? "text" : "password"}
      autoCapitalize="none"
      spellCheck={false}
      trailing={
        <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"} aria-pressed={show}
          className="grid h-10 w-10 place-items-center rounded-xl text-forest/55 transition hover:bg-forest/5 hover:text-forest focus-visible:outline focus-visible:outline-2 focus-visible:outline-forest">
          <AnimatePresence mode="wait" initial={false}>
            <motion.span key={show ? "hide" : "show"} initial={{ opacity: 0, rotate: -30, scale: 0.7 }} animate={{ opacity: 1, rotate: 0, scale: 1 }} exit={{ opacity: 0, rotate: 30, scale: 0.7 }} transition={{ duration: 0.15 }}>
              {show ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
            </motion.span>
          </AnimatePresence>
        </button>
      }
    />
  );
});

// ─────────────────────────── password strength ───────────────────────────

export const PASSWORD_RULES = [
  { id: "len", label: "8+ characters", test: (p: string) => p.length >= 8 },
  { id: "letter", label: "A letter", test: (p: string) => /[A-Za-z]/.test(p) },
  { id: "number", label: "A number", test: (p: string) => /\d/.test(p) },
];
/** same minimum as the backend; extra points for length, mixed case and symbols */
export function passwordProblem(p: string): string | null {
  if (!p) return "Enter a password";
  if (p.length > 72) return "Password must be at most 72 characters";
  const miss = PASSWORD_RULES.find((r) => !r.test(p));
  return miss ? `Password needs ${miss.label.toLowerCase()}` : null;
}
export function passwordScore(p: string): 0 | 1 | 2 | 3 | 4 {
  if (!p) return 0;
  const base = PASSWORD_RULES.filter((r) => r.test(p)).length; // 0..3
  if (base < 3) return base >= 2 ? 1 : 0;
  let s = 2;
  if (p.length >= 12) s++;
  if ((/[a-z]/.test(p) && /[A-Z]/.test(p)) || /[^A-Za-z0-9]/.test(p)) s++;
  return Math.min(4, s) as 2 | 3 | 4;
}
const LEVELS = [
  { label: "Too weak", color: "#B04A55" },
  { label: "Weak", color: "#B04A55" },
  { label: "Okay", color: "#E8A25A" },
  { label: "Strong", color: "#3F7A75" },
  { label: "Excellent", color: "#0F3D3A" },
];

export function PasswordStrength({ password }: { password: string }) {
  const score = passwordScore(password);
  const level = LEVELS[score];
  return (
    <div className="px-1 pt-2.5" aria-live="polite">
      <div className="flex items-center gap-1.5">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-1.5 flex-1 overflow-hidden rounded-full bg-forest/10">
            <motion.div className="h-full rounded-full" initial={false} animate={{ width: score >= i ? "100%" : "0%", backgroundColor: level.color }} transition={{ duration: 0.35, ease: "easeOut" }} />
          </div>
        ))}
        <span className="ml-1.5 w-[4.6rem] text-right text-[11px] font-bold uppercase tracking-[0.12em]" style={{ color: password ? level.color : "rgba(15,61,58,0.45)" }}>
          {password ? level.label : "Strength"}
        </span>
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        {PASSWORD_RULES.map((r) => {
          const ok = r.test(password);
          return (
            <li key={r.id} className={`flex items-center gap-1.5 text-[12px] font-semibold transition-colors ${ok ? "text-forest" : "text-forest/50"}`}>
              <motion.span animate={{ scale: ok ? [1, 1.3, 1] : 1, backgroundColor: ok ? "#0F3D3A" : "rgba(15,61,58,0.12)" }} className="grid h-4 w-4 place-items-center rounded-full text-cream-50">
                {ok && <Check className="h-2.5 w-2.5" strokeWidth={4} />}
              </motion.span>
              {r.label}
              <span className="sr-only">{ok ? "(done)" : "(missing)"}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ─────────────────────────── checkbox ───────────────────────────

export function Checkbox({ checked, onChange, children, error, id }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode; error?: string | null; id?: string }) {
  const auto = useId();
  const cid = id ?? auto;
  return (
    <div>
      <label htmlFor={cid} className="group flex cursor-pointer select-none items-start gap-2.5 text-sm text-forest/80">
        <span className="relative mt-[1px] grid h-5 w-5 shrink-0 place-items-center">
          <input id={cid} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} aria-invalid={!!error} className="peer absolute inset-0 cursor-pointer appearance-none rounded-md bg-white/60 ring-1 ring-forest/25 transition checked:bg-burgundy checked:ring-burgundy focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-burgundy aria-[invalid=true]:ring-burgundy" />
          <motion.svg viewBox="0 0 16 16" className="pointer-events-none relative h-3.5 w-3.5" aria-hidden>
            <motion.path d="M3 8.5l3.2 3L13 4.5" fill="none" stroke="#FDF7F1" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"
              initial={false} animate={{ pathLength: checked ? 1 : 0 }} transition={{ duration: 0.25 }} />
          </motion.svg>
        </span>
        <span>{children}</span>
      </label>
      <AnimatePresence initial={false}>
        {error && (
          <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} role="alert" className="overflow-hidden pl-[1.85rem] pt-1 text-[13px] font-semibold text-burgundy">{error}</motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─────────────────────────── buttons ───────────────────────────

export type SubmitState = "idle" | "loading" | "success";

export function SubmitButton({ state, children, loadingText, successText, disabled }: { state: SubmitState; children: ReactNode; loadingText: string; successText: string; disabled?: boolean }) {
  const busy = state !== "idle";
  return (
    <>
    <motion.button
      type="submit"
      disabled={disabled || busy}
      aria-busy={state === "loading"}
      whileHover={busy ? undefined : { y: -1 }}
      whileTap={busy ? undefined : { scale: 0.985 }}
      className={`group relative flex h-[3.4rem] w-full items-center justify-center gap-2 overflow-hidden rounded-full text-[15px] font-bold text-cream-50 transition-colors duration-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-burgundy disabled:cursor-not-allowed ${
        state === "success" ? "bg-forest" : "bg-burgundy hover:bg-burgundy-700"
      } ${disabled && !busy ? "opacity-50" : ""}`}
      style={{ boxShadow: "0 14px 32px -12px rgba(108,21,30,0.65), inset 0 1px 0 rgba(255,255,255,0.22)" }}
    >
      {/* sheen sweep on hover */}
      <span aria-hidden className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-white/25 to-transparent opacity-0 transition-all duration-700 group-hover:left-[110%] group-hover:opacity-100" />
      <AnimatePresence mode="wait" initial={false}>
        <motion.span key={state} className="relative flex items-center gap-2" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }}>
          {state === "loading" && <><Loader2 className="h-[18px] w-[18px] animate-spin" aria-hidden /> {loadingText}</>}
          {state === "success" && <><motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 400, damping: 14 }}><CheckCircle2 className="h-5 w-5" aria-hidden /></motion.span> {successText}</>}
          {state === "idle" && <>{children} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden /></>}
        </motion.span>
      </AnimatePresence>
    </motion.button>
    <span className="sr-only" aria-live="polite">{state === "loading" ? loadingText : state === "success" ? successText : ""}</span>
    </>
  );
}

/** Real Google sign-in: a navigation to the backend, which redirects to Google. Rendered only when the server has Google configured. */
export function GoogleButton({ href, label = "Continue with Google" }: { href: string; label?: string }) {
  return (
    <a href={href} className="flex h-[3.2rem] w-full items-center justify-center gap-3 rounded-full bg-white/70 text-[15px] font-semibold text-forest ring-1 ring-white/90 transition hover:bg-white hover:shadow-[0_10px_26px_-12px_rgba(15,61,58,0.45)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest">
      <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden>
        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
      </svg>
      {label}
    </a>
  );
}

export function OrDivider() {
  return (
    <div className="flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.24em] text-forest/45" aria-hidden>
      <span className="h-px flex-1 bg-gradient-to-r from-transparent to-forest/20" /> or <span className="h-px flex-1 bg-gradient-to-l from-transparent to-forest/20" />
    </div>
  );
}

// ─────────────────────────── notices ───────────────────────────

export function Notice({ tone, children, action }: { tone: "error" | "success" | "info" | "warn"; children: ReactNode; action?: ReactNode }) {
  const styles = {
    error: "bg-burgundy/10 text-burgundy ring-burgundy/25",
    success: "bg-forest/10 text-forest ring-forest/25",
    info: "bg-white/50 text-forest ring-white/80",
    warn: "bg-[#E8A25A]/15 text-[#7a4a14] ring-[#E8A25A]/40",
  }[tone];
  const Icon = tone === "success" ? CheckCircle2 : tone === "error" ? AlertCircle : Info;
  return (
    <motion.div initial={{ opacity: 0, y: -6, height: 0 }} animate={{ opacity: 1, y: 0, height: "auto" }} exit={{ opacity: 0, y: -6, height: 0 }} className="overflow-hidden">
      <div role={tone === "error" ? "alert" : "status"} className={`flex items-start gap-2.5 rounded-2xl px-4 py-3 text-sm font-medium ring-1 ${styles}`}>
        <Icon aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="min-w-0 flex-1">{children}{action && <div className="mt-2">{action}</div>}</div>
      </div>
    </motion.div>
  );
}

// ─────────────────────────── card frame ───────────────────────────

/** The glass card every auth page sits in, with the Sign In / Sign Up switch on top. */
export function AuthCard({ children, tabs, tabHrefs }: { children: ReactNode; tabs?: "sign-in" | "sign-up"; tabHrefs?: { signIn: string; signUp: string } }) {
  const { go } = useAuthShell();
  return (
    <div className="glass-strong glass-sheen relative rounded-[2.2rem] p-6 sm:p-9">
      <div className="relative mb-7 flex items-center justify-between gap-3">
        <Link href="/" className="hidden items-center gap-2 text-burgundy lg:flex" aria-label="RANNAMATE home">
          <LogoMark className="h-8 w-8" />
          <Wordmark className="text-[13px]" />
        </Link>
        {tabs && tabHrefs && (
          <nav aria-label="Account" className="relative flex rounded-full bg-forest/[0.07] p-1 ring-1 ring-white/60 max-lg:mx-auto">
            {([["sign-in", "Sign In", tabHrefs.signIn], ["sign-up", "Sign Up", tabHrefs.signUp]] as const).map(([id, label, href]) => {
              const active = tabs === id;
              return (
                <Link key={id} href={href} aria-current={active ? "page" : undefined}
                  onClick={(e) => { if (active) { e.preventDefault(); return; } if (e.metaKey || e.ctrlKey || e.shiftKey) return; e.preventDefault(); go(href); }}
                  className={`relative rounded-full px-4 py-1.5 text-[13px] font-bold transition-colors ${active ? "text-cream-50" : "text-forest/70 hover:text-forest"}`}>
                  {active && <motion.span layoutId="auth-tab" className="absolute inset-0 rounded-full bg-forest" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
                  <span className="relative">{label}</span>
                </Link>
              );
            })}
          </nav>
        )}
      </div>
      {children}
    </div>
  );
}

/** a link that plays the card's exit animation before navigating (falls back to a normal link) */
export function ShellLink({ href, children, className = "" }: { href: string; children: ReactNode; className?: string }) {
  const { go } = useAuthShell();
  return (
    <Link href={href} className={className} onClick={(e) => { if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return; e.preventDefault(); go(href); }}>
      {children}
    </Link>
  );
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export function emailProblem(v: string): string | null {
  const e = v.trim();
  if (!e) return "Enter your email address";
  if (!EMAIL_RE.test(e) || e.length > 190) return "Enter a valid email address (like name@example.com)";
  return null;
}
