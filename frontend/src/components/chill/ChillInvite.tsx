"use client";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { fmtLeft } from "@/lib/chill/engine";

/** The small, polite invitation that appears inside cooking mode when a safe waiting period starts. */
export function ChillInvite({ show, remaining, onAccept, onLater, onNever }: { show: boolean; remaining: number; onAccept: () => void; onLater: () => void; onNever: () => void }) {
  return (
    <MotionConfig reducedMotion="user">
    <AnimatePresence>
      {show && (
        <motion.div
          role="dialog"
          aria-label="Cook and Chill invitation"
          initial={{ opacity: 0, y: 16, scale: 0.97, filter: "blur(6px)" }}
          animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
          exit={{ opacity: 0, y: 10, scale: 0.97, filter: "blur(4px)" }}
          transition={{ type: "spring", stiffness: 260, damping: 24 }}
          className="glass-dark relative mt-6 max-w-xl overflow-hidden rounded-[1.75rem] p-4 pr-5"
          data-chill
        >
          <span className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-burgundy/50 blur-3xl" />
          <div className="relative flex items-start gap-3">
            <motion.span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-cream/15 text-xl ring-1 ring-cream/25" animate={{ rotate: [0, -8, 8, 0] }} transition={{ duration: 2.4, repeat: Infinity, repeatDelay: 1.5 }}>🎲</motion.span>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-cream/60">Cook &amp; Chill · {fmtLeft(remaining)} to wait</p>
              <p className="mt-1 font-display text-xl leading-snug text-cream-50">Your food is cooking! Want to have some fun while we wait?</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button onClick={onAccept} className="flex items-center gap-1.5 rounded-full bg-cream px-4 py-2 text-sm font-bold text-burgundy transition hover:bg-cream-50 active:scale-95"><Sparkles className="h-4 w-4" /> Let&apos;s Have Fun</button>
                <button onClick={onLater} className="rounded-full px-4 py-2 text-sm font-semibold text-cream/85 ring-1 ring-cream/25 transition hover:bg-cream/10">Maybe Later</button>
                <button onClick={onNever} className="ml-auto text-[11px] font-semibold text-cream/50 underline-offset-4 hover:text-cream/80 hover:underline">Don&apos;t offer during this recipe</button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
    </MotionConfig>
  );
}
