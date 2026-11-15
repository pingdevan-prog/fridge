// Plan tab: 7 days of breakfast, lunch and dinner. Swap, lock, drag and drop, regenerate.
import { state, commit, today, addDays } from '../store.js';
import { weekStart, weekDates, entryAt, generateWeek, dayTotals, alternatives, setEntry, removeEntry, moveEntry, dayName, SLOTS, targetKcal, planPool } from '../lib/planner.js';
import { getRecipe } from '../lib/recipes.js';
import { openRecipe, recipeCard, thumb, timeText } from './meals.js';
import { esc, on, ui, go, render as redraw, registerView, openSheet, sheetOf, toast, withUndo, cap, shortDate, num } from './dom.js';

let ws = weekStart();

function mealHtml(e) {
  const r = getRecipe(e.recipeId);
  if (!r) return `<button class="addmeal" data-act="plan-swap" data-date="${e.date}" data-slot="${e.slot}">Recipe missing. Tap to choose another</button>`;
  const src = e.leftoverOf && state.plan.find((x) => x.id === e.leftoverOf);
  const detail = e.cooked ? 'Cooked' : src ? `Leftovers from ${dayName(src.date)}` : `${timeText(r)}${e.servings !== state.household.size ? ` · makes ${e.servings}` : ''}`;
  return `<div class="meal ${e.cooked ? 'cooked' : ''}">
    <span class="mini handle" data-drag="${e.id}" role="button" aria-label="Drag ${esc(r.name)} to another day">⠿</span>
    <button class="open" data-act="plan-open" data-id="${e.id}">${thumb(r, 'sm')}
      <span><span class="nm">${esc(r.name)}</span><span class="muted small">${esc(detail)} · ${r.nutrition.kcal || '?'} kcal</span></span></button>
    <button class="mini ${e.locked ? 'on' : ''}" data-act="plan-lock" data-id="${e.id}" aria-label="${e.locked ? 'Unlock' : 'Lock'} ${esc(r.name)}" aria-pressed="${!!e.locked}">${e.locked ? '🔒' : '🔓'}</button>
    <button class="mini" data-act="plan-swap" data-date="${e.date}" data-slot="${e.slot}" aria-label="Swap ${esc(r.name)}">🔁</button>
  </div>`;
}

function render() {
  const dates = weekDates(ws), entries = state.plan.filter((e) => dates.includes(e.date));
  const target = targetKcal(), size = state.household.size;
  const head = `<div class="top"><div><h1>Plan</h1><p class="sub">Week of ${esc(shortDate(ws))}${ws === weekStart() ? ' (this week)' : ''}</p></div>
    <div class="rowf"><button class="icon-btn" data-act="plan-week" data-d="-7" aria-label="Previous week">‹</button><button class="icon-btn" data-act="plan-week" data-d="7" aria-label="Next week">›</button></div></div>`;
  const pool = planPool().length;
  if (!entries.length) {
    return `${head}<div class="card empty"><div class="big">🗓️</div><h2>No meals planned yet</h2>
      ${pool ? `<p class="muted">Build a week of breakfast, lunch and dinner from your ${pool} ${pool === 1 ? 'recipe' : 'recipes'}, what your family likes and what is in your fridge.</p>
        <button class="btn dark block" data-act="plan-generate">Build my week</button>`
      : `<p class="muted">The plan is built from your own recipes. Add a few first, then come back and build your week.</p>
        <button class="btn dark block" data-act="recipe-new">＋ Add a recipe</button>`}</div>`;
  }
  return `${head}
    <div class="stack tight">
      <button class="btn dark block" data-act="plan-generate">Rebuild unlocked meals</button>
      <label class="check small"><input type="checkbox" data-change="plan-repeats" ${state.household.allowRepeats ? 'checked' : ''}> Allow the same dish more than once a week</label>
      ${pool < 21 ? `<p class="note">You have ${pool} ${pool === 1 ? 'recipe' : 'recipes'}. A week has 21 meals, so some dishes repeat or some slots stay empty until you add more.</p>` : ''}
      <p class="muted small">Lock 🔒 the meals you like, swap 🔁 any meal, or drag ⠿ a meal to another day. Calories are per person for planned meals, snacks not included. Your family's average target is about ${num(target)} a day.</p>
    </div>
    <div class="stack" style="margin-top:14px">${dates.map((d) => {
      const t = dayTotals(d);
      return `<section class="day ${d === today() ? 'today' : ''}">
        <div class="day-head"><h2>${esc(dayName(d))} <span class="muted" style="font-weight:600;font-size:1rem">${esc(shortDate(d))}</span></h2>
          <span class="small" style="text-align:right"><b>${num(t.kcal)} kcal</b> per person<br><span class="muted">${num(t.kcal * size)} for all ${size}</span></span></div>
        <div class="kbar" style="margin-bottom:8px"><i style="width:${Math.min(100, (t.kcal / target) * 100)}%"></i></div>
        ${SLOTS.map((s) => { const e = entryAt(d, s); return `<div class="slot" data-date="${d}" data-slot="${s}"><span class="slot-name">${cap(s)}</span>
          ${e ? mealHtml(e) : `<button class="addmeal" data-act="plan-swap" data-date="${d}" data-slot="${s}">＋ Add ${s}</button>`}</div>`; }).join('')}
      </section>`;
    }).join('')}</div>`;
}
registerView('plan', render);

on('plan-week', (el) => { ws = addDays(ws, Number(el.dataset.d)); redraw(); window.scrollTo(0, 0); });
on('plan-generate', () => { if (!planPool().length) { toast('Add a recipe in Meals first.'); return; } withUndo('Your week is planned. Locked meals were kept.', () => generateWeek(ws)); });
on('plan-repeats', (el) => { state.household.allowRepeats = el.checked; commit(); });
on('plan-lock', (el) => { const e = state.plan.find((x) => x.id === el.dataset.id); e.locked = !e.locked; commit(); toast(e.locked ? 'Locked. This meal stays when you rebuild.' : 'Unlocked'); });
on('plan-open', (el) => { const e = state.plan.find((x) => x.id === el.dataset.id); openRecipe(e.recipeId, { entryId: e.id }); });

on('plan-swap', (el) => {
  const { date, slot } = el.dataset, cur = entryAt(date, slot);
  const sheet = openSheet(() => {
    const alts = alternatives(date, slot).filter((a) => a.r.id !== cur?.recipeId);
    return `<h2>${cur ? 'Swap' : 'Add'} ${esc(slot)}</h2><p class="sub">${esc(dayName(date))}, ${esc(shortDate(date))}. Best matches for your fridge and tastes.</p>
      <div class="stack tight" style="margin-top:12px">${alts.map(({ r, s }) => recipeCard(r, s, 'plan-pick')).join('') || '<p class="muted">No other recipes fit this meal. Search for more below.</p>'}
        <button class="btn block" data-act="plan-search">Search all recipes</button>
        ${cur ? '<button class="btn danger block" data-act="plan-remove">Remove this meal</button>' : ''}</div>`;
  }, { full: true });
  sheet.ctx = { date, slot, cur };
});
on('plan-pick', (el) => {
  const sh = sheetOf(el), { date, slot } = sh.ctx, r = getRecipe(el.dataset.id);
  sh.close();
  withUndo(`${r.name} is now ${dayName(date)} ${slot}`, () => setEntry(date, slot, r));
});
on('plan-search', (el) => { const sh = sheetOf(el); ui.pickFor = { date: sh.ctx.date, slot: sh.ctx.slot }; sh.close(); go('meals'); });
on('plan-remove', (el) => { const sh = sheetOf(el), id = sh.ctx.cur.id; sh.close(); withUndo('Meal removed', () => removeEntry(id)); });

// ---------------- Drag and drop (pointer events, works with touch and mouse) ----------------
let drag = null;
document.addEventListener('pointerdown', (e) => {
  const h = e.target.closest?.('[data-drag]');
  if (!h) return;
  e.preventDefault();
  const meal = h.closest('.meal'), rect = meal.getBoundingClientRect();
  const ghost = meal.cloneNode(true);
  ghost.classList.add('drag-ghost');
  Object.assign(ghost.style, { width: rect.width + 'px', left: rect.left + 'px', top: rect.top + 'px' });
  document.body.appendChild(ghost);
  meal.classList.add('dragging');
  drag = { id: h.dataset.drag, ghost, meal, dx: e.clientX - rect.left, dy: e.clientY - rect.top, over: null, y: e.clientY };
  try { h.setPointerCapture(e.pointerId); } catch { /* fine */ }
  const scroll = () => { // scroll the page when the finger is near the top or bottom edge
    if (!drag) return;
    if (drag.y < 110) window.scrollBy(0, -14); else if (drag.y > window.innerHeight - 170) window.scrollBy(0, 14);
    requestAnimationFrame(scroll);
  };
  requestAnimationFrame(scroll);
});
document.addEventListener('pointermove', (e) => {
  if (!drag) return;
  drag.y = e.clientY;
  drag.ghost.style.left = e.clientX - drag.dx + 'px';
  drag.ghost.style.top = e.clientY - drag.dy + 'px';
  const over = document.elementFromPoint(e.clientX, e.clientY)?.closest('.slot') || null;
  if (over !== drag.over) { drag.over?.classList.remove('over'); drag.over = over; over?.classList.add('over'); }
});
const endDrag = (e) => {
  if (!drag) return;
  const d = drag;
  drag = null;
  d.ghost.remove(); d.meal.classList.remove('dragging'); d.over?.classList.remove('over');
  if (e.type === 'pointerup' && d.over && moveEntry(d.id, d.over.dataset.date, d.over.dataset.slot)) { commit(); toast('Meal moved'); }
};
document.addEventListener('pointerup', endDrag);
document.addEventListener('pointercancel', endDrag);
