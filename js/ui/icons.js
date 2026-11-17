// Line icons used across the app (24 x 24, drawn with the current text color).
const P = {
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7"/>',
  chevL: '<path d="M15 18l-6-6 6-6"/>',
  chevR: '<path d="M9 6l6 6-6 6"/>',
  camera: '<rect x="3" y="7" width="18" height="13" rx="3"/><path d="M8.5 7l1.5-2.5h4L15.5 7"/><circle cx="12" cy="13.5" r="3.5"/>',
  images: '<rect x="3" y="6" width="15" height="14" rx="2.5"/><path d="M7 3h11a3 3 0 0 1 3 3v11"/><circle cx="8.5" cy="11" r="1.6"/><path d="M18 16l-4-4-8 8"/>',
  receipt: '<path d="M6 3h12v18l-2-1.4-2 1.4-2-1.4-2 1.4-2-1.4L6 21z"/><path d="M9 8h6M9 12h6M9 16h3.5"/>',
  pencil: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
  trash: '<path d="M4 7h16M10 3.5h4M6 7l1 13h10l1-13M10 11v6M14 11v6"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  unlock: '<rect x="5" y="11" width="14" height="10" rx="2.5"/><path d="M8 11V8a4 4 0 0 1 7.6-1.8"/>',
  swap: '<path d="M4.5 10a8 8 0 0 1 13.7-4.2L20 7.5M20 3.5v4h-4M19.5 14a8 8 0 0 1-13.7 4.2L4 16.5M4 20.5v-4h4"/>',
  grip: '<g fill="currentColor" stroke="none"><circle cx="9" cy="6" r="1.4"/><circle cx="15" cy="6" r="1.4"/><circle cx="9" cy="12" r="1.4"/><circle cx="15" cy="12" r="1.4"/><circle cx="9" cy="18" r="1.4"/><circle cx="15" cy="18" r="1.4"/></g>',
  star: '<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.9L12 16.9l-5.2 2.8 1-5.9-4.3-4.1 5.9-.9z"/>',
  heart: '<path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z"/>',
  thumbUp: '<path d="M7.5 11v9h-3v-9zM7.5 11l4-7.5c1.6 0 2.6 1.2 2.3 2.8L13 10.5h5.2a2 2 0 0 1 2 2.4l-1.2 5.6a2 2 0 0 1-2 1.5H7.5"/>',
  thumbDown: '<g transform="rotate(180 12 12)"><path d="M7.5 11v9h-3v-9zM7.5 11l4-7.5c1.6 0 2.6 1.2 2.3 2.8L13 10.5h5.2a2 2 0 0 1 2 2.4l-1.2 5.6a2 2 0 0 1-2 1.5H7.5"/></g>',
  clock: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M9.5 2.5h5"/>',
  utensils: '<path d="M7 3v8M4.5 3v4.5a2.5 2.5 0 0 0 5 0V3M7 11v10M17 3c-2 1.5-3 4-3 7 0 1.5 1 2.5 3 2.5V21"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="16" rx="3"/><path d="M3.5 10h17M8 2.5v4M16 2.5v4"/>',
  cart: '<path d="M2.5 3.5h3l2.2 11h10.6l2.2-8H6.5"/><circle cx="9.5" cy="19" r="1.6"/><circle cx="17" cy="19" r="1.6"/>',
  user: '<circle cx="12" cy="8" r="4.2"/><path d="M4 21c.8-4.2 4-6 8-6s7.2 1.8 8 6"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.6 3.1-5.5 6.5-5.5s5.9 1.9 6.5 5.5M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.8c1.8.8 3 2.5 3.4 5.2"/>',
  sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M18.5 15.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z"/>',
  download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.5v.2"/>',
  book: '<path d="M5 5a2 2 0 0 1 2-2h11v15H7a2 2 0 0 0-2 2z"/><path d="M5 20a2 2 0 0 0 2 1h11v-3"/>',
  share: '<path d="M12 3v12M7.5 7.5L12 3l4.5 4.5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/>',
  fridge: '<rect x="5" y="2.5" width="14" height="19" rx="3"/><path d="M5 9.5h14M9 6v1.5M9 12.5v3"/>',
  alert: '<circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5M12 16.3v.2"/>',
  link: '<path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1"/>',
  cloud: '<path d="M7 18a4.5 4.5 0 0 1-.6-9A6 6 0 0 1 18 8.5a4.8 4.8 0 0 1-.5 9.5z"/>',
  flame: '<path d="M12 21c-4 0-6.5-2.7-6.5-6.3 0-3.7 3-5.6 3.5-9.2 2 1 3 3 3 5 1-.6 1.6-1.8 1.8-3 2.4 1.8 4.7 4.2 4.7 7.3 0 3.6-2.5 6.2-6.5 6.2z"/>',
  // Food categories
  leaf: '<path d="M5 19c0-8.5 5-14 15-14 0 10-5.5 15-14 15z"/><path d="M5 19c3-4.5 6-7 10-9"/>',
  milk: '<path d="M8.5 3h7M9 3v3.2L6.5 10v10a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1V10L15 6.2V3"/><path d="M6.5 13.5h11"/>',
  meat: '<path d="M6.5 7.5C10 4 17.5 4.5 19 9.5s-2.5 10-7.5 10S4 17 4 13.5c0-2.4 1-4.5 2.5-6z"/><circle cx="13" cy="11.5" r="2.3"/>',
  fish: '<path d="M2.5 12c3-4.4 7-6.5 11-6.5 3.5 0 6 2.4 8 6.5-2 4.1-4.5 6.5-8 6.5-4 0-8-2.1-11-6.5zM2.5 12L1 8.5M2.5 12L1 15.5"/><circle cx="16.5" cy="11" r=".8" fill="currentColor"/>',
  bread: '<path d="M6 11.5A3.2 3.2 0 0 1 4.5 5.6C6.2 4.3 9 3.5 12 3.5s5.8.8 7.5 2.1A3.2 3.2 0 0 1 18 11.5V20H6z"/>',
  snow: '<path d="M12 2.5v19M3.8 7.2l16.4 9.6M3.8 16.8l16.4-9.6M9.2 4.2L12 6l2.8-1.8M9.2 19.8L12 18l2.8 1.8"/>',
  jar: '<rect x="6" y="7.5" width="12" height="13.5" rx="2.5"/><path d="M8 3.5h8v4H8zM6 12.5h12"/>',
  shaker: '<path d="M9 3.5h6l1 4.5H8zM8 8h8l.8 12a1 1 0 0 1-1 1H8.2a1 1 0 0 1-1-1z"/><path d="M11 5.5h.01M13 5.5h.01"/>',
  cookie: '<circle cx="12" cy="12" r="8.5"/><path d="M9 9h.01M14.5 10h.01M10 14.5h.01M15 15h.01" stroke-width="2.6"/>',
  cup: '<path d="M6 4h12l-1.6 16a1 1 0 0 1-1 1H8.6a1 1 0 0 1-1-1zM6.5 9h11"/>',
  box: '<path d="M3 7.5L12 3l9 4.5v9L12 21l-9-4.5z"/><path d="M3 7.5l9 4.5 9-4.5M12 12v9"/>',
  bowl: '<path d="M3 11.5h18a9 9 0 0 1-18 0z"/><path d="M9 8c0-1.6 1-2 1-3.5M14 8c0-1.6 1-2 1-3.5"/>',
};

/** An icon as inline SVG. `filled` fills the shape (used for stars and hearts that are on). */
export function ic(name, cls = '', filled = false) {
  return `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true"${filled ? ' fill="currentColor"' : ''}>${P[name] || P.box}</svg>`;
}

// Food category -> icon and tint.
export const CAT_ICON = {
  produce: ['leaf', 'g'], dairy: ['milk', 'b'], meat: ['meat', 'r'], seafood: ['fish', 't'], bakery: ['bread', 'a'], deli: ['bowl', 'o'],
  frozen: ['snow', 'b'], pantry: ['jar', 'a'], canned: ['jar', 'o'], sauces: ['jar', 'r'], grains: ['bowl', 'a'], spices: ['shaker', 'p'], snacks: ['cookie', 'a'], beverages: ['cup', 't'],
  household: ['box', 'n'], leftovers: ['bowl', 'o'], other: ['box', 'n'],
};
/** Round tinted badge with the food category's icon. */
export function catBadge(category, leftover = false, cls = '') {
  const [name, tint] = CAT_ICON[leftover ? 'leftovers' : category] || CAT_ICON.other;
  return `<span class="cat t-${tint} ${cls}">${ic(name)}</span>`;
}

const TINTS = ['g', 'b', 'o', 'p', 't', 'r', 'a'];
/** Initials in a colored circle, for family members. */
export function avatar(m, cls = '') {
  const initials = String(m?.name || '?').trim().split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  let h = 0;
  for (const ch of String(m?.id || m?.name || '')) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return `<span class="avatar t-${TINTS[h % TINTS.length]} ${cls}" aria-hidden="true">${initials}</span>`;
}

/** Star row for ratings. */
export const starsHtml = (n) => `<span class="stars-ro" aria-label="${Math.round(n)} of 5 stars">${[1, 2, 3, 4, 5].map((i) => ic('star', i <= Math.round(n) ? 'on' : '', i <= Math.round(n))).join('')}</span>`;
