// Recipes: the family's own recipes, recipes saved from the web, live web search (TheMealDB), filtering and ranking.
import { FOOD } from '../data/foods.js';
import { parseIngredient, toGrams } from './units.js';
import { findFood, fridgeStatus, tokens } from './match.js';
import { recipeNutrition } from './nutrition.js';
import { state, expiringSoon, save, uid, today } from '../store.js';

export const CUISINES = ['Indian', 'Mexican', 'Tex-Mex', 'Italian', 'Chinese', 'Mediterranean', 'American', 'Japanese', 'Thai', 'French'];
export const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'];
export const FOOD_TYPES = [['vegetarian', 'Vegetarian'], ['high-protein', 'High protein'], ['low-carb', 'Low carb'], ['comfort', 'Comfort food'],
  ['quick', 'Quick (under 30 min)'], ['one-pot', 'One pot'], ['kid-friendly', 'Kid friendly']];
const CUISINE_GROUPS = { Mediterranean: ['Mediterranean', 'Greek', 'Turkish', 'Moroccan', 'Egyptian', 'Tunisian', 'Spanish'], 'Tex-Mex': ['Tex-Mex', 'Mexican'], Mexican: ['Mexican', 'Tex-Mex'] };
const MEAT_WORDS = /\b(chicken|beef|pork|bacon|ham|sausage|turkey|lamb|mutton|goat|veal|duck|fish|salmon|tuna|cod|shrimp|prawn|anchov|crab|lobster|mussel|clam|oyster|squid|chorizo|pepperoni|prosciutto|gelatin|steak|mince|meat)/i;
const SPICY = new Set(['jalapeño', 'chili powder', 'red pepper flakes', 'curry powder']);

const cache = new Map(); // id -> prepared recipe (saved recipes and this session's web results)

/** Parse ingredient lines, attach foods, compute nutrition, health and automatic tags. Safe to call twice. */
export function prep(r) {
  r.ingredients = r.ingredients.map((i) => {
    const ing = typeof i === 'string' ? parseIngredient(i) : i;
    if (ing.foodKey === undefined) ing.foodKey = findFood(ing.name)?.key || null;
    return ing;
  });
  const nut = recipeNutrition(r);
  Object.assign(r, { nutrition: nut.per, nutCounted: nut.counted, nutTotal: nut.total, vegCount: nut.vegCount, totalMin: (r.prepMin || 0) + (r.cookMin || 0) });
  const tags = new Set(r.userTags || r.tags || []); // userTags: the ones picked by hand on a family recipe
  const hasMeat = r.ingredients.some((i) => (i.foodKey && (FOOD[i.foodKey].meat || FOOD[i.foodKey].fish)) || (!i.foodKey && MEAT_WORDS.test(i.name)));
  if (!hasMeat) tags.add('vegetarian'); else tags.delete('vegetarian');
  const known = nut.total && nut.counted / nut.total >= 0.6;
  if (known && nut.per.protein >= 25) tags.add('high-protein');
  if (known && nut.per.carbs <= 25) tags.add('low-carb');
  if (r.totalMin && r.totalMin <= 30) tags.add('quick');
  r.tags = [...tags];
  // Simple 0..1 healthiness score from calories, fiber, protein, fat share and vegetables.
  const n = nut.per;
  let h = 0.5;
  if (n.kcal) {
    if (n.kcal >= 250 && n.kcal <= 700) h += 0.15; else if (n.kcal > 900) h -= 0.2;
    h += n.fiber >= 6 ? 0.15 : n.fiber >= 3 ? 0.07 : 0;
    if (n.protein >= 20) h += 0.1;
    if ((n.fat * 9) / n.kcal > 0.5) h -= 0.15;
  }
  h += nut.vegCount >= 3 ? 0.15 : nut.vegCount >= 1 ? 0.07 : -0.1;
  r.health = Math.max(0, Math.min(1, h));
  cache.set(r.id, r);
  return r;
}
export function getRecipe(id) {
  const saved = state.recipes?.[id];
  if (saved) return cache.get(id) === saved ? saved : prep(saved); // re-prepare if sync or undo swapped the object
  return cache.get(id) || null;
}
/** Every recipe saved on this device (the family's own, plus web recipes that were saved, planned, cooked or rated). */
export function localRecipes() {
  return Object.keys(state.recipes || {}).map(getRecipe);
}
/** "My recipes": the ones the family wrote, plus web recipes saved as favorites. The weekly plan is built from these. */
export function myRecipes() {
  return localRecipes().filter((r) => r.source === 'custom' || state.favorites.includes(r.id));
}
/** Create or update one of the family's own recipes. `d` comes from the recipe editor. */
export function saveCustomRecipe(d, id) {
  const r = {
    id: id || 'c-' + uid(), source: 'custom', sourceName: 'Our recipe', name: d.name, emoji: d.emoji || '🍽️', cuisine: d.cuisine || 'Other',
    mealTypes: d.mealTypes.length ? d.mealTypes : ['dinner'], userTags: d.tags || [], tags: [], servings: Math.max(1, Number(d.servings) || 4),
    prepMin: Math.max(0, Number(d.prepMin) || 0), cookMin: Math.max(0, Number(d.cookMin) || 0), leftovers: !!d.leftovers,
    ingredients: d.ingredients.map((line) => parseIngredient(line)), steps: d.steps,
  };
  state.recipes[r.id] = r;
  return prep(r);
}
/** Remove a recipe everywhere it is used. */
export function deleteRecipe(id) {
  delete state.recipes[id];
  cache.delete(id);
  state.favorites = state.favorites.filter((x) => x !== id);
  state.plan = state.plan.filter((e) => e.recipeId !== id);
  state.ratings = state.ratings.filter((x) => x.recipeId !== id);
}
/** Keep a web recipe on this device (needed once it is a favourite, planned, cooked or rated). */
export function keepRecipe(r) {
  if (!state.recipes[r.id]) state.recipes[r.id] = r;
}
export const isFavorite = (id) => state.favorites.includes(id);
export function avgRating(id) {
  const rs = state.ratings.filter((r) => r.recipeId === id);
  return rs.length ? { avg: rs.reduce((s, r) => s + r.stars, 0) / rs.length, count: rs.length } : null;
}

/** Save (or replace) one family member's rating for a recipe. Ratings feed future suggestions. */
export function rateRecipe(r, memberId, stars) {
  keepRecipe(r);
  state.ratings = state.ratings.filter((x) => !(x.recipeId === r.id && x.memberId === memberId));
  state.ratings.push({ id: uid(), recipeId: r.id, memberId, stars, date: today() });
  save();
}

// ---------- Family rules: allergies and foods we never eat ----------
const ALLERGEN_WORDS = { dairy: ['dairy', 'milk', 'lactose'], egg: ['egg', 'eggs'], gluten: ['gluten', 'wheat'], peanut: ['peanut', 'peanuts'],
  treenut: ['tree nut', 'tree nuts', 'nuts', 'nut'], soy: ['soy', 'soya'], fish: ['fish'], shellfish: ['shellfish'], sesame: ['sesame'] };
const EXTRA = { pork: ['bacon', 'sausage', 'deli turkey', 'pork chops', 'pork shoulder'], meat: null, seafood: null };

/** The allergy / never-eat term this recipe breaks, or null when it is fine. */
export function violates(r, terms = [...state.household.allergies, ...state.household.neverEat]) {
  for (const raw of terms) {
    const term = raw.toLowerCase().trim();
    if (!term) continue;
    const tt = tokens(term);
    for (const ing of r.ingredients) {
      const food = ing.foodKey && FOOD[ing.foodKey];
      if (food) {
        for (const [tag, words] of Object.entries(ALLERGEN_WORDS)) if (words.includes(term) && food.allergens.includes(tag)) return raw;
        if (term === 'meat' && food.meat) return raw;
        if ((term === 'seafood' || term === 'fish') && food.fish) return raw;
        if (EXTRA[term]?.includes(food.key)) return raw;
      }
      const set = new Set([...tokens(ing.name), ...(food ? tokens(food.key) : [])]);
      if (tt.length && tt.every((t) => set.has(t))) return raw;
    }
  }
  return null;
}

// ---------- Ranking ----------
const mainFoods = (r) => r.ingredients.filter((i) => i.foodKey && !FOOD[i.foodKey].basic && i.qty)
  .map((i) => [i.foodKey, toGrams(i.qty, i.unit, FOOD[i.foodKey]) || 0]).sort((a, b) => b[1] - a[1]).slice(0, 3).map((x) => x[0]);

/** Everything the scorer needs, computed once per search or plan. */
export function buildCtx() {
  const cuisineAff = {}, foodAff = {};
  for (const rt of state.ratings) {
    const rec = getRecipe(rt.recipeId);
    if (!rec) continue;
    const w = (rt.stars - 3) / 2;
    cuisineAff[rec.cuisine] = (cuisineAff[rec.cuisine] || 0) + w;
    for (const k of mainFoods(rec)) foodAff[k] = (foodAff[k] || 0) + w;
  }
  return {
    fridge: state.fridge, expKeys: new Set(expiringSoon(4).map((i) => i.foodKey).filter(Boolean)),
    likes: state.household.likes.map((s) => s.toLowerCase()), dislikes: state.household.dislikes.map((s) => s.toLowerCase()),
    cuisines: new Set(state.household.cuisines), cuisineAff, foodAff,
  };
}
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const mentions = (r, term) => r.name.toLowerCase().includes(term) || r.ingredients.some((i) => i.name.toLowerCase().includes(term) || (i.foodKey || '').includes(term));

/**
 * Rank a recipe: (1) ingredients we already have, (2) family preferences and past ratings,
 * (3) uses food that is about to expire, (4) how healthy it is.
 */
export function scoreRecipe(r, ctx) {
  let have = 0, haveFull = 0, total = 0;
  const missing = [], usesExp = new Set();
  for (const ing of r.ingredients) {
    const st = fridgeStatus(ing, ctx.fridge);
    if (st.free) continue;
    total++;
    if (st.status === 'have') { have++; haveFull++; } else { if (st.status === 'some') have += 0.5; missing.push(ing); }
    if (st.status !== 'need' && ing.foodKey && ctx.expKeys.has(ing.foodKey)) usesExp.add(ing.foodKey);
  }
  const match = total ? have / total : 0;
  let pref = 0.5;
  if (ctx.cuisines.has(r.cuisine) || (CUISINE_GROUPS[r.cuisine] || []).some((c) => ctx.cuisines.has(c))) pref += 0.15;
  pref += Math.min(0.2, ctx.likes.filter((t) => mentions(r, t)).length * 0.1);
  pref -= ctx.dislikes.filter((t) => mentions(r, t)).length * 0.25;
  const rating = avgRating(r.id);
  if (rating) pref += ((rating.avg - 3) / 2) * 0.3;
  pref += clamp((ctx.cuisineAff[r.cuisine] || 0) * 0.05, -0.1, 0.1);
  pref += clamp(mainFoods(r).reduce((s, k) => s + (ctx.foodAff[k] || 0), 0) * 0.03, -0.1, 0.1);
  if (isFavorite(r.id)) pref += 0.1;
  pref = clamp(pref, 0, 1);
  const exp = Math.min(1, usesExp.size / 2);
  return { score: 0.4 * match + 0.25 * pref + 0.2 * exp + 0.15 * r.health, have: haveFull, total, missing, usesExp: [...usesExp], match, pref };
}

/** Does a recipe pass the filter chips? */
export function matchesFilters(r, f) {
  if (violates(r)) return false;
  if (f.cuisine && r.cuisine !== f.cuisine && !(CUISINE_GROUPS[f.cuisine] || []).includes(r.cuisine)) return false;
  if (f.mealType && !r.mealTypes.includes(f.mealType)) return false;
  if (f.foodType && !r.tags.includes(f.foodType)) return false;
  if (f.maxCal && !(r.nutrition.kcal > 0 && r.nutrition.kcal <= f.maxCal)) return false;
  if (f.q) {
    const q = f.q.toLowerCase();
    if (!r.name.toLowerCase().includes(q) && !r.ingredients.some((i) => i.name.toLowerCase().includes(q))) return false;
  }
  return true;
}

// ---------- Web search: TheMealDB (free, real recipes with photos and source links) ----------
const API = 'https://www.themealdb.com/api/json/v1/1/';
const AREAS = { Indian: ['Indian'], Mexican: ['Mexican'], 'Tex-Mex': ['Mexican'], Italian: ['Italian'], Chinese: ['Chinese'],
  Mediterranean: ['Greek', 'Turkish', 'Moroccan'], American: ['American'], Japanese: ['Japanese'], Thai: ['Thai'], French: ['French'] };
const lookups = new Map();

async function api(path) {
  const res = await fetch(API + path);
  if (!res.ok) throw new Error('The recipe site did not respond.');
  return (await res.json()).meals || [];
}
async function lookup(id) {
  if (!lookups.has(id)) lookups.set(id, api('lookup.php?i=' + id).then((m) => m[0] || null).catch(() => null));
  return lookups.get(id);
}
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

function splitSteps(text) {
  let parts = String(text || '').split(/\r?\n+/).map((s) => s.trim()).filter((s) => s && !/^step\s*\d+:?$/i.test(s))
    .map((s) => s.replace(/^(step\s*)?\d+\s*[.):-]\s*/i, ''));
  if (parts.length < 3) {
    const sentences = String(text || '').replace(/\s+/g, ' ').match(/[^.!?]+[.!?]+/g) || [String(text || '')];
    parts = [];
    for (let i = 0; i < sentences.length; i += 2) parts.push(sentences.slice(i, i + 2).join(' ').trim());
  }
  return parts.filter(Boolean);
}
/** Rough cooking time from the durations mentioned in the instructions. */
function estimateMinutes(text) {
  let total = 0;
  for (const m of String(text).matchAll(/(\d+)(?:\s*(?:-|to)\s*(\d+))?\s*(hours?|hrs?|minutes?|mins?)/gi)) {
    const n = m[2] ? (Number(m[1]) + Number(m[2])) / 2 : Number(m[1]);
    total += /^h/i.test(m[3]) ? n * 60 : n;
  }
  return Math.round(clamp(total || 30, 10, 240) / 5) * 5;
}

/** Convert a TheMealDB meal into our Recipe shape. */
function fromMealDB(m) {
  const id = 'w-' + m.idMeal;
  if (cache.has(id)) return cache.get(id);
  const ingredients = [];
  for (let i = 1; i <= 20; i++) {
    const name = (m['strIngredient' + i] || '').trim(), measure = (m['strMeasure' + i] || '').trim();
    if (!name) continue;
    const p = parseIngredient(measure.replace(/(\d)\s*(kg|g|ml|l|oz|lbs?|tbsp|tbs|tblsp|tsp|cups?)\b/gi, '$1 $2') + ' x');
    ingredients.push({ qty: p.qty, unit: p.qty ? p.unit : '', name, raw: `${measure} ${name}`.trim() });
  }
  const cat = m.strCategory || '', text = m.strInstructions || '';
  const mealTypes = cat === 'Breakfast' ? ['breakfast'] : cat === 'Dessert' ? ['snack'] : cat === 'Starter' || cat === 'Side' ? ['lunch', 'snack'] : ['lunch', 'dinner'];
  const tags = [];
  if (/pie|casserole|stew|mac|lasagn|bake|curry|soup|chili|roast/i.test(m.strMeal)) tags.push('comfort');
  if (/one[- ]pot|slow cooker|casserole|stew|soup|skillet|traybake|sheet pan|one pan/i.test(m.strMeal + ' ' + text)) tags.push('one-pot');
  let host = 'TheMealDB';
  try { if (m.strSource) host = new URL(m.strSource).hostname.replace(/^www\./, ''); } catch { /* keep default */ }
  const cook = estimateMinutes(text), prepMin = Math.min(30, 5 + Math.round(ingredients.length * 1.5 / 5) * 5);
  const r = prep({
    id, name: m.strMeal, source: 'web', sourceName: host, sourceUrl: m.strSource || `https://www.themealdb.com/meal/${m.idMeal}`,
    image: m.strMealThumb || '', emoji: '🍽️', cuisine: m.strArea || 'Other', mealTypes, tags, servings: 4, servingsEstimated: true,
    prepMin, cookMin: cook, timeEstimated: true, ingredients, steps: splitSteps(text), video: m.strYoutube || '',
  });
  if (['Pasta', 'Chicken'].includes(cat) && !r.ingredients.some((i) => SPICY.has(i.foodKey))) r.tags.push('kid-friendly');
  return r;
}

/** Convert a recipe found by Claude web search into our Recipe shape. */
export function fromAI(o) {
  let h = 0;
  for (const ch of String(o.sourceUrl || o.name)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  let host = o.sourceName || '';
  try { if (!host && o.sourceUrl) host = new URL(o.sourceUrl).hostname.replace(/^www\./, ''); } catch { /* ignore */ }
  const r = prep({
    id: 'a-' + h.toString(36), name: o.name, source: 'web', sourceName: host || 'Web', sourceUrl: o.sourceUrl || '', image: '', emoji: '🍽️',
    cuisine: o.cuisine || 'Other', mealTypes: Array.isArray(o.mealTypes) && o.mealTypes.length ? o.mealTypes : ['dinner'], tags: [],
    servings: Number(o.servings) || 4, prepMin: Number(o.prepMin) || 10, cookMin: Number(o.cookMin) || 20,
    ingredients: (o.ingredients || []).map(String), steps: (o.steps || []).map(String),
  });
  if (Number(o.caloriesPerServing) > 0) r.statedKcal = Math.round(Number(o.caloriesPerServing));
  return r;
}

/** Foods worth searching by: expiring first, then proteins and vegetables on hand. */
function fridgeSearchTerms() {
  const keys = [];
  const push = (i) => { if (i.foodKey && !FOOD[i.foodKey].basic && !keys.includes(i.foodKey)) keys.push(i.foodKey); };
  expiringSoon(4).forEach(push);
  state.fridge.filter((i) => i.qty > 0 && ['meat', 'seafood', 'produce'].includes(i.category)).forEach(push);
  return keys;
}

/** Search the internet (TheMealDB) for real recipes that fit the filters. */
export async function searchWeb(f) {
  let full;
  if (f.q) full = await api('search.php?s=' + encodeURIComponent(f.q));
  else {
    const areas = f.cuisine && AREAS[f.cuisine] ? (await Promise.all(AREAS[f.cuisine].map((a) => api('filter.php?a=' + a)))).flat() : null;
    let cats = null;
    if (f.mealType === 'breakfast') cats = await api('filter.php?c=Breakfast');
    else if (f.foodType === 'vegetarian') cats = (await Promise.all(['Vegetarian', 'Vegan'].map((c) => api('filter.php?c=' + c)))).flat();
    let metas;
    if (areas && cats) {
      const ids = new Set(cats.map((m) => m.idMeal));
      const both = areas.filter((m) => ids.has(m.idMeal));
      metas = both.length ? both : (f.mealType === 'breakfast' ? cats : areas);
    } else metas = areas || cats || [];
    if (!metas.length) {
      const lists = await Promise.all(fridgeSearchTerms().slice(0, 3).map((k) => api('filter.php?i=' + encodeURIComponent(k.replace(/ /g, '_'))).catch(() => [])));
      metas = lists.flat();
      if (!metas.length) metas = await api('filter.php?c=Chicken');
    }
    const seen = new Set();
    metas = shuffle(metas.filter((m) => !seen.has(m.idMeal) && seen.add(m.idMeal))).slice(0, 18);
    full = (await Promise.all(metas.map((m) => lookup(m.idMeal)))).filter(Boolean);
  }
  return full.map(fromMealDB);
}
