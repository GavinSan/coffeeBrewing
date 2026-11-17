// Bump this after changing files so old caches are dropped
const CACHE = 'coffee-v3';
const SHELL = ['./', 'index.html', 'styles.css', 'app.js', 'sync.js', 'config.js', 'vendor/supabase.js', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-180.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

// Serve from cache (works offline) and refresh in the background for next launch
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  // Only cache the app itself and its fonts; cloud sync requests always go to the network
  const host = new URL(e.request.url).host;
  if (host !== self.location.host && host !== 'fonts.googleapis.com' && host !== 'fonts.gstatic.com') return;
  e.respondWith(
    caches.open(CACHE).then((cache) =>
      cache.match(e.request).then((hit) => {
        const net = fetch(e.request).then((res) => {
          if (res && (res.ok || res.type === 'opaque')) cache.put(e.request, res.clone());
          return res;
        }).catch(() => hit);
        return hit || net;
      })
    )
  );
});
