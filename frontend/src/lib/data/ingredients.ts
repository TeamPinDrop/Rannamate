import type { Ingredient, IngredientCategory } from "../types";

export const CATEGORIES: IngredientCategory[] = [
  "Vegetables", "Fruits", "Grains", "Rice & Pulses", "Dairy", "Meat & Seafood", "Spices", "Oils & Sauces", "Other",
];

export const INGREDIENTS: Ingredient[] = [
  // Vegetables
  { id: "tomato", name: "Tomato", emoji: "🍅", category: "Vegetables", defaultUnit: "pcs" },
  { id: "onion", name: "Onion", emoji: "🧅", category: "Vegetables", defaultUnit: "pcs" },
  { id: "potato", name: "Potato", emoji: "🥔", category: "Vegetables", defaultUnit: "pcs", aliases: ["aloo"] },
  { id: "green-chilli", name: "Green chilli", emoji: "🌶️", category: "Vegetables", defaultUnit: "pcs", aliases: ["mirchi", "chili"] },
  { id: "coriander", name: "Coriander", emoji: "🌿", category: "Vegetables", defaultUnit: "bunch", aliases: ["cilantro", "dhania"] },
  { id: "garlic", name: "Garlic", emoji: "🧄", category: "Vegetables", defaultUnit: "pcs" },
  { id: "ginger", name: "Ginger", emoji: "🫚", category: "Vegetables", defaultUnit: "g" },
  { id: "carrot", name: "Carrot", emoji: "🥕", category: "Vegetables", defaultUnit: "pcs" },
  { id: "bell-pepper", name: "Bell pepper", emoji: "🫑", category: "Vegetables", defaultUnit: "pcs", aliases: ["capsicum"] },
  { id: "mushroom", name: "Mushroom", emoji: "🍄", category: "Vegetables", defaultUnit: "g" },
  { id: "spinach", name: "Spinach", emoji: "🥬", category: "Vegetables", defaultUnit: "bunch", aliases: ["palak"] },
  { id: "cucumber", name: "Cucumber", emoji: "🥒", category: "Vegetables", defaultUnit: "pcs" },
  { id: "broccoli", name: "Broccoli", emoji: "🥦", category: "Vegetables", defaultUnit: "g" },
  { id: "corn", name: "Sweet corn", emoji: "🌽", category: "Vegetables", defaultUnit: "cup" },
  { id: "peas", name: "Green peas", emoji: "🫛", category: "Vegetables", defaultUnit: "cup", aliases: ["matar"] },
  { id: "spring-onion", name: "Spring onion", emoji: "🌱", category: "Vegetables", defaultUnit: "bunch", aliases: ["scallion"] },
  { id: "basil", name: "Basil", emoji: "🌿", category: "Vegetables", defaultUnit: "bunch" },
  // Fruits
  { id: "lemon", name: "Lemon", emoji: "🍋", category: "Fruits", defaultUnit: "pcs", aliases: ["lime", "nimbu"] },
  { id: "banana", name: "Banana", emoji: "🍌", category: "Fruits", defaultUnit: "pcs" },
  { id: "avocado", name: "Avocado", emoji: "🥑", category: "Fruits", defaultUnit: "pcs" },
  { id: "mango", name: "Mango", emoji: "🥭", category: "Fruits", defaultUnit: "pcs" },
  { id: "apple", name: "Apple", emoji: "🍎", category: "Fruits", defaultUnit: "pcs" },
  // Grains
  { id: "bread", name: "Bread", emoji: "🍞", category: "Grains", defaultUnit: "pcs" },
  { id: "pasta", name: "Pasta", emoji: "🍝", category: "Grains", defaultUnit: "g" },
  { id: "noodles", name: "Noodles", emoji: "🍜", category: "Grains", defaultUnit: "g" },
  { id: "oats", name: "Oats", emoji: "🥣", category: "Grains", defaultUnit: "cup" },
  { id: "flour", name: "Wheat flour", emoji: "🌾", category: "Grains", defaultUnit: "cup", aliases: ["atta"] },
  { id: "tortilla", name: "Tortilla", emoji: "🫓", category: "Grains", defaultUnit: "pcs", aliases: ["roti", "wrap"] },
  { id: "puffed-rice", name: "Puffed rice", emoji: "🍚", category: "Grains", defaultUnit: "cup", aliases: ["murmura", "muri", "kurmura", "mamra", "puffed rice", "murmure"] },
  { id: "sev", name: "Sev / bhujia", emoji: "🥨", category: "Other", defaultUnit: "tbsp", aliases: ["bhujia", "namkeen"] },
  { id: "poha", name: "Poha (flattened rice)", emoji: "🍚", category: "Grains", defaultUnit: "cup" },
  // Rice & pulses
  { id: "rice", name: "Rice", emoji: "🍚", category: "Rice & Pulses", defaultUnit: "g" },
  { id: "dal", name: "Toor / moong dal", emoji: "🫘", category: "Rice & Pulses", defaultUnit: "cup", aliases: ["lentils"] },
  { id: "chickpeas", name: "Chickpeas", emoji: "🫘", category: "Rice & Pulses", defaultUnit: "cup", aliases: ["chana"] },
  { id: "rajma", name: "Kidney beans", emoji: "🫘", category: "Rice & Pulses", defaultUnit: "cup", aliases: ["rajma"] },
  // Dairy
  { id: "egg", name: "Egg", emoji: "🥚", category: "Dairy", defaultUnit: "pcs", aliases: ["eggs"] },
  { id: "milk", name: "Milk", emoji: "🥛", category: "Dairy", defaultUnit: "ml" },
  { id: "butter", name: "Butter", emoji: "🧈", category: "Dairy", defaultUnit: "g" },
  { id: "paneer", name: "Paneer", emoji: "🧀", category: "Dairy", defaultUnit: "g" },
  { id: "cheese", name: "Cheese", emoji: "🧀", category: "Dairy", defaultUnit: "g" },
  { id: "curd", name: "Curd / yogurt", emoji: "🥛", category: "Dairy", defaultUnit: "cup", aliases: ["dahi", "yoghurt"] },
  { id: "cream", name: "Fresh cream", emoji: "🥛", category: "Dairy", defaultUnit: "ml" },
  // Meat & seafood
  { id: "chicken", name: "Chicken", emoji: "🍗", category: "Meat & Seafood", defaultUnit: "g" },
  { id: "fish", name: "Fish", emoji: "🐟", category: "Meat & Seafood", defaultUnit: "g" },
  { id: "prawns", name: "Prawns", emoji: "🦐", category: "Meat & Seafood", defaultUnit: "g", aliases: ["shrimp"] },
  // Spices
  { id: "salt", name: "Salt", emoji: "🧂", category: "Spices", defaultUnit: "tsp", staple: true },
  { id: "turmeric", name: "Turmeric", emoji: "🟡", category: "Spices", defaultUnit: "tsp", staple: true, aliases: ["haldi"] },
  { id: "cumin", name: "Cumin seeds", emoji: "🟤", category: "Spices", defaultUnit: "tsp", staple: true, aliases: ["jeera"] },
  { id: "chilli-powder", name: "Red chilli powder", emoji: "🔴", category: "Spices", defaultUnit: "tsp", staple: true },
  { id: "garam-masala", name: "Garam masala", emoji: "🟠", category: "Spices", defaultUnit: "tsp" },
  { id: "black-pepper", name: "Black pepper", emoji: "⚫", category: "Spices", defaultUnit: "tsp", staple: true },
  { id: "mustard-seeds", name: "Mustard seeds", emoji: "🟤", category: "Spices", defaultUnit: "tsp", staple: true },
  { id: "chilli-flakes", name: "Chilli flakes", emoji: "🌶️", category: "Spices", defaultUnit: "tsp" },
  // Oils & sauces
  { id: "oil", name: "Cooking oil", emoji: "🫗", category: "Oils & Sauces", defaultUnit: "tbsp", staple: true },
  { id: "olive-oil", name: "Olive oil", emoji: "🫒", category: "Oils & Sauces", defaultUnit: "tbsp" },
  { id: "soy-sauce", name: "Soy sauce", emoji: "🥢", category: "Oils & Sauces", defaultUnit: "tbsp" },
  { id: "ghee", name: "Ghee", emoji: "🧈", category: "Oils & Sauces", defaultUnit: "tbsp" },
  { id: "coconut-milk", name: "Coconut milk", emoji: "🥥", category: "Oils & Sauces", defaultUnit: "ml" },
  { id: "salsa", name: "Tomato salsa", emoji: "🥫", category: "Oils & Sauces", defaultUnit: "cup" },
  // Other
  { id: "sugar", name: "Sugar", emoji: "🍬", category: "Other", defaultUnit: "tsp", staple: true },
  { id: "water", name: "Water", emoji: "💧", category: "Other", defaultUnit: "cup", staple: true },
  { id: "peanuts", name: "Peanuts", emoji: "🥜", category: "Other", defaultUnit: "tbsp" },
  { id: "honey", name: "Honey", emoji: "🍯", category: "Other", defaultUnit: "tbsp" },
  { id: "tofu", name: "Tofu", emoji: "⬜", category: "Other", defaultUnit: "g" },
];

export const ING_BY_ID: Record<string, Ingredient> = Object.fromEntries(INGREDIENTS.map((i) => [i.id, i]));

export function ingredient(id: string): Ingredient {
  return ING_BY_ID[id] ?? { id, name: id, emoji: "🥄", category: "Other", defaultUnit: "pcs" };
}

export function searchIngredients(q: string): Ingredient[] {
  const s = q.trim().toLowerCase();
  if (!s) return INGREDIENTS;
  return INGREDIENTS.filter(
    (i) => i.name.toLowerCase().includes(s) || i.aliases?.some((a) => a.toLowerCase().includes(s)),
  );
}
