"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeftRight, Check, ChefHat, ChevronLeft, ChevronRight, Clock, ExternalLink, Heart, Pause, Play, RotateCcw, Timer } from "lucide-react";
import { RECIPE_BY_ID } from "@/lib/data/recipes";
import { ingredient } from "@/lib/data/ingredients";
import { actions, useStore } from "@/lib/store";
import type { MateCard } from "@/lib/mate/types";

type Send = (text: string) => void;

const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
const nice = (n: number) => (Number.isInteger(n) ? String(n) : n < 1 ? n.toFixed(2).replace(/0+$/, "") : n.toFixed(1).replace(/\.0$/, ""));

function Dish({ id, className = "" }: { id: string; className?: string }) {
  const r = RECIPE_BY_ID[id];
  if (!r) return null;
  return (
    <div className={`flex items-center justify-center ${className}`} style={{ background: `radial-gradient(circle at 30% 25%, ${r.palette[0]}, ${r.palette[1]} 80%)` }}>
      <span className="drop-shadow-[0_6px_8px_rgba(0,0,0,0.35)]">{r.emoji}</span>
    </div>
  );
}

function CreatedCard({ id, onSend }: { id: string; onSend: Send }) {
  const r = RECIPE_BY_ID[id];
  const pantry = useStore((s) => s.pantry);
  const fav = useStore((s) => s.favourites.includes(id));
  if (!r) return null;
  const have = new Set(pantry.map((p) => p.ingredientId));
  return (
    <motion.div initial={{ opacity: 0, y: 20, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ delay: 0.15, type: "spring", stiffness: 200, damping: 20 }} className="relative max-w-lg overflow-hidden rounded-[1.75rem] border border-cream/30 bg-gradient-to-br from-cream/20 via-cream/10 to-transparent">
      <motion.div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-[#F2B33D]/30 blur-2xl" animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 4, repeat: Infinity }} />
      <div className="relative flex gap-3 p-3.5">
        <Dish id={id} className="h-20 w-20 shrink-0 rounded-2xl text-4xl" />
        <div className="min-w-0">
          <span className="inline-flex items-center gap-1 rounded-full bg-cream px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-burgundy">✨ Created by Mate</span>
          <p className="mt-1 font-display text-xl font-semibold leading-tight text-cream-50">{r.name}</p>
          <p className="text-[12px] text-cream/75">{r.tagline}</p>
          <p className="mt-1 text-[11px] text-cream/60">{r.prepMin + r.cookMin} min · serves {r.servings} · {r.steps.length} steps · {r.cuisine}</p>
        </div>
      </div>
      <div className="relative flex flex-wrap gap-1.5 px-3.5">
        {r.ingredients.map((i) => {
          const ing = ingredient(i.ingredientId);
          const ok = have.has(i.ingredientId);
          return (
            <span key={i.ingredientId} className={`flex items-center gap-1 rounded-full px-2 py-1 text-[11px] ${ok ? "bg-[#2E7D5B]/60 text-white" : i.optional ? "bg-cream/5 text-cream/60" : "bg-cream/15 text-cream-50"}`} title={`${i.quantity} ${i.unit}${i.note ? ` · ${i.note}` : ""}`}>
              {ing.emoji} {ing.name}{i.optional && " (opt.)"}{ok && <Check className="h-3 w-3" />}
            </span>
          );
        })}
      </div>
      <div className="relative flex flex-wrap gap-1.5 p-3.5">
        <button onClick={() => onSend(`Let's cook ${r.name}`)} className="flex items-center gap-1 rounded-full bg-cream px-3 py-1.5 text-[12px] font-bold text-burgundy"><ChefHat className="h-3.5 w-3.5" /> Start cook-along</button>
        <button onClick={() => actions.toggleFavourite(id)} className="flex items-center gap-1 rounded-full bg-cream/15 px-3 py-1.5 text-[12px] font-bold text-cream-50" aria-pressed={fav}><Heart className={`h-3.5 w-3.5 ${fav ? "fill-cream" : ""}`} /> {fav ? "Saved" : "Save"}</button>
        <Link href={`/recipes/${id}`} className="flex items-center gap-1 rounded-full bg-cream/15 px-3 py-1.5 text-[12px] font-bold text-cream-50"><ExternalLink className="h-3.5 w-3.5" /> Full recipe</Link>
      </div>
    </motion.div>
  );
}

function RecipesCard({ ids, matches, onSend }: { ids: string[]; matches?: Record<string, number>; onSend: Send }) {
  return (
    <div className="no-scrollbar -mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-1">
      {ids.map((id, i) => {
        const r = RECIPE_BY_ID[id];
        const m = matches?.[id];
        return (
          <motion.div key={id} initial={{ opacity: 0, y: 16, rotate: i % 2 ? 2 : -2 }} animate={{ opacity: 1, y: 0, rotate: 0 }} transition={{ delay: 0.15 + i * 0.1 }} className="w-[200px] shrink-0 snap-start overflow-hidden rounded-3xl border border-cream/20 bg-cream/10">
            <div className="relative">
              <Dish id={id} className="h-24 text-5xl" />
              {m !== undefined && <span className={`absolute right-2 top-2 rounded-full px-2 py-0.5 text-[11px] font-bold ${m >= 80 ? "bg-[#1F6B4F] text-white" : "bg-black/35 text-white"}`}>{m}% match</span>}
            </div>
            <div className="p-3">
              <p className="font-display text-[17px] font-semibold leading-tight text-cream-50">{r.name}</p>
              <p className="mt-1 flex items-center gap-1 text-[11px] text-cream/70"><Clock className="h-3 w-3" /> {r.prepMin + r.cookMin} min · {r.cuisine} · {r.difficulty}</p>
              <div className="mt-2.5 flex gap-1.5">
                <button onClick={() => onSend(`Tell me about ${r.name}`)} className="flex-1 rounded-full bg-cream/15 px-2 py-1.5 text-[11px] font-bold text-cream-50 hover:bg-cream/25">More info</button>
                <button onClick={() => onSend(`Let's cook ${r.name}`)} className="flex-1 rounded-full bg-cream px-2 py-1.5 text-[11px] font-bold text-burgundy hover:bg-cream-50">Cook it</button>
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

function RecipeCard({ id, onSend }: { id: string; onSend: Send }) {
  const r = RECIPE_BY_ID[id];
  const fav = useStore((s) => s.favourites.includes(id));
  return (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.15 }} className="flex max-w-md overflow-hidden rounded-3xl border border-cream/20 bg-cream/10">
      <Dish id={id} className="w-28 shrink-0 text-5xl" />
      <div className="flex-1 p-3.5">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cream/60">{r.cuisine} · {r.difficulty}</p>
        <p className="font-display text-xl font-semibold leading-tight text-cream-50">{r.name}</p>
        <p className="mt-1 text-[12px] text-cream/75">{r.prepMin}m prep · {r.cookMin}m cook · serves {r.servings} · {r.steps.length} steps</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <button onClick={() => onSend(`Let's cook ${r.name}`)} className="flex items-center gap-1 rounded-full bg-cream px-3 py-1.5 text-[12px] font-bold text-burgundy"><ChefHat className="h-3.5 w-3.5" /> Start cook-along</button>
          <button onClick={() => actions.toggleFavourite(id)} className="flex items-center gap-1 rounded-full bg-cream/15 px-3 py-1.5 text-[12px] font-bold text-cream-50" aria-pressed={fav}><Heart className={`h-3.5 w-3.5 ${fav ? "fill-cream" : ""}`} /> {fav ? "Saved" : "Save"}</button>
          <Link href={`/recipes/${id}`} className="flex items-center gap-1 rounded-full bg-cream/15 px-3 py-1.5 text-[12px] font-bold text-cream-50"><ExternalLink className="h-3.5 w-3.5" /> Full recipe</Link>
        </div>
      </div>
    </motion.div>
  );
}

function StepCard({ id, index, onSend }: { id: string; index: number; onSend: Send }) {
  const r = RECIPE_BY_ID[id];
  const total = r.steps.length;
  return (
    <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }} className="max-w-md rounded-3xl border border-cream/25 bg-gradient-to-br from-cream/20 to-cream/5 p-4">
      <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-[0.2em] text-cream/70">
        <span>{r.emoji} {r.name}</span>
        <span>Step {index + 1}/{total}</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-cream/15">
        <motion.div className="h-full rounded-full bg-cream" initial={{ width: `${(index / total) * 100}%` }} animate={{ width: `${((index + 1) / total) * 100}%` }} transition={{ duration: 0.8 }} />
      </div>
      <p className="mt-3 font-display text-lg leading-snug text-cream-50">{r.steps[index].text}</p>
      <div className="mt-3 flex gap-2">
        <button onClick={() => onSend("back")} disabled={index === 0} className="flex items-center gap-1 rounded-full border border-cream/30 px-3 py-1.5 text-[12px] font-bold text-cream-50 disabled:opacity-30"><ChevronLeft className="h-3.5 w-3.5" /> Back</button>
        <button onClick={() => onSend("repeat")} className="rounded-full border border-cream/30 px-3 py-1.5 text-[12px] font-bold text-cream-50">Repeat</button>
        <button onClick={() => onSend("next")} className="ml-auto flex items-center gap-1 rounded-full bg-cream px-4 py-1.5 text-[12px] font-bold text-burgundy">{index === total - 1 ? "Done!" : "Next"} <ChevronRight className="h-3.5 w-3.5" /></button>
      </div>
    </motion.div>
  );
}

export function TimerCard({ seconds, label, onDone }: { seconds: number; label: string; onDone?: (label: string) => void }) {
  const [left, setLeft] = useState(seconds);
  const [running, setRunning] = useState(true);
  const done = useRef(false);
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setLeft((x) => Math.max(0, x - 1)), 1000);
    return () => clearInterval(t);
  }, [running]);
  useEffect(() => {
    if (left === 0 && !done.current) { done.current = true; setRunning(false); onDone?.(label); }
  }, [left, label, onDone]);
  const pct = 1 - left / seconds;
  const R = 26;
  const C = 2 * Math.PI * R;
  return (
    <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className={`inline-flex items-center gap-3 rounded-full border py-2 pl-2 pr-4 ${left === 0 ? "border-cream bg-cream/25" : "border-cream/25 bg-cream/10"}`}>
      <div className="relative h-16 w-16">
        <svg viewBox="0 0 64 64" className="h-full w-full -rotate-90">
          <circle cx="32" cy="32" r={R} stroke="rgba(245,218,191,0.2)" strokeWidth="5" fill="none" />
          <circle cx="32" cy="32" r={R} stroke="#F5DABF" strokeWidth="5" fill="none" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - pct)} style={{ transition: "stroke-dashoffset 1s linear" }} />
        </svg>
        <Timer className={`absolute inset-0 m-auto h-5 w-5 text-cream ${left === 0 ? "animate-bounce" : ""}`} />
      </div>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cream/60">{label}</p>
        <p className="font-display text-2xl tabular-nums text-cream-50">{left === 0 ? "Done! ⏰" : fmt(left)}</p>
      </div>
      <div className="flex gap-1">
        <button onClick={() => setRunning((r) => !r)} disabled={left === 0} className="flex h-8 w-8 items-center justify-center rounded-full bg-cream text-forest disabled:opacity-30" aria-label={running ? "Pause timer" : "Resume timer"}>{running ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}</button>
        <button onClick={() => { setLeft(seconds); setRunning(true); done.current = false; }} className="flex h-8 w-8 items-center justify-center rounded-full bg-cream/15 text-cream" aria-label="Restart timer"><RotateCcw className="h-3.5 w-3.5" /></button>
      </div>
    </motion.div>
  );
}

function SwapCard({ from, options }: { from: string; options: string[] }) {
  const ing = ingredient(from);
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex max-w-md items-center gap-3 rounded-3xl border border-cream/20 bg-cream/10 p-3">
      <motion.span className="text-3xl" animate={{ rotate: [0, -10, 0], opacity: [1, 0.4, 1] }} transition={{ duration: 2, repeat: Infinity }}>{ing.emoji}</motion.span>
      <ArrowLeftRight className="h-5 w-5 shrink-0 text-cream/70" />
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => <span key={o} className="rounded-full bg-cream px-3 py-1 text-[12px] font-semibold text-forest">{o}</span>)}
      </div>
    </motion.div>
  );
}

function IngredientsCard({ id, servings }: { id: string; servings: number }) {
  const r = RECIPE_BY_ID[id];
  const k = servings / r.servings;
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-md rounded-3xl border border-cream/20 bg-cream/10 p-4">
      <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-cream/70">{r.name} · for {servings}</p>
      <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
        {r.ingredients.map((i) => (
          <li key={i.ingredientId} className="flex justify-between gap-2 border-b border-cream/10 py-1 text-[13px] text-cream-50">
            <span className="truncate">{ingredient(i.ingredientId).emoji} {ingredient(i.ingredientId).name}</span>
            <span className="shrink-0 font-semibold">{nice(["pcs", "bunch"].includes(i.unit) ? Math.max(0.5, Math.round(i.quantity * k * 2) / 2) : i.quantity * k)} {i.unit}</span>
          </li>
        ))}
      </ul>
    </motion.div>
  );
}

export function CardView({ card, onSend, onTimerDone }: { card: MateCard; onSend: Send; onTimerDone: (label: string) => void }) {
  if ("id" in card && !RECIPE_BY_ID[card.id]) return null;
  if (card.type === "recipes" && !card.ids.every((x) => RECIPE_BY_ID[x])) return null;
  switch (card.type) {
    case "recipes": return <RecipesCard ids={card.ids} matches={card.matches} onSend={onSend} />;
    case "recipe": return <RecipeCard id={card.id} onSend={onSend} />;
    case "created": return <CreatedCard id={card.id} onSend={onSend} />;
    case "step": return <StepCard id={card.id} index={card.index} onSend={onSend} />;
    case "timer": return <TimerCard seconds={card.seconds} label={card.label} onDone={onTimerDone} />;
    case "swap": return <SwapCard from={card.from} options={card.options} />;
    case "ingredients": return <IngredientsCard id={card.id} servings={card.servings} />;
  }
}
