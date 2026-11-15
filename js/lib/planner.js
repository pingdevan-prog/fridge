// Weekly meal plan: breakfast, lunch and dinner for 7 days.
import { state, uid, today, addDays, parseYmd } from '../store.js';
import { myRecipes, getRecipe, buildCtx, scoreRecipe, violates, avgRating, keepRecipe } from './recipes.js';
import { AGE_GROUPS, zero, addInto } from './nutrition.js';

export const SLOTS = ['breakfast', 'lunch', 'dinner'];
export const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
// Share of the day's calories each meal aims for (the rest is snacks).
const SHARE = { breakfast: 0.25, lunch: 0.3, dinner: 0.35 };

/** Monday of the week containing the date. */
export function weekStart(d = today()) { return addDays(d, -((parseYmd(d).getDay() + 6) % 7)); }
export const weekDates = (ws) => Array.from({ length: 7 }, (_, i) => addDays(ws, i));
export const entryAt = (date, slot) => state.plan.find((e) => e.date === date && e.slot === slot);
export const dayName = (date) => DAY_NAMES[(parseYmd(date).getDay() + 6) % 7];

/** Average daily calorie target per person (personal goal, or the middle of the healthy range for the age group). */
export function targetKcal() {
  const vals = state.members.map((m) => m.calorieGoal || (AGE_GROUPS[m.ageGroup].range[0] + AGE_GROUPS[m.ageGroup].range[1]) / 2);
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 2000;
}

/** Recipes the planner may use: only "My recipes", minus allergy conflicts and meals the family disliked. */
export function planPool() {
  return myRecipes().filter((r) => !violates(r) && !((avgRating(r.id)?.avg ?? 5) <= 2));
}

/** Leftover lunches must come after the dinner they came from; otherwise they become normal meals. */
function fixLeftovers() {
  for (const e of state.plan) {
    if (!e.leftoverOf) continue;
    const src = state.plan.find((x) => x.id === e.leftoverOf);
    if (!src || src.recipeId !== e.recipeId || src.date >= e.date) { delete e.leftoverOf; if (src) src.servings = state.household.size; }
  }
}

/**
 * Build the week. Locked meals stay; every other slot is (re)filled using fridge contents,
 * family preferences, ratings, expiring food, calorie goals and variety.
 */
export function generateWeek(ws) {
  const dates = weekDates(ws), size = state.household.size, allowRepeats = state.household.allowRepeats;
  state.plan = state.plan.filter((e) => !dates.includes(e.date) || e.locked || e.cooked);
  fixLeftovers();
  const ctx = buildCtx(), pool = planPool(), target = targetKcal();
  const base = new Map(pool.map((r) => [r.id, scoreRecipe(r, ctx).score]));
  const used = new Map(); // recipe id -> times used this week
  for (const e of state.plan) if (dates.includes(e.date) && !e.leftoverOf) used.set(e.recipeId, (used.get(e.recipeId) || 0) + 1);
  let leftovers = state.plan.filter((e) => dates.includes(e.date) && e.leftoverOf).length, lastLeftover = -9;

  const pick = (slot, i, repeatsOk = allowRepeats) => {
    const weekday = i < 5;
    const prev = slot === 'dinner' && i > 0 ? getRecipe(entryAt(dates[i - 1], 'dinner')?.recipeId) : null;
    let best = null, bestS = -Infinity;
    for (const r of pool) {
      if (!r.mealTypes.includes(slot)) continue;
      if (used.has(r.id) && !repeatsOk) continue;
      let s = base.get(r.id) + Math.random() * 0.25;
      s -= 0.35 * (used.get(r.id) || 0); // with few recipes, spread the repeats evenly
      if (r.mealTypes[0] === slot) s += 0.08;
      if (weekday && slot === 'dinner' && r.totalMin > state.household.weeknightMinutes) s -= 0.4;
      if (weekday && slot === 'breakfast' && r.totalMin > 20) s -= 0.15;
      if (r.nutrition.kcal) { const want = target * SHARE[slot]; s -= Math.min(0.45, (Math.abs(r.nutrition.kcal - want) / want) * 0.45); }
      if (prev && prev.cuisine === r.cuisine) s -= 0.15;
      if (s > bestS) { best = r; bestS = s; }
    }
    return best || (repeatsOk ? null : pick(slot, i, true));
  };
  const add = (date, slot, r, extra = {}) => {
    const e = { id: uid(), date, slot, recipeId: r.id, servings: size, locked: false, ...extra };
    state.plan.push(e); if (!extra.leftoverOf) used.set(r.id, (used.get(r.id) || 0) + 1); keepRecipe(r);
    return e;
  };

  // Dinners first (they drive leftovers), then lunches, then breakfasts.
  dates.forEach((date, i) => {
    if (entryAt(date, 'dinner')) return;
    const r = pick('dinner', i);
    if (!r) return;
    const e = add(date, 'dinner', r);
    const batch = r.leftovers ?? r.tags.includes('one-pot');
    if (batch && i < 6 && leftovers < 2 && i - lastLeftover > 1 && !entryAt(dates[i + 1], 'lunch')) {
      e.servings = size * 2; // cook double, eat the rest for lunch tomorrow
      add(dates[i + 1], 'lunch', r, { leftoverOf: e.id });
      leftovers++; lastLeftover = i;
    }
  });
  for (const slot of ['lunch', 'breakfast']) dates.forEach((date, i) => { if (!entryAt(date, slot)) { const r = pick(slot, i); if (r) add(date, slot, r); } });
}

/** Calories and macros one person gets on a day (one serving of each planned meal). */
export function dayTotals(date) {
  const sum = zero();
  for (const e of state.plan) if (e.date === date) { const r = getRecipe(e.recipeId); if (r) addInto(sum, r.nutrition); }
  return sum;
}

/** Best other choices for a slot, for the Swap sheet. */
export function alternatives(date, slot, n = 8) {
  const dates = weekDates(weekStart(date)), ctx = buildCtx();
  const used = new Set(state.plan.filter((e) => dates.includes(e.date)).map((e) => e.recipeId));
  return planPool().filter((r) => r.mealTypes.includes(slot) && (state.household.allowRepeats || !used.has(r.id)))
    .map((r) => ({ r, s: scoreRecipe(r, ctx) })).sort((a, b) => b.s.score - a.s.score).slice(0, n);
}

/** Put a recipe into a slot (replacing what was there). */
export function setEntry(date, slot, recipe, extra = {}) {
  state.plan = state.plan.filter((e) => !(e.date === date && e.slot === slot));
  keepRecipe(recipe);
  const e = { id: uid(), date, slot, recipeId: recipe.id, servings: state.household.size, locked: false, ...extra };
  state.plan.push(e);
  fixLeftovers();
  return e;
}
export function removeEntry(id) { state.plan = state.plan.filter((e) => e.id !== id); fixLeftovers(); }

/** Drag and drop: move a meal to another slot, swapping with whatever is there. */
export function moveEntry(id, date, slot) {
  const e = state.plan.find((x) => x.id === id);
  if (!e || (e.date === date && e.slot === slot)) return false;
  const other = entryAt(date, slot);
  if (other) { other.date = e.date; other.slot = e.slot; }
  e.date = date; e.slot = slot;
  fixLeftovers();
  return true;
}
