// Suggestion dropdown for food names. Any input with data-suggest gets it:
//   data-suggest="food"    all ingredients (for adding food, shopping items, review rows)
//   data-suggest="recipe"  foods in your fridge first, then all ingredients (for recipe ingredients)
// Picking a suggestion fills the input and fires its normal input and change events.
import { state } from '../store.js';
import { INGREDIENTS } from '../data/ingredients.js';
import { FOODS } from '../data/foods.js';
import { esc } from './dom.js';
import { catBadge } from './icons.js';

let pool = null;
function basePool() {
  if (pool) return pool;
  const seen = new Set();
  pool = [];
  for (const i of INGREDIENTS) { seen.add(i.name); pool.push({ name: i.name, cat: i.cat }); }
  // Extra names from the nutrition table, skipping singular/plural twins of names already listed.
  const twin = (n) => seen.has(n + 's') || seen.has(n + 'es') || seen.has(n.replace(/e?s$/, '')) || seen.has(n.replace(/y$/, 'ies'));
  for (const f of FOODS) for (const n of [f.key, ...f.aliases]) if (!seen.has(n) && !twin(n) && n.length > 3) { seen.add(n); pool.push({ name: n, cat: f.cat, extra: true }); }
  return pool;
}

/** Rank a name against what was typed: 0 exact, 1 starts with, 2 every word starts a word, 3 contains. -1 no match. */
function rank(name, q, words) {
  if (name === q) return 0;
  if (name.startsWith(q)) return 1;
  const parts = name.split(/[\s\-/(),]+/);
  if (words.every((w) => parts.some((p) => p.startsWith(w)))) return 2;
  if (q.length >= 3 && name.includes(q)) return 3;
  return -1;
}

export function suggestions(text, mode = 'food', limit = 8) {
  const q = String(text || '').trim().toLowerCase().replace(/\s+/g, ' ');
  if (!q) return [];
  const words = q.split(' ');
  const out = [], seen = new Set();
  if (mode === 'recipe') for (const i of state.fridge) {
    if (i.qty <= 0) continue;
    const n = i.name.toLowerCase();
    if (seen.has(n)) continue;
    seen.add(n);
    const r = rank(n, q, words);
    if (r >= 0) out.push({ name: i.name, value: n, cat: i.leftover ? 'leftovers' : i.category, r: r - 0.6, fridge: true });
  }
  for (const p of basePool()) {
    if (seen.has(p.name)) continue;
    const r = rank(p.name, q, words);
    if (r >= 0) out.push({ name: p.name, value: p.name, cat: p.cat, r: r + (p.extra ? 0.4 : 0) });
  }
  out.sort((a, b) => a.r - b.r || a.name.length - b.name.length || a.name.localeCompare(b.name));
  return out.slice(0, limit);
}

// ---------- The floating list ----------
let box = null, input = null, items = [], active = -1;
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

function highlight(name, q) {
  const i = name.toLowerCase().indexOf(q.trim().toLowerCase());
  if (i < 0 || !q.trim()) return esc(name);
  return esc(name.slice(0, i)) + '<b>' + esc(name.slice(i, i + q.trim().length)) + '</b>' + esc(name.slice(i + q.trim().length));
}
function place() {
  if (!box || !input) return;
  const r = input.getBoundingClientRect(), vh = window.visualViewport?.height || window.innerHeight;
  const below = vh - r.bottom, h = Math.min(box.scrollHeight, 300);
  box.style.left = Math.max(8, r.left) + 'px';
  box.style.width = Math.min(r.width, window.innerWidth - 16) + 'px';
  if (below < h + 12 && r.top > below) { box.style.top = ''; box.style.bottom = (window.innerHeight - r.top + 4) + 'px'; }
  else { box.style.bottom = ''; box.style.top = (r.bottom + 4) + 'px'; }
}
function close() { box?.remove(); box = null; items = []; active = -1; }
function show(el) {
  input = el;
  items = suggestions(el.value, el.dataset.suggest);
  if (!items.length) { close(); return; }
  if (!box) { box = document.createElement('div'); box.className = 'sugg'; box.setAttribute('role', 'listbox'); document.body.appendChild(box); }
  active = -1;
  box.innerHTML = items.map((it, i) => `<button type="button" class="sugg-item" role="option" data-i="${i}">${catBadge(it.cat, it.cat === 'leftovers', 'sm')}<span class="grow">${highlight(cap(it.name), el.value)}</span>${it.fridge ? '<span class="badge green">In fridge</span>' : ''}</button>`).join('');
  place();
}
function choose(i) {
  const it = items[i], el = input;
  if (!it || !el) return;
  el.value = el.dataset.suggest === 'recipe' ? it.value : cap(it.name);
  el.dataset.cat = it.cat;
  close();
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}
function setActive(n) {
  if (!box) return;
  active = (n + items.length) % items.length;
  box.querySelectorAll('.sugg-item').forEach((b, i) => b.classList.toggle('on', i === active));
}

document.addEventListener('input', (e) => { const el = e.target; if (el?.dataset?.suggest && e.isTrusted !== false) show(el); });
document.addEventListener('focusin', (e) => { const el = e.target; if (el?.dataset?.suggest && el.value) show(el); });
document.addEventListener('focusout', (e) => { if (e.target === input) setTimeout(() => { if (document.activeElement !== input) close(); }, 120); });
document.addEventListener('keydown', (e) => {
  if (!box || e.target !== input) return;
  if (e.key === 'ArrowDown') { e.preventDefault(); setActive(active + 1); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(active - 1); }
  else if (e.key === 'Enter' && active >= 0) { e.preventDefault(); choose(active); }
  else if (e.key === 'Escape') close();
});
// pointerdown (not click) so the input does not lose focus and close the list first.
document.addEventListener('pointerdown', (e) => {
  const b = e.target.closest?.('.sugg-item');
  if (b) { e.preventDefault(); choose(Number(b.dataset.i)); }
  else if (box && !e.target.closest?.('.sugg') && e.target !== input) close();
});
window.addEventListener('resize', place);
window.visualViewport?.addEventListener('resize', place);
document.addEventListener('scroll', place, true);
