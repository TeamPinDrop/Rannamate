"use client";
import { AnimatePresence, motion } from "framer-motion";
import { MateAvatar, type AvatarMood, type AvatarState } from "@/components/mate/MateAvatar";
import { usePrefersReducedMotion } from "@/lib/useReducedMotion";
import type { Persona } from "@/lib/mate/types";

export type OrbState = "idle" | "listening" | "thinking" | "talking" | "celebrate" | "oops" | "paused";

/**
 * Cook & Chill's orb: a glassy, glowing sphere behind the same Mate face used everywhere else in
 * RANNAMATE — so it's the familiar Cooking Mate, just in "chill" mode.
 */
export function ChillOrb({ state, persona, size = 120 }: { state: OrbState; persona: Persona; size?: number }) {
  const reduced = usePrefersReducedMotion();
  const avatarState: AvatarState = state === "listening" ? "listening" : state === "thinking" ? "thinking" : state === "talking" ? "talking" : "idle";
  const mood: AvatarMood = state === "celebrate" ? "excited" : state === "thinking" ? "thinking" : state === "oops" ? "neutral" : "happy";
  const glow = state === "celebrate" ? "rgba(201,162,39,0.75)" : state === "oops" ? "rgba(176,74,85,0.7)" : state === "listening" ? "rgba(245,218,191,0.6)" : state === "thinking" ? "rgba(127,181,168,0.65)" : "rgba(108,21,30,0.55)";
  const loop = (d: number) => (reduced ? { duration: 0 } : { duration: d, repeat: Infinity, ease: "easeInOut" as const });

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} aria-hidden>
      {/* outer glow */}
      <motion.div
        className="absolute inset-0 rounded-full blur-2xl"
        animate={{ background: glow, scale: state === "talking" && !reduced ? [1, 1.12, 1] : state === "thinking" && !reduced ? [1, 1.06, 1] : 1, opacity: state === "paused" ? 0.25 : 0.9 }}
        transition={{ background: { duration: 0.5 }, scale: loop(state === "talking" ? 0.7 : 2.2), opacity: { duration: 0.4 } }}
      />
      {/* glass sphere */}
      <div
        className="absolute inset-[6%] rounded-full"
        style={{
          background: "radial-gradient(circle at 32% 26%, rgba(255,255,255,0.55), rgba(245,218,191,0.18) 28%, rgba(108,21,30,0.55) 62%, rgba(15,61,58,0.9) 100%)",
          boxShadow: "inset 0 -10px 30px rgba(0,0,0,0.35), inset 0 6px 18px rgba(255,255,255,0.35), 0 12px 40px -10px rgba(0,0,0,0.6)",
          border: "1px solid rgba(245,218,191,0.35)",
        }}
      />
      {/* rotating light ring */}
      <motion.div
        className="absolute inset-[2%] rounded-full"
        style={{ background: "conic-gradient(from 0deg, transparent 0 60%, rgba(245,218,191,0.55) 75%, transparent 90%)", WebkitMask: "radial-gradient(circle, transparent 64%, #000 66%, #000 70%, transparent 72%)", mask: "radial-gradient(circle, transparent 64%, #000 66%, #000 70%, transparent 72%)" }}
        animate={reduced ? {} : { rotate: 360 }}
        transition={{ duration: state === "thinking" ? 1.6 : 7, repeat: Infinity, ease: "linear" }}
      />
      {/* listening ripples */}
      <AnimatePresence>
        {state === "listening" && !reduced && [0, 1].map((k) => (
          <motion.span key={k} className="absolute inset-0 rounded-full border border-cream/60" initial={{ scale: 0.9, opacity: 0.7 }} animate={{ scale: 1.45, opacity: 0 }} exit={{ opacity: 0 }} transition={{ duration: 1.6, repeat: Infinity, delay: k * 0.8 }} />
        ))}
      </AnimatePresence>
      {/* celebration burst */}
      <AnimatePresence>
        {state === "celebrate" && !reduced && ["✨", "🎉", "⭐", "✨", "🌶️", "⭐"].map((e, k) => (
          <motion.span key={`${e}${k}`} className="absolute left-1/2 top-1/2 text-lg" initial={{ x: "-50%", y: "-50%", opacity: 1, scale: 0.4 }} animate={{ x: `calc(-50% + ${Math.cos((k / 6) * Math.PI * 2) * size * 0.62}px)`, y: `calc(-50% + ${Math.sin((k / 6) * Math.PI * 2) * size * 0.62}px)`, opacity: 0, scale: 1.2 }} exit={{ opacity: 0 }} transition={{ duration: 1.1, ease: "easeOut" }}>{e}</motion.span>
        ))}
      </AnimatePresence>
      {/* Mate */}
      <motion.div
        className="absolute inset-0 flex items-end justify-center overflow-hidden rounded-full pb-[2%]"
        animate={state === "oops" && !reduced ? { x: [0, -4, 4, -3, 0] } : state === "celebrate" && !reduced ? { y: [0, -6, 0] } : { x: 0, y: 0 }}
        transition={{ duration: 0.5 }}
        style={{ opacity: state === "paused" ? 0.6 : 1 }}
      >
        <MateAvatar state={avatarState} mood={mood} persona={persona} size={size * 0.78} />
      </motion.div>
    </div>
  );
}

/** Animated audio bars for listening / speaking. */
export function Waveform({ active, tone = "cream", bars = 5 }: { active: boolean; tone?: "cream" | "burgundy"; bars?: number }) {
  const reduced = usePrefersReducedMotion();
  return (
    <span className="inline-flex h-5 items-center gap-[3px]" aria-hidden>
      {Array.from({ length: bars }, (_, i) => (
        <motion.span
          key={i}
          className={`w-[3px] rounded-full ${tone === "cream" ? "bg-cream" : "bg-burgundy"}`}
          animate={active && !reduced ? { height: ["20%", `${50 + ((i * 37) % 50)}%`, "30%", "90%", "20%"] } : { height: "20%" }}
          transition={{ duration: 0.9 + i * 0.07, repeat: active && !reduced ? Infinity : 0, ease: "easeInOut" }}
        />
      ))}
    </span>
  );
}
