// Bump VERSION on every release so old caches are removed (Part 14.10)
const VERSION = 'v3';
const STATIC = `static-${VERSION}`;
const PRECACHE = ['/assets/css/studio.css', '/assets/js/studio.js', '/assets/css/style.css', '/assets/js/app.js', '/assets/js/search.js', '/assets/js/data.js', '/assets/js/config.js', '/offline.html', '/assets/icons/icon-192.png', '/assets/icons/icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(STATIC).then(c => c.addAll(PRECACHE)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== STATIC).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET') return;
  // Never cache Supabase / auth / admin / functions: private data must not be stored
  if (url.origin !== location.origin) return;
  if (/^\/(admin|\.netlify)/.test(url.pathname)) return;

  // Pages: network first, offline fallback
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).catch(() => caches.match('/offline.html')));
    return;
  }
  // Static assets: stale-while-revalidate
  if (/\.(css|js|png|jpg|jpeg|webp|svg|woff2?)$/.test(url.pathname)) {
    e.respondWith(
      caches.open(STATIC).then(async cache => {
        const hit = await cache.match(req);
        const net = fetch(req).then(r => { if (r.ok) cache.put(req, r.clone()); return r; }).catch(() => hit);
        return hit || net;
      })
    );
  }
});
