import { ingredient } from "./data/ingredients";
import { RECIPE_BY_ID } from "./data/recipes";
import type { MealPlan, PantryItem, Unit } from "./types";

export interface ShoppingLine {
  ingredientId: string;
  unit: Unit;
  needed: number;
  have: number;
  toBuy: number;
  recipes: string[];
  note?: string;
}

/** Consolidates ingredients across every planned meal and subtracts what's in the pantry (same unit). */
export function buildShoppingList(plan: MealPlan, pantry: PantryItem[]): ShoppingLine[] {
  const acc = new Map<string, ShoppingLine>();
  for (const day of Object.values(plan)) {
    for (const rid of Object.values(day ?? {})) {
      const r = rid ? RECIPE_BY_ID[rid] : undefined;
      if (!r) continue;
      for (const ri of r.ingredients) {
        if (ri.optional || ingredient(ri.ingredientId).staple) continue;
        const key = `${ri.ingredientId}|${ri.unit}`;
        const line = acc.get(key) ?? { ingredientId: ri.ingredientId, unit: ri.unit, needed: 0, have: 0, toBuy: 0, recipes: [] };
        line.needed += ri.quantity;
        if (!line.recipes.includes(r.name)) line.recipes.push(r.name);
        acc.set(key, line);
      }
    }
  }
  const lines = Array.from(acc.values());
  for (const line of lines) {
    const p = pantry.find((x) => x.ingredientId === line.ingredientId);
    if (p && p.unit === line.unit) line.have = p.quantity;
    else if (p) line.note = `you have ${p.quantity} ${p.unit} — check if enough`;
    line.needed = +line.needed.toFixed(2);
    line.toBuy = p && p.unit !== line.unit ? 0 : Math.max(0, +(line.needed - line.have).toFixed(2));
  }
  return lines.sort((a, b) => ingredient(a.ingredientId).category.localeCompare(ingredient(b.ingredientId).category));
}
