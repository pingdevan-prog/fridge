// Meals tab: the family's own recipes, the recipe editor, recipe details and ratings.
import { state, commit, today, addDays, expiringSoon } from '../store.js';
import { CUISINES, MEAL_TYPES, FOOD_TYPES, myRecipes, getRecipe, avgRating, buildCtx, scoreRecipe, matchesFilters, rateRecipe, saveCustomRecipe, deleteRecipe } from '../lib/recipes.js';
import { fridgeStatus, findFood } from '../lib/match.js';
import { scaleAmount, fmtAmount, fmtQty, UNITS } from '../lib/units.js';
import { recipeNutrition, SOURCE } from '../lib/nutrition.js';
import { weekStart, weekDates, entryAt, setEntry, dayName, SLOTS } from '../lib/planner.js';
import { addManual } from '../lib/shopping.js';
import { startCooking } from './cook.js';
import { ic, avatar, starsHtml } from './icons.js';
import { $, esc, on, ui, go, render as redraw, registerView, openSheet, sheetOf, toast, withUndo, fields, cap, shortDate, options } from './dom.js';

const f = { q: '', cuisine: '', mealType: '', foodType: '', maxCal: 0 };

export const thumb = (r, cls = '') => (r.image
  ? `<img class="thumb ${cls}" src="${esc(r.image)}" alt="" loading="lazy">`
  : `<span class="thumb ${cls}" aria-hidden="true">${ic('utensils')}</span>`);
export const kcalText = (r) => (r.nutrition.kcal ? `about ${r.nutrition.kcal} kcal` : 'calories unknown');
export const timeText = (r) => `${r.totalMin} min`;

/** A recipe card. `s` is the score object from scoreRecipe. */
export function recipeCard(r, s, act = 'recipe-open') {
  const rating = avgRating(r.id);
  const pct = s.total ? Math.round((s.have / s.total) * 100) : 0;
  return `<div class="rcard">
    <button class="rowf grow" style="align-items:flex-start;text-align:left;gap:12px" data-act="${act}" data-id="${r.id}">
      ${thumb(r)}
      <span class="grow"><span class="nm">${esc(r.name)}</span>
        <span class="muted small">${esc(timeText(r))} · ${esc(kcalText(r))}</span>
        <span class="small" style="display:block;margin-top:4px">You have <b>${s.have} of ${s.total}</b> ingredients</span>
        <span class="matchbar"><i style="width:${pct}%"></i></span>
        <span class="meta">${s.usesExp.length ? `<span class="badge red">Uses up ${esc(s.usesExp.slice(0, 2).join(', '))}</span>` : ''}
          ${rating ? starsHtml(rating.avg) : ''}<span class="badge plain">${esc(r.cuisine)}</span></span>
      </span></button>
  </div>`;
}

function resultsHtml() {
  const all = myRecipes();
  if (!all.length) return `<div class="card empty"><div class="big">${ic('book')}</div><h2>Add your family's recipes</h2>
    <p class="muted">Write down the meals you actually cook. The weekly plan and the shopping list are built from your recipes.</p>
    <button class="btn block" data-act="recipe-new">${ic('plus')}New recipe</button></div>`;
  const ctx = buildCtx();
  let scored = all.filter((r) => matchesFilters(r, f)).map((r) => ({ r, s: scoreRecipe(r, ctx) })).sort((a, b) => b.s.score - a.s.score);
  if (ui.mealsFilter?.useExpiring) scored = scored.filter((x) => x.s.usesExp.length);
  return scored.map(({ r, s }) => recipeCard(r, s)).join('')
    || `<div class="card empty"><div class="big">${ic('search')}</div><h2>No recipes match</h2><p class="muted">Try removing a filter.</p><button class="btn soft" data-act="meals-clear">Clear filters</button></div>`;
}
const updateResults = () => { const el = $('#meals-results'); if (el) el.innerHTML = resultsHtml(); };
const chipRow = (items, key) => `<div class="chips">${items.map(([v, l]) => `<button class="chip ${f[key] === v ? 'on' : ''}" data-act="meals-filter" data-k="${key}" data-v="${esc(v)}">${esc(l)}</button>`).join('')}</div>`;

function render() {
  const pick = ui.pickFor, count = myRecipes().length;
  const exp = ui.mealsFilter?.useExpiring ? expiringSoon(4).map((i) => i.name).slice(0, 4) : null;
  return `<div class="top"><div><h1>Meals</h1><p class="sub">${count ? `${count} ${count === 1 ? 'recipe' : 'recipes'}, best match for your fridge first` : 'Your family recipes'}</p></div>
      <button class="btn sm" data-act="recipe-new">${ic('plus')}New</button></div>
    ${pick ? `<div class="banner"><span class="grow">Choosing ${esc(pick.slot)} for ${esc(dayName(pick.date))} ${esc(shortDate(pick.date))}. Open a recipe and tap “Use this meal”.</span><button class="btn sm" data-act="meals-pick-cancel">Cancel</button></div>` : ''}
    ${exp ? `<div class="banner"><span class="grow">Recipes that use up: ${esc(exp.join(', '))}</span><button class="btn sm" data-act="meals-exp-off">Show all</button></div>` : ''}
    ${count > 3 ? `<div class="stack tight" style="margin-bottom:14px">
      <input class="input" type="search" placeholder="Search my recipes" value="${esc(f.q)}" data-input="meals-q" aria-label="Search my recipes">
      ${chipRow([['', 'Any meal'], ...MEAL_TYPES.map((m) => [m, cap(m)])], 'mealType')}
      ${chipRow([['', 'Any type'], ...FOOD_TYPES], 'foodType')}
      ${chipRow([['', 'Any cuisine'], ...CUISINES.map((c) => [c, c])], 'cuisine')}
    </div>` : ''}
    <div class="stack" id="meals-results">${resultsHtml()}</div>`;
}
registerView('meals', render);

on('meals-filter', (el) => { f[el.dataset.k] = el.dataset.v; redraw(); });
on('meals-q', (el) => { f.q = el.value.trim(); updateResults(); });
on('meals-clear', () => { Object.assign(f, { q: '', cuisine: '', mealType: '', foodType: '', maxCal: 0 }); redraw(); });
on('meals-pick-cancel', () => { ui.pickFor = null; go('plan'); });
on('meals-exp-off', () => { ui.mealsFilter = null; redraw(); });

// ---------------- Recipe editor (the family's own recipes) ----------------
const HAND_TAGS = [['kid-friendly', 'Kid friendly'], ['comfort', 'Comfort food'], ['one-pot', 'One pot']];
const UNIT_CHOICES = [['', 'No unit (count)'], ...UNITS.filter((u) => u !== 'each').map((u) => [u, u])];
const blankRow = () => ({ qty: '', unit: '', name: '' });
const stepLines = (text) => String(text || '').split(/\r?\n/).map((l) => l.replace(/^\s*(?:[-*•]\s+|\d+[.)]\s+)/, '').trim()).filter(Boolean);

function ingRow(row, i) {
  const known = row.name && findFood(row.name);
  return `<div class="ing-row" data-i="${i}">
    <div class="r1"><input class="input" name="n${i}" value="${esc(row.name)}" placeholder="Ingredient, start typing" autocomplete="off" data-suggest="recipe" aria-label="Ingredient ${i + 1}">
      <button class="icon-btn clear" data-act="recipe-ing-del" data-i="${i}" aria-label="Remove ingredient">${ic('trash')}</button></div>
    <div class="r2"><input class="input" name="q${i}" value="${esc(row.qty)}" placeholder="Amount: 1, 1/2" inputmode="decimal" aria-label="Amount">
      <select class="input" name="u${i}" aria-label="Unit">${options(UNIT_CHOICES, row.unit)}</select></div>
    ${row.name && !known ? '<p class="muted small">Not in the nutrition table, so calories for this one are not counted.</p>' : ''}
  </div>`;
}

function recipeEditor(r) {
  const d = r ? { name: r.name, cuisine: r.cuisine, mealTypes: new Set(r.mealTypes), tags: new Set(r.userTags || []), servings: r.servings, prepMin: r.prepMin, cookMin: r.cookMin,
    leftovers: !!r.leftovers, rows: r.ingredients.map((i) => ({ qty: i.qty ? fmtQty(i.qty) : '', unit: i.unit === 'each' ? '' : i.unit || '', name: i.name })), steps: r.steps.join('\n') }
    : { name: '', cuisine: state.household.cuisines[0] || 'Other', mealTypes: new Set(['dinner']), tags: new Set(), servings: state.household.size, prepMin: 10, cookMin: 20, leftovers: false, rows: [blankRow(), blankRow(), blankRow()], steps: '' };
  const sheet = openSheet(() => `<h2>${r ? 'Edit recipe' : 'New recipe'}</h2><p class="sub">Your recipes are what the weekly plan is built from.</p>
    <div class="stack" style="margin-top:12px" data-form="recipe">
      <label class="field"><span>Name</span><input class="input" name="name" value="${esc(d.name)}" placeholder="Mom's chicken curry"></label>
      <div><p class="field" style="margin-bottom:6px">When do you eat it?</p><div class="chips wrap">${MEAL_TYPES.map((m) => `<button class="chip ${d.mealTypes.has(m) ? 'on' : ''}" data-act="recipe-toggle" data-k="mealTypes" data-v="${m}">${cap(m)}</button>`).join('')}</div></div>
      <div class="grid2"><label class="field"><span>Cuisine</span><select class="input" name="cuisine">${options([...CUISINES, 'Other'], d.cuisine)}</select></label>
        <label class="field"><span>Servings it makes</span><input class="input" name="servings" type="number" inputmode="numeric" min="1" max="24" value="${d.servings}"></label></div>
      <div class="grid2"><label class="field"><span>Prep minutes</span><input class="input" name="prepMin" type="number" inputmode="numeric" min="0" value="${d.prepMin}"></label>
        <label class="field"><span>Cook minutes</span><input class="input" name="cookMin" type="number" inputmode="numeric" min="0" value="${d.cookMin}"></label></div>
      <div><p class="field" style="margin-bottom:6px">Ingredients</p><p class="muted small" style="margin-bottom:8px">Start typing and pick from the list. Foods in your fridge show first.</p>
        <div class="stack tight">${d.rows.map(ingRow).join('')}</div>
        <button class="btn ghost block" style="margin-top:8px" data-act="recipe-ing-add">${ic('plus')}Add ingredient</button></div>
      <label class="field"><span>Steps, one per line. Mention times like “simmer 10 minutes” to get timers</span>
        <textarea class="input" name="steps" style="min-height:160px" placeholder="Brown the chicken for 6 minutes.&#10;Add the onion and cook 5 minutes.">${esc(d.steps)}</textarea></label>
      <div><p class="field" style="margin-bottom:6px">Good to know</p><div class="chips wrap">${HAND_TAGS.map(([v, l]) => `<button class="chip ${d.tags.has(v) ? 'on' : ''}" data-act="recipe-toggle" data-k="tags" data-v="${v}">${l}</button>`).join('')}</div></div>
      <label class="check"><input type="checkbox" name="leftovers" ${d.leftovers ? 'checked' : ''}> Makes good leftovers (plan them for lunch the next day)</label>
      <div class="sticky-bar">${r ? `<button class="btn danger" data-act="recipe-delete" aria-label="Delete recipe">${ic('trash')}</button>` : ''}<button class="btn grow" data-act="recipe-save">Save recipe</button></div>
    </div>`, { full: true });
  sheet.ctx = {
    r, d,
    /** Copy what is typed in the form back into d (so redrawing never loses typing). */
    read() {
      const v = fields($('[data-form="recipe"]', sheet.body));
      for (const k of ['name', 'cuisine', 'servings', 'prepMin', 'cookMin', 'steps', 'leftovers']) d[k] = v[k];
      d.rows = d.rows.map((_, i) => ({ name: v['n' + i] || '', qty: v['q' + i] || '', unit: v['u' + i] || '' }));
    },
  };
  return sheet;
}
on('recipe-new', (el) => { sheetOf(el)?.close(); recipeEditor(null); });
on('recipe-edit', (el) => { const sh = sheetOf(el), r = sh.ctx.r; sh.close(); recipeEditor(r); });
on('recipe-toggle', (el) => { const set = sheetOf(el).ctx.d[el.dataset.k], v = el.dataset.v; set.has(v) ? set.delete(v) : set.add(v); el.classList.toggle('on'); });
on('recipe-ing-add', (el) => {
  const sh = sheetOf(el); sh.ctx.read(); sh.ctx.d.rows.push(blankRow()); sh.refresh();
  sh.body.querySelector(`[name="n${sh.ctx.d.rows.length - 1}"]`)?.focus();
});
on('recipe-ing-del', (el) => { const sh = sheetOf(el); sh.ctx.read(); sh.ctx.d.rows.splice(Number(el.dataset.i), 1); if (!sh.ctx.d.rows.length) sh.ctx.d.rows.push(blankRow()); sh.refresh(); });
on('recipe-save', (el) => {
  const sh = sheetOf(el), c = sh.ctx;
  c.read();
  const d = c.d, steps = stepLines(d.steps);
  const ingredients = d.rows.filter((row) => row.name.trim()).map((row) => [row.qty.trim(), row.qty.trim() ? row.unit : '', row.name.trim()].filter(Boolean).join(' '));
  if (!d.name) { toast('Give the recipe a name.'); return; }
  if (!ingredients.length) { toast('Add at least one ingredient.'); return; }
  if (!steps.length) { toast('Add at least one step.'); return; }
  const saved = saveCustomRecipe({ ...d, mealTypes: [...d.mealTypes], tags: [...d.tags], ingredients, steps }, c.r?.id);
  commit(); sh.close();
  toast(`${saved.name} saved`);
});
on('recipe-delete', (el) => {
  const sh = sheetOf(el), r = sh.ctx.r;
  sh.close();
  withUndo(`${r.name} deleted`, () => deleteRecipe(r.id));
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

/** Thumbs and stars for one family member's rating. */
export const rateControls = (act, mine, extra = '') => `<div class="rate-row">
  <button class="icon-btn clear" data-act="${act}" data-n="1" ${extra} aria-label="Thumbs down">${ic('thumbDown')}</button>
  <span class="stars">${[1, 2, 3, 4, 5].map((n) => `<button class="${n <= mine ? 'on' : ''}" data-act="${act}" data-n="${n}" ${extra} aria-label="${n} stars">${ic('star', '', n <= mine)}</button>`).join('')}</span>
  <button class="icon-btn clear" data-act="${act}" data-n="5" ${extra} aria-label="Thumbs up">${ic('thumbUp')}</button></div>`;

export function openRecipe(id, opts = {}) {
  const r = getRecipe(id);
  if (!r) { toast('That recipe is no longer saved on this device.'); return; }
  const entry = opts.entryId ? state.plan.find((e) => e.id === opts.entryId) : null;
  let servings = entry?.servings || r.servings, rater = state.members[0]?.id;
  const sheet = openSheet(() => {
    const ings = scaledIngredients(r, servings);
    const nut = recipeNutrition(r, ings, servings).per;
    const counted = ings.filter((i) => !i.st.free), need = counted.filter((i) => i.st.status !== 'have');
    const pick = ui.pickFor;
    const mine = state.ratings.find((x) => x.recipeId === r.id && x.memberId === rater)?.stars || 0;
    const others = state.ratings.filter((x) => x.recipeId === r.id).map((x) => `${state.members.find((m) => m.id === x.memberId)?.name || 'Someone'} ${x.stars}/5`);
    return `${r.image ? `<img class="hero" src="${esc(r.image)}" alt="">` : ''}
      <h2>${esc(r.name)}</h2>
      <p class="sub">${esc(r.cuisine)} · prep ${r.prepMin} min, cook ${r.cookMin} min</p>
      <div class="rowf wrap" style="margin:10px 0">${r.tags.map((t) => `<span class="badge plain">${esc(FOOD_TYPES.find((x) => x[0] === t)?.[1] || cap(t))}</span>`).join('')}</div>
      ${pick ? `<button class="btn block" data-act="recipe-use">Use this meal for ${esc(dayName(pick.date))} ${esc(pick.slot)}</button>`
        : `<div class="grid2"><button class="btn" data-act="recipe-cook">${ic('flame')}Cook</button><button class="btn soft" data-act="recipe-plan">${ic('calendar')}Add to plan</button></div>`}
      <div class="card sec" style="padding:14px;background:var(--bg);box-shadow:none">
        <div class="rowf"><div class="grow"><h3>Servings</h3><p class="muted small">Amounts adjust automatically</p></div>
          <div class="stepper"><button data-act="recipe-serv" data-d="-1" aria-label="Fewer servings">${ic('minus')}</button><b>${servings}</b><button data-act="recipe-serv" data-d="1" aria-label="More servings">${ic('plus')}</button></div></div>
        <div class="stats" style="margin-top:12px">${[['kcal', 'kcal'], ['protein', 'protein g'], ['carbs', 'carbs g'], ['fat', 'fat g'], ['fiber', 'fiber g']].map(([k, l]) => `<div style="background:var(--card)"><b>${nut[k]}</b><span>${l}</span></div>`).join('')}</div>
        <p class="muted small" style="margin-top:8px">Per serving. ${esc(SOURCE)}; ${r.nutCounted} of ${r.nutTotal} ingredients counted.</p>
      </div>
      <div class="sec"><div class="rowf"><h2 class="grow">Ingredients</h2><span class="muted small">${counted.length - need.length} of ${counted.length} at home</span></div>
        <div>${ings.map((i) => `<div class="ing"><span class="amt">${esc(fmtAmount(i.qty, i.unit) || 'some')}</span><span class="grow">${esc(i.name)}${i.note ? ` <span class="muted small">(${esc(i.note)})</span>` : ''}</span>${statusBadge(i.st)}</div>`).join('')}</div>
        ${need.length ? `<button class="btn soft block" style="margin-top:10px" data-act="recipe-need">${ic('cart')}Add ${need.length} missing to shopping list</button>` : ''}</div>
      <div class="sec"><h2>Steps</h2><ol class="steps">${r.steps.map((s) => `<li><span>${esc(s)}</span></li>`).join('')}</ol></div>
      <div class="card sec" style="padding:14px;background:var(--bg);box-shadow:none"><h3>How did the family like it?</h3>
        <div class="chips wrap" style="margin:10px 0 6px">${state.members.map((m) => `<button class="chip ${rater === m.id ? 'on' : ''}" data-act="recipe-rater" data-id="${m.id}">${avatar(m)}${esc(m.name)}</button>`).join('')}</div>
        ${rateControls('recipe-rate', mine)}
        <p class="muted small" style="margin-top:6px">${others.length ? esc(others.join(' · ')) : 'Ratings shape future suggestions and meal plans.'}</p>
      </div>
      <button class="btn ghost block sec" data-act="recipe-edit">${ic('pencil')}Edit this recipe</button>`;
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
  const sheet = openSheet(() => `<h2>Add to plan</h2><p class="sub">${esc(r.name)}. Pick a day and meal. A filled slot is replaced.</p>
    <div class="stack tight" style="margin-top:12px">${weekDates(ws).filter((d) => d >= today()).map((d) => `<div class="rowf"><b style="width:64px;flex:none">${esc(dayName(d))} ${esc(shortDate(d).split(' ')[1])}</b>
      ${SLOTS.map((s) => { const e = entryAt(d, s); const cur = e && getRecipe(e.recipeId);
        return `<button class="chip grow" style="padding:0 6px;justify-content:center${cur ? ';color:var(--ink-3)' : ''}" data-act="recipe-plan-set" data-date="${d}" data-slot="${s}" aria-label="${cap(s)} ${esc(dayName(d))}${cur ? ', replaces ' + esc(cur.name) : ''}">${cap(s)}</button>`; }).join('')}</div>`).join('')}
      <button class="btn ghost sm" data-act="recipe-plan-next">${ws === weekStart() ? 'Show next week' : 'Show this week'}</button></div>`);
  sheet.ctx = { r, next() { ws = ws === weekStart() ? addDays(ws, 7) : weekStart(); sheet.refresh(); } };
});
on('recipe-plan-next', (el) => sheetOf(el).ctx.next());
on('recipe-plan-set', (el) => {
  const sh = sheetOf(el), r = sh.ctx.r;
  setEntry(el.dataset.date, el.dataset.slot, r);
  commit(); sh.close();
  toast(`${r.name} added to ${dayName(el.dataset.date)} ${el.dataset.slot}`);
});
