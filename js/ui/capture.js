// Quick ways to add single foods: take a photo of the food, or scan its barcode.
// Both end on the same review screen as receipts, so nothing goes in the fridge unchecked.
import { findFood, tokens } from '../lib/match.js';
import { normUnit } from '../lib/units.js';
import { finishItem } from '../lib/receipt.js';
import { hasAI, aiIdentifyFoods } from '../lib/ai.js';
import { toDataUrl, openReview } from './fridge.js';
import { $, esc, on, openSheet, sheetOf, toast, fields } from './dom.js';

const title = (s) => String(s).replace(/\b\w/g, (c) => c.toUpperCase());
const loadScript = (src) => new Promise((ok, bad) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => bad(new Error('offline')); document.head.appendChild(s); });

// ---------------- Photo of a food ----------------
// Without a Claude key the photo is recognised on the phone by a small image model (MobileNet).
// It knows common whole foods (banana, broccoli, orange, bell pepper, bread) but not packaged products.
const CLASS_TO_FOOD = { 'granny smith': 'apple', ear: 'corn', 'head cabbage': 'cabbage', 'french loaf': 'bread', bagel: 'bread', strawberry: 'strawberries', hotdog: 'sausage', 'ice cream': 'ice cream', pizza: 'frozen pizza' };
const OTHER_FOODS = new Set(['pineapple', 'pomegranate', 'fig', 'artichoke', 'butternut squash', 'acorn squash', 'spaghetti squash', 'pretzel', 'guacamole',
  'mashed potato', 'cheeseburger', 'burrito', 'meat loaf', 'potpie', 'carbonara', 'trifle', 'jackfruit', 'custard apple', 'cardoon', 'bell pepper', 'cucumber', 'zucchini']);
let model = null;

async function recognizeOnDevice(dataUrl) {
  if (!model) {
    if (!window.mobilenet) {
      await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js');
      await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow-models/mobilenet@2.1.1/dist/mobilenet.min.js');
    }
    model = await window.mobilenet.load({ version: 2, alpha: 1.0 });
  }
  const img = await new Promise((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => bad(new Error('That photo could not be opened.')); i.src = dataUrl; });
  for (const p of await model.classify(img, 5)) {
    if (p.probability < 0.2) break;
    for (const word of p.className.toLowerCase().split(', ')) {
      const food = CLASS_TO_FOOD[word] ? { key: CLASS_TO_FOOD[word] } : findFood(word);
      if (food || OTHER_FOODS.has(word)) return { name: title(food ? food.key : word), conf: p.probability };
    }
  }
  return null;
}

on('food-photo', async (el) => {
  const file = el.files?.[0];
  if (!file) return;
  sheetOf(el)?.close();
  let error = '';
  const sheet = openSheet(() => (error
    ? `<div class="empty"><div class="big">😕</div><h2>That did not work</h2><p class="muted">${esc(error)}</p><button class="btn dark" data-act="item-new">Type it in instead</button></div>`
    : `<div class="loading"><div class="spin"></div><h2>Looking at your photo</h2><p class="muted">${hasAI() ? 'Claude is listing the food it can see.' : 'Working out what this is. The first photo takes a little longer.'}</p></div>`));
  try {
    const dataUrl = await toDataUrl(file, hasAI() ? 1500 : 640);
    let items, source;
    if (hasAI()) {
      const found = await aiIdentifyFoods(dataUrl);
      items = found.filter((f) => f && f.name).map((f) => finishItem({ raw: '', name: String(f.name), brand: f.brand || '', qty: Number(f.qty) || 1, unit: f.unit || 'each', category: f.category, conf: Number(f.confidence) || 0.5 }));
      source = 'Seen in your photo by Claude';
      if (!items.length) throw new Error('No food was found in that photo. Try again with the food filling the frame.');
    } else {
      const guess = await recognizeOnDevice(dataUrl);
      if (guess) {
        const food = findFood(guess.name);
        items = [finishItem({ raw: '', name: guess.name, ...(food?.g?.each ? { qty: 1, unit: 'each' } : {}), conf: guess.conf >= 0.6 ? 0.9 : 0.5 })];
        source = 'Recognized on this phone. Check the name and how many you have';
      } else {
        items = [finishItem({ raw: '', name: '', qty: 1, unit: 'each', conf: 0 })];
        source = 'This phone could not tell what that is. Type the name, or use the barcode for packaged food';
      }
    }
    sheet.close();
    openReview(items, source);
  } catch (e) {
    error = e.message === 'offline' ? 'Recognizing photos needs an internet connection the first time.' : e.message || 'Something went wrong with that photo.';
    sheet.refresh();
  }
});

// ---------------- Barcode ----------------
const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e'];
let detector = null;
async function getDetector() {
  if (detector) return detector;
  if ('BarcodeDetector' in window) {
    try { const ok = await window.BarcodeDetector.getSupportedFormats(); if (FORMATS.some((f) => ok.includes(f))) return (detector = new window.BarcodeDetector({ formats: FORMATS.filter((f) => ok.includes(f)) })); } catch { /* fall through */ }
  }
  // iPhone Safari and others: load a small barcode reader on demand.
  const mod = await import('https://cdn.jsdelivr.net/npm/barcode-detector@2.3.1/dist/es/pure.min.js');
  return (detector = new mod.BarcodeDetector({ formats: FORMATS }));
}

const OFF_CATS = [[/beverage|drink|juice|water|soda|coffee|tea/, 'beverages'], [/frozen/, 'frozen'], [/dair|cheese|milk|yogurt|butter|cream/, 'dairy'], [/meat|poultry|sausage|ham/, 'meat'],
  [/seafood|fish/, 'seafood'], [/bread|baker|tortilla/, 'bakery'], [/snack|chip|cracker|cookie|candy|chocolate|biscuit/, 'snacks'], [/canned|sauce|soup|condiment/, 'canned'],
  [/spice|seasoning|herb/, 'spices'], [/fruit|vegetable|produce/, 'produce'], [/cereal|pasta|rice|grain|flour|legume|bean|nut/, 'pantry']];

/** Look a barcode up in Open Food Facts (a free, open product database) and turn it into a review item. */
async function lookupBarcode(code) {
  let p = null;
  try {
    const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=product_name,brands,quantity,product_quantity,nutriments,categories_tags`);
    if (res.ok) { const j = await res.json(); if (j.status === 1 || j.product?.product_name) p = j.product; }
  } catch { throw new Error('Could not reach the product database. Check your internet connection.'); }
  if (!p || !p.product_name) {
    const item = finishItem({ raw: `Barcode ${code}`, name: '', qty: 1, unit: 'each', conf: 0 });
    return { item, source: `Barcode ${code} is not in the product database yet. Type what it is` };
  }
  const brand = String(p.brands || '').split(',')[0].trim();
  let name = String(p.product_name).trim();
  if (name.length > 48) name = name.slice(0, 48).replace(/\s+\S*$/, ''); // cut long names at a word
  name = title(name);
  if (brand && name.toLowerCase().startsWith(brand.toLowerCase())) name = name.slice(brand.length).trim() || name;
  let qty = 1, unit = 'package';
  const m = String(p.quantity || '').match(/(\d+(?:[.,]\d+)?)\s*(fl\.?\s*oz|oz|lbs?|kg|g|ml|cl|l|gal(?:lon)?|ct|count)\b/i);
  if (m) {
    qty = parseFloat(m[1].replace(',', '.'));
    const u = m[2].toLowerCase().replace(/\./g, '').replace(/\s+/g, ' ');
    if (u === 'cl') { qty *= 10; unit = 'ml'; } else unit = u.startsWith('fl') ? 'fl oz' : normUnit(u);
  } else if (Number(p.product_quantity) > 0) { qty = Number(p.product_quantity); unit = 'g'; }
  const cats = (p.categories_tags || []).join(' ');
  // Only treat it as a basic ingredient (milk, rice, eggs) when the name is simple. A "peanut noodle kit" is its own thing.
  const basic = findFood(name), simple = basic && tokens(name).length <= tokens(basic.key).length + 2;
  const category = (simple && basic.cat) || OFF_CATS.find(([re]) => re.test(cats))?.[1] || 'other';
  const item = finishItem({ raw: `Barcode ${code}`, name, brand, qty, unit, category, conf: 0.9, noFood: !simple });
  const n = p.nutriments || {};
  if (n['energy-kcal_100g'] != null) {
    item.nutrition = { per: '100 g', kcal: Math.round(n['energy-kcal_100g']), protein: Math.round(n.proteins_100g || 0), carbs: Math.round(n.carbohydrates_100g || 0),
      fat: Math.round(n.fat_100g || 0), fiber: Math.round(n.fiber_100g || 0), source: `Open Food Facts, barcode ${code}` };
  }
  return { item, source: 'Found by barcode in Open Food Facts. Check the name and amount' };
}

async function handleCode(code, sheet) {
  sheet?.ctx?.stop?.();
  sheet?.close();
  const wait = openSheet(() => `<div class="loading"><div class="spin"></div><h2>Looking up ${esc(code)}</h2><p class="muted">Checking the product database.</p></div>`);
  try {
    const { item, source } = await lookupBarcode(code);
    wait.close();
    openReview([item], source);
  } catch (e) { wait.close(); toast(e.message); }
}

on('barcode-open', (el) => {
  sheetOf(el)?.close();
  let status = 'Starting the camera…', stream = null, timer = null, stopped = false;
  const sheet = openSheet(() => `<h2>Scan a barcode</h2><p class="sub" id="bc-status">${esc(status)}</p>
    <video id="bc-video" playsinline muted style="width:100%;border-radius:18px;background:#000;margin-top:12px;aspect-ratio:4/3;object-fit:cover"></video>
    <div class="stack" style="margin-top:12px">
      <label class="btn soft block">Use a photo of the barcode<input type="file" accept="image/*" capture="environment" hidden data-change="barcode-photo"></label>
      <form class="rowf" onsubmit="return false"><input class="input grow" name="code" inputmode="numeric" placeholder="Or type the numbers under the bars" aria-label="Barcode numbers"><button class="btn" data-act="barcode-typed">Look up</button></form>
    </div>`, { onClose: () => stop() });
  const say = (text) => { status = text; const s = $('#bc-status', sheet.body); if (s) s.textContent = text; };
  function stop() { stopped = true; clearInterval(timer); stream?.getTracks().forEach((t) => t.stop()); stream = null; }
  sheet.ctx = { stop };
  (async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('nocam');
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      if (stopped) return stop();
      const video = $('#bc-video', sheet.body);
      video.srcObject = stream;
      await video.play();
      const det = await getDetector();
      say('Point the camera at the barcode.');
      let working = false;
      timer = setInterval(async () => {
        if (working || stopped || video.readyState < 2) return;
        working = true;
        try {
          const hit = (await det.detect(video)).find((c) => /^\d{8,14}$/.test(c.rawValue));
          if (hit && !stopped) { navigator.vibrate?.(80); handleCode(hit.rawValue, sheet); }
        } catch { /* keep trying */ }
        working = false;
      }, 300);
    } catch (e) {
      say(e.name === 'NotAllowedError' ? 'The camera is blocked. Allow camera access, or use a photo or the numbers below.' : 'The live camera is not available here. Use a photo of the barcode or type the numbers below.');
    }
  })();
});
on('barcode-typed', (el) => {
  const sheet = sheetOf(el), code = (fields(sheet.body).code || '').replace(/\D/g, '');
  if (code.length < 8) { toast('A barcode has 8 to 14 digits.'); return; }
  handleCode(code, sheet);
});
on('barcode-photo', async (el) => {
  const file = el.files?.[0], sheet = sheetOf(el);
  if (!file) return;
  try {
    const dataUrl = await toDataUrl(file, 1600);
    const img = await new Promise((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = bad; i.src = dataUrl; });
    const hit = (await (await getDetector()).detect(img)).find((c) => /^\d{8,14}$/.test(c.rawValue));
    if (hit) handleCode(hit.rawValue, sheet); else toast('No barcode found in that photo. Get closer and keep it sharp, or type the numbers.');
  } catch { toast('That photo could not be read. Try again or type the numbers.'); }
});
