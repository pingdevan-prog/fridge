// Service worker: makes the app installable and lets the app shell load offline.
// Same-origin files use "network first, cache as fallback". The network request always revalidates
// (cache: 'no-cache'), so a phone never keeps running an older copy of the app after an update.
const CACHE = 'fridge-v11';
const SHELL = ['./', 'index.html', 'css/styles.css', 'manifest.webmanifest', 'icons/icon-192.png',
  'js/app.js', 'js/store.js', 'js/data/foods.js', 'js/data/heb.js',
  'js/lib/units.js', 'js/lib/match.js', 'js/lib/nutrition.js', 'js/lib/receipt.js', 'js/lib/ai.js', 'js/lib/recipes.js', 'js/lib/planner.js', 'js/lib/shopping.js', 'js/lib/sync.js', 'js/lib/ocr.js', 'js/lib/labels.js', 'js/lib/names.js',
  'js/ui/dom.js', 'js/ui/fridge.js', 'js/ui/meals.js', 'js/ui/plan.js', 'js/ui/shop.js', 'js/ui/me.js', 'js/ui/cook.js', 'js/ui/capture.js', 'js/ui/suggest.js', 'js/ui/icons.js', 'js/data/ingredients.js', 'js/lib/vision.js', 'js/data/food-vectors.json', 'js/data/food-vectors.bin'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('fridge-') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return; // recipe, USDA and Claude requests go straight to the network
  e.respondWith(
    fetch(e.request.url, { cache: 'no-cache', credentials: 'same-origin' }).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
      return res;
    }).catch(() => caches.match(e.request).then((hit) => hit || caches.match('index.html'))),
  );
});
