"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { motion, MotionConfig, type Variants } from "framer-motion";
import Link from "next/link";
import { AuthStage, AuthStageCompact, type StageMode } from "./AuthStage";
import { useAuth } from "@/lib/auth/AuthProvider";
import { authEnabled } from "@/lib/auth/enabled";

/** order of the pages left→right, so transitions slide the way you're "moving" */
const ORDER: Record<string, number> = { "/forgot-password": 0, "/reset-password": 0, "/sign-in": 1, "/auth/callback": 1, "/sign-up": 2 };
const modeOf = (p: string): StageMode => (p === "/sign-up" ? "sign-up" : p === "/forgot-password" || p === "/reset-password" ? "recover" : "sign-in");

interface ShellNav {
  /** animate the form out, then navigate (client-side; no reload) */
  go(href: string, opts?: { replace?: boolean }): void;
  leaving: boolean;
}
const ShellContext = createContext<ShellNav>({ go: () => undefined, leaving: false });
export const useAuthShell = () => useContext(ShellContext);

/**
 * Shared frame for Sign In / Sign Up / Forgot / Reset. It stays mounted while you move between them,
 * so the culinary stage morphs instead of reloading; only the form card slides and fades.
 */
export function AuthShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/sign-in";
  const router = useRouter();
  const [leaving, setLeaving] = useState<null | number>(null);
  const prev = useRef(pathname);
  const dir = useRef(0);
  if (prev.current !== pathname) {
    dir.current = Math.sign((ORDER[pathname] ?? 1) - (ORDER[prev.current] ?? 1));
    prev.current = pathname;
  }
  useEffect(() => { setLeaving(null); }, [pathname]);

  const go = useCallback((href: string, opts?: { replace?: boolean }) => {
    const target = href.split("?")[0];
    setLeaving(Math.sign((ORDER[target] ?? 1) - (ORDER[pathname] ?? 1)) || 1);
    window.setTimeout(() => (opts?.replace ? router.replace(href) : router.push(href)), 230);
  }, [pathname, router]);

  const { status } = useAuth();
  // decided after mount (it depends on the site's address); the forms only mount when sign-in is available
  const [enabled, setEnabled] = useState<boolean | null>(null);
  useEffect(() => { setEnabled(authEnabled()); }, []);
  const mode = modeOf(pathname);
  const d = dir.current;
  return (
    <MotionConfig reducedMotion="user">
      <ShellContext.Provider value={{ go, leaving: leaving !== null }}>
        <div className="relative z-10 min-h-[100svh] overflow-x-clip">
          <div className="mx-auto grid min-h-[100svh] max-w-[1440px] gap-4 p-3 sm:p-5 lg:grid-cols-[1.06fr_0.94fr] lg:gap-6 lg:p-6">
            <div className="hidden lg:block">
              <div className="sticky top-6 h-[calc(100svh-3rem)]"><AuthStage mode={mode} /></div>
            </div>
            <div className="lg:hidden"><AuthStageCompact mode={mode} /></div>
            <main className="flex items-start justify-center pb-6 lg:items-center lg:pb-0">
              <motion.div
                key={pathname}
                className="w-full max-w-[468px]"
                initial={{ opacity: 0, x: d * 48, filter: "blur(8px)" }}
                animate={leaving !== null ? { opacity: 0, x: -leaving * 48, filter: "blur(8px)" } : { opacity: 1, x: 0, filter: "blur(0px)" }}
                transition={{ duration: leaving !== null ? 0.22 : 0.5, ease: [0.22, 1, 0.36, 1] }}
              >
                {enabled === false || status === "disabled" ? <AccountsComingSoon /> : enabled ? children : null}
              </motion.div>
            </main>
          </div>
        </div>
      </ShellContext.Provider>
    </MotionConfig>
  );
}

/** shown on the auth pages of a deployment that has no backend yet — honest, and every button works */
function AccountsComingSoon() {
  return (
    <div className="glass-strong glass-sheen relative rounded-[2.2rem] p-6 text-center sm:p-9">
      <p className="eyebrow">Accounts</p>
      <h1 className="h-display mt-2 text-[2rem] leading-[1.08] text-forest sm:text-[2.4rem]">Sign-in is <em className="text-burgundy">coming soon.</em></h1>
      <p className="mx-auto mt-3 max-w-sm text-[15px] text-forest/75">Accounts aren&apos;t switched on for this site yet. Everything else works — your kitchen, Tastory and preferences are saved in this browser.</p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Link href="/" className="btn-primary">Back to the kitchen</Link>
        <Link href="/discover" className="btn-ghost">Discover recipes</Link>
      </div>
    </div>
  );
}

/** staggered entrance for the pieces of a form */
export const stagger: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.055, delayChildren: 0.08 } } };
export const rise: Variants = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } } };
export function Rise({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <motion.div variants={rise} className={className}>{children}</motion.div>;
}
