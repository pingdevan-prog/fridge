// Cooking mode: pick servings, scaled ingredients, big step-by-step text with timers,
// screen stays on, and "Done cooking" updates the fridge and the food log.
import { state, deductFromItem, addToFridge, addDays, today, uid } from '../store.js';
import { scaleAmount, fmtAmount, convert, UNITS } from '../lib/units.js';
import { fridgeStatus } from '../lib/match.js';
import { recipeNutrition } from '../lib/nutrition.js';
import { keepRecipe, rateRecipe } from '../lib/recipes.js';
import { $, esc, on, openSheet, sheetOf, toast, withUndo, fields, options } from './dom.js';

let c = null;      // the current cooking session
let wake = null;   // screen wake lock
let tick = null;   // timer interval

async function keepAwake() { try { if (navigator.wakeLock && c) wake = await navigator.wakeLock.request('screen'); } catch { /* not allowed right now */ } }
document.addEventListener('visibilitychange', () => { if (c && document.visibilityState === 'visible') keepAwake(); });

function rescale() {
  const k = c.servings / (c.r.servings || 1);
  c.ings = c.r.ingredients.map((ing) => { const sc = scaleAmount(ing.qty, ing.unit, k, ing.foodKey); return { ...ing, qty: sc.qty, unit: sc.unit, note: sc.note }; });
}

export function startCooking(recipe, { servings, entryId } = {}) {
  c = { r: recipe, servings: servings || recipe.servings, entryId, phase: 'prep', step: 0, ings: [], timers: [] };
  rescale(); draw(); keepAwake();
  if (!tick) tick = setInterval(updateTimers, 1000);
}
function stop() {
  c = null;
  $('#overlay').innerHTML = '';
  wake?.release?.().catch(() => {}); wake = null;
  clearInterval(tick); tick = null;
}

const badge = (st) => (st.free ? '' : st.status === 'have' ? '<span class="badge green">Have it</span>' : st.status === 'some' ? '<span class="badge">Not enough</span>' : '<span class="badge red">Need it</span>');
const ingRows = () => c.ings.map((i, idx) => `<div class="ing"><button class="amt link" style="text-align:left" data-act="cook-amt" data-i="${idx}">${esc(fmtAmount(i.qty, i.unit) || 'some')}</button>
  <span class="grow">${esc(i.name)}${i.note ? ` <span class="muted small">(${esc(i.note)})</span>` : ''}</span>${badge(fridgeStatus(i, state.fridge))}</div>`).join('');

/** Durations mentioned in a step, e.g. "simmer for 10 minutes" -> 600 seconds. */
function durations(text) {
  const out = [];
  for (const m of text.matchAll(/(\d+)(?:\s*(?:-|to)\s*\d+)?\s*(seconds?|secs?|minutes?|mins?|hours?|hrs?)\b/gi)) {
    const n = Number(m[1]), u = m[2][0].toLowerCase();
    const secs = u === 's' ? n : u === 'h' ? n * 3600 : n * 60;
    if (secs >= 20 && !out.some((d) => d.secs === secs)) out.push({ secs, label: u === 's' ? `${n} sec` : u === 'h' ? `${n} hr` : `${n} min` });
  }
  return out;
}
const clock = (s) => `${Math.floor(s / 60)}:${String(Math.max(0, s % 60)).padStart(2, '0')}`;
const timersHtml = () => c.timers.map((t) => {
  const left = Math.ceil((t.end - Date.now()) / 1000);
  return `<button class="timer ${left <= 0 ? 'done' : ''}" data-act="cook-timer-x" data-id="${t.id}" aria-label="Timer, tap to remove">⏱ ${left <= 0 ? 'Time is up! Tap to clear' : clock(left) + ' · ' + esc(t.label)}</button>`;
}).join('');

function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.35, 0.7].forEach((at) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = 880; o.connect(g); g.connect(ctx.destination); g.gain.value = 0.25; o.start(ctx.currentTime + at); o.stop(ctx.currentTime + at + 0.22); });
  } catch { /* no sound available */ }
  navigator.vibrate?.([300, 150, 300]);
}
function updateTimers() {
  if (!c) return;
  for (const t of c.timers) if (!t.rang && t.end <= Date.now()) { t.rang = true; beep(); }
  const el = $('#cook-timers');
  if (el) el.innerHTML = timersHtml();
}

function draw() {
  const o = $('#overlay');
  if (c.phase === 'prep') {
    o.innerHTML = `<div class="cook">
      <div class="rowf"><button class="icon-btn" data-act="cook-exit" aria-label="Close cooking mode">✕</button><div class="grow"><p class="muted small">Getting ready</p><h2>${esc(c.r.name)}</h2></div></div>
      <div class="card rowf"><div class="grow"><h3>How many servings?</h3><p class="muted small">The recipe makes ${c.r.servings}. Every amount adjusts.</p></div>
        <div class="stepper"><button data-act="cook-serv" data-d="-1" aria-label="Fewer servings">−</button><b>${c.servings}</b><button data-act="cook-serv" data-d="1" aria-label="More servings">＋</button></div></div>
      <div class="card"><h3>Ingredients for ${c.servings}</h3><p class="muted small">Tap an amount to change it, for example if you use less oil.</p><div style="margin-top:6px">${ingRows()}</div></div>
      <p class="muted small center">${'wakeLock' in navigator ? 'Your screen stays on while you cook.' : 'Tip: this browser cannot keep the screen on, so set Auto-Lock to Never while you cook.'}</p>
      <div class="cook-bar"><button class="btn" data-act="cook-begin">Start cooking</button></div></div>`;
    return;
  }
  const n = c.r.steps.length, text = c.r.steps[c.step] || '', last = c.step >= n - 1;
  o.innerHTML = `<div class="cook">
    <div class="rowf"><button class="icon-btn" data-act="cook-exit" aria-label="Close cooking mode">✕</button>
      <div class="grow"><p class="muted small">${esc(c.r.name)}</p><h3>Step ${c.step + 1} of ${n}</h3></div>
      <button class="btn sm" data-act="cook-ings">Ingredients</button></div>
    <div class="dots">${c.r.steps.map((_, i) => `<i class="${i <= c.step ? 'on' : ''}"></i>`).join('')}</div>
    <div class="rowf wrap" id="cook-timers">${timersHtml()}</div>
    <p class="step-text">${esc(text)}</p>
    <div class="rowf wrap">${durations(text).map((d) => `<button class="btn sm ghost" style="box-shadow:inset 0 0 0 2px var(--butter);color:var(--butter)" data-act="cook-timer" data-secs="${d.secs}" data-label="${d.label}">⏱ Start ${d.label} timer</button>`).join('')}</div>
    <div class="cook-bar"><button class="btn ghost" data-act="cook-prev" ${c.step === 0 ? 'disabled' : ''}>Back</button>
      ${last ? '<button class="btn" data-act="cook-done">Done cooking</button>' : '<button class="btn" data-act="cook-next">Next step</button>'}</div></div>`;
  $('#overlay').scrollTop = 0;
}

on('cook-exit', () => { stop(); toast('Cooking closed. Nothing was changed.'); });
on('cook-serv', (el) => { c.servings = Math.max(1, Math.min(24, c.servings + Number(el.dataset.d))); rescale(); draw(); });
on('cook-begin', () => { c.phase = 'steps'; c.step = 0; draw(); keepAwake(); });
on('cook-next', () => { c.step++; draw(); });
on('cook-prev', () => { if (c.step > 0) { c.step--; draw(); } });
on('cook-timer', (el) => { c.timers.push({ id: uid(), end: Date.now() + Number(el.dataset.secs) * 1000, label: el.dataset.label }); updateTimers(); });
on('cook-timer-x', (el) => { c.timers = c.timers.filter((t) => t.id !== el.dataset.id); updateTimers(); });
on('cook-ings', () => openSheet(() => `<h2>Ingredients for ${c.servings}</h2><p class="sub">Tap an amount to change what you actually used.</p><div style="margin-top:8px">${ingRows()}</div>`));
on('cook-amt', (el) => {
  const i = Number(el.dataset.i), ing = c.ings[i], parent = sheetOf(el);
  const sheet = openSheet(() => `<h2>${esc(ing.name)}</h2><p class="sub">How much are you really using?</p>
    <div class="grid2" style="margin-top:12px"><label class="field"><span>Amount</span><input class="input" name="qty" type="number" inputmode="decimal" min="0" step="any" value="${ing.qty}"></label>
      <label class="field"><span>Unit</span><select class="input" name="unit">${options(UNITS, ing.unit || 'each')}</select></label></div>
    <button class="btn dark block" style="margin-top:12px" data-act="cook-amt-save">Save</button>`);
  sheet.ctx = { ing, parent };
});
on('cook-amt-save', (el) => {
  const sh = sheetOf(el), f = fields(sh.body);
  Object.assign(sh.ctx.ing, { qty: f.qty || 0, unit: f.unit, note: 'changed by you' });
  sh.close(); sh.ctx.parent?.refresh();
  if (c.phase === 'prep') draw();
});

// ---------------- Done cooking ----------------
/** What we plan to take out of the fridge: one row per (ingredient, fridge item). */
function plannedDeductions() {
  const rows = [];
  for (const ing of c.ings) {
    const st = fridgeStatus(ing, state.fridge);
    if (st.free || !ing.qty) continue;
    if (!st.items.length) { rows.push({ ing, item: null }); continue; }
    let left = ing.qty;
    for (const item of [...st.items].sort((a, b) => (a.expiresAt || '').localeCompare(b.expiresAt || ''))) {
      const want = convert(left, ing.unit || 'each', item.unit, st.food);
      if (want == null) { rows.push({ ing, item, qty: 0, unknown: true }); break; }
      const take = Math.min(item.qty, want);
      rows.push({ ing, item, qty: take < 0.1 ? Math.round(take * 1000) / 1000 : Math.round(take * 100) / 100 });
      left *= want > 0 ? 1 - take / want : 0;
      if (left <= 1e-6) break;
    }
  }
  return rows;
}

on('cook-done', () => {
  const rows = plannedDeductions();
  const hour = new Date().getHours();
  const entry = c.entryId ? state.plan.find((e) => e.id === c.entryId) : null;
  const slot = entry?.slot || (hour < 11 ? 'breakfast' : hour < 16 ? 'lunch' : 'dinner');
  const eaters = Object.fromEntries(state.members.map((m) => [m.id, 1]));
  let curSlot = slot;
  const sheet = openSheet(() => {
    const eaten = Object.values(eaters).reduce((a, b) => a + b, 0), left = Math.max(0, Math.round((c.servings - eaten) * 4) / 4);
    return `<h2>Done cooking!</h2><p class="sub">${esc(c.r.name)}, ${c.servings} servings</p>
    <div class="sec"><h3>Coming out of your fridge</h3><p class="muted small">Change any amount that is not right.</p>
      <div style="margin-top:6px">${rows.map((r, i) => (r.item
        ? `<div class="ing"><span class="grow">${esc(r.item.name)}<br><span class="muted small">${r.unknown ? 'Could not convert the units, so enter it by hand' : `you have ${esc(fmtAmount(r.item.qty, r.item.unit))}`}</span></span>
            <input class="input" style="width:86px" type="number" inputmode="decimal" min="0" step="any" value="${r.qty}" data-change="done-qty" data-i="${i}" aria-label="Amount of ${esc(r.item.name)} used"><span style="width:64px" class="small">${esc(r.item.unit)}</span></div>`
        : `<div class="ing"><span class="grow">${esc(r.ing.name)}</span><span class="badge plain">not in your fridge</span></div>`)).join('') || '<p class="muted">Nothing to take out.</p>'}</div></div>
    <div class="sec"><h3>Who is eating?</h3><p class="muted small">Pick how many servings each person has.</p>
      <div class="stack tight" style="margin-top:6px">${state.members.map((m) => `<div class="rowf"><span class="grow nm">${m.emoji} ${esc(m.name)}</span>
        <select class="input" style="width:150px" data-change="done-eat" data-id="${m.id}" aria-label="Servings for ${esc(m.name)}">${options([['0', 'Not eating'], ['0.5', 'Half serving'], ['0.75', '3/4 serving'], ['1', '1 serving'], ['1.5', '1 1/2 servings'], ['2', '2 servings']], String(eaters[m.id]))}</select></div>`).join('')}</div></div>
    <div class="sec stack tight" data-form="done"><label class="field"><span>Which meal is this?</span><select class="input" name="slot" data-change="done-slot">${options(['breakfast', 'lunch', 'dinner', 'snack'], curSlot)}</select></label>
      <label class="field"><span>Leftover servings to save in the fridge</span><input class="input" name="leftovers" type="number" inputmode="decimal" min="0" step="any" value="${left}"></label>
      <p class="muted small">Leftovers go in the fridge as their own item with a use-by date about 4 days out.</p></div>
    <div class="sticky-bar"><button class="btn dark grow" data-act="done-save">Save meal</button></div>`;
  }, { full: true });
  sheet.ctx = { rows, eaters, setSlot(v) { curSlot = v; } };
});
on('done-slot', (el) => sheetOf(el).ctx.setSlot(el.value));
on('done-qty', (el) => { sheetOf(el).ctx.rows[Number(el.dataset.i)].qty = Number(el.value) || 0; });
on('done-eat', (el) => { const sh = sheetOf(el); sh.ctx.eaters[el.dataset.id] = Number(el.value); sh.refresh(); });
on('done-save', (el) => {
  const sh = sheetOf(el), { rows, eaters } = sh.ctx, f = fields($('[data-form="done"]', sh.body));
  const r = c.r, servings = c.servings, entryId = c.entryId;
  // Calories come from the amounts actually cooked, divided by the servings made.
  const info = recipeNutrition(r, c.ings, servings), per = info.per;
  sh.close(); stop();
  withUndo('Meal saved. Fridge and food log updated.', () => {
    keepRecipe(r);
    for (const row of rows) {
      const item = row.item && state.fridge.find((i) => i.id === row.item.id);
      if (item && row.qty > 0) deductFromItem(item, row.qty);
    }
    for (const m of state.members) {
      const s = eaters[m.id];
      if (!s) continue;
      state.logs.push({ id: uid(), date: today(), slot: f.slot, name: r.name, recipeId: r.id, memberId: m.id, servings: s, home: true, veg: info.vegCount > 0,
        kcal: Math.round(per.kcal * s), protein: Math.round(per.protein * s), carbs: Math.round(per.carbs * s), fat: Math.round(per.fat * s), fiber: Math.round(per.fiber * s) });
    }
    if (f.leftovers > 0) addToFridge({ name: `Leftover ${r.name}`, qty: f.leftovers, unit: 'serving', category: 'leftovers', location: 'fridge', leftover: true,
      expiresAt: addDays(today(), 4), nutrition: { per: 'serving', ...per, source: 'From the recipe as cooked' }, recipeId: r.id });
    const entry = entryId && state.plan.find((e) => e.id === entryId);
    if (entry) entry.cooked = true;
  });
  askRating(r);
});

/** After a meal, ask each family member what they thought. */
function askRating(r) {
  const sheet = openSheet(() => `<h2>How was it?</h2><p class="sub">${esc(r.name)}. Ratings shape future suggestions.</p>
    <div class="stack" style="margin-top:12px">${state.members.map((m) => {
      const mine = state.ratings.find((x) => x.recipeId === r.id && x.memberId === m.id)?.stars || 0;
      return `<div><div class="nm">${m.emoji} ${esc(m.name)}</div><div class="rowf">
        <button class="icon-btn" data-act="ask-rate" data-id="${m.id}" data-n="1" aria-label="Thumbs down">👎</button>
        <span class="stars">${[1, 2, 3, 4, 5].map((n) => `<button class="${n <= mine ? 'on' : ''}" data-act="ask-rate" data-id="${m.id}" data-n="${n}" aria-label="${n} stars">⭐</button>`).join('')}</span>
        <button class="icon-btn" data-act="ask-rate" data-id="${m.id}" data-n="5" aria-label="Thumbs up">👍</button></div></div>`;
    }).join('')}
    <button class="btn dark block" data-act="sheet-close">Done</button></div>`);
  sheet.ctx = { r };
}
on('ask-rate', (el) => { const sh = sheetOf(el); rateRecipe(sh.ctx.r, el.dataset.id, Number(el.dataset.n)); sh.refresh(); });
