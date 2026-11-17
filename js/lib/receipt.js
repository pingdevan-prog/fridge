// Receipt understanding: turns H-E-B receipt text (from OCR, a paste, or Claude vision)
// into clean, reviewable items.
import { ABBR, NONFOOD, SKIP_LINE } from '../data/heb.js';
import { FOODS, CAT_DEFAULTS, CATEGORIES } from '../data/foods.js';
import { findFood, tokens } from './match.js';
import { normUnit } from './units.js';
import { categoryOf, sameKind, INGREDIENTS } from '../data/ingredients.js';
import { uid } from '../store.js';
import { simpleName } from './names.js';

// Every word the food table knows, used to judge how confident a reading is.
const VOCAB = new Set();
for (const f of FOODS) for (const a of [f.key, ...f.aliases]) tokens(a).forEach((t) => VOCAB.add(t));

const BRAND_PREFIXES = ['H-E-B Organics', 'Central Market Organics', 'Hill Country Fare', 'Central Market', 'H-E-B Select Ingredients', 'H-E-B'];
const SIZE_UNITS = { OZ: 'oz', LB: 'lb', LBS: 'lb', CT: 'each', PK: 'each', GAL: 'gallon', QT: 'quart', PT: 'pint', ML: 'ml', KG: 'kg', G: 'g', L: 'l', RL: 'each', DZ: 'dozen', DOZ: 'dozen' };
const COMMON = new Set(['FRESH', 'CRISP', 'FRENCH', 'SWISS', 'STRING', 'THICK', 'CRUNCH', 'DISH', 'SOAP', 'HASS', 'ROMA', 'RED', 'OLD', 'BAG']);
const cap1 = (t) => t.charAt(0).toUpperCase() + t.slice(1);
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
  if (words[0] === 'HEB' || words[0] === 'H-E-B') {
    brand = 'H-E-B'; words.shift();
    if (/^ORG/.test(words[0] || '')) { brand = 'H-E-B Organics'; words.shift(); } else if (words[0] === 'SI') { brand = 'H-E-B Select Ingredients'; words.shift(); }
  }
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
 * p: { raw, name, brand, price, weight?, count?, size?, qty?, unit?, category?, isFood?, conf?, known?, noFood? }
 * noFood: a packaged product that should not be matched to a basic ingredient.
 */
export function finishItem(p) {
  const nonFood = p.isFood === false || NONFOOD.test(p.name) || p.category === 'household';
  const guess = nonFood ? null : categoryOf(p.name);
  let food = nonFood || p.noFood ? null : findFood(p.name);
  if (food && guess && !sameKind(food.cat, guess)) food = null; // "Serrano pepper" is not black pepper
  const category = nonFood ? 'household' : (guess || food?.cat || (CATEGORIES[p.category] && p.category !== 'other' ? p.category : 'other'));
  const frozen = /\bfrozen\b/i.test(p.name);
  const location = nonFood ? null : frozen ? 'freezer' : (food?.loc || CAT_DEFAULTS[category]?.[0] || 'pantry');
  let qty = p.qty, unit = p.unit ? normUnit(p.unit) : null;
  if (qty == null) {
    const buy = food?.buy?.[0];
    if (p.weight) { qty = p.weight; unit = 'lb'; }
    else if (p.size && buy === 'can' && p.size.unit === 'oz') { qty = p.count || 1; unit = 'can'; }
    else if (p.size) { qty = p.size.n * (p.count || 1); unit = p.size.unit; }
    else if (p.count) { qty = p.count; unit = !p.each && buy && !['lb', 'oz', 'gallon', 'dozen'].includes(buy) ? buy : 'each'; } // "2 Ea." on the receipt means each
    else { qty = 1; unit = !food || /on the cob/i.test(p.name) ? 'each' : (buy === 'lb' || buy === 'oz' ? 'package' : buy); }
  }
  const conf = p.conf != null ? p.conf : Math.min(1, (nonFood ? 0.45 : food ? 0.45 : 0) + 0.55 * (p.known ?? 0.5));
  return {
    id: uid(), raw: p.raw || '', name: [p.brand, p.name].filter(Boolean).join(' '), qty: Math.round(qty * 100) / 100, unit: unit || 'each',
    price: p.price ?? null, foodKey: food?.key || null, category, location, isFood: !nonFood, conf, keep: true, noFood: !!p.noFood,
  };
}

// ---------------- Reading receipt lines ----------------
// Real H-E-B receipt lines look like:
//   "12 HEB CLBY FNCY SHRD          F   2.98"      line number, name, tax flag, price
//   "32 SERRANO PEPPER"                             name only, followed by a quantity line:
//   "   0.32 Lbs @ 1/ 2.48   FW   0.79"             weight @ price per 1 lb, total
//   "   4 Ea. @ 2/ 1.00      FW   2.00"             count @ price for 2, total
// Text read from a photo adds noise, so every step below is tolerant of common misreads.

const MONEY = /(\d{1,3})\s?[.,:°'](\d{2})(?!\d|\s?[APap]\.?[Mm]?\b)/g; // 2.98, 2,98, 5°35 (but not times like 6:16P)
const FLAG = /^(?:[FT][A-Za-z0-9]?|[NXWHE][FTNXWHSEfowh]?|[|!Iil1+:;.,©®£¢€*_~»«-]{1,3}|FSF|SF|Ek|EE)$/;
const ITEMS_END = /^\W{0,3}(sub\s*-?\s*total|total\b|balance\s*due|\*+\s*total)/i;
// Lines that only appear after the items (payment, footer). If the total line was misread, these still end the list.
const AFTER_ITEMS = /\b(items\s*purchased|eps\s*amex|visa\s*eps|visa\s*credit|contactless|appr\s*no|ref\s*no|cashier|self\s*checkout|receipt\s*expires|store\s*hours|food-drugs|pharmacy)\b/i;

/** How many digits two prices differ by (2.48 vs 2.98 = 1). */
const digitsOff = (a, b) => editDistance(a.toFixed(2), b.toFixed(2), 3);

/** All money amounts in a line, as numbers, in order. */
function amounts(line) {
  const out = [];
  const text = String(line).replace(/([A-Za-z])(?=\d{1,3}[.,]\d{2}\b)/g, '$1 ');
  for (const m of text.matchAll(MONEY)) out.push(parseFloat(m[1] + '.' + m[2]));
  // A price printed right after the tax flag sometimes loses its decimal point: "F147" is 1.47.
  if (!out.length) { const m = text.match(/(?:^|\s)[FT][WHo]?\s?(\d{3,4})\s*\W{0,3}$/); if (m) out.push(parseInt(m[1], 10) / 100); }
  // ...or the decimal point reads as a 7: "3786" is 3.86, "15797" is 15.97.
  if (!out.length) { const m = text.match(/(?:^|\s)[A-Za-z]{0,2}(\d{1,2})7(\d{2})\s*\W{0,3}$/); if (m) out.push(parseFloat(m[1] + '.' + m[2])); }
  return out;
}
const letterRun = (w) => /[A-Za-z]{3,}/.test(w) || /^(HEB|HCF|CM|MC|SI|FS|SW|SZ|ORG|BR)$/i.test(w);

/** Is this a quantity line ("1.19 lbs @ 1/ 1.68 FW 2.00", "2 Ea. @ 1/ 0.49 FW 0.98")? */
function qtyLine(line) {
  const long = (line.match(/[A-Za-z]{4,}/g) || []).filter((w) => !/^(each|lbs?)$/i.test(w));
  if (long.length) return null;
  const hasAt = /[@®©«]/.test(line), per = line.match(/(\d)\s*\/\s*\$?(\d{1,3}[.,]\d{1,2})/);
  const lead = line.match(/^\W*([\dZz][\d.,]*)\s*([A-Za-z.]{0,4})/);
  const unitWord = lead?.[2] || '';
  const isWeight = /^(?:[lI1t]?[bh]s?|lbs?)$/i.test(unitWord) || /\blbs?\b/i.test(line);
  const isCount = /^[EeFf]?a\.?,?$|^ea/i.test(unitWord) && unitWord.length > 0;
  if (!hasAt && !per && !isWeight && !isCount) return null;
  const money = amounts(line);
  const total = money.length ? money[money.length - 1] : null;
  let qty = null, kind = isWeight ? 'weight' : isCount ? 'count' : null;
  // The surest quantity is the price math: total / (price per N).
  if (per && total) {
    const each = parseFloat(per[2].replace(',', '.')) / Number(per[1]);
    if (each > 0) qty = total / each;
  }
  if (qty == null && lead) {
    let n = parseFloat(lead[1].replace(/^[Zz]/, '2').replace(',', '.'));
    if (kind === 'weight' && !/[.,]/.test(lead[1]) && n >= 10) n /= 100; // "0.32" read as "32"
    if (n > 0) qty = n;
  }
  if (qty == null) return null;
  if (!kind) kind = Math.abs(qty - Math.round(qty)) < 0.05 ? 'count' : 'weight';
  qty = kind === 'count' ? Math.max(1, Math.round(qty)) : Math.round(qty * 100) / 100;
  return { kind, qty, total };
}

/** A line right under a name-only line that has prices but no words is that item's quantity line. */
function contextQty(line) {
  if ((line.match(/[A-Za-z]{4,}/g) || []).length) return null;
  const money = amounts(line);
  if (!money.length) return null;
  const total = money[money.length - 1];
  let qty = 1, kind = 'count';
  if (money.length >= 2 && money[money.length - 2] > 0) {
    const r = total / money[money.length - 2];
    if (Math.abs(r - Math.round(r)) < 0.08) qty = Math.max(1, Math.round(r)); else { qty = Math.round(r * 100) / 100; kind = 'weight'; }
  }
  return { kind, qty, total };
}

/** Clean a name read from a receipt line: drop the line number, junk and tax flags. */
function cleanName(text) {
  let words = String(text).replace(/[|]/g, ' ').split(/\s+/).filter(Boolean);
  while (words.length && !letterRun(words[0])) words.shift();                 // line numbers and junk in front
  while (words.length && (FLAG.test(words[words.length - 1]) || !/[A-Za-z0-9]/.test(words[words.length - 1]))) words.pop(); // tax flags behind
  return words.map((w) => w.replace(/^[^A-Za-z0-9&]+|[^A-Za-z0-9%&.']+$/g, '')).filter((w) => w && !/^[FT][A-Z]?\d{2,4}$/.test(w)).join(' ');
}

/**
 * Choose the receipt's subtotal from one or more readings. The total is the most reliable number (readings tend
 * to agree on it); a subtotal only counts if it is plausible next to it (between 85% and 100% of the total).
 * Falls back to total minus tax, then to the total itself.
 */
function pickSummary(readings) {
  const mostCommon = (vals) => { const m = new Map(); vals.filter((v) => v != null).forEach((v) => m.set(v, (m.get(v) || 0) + 1)); return m.size ? [...m].sort((a, b) => b[1] - a[1])[0][0] : null; };
  const total = mostCommon(readings.map((r) => r.total)), tax = mostCommon(readings.map((r) => r.tax));
  const subs = readings.map((r) => r.sub).filter((v) => v != null && (total == null || (v <= total + 0.01 && v >= total * 0.85)));
  const sub = mostCommon(subs);
  if (sub != null) return { subtotal: sub, summaryKind: 'subtotal' };
  if (total != null && tax != null && tax < total * 0.15) return { subtotal: Math.round((total - tax) * 100) / 100, summaryKind: 'subtotal' };
  if (total != null) return { subtotal: total, summaryKind: 'total' };
  return { subtotal: null, summaryKind: null };
}

/** Read the subtotal (or total minus tax) printed after the items, so the review can say if anything is missing. */
function readSummary(lines, found) {
  let sub = null, tax = null, total = null;
  for (const raw of lines.slice(0, 8)) {
    const line = cleanOcrLine(raw), m = amounts(line);
    if (!m.length) continue;
    const v = m[m.length - 1];
    if (/sub\s*-?\s*total/i.test(line)) sub = v; else if (/\btax\b/i.test(line)) tax = v; else if (/\btotal\b/i.test(line) && total == null) total = v;
  }
  Object.assign(found, { sub, tax, total });
  Object.assign(found, pickSummary([found]));
}

/** Turn a list of text lines into receipt items (before name expansion). */
function readLines(lines) {
  const found = [];
  let pending = null; // a name-only line waiting for its quantity line
  for (const [idx, raw] of lines.entries()) {
    const line = cleanOcrLine(raw);
    if (!line) continue;
    if (ITEMS_END.test(line) || AFTER_ITEMS.test(line)) { readSummary(lines.slice(idx), found); break; }
    const last = found[found.length - 1];
    const q = qtyLine(line) || (pending || (last && !last.hasQty && amounts(line).length >= 2) ? contextQty(line) : null);
    if (q) {
      const wasPending = !!pending, target = pending || found[found.length - 1];
      pending = null;
      if (!target || target.hasQty) continue;
      // A quantity line under an item that already has its own, different price belongs to a name line the
      // reader missed (for example "SERRANO PEPPER"): do not give its weight and price to the item above.
      // (Loose produce whose price is one digit off a number on the quantity line is the same item read badly: "0.19" for "0.49".)
      if (!wasPending && target.price != null && q.total != null && Math.abs(target.price - q.total) > 0.01 &&
        !(categoryOf(target.raw) === 'produce' && amounts(line).some((v) => digitsOff(v, target.price) <= 1))) continue;
      if (q.kind === 'weight') target.weight = q.qty; else { target.count = q.qty; target.each = true; }
      if (q.total != null) target.price = q.total;   // the quantity line's total is the item's price
      target.hasQty = true;
      if (!found.includes(target)) found.push(target);
      continue;
    }
    pending = null;
    if (SKIP_LINE.test(line)) continue;
    const money = amounts(line);
    if (money.length && (/(?:^|\s)-\$?\d{1,3}[.,]\d{2}|\d[.,]\d{2}-(?:\s|$)/.test(line) || /\b(coupon|savings|discount|promo)\b/i.test(line))) continue; // discounts and coupons
    const priceAt = money.length ? line.search(/\d{1,3}\s?[.,:°'](\d{2})(?!\d)[^\d]*$/) : -1;
    const name = cleanName(priceAt > 0 ? line.slice(0, priceAt) : line);
    if (!name || !/[A-Za-z]{3,}/.test(name)) continue;
    if (/\d{4,}/.test(name.replace(/\s/g, ''))) continue;                 // card numbers, phone numbers, barcodes
    const item = { raw: name, price: money.length ? money[money.length - 1] : null };
    if (item.price == null) { pending = item; found.push(item); } else found.push(item);
  }
  return found;
}

/** How much a parsed item looks like a real product name (0..1). */
function quality(p) {
  const words = p.raw.toUpperCase().split(/\s+/).filter((w) => /[A-Z]/.test(w));
  if (!words.length) return 0;
  const good = words.filter((w) => ABBR[w] || KNOWN.has(w) || correct(w) !== null).length;
  return good / words.length;
}

/** Parse plain receipt text (pasted digital receipt, or text read from a photo). */
export function parseReceiptText(text) {
  const found = readLines(String(text || '').split(/\r?\n/));
  return Object.assign(finishReceipt(found, found.subtotal ?? null), { subtotal: found.subtotal ?? null, summaryKind: found.summaryKind || null });
}

/**
 * Parse several readings of the same receipt (the same photo read with different settings) and combine them.
 * Each receipt line becomes one group: the readings' versions of a line are matched by name and position,
 * the price most readings agree on wins, and the clearest name wins. Items bought twice stay separate,
 * because every reading lists them twice too.
 */
export function parseReceiptReadings(readings) {
  const raw = readings.map((lines) => readLines(lines));
  const summary = pickSummary(raw);
  const parsed = raw.map((r) => r.filter((p) => p.price != null || p.hasQty));
  parsed.sort((a, b) => b.length - a.length);
  const [base = [], ...others] = parsed;
  const groups = base.map((p, i) => ({ pos: i / Math.max(1, base.length), variants: [p] }));
  for (const other of others) {
    const claimed = new Set();
    other.forEach((p, j) => {
      const pos = j / Math.max(1, other.length);
      let best = null, bestScore = 0;
      for (const g of groups) {
        if (claimed.has(g)) continue;
        const overlap = Math.max(...g.variants.map((v) => nameOverlap(v.raw, p.raw)));
        const samePrice = g.variants.some((v) => v.price != null && v.price === p.price);
        const near = 1 - Math.min(1, Math.abs(g.pos - pos) * 4);   // lines far apart on the receipt are unlikely twins
        const score = (overlap >= 0.5 ? overlap : samePrice && overlap > 0 ? 0.4 : 0) * (0.5 + 0.5 * near);
        if (score > bestScore) { best = g; bestScore = score; }
      }
      if (best && bestScore >= 0.3) { best.variants.push(p); claimed.add(best); }
      else if (p.price != null && quality(p) >= 0.6) { const g = { pos, variants: [p] }; groups.push(g); claimed.add(g); }
    });
  }
  groups.sort((a, b) => a.pos - b.pos);
  const merged = groups.map(({ variants }) => {
    // Price: the one most readings agree on; ties go to the reading with the clearest name.
    const votes = new Map();
    for (const v of variants) if (v.price != null) votes.set(v.price, (votes.get(v.price) || 0) + 1 + quality(v) / 10);
    const price = votes.size ? [...votes].sort((a, b) => b[1] - a[1])[0][0] : null;
    const named = [...variants].sort((a, b) => quality(b) - quality(a) || b.raw.length - a.raw.length)[0];
    const withQty = variants.find((v) => v.hasQty && (v.price === price || price == null));
    return { ...named, price, weight: withQty?.weight, count: withQty?.count, each: withQty?.each, hasQty: !!withQty, agree: votes.size ? Math.max(...votes.values()) : 0 };
  });
  return Object.assign(finishReceipt(merged, summary.subtotal ?? null), { subtotal: summary.subtotal ?? null, summaryKind: summary.summaryKind || null });
}

/**
 * Join receipt items read from several photos of one long receipt (top, middle, bottom; or the whole receipt
 * and then a closer photo of part of it). The photos are lined up item by item, the way you would match two
 * overlapping lists by eye: the same price and a similar name in the same order means the same receipt line,
 * so it is kept once even if one photo garbled the name or misread the price. Lines only one photo caught are
 * kept. The subtotal comes from the last photo that shows one.
 */
export function joinReceiptParts(parts) {
  let out = [];
  for (const part of parts) out = out.length ? joinTwo(out, [...part]) : [...part];
  const last = parts.filter((p) => p.subtotal != null).pop() || {};
  return Object.assign(out, { subtotal: last.subtotal ?? null, summaryKind: last.summaryKind || null });
}

/** How alike two receipt rows are: 3 = surely the same line, 2 = same name, 0.8 = same price only, below 0 = different. */
function rowLikeness(a, b) {
  const n = Math.max(nameOverlap(a.raw || a.name, b.raw || b.name), a.name && a.name === b.name ? 1 : 0);
  const samePrice = a.price != null && a.price === b.price;
  if (samePrice && n >= 0.5) return 3;
  if (n >= 0.5) return 2;      // one photo misread the price
  if (samePrice) return 0.8;   // one photo garbled the name (prices like 2.98 repeat, so this alone is weak)
  return -1.5;
}
const better = (a, b) => ((b.conf || 0) > (a.conf || 0) ? b : a);

function joinTwo(A, B) {
  // Best-matching stretch of the two lists (local sequence alignment).
  const GAP = -0.7, rows = A.length + 1, cols = B.length + 1;
  const S = Array.from({ length: rows }, () => new Float32Array(cols));
  let best = 0, bi = 0, bj = 0;
  for (let i = 1; i < rows; i++) for (let j = 1; j < cols; j++) {
    const v = Math.max(0, S[i - 1][j - 1] + rowLikeness(A[i - 1], B[j - 1]), S[i - 1][j] + GAP, S[i][j - 1] + GAP);
    S[i][j] = v;
    if (v > best) { best = v; bi = i; bj = j; }
  }
  if (best < 4.5) return [...A, ...B]; // no real overlap: the photos show different parts
  // Walk back through the matching stretch.
  const steps = [];
  let i = bi, j = bj;
  while (i > 0 && j > 0 && S[i][j] > 0) {
    const like = rowLikeness(A[i - 1], B[j - 1]);
    if (Math.abs(S[i][j] - (S[i - 1][j - 1] + like)) < 1e-4 && like > 0) { steps.push(['same', i - 1, j - 1]); i--; j--; }
    else if (Math.abs(S[i][j] - (S[i - 1][j] + GAP)) < 1e-4) { steps.push(['a', i - 1]); i--; }
    else if (Math.abs(S[i][j] - (S[i][j - 1] + GAP)) < 1e-4) { steps.push(['b', j - 1]); j--; }
    else { steps.push(['a', i - 1], ['b', j - 1]); i--; j--; }
  }
  const a0 = i, b0 = j;
  steps.reverse();
  // Rows of B outside the matched stretch are kept unless they clearly repeat a row of A there too.
  const repeats = (row, pool) => pool.some((x) => rowLikeness(x, row) >= 2);
  const out = A.slice(0, a0);
  for (const row of B.slice(0, b0)) if (!repeats(row, A.slice(0, a0))) out.push(row);
  for (const [kind, x, y] of steps) {
    if (kind === 'same') out.push(better(A[x], B[y]));
    else if (kind === 'a') out.push(A[x]);
    else {
      // A row only this photo has, inside the overlap: keep it unless the other photo has the very same line close by
      // (one reading can put a line slightly out of order).
      const at = steps.findIndex((s) => s[0] === 'b' && s[1] === x);
      const prevA = steps.slice(0, at).reverse().find((s) => s[0] !== 'b'), posA = prevA ? prevA[1] : a0;
      const near = A.slice(Math.max(0, posA - 10), posA + 11);
      if (!near.some((r) => rowLikeness(r, B[x]) >= 3)) out.push(B[x]);
    }
  }
  out.push(...A.slice(bi));
  for (const row of B.slice(bj)) if (!repeats(row, A.slice(bi))) out.push(row);
  return out;
}

function nameOverlap(a, b) {
  const A = new Set(a.toUpperCase().split(/\W+/).filter((w) => w.length > 2)), B = new Set(b.toUpperCase().split(/\W+/).filter((w) => w.length > 2));
  if (!A.size || !B.size) return 0;
  let hit = 0;
  for (const w of A) if (B.has(w) || [...B].some((x) => editDistance(w, x) <= 1)) hit++;
  return hit / Math.min(A.size, B.size);
}

/**
 * Remove readings that cannot be real items: a misread total line ("Tots 20.96" whose price is the sum of
 * everything above it, or the printed total), and, when the prices add up to far more than the receipt says,
 * prices bigger than half the receipt (a misread decimal point).
 */
function sanityCheck(items, subtotal) {
  let out = [], running = 0;
  for (const p of items) {
    const isTotal = p.price != null && out.length >= 2 && (Math.abs(p.price - running) <= 0.1 || (subtotal != null && Math.abs(p.price - subtotal) <= 0.1 && p.price > 10));
    if (isTotal) continue;
    out.push(p);
    running += p.price || 0;
  }
  if (subtotal != null && running > subtotal * 1.15) out = out.filter((p) => !(p.price > Math.max(25, subtotal * 0.5)));
  return out;
}

function finishReceipt(found, subtotal = null) {
  return sanityCheck(found, subtotal)
    .filter((p) => (p.price != null || p.hasQty) && quality(p) > 0)
    .map((p) => {
      const fixed = p.raw.split(/\s+/).map((w) => (ABBR[w.toUpperCase()] || KNOWN.has(w.toUpperCase()) ? w : correct(w.toUpperCase()) || w)).join(' ');
      const q = quality({ raw: fixed });
      const ex = expandName(fixed);
      // Plain everyday name ("Barilla Whole Grain Penne" -> "Penne pasta"); the brand is kept on the side.
      const plain = simpleName([ex.brand, ex.name].filter(Boolean).join(' '));
      // A one- or two-letter name ("Er", "Al") tells nobody anything: show more of what was printed instead.
      let name = plain.name || ex.name;
      if (name.replace(/[^a-z]/gi, '').length < 3 && ex.name.replace(/[^a-z]/gi, '').length > name.replace(/[^a-z]/gi, '').length) name = cap1(ex.name.toLowerCase());
      const item = finishItem({ ...p, raw: p.raw, ...ex, name, brand: '' });
      item.brand = plain.brand || ex.brand || '';
      // Confidence comes from how many words were recognised, so garbled lines get flagged for a check.
      item.conf = Math.min(item.conf, 0.35 + 0.65 * q - (p.price == null ? 0.2 : 0));
      return item;
    });
}

// ---------------- Fixing misread words ----------------
// Words that appear on grocery receipts: food names, receipt shorthand and common brands.
const BRAND_WORDS = `HEB HCF CENTRAL MARKET ORGANICS SELECT INGREDIENTS COKE PEPSI SPRITE FANTA DIET ZERO SUGAR DANNON OIKOS TRIPLE CHOBANI YOPLAIT FAIRLIFE
  BONNE MAMAN SMUCKERS HATCH OLD PASO MCCORMICK GRILLMATES BARILLA RAOS PREGO RAGU SAPPORO ICHIBAN TONKOTSU MARUCHAN NISSIN ALEXIA ORE IDA BIRDS EYE
  GREEN GIANT DEL MONTE CAMPBELLS SWANSON PROGRESSO KRAFT VELVEETA TILLAMOOK DAISY BORDEN BLUE BELL BUNNY HELLMANNS HEINZ FRENCHS KIKKOMAN TABASCO
  CHOLULA VALENTINA HERDEZ PACE TOSTITOS FRITOS DORITOS LAYS RUFFLES CHEETOS SUNCHIPS PRINGLES GOLDFISH RITZ TRISCUIT CHEEZ OREO CHIPS AHOY NABISCO
  KELLOGGS GENERAL MILLS CHEERIOS QUAKER NATURE VALLEY KIND CLIF SWISS MISS NESTLE HERSHEYS REESES MARS SNICKERS SKITTLES STARBURST SOUR PATCH KIDS
  HARIBO TROLLI AMOS PEELERZ GUMMY PALMER RUDOLPH PALS CONAIR MICROBAN SHOWER DAVES KILLER BREAD MISSION GUERRERO SARA LEE PEPPERIDGE FARM THOMAS
  NATURES OWN WONDER COUNTRY CROC SHEDD SPREAD LAND LAKES KERRYGOLD PRETZEL CRISPS SNYDERS PHILADELPHIA SARGENTO BELGIOIOSO BOARS HEAD HILLSHIRE OSCAR
  MAYER JIMMY DEAN TYSON PERDUE FOSTER FARMS JENNIE BUTTERBALL BANYAN NASOYA HOUSE FOODS BORN FARMS DOLE FRESH EXPRESS TAYLOR EARTHBOUND DRISCOLLS
  CHIQUITA SUNKIST WONDERFUL HALOS CUTIES MI TIENDA POBLANO MOLE CHATEAU MICHELLE INDIAN WELLS VINEYARD WHITE ROCK CLUB SODA TOPO CHICO LACROIX
  GATORADE POWERADE ARIZONA SNAPPLE TROPICANA SIMPLY MINUTE MAID OCEAN SPRAY WELCHS JUICY JUICE CAPRI HONEST STARBUCKS FOLGERS COMMUNITY
  GOURMET CRISPY DILL HOXY KOREAN RAMEN SEASONING SPICY ENCHILADA SAUCE MILD COCOA SCOOP BAKERS PRESERVES ORANGE UNSWEETENED SLICED NATURAL ALMOND
  ALMONDS WALNUT WALNUTS HALVES PIECES COLBY FANCY SHREDDED HONEY MAPLE HAM JUMBO BLUEBERRIES SALMON FILLET NORWEGIAN MUENSTER PEPPER SAUSAGE THIGHS
  BONELESS SKINLESS LEAN GROUND TURKEY MEXICAN BLEND CHEESE WATERMELON BAGGED FRENCH BEANS CLOUD TOMATOES SERRANO CILANTRO PREMIUM BANANAS ONION ONIONS
  BULK BEETS ICEBERG LETTUCE SMALL LEMONS BABY CORN WHOLE BELLA MUSHROOMS BUTTERNUT SQUASH HARD TOFU ROMA AVOCADOS HASS GRAIN SEED BASIL AQUADOME
  MILK CHOCOLATE HALF SANDWICH TORTILLA TORTILLAS SOUTHWESTERN BELL PEPPERS GARLIC PARMESAN HARVEST CHEDDAR VEGGIE PENNE POTATO BITES SWEET`;
const KNOWN = new Set();
const addWords = (text) => String(text).toUpperCase().split(/[^A-Z]+/).forEach((w) => { if (w.length >= 2) KNOWN.add(w); });
addWords(BRAND_WORDS);
for (const f of FOODS) addWords([f.key, ...f.aliases].join(' '));
for (const [k, v] of Object.entries(ABBR)) { KNOWN.add(k); addWords(v); }
addWords(INGREDIENTS.map((i) => i.name).join(' '));
const BY_LEN = new Map();
for (const w of KNOWN) { if (!BY_LEN.has(w.length)) BY_LEN.set(w.length, []); BY_LEN.get(w.length).push(w); }

export function editDistance(a, b, max = 3) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (cur[j] < best) best = cur[j];
    }
    if (best > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}
const fixCache = new Map();
/** Closest known word to a misread one ("PCTATO" -> "POTATO"), or null when nothing is close enough. */
function correct(word) {
  const w = String(word || '').toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/0/g, 'O').replace(/1(?=[A-Z])/g, 'I').replace(/5(?=[A-Z])/g, 'S');
  if (w.length < 4 || /\d/.test(w)) return null;
  if (KNOWN.has(w)) return w;
  if (fixCache.has(w)) return fixCache.get(w);
  const max = w.length >= 8 ? 2 : 1;
  let best = null, bestD = max + 1;
  for (let len = w.length - max; len <= w.length + max; len++) for (const k of BY_LEN.get(len) || []) {
    const d = editDistance(w, k, max);
    if (d < bestD || (d === bestD && best && k[0] === w[0] && best[0] !== w[0])) { best = k; bestD = d; }
  }
  const out = bestD <= max ? best : null;
  fixCache.set(w, out);
  return out;
}

/** Undo common text-reader mistakes on receipts before parsing a line. */
export function cleanOcrLine(line) {
  return String(line || '').replace(/\s+/g, ' ').trim()
    .replace(/(\d)\s*[1Il]b\b/g, '$1 lb')              // "2.36 1b" -> "2.36 lb"
    .replace(/\/\s*[1Il]b\b/g, '/lb')                   // "/1b" -> "/lb"
    .replace(/\b0Z\b/g, 'OZ').replace(/(\d)\s?0Z\b/g, '$1 OZ') // "8 0Z" -> "8 OZ"
    .replace(/([A-Z])0(?=[A-Z])/g, '$1O')               // "M0ZZ" -> "MOZZ"
    .replace(/(\d[.,]\d)[/|'](\d)\b/g, '$1$2')          // "5.9/7" -> "5.97"
    .replace(/(\d)\s?°\s?(\d{2})\b/g, '$1.$2')          // "5°35" -> "5.35"
    .replace(/(\d),(\d{2})\b/g, '$1.$2')                // "2,18" -> "2.18"
    .replace(/(\d[.,]\d)[\])](?=\s|$)/g, '$17')         // "3.2]" -> "3.27" (a 7 often reads as ] or ))
    .replace(/(\d[.,]\d)[|lI](?=\s|$)/g, '$11');        // "5.5|" -> "5.51"
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
