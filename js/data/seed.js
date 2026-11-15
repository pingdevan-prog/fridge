// Sample data so a new family can try everything right away, plus a way to clear it.
import { state, addToFridge, today, addDays, uid, parseYmd } from '../store.js';
import { FOOD } from './foods.js';
import { SAMPLE_RECEIPT } from './heb.js';
import { parseReceiptText, splitBrand } from '../lib/receipt.js';
import { getRecipe } from '../lib/recipes.js';
import { generateWeek, weekStart } from '../lib/planner.js';
import { rebuildShopping } from '../lib/shopping.js';

const STAPLES = ['salt', 'black pepper', 'olive oil', 'vegetable oil', 'cumin', 'chili powder', 'turmeric', 'garam masala', 'italian seasoning',
  'cinnamon', 'sugar', 'flour', 'soy sauce', 'honey', 'baking powder', 'ketchup', 'oregano'];
const SAMPLE_FAVS = ['s-chicken-tikka-masala', 's-beef-tacos', 's-baked-penne'];

export function loadSample() {
  const bought = addDays(today(), -2);
  // 1. A sample H-E-B receipt's worth of groceries, bought two days ago.
  for (const it of parseReceiptText(SAMPLE_RECEIPT).filter((i) => i.conf >= 0.7)) {
    if (!it.isFood) { state.householdItems.push({ id: uid(), name: it.name, qty: it.qty, unit: it.unit, price: it.price, addedAt: bought, sample: true }); continue; }
    const { brand, name } = splitBrand(it.name);
    addToFridge({ ...it, name, brand, addedAt: bought, sample: true });
    if (it.foodKey && it.price != null) state.prices[it.foodKey] = { price: it.price, qty: it.qty, unit: it.unit, date: bought, sample: true };
  }
  // 2. Spices and staples already in the kitchen.
  for (const key of STAPLES) {
    const f = FOOD[key];
    addToFridge({ name: key.replace(/\b\w/g, (c) => c.toUpperCase()), foodKey: key, qty: 1, unit: f.buy[0], staple: true, addedAt: addDays(today(), -30), sample: true });
  }
  // 3. Leftovers from earlier in the week.
  const chili = getRecipe('s-turkey-chili');
  addToFridge({ name: 'Leftover Turkey and Bean Chili', qty: 2, unit: 'serving', category: 'leftovers', location: 'fridge', leftover: true,
    expiresAt: addDays(today(), 2), addedAt: addDays(today(), -2), nutrition: { per: 'serving', ...chili.nutrition, source: 'From the recipe' }, sample: true });
  // 4. A few saved recipes and ratings.
  for (const id of SAMPLE_FAVS) if (!state.favorites.includes(id)) state.favorites.push(id);
  [['s-chicken-tikka-masala', 'm1', 5], ['s-beef-tacos', 'm3', 5], ['s-baked-penne', 'm4', 4], ['s-turkey-chili', 'm2', 4]]
    .forEach(([recipeId, memberId, stars]) => state.ratings.push({ id: uid(), recipeId, memberId, stars, date: bought, sample: true }));
  // 5. Three days of food log so the nutrition dashboard has something to show.
  const meals = [['breakfast', 's-veggie-scramble'], ['lunch', 's-burrito-bowls'], ['dinner', 's-turkey-chili'],
    ['breakfast', 's-overnight-oats'], ['lunch', 's-turkey-sandwiches'], ['dinner', 's-chicken-stir-fry'],
    ['breakfast', 's-breakfast-tacos'], ['lunch', 's-greek-chickpea-salad'], ['dinner', 's-spaghetti-meat-sauce']];
  meals.forEach(([slot, id], i) => {
    const r = getRecipe(id), date = addDays(today(), -3 + Math.floor(i / 3));
    for (const m of state.members) {
      const servings = m.ageGroup === 'teen' && slot === 'dinner' ? 1.5 : m.ageGroup === 'child' ? 0.75 : 1;
      state.logs.push({ id: uid(), date, slot, name: r.name, recipeId: id, memberId: m.id, servings, home: true, veg: r.vegCount > 0, sample: true,
        kcal: Math.round(r.nutrition.kcal * servings), protein: Math.round(r.nutrition.protein * servings), carbs: Math.round(r.nutrition.carbs * servings),
        fat: Math.round(r.nutrition.fat * servings), fiber: Math.round(r.nutrition.fiber * servings) });
    }
  });
  // 6. This week's plan and the shopping list that follows from it.
  generateWeek(weekStart());
  if (parseYmd(today()).getDay() === 0 || parseYmd(today()).getDay() >= 5) generateWeek(addDays(weekStart(), 7)); // late in the week: plan next week too
  state.plan.forEach((e) => { e.sample = true; });
  rebuildShopping();
  state.sample = true;
  state.seeded = true;
}

/** Remove everything that came from the sample data. Anything the family added stays. */
export function clearSample() {
  for (const k of ['fridge', 'householdItems', 'plan', 'logs', 'ratings']) state[k] = state[k].filter((x) => !x.sample);
  state.favorites = state.favorites.filter((id) => !SAMPLE_FAVS.includes(id));
  for (const k of Object.keys(state.prices)) if (state.prices[k].sample) delete state.prices[k];
  state.shopping = state.shopping.filter((s) => s.manual);
  state.sample = false;
}
