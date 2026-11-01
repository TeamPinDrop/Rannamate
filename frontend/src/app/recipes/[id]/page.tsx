"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { loadAiRecipes } from "@/lib/aiRecipes";
import { motion } from "framer-motion";
import { ArrowLeft, ChefHat, Clock, Flame, Heart, Users, Check, X, Repeat } from "lucide-react";
import { RECIPE_BY_ID } from "@/lib/data/recipes";
import { ingredient } from "@/lib/data/ingredients";
import { DishArt } from "@/components/ui/DishArt";
import { MatchRing } from "@/components/ui/MatchRing";
import { AddToPlan } from "@/components/AddToPlan";
import { actions, useStore } from "@/lib/store";
import { matchFor } from "@/lib/recommend";

export default function RecipePage() {
  const { id } = useParams<{ id: string }>();
  const [ready, setReady] = useState(false);
  useEffect(() => { loadAiRecipes(); setReady(true); }, []);
  const r = ready || !id.startsWith("ai-") ? RECIPE_BY_ID[id] : undefined;
  const pantry = useStore((s) => s.pantry);
  const fav = useStore((s) => s.favourites.includes(id));
  if (!r && !ready) return <div className="min-h-screen" />;
  if (!r) return <div className="mx-auto max-w-3xl px-4 pt-40 text-center text-forest">Recipe not found. <Link href="/discover" className="underline">Back to Discover</Link></div>;
  const have = new Set(pantry.map((p) => p.ingredientId));
  const m = matchFor(r, pantry);

  return (
    <div className="mx-auto max-w-6xl px-4 pb-20 pt-28 sm:px-6">
      <Link href="/discover" className="mb-5 inline-flex items-center gap-1 text-sm font-semibold text-forest"><ArrowLeft className="h-4 w-4" /> Back to recipes</Link>
      <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.7 }} className="glass rounded-[2.5rem] p-3">
          <DishArt recipe={r} size="lg" />
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.7 }} className="flex flex-col">
          <p className="eyebrow">{r.cuisine} · {r.moods.join(" · ")}</p>
          <h1 className="h-display mt-2 text-5xl text-forest">{r.name}</h1>
          <p className="mt-3 text-lg text-forest/75">{r.tagline}</p>
          <div className="mt-5 flex flex-wrap gap-2 text-sm font-semibold text-forest">
            <span className="glass flex items-center gap-1.5 rounded-full px-3 py-1.5"><Clock className="h-4 w-4" /> {r.prepMin}m prep · {r.cookMin}m cook</span>
            <span className="glass flex items-center gap-1.5 rounded-full px-3 py-1.5"><Flame className="h-4 w-4" /> {r.difficulty}</span>
            <span className="glass flex items-center gap-1.5 rounded-full px-3 py-1.5"><Users className="h-4 w-4" /> Serves {r.servings}</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">{r.diets.map((d) => <span key={d} className="rounded-full bg-forest/10 px-2.5 py-1 text-xs font-semibold capitalize text-forest">{d}</span>)}
            {r.allergens.map((a) => <span key={a} className="rounded-full bg-burgundy/10 px-2.5 py-1 text-xs font-semibold text-burgundy">contains {a}</span>)}</div>
          {pantry.length > 0 && (
            <div className="glass mt-5 flex items-center gap-4 rounded-2xl p-4">
              <MatchRing value={m.pct / 100} size={60} />
              <p className="text-forest">You have <b>{m.available} of {m.total}</b> essential ingredients.</p>
            </div>
          )}
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href={`/cook/${r.id}`} className="btn-primary !px-7 !py-3.5 text-base"><ChefHat className="h-5 w-5" /> Start Cooking</Link>
            <button onClick={() => actions.toggleFavourite(r.id)} className="btn-ghost" aria-pressed={fav}><Heart className={`h-4 w-4 ${fav ? "fill-burgundy text-burgundy" : ""}`} /> {fav ? "Saved" : "Save"}</button>
          </div>
          <div className="mt-4"><AddToPlan recipeId={r.id} /></div>
        </motion.div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <section className="glass-strong rounded-[2rem] p-6">
          <h2 className="font-display text-2xl font-semibold text-forest">Ingredients</h2>
          <ul className="mt-4 space-y-2">
            {r.ingredients.map((i) => {
              const ing = ingredient(i.ingredientId);
              const ok = have.has(i.ingredientId) || ing.staple;
              return (
                <li key={i.ingredientId} className="flex items-center gap-3 rounded-2xl bg-white/35 p-2.5">
                  <span className="text-2xl">{ing.emoji}</span>
                  <span className="flex-1 text-sm text-forest"><b>{ing.name}</b>{i.note && <span className="text-forest/65"> · {i.note}</span>}{i.optional && <span className="text-forest/50"> (optional)</span>}</span>
                  <span className="text-sm font-semibold text-forest/80">{i.quantity} {i.unit}</span>
                  {pantry.length > 0 && (ok ? <Check className="h-4 w-4 text-[#1F6B4F]" aria-label="You have this" /> : <X className="h-4 w-4 text-burgundy" aria-label="Missing" />)}
                </li>
              );
            })}
          </ul>
          {r.substitutions.length > 0 && (
            <div className="mt-6">
              <h3 className="flex items-center gap-2 font-semibold text-forest"><Repeat className="h-4 w-4" /> Possible substitutions</h3>
              <ul className="mt-2 space-y-1.5 text-sm text-forest/80">
                {r.substitutions.map((s) => <li key={s.ingredientId}><b>{ingredient(s.ingredientId).name}</b> → {s.options.join(" / ")}</li>)}
              </ul>
            </div>
          )}
        </section>
        <section className="glass rounded-[2rem] p-6">
          <h2 className="font-display text-2xl font-semibold text-forest">Method</h2>
          <ol className="mt-4 space-y-3">
            {r.steps.map((s, i) => (
              <motion.li key={i} initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.05 }} className="flex gap-4 rounded-2xl bg-white/30 p-4">
                <span className="font-display text-2xl font-semibold text-burgundy">{String(i + 1).padStart(2, "0")}</span>
                <div className="text-forest">
                  <p>{s.text}</p>
                  {s.timer && <p className="mt-1 text-xs font-semibold text-forest/60">⏱ ~{Math.round(s.timer / 60) || 1} min</p>}
                  {s.tip && <p className="mt-1 text-xs italic text-forest/70">Tip: {s.tip}</p>}
                </div>
              </motion.li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}
