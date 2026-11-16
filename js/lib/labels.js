// Finding food names in the words read from a product label ("Nutiva organic virgin coconut oil" -> coconut oil).
import { INGREDIENTS } from '../data/ingredients.js';
import { FOODS } from '../data/foods.js';
import { editDistance } from './receipt.js';

// Words that are on almost every label (nutrition panel, claims), so on their own they say nothing.
const NOISE = new Set(['organic', 'natural', 'fresh', 'water', 'salt', 'sugar', 'sugars', 'oil', 'fat', 'protein', 'sodium', 'calories', 'serving', 'net', 'wt',
  'ingredients', 'contains', 'milk', 'soy', 'wheat', 'egg', 'eggs', 'nuts', 'free', 'gluten', 'non', 'gmo', 'kosher', 'vegan', 'new', 'original', 'classic',
  'flavor', 'flavored', 'taste', 'rich', 'pure', 'real', 'cold', 'pressed', 'whole', 'grain', 'low', 'reduced', 'light', 'premium', 'family', 'size']);

let names = null;
function nameList() {
  if (names) return names;
  const seen = new Set();
  names = [];
  const add = (n) => { n = n.toLowerCase().trim(); if (n.length >= 3 && !seen.has(n)) { seen.add(n); names.push({ name: n, words: n.split(/\s+/).map((w) => w.replace(/[^a-z]/g, '')).filter(Boolean) }); } };
  INGREDIENTS.forEach((i) => add(i.name));
  FOODS.forEach((f) => [f.key, ...f.aliases].forEach(add));
  return names;
}

const sameWord = (a, b) => a === b || (b.length >= 5 && editDistance(a, b, 1) <= 1) || (b.length >= 4 && a === b + 's');

/**
 * Best food names found in label readings. Longer names and bigger print win:
 * "VIRGIN COCONUT OIL" in big letters beats "COCONUT" in "rich coconut taste" in small print.
 * Returns [{ name, score }], best first.
 */
export function foodsFromLabel(readings) {
  const found = new Map();
  const maxH = Math.max(1, ...readings.flat().map((w) => w.h));
  for (const words of readings) {
    const toks = words.map((w) => ({ t: w.text.toLowerCase().replace(/[^a-z]/g, ''), h: w.h })).filter((w) => w.t.length >= 2);
    for (const { name, words: nw } of nameList()) {
      for (let i = 0; i + nw.length <= toks.length; i++) {
        if (!nw.every((w, k) => sameWord(toks[i + k].t, w))) continue;
        const h = nw.reduce((s, _, k) => s + toks[i + k].h, 0) / nw.length / maxH; // 0..1, how big the print is
        if (nw.length === 1 && (NOISE.has(nw[0]) || h < 0.45)) continue;          // a lone common word in small print says little
        const score = nw.length + h * 1.5;
        if (score > (found.get(name) || 0)) found.set(name, score);
      }
    }
  }
  const ranked = [...found].map(([name, score]) => ({ name, score })).sort((a, b) => b.score - a.score);
  // Drop names that are just part of a better one ("coconut" when "coconut oil" was found).
  return ranked.filter((r, i) => !ranked.slice(0, i).some((b) => (' ' + b.name + ' ').includes(' ' + r.name + ' '))).slice(0, 3);
}
