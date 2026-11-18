// Bump this after changing files so old caches are dropped
const CACHE = 'coffee-v5';
const SHELL = ['./', 'index.html', 'styles.css', 'app.js', 'sync.js', 'config.js', 'vendor/supabase.js', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-180.png'];
const FONTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

// The app: network first so a new version shows on the next open; the cached copy is used offline
// or when the network takes more than 3 s. Fonts never change, so they come from cache first.
// Cloud sync requests are left alone.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (FONTS.indexOf(url.host) >= 0) {
    e.respondWith(caches.open(CACHE).then((c) => c.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
      if (res && (res.ok || res.type === 'opaque')) c.put(e.request, res.clone());
      return res;
    }))));
    return;
  }
  if (url.origin !== self.location.origin) return;
  e.respondWith(caches.open(CACHE).then((c) => {
    const net = fetch(e.request).then((res) => { if (res && res.ok) c.put(e.request, res.clone()); return res; });
    const slow = new Promise((resolve) => setTimeout(resolve, 3000)).then(() => c.match(e.request, { ignoreSearch: true }));
    const cached = () => c.match(e.request, { ignoreSearch: true }).then((hit) => hit || (e.request.mode === 'navigate' ? c.match('index.html') : undefined));
    return Promise.race([net, slow.then((hit) => hit || net)]).catch(() => cached()).then((res) => res || cached());
  }));
});
