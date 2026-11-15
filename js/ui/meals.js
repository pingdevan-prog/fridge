// Meals tab: recipe suggestions, internet search, recipe details, favourites and ratings.
import { state, commit, save, today, addDays, expiringSoon } from '../store.js';
import { FOOD } from '../data/foods.js';
import { CUISINES, MEAL_TYPES, FOOD_TYPES, localRecipes, getRecipe, keepRecipe, isFavorite, avgRating, buildCtx, scoreRecipe, matchesFilters, searchWeb, fromAI, violates, rateRecipe } from '../lib/recipes.js';
import { fridgeStatus } from '../lib/match.js';
import { scaleAmount, fmtAmount } from '../lib/units.js';
import { recipeNutrition, SOURCE } from '../lib/nutrition.js';
import { weekStart, weekDates, entryAt, setEntry, dayName, SLOTS } from '../lib/planner.js';
import { addManual } from '../lib/shopping.js';
import { hasAI, aiFindRecipes } from '../lib/ai.js';
import { startCooking } from './cook.js';
import { $, esc, on, ui, go, render as redraw, registerView, openSheet, sheetOf, toast, cap, shortDate, options } from './dom.js';

const f = { q: '', cuisine: '', mealType: '', foodType: '', maxCal: 0 };
let mode = 'all', web = [], webState = 'idle', webError = '', aiBusy = false, searchToken = 0, needSearch = true;

const stars = (n) => '★'.repeat(Math.round(n)) + '☆'.repeat(5 - Math.round(n));
export const thumb = (r, cls = '') => (r.image
  ? `<img class="thumb ${cls}" src="${esc(r.image)}" alt="" loading="lazy">`
  : `<span class="thumb ${cls}" aria-hidden="true">${r.emoji || '🍽️'}</span>`);
export const kcalText = (r) => (r.statedKcal ? `${r.statedKcal} kcal` : r.nutrition.kcal ? `about ${r.nutrition.kcal} kcal` : 'calories unknown');
export const timeText = (r) => `${r.timeEstimated ? 'about ' : ''}${r.totalMin} min`;

/** A recipe card. `s` is the score object from scoreRecipe. */
export function recipeCard(r, s, act = 'recipe-open', extra = '') {
  const rating = avgRating(r.id);
  const pct = s.total ? Math.round((s.have / s.total) * 100) : 0;
  return `<div class="rcard">
    <button class="rowf grow" style="align-items:flex-start;text-align:left;gap:12px" data-act="${act}" data-id="${r.id}" ${extra}>
      ${thumb(r)}
      <span class="grow"><span class="nm" style="display:block">${esc(r.name)}</span>
        <span class="muted small">${esc(r.sourceName)} · ${esc(timeText(r))} · ${esc(kcalText(r))}</span>
        <span class="small" style="display:block;margin-top:4px"><b>You have ${s.have} of ${s.total} ingredients</b></span>
        <span class="matchbar"><i style="width:${pct}%"></i></span>
        <span class="meta">${s.usesExp.length ? `<span class="badge red">Uses up ${esc(s.usesExp.slice(0, 2).join(', '))}</span>` : ''}
          ${rating ? `<span class="badge">${stars(rating.avg)}</span>` : ''}<span class="badge plain">${esc(r.cuisine)}</span></span>
      </span></button>
    <button class="fav" data-act="recipe-fav" data-id="${r.id}" aria-label="${isFavorite(r.id) ? 'Remove from favorites' : 'Save to favorites'}">${isFavorite(r.id) ? '❤️' : '🤍'}</button>
  </div>`;
}

function resultsHtml() {
  const ctx = buildCtx();
  const seen = new Set();
  let list = [...localRecipes(), ...web].filter((r) => r && !seen.has(r.id) && seen.add(r.id));
  list = mode === 'favorites' ? list.filter((r) => isFavorite(r.id)) : list.filter((r) => matchesFilters(r, f));
  let scored = list.map((r) => ({ r, s: scoreRecipe(r, ctx) })).sort((a, b) => b.s.score - a.s.score);
  if (ui.mealsFilter?.useExpiring) scored = scored.filter((x) => x.s.usesExp.length);
  const cards = scored.slice(0, 40).map(({ r, s }) => recipeCard(r, s)).join('');
  let status = '';
  if (mode === 'all') {
    if (webState === 'loading') status = `<div class="skel"></div><p class="muted small center">Searching recipe sites…</p>`;
    else if (webState === 'error') status = `<div class="note red">${esc(webError)} Showing the recipes saved on this device. <button class="link" data-act="meals-retry">Try again</button></div>`;
    else if (webState === 'done') status = `<p class="muted small center">Web results come from TheMealDB. Calories are estimates from the ingredients.</p>
      ${hasAI() ? `<button class="btn ghost block" data-act="meals-ai" ${aiBusy ? 'disabled' : ''}>${aiBusy ? 'Claude is searching the web…' : 'Search more recipe sites with Claude'}</button>` : ''}`;
  }
  if (!cards) {
    return (mode === 'favorites'
      ? `<div class="card empty"><div class="big">❤️</div><h2>No favorites yet</h2><p class="muted">Tap the heart on any recipe to save it here.</p></div>`
      : `<div class="card empty"><div class="big">🍳</div><h2>No recipes match</h2><p class="muted">Try removing a filter or searching for something else.</p><button class="btn soft" data-act="meals-clear">Clear filters</button></div>`) + status;
  }
  return cards + status;
}
function updateResults() { const el = $('#meals-results'); if (el) el.innerHTML = resultsHtml(); }

async function runSearch() {
  const token = ++searchToken;
  needSearch = false; webState = 'loading'; updateResults();
  try {
    const found = await searchWeb(f);
    if (token !== searchToken) return;
    web = found; webState = 'done';
  } catch (e) {
    if (token !== searchToken) return;
    webState = 'error'; webError = navigator.onLine === false ? 'You are offline.' : 'Could not reach the recipe site.';
  }
  updateResults();
}

const chipRow = (items, key) => `<div class="chips">${items.map(([v, l]) => `<button class="chip ${f[key] === v ? 'on' : ''}" data-act="meals-filter" data-k="${key}" data-v="${esc(v)}">${esc(l)}</button>`).join('')}</div>`;

function render() {
  if (needSearch && mode === 'all') queueMicrotask(runSearch);
  const pick = ui.pickFor;
  const exp = ui.mealsFilter?.useExpiring ? expiringSoon(4).map((i) => i.name).slice(0, 4) : null;
  return `<div class="top"><div><h1>Meals</h1><p class="sub">Ranked by what is already in your fridge</p></div></div>
    ${pick ? `<div class="banner"><span class="grow">Choosing ${esc(pick.slot)} for ${esc(dayName(pick.date))} ${esc(shortDate(pick.date))}. Open a recipe and tap “Use this meal”.</span><button class="btn sm" data-act="meals-pick-cancel">Cancel</button></div>` : ''}
    ${exp ? `<div class="banner"><span class="grow">Recipes that use up: ${esc(exp.join(', '))}</span><button class="btn sm" data-act="meals-exp-off">Show all</button></div>` : ''}
    <div class="stack tight">
      <form class="rowf" data-act="noop" onsubmit="return false"><input class="input grow" type="search" placeholder="Search recipes" value="${esc(f.q)}" data-change="meals-q" aria-label="Search recipes" enterkeyhint="search"><button class="btn" data-act="meals-go">Search</button></form>
      ${chipRow([['', 'Any cuisine'], ...CUISINES.map((c) => [c, c])], 'cuisine')}
      ${chipRow([['', 'Any meal'], ...MEAL_TYPES.map((m) => [m, cap(m)])], 'mealType')}
      ${chipRow([['', 'Any type'], ...FOOD_TYPES], 'foodType')}
      <div class="rowf"><label class="field grow"><span>Most calories per serving</span>
        <select class="input" data-change="meals-cal">${options([[0, 'No limit'], [300, '300'], [400, '400'], [500, '500'], [600, '600'], [700, '700'], [800, '800']].map(([v, l]) => [String(v), l]), String(f.maxCal))}</select></label></div>
      <div class="seg"><button class="${mode === 'all' ? 'on' : ''}" data-act="meals-mode" data-m="all">Suggestions</button><button class="${mode === 'favorites' ? 'on' : ''}" data-act="meals-mode" data-m="favorites">Favorites (${state.favorites.length})</button></div>
    </div>
    <div class="stack" id="meals-results" style="margin-top:14px">${resultsHtml()}</div>`;
}
registerView('meals', render);

on('noop', () => {});
on('meals-filter', (el) => { f[el.dataset.k] = el.dataset.v; needSearch = true; redraw(); });
on('meals-q', (el) => { f.q = el.value.trim(); needSearch = true; redraw(); });
on('meals-go', () => { f.q = $('[data-change="meals-q"]').value.trim(); needSearch = true; redraw(); });
on('meals-cal', (el) => { f.maxCal = Number(el.value); updateResults(); });
on('meals-mode', (el) => { mode = el.dataset.m; redraw(); });
on('meals-clear', () => { Object.assign(f, { q: '', cuisine: '', mealType: '', foodType: '', maxCal: 0 }); needSearch = true; redraw(); });
on('meals-retry', () => runSearch());
on('meals-pick-cancel', () => { ui.pickFor = null; go('plan'); });
on('meals-exp-off', () => { ui.mealsFilter = null; redraw(); });
on('meals-ai', async () => {
  aiBusy = true; updateResults();
  try {
    const found = await aiFindRecipes({ query: f.q, cuisine: f.cuisine, mealType: f.mealType, foodType: FOOD_TYPES.find((t) => t[0] === f.foodType)?.[1], maxCal: f.maxCal,
      have: state.fridge.filter((i) => i.qty > 0 && !FOOD[i.foodKey]?.basic).map((i) => i.name).slice(0, 30), avoid: [...state.household.allergies, ...state.household.neverEat] });
    const recipes = found.filter((o) => o && o.name && Array.isArray(o.ingredients)).map(fromAI).filter((r) => !violates(r));
    web = [...recipes, ...web];
    toast(recipes.length ? `Claude found ${recipes.length} more recipes` : 'Claude did not find more recipes this time.');
  } catch (e) { toast(e.message); }
  aiBusy = false; updateResults();
});
on('recipe-fav', (el) => {
  const id = el.dataset.id, r = getRecipe(id);
  if (isFavorite(id)) state.favorites = state.favorites.filter((x) => x !== id); else { state.favorites.push(id); keepRecipe(r); }
  save();
  const sh = sheetOf(el);
  if (sh) sh.refresh();
  if (ui.tab === 'meals') updateResults();
  toast(isFavorite(id) ? 'Saved to favorites' : 'Removed from favorites');
});

// ---------------- Recipe details ----------------
/** Scaled ingredient list with have / need status for a number of servings. */
export function scaledIngredients(r, servings) {
  const k = servings / (r.servings || 1);
  return r.ingredients.map((ing) => {
    const sc = scaleAmount(ing.qty, ing.unit, k, ing.foodKey);
    const scaled = { ...ing, qty: sc.qty, unit: sc.unit, note: sc.note };
    return { ...scaled, st: fridgeStatus(scaled, state.fridge) };
  });
}
const statusBadge = (st) => (st.free ? '' : st.status === 'have' ? '<span class="badge green">Have it</span>' : st.status === 'some' ? '<span class="badge">Not enough</span>' : '<span class="badge red">Need it</span>');

export function openRecipe(id, opts = {}) {
  const r = getRecipe(id);
  if (!r) { toast('That recipe is no longer saved on this device.'); return; }
  const entry = opts.entryId ? state.plan.find((e) => e.id === opts.entryId) : null;
  let servings = entry?.servings || r.servings, rater = state.members[0]?.id;
  const sheet = openSheet(() => {
    const ings = scaledIngredients(r, servings);
    const nut = recipeNutrition(r, ings, servings).per;
    const need = ings.filter((i) => !i.st.free && i.st.status !== 'have');
    const pick = ui.pickFor;
    const mine = state.ratings.find((x) => x.recipeId === r.id && x.memberId === rater)?.stars || 0;
    const others = state.ratings.filter((x) => x.recipeId === r.id).map((x) => `${state.members.find((m) => m.id === x.memberId)?.name || 'Someone'} ${'★'.repeat(x.stars)}`);
    return `${r.image ? `<img class="hero" src="${esc(r.image)}" alt="">` : `<div class="hero" aria-hidden="true">${r.emoji || '🍽️'}</div>`}
      <h2>${esc(r.name)}</h2>
      <p class="sub">${r.sourceUrl ? `<a class="link" href="${esc(r.sourceUrl)}" target="_blank" rel="noopener">${esc(r.sourceName)}</a>` : esc(r.sourceName)}
        · ${esc(r.cuisine)} · prep ${r.prepMin} min, cook ${r.cookMin} min${r.timeEstimated ? ' (estimated)' : ''}</p>
      <div class="rowf wrap" style="margin:10px 0">${r.tags.map((t) => `<span class="badge plain">${esc(FOOD_TYPES.find((x) => x[0] === t)?.[1] || cap(t))}</span>`).join('')}</div>
      ${pick ? `<button class="btn dark block" data-act="recipe-use">Use this meal for ${esc(dayName(pick.date))} ${esc(pick.slot)}</button>` : `<div class="grid2"><button class="btn dark" data-act="recipe-cook">Start cooking</button><button class="btn soft" data-act="recipe-plan">Add to plan</button></div>`}
      <div class="card sec" style="padding:14px">
        <div class="rowf"><div class="grow"><h3>Servings</h3><p class="muted small">Amounts adjust automatically${r.servingsEstimated ? '. Original serving count is an estimate.' : ''}</p></div>
          <div class="stepper"><button data-act="recipe-serv" data-d="-1" aria-label="Fewer servings">−</button><b>${servings}</b><button data-act="recipe-serv" data-d="1" aria-label="More servings">＋</button></div></div>
        <div class="stats" style="margin-top:12px">${[['kcal', 'kcal'], ['protein', 'protein g'], ['carbs', 'carbs g'], ['fat', 'fat g'], ['fiber', 'fiber g']].map(([k, l]) => `<div><b>${nut[k]}</b><span>${l}</span></div>`).join('')}</div>
        <p class="muted small" style="margin-top:8px">Per serving. ${esc(SOURCE)}; ${r.nutCounted} of ${r.nutTotal} ingredients counted.${r.statedKcal ? ` The source site lists ${r.statedKcal} kcal per serving.` : ''}</p>
      </div>
      <div class="sec"><div class="rowf"><h2 class="grow">Ingredients</h2><span class="muted small">${ings.filter((i) => !i.st.free).length - need.length} of ${ings.filter((i) => !i.st.free).length} at home</span></div>
        <div>${ings.map((i) => `<div class="ing"><span class="amt">${esc(fmtAmount(i.qty, i.unit) || 'some')}</span><span class="grow">${esc(i.name)}${i.note ? ` <span class="muted small">(${esc(i.note)})</span>` : ''}</span>${statusBadge(i.st)}</div>`).join('')}</div>
        ${need.length ? `<button class="btn soft block" style="margin-top:10px" data-act="recipe-need">Add ${need.length} missing to shopping list</button>` : ''}</div>
      <div class="sec"><h2>Steps</h2><ol class="steps">${r.steps.map((s) => `<li><span>${esc(s)}</span></li>`).join('')}</ol>
        ${r.video ? `<p style="margin-top:10px"><a class="link" href="${esc(r.video)}" target="_blank" rel="noopener">Watch the video</a></p>` : ''}</div>
      <div class="card sec" style="padding:14px"><h3>How did the family like it?</h3>
        <div class="chips wrap" style="margin:8px 0">${state.members.map((m) => `<button class="chip ${rater === m.id ? 'on' : ''}" data-act="recipe-rater" data-id="${m.id}">${m.emoji} ${esc(m.name)}</button>`).join('')}</div>
        <div class="rowf wrap"><button class="icon-btn" data-act="recipe-rate" data-n="1" aria-label="Thumbs down">👎</button>
          <span class="stars">${[1, 2, 3, 4, 5].map((n) => `<button class="${n <= mine ? 'on' : ''}" data-act="recipe-rate" data-n="${n}" aria-label="${n} stars">⭐</button>`).join('')}</span>
          <button class="icon-btn" data-act="recipe-rate" data-n="5" aria-label="Thumbs up">👍</button></div>
        ${others.length ? `<p class="muted small" style="margin-top:6px">${esc(others.join(' · '))}</p>` : '<p class="muted small" style="margin-top:6px">Ratings shape future suggestions and meal plans.</p>'}
      </div>
      <button class="btn ghost block sec" data-act="recipe-fav" data-id="${r.id}">${isFavorite(r.id) ? '❤️ Saved to favorites' : '🤍 Save to favorites'}</button>`;
  }, { full: true });
  sheet.ctx = { r, entry, get servings() { return servings; }, setServings(n) { servings = Math.max(1, Math.min(24, n)); sheet.refresh(); },
    get rater() { return rater; }, setRater(id) { rater = id; sheet.refresh(); } };
  return sheet;
}

on('recipe-open', (el) => openRecipe(el.dataset.id));
on('recipe-serv', (el) => { const c = sheetOf(el).ctx; c.setServings(c.servings + Number(el.dataset.d)); });
on('recipe-rater', (el) => sheetOf(el).ctx.setRater(el.dataset.id));
on('recipe-rate', (el) => {
  const sh = sheetOf(el), c = sh.ctx;
  rateRecipe(c.r, c.rater, Number(el.dataset.n));
  sh.refresh(); toast('Thanks! Future suggestions will use this.');
});
on('recipe-need', (el) => {
  const c = sheetOf(el).ctx;
  const need = scaledIngredients(c.r, c.servings).filter((i) => !i.st.free && i.st.status !== 'have');
  for (const i of need) addManual(i.st.food ? i.st.food.key : i.name, i.qty || 1, i.qty ? i.unit : 'each');
  commit(); toast(`${need.length} items added to your shopping list`);
});
on('recipe-cook', (el) => { const sh = sheetOf(el), c = sh.ctx; sh.close(); startCooking(c.r, { servings: c.servings, entryId: c.entry?.id }); });
on('recipe-use', (el) => {
  const sh = sheetOf(el), c = sh.ctx, p = ui.pickFor;
  setEntry(p.date, p.slot, c.r);
  ui.pickFor = null; sh.close(); commit(); go('plan');
  toast(`${c.r.name} added to ${dayName(p.date)} ${p.slot}`);
});
on('recipe-plan', (el) => {
  const r = sheetOf(el).ctx.r;
  let ws = weekStart();
  const sheet = openSheet(() => `<h2>Add to plan</h2><p class="sub">${esc(r.name)}</p>
    <div class="stack tight" style="margin-top:12px">${weekDates(ws).filter((d) => d >= today()).map((d) => `<div class="rowf"><b style="width:86px">${esc(dayName(d))} ${esc(shortDate(d).split(' ')[1])}</b>
      ${SLOTS.map((s) => { const e = entryAt(d, s); const cur = e && getRecipe(e.recipeId);
        return `<button class="chip grow" style="padding:0 8px" data-act="recipe-plan-set" data-date="${d}" data-slot="${s}" title="${cur ? esc(cur.name) : ''}">${cap(s)}${cur ? ' ↺' : ''}</button>`; }).join('')}</div>`).join('')}
      <p class="muted small">↺ means that slot already has a meal, which will be replaced.</p>
      <button class="btn ghost sm" data-act="recipe-plan-next">Show next week</button></div>`);
  sheet.ctx = { r, next() { ws = ws === weekStart() ? addDays(ws, 7) : weekStart(); sheet.refresh(); } };
});
on('recipe-plan-next', (el) => sheetOf(el).ctx.next());
on('recipe-plan-set', (el) => {
  const sh = sheetOf(el), r = sh.ctx.r;
  setEntry(el.dataset.date, el.dataset.slot, r);
  commit(); sh.close();
  toast(`${r.name} added to ${dayName(el.dataset.date)} ${el.dataset.slot}`);
});
