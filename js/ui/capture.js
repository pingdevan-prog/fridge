// Photo of food: take one photo (or pick several) of a drawer, shelf or counter and every food found
// goes to the review screen, so nothing goes in the fridge unchecked.
//
// With a Claude key, Claude reads the photo (recognizes packaged foods and reads labels).
// Without one, two small image models run on the phone itself:
//   1. an object finder (COCO-SSD lite) that finds and counts bananas, apples, oranges, broccoli, carrots...
//   2. a food classifier (MobileNet) run over the whole photo and over overlapping squares of it,
//      for produce the object finder does not know (lemons, pineapples, peppers, cabbage, squash...).
import { findFood } from '../lib/match.js';
import { finishItem } from '../lib/receipt.js';
import { hasAI, aiIdentifyFoods } from '../lib/ai.js';
import { toDataUrl, openReview } from './fridge.js';
import { esc, on, openSheet, sheetOf } from './dom.js';

const title = (s) => String(s).replace(/\b\w/g, (c) => c.toUpperCase());
const loadScript = (src) => new Promise((ok, bad) => {
  if ([...document.scripts].some((s) => s.src === src)) return ok();
  const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => bad(new Error('offline')); document.head.appendChild(s);
});

const CLASS_TO_FOOD = { 'granny smith': 'apple', ear: 'corn', 'head cabbage': 'cabbage', 'french loaf': 'bread', bagel: 'bread', strawberry: 'strawberries', hotdog: 'sausage', 'ice cream': 'ice cream', pizza: 'frozen pizza' };
const OTHER_FOODS = new Set(['pineapple', 'pomegranate', 'fig', 'artichoke', 'butternut squash', 'acorn squash', 'spaghetti squash', 'pretzel', 'guacamole',
  'jackfruit', 'custard apple', 'bell pepper', 'cucumber', 'zucchini', 'mushroom', 'lemon', 'orange', 'banana', 'broccoli', 'cauliflower']);
const COCO_FOOD = { banana: 'Banana', apple: 'Apple', orange: 'Orange', broccoli: 'Broccoli', carrot: 'Carrot', sandwich: 'Sandwich', 'hot dog': 'Hot dog', pizza: 'Pizza', donut: 'Donut', cake: 'Cake' };
const DETECT_MIN = 0.4;
const LOOKALIKE = { Zucchini: ['Banana'], Cucumber: ['Banana'], 'Butternut Squash': ['Banana'], 'Acorn Squash': ['Orange', 'Apple'], Fig: ['Apple'], Pomegranate: ['Apple', 'Orange'] };  // object finder: lowest score that counts as a find
let models = null;

/** Load the two on-device models once. Falls back to the slower CPU engine if the phone's graphics engine fails. */
function loadModels(onStage = () => {}) {
  if (!models) models = (async () => {
    onStage('Downloading the food recognizer (one time only, about 20 MB)…');
    if (!window.tf) await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js');
    await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd@2.2.3/dist/coco-ssd.min.js');
    await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow-models/mobilenet@2.1.1/dist/mobilenet.min.js');
    try { if (!(await window.tf.setBackend('webgl'))) throw new Error('no webgl'); } catch { await window.tf.setBackend('cpu'); }
    await window.tf.ready();
    // One at a time keeps peak memory low on phones.
    const det = await window.cocoSsd.load({ base: 'lite_mobilenet_v2' });
    const net = await window.mobilenet.load({ version: 2, alpha: 1.0 });
    return { det, net };
  })().catch((e) => { models = null; throw e; });
  return models;
}

const loadImage = (src) => new Promise((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => bad(new Error('That photo could not be opened. Try taking it again.')); i.src = src; });

/** Find every food in a photo. Returns [{ name, count, conf }]. */
export async function recognizeOnDevice(dataUrl, onStage = () => {}, debug = null) {
  const { det, net } = await loadModels(onStage);
  onStage('Looking for food…');
  const img = await loadImage(dataUrl);
  const found = new Map(); // name -> { count, conf, counted, tiles }
  const get = (name) => found.get(name) || found.set(name, { count: 0, conf: 0, counted: false, det: 0, tiles: 0, whole: 0 }).get(name);

  // 1. Find and count objects.
  let hits;
  try { hits = await det.detect(img, 40, DETECT_MIN); }
  catch { await window.tf.setBackend('cpu'); hits = await det.detect(img, 40, DETECT_MIN); }
  for (const p of hits) if (COCO_FOOD[p.class]) { const f = get(COCO_FOOD[p.class]); f.count++; f.counted = true; f.det = Math.max(f.det, p.score); f.conf = Math.max(f.conf, p.score); }

  // 2. Classify the whole photo and overlapping squares.
  const crop = document.createElement('canvas'); crop.width = crop.height = 224;
  const g = crop.getContext('2d'), W = img.width, H = img.height, N = 3, tw = W / N, th = H / N;
  const tiles = [];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) tiles.push([x * tw, y * th, tw, th]);
  for (let y = 0; y < N - 1; y++) for (let x = 0; x < N - 1; x++) tiles.push([x * tw + tw / 2, y * th + th / 2, tw, th]);
  const classifyArea = async ([x, y, w, h], whole) => {
    g.drawImage(img, x, y, w, h, 0, 0, 224, 224);
    for (const p of await net.classify(crop, 3)) {
      if (p.probability < 0.25) continue;
      for (const word of p.className.toLowerCase().split(', ')) {
        const food = CLASS_TO_FOOD[word] ? { key: CLASS_TO_FOOD[word] } : findFood(word);
        if (!food && !OTHER_FOODS.has(word)) continue;
        const f = get(title(food ? food.key : word));
        if (whole) f.whole = Math.max(f.whole, p.probability); else if (p.probability >= 0.35) f.tiles++;
        f.conf = Math.max(f.conf, p.probability);
        break;
      }
    }
  };
  await classifyArea([0, 0, W, H], true);
  for (const t of tiles) await classifyArea(t, false);

  if (debug) debug.found = Object.fromEntries([...found].map(([k, f]) => [k, { ...f, conf: +f.conf.toFixed(2), whole: +f.whole.toFixed(2) }]));
  // 3. Keep a food when the object finder counted it, the whole-photo look saw it, or several squares agree.
  //    A food seen in just one square needs to be a strong match (close-ups of one food often look like another).
  //    A weak object find needs a second opinion from the classifier.
  const keep = new Map([...found].filter(([, f]) => (f.counted && (f.det >= 0.5 || f.tiles >= 1 || f.whole >= 0.3)) || f.whole >= 0.3 || f.tiles >= 2 || (f.tiles === 1 && f.conf >= 0.75)));
  // 4. Drop look-alikes seen only up close when the real food was found (a banana close-up looks like a zucchini).
  for (const [name, f] of keep) if (!f.counted && f.whole < 0.3 && (LOOKALIKE[name] || []).some((other) => keep.get(other)?.counted)) keep.delete(name);
  return [...keep].map(([name, f]) => ({ name, count: f.counted ? f.count : 1, conf: f.conf })).sort((a, b) => b.conf - a.conf);
}

on('food-photo', async (el) => {
  const files = [...(el.files || [])];
  el.value = ''; // so choosing the same photo again still triggers
  if (!files.length) return;
  sheetOf(el)?.close();
  let error = '', status = hasAI() ? 'Claude is listing every food it can see.' : 'Getting ready…';
  const sheet = openSheet(() => (error
    ? `<div class="empty"><h2>That did not work</h2><p class="muted">${esc(error)}</p>
        <div class="stack"><label class="btn block">Try another photo<input type="file" accept="image/*" capture="environment" hidden data-change="food-photo"></label>
        <button class="btn ghost block" data-act="item-new">Type it in instead</button></div></div>`
    : `<div class="loading"><div class="spin"></div><h2>Looking at your ${files.length > 1 ? files.length + ' photos' : 'photo'}</h2><p class="muted">${esc(status)}</p></div>`));
  const stage = (s) => { status = s; sheet.refresh(); };
  try {
    const merged = new Map();
    let firstPhoto = null;
    for (const [n, file] of files.entries()) {
      const dataUrl = await toDataUrl(file, hasAI() ? 1500 : 1024);
      if (!firstPhoto) firstPhoto = await toDataUrl(file, 700);
      let found;
      if (hasAI()) {
        if (files.length > 1) stage(`Claude is reading photo ${n + 1} of ${files.length}…`);
        found = (await aiIdentifyFoods(dataUrl)).filter((f) => f && f.name)
          .map((f) => ({ name: String(f.name), brand: f.brand || '', qty: Number(f.qty) || 1, unit: f.unit || 'each', category: f.category, conf: Number(f.confidence) || 0.5 }));
      } else {
        found = (await recognizeOnDevice(dataUrl, (s) => stage(files.length > 1 && s.startsWith('Looking') ? `Looking for food in photo ${n + 1} of ${files.length}…` : s)))
          .map((f) => ({ name: f.name, qty: f.count, unit: 'each', conf: f.conf >= 0.6 ? 0.9 : 0.5 }));
      }
      for (const f of found) { const k = f.name.toLowerCase(); const m = merged.get(k); if (m && m.unit === f.unit) m.qty += f.qty; else if (!m) merged.set(k, f); }
    }
    let items = [...merged.values()].map((f) => finishItem({ raw: '', ...f }));
    let source = hasAI() ? `Claude found ${items.length} ${items.length === 1 ? 'food' : 'foods'}. Remove anything wrong and add anything it missed.`
      : `Found ${items.length} ${items.length === 1 ? 'food' : 'foods'}. Check the names and counts, and add anything it missed.`;
    if (!items.length) {
      items = [finishItem({ raw: '', name: '', qty: 1, unit: 'each', conf: 0 })];
      source = hasAI() ? 'No food was found in that photo. Type what it is below.' : 'No food was recognized. This phone knows fresh fruit and vegetables best. Type what it is below.';
    }
    sheet.close();
    openReview(items, source, files.length === 1 ? firstPhoto : null);
  } catch (e) {
    console.error('Food photo failed', e);
    error = e.message === 'offline' ? 'Recognizing photos needs an internet connection the first time.' : e.message || 'Something went wrong with that photo.';
    sheet.refresh();
  }
});
