// Fuzzy matching between free-text food names (recipes, receipts, fridge items)
// and the food knowledge base.
import { FOODS, FOOD } from '../data/foods.js';
import { toGrams } from './units.js';

// Words that never help identify the food (brand names, filler).
const STOP = new Set(['heb', 'h', 'e', 'b', 'hill', 'country', 'fare', 'central', 'market', 'organics', 'organic', 'brand',
  'the', 'a', 'an', 'of', 'and', 'or', 'for', 'with', 'to', 'in', 'fresh', 'natural', 'select', 'ingredients', 'meal', 'simple',
  'oz', 'lb', 'ct', 'pk', 'each']);

const singular = (w) => {
  if (w.length < 4) return w;
  if (w.endsWith('ies')) return w.slice(0, -3) + 'y';
  if (w.endsWith('oes')) return w.slice(0, -2);
  if (w.endsWith('ss') || w.endsWith('us') || w.endsWith('is')) return w;
  if (w.endsWith('s')) return w.slice(0, -1);
  return w;
};

/** Lowercase, strip accents/punctuation/brands, singularise. */
export function tokens(name) {
  return String(name || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/h-e-b/g, ' ').replace(/[^a-z%\s]/g, ' ').split(/\s+/).filter((w) => w && !STOP.has(w)).map(singular);
}

// Pre-tokenised alias index.
const INDEX = [];
for (const f of FOODS) for (const a of [f.key, ...f.aliases]) {
  const t = tokens(a);
  if (t.length) INDEX.push({ t, food: f });
}
const cache = new Map();

/** Best knowledge-base food for a name, or null. Longest alias wins; ties favour the last word (the head noun). */
export function findFood(name) {
  const key = String(name || '').toLowerCase();
  if (cache.has(key)) return cache.get(key);
  const t = tokens(name), set = new Set(t), last = t[t.length - 1];
  let best = null, bestScore = 0;
  for (const e of INDEX) {
    if (e.t.length > t.length || !e.t.every((w) => set.has(w))) continue;
    const score = e.t.length * 10 + (e.t.includes(last) ? 5 : 0) + (e.t.length === t.length ? 3 : 0);
    if (score > bestScore) { best = e.food; bestScore = score; }
  }
  cache.set(key, best);
  return best;
}

/** 0..1 similarity of two names (share of the shorter name's words found in the longer). */
export function nameScore(a, b) {
  const A = new Set(tokens(a)), B = new Set(tokens(b));
  if (!A.size || !B.size) return 0;
  let hit = 0;
  for (const w of A) if (B.has(w)) hit++;
  return hit / Math.min(A.size, B.size);
}

/** Do a fridge item and an ingredient refer to the same food? */
export function sameFood(item, ing) {
  const food = ing.foodKey ? FOOD[ing.foodKey] : findFood(ing.name);
  if (food) return item.foodKey === food.key;
  if (item.foodKey) return false;
  return nameScore(item.name, ing.name) >= 0.99;
}

/**
 * Check an ingredient against the fridge.
 * status: 'have' (enough), 'some' (not enough), 'need' (none).
 */
export function fridgeStatus(ing, fridge) {
  const food = ing.foodKey ? FOOD[ing.foodKey] : findFood(ing.name);
  if (food?.key === 'water' || /^(water|ice|ice cubes)$/i.test(ing.name)) return { status: 'have', items: [], food, free: true };
  const items = fridge.filter((i) => !i.leftover && i.qty > 0 && sameFood(i, { ...ing, foodKey: food?.key }));
  if (!items.length) return { status: 'need', items, food };
  const needG = ing.qty ? toGrams(ing.qty, ing.unit || 'each', food) : null;
  if (food?.basic || needG == null) return { status: 'have', items, food, needG };
  let haveG = 0;
  for (const i of items) {
    const g = toGrams(i.qty, i.unit, food);
    if (g == null) return { status: 'have', items, food, needG }; // can't measure it, trust that it's there
    haveG += g;
  }
  return { status: haveG >= needG * 0.9 ? 'have' : 'some', items, food, needG, haveG };
}
