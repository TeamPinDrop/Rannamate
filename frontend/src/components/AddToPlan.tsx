"use client";
import { useState } from "react";
import { CalendarPlus, Check } from "lucide-react";
import { actions } from "@/lib/store";
import type { DayKey, MealSlot } from "@/lib/types";

export const DAYS: { id: DayKey; label: string }[] = [
  { id: "mon", label: "Monday" }, { id: "tue", label: "Tuesday" }, { id: "wed", label: "Wednesday" },
  { id: "thu", label: "Thursday" }, { id: "fri", label: "Friday" }, { id: "sat", label: "Saturday" }, { id: "sun", label: "Sunday" },
];
export const SLOTS: MealSlot[] = ["breakfast", "lunch", "dinner"];

export function AddToPlan({ recipeId, dark }: { recipeId: string; dark?: boolean }) {
  const [day, setDay] = useState<DayKey>("mon");
  const [slot, setSlot] = useState<MealSlot>("dinner");
  const [done, setDone] = useState(false);
  const sel = `rounded-full px-3 py-2 text-sm outline-none ${dark ? "bg-cream/15 text-cream-50" : "bg-white/60 text-forest"}`;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select value={day} onChange={(e) => { setDay(e.target.value as DayKey); setDone(false); }} className={sel} aria-label="Day">
        {DAYS.map((d) => <option key={d.id} value={d.id} className="text-forest">{d.label}</option>)}
      </select>
      <select value={slot} onChange={(e) => { setSlot(e.target.value as MealSlot); setDone(false); }} className={`${sel} capitalize`} aria-label="Meal">
        {SLOTS.map((s) => <option key={s} value={s} className="text-forest">{s}</option>)}
      </select>
      <button onClick={() => { actions.setMeal(day, slot, recipeId); setDone(true); }} className={dark ? "rounded-full bg-cream px-4 py-2 text-sm font-semibold text-burgundy" : "btn-ghost !py-2"}>
        {done ? <><Check className="h-4 w-4" /> Added</> : <><CalendarPlus className="h-4 w-4" /> Add to plan</>}
      </button>
    </div>
  );
}
