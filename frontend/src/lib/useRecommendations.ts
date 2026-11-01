"use client";
import { useMemo } from "react";
import { recommend } from "./recommend";
import { useStore } from "./store";

export function useRecommendations() {
  const pantry = useStore((s) => s.pantry);
  const filters = useStore((s) => s.filters);
  const profile = useStore((s) => s.profile);
  const favourites = useStore((s) => s.favourites);
  const history = useStore((s) => s.history);
  return useMemo(
    () => recommend({ pantry, filters, allergies: profile.allergies, profileDiets: profile.diets, favourites, history, weather: null }),
    [pantry, filters, profile, favourites, history],
  );
}
