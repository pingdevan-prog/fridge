// Optional Claude features (receipt reading, wider web recipe search, checking brands on heb.com).
// They run only when the family adds their own Anthropic API key in Me > Settings. The key is kept
// in this browser only (never in backups, never in the code).
import { state } from '../store.js';

const KEY_API = 'fridge.apikey';
export const getKey = () => { try { return localStorage.getItem(KEY_API) || ''; } catch { return ''; } };
export const setKey = (k) => { try { k ? localStorage.setItem(KEY_API, k.trim()) : localStorage.removeItem(KEY_API); } catch { /* ignore */ } };
export const hasAI = () => !!getKey();

export const MODELS = [
  ['claude-opus-5-5', 'Claude Opus 5.5 (most accurate)'],
  ['claude-sonnet-5-5', 'Claude Sonnet 5.5 (faster, cheaper)'],
  ['claude-haiku-5-5', 'Claude Haiku 5.5 (cheapest)'],
];

let sdk = null;
async function client() {
  if (!sdk) sdk = (await import('https://esm.sh/@anthropic-ai/sdk')).default;
  return new sdk({ apiKey: getKey(), dangerouslyAllowBrowser: true, maxRetries: 2 });
}

/** Turn SDK / network failures into a sentence a family member can act on. */
function friendly(e) {
  const s = e?.status;
  if (s === 401 || s === 403) return new Error('That Claude API key was not accepted. Check it in Me, under Settings.');
  if (s === 429) return new Error('Claude is busy right now. Wait a minute and try again.');
  if (s >= 500) return new Error('Claude had a problem on its side. Try again in a moment.');
  if (s === 400) return new Error('Claude could not process that request. ' + (e.message || ''));
  if (!s) return new Error('Could not reach Claude. Check your internet connection.');
  return e;
}

/** One request to Claude. Returns the text of the reply. */
async function ask({ system, content, tools, effort = 'low', maxTokens = 16000 }) {
  let c;
  try { c = await client(); } catch { throw new Error('Could not load the Claude library. Check your internet connection.'); }
  const base = { model: state.settings.model || 'claude-opus-5-5', max_tokens: maxTokens, system, output_config: { effort }, ...(tools ? { tools } : {}) };
  let useFallbacks = !/haiku/.test(base.model); // server-side refusal fallbacks are not offered on Haiku
  const run = async (messages) => {
    if (useFallbacks) {
      try { return await c.beta.messages.create({ ...base, messages, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' }); }
      catch (e) { if (e?.status !== 400) throw e; useFallbacks = false; }
    }
    return c.messages.create({ ...base, messages });
  };
  const first = [{ role: 'user', content }];
  try {
    let res = await run(first);
    // Server tools (web search) can pause a long turn; send it back to continue.
    for (let i = 0; i < 4 && res.stop_reason === 'pause_turn'; i++) res = await run([...first, { role: 'assistant', content: res.content }]);
    if (res.stop_reason === 'refusal') throw new Error('Claude declined to answer that request.');
    return res.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n');
  } catch (e) { throw friendly(e); }
}

/** Pull the first JSON array/object out of a reply. */
export function extractJSON(text) {
  const s = String(text || '').replace(/```(?:json)?/g, '');
  const start = s.search(/[[{]/);
  if (start < 0) throw new Error('Claude replied in a format the app could not read. Try again.');
  const open = s[start], close = open === '[' ? ']' : '}';
  const end = s.lastIndexOf(close);
  try { return JSON.parse(s.slice(start, end + 1)); } catch { throw new Error('Claude replied in a format the app could not read. Try again.'); }
}

const RECEIPT_SYSTEM = `You read grocery receipts from H-E-B (a Texas grocery chain) for a family kitchen app.
H-E-B receipts use abbreviated all-caps names. Expand every one into a clean, human-readable product name.
Examples: "HEB ORG BNLS CKN BRST" -> brand "H-E-B Organics", name "Boneless Chicken Breast"; "HCF SHRD MOZZ" -> brand "Hill Country Fare", name "Shredded Mozzarella"; "CM" means Central Market.
Rules:
- One entry per purchased product. Use quantity lines such as "2 Ea. @ 1/ 0.64" or "2.36 lbs @ 1 lb / 0.58" for the quantity.
- qty and unit: use the package size when printed (e.g. 16 oz), weight for weighed produce (lb), otherwise a count (each, can, bunch, dozen, gallon, loaf, bag, jar, bottle, package).
- price is the line total in dollars as a number.
- Skip tax, totals, payment lines, bag fees, coupons and discounts.
- Non-food products (paper towels, soap, etc.) get isFood false and category "household".
- category is one of: produce, dairy, meat, seafood, bakery, deli, pantry, canned, frozen, spices, snacks, beverages, household, other.
- confidence is 0 to 1: how sure you are about the expanded name. Use below 0.7 when you are guessing or the print is unclear.
- Never invent items that are not on the receipt.
Reply with ONLY a JSON array, no other text:
[{"raw":"text as printed","brand":"","name":"","qty":1,"unit":"each","price":0.00,"category":"produce","isFood":true,"confidence":0.9}]`;

/** Read a receipt photo with Claude vision. `dataUrl` is a JPEG/PNG data URL. */
export async function aiParseReceipt(dataUrl) {
  const [, mediaType, data] = dataUrl.match(/^data:(image\/[a-z+]+);base64,(.*)$/) || [];
  if (!data) throw new Error('That image could not be read. Try a different photo.');
  const text = await ask({
    system: RECEIPT_SYSTEM, effort: 'low',
    content: [{ type: 'image', source: { type: 'base64', media_type: mediaType, data } }, { type: 'text', text: 'Read every item on this receipt.' }],
  });
  const items = extractJSON(text);
  if (!Array.isArray(items)) throw new Error('Claude replied in a format the app could not read. Try again.');
  return items;
}

const FOOD_PHOTO_SYSTEM = `You look at a photo of food in someone's kitchen (one item, or several on a counter, shelf or in a fridge) for a family kitchen inventory app.
List every distinct food or drink you can clearly see. For each one give:
- name: a short clear name ("Bananas", "2% Milk", "Shredded Cheddar"). brand: only if you can read it on the packaging, otherwise "".
- qty and unit: count for loose produce (unit "each"), the package size if you can read it (16 oz, 1 gallon), otherwise 1 with a unit such as package, bag, jar, bottle, can, box, carton, loaf, bunch, head, dozen.
- category: produce, dairy, meat, seafood, bakery, deli, pantry, canned, frozen, spices, snacks, beverages or other.
- confidence 0 to 1. Use below 0.7 when you are guessing.
Ignore anything that is not food. Never invent items you cannot see.
Reply with ONLY a JSON array: [{"name":"","brand":"","qty":1,"unit":"each","category":"produce","confidence":0.9}]`;

/** Identify the foods in a photo with Claude vision. */
export async function aiIdentifyFoods(dataUrl) {
  const [, mediaType, data] = dataUrl.match(/^data:(image\/[a-z+]+);base64,(.*)$/) || [];
  if (!data) throw new Error('That image could not be read. Try a different photo.');
  const text = await ask({ system: FOOD_PHOTO_SYSTEM, effort: 'low',
    content: [{ type: 'image', source: { type: 'base64', media_type: mediaType, data } }, { type: 'text', text: 'What food is in this photo?' }] });
  const items = extractJSON(text);
  return Array.isArray(items) ? items : [];
}

/** Search the wider web for real recipes. Returns raw recipe objects (see lib/recipes.js fromAI). */
export async function aiFindRecipes({ query, cuisine, mealType, foodType, maxCal, have, avoid }) {
  const want = [query && `matching "${query}"`, cuisine && `${cuisine} cuisine`, mealType && `for ${mealType}`, foodType && `that are ${foodType}`,
    maxCal && `at most ${maxCal} calories per serving`].filter(Boolean).join(', ');
  const text = await ask({
    effort: 'medium',
    tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 6 }],
    system: `You find real recipes on reputable recipe websites for a family of four in Austin, Texas.
Search the web, then reply with ONLY a JSON array of up to 6 recipes that really exist at the URLs you give:
[{"name":"","sourceName":"site name","sourceUrl":"https://...","cuisine":"","mealTypes":["dinner"],"servings":4,"prepMin":10,"cookMin":20,
"ingredients":["1 lb chicken breast","2 tbsp olive oil"],"steps":["short step in your own words"],"caloriesPerServing":null}]
Write the steps briefly in your own words (do not copy text from the site). Set caloriesPerServing only if the page states it, otherwise null.
Never invent a recipe, a site or a URL.`,
    content: `Find recipes ${want || 'the family would enjoy for dinner'}.
Foods we already have (prefer recipes that use them): ${have.join(', ') || 'unknown'}.
Never include: ${avoid.join(', ') || 'no restrictions'}.`,
  });
  const list = extractJSON(text);
  return Array.isArray(list) ? list : [];
}

/** Ask Claude to check on heb.com whether suggested products are really sold there. */
export async function aiVerifyBrands(list) {
  const text = await ask({
    effort: 'low',
    tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: Math.min(12, list.length + 2), allowed_domains: ['heb.com'] }],
    system: `You check whether grocery products are sold at H-E-B by searching heb.com.
For each item, search heb.com for the brand and food. Reply with ONLY a JSON array:
[{"id":"","found":true,"product":"exact product name from heb.com","url":"https://www.heb.com/...","price":null}]
Set found true only when a search result on heb.com clearly shows that brand selling that food. Give price only if the search result shows it, as a number; otherwise null.
Never guess. If you are not sure, use found false.`,
    content: 'Check these:\n' + list.map((x) => `- id ${x.id}: ${x.brand} ${x.food}`).join('\n'),
  });
  const out = extractJSON(text);
  return Array.isArray(out) ? out : [];
}
