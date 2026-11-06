/**
 * Copies the frontend's built-in catalogue into the in-memory store's development fixtures.
 * Only used with DATA_SOURCE=memory. Run after changing frontend/src/lib/data.
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CATEGORIES, INGREDIENTS } from '../../frontend/src/lib/data/ingredients';
import { RECIPES } from '../../frontend/src/lib/data/recipes';

const out = {
  _note: 'DEVELOPMENT FIXTURES ONLY — copied from frontend/src/lib/data by `npm run fixtures:sync`. Used only when DATA_SOURCE=memory. Not production data; never loaded in MySQL mode.',
  generatedAt: new Date().toISOString().slice(0, 10),
  categories: CATEGORIES,
  ingredients: INGREDIENTS,
  recipes: RECIPES.filter((r) => !r.id.startsWith('ai-')),
};
writeFileSync(resolve(__dirname, '../src/database/memory/fixtures/catalog.json'), JSON.stringify(out, null, 1));
console.log(`✓ ${out.ingredients.length} ingredients, ${out.recipes.length} recipes`);
