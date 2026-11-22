/* Rätslio? – Service Worker (Offline-Nutzung)
   Diese Datei muss im selben Ordner wie index.html liegen und "sw.js" heißen.
   Bei Änderungen an der App die Versionsnummer erhöhen, dann wird der Zwischenspeicher erneuert. */
const VERSION = 'raetslio-v2';
const SHELL = [self.registration.scope, new URL('index.html', self.registration.scope).href];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION).then((cache) => Promise.all(SHELL.map((u) => cache.add(new Request(u, { cache: 'reload' })).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const CDN_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com', 'cdn.jsdelivr.net'];

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  /* Anmeldung und Datenbank (Supabase, Google) nie zwischenspeichern */
  if (url.hostname.endsWith('supabase.co') || url.hostname.endsWith('google.com')) return;

  /* Seitenaufrufe: erst Netzwerk (immer aktuell), offline aus dem Zwischenspeicher */
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).then((res) => {
        if (res && res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
        return res;
      }).catch(() =>
        caches.match(req, { ignoreSearch: true })
          .then((r) => r || caches.match(SHELL[1]) || caches.match(SHELL[0]))
      )
    );
    return;
  }

  /* Schriften, Bibliotheken und eigene Dateien: Zwischenspeicher zuerst, im Hintergrund aktualisieren */
  if (url.origin === self.location.origin || CDN_HOSTS.includes(url.hostname)) {
    event.respondWith(
      caches.match(req).then((cached) => {
        const net = fetch(req).then((res) => {
          if (res && (res.ok || res.type === 'opaque')) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
          return res;
        }).catch(() => cached);
        return cached || net;
      })
    );
  }
});
