"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef } from "react";
import { AnimatePresence, motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { Sparkles } from "lucide-react";
import { LogoMark, Wordmark } from "@/components/Logo";
import { OrbitField, type OrbitItem } from "@/components/OrbitField";
import { usePrefersReducedMotion } from "@/lib/useReducedMotion";

export type StageMode = "sign-in" | "sign-up" | "recover";

const ITEMS: OrbitItem[] = ["🍅", "🌿", "🧄", "🌶️", "🍋", "🥕", "🧅", "🍄", "🫑", "🥚"].map((emoji, i) => ({
  emoji, size: 34 + (i % 3) * 10, ring: i % 3 === 0 ? 0.66 : 1,
}));

/** what changes on the stage between the pages — the stage itself stays mounted, so it morphs */
const SCENES: Record<StageMode, { dish: string; caption: string; glow: { x: string; y: string }; cards: [{ k: string; t: string }, { k: string; t: string }] }> = {
  "sign-in": {
    dish: "🥘",
    caption: "Pick up right where you left off — your kitchen, your memories and a Mate who remembers how you like it.",
    glow: { x: "18%", y: "22%" },
    cards: [{ k: "Cooking Mate", t: "“Welcome back! The pan's warm — what are we making?”" }, { k: "Tastory", t: "Every dish you've cooked, kept together." }],
  },
  "sign-up": {
    dish: "🍲",
    caption: "One account for your kitchen, your Tastory memories and recipes that respect your allergies and diet — everywhere you sign in.",
    glow: { x: "72%", y: "30%" },
    cards: [{ k: "My Kitchen", t: "Tell us what you have. We'll find what you can cook." }, { k: "Cooking Mate", t: "“First recipe together? I'll talk you through every step.”" }],
  },
  recover: {
    dish: "🍵",
    caption: "Happens to every cook. Take a breath — we'll get you back into your kitchen.",
    glow: { x: "45%", y: "18%" },
    cards: [{ k: "Your account", t: "Reset links work once and expire quickly." }, { k: "Cooking Mate", t: "“Tea while we sort this out?”" }],
  },
};

/** spice-dust particles: fixed pseudo-random layout so server and client render the same */
const PARTICLES = Array.from({ length: 22 }, (_, i) => {
  const r = (n: number) => ((Math.sin(i * 12.9898 + n * 78.233) * 43758.5453) % 1 + 1) % 1;
  return { left: `${4 + r(1) * 92}%`, size: 2 + r(2) * 3.5, delay: r(3) * 12, duration: 11 + r(4) * 10, drift: (r(5) - 0.5) * 60, warm: r(6) > 0.6 };
});

/**
 * The cinematic half of the sign-in experience: a deep-green "culinary studio" with drifting light,
 * rising spice dust, a slowly turning burner dial, a steaming plate and orbiting ingredients
 * (the same orbit as the homepage hero). Gentle pointer parallax; everything stills with reduced motion.
 */
export function AuthStage({ mode }: { mode: StageMode }) {
  const reduced = usePrefersReducedMotion();
  const scene = SCENES[mode];
  const ref = useRef<HTMLDivElement>(null);
  const px = useMotionValue(0.5);
  const py = useMotionValue(0.5);
  const sx = useSpring(px, { stiffness: 60, damping: 18 });
  const sy = useSpring(py, { stiffness: 60, damping: 18 });
  const rotY = useTransform(sx, [0, 1], [-4, 4]);
  const rotX = useTransform(sy, [0, 1], [3, -3]);
  const lightX = useTransform(sx, (v) => `${v * 100}%`);
  const lightY = useTransform(sy, (v) => `${v * 100}%`);
  const spotlight = useTransform([lightX, lightY], ([x, y]) => `radial-gradient(520px circle at ${x} ${y}, rgba(245,218,191,0.13), transparent 60%)`);

  useEffect(() => {
    if (reduced) return;
    const el = ref.current;
    if (!el) return;
    const on = (e: PointerEvent) => {
      const b = el.getBoundingClientRect();
      px.set(Math.min(1, Math.max(0, (e.clientX - b.left) / b.width)));
      py.set(Math.min(1, Math.max(0, (e.clientY - b.top) / b.height)));
    };
    window.addEventListener("pointermove", on, { passive: true });
    return () => window.removeEventListener("pointermove", on);
  }, [reduced, px, py]);

  const loop = (d: number, extra: object = {}) => (reduced ? { duration: 0 } : { duration: d, repeat: Infinity, ease: "easeInOut" as const, ...extra });
  const steam = useMemo(() => [0, 1, 2], []);

  return (
    <div ref={ref} className="relative isolate flex h-full min-h-[640px] flex-col overflow-hidden rounded-[2.5rem] bg-forest-900 text-cream shadow-glass-lg">
      {/* base light */}
      <div aria-hidden className="absolute inset-0 bg-[radial-gradient(120%_90%_at_10%_0%,#14504B_0%,#0F3D3A_38%,#061B1A_100%)]" />
      {/* drifting glows — they move to a new spot for each page */}
      <motion.div aria-hidden className="absolute h-[34rem] w-[34rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-burgundy/45 blur-[110px]"
        animate={{ left: scene.glow.x, top: scene.glow.y }} transition={{ type: "spring", stiffness: 30, damping: 20 }} />
      <motion.div aria-hidden className="absolute bottom-[-18%] right-[-10%] h-[28rem] w-[28rem] rounded-full bg-[#E8A25A]/25 blur-[120px]"
        animate={reduced ? {} : { x: [0, -40, 0], y: [0, -30, 0], scale: [1, 1.08, 1] }} transition={loop(16)} />
      <motion.div aria-hidden className="absolute left-[-8%] top-[55%] h-72 w-72 rounded-full bg-cream/10 blur-[90px]"
        animate={reduced ? {} : { x: [0, 50, 0], opacity: [0.6, 1, 0.6] }} transition={loop(13)} />
      <motion.div aria-hidden className="absolute inset-0" style={{ background: spotlight }} />
      {/* fine grain */}
      <div aria-hidden className="absolute inset-0 opacity-[0.07] mix-blend-overlay"
        style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")" }} />
      {/* rising spice dust */}
      {!reduced && (
        <div aria-hidden className="pointer-events-none absolute inset-0">
          {PARTICLES.map((p, i) => (
            <motion.span key={i} className={`absolute bottom-[-10px] rounded-full ${p.warm ? "bg-[#E8A25A]" : "bg-cream"}`}
              style={{ left: p.left, width: p.size, height: p.size, boxShadow: `0 0 ${p.size * 3}px ${p.warm ? "rgba(232,162,90,0.8)" : "rgba(245,218,191,0.7)"}` }}
              initial={{ y: 0, opacity: 0 }}
              animate={{ y: [-10, -720], x: [0, p.drift], opacity: [0, 0.75, 0.75, 0] }}
              transition={{ duration: p.duration, delay: p.delay, repeat: Infinity, ease: "linear", times: [0, 0.15, 0.8, 1] }} />
          ))}
        </div>
      )}

      {/* top bar */}
      <div className="relative z-10 flex items-center justify-between p-7 xl:p-9">
        <Link href="/" className="flex items-center gap-2.5 text-cream-50 transition hover:opacity-90" aria-label="RANNAMATE home">
          <LogoMark className="h-9 w-9" />
          <Wordmark className="text-[15px]" />
        </Link>
        <span className="glass-dark inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-cream/90">
          <Sparkles className="h-3.5 w-3.5" /> AI cooking companion
        </span>
      </div>

      {/* the plate */}
      <motion.div className="relative z-10 flex flex-1 items-center justify-center [perspective:1200px]" style={{ rotateX: rotX, rotateY: rotY }}>
        <div className="relative h-[340px] w-full max-w-[520px]">
          {/* burner dial */}
          <div aria-hidden className="absolute left-1/2 top-1/2 h-[380px] w-[380px] -translate-x-1/2 -translate-y-1/2 opacity-60">
          <motion.svg viewBox="0 0 400 400" className="h-full w-full"
            animate={reduced ? {} : { rotate: 360 }} transition={reduced ? {} : { duration: 120, repeat: Infinity, ease: "linear" }}>
            <circle cx="200" cy="200" r="188" fill="none" stroke="rgba(245,218,191,0.14)" strokeWidth="1" />
            <circle cx="200" cy="200" r="150" fill="none" stroke="rgba(245,218,191,0.10)" strokeWidth="1" strokeDasharray="2 9" />
            {Array.from({ length: 60 }, (_, i) => {
              const a = (i / 60) * Math.PI * 2;
              const long = i % 5 === 0;
              return <line key={i} x1={200 + Math.cos(a) * (long ? 172 : 178)} y1={200 + Math.sin(a) * (long ? 172 : 178)} x2={200 + Math.cos(a) * 184} y2={200 + Math.sin(a) * 184} stroke={long ? "rgba(232,162,90,0.55)" : "rgba(245,218,191,0.18)"} strokeWidth={long ? 2 : 1} strokeLinecap="round" />;
            })}
          </motion.svg>
          </div>
          {/* glass plate */}
          <div className="glass-dark absolute left-1/2 top-1/2 flex h-52 w-52 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full xl:h-56 xl:w-56">
            <div className="absolute inset-4 rounded-full border border-cream/20 bg-gradient-to-br from-cream/15 to-transparent" />
            <div className="absolute inset-0 rounded-full shadow-[0_0_80px_-10px_rgba(232,162,90,0.45)]" />
            {/* steam */}
            {!reduced && steam.map((i) => (
              <motion.svg key={i} aria-hidden viewBox="0 0 20 60" className="absolute -top-12 h-16 w-5" style={{ left: `${38 + i * 12}%` }}
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: [0, 0.55, 0], y: [10, -18, -34] }} transition={{ duration: 3.6, delay: i * 1.1, repeat: Infinity, ease: "easeOut" }}>
                <path d="M10 58 C2 46, 18 38, 10 26 C3 15, 16 9, 10 2" fill="none" stroke="rgba(253,247,241,0.75)" strokeWidth="2.2" strokeLinecap="round" />
              </motion.svg>
            ))}
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span key={scene.dish} className="relative text-[6.2rem] drop-shadow-[0_22px_26px_rgba(0,0,0,0.45)]"
                initial={{ opacity: 0, scale: 0.6, rotate: -25, y: 20 }} animate={{ opacity: 1, scale: 1, rotate: 0, y: 0 }} exit={{ opacity: 0, scale: 0.6, rotate: 25, y: -20 }}
                transition={{ type: "spring", stiffness: 180, damping: 18 }}>
                <motion.span className="block" animate={reduced ? {} : { y: [0, -6, 0], rotate: [0, 3, -3, 0] }} transition={loop(7)}>{scene.dish}</motion.span>
              </motion.span>
            </AnimatePresence>
          </div>
          <OrbitField items={ITEMS} radius={215} tilt={0.42} speed={0.22} parallax={14} reduced={reduced} />
          {/* floating notes */}
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={mode} className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }}>
              <motion.div className="glass-dark absolute right-0 top-0 z-[120] max-w-[230px] rounded-2xl px-4 py-3"
                initial={{ x: 24, opacity: 0 }} animate={{ x: 0, opacity: 1, y: reduced ? 0 : [0, -8, 0] }}
                transition={{ x: { delay: 0.15 }, opacity: { delay: 0.15 }, y: loop(6) }}>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#E8A25A]">{scene.cards[0].k}</p>
                <p className="mt-0.5 text-sm text-cream-50/90">{scene.cards[0].t}</p>
              </motion.div>
              <motion.div className="glass-dark absolute bottom-0 left-0 z-[120] max-w-[230px] rounded-2xl px-4 py-3"
                initial={{ x: -24, opacity: 0 }} animate={{ x: 0, opacity: 1, y: reduced ? 0 : [0, 8, 0] }}
                transition={{ x: { delay: 0.3 }, opacity: { delay: 0.3 }, y: loop(7) }}>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#E8A25A]">{scene.cards[1].k}</p>
                <p className="mt-0.5 text-sm text-cream-50/90">{scene.cards[1].t}</p>
              </motion.div>
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.div>

      {/* tagline */}
      <div className="relative z-10 p-7 pt-2 xl:p-9 xl:pt-2">
        <h2 className="h-display text-[2.6rem] leading-[1.02] text-cream-50 xl:text-[3.3rem]">
          {["Your Kitchen.", "Your Mood.", "Your Mate."].map((line, i) => (
            <span key={line} className="block overflow-hidden pb-1">
              <motion.span className={`block ${i === 2 ? "italic text-[#EFC9A3]" : ""}`} initial={{ y: "105%" }} animate={{ y: 0 }}
                transition={{ delay: 0.1 + i * 0.12, duration: 0.9, ease: [0.22, 1, 0.36, 1] }}>{line}</motion.span>
            </span>
          ))}
        </h2>
        <div className="mt-4 min-h-[3.2rem] max-w-md">
          <AnimatePresence mode="wait" initial={false}>
            <motion.p key={mode} className="text-[15px] leading-relaxed text-cream/75"
              initial={{ opacity: 0, y: 8, filter: "blur(4px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} exit={{ opacity: 0, y: -8, filter: "blur(4px)" }} transition={{ duration: 0.35 }}>
              {scene.caption}
            </motion.p>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

/** Phones & small tablets: a compact, calmer version of the stage above the form. */
export function AuthStageCompact({ mode }: { mode: StageMode }) {
  const reduced = usePrefersReducedMotion();
  const scene = SCENES[mode];
  return (
    <div className="relative isolate overflow-hidden rounded-[2rem] bg-forest-900 px-5 pb-5 pt-4 text-cream shadow-glass">
      <div aria-hidden className="absolute inset-0 bg-[radial-gradient(120%_120%_at_0%_0%,#14504B_0%,#0F3D3A_45%,#061B1A_100%)]" />
      <motion.div aria-hidden className="absolute h-56 w-56 -translate-x-1/2 -translate-y-1/2 rounded-full bg-burgundy/50 blur-[70px]"
        animate={{ left: scene.glow.x, top: "40%" }} transition={{ type: "spring", stiffness: 30, damping: 20 }} />
      <div className="relative flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 text-cream-50" aria-label="RANNAMATE home">
          <LogoMark className="h-8 w-8" />
          <Wordmark className="text-[13px]" />
        </Link>
        <span className="hidden text-[10px] font-bold uppercase tracking-[0.2em] text-cream/70 sm:inline">Your Kitchen. Your Mood. Your Mate.</span>
      </div>
      <div className="relative mt-3 flex items-center gap-4">
        <div className="glass-dark relative grid h-20 w-20 shrink-0 place-items-center rounded-full">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span key={scene.dish} className="text-[2.6rem] drop-shadow-[0_10px_14px_rgba(0,0,0,0.4)]"
              initial={{ opacity: 0, scale: 0.6, rotate: -20 }} animate={{ opacity: 1, scale: 1, rotate: 0 }} exit={{ opacity: 0, scale: 0.6 }}
              transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 200, damping: 18 }}>{scene.dish}</motion.span>
          </AnimatePresence>
        </div>
        <AnimatePresence mode="wait" initial={false}>
          <motion.p key={mode} className="text-[13px] leading-snug text-cream/80" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {scene.caption}
          </motion.p>
        </AnimatePresence>
      </div>
    </div>
  );
}
