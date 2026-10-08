// Offline cache for the E40 blend calculator.
// The page itself is fetched fresh whenever there is a connection (so updates show right away) and falls back
// to the saved copy offline. Icons and the manifest come from the cache and refresh in the background.
const CACHE = 'e40-blend-v4';
const PAGE = './index.html';
const FILES = ['./', PAGE, './manifest.webmanifest', './apple-touch-icon.png', './icon-192.png', './icon-512.png'];
const NETWORK_WAIT_MS = 4000;

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

const store = async (key, res) => {
  if (res && res.ok) await (await caches.open(CACHE)).put(key, res.clone());
  return res;
};

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    const fresh = fetch(req).then((res) => store(PAGE, res));
    const slow = new Promise((_, reject) => setTimeout(() => reject(new Error('slow network')), NETWORK_WAIT_MS));
    e.respondWith(
      Promise.race([fresh, slow]).catch(() => caches.match(PAGE).then((hit) => hit || fresh))
    );
    e.waitUntil(fresh.then(() => {}, () => {}));
    return;
  }

  const fresh = fetch(req).then((res) => store(req, res));
  e.respondWith(caches.match(req, { ignoreSearch: true }).then((hit) => hit || fresh));
  e.waitUntil(fresh.then(() => {}, () => {}));
});
