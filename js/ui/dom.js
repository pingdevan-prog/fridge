// Tiny UI toolkit: event delegation, tab views, bottom sheets, toasts with Undo.
import { ic } from './icons.js';
import { snapshot, restore, commit, subscribe, parseYmd, today, daysBetween } from '../store.js';

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const money = (n) => (n == null ? '' : '$' + Number(n).toFixed(2));
export const num = (n) => Math.round(n).toLocaleString('en-US');
export const cap = (s) => String(s || '').charAt(0).toUpperCase() + String(s || '').slice(1);

// ---- Event delegation: <button data-act="name"> calls on('name', fn) ----
const handlers = {};
export const on = (name, fn) => { handlers[name] = fn; };
const dispatch = (attr) => (e) => {
  const el = e.target.closest?.(`[data-${attr}]`);
  if (el && handlers[el.dataset[attr]]) handlers[el.dataset[attr]](el, e);
};
document.addEventListener('click', dispatch('act'));
document.addEventListener('input', dispatch('input'));
document.addEventListener('change', dispatch('change'));

// ---- Tab views ----
const views = {};
export const ui = { tab: 'fridge', pickFor: null, mealsFilter: null };
export const registerView = (name, render) => { views[name] = render; };
export function render() {
  const view = $('#view');
  if (!views[ui.tab]) return;
  view.innerHTML = views[ui.tab]();
  $$('#tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === ui.tab));
}
export function go(tab) {
  ui.tab = tab;
  render();
  window.scrollTo(0, 0);
}
on('tab', (el) => { if (el.dataset.tab !== 'meals') ui.pickFor = null; go(el.dataset.tab); });
on('go', (el) => go(el.dataset.tab));
subscribe(render);

// ---- Bottom sheets ----
/** Open a sheet. `draw(api)` returns the HTML; call api.refresh() after changing what it shows. */
export function openSheet(draw, opts = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'sheet-wrap' + (opts.full ? ' full' : '');
  wrap.innerHTML = `<div class="sheet-backdrop" data-act="sheet-close"></div>
    <section class="sheet" role="dialog" aria-modal="true"><button class="sheet-x" data-act="sheet-close" aria-label="Close">${ic('x')}</button><div class="sheet-body"></div></section>`;
  const body = $('.sheet-body', wrap), scroller = $('.sheet', wrap);
  const api = {
    el: wrap, body,
    refresh() { const y = scroller.scrollTop; body.innerHTML = draw(api); scroller.scrollTop = y; },
    close() {
      wrap.classList.remove('open');
      setTimeout(() => wrap.remove(), 240);
      opts.onClose?.();
    },
  };
  wrap._api = api;
  body.innerHTML = draw(api);
  $('#sheets').appendChild(wrap);
  requestAnimationFrame(() => requestAnimationFrame(() => wrap.classList.add('open')));
  return api;
}
export const sheetOf = (el) => el.closest('.sheet-wrap')?._api;
on('sheet-close', (el) => sheetOf(el)?.close());
export function closeAllSheets() { $$('#sheets .sheet-wrap').forEach((w) => w._api.close()); }
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { const all = $$('#sheets .sheet-wrap'); all[all.length - 1]?._api.close(); } });

// ---- Toasts ----
export function toast(msg, { undo, ms = 5000 } = {}) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `<span>${esc(msg)}</span>${undo ? '<button>Undo</button>' : ''}`;
  if (undo) $('button', el).onclick = () => { undo(); el.remove(); };
  $('#toasts').appendChild(el);
  setTimeout(() => el.remove(), undo ? Math.max(ms, 7000) : ms);
}
/** Run a change that can be undone from the toast. */
export function withUndo(msg, fn) {
  const snap = snapshot();
  fn();
  commit();
  toast(typeof msg === 'function' ? msg() : msg, { undo: () => { restore(snap); commit(); toast('Undone'); } });
}

/** Read every named input inside an element into an object. */
export function fields(root) {
  const out = {};
  $$('[name]', root).forEach((el) => {
    out[el.name] = el.type === 'checkbox' ? el.checked : el.type === 'number' ? (el.value === '' ? null : Number(el.value)) : el.value.trim();
  });
  return out;
}

// ---- Date wording ----
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const fmtDate = (s) => { const d = parseYmd(s); return `${DAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`; };
export const shortDate = (s) => { const d = parseYmd(s); return `${MONTHS[d.getMonth()]} ${d.getDate()}`; };
/** "Use today", "2 days left", "Expired 3 days ago" */
export function expiryText(expiresAt) {
  const n = daysBetween(today(), expiresAt);
  if (n < -1) return `Expired ${-n} days ago`;
  if (n === -1) return 'Expired yesterday';
  if (n === 0) return 'Use today';
  if (n === 1) return '1 day left';
  return `${n} days left`;
}
export const options = (list, sel) => list.map((o) => { const [v, l] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(v)}"${v === sel ? ' selected' : ''}>${esc(l)}</option>`; }).join('');
