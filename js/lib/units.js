// Unit conversion, ingredient text parsing, quantity formatting and recipe scaling.

export const VOL = { tsp: 4.929, tbsp: 14.787, 'fl oz': 29.574, cup: 236.59, pint: 473.18, quart: 946.35, gallon: 3785.4, ml: 1, l: 1000 };
export const WT = { g: 1, kg: 1000, oz: 28.3495, lb: 453.592 };
const CONTAINERS = new Set(['package', 'bag', 'box', 'jar', 'bottle', 'container', 'carton', 'packet']);
// Fallback gram weights for count-style units when the food has no specific value.
const UNIT_DEFAULT_G = { clove: 3, slice: 28, can: 400, bunch: 100, head: 500, stick: 113, stalk: 40, ear: 90, fillet: 150,
  link: 85, sprig: 1, leaf: 1, pinch: 0.4, dash: 0.6, handful: 30, loaf: 567 };

const ALIASES = {
  tsp: 'tsp', tsps: 'tsp', teaspoon: 'tsp', teaspoons: 'tsp',
  tbsp: 'tbsp', tbsps: 'tbsp', tbs: 'tbsp', tblsp: 'tbsp', tbls: 'tbsp', tablespoon: 'tbsp', tablespoons: 'tbsp',
  cup: 'cup', cups: 'cup', floz: 'fl oz', pint: 'pint', pints: 'pint', pt: 'pint', quart: 'quart', quarts: 'quart', qt: 'quart',
  gallon: 'gallon', gallons: 'gallon', gal: 'gallon', ml: 'ml', milliliter: 'ml', milliliters: 'ml', millilitres: 'ml',
  l: 'l', liter: 'l', liters: 'l', litre: 'l', litres: 'l',
  g: 'g', gram: 'g', grams: 'g', gm: 'g', gms: 'g', kg: 'kg', kilogram: 'kg', kilograms: 'kg',
  oz: 'oz', ounce: 'oz', ounces: 'oz', lb: 'lb', lbs: 'lb', pound: 'lb', pounds: 'lb',
  each: 'each', ea: 'each', ct: 'each', count: 'each', piece: 'each', pieces: 'each', whole: 'each', pc: 'each', pcs: 'each',
  clove: 'clove', cloves: 'clove', slice: 'slice', slices: 'slice', can: 'can', cans: 'can', tin: 'can', tins: 'can',
  bunch: 'bunch', bunches: 'bunch', head: 'head', heads: 'head', stick: 'stick', sticks: 'stick',
  stalk: 'stalk', stalks: 'stalk', rib: 'stalk', ribs: 'stalk', ear: 'ear', ears: 'ear',
  fillet: 'fillet', fillets: 'fillet', filet: 'fillet', filets: 'fillet', link: 'link', links: 'link',
  sprig: 'sprig', sprigs: 'sprig', leaf: 'leaf', leaves: 'leaf', pinch: 'pinch', pinches: 'pinch', dash: 'dash', dashes: 'dash',
  handful: 'handful', handfuls: 'handful', dozen: 'dozen', doz: 'dozen', dz: 'dozen',
  package: 'package', packages: 'package', pkg: 'package', pack: 'package', packs: 'package', pk: 'package',
  packet: 'packet', packets: 'packet', bag: 'bag', bags: 'bag', box: 'box', boxes: 'box', jar: 'jar', jars: 'jar',
  bottle: 'bottle', bottles: 'bottle', container: 'container', containers: 'container', tub: 'container', tubs: 'container',
  carton: 'carton', cartons: 'carton', loaf: 'loaf', loaves: 'loaf', serving: 'serving', servings: 'serving',
};
const SIZE_WORDS = new Set(['small', 'medium', 'large', 'big', 'extra', 'jumbo', 'heaped', 'heaping', 'level', 'rounded']);

export const UNITS = ['each', 'lb', 'oz', 'g', 'kg', 'cup', 'tbsp', 'tsp', 'fl oz', 'gallon', 'quart', 'ml', 'l', 'can', 'jar', 'bottle',
  'bag', 'box', 'package', 'container', 'carton', 'bunch', 'head', 'loaf', 'dozen', 'slice', 'clove', 'stick', 'serving'];

/** Normalise any unit spelling to our canonical unit ("Tablespoons" -> "tbsp"). Unknown -> "each". */
export function normUnit(u) {
  if (!u) return 'each';
  const s = String(u).toLowerCase().replace(/\./g, '').trim();
  if (s === 'fl oz' || s === 'fluid ounce' || s === 'fluid ounces') return 'fl oz';
  return ALIASES[s] || (UNITS.includes(s) ? s : 'each');
}
export const isVol = (u) => u in VOL;
export const isWt = (u) => u in WT;

/** Convert an amount to grams using the food's density / piece weights. Returns null if unknown. */
export function toGrams(qty, unit, food) {
  if (qty == null || isNaN(qty)) return null;
  const g = food?.g || {};
  if (unit in WT) return qty * WT[unit];
  if (unit in VOL) {
    const ml = qty * VOL[unit];
    if (unit === 'tsp' && g.tsp) return qty * g.tsp;
    if (unit === 'tbsp' && g.tbsp) return qty * g.tbsp;
    if (g.cup) return (ml / VOL.cup) * g.cup;
    if (g.tbsp) return (ml / VOL.tbsp) * g.tbsp;
    if (g.tsp) return (ml / VOL.tsp) * g.tsp;
    return food ? null : ml; // unknown food: assume water-like density
  }
  if (unit === 'dozen') return g.each ? qty * 12 * g.each : null;
  if (unit === 'each') return g.each ? qty * g.each : null;
  if (CONTAINERS.has(unit)) return g.pk ? qty * g.pk : (g.can && (unit === 'jar' || unit === 'bottle') ? qty * g.can : null);
  if (unit === 'can') return qty * (g.can || g.pk || UNIT_DEFAULT_G.can);
  if (unit === 'serving') return food?.serv ? qty * food.serv : null;
  const per = g[unit] ?? UNIT_DEFAULT_G[unit] ?? g.each;
  return per ? qty * per : null;
}

/** Convert grams back into a unit for a food. Returns null if unknown. */
export function fromGrams(grams, unit, food) {
  const one = toGrams(1, unit, food);
  return one ? grams / one : null;
}

/** Convert between any two units for a food (via grams). Returns null when impossible. */
export function convert(qty, from, to, food) {
  if (from === to) return qty;
  if (from in WT && to in WT) return (qty * WT[from]) / WT[to];
  if (from in VOL && to in VOL) return (qty * VOL[from]) / VOL[to];
  const g = toGrams(qty, from, food);
  return g == null ? null : fromGrams(g, to, food);
}

const FRACTIONS = { '½': '1/2', '⅓': '1/3', '⅔': '2/3', '¼': '1/4', '¾': '3/4', '⅛': '1/8', '⅜': '3/8', '⅝': '5/8', '⅞': '7/8' };
const NUM = '(?:\\d+\\s+\\d+\\/\\d+|\\d+\\/\\d+|\\d*\\.\\d+|\\d+)';

/** "1 1/2" -> 1.5, "2-3" -> 2.5, "½" -> 0.5 */
export function parseQty(str) {
  if (typeof str === 'number') return str;
  let s = String(str || '').replace(/[½⅓⅔¼¾⅛⅜⅝⅞]/g, (c) => ' ' + FRACTIONS[c]).trim();
  const one = (t) => {
    t = t.trim();
    let m;
    if ((m = t.match(/^(\d+)\s+(\d+)\/(\d+)$/))) return +m[1] + m[2] / m[3];
    if ((m = t.match(/^(\d+)\/(\d+)$/))) return m[1] / m[2];
    return parseFloat(t) || 0;
  };
  const range = s.match(new RegExp(`^(${NUM})\\s*(?:-|–|to)\\s*(${NUM})`));
  if (range) return (one(range[1]) + one(range[2])) / 2;
  const m = s.match(new RegExp(`^${NUM}`));
  return m ? one(m[0]) : 0;
}

/** Parse "1 1/2 cups shredded cheddar, divided" -> { qty: 1.5, unit: 'cup', name: 'shredded cheddar' } */
export function parseIngredient(raw) {
  let s = String(raw || '').replace(/[½⅓⅔¼¾⅛⅜⅝⅞]/g, (c) => ' ' + FRACTIONS[c]).replace(/\s+/g, ' ').trim();
  s = s.replace(/^(about|approx\.?|approximately|around)\s+/i, '');
  let qty = 0, unit = '';
  const qm = s.match(new RegExp(`^(${NUM}(?:\\s*(?:-|–|to)\\s*${NUM})?)\\s*`));
  if (qm) { qty = parseQty(qm[1]); s = s.slice(qm[0].length); }
  // "1 (14.5 oz) can ..." -> drop the parenthetical size
  s = s.replace(/^\([^)]*\)\s*/, '');
  // attached or separate unit word(s)
  let words = s.split(' ');
  while (words.length && SIZE_WORDS.has(words[0].toLowerCase())) words.shift();
  const two = (words[0] + ' ' + (words[1] || '')).toLowerCase().replace(/\./g, '');
  const first = (words[0] || '').toLowerCase().replace(/[.,]/g, '');
  if (two === 'fl oz' || two === 'fluid ounces' || two === 'fluid ounce') { unit = 'fl oz'; words = words.slice(2); }
  else if (ALIASES[first] && words.length > 1) { unit = ALIASES[first]; words.shift(); }
  else if (ALIASES[first] && qty) { unit = ALIASES[first]; words.shift(); }
  if (words[0] && words[0].toLowerCase() === 'of') words.shift();
  while (words.length > 1 && SIZE_WORDS.has(words[0].toLowerCase())) words.shift();
  let name = words.join(' ').replace(/\([^)]*\)/g, '').split(',')[0].trim();
  if (qty && !unit) unit = 'each';
  return { qty, unit, name: name || String(raw).trim(), raw: String(raw).trim() };
}

/** Friendly number: 1.5 -> "1 1/2", 0.333 -> "1/3", 2.27 -> "2.27" */
export function fmtQty(n) {
  if (n == null || isNaN(n)) return '';
  const whole = Math.floor(n + 1e-9), frac = n - whole;
  if (frac < 0.03) return String(whole);
  if (frac > 0.97) return String(whole + 1);
  const table = [[1 / 8, '1/8'], [1 / 4, '1/4'], [1 / 3, '1/3'], [1 / 2, '1/2'], [2 / 3, '2/3'], [3 / 4, '3/4']];
  for (const [v, t] of table) if (Math.abs(frac - v) < 0.03) return (whole ? whole + ' ' : '') + t;
  return String(Math.round(n * 100) / 100);
}

const PLURAL = { cup: 'cups', clove: 'cloves', slice: 'slices', can: 'cans', bunch: 'bunches', head: 'heads', stick: 'sticks',
  stalk: 'stalks', ear: 'ears', fillet: 'fillets', link: 'links', sprig: 'sprigs', leaf: 'leaves', pinch: 'pinches',
  package: 'packages', packet: 'packets', bag: 'bags', box: 'boxes', jar: 'jars', bottle: 'bottles', container: 'containers',
  carton: 'cartons', loaf: 'loaves', serving: 'servings', gallon: 'gallons', quart: 'quarts', pint: 'pints', handful: 'handfuls' };

/** "1 1/2 cups", "2 lb", "3" (each has no unit word). */
export function fmtAmount(qty, unit) {
  if (!qty) return '';
  const metric = unit === 'g' || unit === 'ml';
  const num = metric ? String(Math.round(qty)) : (unit in WT || unit === 'l' ? String(Math.round(qty * 100) / 100) : fmtQty(qty));
  if (!unit || unit === 'each') return num;
  return `${num} ${qty > 1.01 && PLURAL[unit] ? PLURAL[unit] : unit}`;
}

const roundTo = (n, step) => Math.max(step, Math.round(n / step) * step);

/**
 * Scale an ingredient amount by a factor and round it to something you can actually measure.
 * Returns { qty, unit, note } - note explains awkward cases such as half an egg.
 */
export function scaleAmount(qty, unit, factor, foodKey) {
  if (!qty) return { qty: 0, unit, note: '' };
  let q = qty * factor, note = '';
  if (unit === 'tsp' || unit === 'tbsp' || unit === 'cup') {
    const tsp = (q * VOL[unit]) / VOL.tsp;
    if (tsp < 3) return { qty: roundTo(tsp, tsp < 1 ? 0.125 : 0.25), unit: 'tsp', note };
    if (tsp < 12) return { qty: roundTo(tsp / 3, 0.5), unit: 'tbsp', note };
    const cups = tsp / 48;
    const opts = [0.25, 1 / 3, 0.5, 2 / 3, 0.75, 1];
    const whole = Math.floor(cups), frac = cups - whole;
    let best = 0, bestD = frac; // 0 = round down to whole
    for (const o of opts) if (Math.abs(frac - o) < bestD) { best = o; bestD = Math.abs(frac - o); }
    return { qty: Math.max(0.25, whole + best), unit: 'cup', note };
  }
  if (unit === 'each' || unit === 'dozen') {
    if (unit === 'dozen') { q *= 12; unit = 'each'; }
    if (foodKey === 'eggs') {
      const whole = Math.floor(q + 0.05), frac = q - whole;
      if (frac > 0.2 && frac < 0.8) note = whole ? `or ${whole} large + 1 small` : 'use 1 small egg';
      return { qty: Math.max(1, frac > 0.2 ? whole + 1 : whole), unit, note };
    }
    return { qty: roundTo(q, 0.5), unit, note };
  }
  if (['clove', 'slice', 'stalk', 'ear', 'fillet', 'link', 'sprig', 'leaf'].includes(unit)) return { qty: Math.max(1, Math.round(q)), unit, note };
  if (unit === 'lb') return q < 1 ? { qty: Math.max(1, Math.round(q * 16)), unit: 'oz', note } : { qty: roundTo(q, 0.25), unit, note };
  if (unit === 'oz') return q >= 16 ? { qty: roundTo(q / 16, 0.25), unit: 'lb', note } : { qty: roundTo(q, 0.5), unit, note };
  if (unit === 'g' || unit === 'ml') return { qty: q < 50 ? Math.max(1, Math.round(q)) : roundTo(q, 5), unit, note };
  if (CONTAINERS.has(unit) || unit === 'can' || unit === 'bunch' || unit === 'head' || unit === 'stick' || unit === 'loaf')
    return { qty: roundTo(q, unit === 'stick' ? 0.25 : 0.5), unit, note };
  return { qty: Math.round(q * 100) / 100, unit, note };
}

/** Round a quantity up to a sensible amount to buy in the store. */
export function roundUpToBuy(qty, unit) {
  if (unit === 'lb') return Math.max(0.25, Math.ceil(qty * 4 - 1e-6) / 4);
  if (unit === 'gallon') return Math.max(0.5, Math.ceil(qty * 2 - 1e-6) / 2);
  if (unit === 'oz' || unit === 'g') return Math.ceil(qty);
  return Math.max(1, Math.ceil(qty - 1e-6));
}
