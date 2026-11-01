"use client";
import Link from "next/link";
import { motion, useScroll, useTransform } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";
import { useRef } from "react";
import { OrbitField, type OrbitItem } from "../OrbitField";
import { usePrefersReducedMotion, useViewportWidth } from "@/lib/useReducedMotion";

const ITEMS: OrbitItem[] = ["🍅", "🥕", "🧅", "🌶️", "🥚", "🍄", "🫑", "🌿", "🥔", "🍋", "🧄", "🥦"].map((emoji, i) => ({
  emoji,
  size: 38 + (i % 3) * 12,
  ring: i % 3 === 0 ? 0.68 : 1,
}));

export function Hero() {
  const ref = useRef<HTMLElement>(null);
  const reduced = usePrefersReducedMotion();
  const vw = useViewportWidth();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [0, 160]);
  const sceneY = useTransform(scrollYProgress, [0, 1], [0, -80]);
  const scale = useTransform(scrollYProgress, [0, 1], [1, 0.85]);
  const opacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);
  const radius = vw < 640 ? Math.min(vw * 0.4, 160) : vw < 1024 ? 210 : 250;

  return (
    <section ref={ref} className="relative mx-auto flex min-h-[100svh] max-w-6xl flex-col items-center gap-10 px-4 pb-16 pt-32 sm:px-6 lg:flex-row lg:gap-6 lg:pt-28">
      <motion.div style={{ y, opacity }} className="relative z-10 flex-1 text-center lg:text-left">
        <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-[0.2em] text-burgundy">
          <Sparkles className="h-3.5 w-3.5" /> AI cooking companion
        </motion.p>
        <h1 className="h-display mt-6 text-[3.1rem] leading-[0.98] text-forest sm:text-7xl lg:text-[5.4rem]">
          {["Your Kitchen.", "Your Mood.", "Your Mate."].map((line, i) => (
            <span key={line} className="block overflow-hidden pb-1">
              <motion.span
                className={`block ${i === 2 ? "italic text-burgundy" : ""}`}
                initial={{ y: "105%" }}
                animate={{ y: 0 }}
                transition={{ delay: 0.15 + i * 0.12, duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
              >
                {line}
              </motion.span>
            </span>
          ))}
        </h1>
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }} className="mx-auto mt-6 max-w-md text-lg text-forest/80 lg:mx-0">
          Turn the ingredients you already have into something extraordinary.
        </motion.p>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.85 }} className="mt-8 flex flex-wrap justify-center gap-3 lg:justify-start">
          <Link href="/kitchen" className="btn-primary !px-7 !py-3.5 text-base">
            Find My Recipe <ArrowRight className="h-4 w-4" />
          </Link>
          <Link href="/discover" className="btn-ghost !px-7 !py-3.5 text-base">Explore Recipes</Link>
        </motion.div>
      </motion.div>

      <motion.div style={{ y: sceneY, scale }} className="relative flex h-[380px] w-full flex-1 items-center justify-center sm:h-[520px]">
        {/* glass plate */}
        <div className="glass-strong glass-sheen absolute left-1/2 top-1/2 flex h-48 w-48 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full sm:h-64 sm:w-64">
          <div className="absolute inset-4 rounded-full border border-white/50 bg-gradient-to-br from-white/30 to-transparent" />
          <motion.span
            className="relative text-[5.5rem] drop-shadow-[0_20px_25px_rgba(46,7,12,0.35)] sm:text-[7.5rem]"
            animate={reduced ? {} : { rotate: [0, 4, -4, 0], y: [0, -8, 0] }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          >
            🥘
          </motion.span>
        </div>
        <OrbitField items={ITEMS} radius={radius} tilt={0.5} speed={0.28} parallax={18} reduced={reduced} />
        {/* floating info glass cards */}
        <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 1.1 }} className="glass absolute right-0 top-6 hidden rounded-2xl px-4 py-3 sm:block">
          <p className="text-[11px] font-bold uppercase tracking-widest text-burgundy/80">Ingredient match</p>
          <p className="font-display text-2xl font-semibold text-forest">7 of 7 ✓</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 1.3 }} className="glass absolute bottom-8 left-0 hidden max-w-[220px] rounded-2xl px-4 py-3 sm:block">
          <p className="text-[11px] font-bold uppercase tracking-widest text-burgundy/80">Cooking Mate</p>
          <p className="text-sm text-forest">“Add the tomatoes now — cook 4 min until jammy.”</p>
        </motion.div>
      </motion.div>

      <motion.div style={{ opacity }} className="absolute bottom-6 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-2 text-xs font-semibold uppercase tracking-[0.25em] text-forest/60 sm:flex">
        Scroll
        <span className="h-10 w-px bg-gradient-to-b from-forest/60 to-transparent" />
      </motion.div>
    </section>
  );
}
