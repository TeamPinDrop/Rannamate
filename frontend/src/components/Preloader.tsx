"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { OrbitField, type OrbitItem } from "./OrbitField";
import { LogoMark } from "./Logo";
export const INTRO_DONE_EVENT = "rannamate:intro-done";
import { usePrefersReducedMotion, useViewportWidth } from "@/lib/useReducedMotion";

const KEY = "rannamate:intro-played";
const TOTAL_MS = 6200;
const CONVERGE_START = 2600;
const CONVERGE_END = 3900;

const ITEMS: OrbitItem[] = [
  "🍅", "🧅", "🥔", "🌶️", "🌿", "🥕", "🫑", "🍄", "🥚", "🍋", "🥦", "🧄", "🍎", "🌽", "🥑", "🫛",
].map((emoji, i) => ({ emoji, size: 44 + (i % 3) * 14, ring: i % 2 ? 0.62 : 1, phase: (i / 16) * Math.PI * 2 }));

/**
 * Plays once per browser session. Video-ready: drop a file at /public/videos/intro.mp4
 * and set NEXT_PUBLIC_INTRO_VIDEO=1 to use it; the animated fallback is used otherwise.
 */
export function Preloader() {
  const [show, setShow] = useState<boolean | null>(null);
  const [phase, setPhase] = useState<"orbit" | "logo">("orbit");
  const reduced = usePrefersReducedMotion();
  const vw = useViewportWidth();
  const start = useRef(0);

  const done = useCallback(() => {
    try { sessionStorage.setItem(KEY, "1"); } catch { /* ignore */ }
    setShow(false);
    window.dispatchEvent(new Event(INTRO_DONE_EVENT)); // IntroGate then opens Sign In for signed-out visitors
  }, []);

  useEffect(() => {
    let played = false;
    try { played = sessionStorage.getItem(KEY) === "1"; } catch { /* ignore */ }
    // coming back from Google or from a password-reset email goes straight to the page (no intro)
    const path = window.location.pathname;
    setShow(!played && path !== "/reset-password" && path !== "/auth/callback");
  }, []);

  useEffect(() => {
    if (!show) return;
    start.current = performance.now();
    document.documentElement.style.overflow = "hidden";
    const dur = reduced ? 1400 : TOTAL_MS;
    const logoT = setTimeout(() => setPhase("logo"), reduced ? 0 : CONVERGE_END - 300);
    const endT = setTimeout(done, dur);
    // hard fail-safe: never block the site
    const safety = setTimeout(done, 9000);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") done(); };
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(logoT); clearTimeout(endT); clearTimeout(safety);
      window.removeEventListener("keydown", onKey);
      document.documentElement.style.overflow = "";
    };
  }, [show, reduced, done]);

  const getConverge = useCallback(() => {
    const t = performance.now() - start.current;
    return (t - CONVERGE_START) / (CONVERGE_END - CONVERGE_START);
  }, []);

  const radius = Math.min(vw * 0.42, 420);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="preloader"
          role="dialog"
          aria-label="RANNAMATE intro"
          className="fixed inset-0 z-[100] overflow-hidden bg-cream"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.04, filter: "blur(8px)" }}
          transition={{ duration: 0.9, ease: [0.65, 0, 0.35, 1] }}
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,#FDF3E8_0%,#F5DABF_55%,#E9C39E_100%)]" />
          <motion.div
            className="absolute inset-0"
            initial={{ scale: 1.25 }}
            animate={{ scale: 1 }}
            transition={{ duration: 4, ease: [0.22, 1, 0.36, 1] }}
          >
            {!reduced && <OrbitField items={ITEMS} radius={radius} tilt={0.42} speed={0.9} getConverge={getConverge} />}
          </motion.div>

          {/* convergence glow */}
          <motion.div
            className="absolute inset-0 m-auto h-64 w-64 rounded-full bg-burgundy/30 blur-3xl"
            initial={{ opacity: 0, scale: 0.4 }}
            animate={phase === "logo" ? { opacity: 1, scale: 1.4 } : {}}
            transition={{ duration: 1.2 }}
          />

          <AnimatePresence>
            {phase === "logo" && (
              <motion.div
                className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <motion.div
                  className="glass-strong glass-sheen mb-6 rounded-full p-5"
                  initial={{ scale: 0.2, rotate: -40 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 160, damping: 14 }}
                >
                  <LogoMark className="relative h-14 w-14" />
                </motion.div>
                <h1 className="overflow-hidden font-display text-5xl font-semibold tracking-[0.2em] text-burgundy sm:text-7xl">
                  {"RANNAMATE".split("").map((c, i) => (
                    <motion.span
                      key={i}
                      className="inline-block"
                      initial={{ y: "110%" }}
                      animate={{ y: 0 }}
                      transition={{ delay: 0.25 + i * 0.05, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                    >
                      {c}
                    </motion.span>
                  ))}
                </h1>
                <motion.p
                  className="mt-4 font-display text-lg italic text-forest sm:text-2xl"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.9, duration: 0.8 }}
                >
                  Your Kitchen. Your Mood. Your Mate.
                </motion.p>
              </motion.div>
            )}
          </AnimatePresence>

          <button
            onClick={done}
            className="glass absolute bottom-6 right-6 rounded-full px-5 py-2.5 text-sm font-semibold text-forest hover:bg-white/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-forest"
          >
            Skip intro
          </button>
          <motion.div
            className="absolute bottom-0 left-0 h-[3px] bg-burgundy"
            initial={{ width: "0%" }}
            animate={{ width: "100%" }}
            transition={{ duration: (reduced ? 1400 : TOTAL_MS) / 1000, ease: "linear" }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
