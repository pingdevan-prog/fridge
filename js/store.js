// App state, persistence (localStorage) and fridge inventory helpers.
//
// Data model (all stored in one JSON document):
//   household            { size, allergies[], neverEat[], likes[], dislikes[], cuisines[], weeknightMinutes, brandPref, allowRepeats }
//   members[]            FamilyMember   { id, name, ageGroup: adult|teen|child, calorieGoal?, emoji }
//   fridge[]             FridgeItem     { id, name, brand, foodKey?, qty, unit, category, location, addedAt, expiresAt,
//                                         nutrition?, price?, staple?, leftover?, sample? }
//   householdItems[]     non-food things from receipts { id, name, qty, price, addedAt }
//   recipes{}            Recipe         { id, name, source, sourceName, sourceUrl, image, emoji, cuisine, mealTypes[], tags[],
//                                         servings, prepMin, cookMin, timeEstimated?, ingredients[{name, qty, unit, raw, foodKey}], steps[] }
//   favorites[]          recipe ids
//   plan[]               MealPlanEntry  { id, date, slot, recipeId, servings, locked, leftoverOf?, sample? }
//   shopping[]           ShoppingListItem { id, key, name, foodKey?, qty, unit, section, checked, manual, uses[], estPrice, priceSource }
//   logs[]               MealLog        { id, date, slot, name, recipeId?, memberId, servings, kcal, protein, carbs, fat, fiber, veg, home }
//   ratings[]            Rating         { id, recipeId, memberId, stars, date }
//   brandChecks{}        BrandRecommendation verification results keyed by "brand|food"
//   prices{}             last price paid per food from scanned receipts { [foodKey]: { price, qty, unit, date } }
import { FOOD, CAT_DEFAULTS } from './data/foods.js';
import { findFood, nameScore } from './lib/match.js';
import { convert } from './lib/units.js';

const KEY = 'fridge.v1';
export const state = {};
const listeners = new Set();

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
export const ymd = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const today = () => ymd();
export const parseYmd = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const addDays = (s, n) => { const d = parseYmd(s); d.setDate(d.getDate() + n); return ymd(d); };
export const daysBetween = (a, b) => Math.round((parseYmd(b) - parseYmd(a)) / 864e5);
export const round2 = (n) => Math.round(n * 100) / 100;

const defaults = () => ({
  v: 1,
  household: { size: 4, allergies: [], neverEat: [], likes: [], dislikes: [], cuisines: ['Indian', 'Mexican', 'Italian', 'American'],
    weeknightMinutes: 45, brandPref: 'balanced', allowRepeats: false },
  members: [
    { id: 'm1', name: 'Mom', ageGroup: 'adult', emoji: '👩' },
    { id: 'm2', name: 'Dad', ageGroup: 'adult', emoji: '👨' },
    { id: 'm3', name: 'Teen', ageGroup: 'teen', emoji: '🧑' },
    { id: 'm4', name: 'Kid', ageGroup: 'child', emoji: '🧒' },
  ],
  fridge: [], householdItems: [], recipes: {}, favorites: [], plan: [], shopping: [], logs: [], ratings: [],
  brandChecks: {}, prices: {},
  settings: { model: 'claude-opus-5-5', usdaKey: '' },
  sample: false, seeded: false,
});

export function load() {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { saved = {}; }
  const d = defaults();
  Object.assign(state, d, saved);
  state.household = { ...d.household, ...(saved.household || {}) };
  state.settings = { ...d.settings, ...(saved.settings || {}) };
  if (navigator.storage?.persist) navigator.storage.persist().catch(() => {});
}
export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); return true; } catch (e) { console.warn('Could not save', e); return false; }
}
/** Save and tell the UI to redraw. */
export function commit() { save(); listeners.forEach((fn) => fn()); }
export const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

/** Snapshot / restore power Undo for destructive actions. */
export const snapshot = () => JSON.stringify(state);
export function restore(snap) {
  const data = JSON.parse(snap);
  for (const k of Object.keys(state)) delete state[k];
  Object.assign(state, data);
}
export function resetAll() {
  for (const k of Object.keys(state)) delete state[k];
  Object.assign(state, defaults(), { seeded: true });
}
export function replaceAll(data) {
  for (const k of Object.keys(state)) delete state[k];
  const d = defaults();
  Object.assign(state, d, data);
  state.household = { ...d.household, ...(data.household || {}) };
  state.settings = { ...d.settings, ...(data.settings || {}) };
}

// ---------- Fridge helpers ----------

/** Estimate an expiration date from the food type and where it is stored. */
export function estimateExpiry(food, category, location, from = today()) {
  let days = food?.days ?? CAT_DEFAULTS[category]?.[1] ?? 30;
  if (location === 'freezer') days = Math.max(days, 180);
  return addDays(from, days);
}

/**
 * Add an item to the fridge. If the same food is already there (same shelf), its quantity
 * grows instead of creating a duplicate. Returns the fridge item.
 */
export function addToFridge(f) {
  const food = f.foodKey ? FOOD[f.foodKey] : findFood(f.name);
  const category = f.category || food?.cat || 'other';
  const location = f.location || food?.loc || CAT_DEFAULTS[category]?.[0] || 'pantry';
  const addedAt = f.addedAt || today();
  const expiresAt = f.expiresAt || estimateExpiry(food, category, location, addedAt);
  const qty = round2(Number(f.qty) || 1), unit = f.unit || 'each';
  if (!f.leftover) {
    const existing = state.fridge.find((i) => !i.leftover && i.location === location &&
      (food ? i.foodKey === food.key && nameScore(i.name, f.name) >= 0.6 : !i.foodKey && nameScore(i.name, f.name) >= 0.99));
    if (existing) {
      const add = convert(qty, unit, existing.unit, food);
      if (add != null) {
        if (existing.qty <= 0) { existing.expiresAt = expiresAt; existing.addedAt = addedAt; }
        existing.qty = round2(Math.max(0, existing.qty) + add);
        if (f.price != null) existing.price = f.price;
        if (!f.sample) delete existing.sample;
        return existing;
      }
    }
  }
  const item = { id: uid(), name: f.name, brand: f.brand || '', foodKey: food?.key || null, qty, unit, category, location, addedAt, expiresAt };
  for (const k of ['nutrition', 'price', 'staple', 'leftover', 'sample', 'servG', 'recipeId']) if (f[k] != null) item[k] = f[k];
  state.fridge.push(item);
  return item;
}

/** Take an amount out of a fridge item. Staples stay at zero (so they land on the shopping list); other items are removed. */
export function deductFromItem(item, qty) {
  item.qty = round2(Math.max(0, item.qty - qty));
  if (item.qty <= 0.001) {
    item.qty = 0;
    if (!item.staple) state.fridge = state.fridge.filter((i) => i !== item);
  }
}

/** Items that expire within `days` days (or already have). */
export function expiringSoon(days = 3) {
  const t = today();
  return state.fridge.filter((i) => i.qty > 0 && i.location !== 'staples' && i.expiresAt && daysBetween(t, i.expiresAt) <= days)
    .sort((a, b) => a.expiresAt.localeCompare(b.expiresAt));
}
export const memberById = (id) => state.members.find((m) => m.id === id);
