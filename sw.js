// Service worker: aplikace funguje offline i z GitHub Pages
const CACHE = 'prompter-v1.24.0';
const FILES = ['./', 'index.html', 'css/app.css', 'css/fonts.css', 'fonts/Roboto-latin-1.woff2', 'fonts/Roboto-latin-ext-0.woff2', 'fonts/RobotoCondensed-latin-3.woff2', 'fonts/RobotoCondensed-latin-ext-2.woff2', 'fonts/RobotoMono-latin-5.woff2', 'fonts/RobotoMono-latin-ext-4.woff2', 'js/icons.js', 'img/icon.svg', 'img/icon-192.png', 'img/icon-512.png', 'img/icon-maskable-512.png', 'img/apple-touch-icon.png', 'manifest.webmanifest',
  'js/util.js', 'js/db.js', 'js/markup.js', 'js/render.js', 'js/mega-core.js', 'js/sync.js', 'vendor/megajs-1.3.10.js', 'js/screens.js', 'js/reader.js', 'js/stage-editor.js', 'js/ui-songs.js', 'js/ui-playlists.js', 'js/ui-other.js', 'js/ui-band.js', 'js/ui-setup.js', 'js/main.js'];
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES.map(f => new Request(f, { cache: 'reload' })))).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (u.origin !== location.origin || e.request.method !== 'GET') return; // GitHub API vždy přímo
  // síť napřed (aktuální verze, vždy ověřená u serveru – bez čekání na mezipaměť prohlížeče), při výpadku z mezipaměti
  e.respondWith(fetch(e.request, { cache: 'no-cache' }).then(r => { if (r.ok) { const c = r.clone(); caches.open(CACHE).then(ca => ca.put(e.request, c)); } return r; }).catch(() => caches.match(e.request, { ignoreSearch: true })));
});
