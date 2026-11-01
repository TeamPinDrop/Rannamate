"use client";
import Link from "next/link";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, SlidersHorizontal } from "lucide-react";
import { FilterPanel } from "@/components/FilterPanel";
import { RecipeCard } from "@/components/RecipeCard";
import { Notice, PageHeader } from "@/components/ui/PageHeader";
import { ingredient } from "@/lib/data/ingredients";
import { useRecommendations } from "@/lib/useRecommendations";
import { useStore } from "@/lib/store";
import { WEIGHTS } from "@/lib/recommend";

export default function DiscoverPage() {
  const { results, excluded } = useRecommendations();
  const pantry = useStore((s) => s.pantry);
  const [showFilters, setShowFilters] = useState(false);
  const [showWhy, setShowWhy] = useState(false);
  const [onlyCookable, setOnlyCookable] = useState(false);
  const shown = onlyCookable ? results.filter((r) => r.missing.length === 0) : results;

  return (
    <div className="mx-auto max-w-6xl px-4 pb-20 pt-32 sm:px-6">
      <PageHeader eyebrow="Discover" title={<>Recipes for <em className="text-burgundy">you</em>, right now</>} sub="Ranked by RANNAMATE's recommendation engine using your ingredients, mood and filters." />

      <div className="glass mb-6 flex flex-wrap items-center gap-2 rounded-[1.5rem] p-3">
        <span className="px-2 text-xs font-bold uppercase tracking-widest text-forest/70">In your kitchen</span>
        {pantry.length ? pantry.map((p) => (
          <span key={p.ingredientId} className="rounded-full bg-white/50 px-2.5 py-1 text-sm text-forest">{ingredient(p.ingredientId).emoji} {ingredient(p.ingredientId).name}</span>
        )) : <span className="text-sm text-forest/70">Nothing yet —</span>}
        <Link href="/kitchen" className="ml-auto rounded-full bg-forest px-4 py-1.5 text-sm font-semibold text-cream-50">{pantry.length ? "Edit" : "Add ingredients"}</Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        <div className="min-w-0 lg:sticky lg:top-28 lg:self-start">
          <button onClick={() => setShowFilters((s) => !s)} className="btn-ghost mb-3 w-full lg:hidden" aria-expanded={showFilters}>
            <SlidersHorizontal className="h-4 w-4" /> {showFilters ? "Hide" : "Show"} filters
          </button>
          <div className={`${showFilters ? "block" : "hidden"} lg:block`}><FilterPanel /></div>
        </div>

        <div className="min-w-0">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-forest/80"><b>{shown.length}</b> recipes{excluded.length > 0 && <> · {excluded.length} excluded by your restrictions</>}</p>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm font-semibold text-forest">
                <input type="checkbox" checked={onlyCookable} onChange={(e) => setOnlyCookable(e.target.checked)} className="h-4 w-4 accent-[#0F3D3A]" />
                Cook with what I have
              </label>
              <button onClick={() => setShowWhy((s) => !s)} className="flex items-center gap-1 text-sm font-semibold text-burgundy">How ranking works <ChevronDown className={`h-4 w-4 transition ${showWhy ? "rotate-180" : ""}`} /></button>
            </div>
          </div>
          <AnimatePresence>
            {showWhy && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="mb-4 overflow-hidden">
                <Notice>
                  <p className="font-mono text-xs">R = {Object.entries(WEIGHTS).map(([k, v]) => `${v}·${k}`).join(" + ")}</p>
                  <p className="mt-1">I = ingredients you have · M = mood · C = cuisine · W = weather (not used yet) · T = time · P = difficulty preference · H = favourites/history. Components you haven&apos;t given us are left out and the rest re-weighted — no invented numbers. The ring on each card is the exact share of essential ingredients you own.</p>
                  {excluded.length > 0 && <p className="mt-2"><b>Excluded:</b> {excluded.map((e) => `${e.recipe.name} (${e.reason})`).join("; ")}</p>}
                </Notice>
              </motion.div>
            )}
          </AnimatePresence>
          {!pantry.length && <div className="mb-4"><Notice>Add ingredients in My Kitchen to see match percentages. Until then, recipes are ranked by your filters only.</Notice></div>}
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {shown.map((rec, i) => (
              <div key={rec.recipe.id} className="flex flex-col">
                <RecipeCard rec={rec} index={i} showMatch={pantry.length > 0} />
                {rec.reasons.length > 0 && (
                  <p className="mt-2 px-3 text-xs text-forest/70"><b className="text-forest">Why:</b> {rec.reasons.join(" · ")}{!rec.matchesAllFilters && " · doesn't match every filter"}</p>
                )}
              </div>
            ))}
          </div>
          {!shown.length && <div className="glass rounded-[2rem] p-10 text-center text-forest/75">No recipes fit right now. Try relaxing a filter or adding ingredients.</div>}
        </div>
      </div>
    </div>
  );
}
