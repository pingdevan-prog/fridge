// Family sync: every phone that signs in with the same family name and password shares one fridge.
//
// How it works
// - Every phone keeps a full copy of the data. Sync only passes changes around.
// - The whole data set is encrypted on the phone (AES-GCM, key derived from the family password)
//   and stored as an "application data" note on a few free public relay servers (the Nostr network).
//   The servers only ever see scrambled text. No sign-up and no server of our own is needed.
// - Each record remembers when it last changed, so edits from two phones are merged record by
//   record (the newer change wins) instead of one phone overwriting the other.
import { state, hooks, saveQuiet, notify } from '../store.js';

const CFG_KEY = 'fridge.sync';
const RELAYS = ['wss://nos.lol', 'wss://relay.primal.net', 'wss://nostr.mom', 'wss://relay.snort.social'];
const KIND = 30078, DTAG = 'fridge-family-v1', CHUNK = 45000;
const LISTS = ['members', 'fridge', 'householdItems', 'plan', 'shopping', 'logs', 'ratings']; // arrays of { id }
const MAPS = ['recipes', 'prices', 'brandChecks'];                                               // objects keyed by id
const SETS = ['favorites'];                                                                      // arrays of ids
const OBJS = ['household', 'settings'];                                                          // single objects
const COLLS = [...LISTS, ...MAPS, ...SETS];
const TOMBSTONE_DAYS = 90;

let cfg = null;      // { name, sk, pk, key, lastId, lastAt, dirty, last }
let shadow = {};     // what was last saved, to spot changes: collection -> Map(id -> JSON)
let busy = false, timer = null, poll = null, again = false;
export const syncStatus = { on: false, name: '', state: 'off', last: 0, error: '', relays: 0 };
const loadCfg = () => { try { return JSON.parse(localStorage.getItem(CFG_KEY) || 'null'); } catch { return null; } };
const saveCfg = () => { try { cfg ? localStorage.setItem(CFG_KEY, JSON.stringify(cfg)) : localStorage.removeItem(CFG_KEY); } catch { /* ignore */ } };

// ---------- Change tracking ----------
function entries(src, c) {
  const v = src[c], m = new Map();
  if (LISTS.includes(c)) for (const r of v || []) m.set(r.id, r);
  else if (MAPS.includes(c)) for (const [k, r] of Object.entries(v || {})) m.set(k, r);
  else for (const id of v || []) m.set(id, true);
  return m;
}
function setEntries(c, map) {
  if (LISTS.includes(c)) state[c] = [...map.values()];
  else if (MAPS.includes(c)) state[c] = Object.fromEntries(map);
  else state[c] = [...map.keys()];
}
const snapshotOf = (c) => new Map([...entries(state, c)].map(([id, r]) => [id, JSON.stringify(r)]));
/** Remember the current data as "already seen" (after loading or merging), without marking anything as changed. */
export function resetShadow() {
  shadow = {};
  for (const c of COLLS) shadow[c] = snapshotOf(c);
  for (const o of OBJS) shadow[o] = JSON.stringify(state[o]);
}
/** Before each save: timestamp every record that changed and note every record that was deleted. */
function stampChanges() {
  const now = Date.now();
  const U = (state._u ||= {}), D = (state._d ||= {});
  let changed = false;
  for (const c of COLLS) {
    const cur = snapshotOf(c), prev = shadow[c] || new Map(), u = (U[c] ||= {}), d = (D[c] ||= {});
    for (const [id, json] of cur) if (prev.get(id) !== json) { u[id] = now; delete d[id]; changed = true; }
    for (const id of prev.keys()) if (!cur.has(id)) { d[id] = now; delete u[id]; changed = true; }
    for (const id of Object.keys(d)) if (now - d[id] > TOMBSTONE_DAYS * 864e5) delete d[id];
    shadow[c] = cur;
  }
  for (const o of OBJS) { const json = JSON.stringify(state[o]); if (shadow[o] !== json) { U[o] = now; shadow[o] = json; changed = true; } }
  if (changed && cfg) { cfg.dirty = true; saveCfg(); }
}

/**
 * Merge another phone's data into ours, record by record (newest change wins, deletions respected).
 * Returns { changed: our data changed, ahead: we have something the other copy lacks }.
 */
export function mergeRemote(remote) {
  let changed = false, ahead = false;
  const U = (state._u ||= {}), D = (state._d ||= {}), RU = remote._u || {}, RD = remote._d || {};
  for (const c of COLLS) {
    const L = entries(state, c), R = entries(remote, c);
    const lu = (U[c] ||= {}), ld = (D[c] ||= {}), ru = RU[c] || {}, rd = RD[c] || {};
    const out = new Map(L);
    let touched = false;
    for (const id of new Set([...L.keys(), ...R.keys(), ...Object.keys(ld), ...Object.keys(rd)])) {
      const hasL = L.has(id), hasR = R.has(id), lt = hasL ? lu[id] || 0 : -1, rt = hasR ? ru[id] || 0 : -1;
      const del = Math.max(ld[id] || 0, rd[id] || 0), best = Math.max(lt, rt);
      if (best < 0 || del > best) { // deleted after its last change
        if (hasL) { out.delete(id); touched = true; }
        delete lu[id];
        if (del) ld[id] = del;
        if (hasR || (rd[id] || 0) < del) ahead = true;
      } else {
        delete ld[id];
        if (rt > lt) { out.set(id, R.get(id)); lu[id] = rt; touched = true; } else if (lt > rt) ahead = true;
      }
    }
    if (touched) { setEntries(c, out); changed = true; }
  }
  for (const o of OBJS) {
    const lt = U[o] || 0, rt = RU[o] || 0;
    if (rt > lt && remote[o]) { state[o] = remote[o]; U[o] = rt; changed = true; } else if (lt > rt) ahead = true;
  }
  return { changed, ahead };
}

// ---------- Encryption ----------
const enc = new TextEncoder(), dec = new TextDecoder();
const hex = (b) => [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
const unhex = (s) => new Uint8Array(s.match(/../g).map((h) => parseInt(h, 16)));
const b64 = (bytes) => { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(s); };
const unb64 = (s) => Uint8Array.from(atob(s), (ch) => ch.charCodeAt(0));
const sha256 = async (text) => hex(new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(text))));
const pipe = async (bytes, stream) => new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer());

/** Turn the family name + password into an encryption key and a signing key. */
async function deriveKeys(name, password) {
  const base = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode('fridge-family-sync|' + name), iterations: 250000 }, base, 512));
  return { key: b64(bits.slice(0, 32)), sk: hex(bits.slice(32, 64)) };
}
const aesKey = () => crypto.subtle.importKey('raw', unb64(cfg.key), 'AES-GCM', false, ['encrypt', 'decrypt']);

let noble = null;
const schnorr = async () => (noble ||= (await import('https://esm.sh/@noble/curves@1.8.1/secp256k1')).schnorr);

/** Encrypt our data and wrap it as signed relay events (split into parts if it is large). */
async function seal() {
  let bytes = enc.encode(JSON.stringify(state)), z = 0;
  if (typeof CompressionStream !== 'undefined') { bytes = await pipe(bytes, new CompressionStream('gzip')); z = 1; }
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = b64(new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await aesKey(), bytes)));
  const parts = [];
  for (let i = 0; i < ct.length; i += CHUNK) parts.push(ct.slice(i, i + CHUNK));
  const h = (await sha256(ct)).slice(0, 16), s = await schnorr();
  const at = Math.max(Math.floor(Date.now() / 1000), (cfg.lastAt || 0) + 1);
  const make = async (d, content) => {
    const e = { kind: KIND, created_at: at, tags: [['d', d], ['h', h]], content, pubkey: cfg.pk };
    e.id = await sha256(JSON.stringify([0, e.pubkey, e.created_at, e.kind, e.tags, e.content]));
    e.sig = hex(s.sign(e.id, cfg.sk));
    return e;
  };
  const events = [await make(DTAG, JSON.stringify({ v: 1, z, iv: b64(iv), n: parts.length, h, ct: parts[0] }))];
  for (let i = 1; i < parts.length; i++) events.push(await make(`${DTAG}:${i}`, parts[i]));
  return events;
}
/** Decrypt relay events back into data. Returns null when a multi-part upload is not complete yet. */
async function open(main, extra) {
  const m = JSON.parse(main.content);
  let ct = m.ct;
  for (let i = 1; i < m.n; i++) {
    const part = extra.find((e) => e.tags.some((t) => t[0] === 'd' && t[1] === `${DTAG}:${i}`) && e.tags.some((t) => t[0] === 'h' && t[1] === m.h));
    if (!part) return null;
    ct += part.content;
  }
  let bytes;
  try { bytes = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(m.iv) }, await aesKey(), unb64(ct))); }
  catch { throw new Error('The family data could not be unlocked on this phone.'); }
  if (m.z) {
    if (typeof DecompressionStream === 'undefined') throw new Error('This browser is too old for family sync. Update it and try again.');
    bytes = await pipe(bytes, new DecompressionStream('gzip'));
  }
  return JSON.parse(dec.decode(bytes));
}

// ---------- Relay servers ----------
/** Open one relay, send messages, collect replies until `done` says stop or time runs out. */
function relay(url, messages, onMessage, ms = 7000) {
  return new Promise((resolve) => {
    let ws, finished = false;
    const finish = (ok) => { if (finished) return; finished = true; clearTimeout(t); try { ws.close(); } catch { /* closed */ } resolve(ok); };
    const t = setTimeout(() => finish(false), ms);
    try { ws = new WebSocket(url); } catch { return finish(false); }
    ws.onopen = () => messages.forEach((m) => ws.send(JSON.stringify(m)));
    ws.onmessage = (ev) => { try { if (onMessage(JSON.parse(ev.data))) finish(true); } catch { /* ignore junk */ } };
    ws.onerror = () => finish(false);
    ws.onclose = () => finish(false);
  });
}
/** Newest copy of the family data across all relays: { main, extra } or null if there is none. */
async function fetchLatest() {
  const found = new Map();
  const ok = await Promise.all(RELAYS.map((url) => relay(url, [['REQ', 'fridge', { kinds: [KIND], authors: [cfg.pk] }]], (m) => {
    if (m[0] === 'EVENT' && m[2]?.pubkey === cfg.pk) found.set(m[2].id, m[2]);
    return m[0] === 'EOSE';
  })));
  syncStatus.relays = ok.filter(Boolean).length;
  if (!syncStatus.relays) throw new Error('Could not reach the sync servers. Check your internet connection.');
  const all = [...found.values()].sort((a, b) => b.created_at - a.created_at);
  const main = all.find((e) => e.tags.some((t) => t[0] === 'd' && t[1] === DTAG));
  return main ? { main, extra: all } : null;
}
async function publish(events) {
  const ok = await Promise.all(RELAYS.map((url) => {
    const left = new Set(events.map((e) => e.id));
    return relay(url, events.map((e) => ['EVENT', e]), (m) => { if (m[0] === 'OK' && m[2]) left.delete(m[1]); return m[0] === 'OK' && !left.size; });
  }));
  if (!ok.some(Boolean)) throw new Error('The sync servers did not accept the update. It will try again.');
}

// ---------- The sync loop ----------
/** Pull the family's latest data, merge it with ours, and upload if we have newer changes. */
export async function syncNow() {
  if (!cfg) return;
  if (busy) { again = true; return; }
  busy = true; syncStatus.state = 'syncing'; syncStatus.error = '';
  try {
    const latest = await fetchLatest();
    let ahead = cfg.dirty;
    syncStatus.found = !!latest;
    if (!latest) ahead = true; // nothing stored yet (or it expired): upload our copy
    else if (latest.main.id !== cfg.lastId) {
      const remote = await open(latest.main, latest.extra);
      if (remote) {
        stampChanges();
        const r = mergeRemote(remote);
        ahead = r.ahead;
        if (r.changed) { resetShadow(); saveQuiet(); notify(); }
        cfg.lastId = latest.main.id; cfg.lastAt = latest.main.created_at;
      }
    }
    if (ahead) {
      const events = await seal();
      await publish(events);
      cfg.lastId = events[0].id; cfg.lastAt = events[0].created_at;
    }
    cfg.dirty = false; cfg.last = Date.now();
    syncStatus.state = 'ok'; syncStatus.last = cfg.last;
    saveCfg();
  } catch (e) { syncStatus.state = 'error'; syncStatus.error = e.message || 'Sync failed.'; }
  busy = false;
  document.dispatchEvent(new CustomEvent('fridge-sync'));
  if (again) { again = false; schedule(1500); }
}
function schedule(ms = 3000) { if (!cfg) return; clearTimeout(timer); timer = setTimeout(syncNow, ms); }

function start() {
  Object.assign(syncStatus, { on: true, name: cfg.name, state: 'idle', last: cfg.last || 0 });
  clearInterval(poll);
  poll = setInterval(() => { if (document.visibilityState === 'visible') syncNow(); }, 30000);
  schedule(300);
}

/** Sign this phone in to a family. The same name and password on another phone joins the same data. */
export async function joinFamily(name, password) {
  if (!crypto?.subtle) throw new Error('Family sync needs a secure (https) connection.');
  const clean = name.trim().toLowerCase().replace(/\s+/g, ' ');
  if (clean.length < 3) throw new Error('Pick a family name with at least 3 letters.');
  if (password.length < 8) throw new Error('Use a password with at least 8 characters.');
  const { key, sk } = await deriveKeys(clean, password);
  const s = await schnorr();
  cfg = { name: clean, key, sk, pk: hex(s.getPublicKey(sk)), lastId: '', lastAt: 0, dirty: true, last: 0 };
  saveCfg();
  start();
  await syncNow();
  if (syncStatus.state === 'error') { const msg = syncStatus.error; leaveFamily(); throw new Error(msg); }
  return { found: syncStatus.found };
}
/** Stop syncing on this phone. The data stays on the phone. */
export function leaveFamily() {
  cfg = null; saveCfg();
  clearInterval(poll); clearTimeout(timer);
  Object.assign(syncStatus, { on: false, name: '', state: 'off', last: 0, error: '' });
}

/** Call once at start-up, after the saved data is loaded. */
export function initSync() {
  resetShadow();
  hooks.beforeSave = stampChanges;
  hooks.afterSave = () => { if (cfg?.dirty) schedule(); };
  cfg = loadCfg();
  if (cfg) start();
  document.addEventListener('visibilitychange', () => { if (cfg && document.visibilityState === 'visible') schedule(500); });
  window.addEventListener('online', () => schedule(500));
}
