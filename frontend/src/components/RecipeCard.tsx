"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import { Clock, Flame, Heart } from "lucide-react";
import { DishArt } from "./ui/DishArt";
import { MatchRing } from "./ui/MatchRing";
import { ingredient } from "@/lib/data/ingredients";
import type { Recommendation } from "@/lib/recommend";
import { actions, useStore } from "@/lib/store";

export function RecipeCard({ rec, index = 0, showMatch = true }: { rec: Recommendation; index?: number; showMatch?: boolean }) {
  const { recipe: r } = rec;
  const fav = useStore((s) => s.favourites.includes(r.id));
  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -6 }}
      className="glass glass-sheen group relative flex flex-col rounded-[2rem] p-3"
    >
      <div className="relative">
        <DishArt recipe={r} className="transition duration-700 group-hover:scale-[1.02]" />
        <button
          onClick={() => actions.toggleFavourite(r.id)}
          className="absolute right-3 top-3 rounded-full bg-white/30 p-2 backdrop-blur-md transition hover:bg-white/50"
          aria-label={fav ? "Remove from favourites" : "Save to favourites"}
          aria-pressed={fav}
        >
          <Heart className={`h-4 w-4 ${fav ? "fill-burgundy text-burgundy" : "text-white"}`} />
        </button>
        <span className="absolute left-3 top-3 rounded-full bg-black/25 px-3 py-1 text-[11px] font-semibold text-white backdrop-blur-md">{r.cuisine}</span>
      </div>
      <div className="relative flex flex-1 flex-col px-2 pb-2 pt-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-display text-xl font-semibold leading-tight text-forest">{r.name}</h3>
            <p className="mt-1 text-sm text-forest/70">{r.tagline}</p>
          </div>
          {showMatch && <MatchRing value={rec.ingredientMatch} />}
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-[12px] font-semibold text-forest/80">
          <span className="flex items-center gap-1 rounded-full bg-white/35 px-2.5 py-1"><Clock className="h-3.5 w-3.5" /> {r.prepMin}m prep · {r.cookMin}m cook</span>
          <span className="flex items-center gap-1 rounded-full bg-white/35 px-2.5 py-1"><Flame className="h-3.5 w-3.5" /> {r.difficulty}</span>
        </div>
        {showMatch && (
          <p className="mt-3 text-[13px] text-forest/80">
            {rec.missing.length === 0 ? (
              <span className="font-semibold text-[#1F6B4F]">✓ You have all essentials</span>
            ) : (
              <>
                <span className="font-semibold text-burgundy">Missing:</span> {rec.missing.map((m) => ingredient(m).name).join(", ")}
              </>
            )}
          </p>
        )}
        <Link href={`/recipes/${r.id}`} className="mt-4 inline-flex items-center justify-center rounded-full bg-forest px-4 py-2.5 text-sm font-semibold text-cream-50 transition hover:bg-forest-700">
          View recipe
        </Link>
      </div>
    </motion.article>
  );
}
