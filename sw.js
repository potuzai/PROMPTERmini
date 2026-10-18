// Service worker: aplikace funguje offline i z GitHub Pages
const CACHE = 'prompter-v1.19.2';
const FILES = ['./', 'index.html', 'css/app.css', 'css/fonts.css', 'js/icons.js', 'img/icon.svg', 'manifest.webmanifest',
  'js/util.js', 'js/db.js', 'js/markup.js', 'js/render.js', 'js/mega-core.js', 'js/sync.js', 'vendor/megajs-1.3.10.js', 'js/screens.js', 'js/reader.js', 'js/stage-editor.js', 'js/ui-songs.js', 'js/ui-playlists.js', 'js/ui-other.js', 'js/ui-band.js', 'js/ui-calendar.js', 'js/ui-setup.js', 'js/main.js'];
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (u.origin !== location.origin || e.request.method !== 'GET') return; // GitHub API vždy přímo
  // síť napřed (aktuální verze), při výpadku z mezipaměti
  e.respondWith(fetch(e.request).then(r => { const c = r.clone(); caches.open(CACHE).then(ca => ca.put(e.request, c)); return r; }).catch(() => caches.match(e.request)));
});
