// Calories and macros. Source: built-in table of estimates based on USDA FoodData Central
// reference values (per 100 g), plus an optional live USDA FoodData Central lookup.
import { FOOD } from '../data/foods.js';
import { findFood } from './match.js';
import { toGrams, isVol } from './units.js';

export const SOURCE = 'Estimate based on USDA FoodData Central reference values';
export const KEYS = ['kcal', 'protein', 'carbs', 'fat', 'fiber'];
export const zero = () => ({ kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 });
export const addInto = (a, b, k = 1) => { for (const key of KEYS) a[key] += (b?.[key] || 0) * k; return a; };
export const rounded = (n) => ({ kcal: Math.round(n.kcal), protein: Math.round(n.protein), carbs: Math.round(n.carbs), fat: Math.round(n.fat), fiber: Math.round(n.fiber) });

export const foodNutrition = (food, grams) => {
  const [kcal, protein, carbs, fat, fiber] = food.n, k = grams / 100;
  return { kcal: kcal * k, protein: protein * k, carbs: carbs * k, fat: fat * k, fiber: fiber * k };
};

/** Nutrition for one ingredient line, or null when we cannot measure it. */
export function ingredientNutrition(ing) {
  const food = ing.foodKey ? FOOD[ing.foodKey] : findFood(ing.name);
  if (!food || !ing.qty) return null;
  let g = toGrams(ing.qty, ing.unit || 'each', food);
  if (g == null) return null;
  // Deep-frying oil is mostly left in the pan: count about 3 tablespoons.
  if ((food.key === 'vegetable oil' || food.key === 'olive oil') && isVol(ing.unit) && g > 100) g = 45;
  return foodNutrition(food, g);
}

/**
 * Per-serving nutrition for a recipe, from the actual ingredient amounts.
 * Returns { per, counted, total, vegCount } - counted/total says how many ingredients had data.
 */
export function recipeNutrition(recipe, ingredients = recipe.ingredients, servings = recipe.servings) {
  const sum = zero();
  let counted = 0, total = 0, vegCount = 0;
  for (const ing of ingredients) {
    const food = ing.foodKey ? FOOD[ing.foodKey] : null;
    if (food?.veg || food?.fruit) vegCount++;
    if (!ing.qty) continue;
    total++;
    const n = ingredientNutrition(ing);
    if (n) { counted++; addInto(sum, n); }
  }
  const s = Math.max(1, servings || 1);
  const per = rounded({ kcal: sum.kcal / s, protein: sum.protein / s, carbs: sum.carbs / s, fat: sum.fat / s, fiber: sum.fiber / s });
  return { per, counted, total, vegCount };
}

/** Nutrition shown on a fridge item: custom values if entered, otherwise the table (per 100 g). */
export function itemNutrition(item) {
  if (item.nutrition) return { ...item.nutrition, source: item.nutrition.source || 'Entered by you' };
  const food = item.foodKey && FOOD[item.foodKey];
  if (!food) return null;
  const [kcal, protein, carbs, fat, fiber] = food.n;
  return { per: '100 g', kcal, protein, carbs, fat, fiber, source: SOURCE };
}

/** Nutrition for eating `qty` of a fridge item (in the item's unit). */
export function eatNutrition(item, qty) {
  const n = item.nutrition;
  if (n && n.per !== '100 g') return rounded({ kcal: n.kcal * qty, protein: (n.protein || 0) * qty, carbs: (n.carbs || 0) * qty, fat: (n.fat || 0) * qty, fiber: (n.fiber || 0) * qty });
  const food = item.foodKey && FOOD[item.foodKey];
  const g = toGrams(qty, item.unit, food);
  if (g == null) return null;
  if (n) return rounded({ kcal: n.kcal * g / 100, protein: (n.protein || 0) * g / 100, carbs: (n.carbs || 0) * g / 100, fat: (n.fat || 0) * g / 100, fiber: (n.fiber || 0) * g / 100 });
  return food ? rounded(foodNutrition(food, g)) : null;
}

// Daily calorie ranges from the Dietary Guidelines for Americans 2020-2025 (estimated needs by age and activity).
// Kids and teens get balanced-eating guidance instead of a calorie target.
export const AGE_GROUPS = {
  adult: { label: 'Adult', range: [1600, 3000], canSetGoal: true },
  teen: { label: 'Teen (13 to 18)', range: [1800, 3200], canSetGoal: false },
  child: { label: 'Child (4 to 12)', range: [1200, 2400], canSetGoal: false },
};
export const GOAL_MIN = 1500, GOAL_MAX = 4000;
export const GUIDELINE_SOURCE = 'Dietary Guidelines for Americans 2020-2025';

/** Live lookup in USDA FoodData Central. Returns up to 6 matches with per-100 g values. */
export async function usdaSearch(query, key) {
  const url = `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${encodeURIComponent(key || 'DEMO_KEY')}&query=${encodeURIComponent(query)}&pageSize=6&dataType=Foundation,SR%20Legacy`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(res.status === 429 ? 'The USDA lookup is busy right now. Try again in a little while.' : 'The USDA lookup did not respond.');
  const data = await res.json();
  const pick = (f, ids) => { const n = (f.foodNutrients || []).find((x) => ids.includes(x.nutrientId) && (ids[0] !== 1008 || /kcal/i.test(x.unitName || ''))); return n ? Math.round(n.value * 10) / 10 : 0; };
  return (data.foods || []).map((f) => ({
    name: f.description, fdcId: f.fdcId,
    n: { per: '100 g', kcal: pick(f, [1008, 2047, 2048]), protein: pick(f, [1003]), carbs: pick(f, [1005]), fat: pick(f, [1004]), fiber: pick(f, [1079]),
      source: `USDA FoodData Central #${f.fdcId}` },
  }));
}
