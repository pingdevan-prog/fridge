// Recognizing food in photos on the phone, for free, with MobileCLIP (a small image model from Apple).
// The model turns a photo into a "description" (512 numbers). Every food in the ingredient list has a matching
// description made ahead of time (tools/food-vectors.mjs -> js/data/food-vectors.bin), so recognizing a food is
// just finding the closest descriptions. The image model downloads once (about 23 MB) and is then kept by the browser.
const LIB = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.2/dist/transformers.min.js';
const MODEL = 'Xenova/mobileclip_s0';
const BASE = new URL('../data/', import.meta.url);

let loading = null;
/** Load the image model and the food descriptions once. */
export function loadVision(onProgress = () => {}) {
  if (!loading) loading = (async () => {
    const T = await import(LIB);
    T.env.allowLocalModels = false;
    const seen = new Map();
    const progress_callback = (p) => {
      if (p.status !== 'progress' || !p.total) return;
      seen.set(p.file, [p.loaded, p.total]);
      let a = 0, b = 0; for (const [l, t] of seen.values()) { a += l; b += t; }
      onProgress(Math.round((a / b) * 100));
    };
    const [processor, model, bank] = await Promise.all([
      T.AutoProcessor.from_pretrained(MODEL),
      T.CLIPVisionModelWithProjection.from_pretrained(MODEL, { dtype: 'fp16', device: 'wasm', progress_callback }), // the smaller int8 copy gives wrong answers
      loadBank(),
    ]);
    return { T, processor, model, bank };
  })().catch((e) => { loading = null; throw e; });
  return loading;
}

/** The food descriptions: { names, vecs: Float32Array(n * dim), dim }. */
export async function loadBank(fetcher = (f) => fetch(new URL(f, BASE))) {
  const meta = await (await fetcher('food-vectors.json')).json();
  const raw = new Int8Array(await (await fetcher('food-vectors.bin')).arrayBuffer());
  const vecs = new Float32Array(raw.length);
  for (let i = 0; i < raw.length; i++) vecs[i] = raw[i] / meta.scale;
  return { names: meta.names, vecs, dim: meta.dim };
}

/** Description of one picture (a canvas), as a unit-length Float32Array. */
export async function describe(v, canvas) {
  const image = v.T.RawImage.fromCanvas(canvas);
  const { image_embeds } = await v.model(await v.processor(image));
  const e = image_embeds.data, len = Math.hypot(...e);
  return Float32Array.from(e, (x) => x / len);
}

// Catch-all names ("fruit cups", "salad kit") match any pile of food; the recognizer should name the actual food instead.
const VAGUE = new Set(['fruit cups', 'fruit cocktail', 'frozen fruit', 'salad kit', 'bagged salad', 'mixed greens', 'spring mix', 'frozen vegetables',
  'frozen mixed vegetables', 'frozen stir fry vegetables', 'deli salad', 'trail mix', 'mixed nuts', 'fruit snacks', 'frozen dinners', 'smoothie', 'lunch meat']);

// Names that help the recognizer see a food, but are said more simply.
const FOLD = { 'salsa jar': 'salsa', 'tortilla wraps': 'flour tortillas', 'yogurt cups': 'yogurt', 'drinkable yogurt': 'yogurt', 'bottled water': 'water',
};

/**
 * Foods that best match a picture description: [{ name, p }] best first (p = share of belief, 0..1).
 * "Frozen blueberries" counts toward "blueberries": in a photo they look the same, and fresh is far more common in a fridge.
 */
export function rankFoods(vec, bank, top = 5) {
  const { names, vecs, dim } = bank, logits = new Float32Array(names.length).fill(-Infinity);
  for (let i = 0; i < names.length; i++) {
    if (VAGUE.has(names[i])) continue;
    let s = 0; for (let d = 0; d < dim; d++) s += vec[d] * vecs[i * dim + d];
    logits[i] = 100 * s;
  }
  let max = -Infinity; for (const l of logits) if (l > max) max = l;
  let z = 0; const e = Array.from(logits, (l) => { const v = Math.exp(l - max); z += v; return v; });
  const byName = new Map();
  names.forEach((n, i) => {
    const base = FOLD[n] || (n.startsWith('frozen ') && names.includes(n.slice(7)) ? n.slice(7) : n);
    byName.set(base, (byName.get(base) || 0) + e[i] / z);
  });
  return [...byName].map(([name, p]) => ({ name, p })).sort((a, b) => b.p - a.p).slice(0, top);
}
