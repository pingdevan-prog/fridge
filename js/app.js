// App entry: load saved data, register the tab views, start the service worker.
import { load, state, save } from './store.js';
import { initSync } from './lib/sync.js';
import { categoryOf } from './data/ingredients.js';
import { readSharedList } from './lib/shopping.js';
import { render, toast } from './ui/dom.js';
import './ui/fridge.js';
import './ui/meals.js';
import './ui/plan.js';
import { openShared } from './ui/shop.js';
import './ui/me.js';
import './ui/cook.js';
import './ui/capture.js';
import './ui/suggest.js';

load();
removeOldDefaults();
initSync();
regroupFoods(); // after sync starts, so the fixes reach the other phones too
render();

/** Sort foods added before the Sauces and Grains groups existed (or filed as Other) into the right group. Runs once per phone. */
function regroupFoods() {
  try { if (localStorage.getItem('fridge.regrouped') === '2') return; } catch { return; }
  let changed = false;
  for (const i of state.fridge) {
    if (i.leftover) continue;
    const g = categoryOf(i.name);
    if (!g || g === i.category) continue;
    const fix = i.category === 'other' || ((i.category === 'pantry' || i.category === 'canned') && (g === 'sauces' || g === 'grains')) || (i.category === 'spices' && g === 'produce');
    if (fix) { i.category = g; changed = true; }
  }
  if (changed) save();
  try { localStorage.setItem('fridge.regrouped', '2'); } catch { /* ignore */ }
}

/** Earlier versions shipped sample groceries and starter recipes. Clear out anything left over from them. */
function removeOldDefaults() {
  const starter = (id) => String(id || '').startsWith('s-');
  const before = JSON.stringify([Object.keys(state.recipes).length, state.fridge.length, state.plan.length, state.logs.length, state.ratings.length, state.favorites.length, state.householdItems.length]);
  for (const k of ['fridge', 'householdItems', 'plan', 'logs', 'ratings']) state[k] = state[k].filter((x) => !x.sample);
  state.plan = state.plan.filter((e) => !starter(e.recipeId));
  state.ratings = state.ratings.filter((r) => !starter(r.recipeId));
  state.favorites = state.favorites.filter((id) => !starter(id));
  for (const k of Object.keys(state.prices)) if (state.prices[k].sample) delete state.prices[k];
  // Recipes found online are no longer part of the app: keep only the family's own.
  const gone = new Set(Object.keys(state.recipes).filter((id) => starter(id) || state.recipes[id].source !== 'custom'));
  for (const id of gone) delete state.recipes[id];
  if (gone.size) {
    state.plan = state.plan.filter((e) => !gone.has(e.recipeId));
    state.ratings = state.ratings.filter((r) => !gone.has(r.recipeId));
    state.favorites = state.favorites.filter((id) => !gone.has(id));
  }
  delete state.sample; delete state.seeded;
  const after = JSON.stringify([Object.keys(state.recipes).length, state.fridge.length, state.plan.length, state.logs.length, state.ratings.length, state.favorites.length, state.householdItems.length]);
  if (before !== after) { state.shopping = state.shopping.filter((s) => s.manual); save(); }
}

// A family member opened a shared shopping-list link.
const shared = readSharedList(location.hash);
if (shared?.length) openShared(shared);

// Installable, and the app shell works offline.
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).catch(() => {});
  // A new version took over: reload once so the whole app comes from the same version.
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadController && !reloaded) { reloaded = true; location.reload(); } });
}
window.addEventListener('offline', () => toast('You are offline. Your fridge and saved recipes still work.'));
