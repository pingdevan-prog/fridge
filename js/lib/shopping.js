// Smart shopping list: what the meal plan needs, minus what is in the fridge, plus low staples.
// Also H-E-B brand suggestions for each item.
import { state, uid, today, round2 } from '../store.js';
import { FOOD, SECTIONS, sectionFor } from '../data/foods.js';
import { BRAND_LINES, BRAND_BY_CAT, NATIONAL_ALT, NONFOOD } from '../data/heb.js';
import { getRecipe } from './recipes.js';
import { dayName } from './planner.js';
import { toGrams, fromGrams, convert, fmtAmount, roundUpToBuy, scaleAmount } from './units.js';
import { sameFood, fridgeStatus, tokens, nameScore } from './match.js';

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/** Estimated cost of an item: last price paid on a scanned receipt if we have one, otherwise a rough estimate. */
function priceFor(food, qty, unit) {
  if (!food) return { estPrice: null, priceSource: null };
  const last = state.prices[food.key];
  if (last && last.qty > 0) {
    const inLastUnit = convert(qty, unit, last.unit, food);
    if (inLastUnit != null) return { estPrice: round2((last.price / last.qty) * inLastUnit), priceSource: 'last receipt' };
  }
  const inBuy = convert(qty, unit, food.buy[0], food);
  return { estPrice: inBuy != null ? round2(food.buy[1] * inBuy) : null, priceSource: 'estimate' };
}

/** Rebuild the automatic part of the list. Hand-added items and check marks are kept. */
export function rebuildShopping() {
  const t = today();
  const needs = new Map();
  for (const e of state.plan) {
    if (e.date < t || e.cooked || e.leftoverOf) continue;
    const r = getRecipe(e.recipeId);
    if (!r) continue;
    const k = e.servings / (r.servings || 1), label = `${dayName(e.date)} ${e.slot}`;
    for (const ing of r.ingredients) {
      const st = fridgeStatus(ing, []);
      if (st.free) continue;
      const food = st.food, key = food ? food.key : 'n:' + tokens(ing.name).join(' ');
      let n = needs.get(key);
      if (!n) needs.set(key, (n = { key, food, name: food ? food.key : ing.name, grams: 0, units: {}, uses: [], presenceOnly: true, unmeasured: false }));
      const g = ing.qty ? toGrams(ing.qty * k, ing.unit || 'each', food) : null;
      if (ing.qty && !food?.basic) n.presenceOnly = false;
      if (g != null) n.grams += g;
      else if (ing.qty) { n.units[ing.unit || 'each'] = (n.units[ing.unit || 'each'] || 0) + ing.qty * k; n.unmeasured = true; }
      const sc = scaleAmount(ing.qty, ing.unit, k, food?.key);
      n.uses.push({ label, text: fmtAmount(sc.qty, sc.unit) });
    }
  }

  const auto = [];
  const push = (key, name, food, qty, unit, uses, note) => auto.push({
    key, name: cap(name), foodKey: food?.key || null, qty, unit, section: food ? sectionFor(food.cat) : 'Other', uses, note: note || '',
    ...priceFor(food, qty, unit),
  });
  for (const n of needs.values()) {
    const food = n.food;
    const items = state.fridge.filter((i) => !i.leftover && i.qty > 0 && sameFood(i, { name: n.name, foodKey: food?.key }));
    if (n.presenceOnly) { if (!items.length) push(n.key, n.name, food, 1, food?.buy[0] || 'each', n.uses); continue; }
    if (food && !n.unmeasured) {
      let haveG = 0;
      for (const i of items) { const g = toGrams(i.qty, i.unit, food); haveG += g == null ? Infinity : g; }
      const deficit = n.grams - haveG;
      if (deficit <= n.grams * 0.1) continue; // we have (nearly) enough
      let unit = food.buy[0], q = fromGrams(deficit, unit, food);
      if (q == null) { unit = 'lb'; q = deficit / 453.592; }
      push(n.key, n.name, food, roundUpToBuy(q, unit), unit, n.uses);
    } else {
      if (items.length) continue;
      const [unit, q] = Object.entries(n.units).sort((a, b) => b[1] - a[1])[0] || ['each', 1];
      push(n.key, n.name, food, Math.ceil(q * 4) / 4, unit, n.uses);
    }
  }
  // Staples that have run out.
  for (const i of state.fridge) {
    if (!(i.staple && i.qty <= 0) || auto.some((a) => a.foodKey && a.foodKey === i.foodKey)) continue;
    const food = i.foodKey && FOOD[i.foodKey];
    push(food ? food.key : 'n:' + tokens(i.name).join(' '), i.name, food, 1, food?.buy[0] || i.unit || 'each', [], 'Staple that ran out');
  }

  const old = new Map(state.shopping.filter((s) => !s.manual).map((s) => [s.key, s]));
  state.shopping = [
    ...auto.map((a) => ({ id: old.get(a.key)?.id || uid(), checked: !!old.get(a.key)?.checked, hidden: !!old.get(a.key)?.hidden, manual: false, ...a })),
    ...state.shopping.filter((s) => s.manual),
  ];
}

/** Add an item by hand. */
export function addManual(name, qty = 1, unit = 'each') {
  const p = fridgeStatus({ name }, []);
  const food = NONFOOD.test(name) ? null : p.food;
  const item = { id: uid(), key: 'm:' + uid(), name: cap(name.trim()), foodKey: food?.key || null, qty, unit,
    section: NONFOOD.test(name) ? 'Household' : food ? sectionFor(food.cat) : 'Other', checked: false, manual: true, uses: [], note: '', ...priceFor(food, qty, unit) };
  state.shopping.push(item);
  return item;
}

/** List grouped by H-E-B store section, in walking order. */
const visible = () => state.shopping.filter((s) => !s.hidden);
export function groupedList() {
  const list = visible();
  return SECTIONS.map((section) => ({ section, items: list.filter((s) => s.section === section) })).filter((g) => g.items.length);
}
export function listTotals() {
  let total = 0, unknown = 0;
  const list = visible();
  for (const s of list) { if (s.estPrice != null) total += s.estPrice; else unknown++; }
  return { total: round2(total), unknown, count: list.length, left: list.filter((s) => !s.checked).length };
}
export const amountText = (s) => fmtAmount(s.qty, s.unit) || '1';

/** Plain-text version for copying or sharing. */
export function shoppingText() {
  const lines = ['Shopping list for H-E-B'];
  for (const g of groupedList()) {
    lines.push('', g.section);
    for (const s of g.items) lines.push(`${s.checked ? '[x]' : '[ ]'} ${s.name} (${amountText(s)})`);
  }
  const t = listTotals();
  lines.push('', `Estimated total: about $${t.total.toFixed(0)} (rough estimate, not H-E-B prices)`);
  return lines.join('\n');
}
/** A link that carries the list inside it, so family members can open it on their own phone. */
export function shareLink() {
  const data = visible().filter((s) => !s.checked).map((s) => [s.name, amountText(s), SECTIONS.indexOf(s.section)]);
  const b64 = btoa(unescape(encodeURIComponent(JSON.stringify(data)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${location.origin}${location.pathname}#list=${b64}`;
}
export function readSharedList(hash) {
  const m = String(hash || '').match(/#list=([A-Za-z0-9_-]+)/);
  if (!m) return null;
  try {
    const json = decodeURIComponent(escape(atob(m[1].replace(/-/g, '+').replace(/_/g, '/'))));
    return JSON.parse(json).map(([name, amount, sec]) => ({ name: String(name), amount: String(amount), section: SECTIONS[sec] || 'Other' }));
  } catch { return null; }
}

/** After a receipt scan, tick the list items that were bought. Returns how many were ticked. */
export function checkOffFromReceipt(scanItems) {
  let n = 0;
  for (const s of state.shopping) {
    if (s.checked) continue;
    const hit = scanItems.some((it) => (s.foodKey ? it.foodKey === s.foodKey : nameScore(it.name, s.name) >= 0.99));
    if (hit) { s.checked = true; n++; }
  }
  return n;
}

// ---------- Brand recommendations ----------
/**
 * Suggest an H-E-B brand line for a shopping item based on the family's preference.
 * Nothing here claims a specific product exists: every suggestion is "unverified" until checked on heb.com.
 */
export function brandFor(item) {
  const food = item.foodKey && FOOD[item.foodKey];
  if (!food || item.section === 'Household') return null;
  const pref = state.household.brandPref || 'balanced';
  const lineKey = (BRAND_BY_CAT[food.cat] || BRAND_BY_CAT.other)[pref];
  const line = BRAND_LINES[lineKey];
  const label = { value: 'Best value', balanced: 'Balanced pick', healthiest: 'Healthiest' }[pref];
  const key = `${line.name}|${food.key}`;
  const query = lineKey === 'loose' ? food.key : `${line.name} ${food.key}`;
  return { key, brand: line.name, reason: `${label}: ${line.why}.`, alt: NATIONAL_ALT[food.key] || null, food: food.key,
    check: state.brandChecks[key] || null, searchUrl: 'https://www.heb.com/search?q=' + encodeURIComponent(query), loose: lineKey === 'loose' };
}
