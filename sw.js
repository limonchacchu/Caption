// Works on any base path (GitHub Pages /Caption/, Netlify root, custom domain).
// Bump VERSION on every release so old caches are removed.
const VERSION = 'v5';
const STATIC = `static-${VERSION}`;
const PRECACHE = ['offline.html', 'assets/logo.png', 'assets/css/style.css', 'assets/css/studio.css', 'assets/js/app.js', 'assets/js/studio.js',
  'assets/js/search.js', 'assets/js/data.js', 'assets/js/config.js', 'assets/icons/icon-192.png', 'assets/icons/icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(STATIC).then((c) => Promise.all(PRECACHE.map((u) => c.add(u).catch(() => {})))));
  self.skipWaiting();
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== STATIC).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;   // never cache Supabase/auth/other origins
  if (/\/admin/.test(url.pathname)) return;                              // never cache admin
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).catch(() => caches.match('offline.html')));
    return;
  }
  if (/\.(css|js|png|jpg|jpeg|webp|svg|woff2?)$/.test(url.pathname)) {
    e.respondWith(caches.open(STATIC).then(async (cache) => {
      const hit = await cache.match(req);
      const net = fetch(req).then((r) => { if (r.ok) cache.put(req, r.clone()); return r; }).catch(() => hit);
      return hit || net;
    }));
  }
});
