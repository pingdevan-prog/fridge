// Builds js/data/food-vectors.bin + .json: a "picture description" for every food name in the ingredient list,
// made with MobileCLIP's text model, so the phone only needs the image model to recognize food in photos.
// Run when the ingredient list changes:
//   npm i --no-save @huggingface/transformers@4.3.2   (in any folder)
//   TRANSFORMERS=/path/to/node_modules/@huggingface/transformers/dist/transformers.node.mjs node tools/food-vectors.mjs
import { writeFileSync } from 'node:fs';
const T = await import(process.env.TRANSFORMERS || '@huggingface/transformers');
const { INGREDIENTS } = await import('../js/data/ingredients.js');
const MODEL = 'Xenova/mobileclip_s0';
// Several ways of describing each food, averaged: steadier than any one sentence.
const PROMPTS = process.env.PROMPTS ? JSON.parse(process.env.PROMPTS) : ['a photo of {}, a type of food.'];
const names = INGREDIENTS.map((i) => i.name);
const tok = await T.AutoTokenizer.from_pretrained(MODEL);
const model = await T.CLIPTextModelWithProjection.from_pretrained(MODEL, { dtype: 'fp32' });
const vecs = [];
for (let i = 0; i < names.length; i += 32) {
  const batch = names.slice(i, i + 32);
  const sum = batch.map(() => null);
  for (const p of PROMPTS) {
    const { text_embeds } = await model(tok(batch.map((n) => p.replace('{}', n)), { padding: 'max_length', truncation: true }));
    text_embeds.normalize().tolist().forEach((v, k) => { sum[k] = sum[k] ? sum[k].map((x, d) => x + v[d]) : v; });
  }
  for (const v of sum) { const len = Math.hypot(...v); vecs.push(v.map((x) => x / len)); }
  process.stdout.write(`\r${vecs.length}/${names.length}`);
}
const dim = vecs[0].length, max = vecs.flat().reduce((m, x) => Math.max(m, Math.abs(x)), 0), scale = 127 / max;
const bytes = new Int8Array(vecs.length * dim);
vecs.forEach((v, i) => v.forEach((x, d) => { bytes[i * dim + d] = Math.round(x * scale); }));
writeFileSync(new URL(process.env.OUT ? process.env.OUT + '.bin' : '../js/data/food-vectors.bin', import.meta.url), Buffer.from(bytes.buffer));
writeFileSync(new URL(process.env.OUT ? process.env.OUT + '.json' : '../js/data/food-vectors.json', import.meta.url), JSON.stringify({ model: MODEL, dim, scale, names }));
console.log(`\nSaved ${vecs.length} foods x ${dim}`);
