// App entry: load saved data, register the tab views, start the service worker.
import { load, state, save } from './store.js';
import { loadSample } from './data/seed.js';
import { readSharedList } from './lib/shopping.js';
import { render, toast } from './ui/dom.js';
import './ui/fridge.js';
import './ui/meals.js';
import './ui/plan.js';
import { openShared } from './ui/shop.js';
import './ui/me.js';
import './ui/cook.js';

load();
if (!state.seeded) { loadSample(); save(); } // first visit: sample data so everything can be tried right away
render();

// A family member opened a shared shopping-list link.
const shared = readSharedList(location.hash);
if (shared?.length) openShared(shared);

// Installable, and the app shell works offline.
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
window.addEventListener('offline', () => toast('You are offline. Your fridge and saved recipes still work.'));
