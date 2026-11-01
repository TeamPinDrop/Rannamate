"use client";
import { RotateCcw } from "lucide-react";
import { CUISINES, DIETS, DIFFICULTIES, EQUIPMENT, MOODS, TIME_OPTIONS } from "@/lib/data/options";
import { actions, useStore } from "@/lib/store";

function toggle<T>(arr: T[], v: T) {
  return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="border-t border-white/50 pt-4 first:border-0 first:pt-0">
      <legend className="mb-2.5 text-[11px] font-bold uppercase tracking-[0.2em] text-burgundy/80">{title}</legend>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </fieldset>
  );
}

function Pill({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} aria-pressed={on} className={`rounded-full px-3 py-1.5 text-[13px] font-semibold transition ${on ? "bg-forest text-cream-50" : "bg-white/40 text-forest hover:bg-white/70"}`}>
      {children}
    </button>
  );
}

export function FilterPanel() {
  const f = useStore((s) => s.filters);
  return (
    <div className="glass-strong space-y-4 rounded-[2rem] p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl font-semibold text-forest">Filters</h2>
        <button onClick={actions.resetFilters} className="flex items-center gap-1 text-xs font-semibold text-burgundy"><RotateCcw className="h-3.5 w-3.5" /> Reset</button>
      </div>
      <Group title="Mood">
        {MOODS.map((m) => <Pill key={m.id} on={f.moods.includes(m.id)} onClick={() => actions.setFilters({ moods: toggle(f.moods, m.id) })}>{m.emoji} {m.label}</Pill>)}
      </Group>
      <Group title="Cuisine">
        {CUISINES.map((c) => <Pill key={c} on={f.cuisines.includes(c)} onClick={() => actions.setFilters({ cuisines: toggle(f.cuisines, c) })}>{c}</Pill>)}
      </Group>
      <Group title="Cooking time">
        {TIME_OPTIONS.map((t) => <Pill key={t.label} on={f.maxTime === t.value} onClick={() => actions.setFilters({ maxTime: t.value })}>{t.label}</Pill>)}
      </Group>
      <Group title="Diet (strict)">
        {DIETS.map((d) => <Pill key={d.id} on={f.diets.includes(d.id)} onClick={() => actions.setFilters({ diets: toggle(f.diets, d.id) })}>{d.label}</Pill>)}
      </Group>
      <Group title="Difficulty">
        {DIFFICULTIES.map((d) => <Pill key={d} on={f.difficulty.includes(d)} onClick={() => actions.setFilters({ difficulty: toggle(f.difficulty, d) })}>{d}</Pill>)}
      </Group>
      <Group title="Equipment I have">
        {EQUIPMENT.map((e) => <Pill key={e.id} on={f.equipment.includes(e.id)} onClick={() => actions.setFilters({ equipment: toggle(f.equipment, e.id) })}>{e.emoji} {e.label}</Pill>)}
      </Group>
      <p className="text-[11px] leading-relaxed text-forest/60">Diets, allergies (set in Profile) and equipment are hard exclusions. Mood, cuisine, time and difficulty re-rank results.</p>
    </div>
  );
}
