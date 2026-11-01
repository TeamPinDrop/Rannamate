"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";

const PAGES = [
  { href: "/kitchen", emoji: "🧺", title: "My Kitchen", body: "Add what you have — by search or a photo of your fridge.", tone: "from-[#F2B33D]/40" },
  { href: "/discover", emoji: "🍽️", title: "Discover Recipes", body: "Filter by mood, cuisine, time and diet. See exactly what you're missing.", tone: "from-burgundy/30" },
  { href: "/mate", emoji: "🧑‍🍳", title: "Cooking Mate", body: "Ask by voice or text. Step-by-step help while you cook.", tone: "from-forest/30" },
  { href: "/planner", emoji: "🗓️", title: "Meal Planner", body: "Plan the week and get one merged shopping list.", tone: "from-[#9CC56A]/40" },
];

export function ExploreGrid() {
  return (
    <section className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <div className="mb-8 flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
        <div>
          <p className="eyebrow">Explore RANNAMATE</p>
          <h2 className="h-display mt-2 text-4xl text-forest sm:text-5xl">Where would you like to start?</h2>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {PAGES.map((pg, i) => (
          <motion.div key={pg.href} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08, duration: 0.6 }} whileHover={{ y: -6 }}>
            <Link href={pg.href} className={`glass glass-sheen group relative flex h-full min-h-[220px] flex-col justify-between overflow-hidden rounded-[2rem] bg-gradient-to-br ${pg.tone} to-transparent p-6`}>
              <span className="relative text-5xl transition duration-500 group-hover:scale-110 group-hover:-rotate-6">{pg.emoji}</span>
              <span className="relative">
                <span className="flex items-center justify-between font-display text-2xl font-semibold text-forest">
                  {pg.title}
                  <ArrowUpRight className="h-5 w-5 text-burgundy transition group-hover:translate-x-1 group-hover:-translate-y-1" />
                </span>
                <span className="mt-1.5 block text-sm text-forest/75">{pg.body}</span>
              </span>
            </Link>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
