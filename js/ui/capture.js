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
let models = null;
const COCO_FOOD = { banana: 'Banana', apple: 'Apple', orange: 'Orange', broccoli: 'Broccoli', carrot: 'Carrot', sandwich: 'Sandwich', 'hot dog': 'Hot dog', pizza: 'Pizza', donut: 'Donut', cake: 'Cake' };

/** Load the two on-device models once (an object finder and a food classifier). */
function loadModels() {
  if (!models) models = (async () => {
    if (!window.tf) await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js');
    await Promise.all([window.mobilenet || loadScript('https://cdn.jsdelivr.net/npm/@tensorflow-models/mobilenet@2.1.1/dist/mobilenet.min.js'),
      window.cocoSsd || loadScript('https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd@2.2.3/dist/coco-ssd.min.js')]);
    try { await window.tf.ready(); } catch { await window.tf.setBackend('cpu'); }
    const [net, det] = await Promise.all([window.mobilenet.load({ version: 2, alpha: 1.0 }), window.cocoSsd.load({ base: 'mobilenet_v2' })]);
    return { net, det };
  })().catch((e) => { models = null; throw e; });
  return models;
}

/** Find every food in a photo: count objects, then look at the photo in overlapping squares for foods the counter misses. */
async function recognizeOnDevice(dataUrl) {
  const { net, det } = await loadModels();
  const img = await new Promise((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => bad(new Error('That photo could not be opened.')); i.src = dataUrl; });
  const found = new Map(); // name -> { count, conf }
  const add = (name, conf, count = 1) => { const f = found.get(name) || { count: 0, conf: 0, counted: false }; f.conf = Math.max(f.conf, conf); found.set(name, f); return f; };
  for (const p of await det.detect(img, 40, 0.35)) if (COCO_FOOD[p.class]) { const f = add(COCO_FOOD[p.class], p.score); f.count++; f.counted = true; }
  const crop = document.createElement('canvas'); crop.width = crop.height = 224;
  const g = crop.getContext('2d'), W = img.width, H = img.height, N = 3, tw = W / N, th = H / N;
  const tiles = [[0, 0, W, H]];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) tiles.push([x * tw, y * th, tw, th]);
  for (let y = 0; y < N - 1; y++) for (let x = 0; x < N - 1; x++) tiles.push([x * tw + tw / 2, y * th + th / 2, tw, th]);
  for (const [x, y, w, h] of tiles) {
    g.drawImage(img, x, y, w, h, 0, 0, 224, 224);
    for (const p of await net.classify(crop, 3)) {
      if (p.probability < 0.3) continue;
      for (const word of p.className.toLowerCase().split(', ')) {
        const food = CLASS_TO_FOOD[word] ? { key: CLASS_TO_FOOD[word] } : findFood(word);
        if (food || OTHER_FOODS.has(word)) { add(title(food ? food.key : word), p.probability); break; }
      }
    }
  }
  return [...found].map(([name, f]) => ({ name, count: f.counted ? f.count : 1, conf: f.conf })).sort((a, b) => b.conf - a.conf);
}

on('photo-warm', () => { if (!hasAI()) loadModels().catch(() => {}); }); // start downloading while the camera is open

on('food-photo', async (el) => {
  const files = [...(el.files || [])];
  if (!files.length) return;
  sheetOf(el)?.close();
  let error = '', status = hasAI() ? 'Claude is listing every food it can see.' : 'Getting the food recognizer ready. The first time takes up to a minute.';
  const sheet = openSheet(() => (error
    ? `<div class="empty"><h2>That did not work</h2><p class="muted">${esc(error)}</p><button class="btn dark" data-act="item-new">Type it in instead</button></div>`
    : `<div class="loading"><div class="spin"></div><h2>Looking at your ${files.length > 1 ? files.length + ' photos' : 'photo'}</h2><p class="muted">${esc(status)}</p></div>`));
  try {
    const merged = new Map();
    for (const [n, file] of files.entries()) {
      const dataUrl = await toDataUrl(file, hasAI() ? 1500 : 1024);
      if (!hasAI()) { await loadModels(); status = files.length > 1 ? `Looking for food in photo ${n + 1} of ${files.length}…` : 'Looking for food…'; sheet.refresh(); }
      const found = hasAI()
        ? (await aiIdentifyFoods(dataUrl)).filter((f) => f && f.name).map((f) => ({ name: String(f.name), brand: f.brand || '', qty: Number(f.qty) || 1, unit: f.unit || 'each', category: f.category, conf: Number(f.confidence) || 0.5 }))
        : (await recognizeOnDevice(dataUrl)).map((f) => ({ name: f.name, qty: f.count, unit: 'each', conf: f.conf >= 0.6 ? 0.9 : 0.5 }));
      for (const f of found) { const k = f.name.toLowerCase(); const m = merged.get(k); if (m && m.unit === f.unit) m.qty += f.qty; else if (!m) merged.set(k, f); }
    }
    let items = [...merged.values()].map((f) => finishItem({ raw: '', ...f }));
    let source = hasAI() ? `Claude found ${items.length} ${items.length === 1 ? 'food' : 'foods'}. Remove anything wrong and add anything missed`
      : `Found ${items.length} ${items.length === 1 ? 'food' : 'foods'} on this phone. Check names and counts, and add anything it missed`;
    if (!items.length) { items = [finishItem({ raw: '', name: '', qty: 1, unit: 'each', conf: 0 })]; source = 'No food was recognized. Type the name, or try again closer and in good light'; }
    sheet.close();
    openReview(items, source);
  } catch (e) {
    error = e.message === 'offline' ? 'Recognizing photos needs an internet connection the first time.' : e.message || 'Something went wrong with that photo.';
    sheet.refresh();
  }
});
