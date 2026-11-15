// Shop tab: smart shopping list grouped by H-E-B section, brand suggestions, sharing.
import { state, commit, save, today } from '../store.js';
import { rebuildShopping, groupedList, listTotals, amountText, addManual, shoppingText, shareLink, brandFor } from '../lib/shopping.js';
import { hasAI, aiVerifyBrands } from '../lib/ai.js';
import { $, esc, on, render as redraw, registerView, openSheet, sheetOf, toast, withUndo, fmtDate, money } from './dom.js';

let verifying = false;
const PREFS = [['value', 'Best value'], ['balanced', 'Balanced'], ['healthiest', 'Healthiest']];

function brandLine(s) {
  const b = brandFor(s);
  if (!b) return '';
  const c = b.check;
  const status = c ? (c.found ? '<span class="badge green">sold at H-E-B</span>' : '<span class="badge">not found on heb.com</span>') : '<span class="badge plain">unverified</span>';
  return `<span class="muted small" style="display:block;margin-top:2px">${esc(b.brand)} ${status}</span>`;
}
const priceText = (s) => (s.estPrice == null ? '' : `${s.priceSource === 'last receipt' ? '' : '~'}${money(s.estPrice)}`);

function render() {
  rebuildShopping(); save();
  const groups = groupedList(), t = listTotals();
  const top = `<div class="top"><div><h1>Shop</h1><p class="sub">${t.count ? `${t.left} of ${t.count} left to get at H-E-B` : 'Your H-E-B shopping list'}</p></div>
    ${t.count ? '<button class="btn sm soft" data-act="shop-share">Share</button>' : ''}</div>`;
  const add = `<form class="rowf" onsubmit="return false"><input class="input grow" id="shop-add" placeholder="Add an item: paper towels, snacks" aria-label="Add an item" enterkeyhint="done" data-change="shop-add-enter"><button class="btn" data-act="shop-add">Add</button></form>`;
  if (!t.count) {
    return `${top}${add}<div class="card empty" style="margin-top:14px"><div class="big">🛒</div><h2>Nothing to buy yet</h2>
      <p class="muted">Plan your meals and anything missing from your fridge shows up here, sorted by store section.</p>
      <button class="btn dark" data-act="go" data-tab="plan">Go to the meal plan</button></div>`;
  }
  return `${top}
    <div class="stack tight">
      <div><p class="field" style="margin-bottom:5px">Brand suggestions</p>
        <div class="seg">${PREFS.map(([k, l]) => `<button class="${state.household.brandPref === k ? 'on' : ''}" data-act="shop-pref" data-p="${k}">${l}</button>`).join('')}</div></div>
      ${add}
    </div>
    ${groups.map((g) => `<section class="sec"><h2>${esc(g.section)}</h2><div class="list">${g.items.map((s) => `<div class="li ${s.checked ? 'done' : ''}">
      <button class="tick ${s.checked ? 'on' : ''}" data-act="shop-check" data-id="${s.id}" aria-label="${s.checked ? 'Uncheck' : 'Check off'} ${esc(s.name)}" aria-pressed="${s.checked}">${s.checked ? '✓' : ''}</button>
      <button class="grow" style="text-align:left" data-act="shop-open" data-id="${s.id}"><span class="nm">${esc(s.name)}</span> <span class="muted">${esc(amountText(s))}</span>${s.checked ? '' : brandLine(s)}</button>
      <span class="small muted">${priceText(s)}</span></div>`).join('')}</div></section>`).join('')}
    <div class="card sec"><div class="rowf"><h2 class="grow">Estimated total</h2><span class="bigno" style="font-size:1.9rem">~$${Math.round(t.total)}</span></div>
      <p class="muted small" style="margin-top:6px">This is a rough estimate from typical grocery prices and your past receipts. It is not H-E-B's actual pricing.${t.unknown ? ` ${t.unknown} ${t.unknown === 1 ? 'item has' : 'items have'} no price estimate.` : ''} Prices marked ~ are estimates.</p></div>
    <div class="stack tight sec">
      ${hasAI() ? `<button class="btn ghost block" data-act="shop-verify" ${verifying ? 'disabled' : ''}>${verifying ? 'Checking heb.com…' : 'Check brands on heb.com with Claude'}</button>` : '<p class="muted small">Brand suggestions are unverified. Open an item to check it on heb.com, or add a Claude API key in Me to check them automatically.</p>'}
      <button class="btn soft block" data-act="scan-open">📷 Back from the store? Scan the receipt</button>
      ${t.count - t.left ? '<button class="btn ghost block" data-act="shop-clear">Remove checked items</button>' : ''}
    </div>`;
}
registerView('shop', render);

on('shop-check', (el) => { const s = state.shopping.find((x) => x.id === el.dataset.id); s.checked = !s.checked; commit(); });
on('shop-pref', (el) => { state.household.brandPref = el.dataset.p; commit(); });
const addFromInput = () => {
  const input = $('#shop-add'), name = input.value.trim();
  if (!name) { input.focus(); return; }
  addManual(name); commit(); toast(`${name} added`);
};
on('shop-add', addFromInput);
on('shop-add-enter', addFromInput);
on('shop-clear', () => withUndo('Checked items removed', () => {
  // Hand-added items are deleted; planned items stay hidden until the plan or fridge changes.
  state.shopping = state.shopping.filter((s) => !s.checked || !s.manual);
  state.shopping.forEach((s) => { if (s.checked) s.hidden = true; });
}));

on('shop-open', (el) => {
  const s = state.shopping.find((x) => x.id === el.dataset.id), b = brandFor(s);
  openSheet(() => `<h2>${esc(s.name)}</h2><p class="sub">Buy ${esc(amountText(s))}${s.note ? ' · ' + esc(s.note) : ''}</p>
    ${s.uses.length ? `<div class="card sec" style="padding:14px"><h3>Needed for</h3>
      <div style="margin-top:4px">${s.uses.map((u) => `<div class="ing"><span class="grow">${esc(u.label)}</span><b>${esc(u.text || 'some')}</b></div>`).join('')}</div>
      <p class="muted small" style="margin-top:8px">${s.uses.length > 1 ? `${s.uses.map((u) => u.text || 'some').join(' + ')}, minus what is already in your fridge = ` : 'After what is already in your fridge: '}<b>${esc(amountText(s))} to buy</b></p></div>` : ''}
    ${b ? `<div class="card sec" style="padding:14px"><h3>Suggested brand</h3>
      <p style="margin-top:6px"><b>${esc(b.brand)}</b> ${b.check ? (b.check.found ? '<span class="badge green">sold at H-E-B</span>' : '<span class="badge">not found on heb.com</span>') : '<span class="badge plain">unverified</span>'}</p>
      <p class="small" style="margin-top:4px">${esc(b.reason)}</p>
      ${b.check?.found ? `<p class="small" style="margin-top:6px">Found on heb.com on ${esc(fmtDate(b.check.date))}: <a class="link" href="${esc(b.check.url)}" target="_blank" rel="noopener">${esc(b.check.product || 'see product')}</a>${b.check.price ? `, listed at ${money(b.check.price)} that day` : ''}.</p>`
        : `<p class="muted small" style="margin-top:6px">${b.check ? `Checked ${esc(fmtDate(b.check.date))}, no clear match.` : 'We have not confirmed that H-E-B sells this exact product.'}</p>`}
      ${b.alt ? `<p class="small" style="margin-top:6px">National brand to compare: <b>${esc(b.alt)}</b> <span class="badge plain">unverified</span></p>` : ''}
      <a class="btn sm soft" style="margin-top:10px" href="${esc(b.searchUrl)}" target="_blank" rel="noopener">Check on heb.com</a></div>` : ''}
    <p class="muted small sec">${s.estPrice == null ? 'No price estimate for this item.' : s.priceSource === 'last receipt' ? `About ${money(s.estPrice)}, based on what you paid on your last scanned receipt.` : `About ${money(s.estPrice)}. This is a rough estimate, not an H-E-B price.`}</p>
    <button class="btn danger block sec" data-act="shop-remove" data-id="${s.id}">Remove from list</button>`);
});
on('shop-remove', (el) => {
  const id = el.dataset.id;
  sheetOf(el).close();
  withUndo('Removed from your list', () => { const s = state.shopping.find((x) => x.id === id); if (s.manual) state.shopping = state.shopping.filter((x) => x.id !== id); else { s.checked = true; s.hidden = true; } });
});

on('shop-verify', async () => {
  const todo = [];
  for (const s of state.shopping) { const b = !s.checked && brandFor(s); if (b && !b.loose && !b.check && !todo.some((t) => t.id === b.key)) todo.push({ id: b.key, brand: b.brand, food: b.food }); }
  if (!todo.length) { toast('Every brand on the list has already been checked.'); return; }
  verifying = true; redraw();
  try {
    const results = await aiVerifyBrands(todo.slice(0, 10));
    let found = 0;
    for (const r of results) {
      if (!todo.some((t) => t.id === r.id)) continue;
      const ok = r.found === true && /^https:\/\/(www\.)?heb\.com\//.test(String(r.url || ''));
      state.brandChecks[r.id] = { found: ok, product: ok ? String(r.product || '') : '', url: ok ? r.url : '', price: ok && Number(r.price) > 0 ? Number(r.price) : null, date: today() };
      if (ok) found++;
    }
    toast(`Checked ${results.length} brands on heb.com. ${found} confirmed.`);
  } catch (e) { toast(e.message); }
  verifying = false; commit();
});

// ---------------- Sharing ----------------
on('shop-share', () => openSheet(() => `<h2>Share the list</h2><p class="sub">Send it to whoever is going to H-E-B.</p>
  <div class="stack" style="margin-top:12px">
    ${navigator.share ? '<button class="btn dark block" data-act="share-native">Share…</button>' : ''}
    <button class="btn block" data-act="share-copy">Copy as text</button>
    <button class="btn soft block" data-act="share-link">Copy a link to the list</button>
    <p class="muted small">The link holds the unchecked items inside it, so it opens on any phone without an account.</p></div>`));
const copy = async (text, msg) => { try { await navigator.clipboard.writeText(text); toast(msg); } catch { openSheet(() => `<h2>Copy this</h2><textarea class="input" style="margin-top:10px;min-height:220px" readonly>${esc(text)}</textarea>`); } };
on('share-copy', (el) => { sheetOf(el).close(); copy(shoppingText(), 'List copied'); });
on('share-link', (el) => { sheetOf(el).close(); copy(shareLink(), 'Link copied'); });
on('share-native', async (el) => { sheetOf(el).close(); try { await navigator.share({ title: 'H-E-B shopping list', text: shoppingText() }); } catch { /* cancelled */ } });

/** A family member opened a shared link: show the list and offer to add it. */
export function openShared(list) {
  const sheet = openSheet(() => `<h2>Shared shopping list</h2><p class="sub">${list.length} items for H-E-B</p>
    <div class="list" style="margin-top:12px">${list.map((s, i) => `<label class="li"><input type="checkbox" style="width:26px;height:26px;accent-color:var(--ink)" data-i="${i}"><span class="grow"><span class="nm">${esc(s.name)}</span> <span class="muted">${esc(s.amount)}</span><br><span class="muted small">${esc(s.section)}</span></span></label>`).join('')}</div>
    <div class="sticky-bar"><button class="btn dark grow" data-act="shared-add">Add these to my list</button></div>`, { full: true, onClose: () => history.replaceState(null, '', location.pathname) });
  sheet.ctx = { list };
}
on('shared-add', (el) => {
  const sh = sheetOf(el);
  for (const s of sh.ctx.list) { const item = addManual(s.name); item.note = s.amount; item.section = s.section; }
  commit(); sh.close(); toast('Added to your shopping list');
});
