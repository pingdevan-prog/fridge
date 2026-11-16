// Plain, everyday names for foods read from receipts and labels.
//   "Whole Baby Bella Mushrooms"             -> "Baby bella mushrooms"
//   "Dave's Killer Bread 21 Whole Grain"     -> "Whole grain bread"
//   "Barilla Whole Grain Penne"              -> "Penne pasta"
//   "Sapporo Ichiban Tonkotsu"               -> "Ramen noodles"
// The brand is kept separately (shown small under the item), never in the name.
import { INGREDIENTS } from '../data/ingredients.js';
import { FOODS } from '../data/foods.js';

// Products whose name is mostly a brand: say what they actually are.
const PRODUCT_RULES = [
  [/tonkotsu|ichiban|maruchan|top ramen|cup noodles?|shin ramyun/, 'Ramen noodles'],
  [/ramen bae/, 'Ramen veggie mix'],
  [/oikos|chobani|greek y/, 'Greek yogurt'],
  [/swiss miss|hot cocoa/, 'Hot chocolate mix'],
  [/country cro|shedd|i can.?t believe/, 'Butter spread'],
  [/sun ?chips/, 'Multigrain chips'],
  [/sour patch/, 'Sour Patch Kids'],
  [/peelerz|gumm(y|ies)/, 'Gummy candy'],
  [/palmer|rudolph|hershey|reese|m&m|snickers/, 'Chocolate candy'],
  [/chateau|michelle|indian wells|vineyard|cabernet|merlot|chardonnay|pinot|sauvignon|\bwine\b/, 'Wine'],
  [/fresh gourmet/, 'Crispy salad topping'],
  [/unsweet\w* coconut|coconut flake/, 'Coconut flakes'],
  [/coke zero/, 'Coke Zero'], [/diet coke/, 'Diet Coke'], [/\bcoke\b|coca.?cola/, 'Coca-Cola'], [/sprite/, 'Sprite'], [/dr\.? pepper/, 'Dr Pepper'],
  [/enchilada(\s+s\w*)?\s*$|enchilada s(auce|ce|cl)?\b/, 'Enchilada sauce'],
  [/\bmole\b/, 'Mole sauce'],
  [/baby corn/, 'Baby corn'],
  [/club soda/, 'Club soda'], [/sparkling water|topo chico|la ?croix/, 'Sparkling water'],
  [/grill ?mates|\bseasoning\b.*\bv[aeiou]g|\bv[aeiou]g\w*\b.*\bseasoning\b/, 'Vegetable seasoning'],
  [/sweet potato (bites|tots|fries)/, (m) => `Sweet potato ${m[1]}`],
  [/shower ca(p)?\b/, 'Shower cap'],
  [/(?:^|\s)(?:boneless\s+)?(?:chicken\s+)?thighs?\b/, (m, s) => (/turkey|pork/.test(s) ? null : /bnls|boneless/.test(s) ? 'Boneless chicken thighs' : 'Chicken thighs')],
];

// Product forms that belong at the end of a name ("orange" + "preserves").
const FORMS = new Set(['bites', 'tots', 'fries', 'chips', 'crisps', 'sauce', 'mix', 'spread', 'seasoning', 'preserves', 'jam', 'jelly', 'soda', 'juice', 'bar', 'bars',
  'cookies', 'crackers', 'candy', 'dip', 'dressing', 'soup', 'bread', 'tortillas', 'noodles', 'pasta', 'salsa', 'puree', 'paste', 'broth', 'flakes', 'cereal',
  'enchiladas', 'burritos', 'tacos', 'taquitos', 'tamales', 'nuggets', 'dumplings', 'potstickers', 'meatballs', 'patties', 'burgers', 'strips', 'tenders', 'wings', 'pizza', 'pie', 'bowl', 'bowls']);
// Flavour words: on their own they rarely say what the product is ("Pretzel crisps garlic parmesan").
const FLAVORS = new Set(['garlic', 'parmesan', 'cheddar', 'dill', 'honey', 'maple', 'lime', 'ranch', 'bbq', 'chipotle', 'vanilla', 'cinnamon', 'spicy', 'hot',
  'sweet', 'salted', 'smoked', 'pepper', 'butter', 'chocolate', 'strawberry', 'watermelon', 'mango', 'coconut', 'lemon', 'orange', 'mint', 'sriracha', 'teriyaki']);
// Last words that may be missing on a receipt ("Penne" is still "Penne pasta").
const OPTIONAL_TAIL = new Set(['pasta', 'cheese', 'noodles', 'powder']);
// Words that never belong in a plain name.
const FILLER = new Set(['heb', 'h', 'e', 'b', 'hcf', 'hill', 'country', 'fare', 'central', 'market', 'organics', 'organic', 'select', 'ingredients', 'si', 'natural', 'nat',
  'fresh', 'premium', 'jumbo', 'small', 'large', 'medium', 'bulk', 'fancy', 'bagged', 'whole', 'all', 'the', 'and', 'of', 'with', 'new', 'original', 'classic',
  'family', 'size', 'value', 'pack', 'pk', 'ct', 'oz', 'lb', 'lbs', 'ml', 'antibiotic', 'free', 'nor', 'norwegian', 'abf', 'mild', 'aquadome', 'cloud', 'cloud9',
  'brand', 'style', 'premium', 'slice', 'sliced', 'fs', 'halves', 'pieces', 'tex', 'mex', 'texmex', 'killer', 'daves', 'dkb']);
const BRANDS = ['H-E-B Organics', 'H-E-B Select Ingredients', 'H-E-B', 'Hill Country Fare', 'Central Market Organics', 'Central Market', "Dave's Killer Bread", 'Barilla',
  'Sapporo Ichiban', 'Alexia', 'Ramen Bae', 'Bonne Maman', 'Hatch', 'Old El Paso', 'McCormick', 'Swiss Miss', 'Dannon', 'Oikos', 'Mi Tienda', 'Palmer', 'Amos',
  'Born Farms', 'Banyan', 'White Rock', 'Shedd', 'Country Crock', 'Fresh Gourmet', 'Hoxy', 'Conair', 'Pretzel Crisps', 'Chobani', 'Tillamook', 'Kraft', 'Heinz',
  "Hellmann's", 'Kikkoman', 'Pace', 'Tostitos', 'Mission', 'Guerrero', "Nature's Own", 'Sara Lee', 'Tyson', 'Oscar Mayer', 'Hormel', 'Quaker', "Kellogg's",
  'General Mills', 'Nabisco', 'Ritz', 'Lays', "Lay's", 'Doritos', 'Fritos', 'Cheetos', 'Pringles', 'Blue Bell', 'Borden', 'Fairlife', 'Horizon', 'Daisy',
  'Sargento', 'Philadelphia', "Rao's", 'Prego', 'Ragu', 'Del Monte', 'Green Giant', 'Birds Eye', 'Ore-Ida', "Campbell's", 'Swanson', 'Progresso', 'Nutiva',
  'Bounty', 'Charmin', 'Kleenex', 'Tide', 'Dawn', 'Clorox', 'Lysol', 'Glad', 'Ziploc', 'Reynolds', 'Microban'];

const norm = (s) => String(s || '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9' ]+/g, ' ').replace(/'/g, '').replace(/\s+/g, ' ').trim();
const singular = (w) => (w.length > 3 && w.endsWith('ies') ? w.slice(0, -3) + 'y' : w.length > 3 && w.endsWith('oes') ? w.slice(0, -2) : w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w);
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

let LIST = null;
function list() {
  if (LIST) return LIST;
  const seen = new Set();
  LIST = [];
  const add = (name) => {
    const n = norm(name);
    if (!n || seen.has(n)) return;
    seen.add(n);
    const words = n.split(' ');
    const tail = words.length > 1 && OPTIONAL_TAIL.has(words[words.length - 1]);
    LIST.push({ name: n, words: words.map(singular), required: (tail ? words.slice(0, -1) : words).map(singular) });
  };
  INGREDIENTS.forEach((i) => add(i.name));
  FOODS.forEach((f) => [f.key, ...f.aliases].forEach(add));
  ['baby bella mushrooms', 'whole grain bread', 'sandwich bread', 'penne pasta', 'colby cheese', 'muenster cheese', 'sliced almonds', 'coconut flakes', 'baby corn',
    'mole sauce', 'enchilada sauce', 'butter spread', 'pretzel crisps', 'salmon fillet', 'mexican cheese blend', 'hot chocolate mix', 'sweet potato bites'].forEach(add);
  return LIST;
}

/** The brand at the start of a name, if any. */
export function brandOf(text) {
  const t = norm(text);
  for (const b of BRANDS) if (t.startsWith(norm(b) + ' ') || t === norm(b)) return b;
  return '';
}

const PASTA = new Set(['penne', 'spaghetti', 'rigatoni', 'fettuccine', 'linguine', 'rotini', 'farfalle', 'macaroni', 'orzo', 'ziti', 'angel hair', 'lasagna']);
const CHEESE = new Set(['colby', 'muenster', 'cheddar', 'mozzarella', 'provolone', 'gouda', 'havarti', 'gruyere', 'brie', 'feta', 'swiss', 'monterey jack', 'pepper jack', 'colby jack', 'american']);
const DROP_WORDS = /\b(hass|large|small|medium|jumbo|extra large|xl)\b/g;
/** Last touches: "Penne" -> "Penne pasta", "Colby" -> "Colby cheese", "Large eggs" -> "Eggs", "Hass avocados" -> "Avocados". */
function tidy(name) {
  let n = name.toLowerCase().replace(DROP_WORDS, ' ').replace(/\s+/g, ' ').trim() || name.toLowerCase();
  const bare = n.replace(/^(shredded|sliced|grated) /, '');
  if (PASTA.has(n)) n += ' pasta';
  else if (CHEESE.has(bare)) n += ' cheese';
  return cap(n);
}

/**
 * Plain name for a product. Returns { name, brand }.
 * name is short and generic, brand is the brand that was removed ('' if none).
 */
export function simpleName(text) {
  const r = simpleNameRaw(text);
  return { name: r.name && !/^(Coke Zero|Diet Coke|Sour Patch Kids|Sprite|Dr Pepper|Coca-Cola)$/.test(r.name) ? tidy(r.name) : r.name, brand: r.brand };
}

function simpleNameRaw(text) {
  const raw = String(text || '').trim();
  if (!raw) return { name: '', brand: '' };
  const brand = brandOf(raw);
  const low = norm(raw);
  const pct = raw.match(/\b([12])\s?%\s*(milk)\b/i);
  if (pct) return { name: `${pct[1]}% milk`, brand };
  // 1. Products whose name is mostly a brand.
  for (const [re, out] of PRODUCT_RULES) {
    const m = low.match(re);
    if (!m) continue;
    const name = typeof out === 'function' ? out(m, low) : out;
    if (name) return { name, brand };
  }
  // 2. The longest known food name hidden in the text ("salmon fillet", "mexican cheese blend").
  const words = low.split(' ').filter(Boolean), sw = words.map(singular);
  let best = null, bestScore = -Infinity;
  for (const e of list()) {
    const at = [];
    let ok = true;
    for (const w of e.required) { const i = sw.indexOf(w); if (i < 0) { ok = false; break; } at.push(i); }
    if (!ok || !at.length) continue;
    const full = e.words.every((w) => sw.includes(w));
    const flavorOnly = e.required.every((w) => FLAVORS.has(w));
    const score = e.required.length * 10 + (full ? 3 : 0) - (flavorOnly ? 15 : 0) - Math.min(...at) * 0.1;
    if (score > bestScore) { best = { e, at, full }; bestScore = score; }
  }
  if (best) {
    const { e, at } = best;
    // Keep the shopper's plural ("Avocados") where the list has the singular.
    let name = e.name.split(' ').map((w, k) => { const i = sw.indexOf(singular(w)); return i >= 0 && words[i].length > w.length ? words[i] : w; }).join(' ');
    // Add the product form that comes after the food word ("Orange" + "preserves", "Pretzel" + "crisps").
    const form = words.find((w, i) => FORMS.has(w) && i > Math.max(...at) && !name.split(' ').includes(w));
    if (form) name = e.required.map((w) => { const i = sw.indexOf(w); return i >= 0 ? words[i] : w; }).join(' ') + ' ' + form;
    return { name: cap(name), brand };
  }
  // 3. Nothing recognised: drop the brand and filler words, keep up to three words.
  let rest = low;
  if (brand) rest = rest.slice(norm(brand).length).trim();
  const kept = rest.split(' ').filter((w) => w && !FILLER.has(w) && !/^\d/.test(w) && w.length > 1).slice(0, 3);
  return { name: cap(kept.join(' ') || rest || raw), brand };
}
