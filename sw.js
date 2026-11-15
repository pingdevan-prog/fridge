// Service worker: makes the app installable and lets the app shell load offline.
// Same-origin files use "network first, cache as fallback" so updates arrive right away when online.
const CACHE = 'fridge-v2';
const SHELL = ['./', 'index.html', 'css/styles.css', 'manifest.webmanifest', 'icons/icon-192.png',
  'js/app.js', 'js/store.js', 'js/data/foods.js', 'js/data/heb.js',
  'js/lib/units.js', 'js/lib/match.js', 'js/lib/nutrition.js', 'js/lib/receipt.js', 'js/lib/ai.js', 'js/lib/recipes.js', 'js/lib/planner.js', 'js/lib/shopping.js', 'js/lib/sync.js',
  'js/ui/dom.js', 'js/ui/fridge.js', 'js/ui/meals.js', 'js/ui/plan.js', 'js/ui/shop.js', 'js/ui/me.js', 'js/ui/cook.js', 'js/ui/capture.js'];

self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return; // recipe, USDA and Claude requests go straight to the network
  e.respondWith(
    fetch(e.request).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
      return res;
    }).catch(() => caches.match(e.request).then((hit) => hit || caches.match('index.html'))),
  );
});
