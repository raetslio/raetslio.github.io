/* Rätslio? – Service Worker (Offline-Nutzung)
   Diese Datei muss im Hauptordner neben index.html liegen und "sw.js" heißen.
   Bei Änderungen an der App die Versionsnummer erhöhen, dann wird der Zwischenspeicher erneuert. */
const VERSION = 'raetslio-v106';

/* Alle Dateien der App: werden bei der Installation geladen, damit sie offline bereitstehen. */
const APP_FILES = [
  './',
  'index.html',
  'start/', 'sudoku/', 'suchsel/', 'binoxxo/', 'labyrinth/', 'hitori/', 'zahlenmauer/', 'magisches-quadrat/', 'heft/', 'spiele/', 'verlauf/', 'support/', 'login/', 'konto/',
  'app-body.html', 'manifest.webmanifest',
  'favicon.ico', 'icons/rl.ico', 'icons/rl-32.png', 'icons/rl-180.png', 'icons/rl-192.png', 'icons/rl-512.png', 'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png',
  'css/tokens.css', 'css/base.css', 'css/components.css', 'css/board.css', 'css/modals.css', 'css/extensions.css', 'css/fonts.css', 'css/sidebar.css', 'css/start.css', 'css/heft-polish.css',
  'js/host-fallback.js',
  'js/core/constants.js', 'js/core/persistence.js', 'js/core/theme-mode.js', 'js/core/instructions.js',
  'js/puzzles/sudoku.js', 'js/puzzles/wortsuche.js', 'js/print/print-modal.js', 'js/core/init.js', 'js/sidebar.js',
  'js/common.js',
  'js/puzzles/binoxxo-logic.js', 'js/puzzles/labyrinth-logic.js', 'js/puzzles/binoxxo-online.js', 'js/puzzles/labyrinth-online.js',
  'js/heft/heft-data.js', 'js/heft/heft-texts.js', 'js/heft/svg-helpers.js', 'js/heft/heft-build.js', 'js/heft/heft-ui.js', 'js/heft/heft-polish.js',
  'js/print/print-extra.js', 'js/puzzles/sudoku-notes.js', 'js/print/pdf-export.js',
  'js/history/print-history.js', 'js/history/play-history.js', 'js/history/share.js', 'js/history/extras.js',
  'js/puzzles/new-puzzles-logic.js', 'js/puzzles/new-puzzles-online.js', 'js/puzzles/new-puzzles-print.js', 'js/puzzles/new-puzzles-registry.js',
  'js/modes-init.js', 'js/pwa.js', 'js/rs-home.js', 'js/start.js', 'js/app-menu.js', 'js/account-utils.js', 'js/account.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION)
      .then((cache) => Promise.all(APP_FILES.map((f) => cache.add(new Request(f, { cache: 'reload' })).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const CDN_HOSTS = ['cdn.jsdelivr.net'];

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  /* Anmeldung und Datenbank (Supabase, Google) nie zwischenspeichern */
  if (url.origin === self.location.origin && url.pathname.indexOf('/answer/') === 0) return; /* Antwortseite nie zwischenspeichern */
  if (url.hostname.endsWith('supabase.co') || url.hostname.endsWith('google.com')) return;

  /* Eigene Dateien */
  if (url.origin === self.location.origin) {
    const store = (res) => { if (res && res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); } return res; };
    const fallback = () => caches.match(req, { ignoreSearch: true })
      .then((r) => r || (req.mode === 'navigate' ? caches.match(url.pathname).then((r2) => r2 || caches.match('sudoku/')) : undefined));
    if (req.mode === 'navigate') {
      /* Seiten (klein): Netzwerk zuerst, aber nach 3 s auf den Zwischenspeicher ausweichen (langsame Verbindung) */
      event.respondWith(new Promise((resolve) => {
        let done = false;
        const t = setTimeout(() => { fallback().then((r) => { if (r && !done) { done = true; resolve(r); } }); }, 3000);
        fetch(req).then((res) => { if (!done) { done = true; clearTimeout(t); resolve(store(res)); } else store(res); })
          .catch(() => { clearTimeout(t); if (!done) fallback().then((r) => { done = true; resolve(r || Response.error()); }); });
      }));
      return;
    }
    /* Skripte, Stile, Schriften, Symbole, Seitenkörper: sofort aus dem Zwischenspeicher (kein Warten auf das Netz).
       Neue Versionen kommen mit einer erhöhten VERSION (Installation lädt alles frisch). */
    event.respondWith(
      caches.match(req, { ignoreSearch: true }).then((r) => r || fetch(req).then(store))
    );
    return;
  }

  /* Schriften und Bibliotheken von Fremdservern: Zwischenspeicher zuerst, im Hintergrund aktualisieren */
  if (CDN_HOSTS.includes(url.hostname)) {
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
