import type { Allergen, Cuisine, Diet, Difficulty, Equipment, Mood } from "../types";

export const MOODS: { id: Mood; label: string; emoji: string; blurb: string }[] = [
  { id: "comfort", label: "Comfort Food", emoji: "🍲", blurb: "Warm, familiar, soul-hugging" },
  { id: "spicy", label: "Spicy Cravings", emoji: "🌶️", blurb: "Heat that wakes you up" },
  { id: "healthy", label: "Healthy & Fresh", emoji: "🥗", blurb: "Bright, clean, nourishing" },
  { id: "quick", label: "Quick & Easy", emoji: "⚡", blurb: "On the table in minutes" },
  { id: "special", label: "Something Special", emoji: "✨", blurb: "A little celebration" },
  { id: "light", label: "Light & Refreshing", emoji: "🍋", blurb: "Easy on a warm day" },
  { id: "protein", label: "High Protein", emoji: "💪", blurb: "Fuel for the day" },
  { id: "surprise", label: "Surprise Me", emoji: "🎲", blurb: "Let RANNAMATE decide" },
];

export const CUISINES: Cuisine[] = ["Indian", "Italian", "Chinese", "Mexican", "Thai", "Japanese", "Continental", "Mediterranean"];

export const TIME_OPTIONS: { label: string; value: number | null }[] = [
  { label: "Under 15 min", value: 15 },
  { label: "15–30 min", value: 30 },
  { label: "30–45 min", value: 45 },
  { label: "45–60 min", value: 60 },
  { label: "No limit", value: null },
];

export const DIETS: { id: Diet; label: string }[] = [
  { id: "vegetarian", label: "Vegetarian" },
  { id: "vegan", label: "Vegan" },
  { id: "gluten-free", label: "Gluten-free" },
  { id: "dairy-free", label: "Dairy-free" },
  { id: "high-protein", label: "High-protein" },
  { id: "low-carb", label: "Low-carb" },
];

export const DIFFICULTIES: Difficulty[] = ["Beginner", "Intermediate", "Advanced"];

export const EQUIPMENT: { id: Equipment; label: string; emoji: string }[] = [
  { id: "gas", label: "Gas stove", emoji: "🔥" },
  { id: "induction", label: "Induction", emoji: "⚡" },
  { id: "oven", label: "Oven", emoji: "🍞" },
  { id: "microwave", label: "Microwave", emoji: "📡" },
  { id: "airfryer", label: "Air fryer", emoji: "🌀" },
  { id: "pressure", label: "Pressure cooker", emoji: "♨️" },
  { id: "pan", label: "Frying pan", emoji: "🍳" },
];

export const ALLERGENS: { id: Allergen; label: string }[] = [
  { id: "gluten", label: "Gluten" },
  { id: "dairy", label: "Dairy" },
  { id: "egg", label: "Egg" },
  { id: "nuts", label: "Nuts / peanuts" },
  { id: "soy", label: "Soy" },
  { id: "shellfish", label: "Shellfish" },
  { id: "fish", label: "Fish" },
];
