/* PartyBooth offline cache: the booth keeps working when the venue Wi-Fi drops. */
const CACHE = 'partybooth-v2';
const FILES = ['./', './index.html', './css/app.css', './css/fonts.css', './manifest.webmanifest',
  './fonts/Bungee.woff', './fonts/Caveat.woff', './fonts/Nunito.woff', './fonts/Pacifico.woff', './fonts/PlayfairDisplay-Italic.woff',
  './js/util.js', './js/qr.js', './js/gif.js', './js/layouts.js', './js/compose.js', './js/camera.js', './js/output.js', './js/editor.js', './js/settings.js', './js/app.js',
  './icons/icon-192.png', './icons/icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === location.origin) {
    // network first so updates arrive, cache as fallback for offline
    e.respondWith(fetch(req).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(req, copy)); return r; }).catch(() => caches.match(req, { ignoreSearch: true })));
  }
});
