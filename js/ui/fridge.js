// Fridge tab: inventory shelves, item editor, receipt scanning and the review screen.
import { state, commit, addToFridge, deductFromItem, expiringSoon, estimateExpiry, today, daysBetween, uid, round2 } from '../store.js';
import { FOOD, LOCATIONS, CATEGORIES, CAT_DEFAULTS } from '../data/foods.js';
import { findFood } from '../lib/match.js';
import { ingredientCategory } from '../data/ingredients.js';
import { UNITS, fmtAmount } from '../lib/units.js';
import { itemNutrition, eatNutrition, usdaSearch } from '../lib/nutrition.js';
import { parseReceiptText, parseReceiptReadings, joinReceiptParts, finishItem, splitBrand, mergeItems } from '../lib/receipt.js';
import { readReceiptPhoto } from '../lib/ocr.js';
import { hasAI, aiParseReceipt, aiIdentifyFoods } from '../lib/ai.js';
import { checkOffFromReceipt } from '../lib/shopping.js';
import { ic, catBadge, avatar } from './icons.js';
import { $, esc, on, ui, go, render as redraw, registerView, openSheet, sheetOf, toast, withUndo, fields, expiryText, fmtDate, options, money } from './dom.js';

let q = '', loc = 'all';
const amount = (i) => (i.qty > 0 ? fmtAmount(i.qty, i.unit) : 'Out');

function tile(i, showExpiry = false) {
  const days = i.expiresAt ? daysBetween(today(), i.expiresAt) : 99;
  const badge = i.qty <= 0 ? '<span class="badge">Out</span>'
    : (days <= 3 && i.location !== 'staples') || showExpiry ? `<span class="badge ${days <= 1 ? 'red' : ''}">${esc(expiryText(i.expiresAt))}</span>` : '';
  return `<button class="tile ${i.qty <= 0 ? 'out' : ''}" data-act="item-open" data-id="${i.id}">
    ${catBadge(i.category, i.leftover)}${badge}
    <span class="nm">${esc(i.name)}</span>
    <span class="qt">${esc(amount(i))}${i.brand ? ' · ' + esc(i.brand) : ''}</span></button>`;
}

function listHtml() {
  const term = q.trim().toLowerCase();
  const items = state.fridge.filter((i) => (loc === 'all' || i.location === loc) &&
    (!term || i.name.toLowerCase().includes(term) || (i.brand || '').toLowerCase().includes(term) || (i.foodKey || '').includes(term)));
  if (!items.length) return `<div class="empty"><div class="big">${ic('search')}</div><p class="muted">Nothing matches. Try a different word or shelf.</p></div>`;
  return Object.entries(LOCATIONS).map(([key, label]) => {
    const list = items.filter((i) => i.location === key).sort((a, b) => a.name.localeCompare(b.name));
    if (!list.length) return '';
    return `<section class="shelf"><div class="shelf-head"><h2>${label}</h2><span class="muted small">${list.length} ${list.length === 1 ? 'item' : 'items'}</span></div>
      <div class="tiles">${list.map((i) => tile(i)).join('')}</div><div class="shelf-edge"></div></section>`;
  }).join('');
}

function render() {
  const exp = expiringSoon(3);
  if (!state.fridge.length) {
    return `<div class="top"><h1>Fridge</h1></div>
      <div class="card empty"><div class="big">${ic('fridge')}</div><h2>Your fridge is empty</h2>
      <p class="muted">Add the food you have at home. Take photos of your drawers and shelves, or scan your H-E-B receipt after shopping.</p>
      ${addOptions()}</div>`;
  }
  return `
    <div class="top"><div><h1>Fridge</h1><p class="sub">${state.fridge.filter((i) => i.qty > 0).length} foods at home</p></div>
      <button class="btn sm soft" data-act="item-new">Type it in</button></div>
    ${exp.length ? `<section class="expiring"><div class="rowf"><h2 class="grow">Use these soon</h2><button class="btn sm" data-act="cook-expiring">Find recipes</button></div>
      <div class="scroller" style="margin-top:10px">${exp.map((i) => tile(i, true)).join('')}</div></section>` : ''}
    <div class="stack tight" style="margin-top:14px">
      <input class="input" type="search" placeholder="Search your food" value="${esc(q)}" data-input="fridge-search" aria-label="Search your food">
      <div class="chips">${[['all', 'All'], ...Object.entries(LOCATIONS)].map(([k, l]) => `<button class="chip ${loc === k ? 'on' : ''}" data-act="fridge-loc" data-loc="${k}">${l}</button>`).join('')}</div>
    </div>
    <div id="fridge-list">${listHtml()}</div>
    ${state.householdItems.length ? `<div class="sec"><button class="li" data-act="household-open">${catBadge('household')}<span class="grow nm">Household items</span><span class="muted">${state.householdItems.length}</span>${ic('chevR', 'chev')}</button></div>` : ''}
    <button class="fab" data-act="add-open">${ic('camera')}Add food</button>`;
}
registerView('fridge', render);

/** The four ways to get food into the fridge. */
function addOptions() {
  return `<div class="stack" style="width:100%">
    <label class="btn block">${ic('camera')}Take a photo of your food<input type="file" accept="image/*" capture="environment" hidden data-change="food-photo"></label>
    <label class="btn ghost block">${ic('images')}Choose photos<input type="file" accept="image/*" multiple hidden data-change="food-photo"></label>
    <button class="btn ghost block" data-act="scan-open">${ic('receipt')}Scan a receipt</button>
    <button class="btn ghost block" data-act="item-new">${ic('pencil')}Type it in</button></div>`;
}
on('add-open', () => openSheet(() => `<h2>Add food</h2>
  <p class="sub">${hasAI() ? 'Take a photo of a drawer, shelf or counter and Claude lists every food it sees.' : 'Take a photo of a drawer, shelf or counter. Fresh produce is recognized best; packaged foods may need typing.'}</p>
  <div style="margin-top:14px">${addOptions()}</div>`));

on('fridge-search', (el) => { q = el.value; $('#fridge-list').innerHTML = listHtml(); });
on('fridge-loc', (el) => { loc = el.dataset.loc; redraw(); });
on('cook-expiring', () => { ui.mealsFilter = { useExpiring: true }; go('meals'); });
on('household-open', () => openSheet(() => `<h2>Household items</h2><p class="sub">Non-food things from your receipts.</p>
  <div class="list" style="margin-top:12px">${state.householdItems.map((h) => `<div class="li">${catBadge('household')}<span class="grow"><span class="nm">${esc(h.name)}</span><br><span class="muted small">${esc(fmtAmount(h.qty, h.unit))} · ${esc(fmtDate(h.addedAt))}${h.price != null ? ' · ' + money(h.price) : ''}</span></span>
    <button class="icon-btn clear" data-act="household-del" data-id="${h.id}" aria-label="Remove">${ic('trash')}</button></div>`).join('') || '<p class="muted">Nothing here.</p>'}</div>`));
on('household-del', (el) => { const sh = sheetOf(el); withUndo('Removed', () => { state.householdItems = state.householdItems.filter((h) => h.id !== el.dataset.id); }); sh?.refresh(); });

// ---------------- Item editor ----------------
function nutritionLine(n) {
  if (!n) return '<span class="muted">No nutrition info yet.</span>';
  return `<b>${Math.round(n.kcal)} kcal</b> · protein ${Math.round(n.protein || 0)} g · carbs ${Math.round(n.carbs || 0)} g · fat ${Math.round(n.fat || 0)} g · fiber ${Math.round(n.fiber || 0)} g <span class="muted">per ${esc(n.per)}</span>
    <br><span class="muted small">${esc(n.source || '')}</span>`;
}

function itemSheet(item) {
  const isNew = !item;
  const d = item ? { ...item } : { name: '', brand: '', qty: 1, unit: 'each', location: 'fridge', category: 'other', expiresAt: '', staple: false, leftover: false };
  let usda = null, usdaBusy = false, usdaErr = '', showNut = false, custom = d.nutrition ? { ...d.nutrition } : null;
  const sheet = openSheet(() => {
    const n = custom || itemNutrition(d);
    return `<h2>${isNew ? 'Add food' : esc(d.name)}</h2>
    <div class="stack" data-form="item" style="margin-top:12px">
      <label class="field"><span>Name</span><input class="input" name="name" value="${esc(d.name)}" placeholder="Start typing: ap… for apples" autocomplete="off" autocapitalize="sentences" data-suggest="food" data-change="item-name"></label>
      <label class="field"><span>Brand (optional)</span><input class="input" name="brand" value="${esc(d.brand || '')}" placeholder="H-E-B, Hill Country Fare"></label>
      <div class="grid2">
        <label class="field"><span>How much</span><input class="input" name="qty" type="number" inputmode="decimal" min="0" step="any" value="${d.qty}"></label>
        <label class="field"><span>Unit</span><select class="input" name="unit">${options(UNITS, d.unit)}</select></label>
      </div>
      <div class="grid2">
        <label class="field"><span>Where it lives</span><select class="input" name="location" data-change="item-loc">${options(Object.entries(LOCATIONS), d.location)}</select></label>
        <label class="field"><span>Type</span><select class="input" name="category">${options(Object.entries(CATEGORIES).filter(([k]) => k !== 'household'), d.category)}</select></label>
      </div>
      <label class="field"><span>Best before (estimated, change it if you know better)</span><input class="input" name="expiresAt" type="date" value="${esc(d.expiresAt || '')}"></label>
      <label class="check"><input type="checkbox" name="leftover" ${d.leftover ? 'checked' : ''}> Homemade food or leftovers</label>
      <label class="check"><input type="checkbox" name="staple" ${d.staple ? 'checked' : ''}> Keep stocked (add to the shopping list when it runs out)</label>
      <div class="card" style="padding:12px">
        <div class="rowf"><h3 class="grow">Nutrition</h3><button class="btn sm soft" data-act="item-nut-toggle">${showNut ? 'Hide' : 'Edit'}</button></div>
        <p class="small" style="margin-top:6px">${nutritionLine(n)}</p>
        ${showNut ? `<div class="stack tight" style="margin-top:10px" data-form="nut">
          <label class="field"><span>Values are per</span><select class="input" name="per">${options([['serving', 'serving'], ['100 g', '100 g']], n?.per === '100 g' ? '100 g' : 'serving')}</select></label>
          <div class="grid5">${[['kcal', 'kcal'], ['protein', 'Prot g'], ['carbs', 'Carb g'], ['fat', 'Fat g'], ['fiber', 'Fiber g']].map(([k, l]) =>
            `<label class="field"><span>${l}</span><input class="input" style="padding:8px" name="${k}" type="number" inputmode="decimal" min="0" step="any" value="${n ? Math.round(n[k] || 0) : ''}"></label>`).join('')}</div>
          <button class="btn sm ghost" data-act="item-usda">${usdaBusy ? 'Searching USDA…' : 'Look it up in USDA FoodData Central'}</button>
          ${usdaErr ? `<p class="note red">${esc(usdaErr)}</p>` : ''}
          ${usda ? `<div class="list">${usda.map((u, i) => `<button class="li" data-act="item-usda-pick" data-i="${i}"><span class="grow"><span class="nm small">${esc(u.name)}</span><br><span class="muted small">${u.n.kcal} kcal per 100 g</span></span></button>`).join('') || '<p class="muted small">No matches found.</p>'}</div>` : ''}
        </div>` : ''}
      </div>
      <button class="btn block" data-act="item-save">${isNew ? 'Add to fridge' : 'Save changes'}</button>
      ${isNew ? '' : `<div class="grid2"><button class="btn soft" data-act="item-eat">${ic('utensils')}Ate some</button><button class="btn danger" data-act="item-delete">Delete</button></div>`}
    </div>`;
  });
  // The sheet keeps its working copy here so handlers can reach it.
  sheet.ctx = {
    item, d,
    read() { Object.assign(d, fields($('[data-form="item"]', sheet.body))); if (showNut) { const f = fields($('[data-form="nut"]', sheet.body)); if (f.kcal != null) custom = { ...f, source: custom?.source?.startsWith('USDA') ? custom.source : 'Entered by you' }; } },
    toggleNut() { this.read(); showNut = !showNut; sheet.refresh(); },
    async usda() {
      this.read();
      if (!d.name) { usdaErr = 'Type a name first.'; sheet.refresh(); return; }
      usdaBusy = true; usdaErr = ''; sheet.refresh();
      try { usda = await usdaSearch(d.name, state.settings.usdaKey); } catch (e) { usdaErr = e.message; usda = null; }
      usdaBusy = false; sheet.refresh();
    },
    pick(i) { this.read(); custom = { ...usda[i].n }; usda = null; sheet.refresh(); },
    custom: () => custom,
  };
  return sheet;
}

on('item-new', (el) => { sheetOf(el)?.close(); itemSheet(null); });
on('item-open', (el) => { const item = state.fridge.find((i) => i.id === el.dataset.id); if (item) itemSheet(item); });
on('item-nut-toggle', (el) => sheetOf(el).ctx.toggleNut());
on('item-usda', (el) => sheetOf(el).ctx.usda());
on('item-usda-pick', (el) => sheetOf(el).ctx.pick(Number(el.dataset.i)));
// When the name or shelf changes on a new item, refresh the smart defaults (type, shelf, best-before date).
on('item-name', (el) => {
  const sh = sheetOf(el), c = sh.ctx;
  if (c.item) return;
  c.read();
  const food = findFood(c.d.name);
  if (food) { c.d.category = food.cat; c.d.location = food.loc; c.d.unit = ['lb', 'oz'].includes(food.buy[0]) ? 'lb' : food.buy[0]; c.d.expiresAt = estimateExpiry(food, food.cat, food.loc); sh.refresh(); return; }
  // Not in the nutrition table, but in the ingredient list: still pick the right type, shelf and date.
  const cat = ingredientCategory(c.d.name);
  if (cat) { const [loc] = CAT_DEFAULTS[cat] || ['pantry']; c.d.category = cat; c.d.location = loc; c.d.expiresAt = estimateExpiry(null, cat, loc); sh.refresh(); }
});
on('item-loc', (el) => {
  const sh = sheetOf(el), c = sh.ctx;
  c.read();
  c.d.expiresAt = estimateExpiry(findFood(c.d.name), c.d.category, c.d.location, c.item?.addedAt || today());
  sh.refresh();
});
on('item-save', (el) => {
  const sh = sheetOf(el), c = sh.ctx;
  c.read();
  const d = c.d;
  if (!d.name) { toast('Give it a name first.'); return; }
  if (d.leftover) d.category = 'leftovers';
  const nutrition = c.custom();
  if (c.item) {
    const food = findFood(d.name);
    Object.assign(c.item, { name: d.name, brand: d.brand, qty: round2(d.qty ?? 0), unit: d.unit, location: d.location, category: d.category,
      expiresAt: d.expiresAt || c.item.expiresAt, staple: d.staple, leftover: d.leftover, foodKey: d.leftover ? null : d.name === c.item.name ? c.item.foodKey : food?.key || null });
    if (nutrition) c.item.nutrition = nutrition; else delete c.item.nutrition;
    delete c.item.sample;
    commit(); toast('Saved');
  } else {
    addToFridge({ name: d.name, brand: d.brand, qty: d.qty ?? 1, unit: d.unit, location: d.location, category: d.category === 'other' ? undefined : d.category,
      expiresAt: d.expiresAt || undefined, staple: d.staple || undefined, leftover: d.leftover || undefined, nutrition: nutrition || undefined, foodKey: d.leftover ? null : undefined });
    commit(); toast(`${d.name} added to your fridge`);
  }
  sh.close();
});
on('item-delete', (el) => {
  const sh = sheetOf(el), item = sh.ctx.item;
  sh.close();
  withUndo(`${item.name} deleted`, () => { state.fridge = state.fridge.filter((i) => i.id !== item.id); });
});

// "Ate some": take food out of the fridge and log the calories.
on('item-eat', (el) => {
  const parent = sheetOf(el), item = parent.ctx.item;
  const who = new Set(state.members.map((m) => m.id));
  const sheet = openSheet(() => {
    const n = eatNutrition(item, 1);
    return `<h2>Ate some ${esc(item.name)}</h2><p class="sub">You have ${esc(amount(item))}.</p>
    <div class="stack" style="margin-top:12px" data-form="eat">
      <label class="field"><span>How much was eaten in total (${esc(item.unit)})</span><input class="input" name="qty" type="number" inputmode="decimal" min="0" step="any" value="${Math.min(item.qty, item.unit === 'serving' ? who.size || 1 : 1)}"></label>
      <div><p class="field" style="margin-bottom:6px">Who ate it? (shared equally)</p><div class="chips wrap">${state.members.map((m) => `<button class="chip ${who.has(m.id) ? 'on' : ''}" data-act="eat-who" data-id="${m.id}">${avatar(m)}${esc(m.name)}</button>`).join('')}</div></div>
      <label class="field"><span>Meal</span><select class="input" name="slot">${options(['breakfast', 'lunch', 'dinner', 'snack'], 'snack')}</select></label>
      ${n ? `<p class="note">About ${n.kcal} kcal per ${esc(item.unit === 'each' ? 'piece' : item.unit)}.</p>` : '<p class="note">No nutrition info for this item, so it will be taken out of the fridge without logging calories.</p>'}
      <button class="btn block" data-act="eat-save">Save</button></div>`;
  });
  sheet.ctx = { item, who, parent };
});
on('eat-who', (el) => { const sh = sheetOf(el), id = el.dataset.id; sh.ctx.who.has(id) ? sh.ctx.who.delete(id) : sh.ctx.who.add(id); el.classList.toggle('on'); });
on('eat-save', (el) => {
  const sh = sheetOf(el), { item, who, parent } = sh.ctx, f = fields(sh.body);
  const qty = Math.min(item.qty, f.qty || 0);
  if (!qty) { toast('Enter how much was eaten.'); return; }
  const total = eatNutrition(item, qty), share = who.size || 1;
  sh.close(); parent.close();
  withUndo(`Logged ${item.name}`, () => {
    if (total) for (const id of who) state.logs.push({ id: uid(), date: today(), slot: f.slot, name: item.name, memberId: id, servings: round2(qty / share), home: !!item.leftover,
      veg: !!(FOOD[item.foodKey]?.veg || FOOD[item.foodKey]?.fruit), kcal: Math.round(total.kcal / share), protein: Math.round(total.protein / share),
      carbs: Math.round(total.carbs / share), fat: Math.round(total.fat / share), fiber: Math.round(total.fiber / share) });
    deductFromItem(item, qty);
  });
});

// ---------------- Receipt scanning ----------------
let review = null; // { items: [...], selected: Set, source }

const openScan = (el) => { sheetOf(el)?.close(); return openSheet(() => `<h2>Scan a receipt</h2>
  <p class="sub">${hasAI() ? 'Claude will read your receipt and name every item.' : 'Your receipt is read on this phone.'}</p>
  <div class="stack" style="margin-top:14px">
    <label class="btn block">${ic('camera')}Take a photo<input type="file" accept="image/*" capture="environment" hidden data-change="scan-file"></label>
    <label class="btn soft block">${ic('images')}Choose photos or a screenshot<input type="file" accept="image/*" multiple hidden data-change="scan-file"></label>
    <button class="btn ghost block" data-act="scan-paste">Paste receipt text</button>
    <div class="note"><b>For the best results:</b> lay the receipt flat in good light and get close enough that the words are easy to read.
      For a long receipt, take two or three photos (top, middle, bottom) with a little overlap. You can add more photos from the review screen.</div>
  </div>`); };
on('scan-open', openScan);

/** Shrink a photo so it uploads fast, and return it as a JPEG data URL. */
export async function toDataUrl(file, max = 1800) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => bad(new Error('That file is not an image the app can open.')); i.src = url; });
    const k = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.86);
  } finally { URL.revokeObjectURL(url); }
}
/** Read receipt photos (several photos = parts of one long receipt). Returns items with .subtotal. */
async function readReceipts(files, set) {
  const parts = [];
  for (const [n, file] of files.entries()) {
    const which = files.length > 1 ? `photo ${n + 1} of ${files.length}` : 'your receipt';
    if (hasAI()) {
      set(`Claude is reading ${which}. This usually takes 10 to 30 seconds.`);
      const raw = await aiParseReceipt(await toDataUrl(file));
      parts.push(raw.map((r) => finishItem({ raw: r.raw, name: String(r.name || r.raw || 'Item'), brand: r.brand || '', qty: Number(r.qty) || 1, unit: r.unit || 'each',
        price: r.price == null ? null : Number(r.price), category: r.category, isFood: r.isFood !== false, conf: Number(r.confidence) || 0.5 })));
    } else {
      parts.push(parseReceiptReadings(await readReceiptPhoto(file, (p) => set(`Reading ${which} on this phone: ${p}%. Long receipts take up to a minute.`))));
    }
  }
  return joinReceiptParts(parts);
}

on('scan-file', async (el) => {
  const files = [...(el.files || [])];
  el.value = '';
  if (!files.length) return;
  sheetOf(el)?.close();
  let status = 'Getting your photo ready…', error = '';
  const sheet = openSheet(() => error
    ? `<div class="empty"><div class="big">${ic('alert')}</div><h2>That did not work</h2><p class="muted">${esc(error)}</p><button class="btn" data-act="scan-open-again">Try again</button></div>`
    : `<div class="loading"><div class="spin"></div><h2>Reading your receipt</h2><p class="muted">${esc(status)}</p></div>`);
  const set = (s) => { status = s; sheet.refresh(); };
  try {
    const items = await readReceipts(files, set);
    if (!items.length) throw new Error('No items were found. Get closer so the words are easy to read, lay the receipt flat in good light, and try again.');
    sheet.close();
    openReview(items, hasAI() ? 'Read by Claude' : 'Read on this phone', null, { subtotal: items.subtotal ?? null, summaryKind: items.summaryKind, receipt: true });
  } catch (e) { error = e.message || 'Something went wrong while reading the receipt.'; sheet.refresh(); }
});

// Review screen: add another photo of the same receipt (for long receipts) and merge it in.
on('rv-more', async (el) => {
  const files = [...(el.files || [])];
  el.value = '';
  if (!files.length || !review) return;
  const sh = sheetOf(el);
  review.busy = 'Reading the new photo…'; sh.refresh();
  try {
    const more = await readReceipts(files, (s) => { review.busy = s; sh.refresh(); });
    const before = review.items.length;
    const joined = joinReceiptParts([Object.assign([...review.items], { subtotal: review.subtotal, summaryKind: review.summaryKind }), more]);
    review.items = [...joined];
    if (joined.subtotal != null) { review.subtotal = joined.subtotal; review.summaryKind = joined.summaryKind; }
    toast(`${review.items.length - before} more ${review.items.length - before === 1 ? 'item' : 'items'} added from the new photo`);
  } catch (e) { toast(e.message || 'That photo could not be read.'); }
  review.busy = null; sh.refresh();
});
on('scan-open-again', (el) => openScan(el));

on('scan-paste', (el) => {
  sheetOf(el)?.close();
  openSheet(() => `<h2>Paste receipt text</h2><p class="sub">Copy the text of a digital H-E-B receipt and paste it here.</p>
    <div class="stack" style="margin-top:12px"><textarea class="input" name="text" placeholder="HEB ORG BNLS CKN BRST   11.84"></textarea>
    <button class="btn block" data-act="scan-paste-go">Read items</button></div>`);
});
on('scan-paste-go', (el) => {
  const sh = sheetOf(el), items = parseReceiptText(fields(sh.body).text);
  if (!items.length) { toast('No items found. Each item needs a name and a price on the same line.'); return; }
  sh.close(); openReview(items, 'Pasted text');
});

function reviewRow(it, selected) {
  const flag = it.conf < 0.7;
  const where = it.isFood ? it.location : 'household';
  return `<div class="rv ${flag ? 'flag' : ''}" data-id="${it.id}">
    <div class="r1"><input type="checkbox" aria-label="Select to merge" data-change="rv-select" ${selected ? 'checked' : ''}>
      <input class="input" value="${esc(it.name)}" placeholder="What is it?" autocomplete="off" data-suggest="food" data-change="rv-edit" data-f="name" aria-label="Name">
      <button class="icon-btn clear" data-act="rv-del" aria-label="Remove ${esc(it.name || 'item')}">${ic('trash')}</button></div>
    <div class="r2">
      <input class="input" type="number" inputmode="decimal" min="0" step="any" value="${it.qty}" data-change="rv-edit" data-f="qty" aria-label="Amount">
      <select class="input" data-change="rv-edit" data-f="unit" aria-label="Unit">${options(UNITS, it.unit)}</select>
    </div>
    <div class="r2">
      <input class="input" type="number" inputmode="decimal" min="0" step="0.01" value="${it.price ?? ''}" placeholder="Price $" data-change="rv-edit" data-f="price" aria-label="Price">
      <select class="input" data-change="rv-edit" data-f="where" aria-label="Where it goes">${options([...Object.entries(LOCATIONS), ['household', 'Household (not food)']], where)}</select>
    </div>
    <div class="meta">${flag ? '<span class="badge">Please check</span>' : ''}
      <span class="badge plain">${esc(CATEGORIES[it.category] || 'Other')}</span>
      ${it.raw ? `<span>Printed as “${esc(it.raw)}”</span>` : ''}</div>
  </div>`;
}

/** Compare what was read with the receipt's own subtotal, so missed items are obvious. */
function totalCheck() {
  if (review.subtotal == null) return '';
  const sum = review.items.reduce((t, i) => t + (Number(i.price) || 0), 0), gap = Math.round((review.subtotal - sum) * 100) / 100;
  const withTax = review.summaryKind === 'total';
  // A total includes tax (about 8.25% on taxable items in Austin), so allow for it before warning.
  if (withTax && gap >= -0.05 && gap <= review.subtotal * 0.0825 + 0.05) return `<p class="note" style="background:var(--green-soft);color:var(--green-dark);margin-top:10px">${ic('check')} The prices add up to ${money(sum)}, which matches the receipt total of ${money(review.subtotal)} once tax is included.</p>`;
  if (Math.abs(gap) < 0.05) return `<p class="note" style="background:var(--green-soft);color:var(--green-dark);margin-top:10px">${ic('check')} Every item was found: the prices add up to the receipt's ${money(review.subtotal)}.</p>`;
  return `<p class="note" style="margin-top:10px">The prices add up to ${money(sum)}, but the receipt ${withTax ? 'total (with tax) is' : 'subtotal is'} ${money(review.subtotal)}. ${gap > 0 ? `About ${money(gap)} of items may have been missed or misread. Check the receipt and use “Add a missed item” below.` : 'Some prices may have been misread. Check the ones that look off.'}</p>`;
}

export function openReview(items, source, photo = null, opts = {}) {
  review = { items, selected: new Set(), source: String(source).replace(/\.$/, ''), photo, subtotal: opts.subtotal ?? null, summaryKind: opts.summaryKind || 'subtotal', receipt: !!opts.receipt, busy: null };
  openSheet(() => {
    const flagged = review.items.filter((i) => i.conf < 0.7).length, food = review.items.filter((i) => i.isFood).length;
    return `<h2>Review ${review.items.length} ${review.items.length === 1 ? 'item' : 'items'}</h2>
    ${review.photo ? `<img class="review-photo" src="${review.photo}" alt="Your photo">` : ''}
    <p class="sub">${esc(review.source)}. Fix anything that looks off before it goes in your fridge.${flagged ? ` <b>${flagged} ${flagged === 1 ? 'needs' : 'need'} a quick look.</b>` : ''}</p>
    ${totalCheck()}
    ${review.receipt ? (review.busy ? `<p class="note" style="margin-top:10px">${esc(review.busy)}</p>`
      : `<label class="btn ghost block" style="margin-top:10px">${ic('camera')}Add a photo of more of this receipt<input type="file" accept="image/*" capture="environment" hidden data-change="rv-more"></label>`) : ''}
    <div class="stack tight" style="margin-top:12px">${review.items.map((it) => reviewRow(it, review.selected.has(it.id))).join('') || '<p class="muted center">Everything was removed.</p>'}</div>
    <button class="btn ghost block" style="margin-top:10px" data-act="rv-add">${ic('plus')}Add a missed item</button>
    <div class="sticky-bar"><button class="btn ghost" data-act="rv-merge" ${review.selected.size < 2 ? 'disabled' : ''}>Merge ${review.selected.size > 1 ? review.selected.size : ''}</button>
      <button class="btn grow" data-act="rv-confirm" ${review.items.length ? '' : 'disabled'}>Add ${food} to fridge</button></div>`;
  }, { full: true });
}
const rvItem = (el) => review.items.find((i) => i.id === el.closest('.rv').dataset.id);
on('rv-select', (el) => { const it = rvItem(el); el.checked ? review.selected.add(it.id) : review.selected.delete(it.id); sheetOf(el).refresh(); });
on('rv-edit', (el) => {
  const it = rvItem(el), f = el.dataset.f, sh = sheetOf(el);
  if (f === 'name') {
    // Re-match the corrected name against the food table.
    const { name } = splitBrand(el.value.trim());
    const again = finishItem({ raw: it.raw, name, brand: splitBrand(el.value.trim()).brand, qty: it.qty, unit: it.unit, price: it.price, conf: 1, isFood: it.isFood ? undefined : false });
    it.noFood = false; // the name was typed by hand, so match it normally
    Object.assign(it, { name: again.name, foodKey: again.foodKey, category: again.category, location: again.location, isFood: again.isFood, conf: 1 });
  } else if (f === 'qty') it.qty = Number(el.value) || 0;
  else if (f === 'price') it.price = el.value === '' ? null : Number(el.value);
  else if (f === 'unit') it.unit = el.value;
  else if (f === 'where') {
    if (el.value === 'household') { it.isFood = false; it.category = 'household'; it.location = null; }
    else { it.isFood = true; it.location = el.value; if (it.category === 'household') it.category = FOOD[it.foodKey]?.cat || 'other'; }
  }
  it.conf = 1;
  sh.refresh();
});
on('rv-add', (el) => { review.items.push(finishItem({ raw: '', name: '', qty: 1, unit: 'each', conf: 0 })); sheetOf(el).refresh(); });
on('rv-del', (el) => {
  const it = rvItem(el), idx = review.items.indexOf(it), sh = sheetOf(el);
  review.items.splice(idx, 1); review.selected.delete(it.id); sh.refresh();
  toast(`${it.name} removed`, { undo: () => { review.items.splice(idx, 0, it); sh.refresh(); } });
});
on('rv-merge', (el) => {
  const picked = review.items.filter((i) => review.selected.has(i.id));
  if (picked.length < 2) return;
  const before = [...review.items];
  mergeItems(picked);
  review.items = review.items.filter((i) => i === picked[0] || !review.selected.has(i.id));
  review.selected.clear();
  const sh = sheetOf(el); sh.refresh();
  toast(`Merged into ${picked[0].name}`, { undo: () => { review.items = before; sh.refresh(); } });
});
on('rv-confirm', (el) => {
  if (review.items.some((i) => !i.name.trim())) { toast('One item has no name yet. Type what it is, or remove it.'); return; }
  const items = review.items.filter((i) => i.qty > 0);
  const food = items.filter((i) => i.isFood);
  sheetOf(el).close();
  let ticked = 0;
  withUndo(() => `${food.length} ${food.length === 1 ? 'food' : 'foods'} added to your fridge.${ticked ? ` ${ticked} shopping list ${ticked === 1 ? 'item' : 'items'} checked off.` : ''}`, () => {
    for (const it of items) {
      if (!it.isFood) { state.householdItems.push({ id: uid(), name: it.name, qty: it.qty, unit: it.unit, price: it.price, addedAt: today() }); continue; }
      const { brand, name } = splitBrand(it.name);
      addToFridge({ name, brand, qty: it.qty, unit: it.unit, price: it.price ?? undefined, foodKey: it.noFood ? false : it.foodKey, category: it.category, location: it.location, nutrition: it.nutrition });
      if (it.foodKey && it.price != null) state.prices[it.foodKey] = { price: it.price, qty: it.qty, unit: it.unit, date: today() };
    }
    ticked = checkOffFromReceipt(food);
  });
  review = null;
});
