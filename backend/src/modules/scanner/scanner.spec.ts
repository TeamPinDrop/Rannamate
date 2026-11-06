import catalog from '../../database/memory/fixtures/catalog.json';
import type { Ingredient } from '../../domain/types';
import { matchIngredient } from './scanner.module';

const cat = catalog.ingredients as unknown as Ingredient[];
describe('scanner label → catalogue matching', () => {
  it.each([
    ['tomatoes', 'tomato'], ['Red Onions', 'onion'], ['haldi', 'turmeric'], ['aloo', 'potato'], ['green chillies', 'green-chilli'], ['Paneer', 'paneer'],
  ])('%s → %s', (label, id) => expect(matchIngredient(label, cat)?.id).toBe(id));
  it('returns null for things not in the catalogue', () => {
    expect(matchIngredient('dragon fruit', cat)).toBeNull();
    expect(matchIngredient('', cat)).toBeNull();
  });
});
