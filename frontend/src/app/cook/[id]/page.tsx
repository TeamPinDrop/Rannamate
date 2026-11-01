"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronLeft, ChevronRight, Heart, ListChecks, MessageCircle, Pause, Play, RotateCcw, Timer, Volume2, X } from "lucide-react";
import { RECIPE_BY_ID } from "@/lib/data/recipes";
import { ingredient } from "@/lib/data/ingredients";
import { MatePanel } from "@/components/MatePanel";
import { AddToPlan } from "@/components/AddToPlan";
import { actions, useStore } from "@/lib/store";
import type { MateAction } from "@/lib/mate-local";
import { useSpeechSynthesis } from "@/lib/voice";

const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

export default function CookPage() {
  const { id } = useParams<{ id: string }>();
  const r = RECIPE_BY_ID[id];
  const [step, setStep] = useState(0);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [panel, setPanel] = useState<"mate" | "list" | null>(null);
  const [finished, setFinished] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const [timerDone, setTimerDone] = useState(false);
  const tick = useRef<ReturnType<typeof setInterval> | null>(null);
  const tts = useSpeechSynthesis();
  const fav = useStore((s) => s.favourites.includes(id));
  const ttsRef = useRef(tts);
  ttsRef.current = tts;

  const s = r?.steps[step];

  // reset timer when the step changes
  useEffect(() => {
    setRunning(false);
    setTimerDone(false);
    setRemaining(s?.timer ?? null);
  }, [step, s?.timer]);

  useEffect(() => {
    if (!running) { if (tick.current) clearInterval(tick.current); return; }
    tick.current = setInterval(() => {
      setRemaining((x) => {
        if (x === null) return x;
        if (x <= 1) {
          setRunning(false);
          setTimerDone(true);
          ttsRef.current.speak("Time's up for this step.");
          return 0;
        }
        return x - 1;
      });
    }, 1000);
    return () => { if (tick.current) clearInterval(tick.current); };
  }, [running]);

  const go = useCallback((d: number) => setStep((x) => Math.min(Math.max(0, x + d), (r?.steps.length ?? 1) - 1)), [r]);

  const onAction = useCallback((a: MateAction) => {
    if (a === "next") go(1);
    else if (a === "prev") go(-1);
    else if (a === "start-timer") setRunning(true);
    else if (a === "pause-timer") setRunning(false);
  }, [go]);

  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === "INPUT") return;
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === " " && remaining !== null) { e.preventDefault(); setRunning((x) => !x); }
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, [go, remaining]);

  if (!r || !s) return <div className="px-4 pt-40 text-center text-forest">Recipe not found. <Link href="/discover" className="underline">Back</Link></div>;

  const progress = (step + 1) / r.steps.length;
  const last = step === r.steps.length - 1;

  if (finished) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-forest px-4">
        <div className="absolute -left-20 top-0 h-96 w-96 rounded-full bg-burgundy/60 blur-[100px]" />
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="glass-dark relative max-w-lg rounded-[2.5rem] p-10 text-center text-cream-50">
          <motion.div initial={{ rotate: -30, scale: 0 }} animate={{ rotate: 0, scale: 1 }} transition={{ type: "spring", delay: 0.2 }} className="text-7xl">{r.emoji}</motion.div>
          <h1 className="mt-4 font-display text-4xl">Beautifully done.</h1>
          <p className="mt-2 text-cream/80">{r.name} is ready. Enjoy every bite.</p>
          <div className="mt-6 flex flex-col items-center gap-3">
            <button onClick={() => actions.toggleFavourite(r.id)} className="flex items-center gap-2 rounded-full bg-cream px-5 py-2.5 font-semibold text-burgundy"><Heart className={`h-4 w-4 ${fav ? "fill-burgundy" : ""}`} /> {fav ? "In favourites" : "Add to favourites"}</button>
            <AddToPlan recipeId={r.id} dark />
            <Link href="/discover" className="mt-2 text-sm underline underline-offset-4">Find another recipe</Link>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-forest text-cream-50">
      <div className="pointer-events-none absolute -right-32 -top-32 h-[30rem] w-[30rem] rounded-full blur-[120px]" style={{ background: r.palette[0], opacity: 0.35 }} />
      <div className="pointer-events-none absolute -bottom-32 -left-32 h-[30rem] w-[30rem] rounded-full bg-burgundy/60 blur-[120px]" />

      <header className="relative z-10 flex items-center justify-between px-4 py-4 sm:px-8">
        <Link href={`/recipes/${r.id}`} className="flex items-center gap-2 rounded-full bg-cream/10 px-4 py-2 text-sm font-semibold hover:bg-cream/20"><X className="h-4 w-4" /> Exit</Link>
        <p className="hidden font-display text-lg sm:block">{r.emoji} {r.name}</p>
        <div className="flex gap-2">
          <button onClick={() => setPanel(panel === "list" ? null : "list")} className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ${panel === "list" ? "bg-cream text-forest" : "bg-cream/10 hover:bg-cream/20"}`} aria-pressed={panel === "list"}><ListChecks className="h-4 w-4" /> <span className="hidden sm:inline">Ingredients</span></button>
          <button onClick={() => setPanel(panel === "mate" ? null : "mate")} className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ${panel === "mate" ? "bg-cream text-forest" : "bg-cream/10 hover:bg-cream/20"}`} aria-pressed={panel === "mate"}><MessageCircle className="h-4 w-4" /> <span className="hidden sm:inline">Cooking Mate</span></button>
        </div>
      </header>

      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-8">
        <div className="h-1.5 overflow-hidden rounded-full bg-cream/15" role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100}>
          <motion.div className="h-full rounded-full bg-cream" animate={{ width: `${progress * 100}%` }} transition={{ type: "spring", stiffness: 120, damping: 20 }} />
        </div>

        <div className={`grid gap-6 py-8 ${panel ? "lg:grid-cols-[1.4fr_1fr]" : ""}`}>
          <section className="flex min-h-[60vh] flex-col justify-center">
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-cream/70">Step {String(step + 1).padStart(2, "0")} of {String(r.steps.length).padStart(2, "0")}</p>
            <AnimatePresence mode="wait">
              <motion.p key={step} initial={{ opacity: 0, y: 30, filter: "blur(6px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} exit={{ opacity: 0, y: -30, filter: "blur(6px)" }} transition={{ duration: 0.5 }} className="mt-5 max-w-4xl font-display text-3xl leading-snug sm:text-5xl sm:leading-[1.15]" aria-live="polite">
                {s.text}
              </motion.p>
            </AnimatePresence>
            {s.tip && <p className="mt-4 max-w-2xl rounded-2xl bg-cream/10 px-4 py-3 text-cream/85">💡 {s.tip}</p>}

            <div className="mt-10 flex flex-wrap items-center gap-3">
              <button onClick={() => go(-1)} disabled={step === 0} className="flex h-14 w-14 items-center justify-center rounded-full border border-cream/30 hover:bg-cream/10 disabled:opacity-30" aria-label="Previous step"><ChevronLeft /></button>

              {remaining !== null && (
                <div className={`glass-dark flex items-center gap-3 rounded-full py-2 pl-5 pr-2 ${timerDone ? "ring-2 ring-cream" : ""}`}>
                  <Timer className="h-5 w-5" />
                  <span className="font-display text-3xl tabular-nums" aria-live="off">{fmt(remaining)}</span>
                  <button onClick={() => setRunning((x) => !x)} className="flex h-10 w-10 items-center justify-center rounded-full bg-cream text-forest" aria-label={running ? "Pause timer" : "Start timer"}>{running ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}</button>
                  <button onClick={() => { setRunning(false); setTimerDone(false); setRemaining(s.timer ?? null); }} className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-cream/15" aria-label="Reset timer"><RotateCcw className="h-4 w-4" /></button>
                </div>
              )}

              {tts.supported && (
                <button onClick={() => tts.speak(`Step ${step + 1}. ${s.text}`)} className="flex h-14 items-center gap-2 rounded-full bg-cream/10 px-5 font-semibold hover:bg-cream/20" aria-label="Read step aloud"><Volume2 className="h-5 w-5" /> Read aloud</button>
              )}

              {last ? (
                <button onClick={() => { actions.logCooked(r.id); setFinished(true); }} className="flex h-14 items-center gap-2 rounded-full bg-cream px-7 font-semibold text-burgundy hover:bg-cream-50"><Check className="h-5 w-5" /> Finish</button>
              ) : (
                <button onClick={() => go(1)} className="flex h-14 items-center gap-2 rounded-full bg-cream px-7 font-semibold text-burgundy hover:bg-cream-50">Next step <ChevronRight className="h-5 w-5" /></button>
              )}
            </div>
            {timerDone && <p className="mt-4 font-semibold text-cream">⏰ Time&apos;s up for this step!</p>}
            <p className="mt-8 text-xs text-cream/50">Keyboard: ← → to move between steps, space to start/pause the timer.</p>
          </section>

          <AnimatePresence mode="wait">
            {panel === "mate" && (
              <motion.div key="mate" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 40 }}>
                <MatePanel recipe={r} step={step} onAction={onAction} dark className="h-[70vh]" />
              </motion.div>
            )}
            {panel === "list" && (
              <motion.aside key="list" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 40 }} className="glass-dark rounded-[2rem] p-5">
                <p className="text-xs font-bold uppercase tracking-[0.25em] text-cream/70">Ingredient checklist · {checked.size}/{r.ingredients.length}</p>
                <ul className="mt-4 space-y-2">
                  {r.ingredients.map((i) => {
                    const ing = ingredient(i.ingredientId);
                    const on = checked.has(i.ingredientId);
                    return (
                      <li key={i.ingredientId}>
                        <button onClick={() => setChecked((c) => { const n = new Set(c); if (n.has(i.ingredientId)) n.delete(i.ingredientId); else n.add(i.ingredientId); return n; })} className="flex w-full items-center gap-3 rounded-2xl p-2 text-left hover:bg-cream/10" aria-pressed={on}>
                          <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border ${on ? "border-cream bg-cream text-forest" : "border-cream/40"}`}>{on && <Check className="h-4 w-4" />}</span>
                          <span className="text-xl">{ing.emoji}</span>
                          <span className={`flex-1 ${on ? "text-cream/50 line-through" : ""}`}>{ing.name}{i.note && <span className="text-cream/60"> · {i.note}</span>}</span>
                          <span className="text-sm text-cream/75">{i.quantity} {i.unit}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </motion.aside>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
