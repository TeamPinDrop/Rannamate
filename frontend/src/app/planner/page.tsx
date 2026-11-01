"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Plus, RefreshCw, ShoppingBasket, Trash2, X } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { DAYS, SLOTS } from "@/components/AddToPlan";
import { RECIPES, RECIPE_BY_ID } from "@/lib/data/recipes";
import { ingredient } from "@/lib/data/ingredients";
import { actions, useStore } from "@/lib/store";
import { buildShoppingList } from "@/lib/shopping";
import type { DayKey, MealSlot } from "@/lib/types";

export default function PlannerPage() {
  const plan = useStore((s) => s.plan);
  const pantry = useStore((s) => s.pantry);
  const [picker, setPicker] = useState<{ day: DayKey; slot: MealSlot } | null>(null);
  const [bought, setBought] = useState<Set<string>>(new Set());
  const list = useMemo(() => buildShoppingList(plan, pantry), [plan, pantry]);
  const planned = Object.values(plan).reduce((n, d) => n + Object.keys(d ?? {}).length, 0);

  return (
    <div className="mx-auto max-w-7xl px-4 pb-20 pt-32 sm:px-6">
      <PageHeader eyebrow="Meal Planner" title={<>Plan your <em className="text-burgundy">week</em></>} sub="Tap a slot to add or replace a meal. Your shopping list updates automatically.">
        {planned > 0 && <button onClick={actions.clearPlan} className="btn-ghost"><Trash2 className="h-4 w-4" /> Clear week</button>}
      </PageHeader>

      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <div className="glass-strong overflow-x-auto rounded-[2rem] p-4">
          <table className="w-full min-w-[760px] table-fixed border-separate border-spacing-2">
            <thead>
              <tr>
                <th className="w-24" />
                {DAYS.map((d) => <th key={d.id} className="text-xs font-bold uppercase tracking-widest text-forest/70">{d.label.slice(0, 3)}</th>)}
              </tr>
            </thead>
            <tbody>
              {SLOTS.map((slot) => (
                <tr key={slot}>
                  <th className="text-left text-sm font-semibold capitalize text-burgundy">{slot}</th>
                  {DAYS.map((d) => {
                    const rid = plan[d.id]?.[slot];
                    const r = rid ? RECIPE_BY_ID[rid] : null;
                    return (
                      <td key={d.id} className="h-28 align-top">
                        <AnimatePresence mode="wait">
                          {r ? (
                            <motion.div key={r.id} initial={{ opacity: 0, scale: 0.8, y: -20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.8 }} className="group relative flex h-full flex-col items-center justify-center rounded-2xl p-2 text-center text-white shadow-md" style={{ background: `linear-gradient(140deg, ${r.palette[0]}, ${r.palette[1]})` }}>
                              <Link href={`/recipes/${r.id}`} className="text-3xl">{r.emoji}</Link>
                              <span className="mt-1 line-clamp-2 text-[11px] font-semibold leading-tight">{r.name}</span>
                              <div className="absolute inset-x-1 top-1 flex justify-between opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
                                <button onClick={() => setPicker({ day: d.id, slot })} className="rounded-full bg-black/30 p-1" aria-label={`Replace ${slot} on ${d.label}`}><RefreshCw className="h-3 w-3" /></button>
                                <button onClick={() => actions.setMeal(d.id, slot, null)} className="rounded-full bg-black/30 p-1" aria-label={`Remove ${slot} on ${d.label}`}><X className="h-3 w-3" /></button>
                              </div>
                            </motion.div>
                          ) : (
                            <motion.button key="empty" onClick={() => setPicker({ day: d.id, slot })} className="flex h-full w-full items-center justify-center rounded-2xl border-2 border-dashed border-forest/20 text-forest/40 transition hover:border-forest/50 hover:bg-white/30 hover:text-forest" aria-label={`Add ${slot} on ${d.label}`}>
                              <Plus className="h-5 w-5" />
                            </motion.button>
                          )}
                        </AnimatePresence>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <aside className="glass rounded-[2rem] p-5 xl:sticky xl:top-28 xl:self-start">
          <div className="flex items-center gap-2 text-burgundy"><ShoppingBasket className="h-5 w-5" /><h2 className="font-display text-2xl font-semibold text-forest">Shopping list</h2></div>
          {!list.length && <p className="mt-4 rounded-2xl bg-white/30 p-5 text-sm text-forest/70">Plan a few meals and the ingredients you need appear here, merged across recipes.</p>}
          <ul className="mt-4 space-y-1.5">
            {list.map((l) => {
              const key = `${l.ingredientId}|${l.unit}`;
              const ing = ingredient(l.ingredientId);
              const covered = l.toBuy === 0 && !l.note;
              const done = bought.has(key) || covered;
              return (
                <li key={key}>
                  <button onClick={() => !covered && setBought((b) => { const n = new Set(b); if (n.has(key)) n.delete(key); else n.add(key); return n; })} className="flex w-full items-start gap-3 rounded-xl p-2 text-left hover:bg-white/40" title={`For: ${l.recipes.join(", ")}`}>
                    <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${done ? "border-forest bg-forest text-cream-50" : "border-forest/40"}`}>{done && <Check className="h-3.5 w-3.5" />}</span>
                    <span className="text-lg leading-none">{ing.emoji}</span>
                    <span className={`flex-1 text-sm ${done ? "text-forest/50 line-through" : "text-forest"}`}>
                      <b>{ing.name}</b>
                      <span className="block text-[11px] text-forest/60">{covered ? "in your kitchen" : l.note ?? `need ${l.needed} ${l.unit}${l.have ? `, have ${l.have}` : ""}`} · {l.recipes.length} recipe{l.recipes.length > 1 ? "s" : ""}</span>
                    </span>
                    {!covered && !l.note && <span className="text-sm font-bold text-forest">{l.toBuy} {l.unit}</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>
      </div>

      <AnimatePresence>
        {picker && (
          <motion.div className="fixed inset-0 z-[60] flex items-end justify-center bg-forest/30 p-4 backdrop-blur-sm sm:items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setPicker(null)}>
            <motion.div role="dialog" aria-label="Choose a recipe" className="glass-strong max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-[2rem] p-5" initial={{ y: 40, scale: 0.96 }} animate={{ y: 0, scale: 1 }} exit={{ y: 40, scale: 0.96 }} onClick={(e) => e.stopPropagation()}>
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-display text-2xl font-semibold capitalize text-forest">{picker.slot} · {DAYS.find((d) => d.id === picker.day)?.label}</h3>
                <button onClick={() => setPicker(null)} className="rounded-full p-2 hover:bg-white/50" aria-label="Close"><X className="h-5 w-5 text-forest" /></button>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {RECIPES.map((r) => (
                  <button key={r.id} onClick={() => { actions.setMeal(picker.day, picker.slot, r.id); setPicker(null); }} className="flex items-center gap-3 rounded-2xl bg-white/40 p-2.5 text-left hover:bg-white/70">
                    <span className="flex h-12 w-12 items-center justify-center rounded-xl text-2xl" style={{ background: `linear-gradient(140deg, ${r.palette[0]}, ${r.palette[1]})` }}>{r.emoji}</span>
                    <span><span className="block font-semibold text-forest">{r.name}</span><span className="text-xs text-forest/65">{r.prepMin + r.cookMin} min · {r.cuisine}</span></span>
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
