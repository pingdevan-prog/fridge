// Photo of food: take one photo (or pick several) of a drawer, shelf or counter and every food found
// goes to the review screen, so nothing goes in the fridge unchecked.
//
// With a Claude key, Claude reads the photo (recognizes packaged foods and reads labels).
// Without one, everything runs free on the phone:
//   1. MobileCLIP (js/lib/vision.js) compares the photo with every food in the ingredient list.
//      One food in the photo: its best match. A drawer or shelf: the photo is also looked at in squares,
//      and foods that show up clearly (or in more than one square) are kept.
//   2. The label reader reads the words on a package (also sideways) and looks for food names
//      ("CREAM CHEESE" -> Cream cheese). A label name the picture also considered wins, because it is exact.
//   Unsure answers come with the next best guesses, shown as one-tap choices on the review screen.
import { finishItem } from '../lib/receipt.js';
import { readLabel } from '../lib/ocr.js';
import { foodsFromLabel } from '../lib/labels.js';
import { loadVision, describe, rankFoods } from '../lib/vision.js';
import { hasAI, aiIdentifyFoods } from '../lib/ai.js';
import { toDataUrl, openReview } from './fridge.js';
import { esc, on, openSheet, sheetOf } from './dom.js';

const cap = (s) => String(s).charAt(0).toUpperCase() + String(s).slice(1);
const loadImage = (src) => new Promise((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => bad(new Error('That photo could not be opened. Try taking it again.')); i.src = src; });
const SINGLE = 0.3;  // the whole photo matches one food this well: a close-up of one item (a drawer spreads its matches thin)
const TILE = 0.6;    // one square on its own needs to match this well to count
const TILE2 = 0.2;   // ...or two squares agreeing at this level

/**
 * Find every food in a photo. Returns { found: [{ name, conf, alts }], single, top }.
 * single: the photo shows one item (worth reading its label). top: the whole-photo guesses.
 */
export async function recognizeOnDevice(dataUrl, onStage = () => {}, debug = null) {
  onStage('Getting the food recognizer ready…');
  const v = await loadVision((pct) => onStage(`Downloading the food recognizer (one time only): ${pct}%`));
  onStage('Looking for food…');
  const img = await loadImage(dataUrl);
  const canvas = document.createElement('canvas'), g = canvas.getContext('2d');
  const look = async (x, y, w, h) => {
    const k = Math.min(1, 512 / Math.max(w, h));
    canvas.width = Math.round(w * k); canvas.height = Math.round(h * k);
    g.drawImage(img, x, y, w, h, 0, 0, canvas.width, canvas.height);
    return rankFoods(await describe(v, canvas), v.bank, 6);
  };
  const W = img.width, H = img.height;
  const top = await look(0, 0, W, H);
  if (debug) debug.whole = top.map((r) => `${r.name} ${(r.p * 100).toFixed(0)}`);
  const alts = (list, name) => list.filter((r) => r.name !== name && r.p >= 0.03).slice(0, 3).map((r) => cap(r.name));
  if (top[0].p >= SINGLE) return { found: [{ name: cap(top[0].name), conf: top[0].p, alts: top[0].p < 0.8 ? alts(top, top[0].name) : [] }], single: true, top };

  // Several foods (or an unclear photo): look at it in squares too.
  const seen = new Map(); // name -> { best, hits }
  for (const N of [3, 4]) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    onStage(`Looking for food… ${Math.round(((N === 3 ? 0 : 9) + y * N + x + 1) / 25 * 100)}%`);
    const [r] = await look((x * W) / N, (y * H) / N, W / N, H / N);
    const s = seen.get(r.name) || { best: 0, hits: 0 };
    s.best = Math.max(s.best, r.p); if (r.p >= TILE2) s.hits++;
    seen.set(r.name, s);
  }
  if (debug) debug.squares = Object.fromEntries([...seen].map(([k, s]) => [k, `${(s.best * 100).toFixed(0)} x${s.hits}`]));
  const found = [...seen].filter(([, s]) => s.best >= TILE || s.hits >= 2).map(([name, s]) => ({ name: cap(name), conf: s.best, alts: [] }));
  // The whole-photo guess counts when it stands out from the rest, even if no single square was sure.
  const clear = top[0].p >= 0.15 && top[0].p >= 1.8 * top[1].p;
  if (clear && !found.some((f) => f.name.toLowerCase() === top[0].name)) found.push({ name: cap(top[0].name), conf: top[0].p, alts: alts(top, top[0].name) });
  found.sort((a, b) => b.conf - a.conf);
  // One food (or none) found: probably one item after all. Offer the whole-photo guesses as other choices,
  // and never come back empty-handed: the best guess is filled in, marked for a check.
  if (found.length === 1 && !found[0].alts.length) found[0].alts = alts(top, found[0].name.toLowerCase());
  if (!found.length && top[0].p >= 0.08) found.push({ name: cap(top[0].name), conf: Math.min(top[0].p, 0.3), alts: alts(top, top[0].name) });
  return { found, single: found.length <= 1, top };
}

/** Food names read from a package label in the photo. Returns [{ name, conf }]. */
export async function labelFoods(src, onStage = () => {}) {
  onStage('Reading the label…');
  try {
    return foodsFromLabel(await readLabel(src)).map((r) => ({ name: r.name.charAt(0).toUpperCase() + r.name.slice(1), conf: r.score >= 2.5 ? 0.9 : 0.6 }));
  } catch { return []; } // no label reader (offline): the image models' answer still stands
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
    const merged = new Map(), guesses = [];
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
        const say = (s) => stage(files.length > 1 ? `Photo ${n + 1} of ${files.length}: ${s.charAt(0).toLowerCase() + s.slice(1)}` : s);
        const pic = await recognizeOnDevice(dataUrl, say);
        guesses.push(...pic.top.filter((t) => t.p >= 0.03).map((t) => cap(t.name)));
        found = pic.found.map((f) => ({ name: f.name, qty: 1, unit: 'each', conf: f.conf >= 0.5 ? 0.9 : 0.5, alts: f.alts }));
        // One item in the photo: read its label too. A label name the picture also had in mind is exact, so it wins
        // ("cream cheese" over "heavy cream"); so does any label name when the picture had no idea.
        if (pic.single && !(pic.top[0].p >= 0.85)) {
          const label = await labelFoods(file, say);
          const named = label.find((l) => pic.top.some((t) => t.name === l.name.toLowerCase())) || (pic.top[0].p < 0.15 ? label[0] : null);
          if (named) {
            const others = [...new Set([...(found[0] ? [found[0].name] : []), ...pic.top.map((t) => cap(t.name))])].filter((x) => x.toLowerCase() !== named.name.toLowerCase()).slice(0, 3);
            found = [{ name: named.name, qty: 1, unit: 'each', conf: 0.9, alts: others }];
          }
        }
      }
      for (const f of found) { const k = f.name.toLowerCase(); const m = merged.get(k); if (m && m.unit === f.unit) m.qty += f.qty; else if (!m) merged.set(k, f); }
    }
    let items = [...merged.values()].map((f) => Object.assign(finishItem({ raw: '', ...f }), { alts: f.alts || null }));
    let source = hasAI() ? `Claude found ${items.length} ${items.length === 1 ? 'food' : 'foods'}. Remove anything wrong and add anything it missed.`
      : `Found ${items.length} ${items.length === 1 ? 'food' : 'foods'}. Check the names and counts, and add anything it missed.`;
    if (!items.length) {
      items = [Object.assign(finishItem({ raw: '', name: '', qty: 1, unit: 'each', conf: 0 }), { alts: [...new Set(guesses)].slice(0, 4) })];
      source = hasAI() ? 'No food was found in that photo. Type what it is below.' : 'No food was recognized. Try a closer photo with the food filling most of the picture, or type what it is below.';
    }
    sheet.close();
    openReview(items, source, files.length === 1 ? firstPhoto : null);
  } catch (e) {
    console.error('Food photo failed', e);
    error = e.message === 'offline' ? 'Recognizing photos needs an internet connection the first time.' : e.message || 'Something went wrong with that photo.';
    sheet.refresh();
  }
});
