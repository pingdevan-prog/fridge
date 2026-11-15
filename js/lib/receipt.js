// Receipt understanding: turns H-E-B receipt text (from OCR, a paste, or Claude vision)
// into clean, reviewable items.
import { ABBR, NONFOOD, SKIP_LINE } from '../data/heb.js';
import { FOODS, CAT_DEFAULTS, CATEGORIES } from '../data/foods.js';
import { findFood, tokens } from './match.js';
import { normUnit } from './units.js';
import { uid } from '../store.js';

// Every word the food table knows, used to judge how confident a reading is.
const VOCAB = new Set();
for (const f of FOODS) for (const a of [f.key, ...f.aliases]) tokens(a).forEach((t) => VOCAB.add(t));

const BRAND_PREFIXES = ['H-E-B Organics', 'Central Market Organics', 'Hill Country Fare', 'Central Market', 'H-E-B Select Ingredients', 'H-E-B'];
const SIZE_UNITS = { OZ: 'oz', LB: 'lb', LBS: 'lb', CT: 'each', PK: 'each', GAL: 'gallon', QT: 'quart', PT: 'pint', ML: 'ml', KG: 'kg', G: 'g', L: 'l', RL: 'each', DZ: 'dozen', DOZ: 'dozen' };
const COMMON = new Set(['FRESH', 'CRISP', 'FRENCH', 'SWISS', 'STRING', 'THICK', 'CRUNCH', 'DISH', 'SOAP', 'HASS', 'ROMA', 'RED', 'OLD', 'BAG']);
const titleCase = (w) => (/^\d/.test(w) ? w.toLowerCase() : w.charAt(0) + w.slice(1).toLowerCase());

/** Split "H-E-B Organics Boneless Chicken Breast" into brand + name. */
export function splitBrand(full) {
  const s = String(full || '').trim();
  for (const b of BRAND_PREFIXES) if (s.toLowerCase().startsWith(b.toLowerCase() + ' ')) return { brand: b, name: s.slice(b.length).trim() };
  return { brand: '', name: s };
}

/** Expand a raw receipt name ("HEB ORG BNLS CKN BRST") into brand, readable name, size and a confidence score. */
export function expandName(raw) {
  let s = ' ' + raw.toUpperCase().replace(/[^A-Z0-9%/.&' -]/g, ' ') + ' ';
  let size = null;
  const sm = s.match(/\s(\d+(?:\.\d+)?)\s*(FL\s*OZ|OZ|LBS?|CT|PK|GAL|QT|PT|ML|KG|G|L|RL|DZ|DOZ)\s/);
  if (sm) {
    const u = sm[2].replace(/\s+/g, ' ');
    size = { n: parseFloat(sm[1]), unit: u === 'FL OZ' ? 'fl oz' : SIZE_UNITS[u] };
    s = s.replace(sm[0], ' ').replace(/\s(BAG|BOX|JAR|BTL|PKG|CAN|TUB)\s/, ' ');
  } else if (/\sHALF GAL\s|\sHG\s/.test(s)) { size = { n: 0.5, unit: 'gallon' }; s = s.replace(/\sHALF GAL\s|\sHG\s/, ' '); }
  else if (/\sGAL\s/.test(s)) { size = { n: 1, unit: 'gallon' }; s = s.replace(/\sGAL\s/, ' '); }
  else if (/\sDOZ(EN)?\s/.test(s)) { size = { n: 1, unit: 'dozen' }; s = s.replace(/\sDOZ(EN)?\s/, ' '); }

  let words = s.trim().split(/\s+/).filter(Boolean);
  let brand = '';
  if (words[0] === 'HEB' || words[0] === 'H-E-B') { brand = 'H-E-B'; words.shift(); if (/^ORG/.test(words[0] || '')) { brand = 'H-E-B Organics'; words.shift(); } }
  else if (words[0] === 'HCF') { brand = 'Hill Country Fare'; words.shift(); }
  else if (words[0] === 'CM') { brand = 'Central Market'; words.shift(); if (/^ORG/.test(words[0] || '')) { brand = 'Central Market Organics'; words.shift(); } }

  let known = 0;
  const out = words.map((w, i) => {
    if (w === 'PPR' && /^(TWL|TOWEL|PLT|PLATE|NAPK)/.test(words[i + 1] || '')) { known++; return 'Paper'; }
    if (ABBR[w]) { known++; return ABBR[w]; }
    const t = tokens(w)[0];
    const vowels = (w.match(/[AEIOUY]/g) || []).length;
    if (/^[\d%/.]+$/.test(w) || (t && VOCAB.has(t)) || COMMON.has(w) || (w.length >= 4 && vowels / w.length > 0.2)) known++;
    return titleCase(w);
  });
  return { brand, name: out.join(' ').trim(), size, known: words.length ? known / words.length : 0 };
}

/**
 * Finish a partly-read item: find the food, pick category, shelf, quantity and unit, score confidence.
 * p: { raw, name, brand, price, weight?, count?, size?, qty?, unit?, category?, isFood?, conf?, known? }
 */
export function finishItem(p) {
  const nonFood = p.isFood === false || NONFOOD.test(p.name) || p.category === 'household';
  const food = nonFood ? null : findFood(p.name);
  const category = nonFood ? 'household' : (food?.cat || (CATEGORIES[p.category] ? p.category : 'other'));
  const frozen = /\bfrozen\b/i.test(p.name);
  const location = nonFood ? null : frozen ? 'freezer' : (food?.loc || CAT_DEFAULTS[category]?.[0] || 'pantry');
  let qty = p.qty, unit = p.unit ? normUnit(p.unit) : null;
  if (qty == null) {
    const buy = food?.buy?.[0];
    if (p.weight) { qty = p.weight; unit = 'lb'; }
    else if (p.size && buy === 'can' && p.size.unit === 'oz') { qty = p.count || 1; unit = 'can'; }
    else if (p.size) { qty = p.size.n * (p.count || 1); unit = p.size.unit; }
    else if (p.count) { qty = p.count; unit = buy && !['lb', 'oz', 'gallon', 'dozen'].includes(buy) ? buy : 'each'; }
    else { qty = 1; unit = !food ? 'each' : (buy === 'lb' || buy === 'oz' ? 'package' : buy); }
  }
  const conf = p.conf != null ? p.conf : Math.min(1, (nonFood ? 0.45 : food ? 0.45 : 0) + 0.55 * (p.known ?? 0.5));
  return {
    id: uid(), raw: p.raw || '', name: [p.brand, p.name].filter(Boolean).join(' '), qty: Math.round(qty * 100) / 100, unit: unit || 'each',
    price: p.price ?? null, foodKey: food?.key || null, category, location, isFood: !nonFood, conf, keep: true,
  };
}

/** Parse plain receipt text (OCR output or pasted digital receipt). */
export function parseReceiptText(text) {
  const found = [];
  let pending = null; // a name-only line waiting for its "2 Ea. @ ..." line
  const lines = String(text || '').split(/\r?\n/).map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
  for (const line of lines) {
    if (/^(sub\s*-?total|total\b|balance due|\*+\s*total)/i.test(line)) break; // items end here
    if (line.includes('@')) {
      const target = pending || found[found.length - 1];
      pending = null;
      if (!target) continue;
      const w = line.match(/^(\d+(?:\.\d+)?)\s*(?:lbs?|kg)\b/i);
      const c = line.match(/^(\d+)\s*(?:ea\.?|each|x)?\s*@/i);
      if (w) target.weight = parseFloat(w[1]);
      else if (c) target.count = parseInt(c[1], 10);
      const price = line.match(/(\d+\.\d{2})\s*[A-Z]{0,2}$/);
      if (price && target.price == null) target.price = parseFloat(price[1]);
      if (!found.includes(target)) found.push(target);
      continue;
    }
    pending = null; // a name-only line that was not followed by a quantity line is just a header
    if (SKIP_LINE.test(line)) continue;
    const m = line.match(/^(.*?[A-Za-z].*?)\s+(?:[FTXNH]{1,2}\s+)?(-?\d+\.\d{2})\s*(-)?\s*[FTXNH]{0,2}$/);
    if (m) { if (parseFloat(m[2]) < 0 || m[3]) continue; found.push({ raw: m[1].trim(), price: parseFloat(m[2]) }); }
    else if (/[A-Za-z]{3,}/.test(line) && !/\d{3,}/.test(line)) pending = { raw: line };
  }
  return found.filter((p) => p.price != null).map((p) => finishItem({ ...p, ...expandName(p.raw) }));
}

/** Combine several review rows into one (adds quantities when the units match). */
export function mergeItems(items) {
  const [first, ...rest] = items;
  for (const r of rest) {
    if (r.unit === first.unit) first.qty = Math.round((first.qty + r.qty) * 100) / 100;
    if (r.price != null) first.price = Math.round(((first.price || 0) + r.price) * 100) / 100;
  }
  return first;
}
