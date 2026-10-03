// Cache do app shell (offline parcial). Não cacheia APIs.
const CACHE = 'obsidian-companion-v1';
const ASSETS = ['./index.html', './styles.css', './app.js', './icon.svg', './manifest.json'];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (u.origin !== location.origin) return; // APIs e WS passam direto
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});
