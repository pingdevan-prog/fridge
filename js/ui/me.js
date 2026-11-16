// Me tab: calorie and nutrition dashboard per family member, family preferences, settings, data.
import { state, commit, save, today, addDays, uid, resetAll, replaceAll, parseYmd } from '../store.js';
import { AGE_GROUPS, GOAL_MIN, GOAL_MAX, GUIDELINE_SOURCE, SOURCE, zero, addInto } from '../lib/nutrition.js';
import { CUISINES } from '../lib/recipes.js';
import { getKey, setKey, hasAI, MODELS } from '../lib/ai.js';
import { syncStatus, joinFamily, leaveFamily, syncNow, resetShadow } from '../lib/sync.js';
import { ic, avatar } from './icons.js';
import { $, esc, on, render as redraw, registerView, openSheet, sheetOf, toast, withUndo, fields, options, num, cap } from './dom.js';

let who = null; // selected family member id
const DAY = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const totalsFor = (memberId, date) => state.logs.filter((l) => l.memberId === memberId && l.date === date).reduce((s, l) => addInto(s, l), zero());
const list = (a) => a.join(', ');
const parseList = (s) => String(s || '').split(',').map((x) => x.trim()).filter(Boolean);

function rangeBar(kcal, [lo, hi], goal) {
  const max = hi * 1.15;
  return `<div class="kbar range"><em style="left:${(lo / max) * 100}%;width:${((hi - lo) / max) * 100}%"></em><i style="width:${Math.min(100, (kcal / max) * 100)}%"></i></div>
    <div class="rowf small muted" style="margin-top:4px"><span>0</span><span class="right">${goal ? `goal ${num(goal)}` : `healthy range ${num(lo)} to ${num(hi)}`}</span></div>`;
}

function dashboard(m) {
  const g = AGE_GROUPS[m.ageGroup], t = today(), tot = totalsFor(m.id, t);
  const days = Array.from({ length: 7 }, (_, i) => addDays(t, i - 6));
  const week = days.map((d) => totalsFor(m.id, d));
  const logged = week.filter((w) => w.kcal > 0), avg = logged.length ? logged.reduce((s, w) => s + w.kcal, 0) / logged.length : 0;
  const peak = Math.max(g.range[1], ...week.map((w) => w.kcal));
  const meals = state.logs.filter((l) => l.memberId === m.id && l.date === t);
  const kid = !g.canSetGoal;
  // Macro targets: protein and fiber are simple reference amounts, shown as guidance only.
  const macros = [['Protein', tot.protein, kid ? 50 : 60], ['Carbs', tot.carbs, 275], ['Fat', tot.fat, 78], ['Fiber', tot.fiber, 28]];
  return `<div class="card">
      <div class="rowf"><div class="grow"><p class="muted small">Today</p><div class="bigno">${num(tot.kcal)}</div><p class="small">calories eaten${m.calorieGoal && !kid ? ` of ${num(m.calorieGoal)}` : ''}</p></div>
        <button class="btn sm" data-act="log-new">${ic('plus')}Log food</button></div>
      <div style="margin-top:12px">${rangeBar(tot.kcal, m.calorieGoal && !kid ? [m.calorieGoal * 0.9, m.calorieGoal * 1.1] : g.range, !kid && m.calorieGoal)}</div>
      ${kid ? `<p class="note" style="margin-top:10px">Growing bodies need plenty of fuel, so there is no calorie limit here. Aim for variety instead: vegetables or fruit, protein and whole grains at most meals.</p>` : ''}
      <div class="stack tight" style="margin-top:14px">${macros.map(([l, v, ref]) => `<div class="macro"><span>${l}</span><div class="kbar"><i style="width:${Math.min(100, (v / ref) * 100)}%"></i></div><b>${Math.round(v)} g</b></div>`).join('')}</div>
      ${meals.length ? `<hr><div class="stack tight">${meals.map((l) => `<div class="rowf small"><span class="grow"><b>${esc(l.name)}</b><br><span class="muted">${cap(l.slot)} · ${l.servings} ${l.servings === 1 ? 'serving' : 'servings'}</span></span><b>${l.kcal} kcal</b>
        <button class="icon-btn clear" data-act="log-del" data-id="${l.id}" aria-label="Delete ${esc(l.name)}">${ic('trash')}</button></div>`).join('')}</div>` : '<p class="muted small" style="margin-top:12px">Nothing logged today. Meals you cook are logged automatically when you tap Done cooking.</p>'}
    </div>
    <div class="card sec"><div class="rowf"><h2 class="grow">Last 7 days</h2><span class="small muted">${avg ? `average ${num(avg)} a day` : 'no meals logged'}</span></div>
      <div class="week" style="margin-top:12px">${week.map((w, i) => `<div class="${i === 6 ? 'now' : ''}"><span>${w.kcal ? num(w.kcal) : ''}</span><i style="height:${Math.max(2, (w.kcal / peak) * 78)}px"></i><span>${DAY[parseYmd(days[i]).getDay()]}</span></div>`).join('')}</div>
      <p class="muted small" style="margin-top:8px">${esc(g.label)}: about ${num(g.range[0])} to ${num(g.range[1])} calories a day depending on size and activity (${esc(GUIDELINE_SOURCE)}).</p></div>`;
}

function healthSummary() {
  const from = addDays(today(), -6);
  const meals = new Map();
  for (const l of state.logs) if (l.date >= from && l.slot !== 'snack') { const k = l.date + l.slot; const m = meals.get(k) || { veg: false, home: false }; m.veg ||= !!l.veg; m.home ||= !!l.home; meals.set(k, m); }
  const all = [...meals.values()], veg = all.filter((m) => m.veg).length, home = all.filter((m) => m.home).length;
  if (!all.length) return '<p class="muted">Cook or log a few meals and a weekly summary appears here.</p>';
  const tip = veg / all.length >= 0.6 ? 'Nice work. Keep the vegetables coming.' : 'Try adding a vegetable or fruit to one more meal each day.';
  return `<div class="stack tight"><p>You had vegetables or fruit at <b>${veg} of ${all.length}</b> meals this week.</p>
    <p><b>${home} of ${all.length}</b> meals were cooked at home.</p><p class="muted small">${tip}</p></div>`;
}

function render() {
  if (!state.members.find((m) => m.id === who)) who = state.members[0]?.id || null;
  const m = state.members.find((x) => x.id === who), h = state.household;
  return `<div class="top"><div><h1>Me</h1><p class="sub">Calories, family and settings</p></div></div>
    <div class="chips">${state.members.map((x) => `<button class="chip ${x.id === who ? 'on' : ''}" data-act="me-who" data-id="${x.id}">${avatar(x)}${esc(x.name)}</button>`).join('')}
      <button class="chip" data-act="member-new">${ic('plus')}Add person</button></div>
    <div style="margin-top:10px">${m ? dashboard(m) : `<div class="card empty"><div class="big">${ic('users')}</div><h2>Add your family</h2><p class="muted">Add each person to track meals and calories.</p><button class="btn" data-act="member-new">Add a person</button></div>`}</div>
    <div class="card sec"><h2>Healthy eating this week</h2><div style="margin-top:8px">${healthSummary()}</div></div>
    <div class="sec"><h2>Family</h2><div class="list">
      ${state.members.map((x) => `<button class="li" data-act="member-edit" data-id="${x.id}">${avatar(x, 'lg')}<span class="grow"><span class="nm">${esc(x.name)}</span><br><span class="muted small">${esc(AGE_GROUPS[x.ageGroup].label)}${x.calorieGoal && AGE_GROUPS[x.ageGroup].canSetGoal ? ` · goal ${num(x.calorieGoal)} kcal` : ''}</span></span><span class="muted">Edit</span></button>`).join('')}
      <button class="li" data-act="prefs-edit"><span class="cat t-o">${ic('utensils')}</span><span class="grow"><span class="nm">Food preferences</span><br><span class="muted small">${h.size} people · ${esc(list(h.cuisines)) || 'any cuisine'} · weeknights ${h.weeknightMinutes} min${h.allergies.length ? ' · allergies: ' + esc(list(h.allergies)) : ''}</span></span><span class="muted">Edit</span></button>
    </div></div>
    <div class="sec"><h2>Settings</h2><div class="list">
      <button class="li" data-act="sync-open"><span class="cat t-g">${ic('users')}</span><span class="grow"><span class="nm">Family sync</span><br><span class="muted small">${esc(syncLine())}</span></span><span class="muted">${syncStatus.on ? 'Open' : 'Set up'}</span></button>
      <button class="li" data-act="ai-edit"><span class="cat t-p">${ic('sparkle')}</span><span class="grow"><span class="nm">Claude photo and receipt reading</span><br><span class="muted small">${hasAI() ? 'On. Photos and receipts are read by Claude.' : 'Off. Add an API key for the most accurate scans.'}</span></span><span class="muted">${hasAI() ? 'Change' : 'Set up'}</span></button>
      <button class="li" data-act="data-open"><span class="cat t-b">${ic('download')}</span><span class="grow"><span class="nm">Backup and data</span><br><span class="muted small">Save a backup file or start over</span></span><span class="muted">Open</span></button>
      <button class="li" data-act="about-open"><span class="cat t-n">${ic('info')}</span><span class="grow"><span class="nm">About the numbers</span><br><span class="muted small">Where nutrition, recipes, prices and brands come from</span></span><span class="muted">Read</span></button>
    </div></div>`;
}
registerView('me', render);
on('me-who', (el) => { who = el.dataset.id; redraw(); });
on('log-del', (el) => withUndo('Removed from the food log', () => { state.logs = state.logs.filter((l) => l.id !== el.dataset.id); }));

// ---------------- Log food by hand ----------------
on('log-new', () => {
  const picked = new Set([who]);
  const sheet = openSheet(() => `<h2>Log food</h2><p class="sub">For snacks, school lunch, eating out, anything not cooked in the app.</p>
    <div class="stack" style="margin-top:12px" data-form="log">
      <label class="field"><span>What was it?</span><input class="input" name="name" placeholder="Apple with peanut butter"></label>
      <div class="grid2"><label class="field"><span>Calories (from the label or menu)</span><input class="input" name="kcal" type="number" inputmode="numeric" min="0"></label>
        <label class="field"><span>Meal</span><select class="input" name="slot">${options(['breakfast', 'lunch', 'dinner', 'snack'], 'snack')}</select></label></div>
      <div class="grid2">${[['protein', 'Protein g'], ['carbs', 'Carbs g'], ['fat', 'Fat g'], ['fiber', 'Fiber g']].map(([k, l]) => `<label class="field"><span>${l} (optional)</span><input class="input" name="${k}" type="number" inputmode="decimal" min="0" step="any"></label>`).join('')}</div>
      <label class="check"><input type="checkbox" name="veg"> It included vegetables or fruit</label>
      <div><p class="field" style="margin-bottom:6px">Who ate it?</p><div class="chips wrap">${state.members.map((m) => `<button class="chip ${picked.has(m.id) ? 'on' : ''}" data-act="log-who" data-id="${m.id}">${avatar(m)}${esc(m.name)}</button>`).join('')}</div></div>
      <button class="btn block" data-act="log-save">Save to food log</button></div>`);
  sheet.ctx = { picked };
});
on('log-who', (el) => { const p = sheetOf(el).ctx.picked, id = el.dataset.id; p.has(id) ? p.delete(id) : p.add(id); el.classList.toggle('on'); });
on('log-save', (el) => {
  const sh = sheetOf(el), f = fields(sh.body);
  if (!f.name || f.kcal == null) { toast('Add a name and the calories.'); return; }
  if (!sh.ctx.picked.size) { toast('Pick who ate it.'); return; }
  for (const id of sh.ctx.picked) state.logs.push({ id: uid(), date: today(), slot: f.slot, name: f.name, memberId: id, servings: 1, home: false, veg: f.veg,
    kcal: Math.round(f.kcal), protein: f.protein || 0, carbs: f.carbs || 0, fat: f.fat || 0, fiber: f.fiber || 0 });
  commit(); sh.close(); toast('Logged');
});

// ---------------- Family members ----------------
function memberSheet(m) {
  const d = m ? { ...m } : { name: '', ageGroup: 'adult', calorieGoal: null };
  const sheet = openSheet(() => {
    const g = AGE_GROUPS[d.ageGroup];
    return `<h2>${m ? 'Edit ' + esc(m.name) : 'Add a person'}</h2>
    <div class="stack" style="margin-top:12px" data-form="member">
      <label class="field"><span>Name</span><input class="input" name="name" value="${esc(d.name)}" placeholder="Mom, Dad, a first name"></label>
      <label class="field"><span>Age group</span><select class="input" name="ageGroup" data-change="member-age">${options(Object.entries(AGE_GROUPS).map(([k, v]) => [k, v.label]), d.ageGroup)}</select></label>
      ${g.canSetGoal ? `<label class="field"><span>Daily calorie goal (optional)</span><input class="input" name="calorieGoal" type="number" inputmode="numeric" min="${GOAL_MIN}" max="${GOAL_MAX}" step="50" value="${d.calorieGoal || ''}" placeholder="Leave empty to use the healthy range"></label>
        <p class="muted small">Most adults need about ${num(g.range[0])} to ${num(g.range[1])} calories a day (${esc(GUIDELINE_SOURCE)}). Goals below ${num(GOAL_MIN)} are not supported here. For weight loss or medical needs, talk to a doctor or dietitian.</p>`
        : `<p class="note">Kids and teens do not get a calorie target. The app shows balanced-eating guidance and a healthy range of about ${num(g.range[0])} to ${num(g.range[1])} calories a day instead.</p>`}
      <button class="btn block" data-act="member-save">${m ? 'Save changes' : 'Add person'}</button>
      ${m ? '<button class="btn danger block" data-act="member-del">Remove this person</button>' : ''}</div>`;
  });
  sheet.ctx = { m, d, read() { Object.assign(d, fields(sheet.body)); } };
}
on('member-new', () => memberSheet(null));
on('member-edit', (el) => memberSheet(state.members.find((m) => m.id === el.dataset.id)));
on('member-age', (el) => { const sh = sheetOf(el); sh.ctx.read(); sh.refresh(); });
on('member-save', (el) => {
  const sh = sheetOf(el), { m, d } = sh.ctx;
  sh.ctx.read();
  if (!d.name) { toast('Add a name.'); return; }
  let goal = AGE_GROUPS[d.ageGroup].canSetGoal && d.calorieGoal ? Number(d.calorieGoal) : null;
  if (goal != null && goal < GOAL_MIN) { goal = GOAL_MIN; toast(`Goal set to ${num(GOAL_MIN)}, the lowest this app supports.`); }
  if (goal != null && goal > GOAL_MAX) goal = GOAL_MAX;
  const data = { name: d.name, ageGroup: d.ageGroup, calorieGoal: goal };
  if (m) Object.assign(m, data); else { const id = uid(); state.members.push({ id, ...data }); who = id; }
  commit(); sh.close();
});
on('member-del', (el) => {
  const sh = sheetOf(el), id = sh.ctx.m.id;
  sh.close();
  withUndo(`${sh.ctx.m.name} removed`, () => { state.members = state.members.filter((m) => m.id !== id); state.logs = state.logs.filter((l) => l.memberId !== id); state.ratings = state.ratings.filter((r) => r.memberId !== id); });
});

// ---------------- Food preferences ----------------
on('prefs-edit', () => {
  const h = state.household, cuisines = new Set(h.cuisines);
  const sheet = openSheet(() => `<h2>Food preferences</h2><p class="sub">These shape recipe suggestions and the weekly plan.</p>
    <div class="stack" style="margin-top:12px" data-form="prefs">
      <div class="grid2"><label class="field"><span>People in the household</span><input class="input" name="size" type="number" inputmode="numeric" min="1" max="12" value="${h.size}"></label>
        <label class="field"><span>Weeknight cooking limit</span><select class="input" name="weeknightMinutes">${options([20, 30, 45, 60, 90].map((n) => [String(n), `${n} minutes`]), String(h.weeknightMinutes))}</select></label></div>
      <div><p class="field" style="margin-bottom:6px">Favorite cuisines</p><div class="chips wrap">${CUISINES.map((c) => `<button class="chip ${cuisines.has(c) ? 'on' : ''}" data-act="prefs-cuisine" data-c="${c}">${c}</button>`).join('')}</div></div>
      <label class="field"><span>Foods we like (separate with commas)</span><input class="input" name="likes" value="${esc(list(h.likes))}" placeholder="paneer, tacos, salmon, pasta"></label>
      <label class="field"><span>Foods we dislike (shown less often)</span><input class="input" name="dislikes" value="${esc(list(h.dislikes))}" placeholder="mushrooms, olives"></label>
      <label class="field"><span>Allergies (recipes with these are never shown)</span><input class="input" name="allergies" value="${esc(list(h.allergies))}" placeholder="peanuts, shellfish, dairy, gluten, eggs"></label>
      <label class="field"><span>Foods we never eat</span><input class="input" name="neverEat" value="${esc(list(h.neverEat))}" placeholder="beef, pork, meat"></label>
      <button class="btn block" data-act="prefs-save">Save preferences</button></div>`);
  sheet.ctx = { cuisines };
});
on('prefs-cuisine', (el) => { const c = sheetOf(el).ctx.cuisines, v = el.dataset.c; c.has(v) ? c.delete(v) : c.add(v); el.classList.toggle('on'); });
on('prefs-save', (el) => {
  const sh = sheetOf(el), f = fields(sh.body);
  Object.assign(state.household, { size: Math.max(1, Math.min(12, f.size || 4)), weeknightMinutes: Number(f.weeknightMinutes), cuisines: [...sh.ctx.cuisines],
    likes: parseList(f.likes), dislikes: parseList(f.dislikes), allergies: parseList(f.allergies), neverEat: parseList(f.neverEat) });
  commit(); sh.close(); toast('Preferences saved. Rebuild your plan to use them.');
});

// ---------------- Claude settings ----------------
on('ai-edit', () => openSheet(() => `<h2>Claude receipt reading</h2>
  <p class="sub">With a Claude API key, the app can read receipt photos very accurately, search more recipe sites, and check brands on heb.com. Without one, receipts are read on your phone, which is free but less accurate.</p>
  <div class="stack" style="margin-top:12px" data-form="ai">
    <label class="field"><span>Anthropic API key</span><input class="input" name="key" type="password" autocomplete="off" value="${esc(getKey())}" placeholder="sk-ant-..."></label>
    <label class="field"><span>Model</span><select class="input" name="model">${options(MODELS, state.settings.model)}</select></label>
    <p class="note">The key is stored only in this browser on this device. It is not included in backups. Each scan costs a few cents, billed by Anthropic to the key's owner. Get a key at <a class="link" href="https://console.anthropic.com/" target="_blank" rel="noopener">console.anthropic.com</a>.</p>
    <button class="btn block" data-act="ai-save">Save</button>
    ${hasAI() ? '<button class="btn danger block" data-act="ai-clear">Remove the key from this device</button>' : ''}</div>`));
on('ai-save', (el) => { const sh = sheetOf(el), f = fields(sh.body); setKey(f.key); state.settings.model = f.model; commit(); sh.close(); toast(f.key ? 'Claude is set up' : 'Saved'); });
on('ai-clear', (el) => { setKey(''); commit(); sheetOf(el).close(); toast('Key removed'); });

// ---------------- Family sync ----------------
const ago = (ms) => { const m = Math.round((Date.now() - ms) / 60000); return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} hr ago` : `${Math.round(m / 1440)} days ago`; };
function syncLine() {
  if (!syncStatus.on) return 'Off. Share one fridge, plan and list across the family\'s phones.';
  if (syncStatus.state === 'error') return `On as “${syncStatus.name}”. ${syncStatus.error}`;
  return `On as “${syncStatus.name}”. ${syncStatus.last ? 'Synced ' + ago(syncStatus.last) : 'Syncing…'}`;
}
let joining = false, joinError = '';
on('sync-open', () => openSheet(() => (syncStatus.on
  ? `<h2>Family sync</h2><p class="sub">This phone shares its fridge, recipes, plan, shopping list and food log with everyone signed in to “${esc(syncStatus.name)}”.</p>
    <div class="stack" style="margin-top:12px">
      <p class="note ${syncStatus.state === 'error' ? 'red' : ''}">${syncStatus.state === 'error' ? esc(syncStatus.error) : syncStatus.state === 'syncing' ? 'Syncing now…' : syncStatus.last ? `Last synced ${ago(syncStatus.last)}. Changes are sent within a few seconds and other phones pick them up within about 30 seconds.` : 'Waiting for the first sync.'}</p>
      <button class="btn block" data-act="sync-now">Sync now</button>
      <p class="muted small">To add a phone: open Fridge on it, go to Me, Family sync, and enter the same family name and password.</p>
      <button class="btn danger block" data-act="sync-leave">Stop syncing on this phone</button></div>`
  : `<h2>Family sync</h2><p class="sub">Pick a family name and a password. Enter the same two on every phone and they all share one fridge, recipes, meal plan, shopping list and food log.</p>
    <div class="stack" style="margin-top:12px" data-form="sync">
      <label class="field"><span>Family name</span><input class="input" name="name" autocomplete="off" autocapitalize="none" placeholder="for example: the-rajesh-kitchen"></label>
      <label class="field"><span>Family password (8 or more characters)</span><input class="input" name="password" type="text" autocomplete="off" autocapitalize="none" placeholder="something only your family knows"></label>
      ${joinError ? `<p class="note red">${esc(joinError)}</p>` : ''}
      <button class="btn block" data-act="sync-join" ${joining ? 'disabled' : ''}>${joining ? 'Connecting…' : 'Turn on family sync'}</button>
      <p class="note">Your data is locked with the password on this phone before it is sent, so the sync servers only ever hold scrambled text. Pick a password nobody could guess, because anyone with the name and password can see and change your family's data. What is already on this phone is combined with the family's data. Claude API keys stay on each phone.</p></div>`)));
on('sync-join', async (el) => {
  const sh = sheetOf(el), f = fields(sh.body);
  joining = true; joinError = ''; sh.refresh();
  try {
    const { found } = await joinFamily(f.name || '', f.password || '');
    joining = false; sh.close(); commit();
    toast(found ? 'Connected. Your family\'s data is now on this phone.' : 'Family sync is on. Enter the same name and password on the other phones.');
  } catch (e) { joining = false; joinError = e.message; sh.refresh(); }
});
on('sync-now', async (el) => { const sh = sheetOf(el); const p = syncNow(); sh.refresh(); await p; sh.refresh(); redraw(); });
on('sync-leave', (el) => { leaveFamily(); sheetOf(el).close(); redraw(); toast('Sync is off on this phone. Your data is still here.'); });
document.addEventListener('fridge-sync', () => { const row = document.querySelector('[data-act="sync-open"] .muted.small'); if (row) row.textContent = syncLine(); });

// ---------------- Data ----------------
on('data-open', () => openSheet(() => `<h2>Backup and data</h2>
  <p class="sub">Everything is saved on this phone. To share it with the family's other phones, use Family sync. A backup file is a spare copy you keep yourself.</p>
  <div class="stack" style="margin-top:12px">
    <button class="btn block" data-act="data-export">Save a backup file</button>
    <label class="btn block">Load a backup file<input type="file" accept="application/json,.json" hidden data-change="data-import"></label>
    <button class="btn danger block" data-act="data-reset">Erase everything on this phone</button></div>`));
on('data-export', () => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(state)], { type: 'application/json' }));
  a.download = `fridge-backup-${today()}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  toast('Backup saved to your downloads');
});
on('data-import', async (el) => {
  const file = el.files?.[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!data || !Array.isArray(data.fridge) || !Array.isArray(data.members)) throw new Error('bad');
    sheetOf(el)?.close();
    withUndo('Backup loaded', () => replaceAll(data));
  } catch { toast('That file is not a Fridge backup.'); }
});
on('data-reset', (el) => {
  sheetOf(el).close();
  // Erasing is for this phone only: leave family sync first so the rest of the family keeps their data.
  const wasSyncing = syncStatus.on;
  leaveFamily();
  withUndo(wasSyncing ? 'Everything erased on this phone. Family sync was turned off here.' : 'Everything erased', resetAll);
  resetShadow();
});

on('about-open', () => openSheet(() => `<h2>About the numbers</h2>
  <div class="stack" style="margin-top:12px">
    <p><b>Nutrition.</b> ${esc(SOURCE)} (per 100 g, mostly raw ingredients), built into the app. Recipe calories are added up from the actual ingredient amounts and divided by servings, so they are estimates. Items you edit can use a live USDA FoodData Central lookup.</p>
    <p><b>Calorie ranges.</b> ${esc(GUIDELINE_SOURCE)}. This app is not medical advice.</p>
    <p><b>Recipes.</b> Web results come from TheMealDB and link to the original source. Starter recipes were written for this app. Cooking times and serving counts for web recipes are estimates.</p>
    <p><b>Prices.</b> Shopping totals use what you paid on scanned receipts when available, otherwise rough typical prices. They are not H-E-B's prices.</p>
    <p><b>Brands.</b> Suggestions name H-E-B's store-brand lines by what they are generally known for. They are marked unverified until checked on heb.com.</p>
    <p><b>Expiration dates.</b> Estimated from typical shelf life for each food. Always check food before eating it.</p>
    <p class="muted small">Fridge is a family project and is not affiliated with H-E-B.</p></div>`));
