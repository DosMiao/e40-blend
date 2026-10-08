// Offline cache for the E40 blend calculator. Serves the cached copy first and refreshes it in the background.
const CACHE = 'e40-blend-v3';
const FILES = ['./', './index.html', './manifest.webmanifest', './apple-touch-icon.png', './icon-192.png', './icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => Promise.all(FILES.map((f) => c.add(f).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  const key = req.mode === 'navigate' ? './index.html' : req;
  const fresh = fetch(req).then(async (res) => {
    if (res && res.ok) {
      const c = await caches.open(CACHE);
      await c.put(key, res.clone());
    }
    return res;
  });
  e.respondWith(caches.match(key, { ignoreSearch: true }).then((hit) => hit || fresh));
  e.waitUntil(fresh.then(() => {}, () => {}));
});
