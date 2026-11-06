"use client";
import Link from "next/link";
import { Suspense } from "react";
import { Heart, History } from "lucide-react";
import { Notice, PageHeader } from "@/components/ui/PageHeader";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { AccountCard } from "@/components/auth/AccountCard";
import { ALLERGENS, DIETS } from "@/lib/data/options";
import { RECIPE_BY_ID } from "@/lib/data/recipes";
import { actions, useStore } from "@/lib/store";

/** Your account — needs sign-in (unsigned visitors are sent to Sign In and brought back here). */
export default function ProfilePage() {
  return (
    <Suspense>
      <RequireAuth><ProfileContent /></RequireAuth>
    </Suspense>
  );
}

function ProfileContent() {
  const profile = useStore((s) => s.profile);
  const favourites = useStore((s) => s.favourites);
  const history = useStore((s) => s.history);
  const toggle = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  return (
    <div className="mx-auto max-w-5xl px-4 pb-20 pt-32 sm:px-6">
      <PageHeader eyebrow="Profile" title={<>Your <em className="text-burgundy">preferences</em></>} />
      <AccountCard />
      <div className="mb-6"><Notice tone="info">Name, allergies and diets are saved to your account. Favourites and cooking history are still kept in this browser.</Notice></div>
      <div className="grid gap-6 md:grid-cols-2">
        <section className="glass-strong space-y-5 rounded-[2rem] p-6">
          <label className="block">
            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-burgundy/80">Name</span>
            <input value={profile.name} onChange={(e) => actions.setProfile({ name: e.target.value })} placeholder="What should RANNAMATE call you?" className="mt-2 w-full rounded-xl bg-white/60 px-4 py-2.5 text-forest outline-none focus:ring-2 focus:ring-forest" />
          </label>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-burgundy/80">Allergies — always excluded</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {ALLERGENS.map((a) => {
                const on = profile.allergies.includes(a.id);
                return <button key={a.id} onClick={() => actions.setProfile({ allergies: toggle(profile.allergies, a.id) })} aria-pressed={on} className={`chip ${on ? "bg-burgundy text-cream-50" : "bg-white/40 text-forest hover:bg-white/70"}`}>{a.label}</button>;
              })}
            </div>
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-burgundy/80">Dietary preferences — always applied</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {DIETS.map((d) => {
                const on = profile.diets.includes(d.id);
                return <button key={d.id} onClick={() => actions.setProfile({ diets: toggle(profile.diets, d.id) })} aria-pressed={on} className={`chip ${on ? "bg-forest text-cream-50" : "bg-white/40 text-forest hover:bg-white/70"}`}>{d.label}</button>;
              })}
            </div>
          </div>
        </section>
        <section className="space-y-6">
          <div className="glass rounded-[2rem] p-6">
            <h2 className="flex items-center gap-2 font-display text-xl font-semibold text-forest"><Heart className="h-5 w-5 text-burgundy" /> Favourites</h2>
            {!favourites.length && <p className="mt-3 text-sm text-forest/65">No favourites yet.</p>}
            <ul className="mt-3 space-y-1.5">{favourites.map((id) => RECIPE_BY_ID[id] && <li key={id}><Link href={`/recipes/${id}`} className="block rounded-xl bg-white/35 px-3 py-2 text-forest hover:bg-white/60">{RECIPE_BY_ID[id].emoji} {RECIPE_BY_ID[id].name}</Link></li>)}</ul>
          </div>
          <div className="glass rounded-[2rem] p-6">
            <h2 className="flex items-center gap-2 font-display text-xl font-semibold text-forest"><History className="h-5 w-5 text-burgundy" /> Cooking history</h2>
            {!history.length && <p className="mt-3 text-sm text-forest/65">Finish a recipe in cooking mode and it shows up here.</p>}
            <ul className="mt-3 space-y-1.5">{history.slice(0, 10).map((h, i) => RECIPE_BY_ID[h.recipeId] && <li key={i} className="flex justify-between rounded-xl bg-white/35 px-3 py-2 text-sm text-forest"><span>{RECIPE_BY_ID[h.recipeId].emoji} {RECIPE_BY_ID[h.recipeId].name}</span><span className="text-forest/60">{new Date(h.at).toLocaleDateString()}</span></li>)}</ul>
          </div>
        </section>
      </div>
    </div>
  );
}
