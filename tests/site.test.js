/* Automatische Pruefung der gebauten Seiten. Start: node --test tests/ (im Hauptordner) */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { spawnSync } = require('node:child_process');

const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const exists = (f) => fs.existsSync(path.join(root, f));
const ROUTES = ['start', 'sudoku', 'suchsel', 'binoxxo', 'labyrinth', 'hitori', 'zahlenmauer', 'magisches-quadrat', 'heft', 'spiele', 'verlauf', 'support'];
const PRIVATE = ['login', 'konto'];

test('jede Seite hat Titel, Beschreibung, Canonical und og-Tags passend zur Adresse', () => {
  for (const r of ROUTES) {
    const h = read(`${r}/index.html`);
    assert.match(h, /<title>[^<]+<\/title>/, r);
    assert.match(h, /<meta name="description" content="[^"]{20,}">/, r);
    assert.ok(h.includes(`<link rel="canonical" href="https://raetslio.github.io/${r}/">`), `${r}: canonical`);
    assert.ok(h.includes(`<meta property="og:url" content="https://raetslio.github.io/${r}/">`), `${r}: og:url`);
    assert.match(h, /<meta property="og:title" content="[^"]+">/, r);
    assert.equal((h.match(/<link rel="canonical"/g) || []).length, 1, `${r}: genau ein canonical`);
  }
});

test('Anmelde- und Kontoseite sind nicht indexierbar und haben ihre Body-Klasse', () => {
  for (const r of PRIVATE) {
    const h = read(`${r}/index.html`);
    assert.ok(h.includes('<meta name="robots" content="noindex, nofollow">'), r);
    assert.ok(h.includes(`<body class="rs-${r}">`), r);
    assert.ok(!h.includes('rel="canonical"'), r);
  }
});

test('alle Seiten laden die gemeinsame Oberflaeche und die Konto-Skripte in der richtigen Reihenfolge', () => {
  for (const r of [...ROUTES, ...PRIVATE]) {
    const h = read(`${r}/index.html`);
    assert.ok(h.includes("'/app-body.html'"), `${r}: Lade-Skript`);
    const u = h.indexOf('<script src="js/account-utils.js">'), a = h.indexOf('<script src="js/account.js">');
    assert.ok(u > 0 && a > u, `${r}: account-utils.js muss vor account.js stehen`);
    assert.ok(h.indexOf('supabase-js@2') < a, `${r}: Supabase vor account.js`);
    assert.ok(h.length < 12000, `${r}: Seite darf nicht wieder aufgeblaeht werden (${h.length} Zeichen)`);
  }
});

test('Seiten unterscheiden sich nur im Kopf (keine Kopien der Oberflaeche)', () => {
  const body = (f) => read(f).slice(read(f).indexOf('<body'));
  const strip = (s) => s.replace(/<body[^>]*>/, '<body>');
  const ref = strip(body('sudoku/index.html'));
  for (const r of [...ROUTES, ...PRIVATE]) assert.equal(strip(body(`${r}/index.html`)), ref, r);
});

test('alle in app-body.html eingebundenen Skripte existieren und sind gueltiges JavaScript', () => {
  const body = read('app-body.html');
  const files = [...body.matchAll(/<script src="(js\/[^"]+)"/g)].map((m) => m[1]);
  assert.ok(files.length > 20);
  for (const f of [...files, 'js/account-utils.js', 'js/account.js', 'sw.js']) {
    assert.ok(exists(f), `fehlt: ${f}`);
    assert.doesNotThrow(() => new vm.Script(read(f), { filename: f }), f);
  }
});

test('alle Dateien des Offline-Caches (sw.js) sind vorhanden', () => {
  const sw = read('sw.js');
  const list = sw.slice(sw.indexOf('APP_FILES'), sw.indexOf('];', sw.indexOf('APP_FILES')));
  const files = [...list.matchAll(/'([^']+)'/g)].map((m) => m[1]).filter((f) => f !== 'APP_FILES');
  assert.ok(files.length > 30);
  for (const f of files) {
    if (f === './') continue;
    const p = f.endsWith('/') ? f + 'index.html' : f;
    assert.ok(exists(p), `fehlt im Cache: ${f}`);
  }
  assert.ok(files.includes('app-body.html') && files.includes('js/account-utils.js'));
});

test('Sitemap listet alle oeffentlichen Seiten und keine privaten', () => {
  const sm = read('sitemap.xml');
  for (const r of ROUTES.filter((x) => !['start', 'spiele', 'verlauf', 'support'].includes(x))) assert.ok(sm.includes(`/${r}/`), r);
  for (const r of [...PRIVATE, 'start', 'spiele', 'verlauf', 'support']) assert.ok(!sm.includes(`/${r}/`), r);
});

test('js/account.js ist aus js/account-src/ aktuell gebaut', () => {
  const r = spawnSync('python3', ['tools/build-account.py', '--check'], { cwd: root });
  assert.equal(r.status, 0, 'Bitte "python3 tools/build-account.py" ausfuehren');
});

test('Rest-Pruefung: keine Verweise auf entfernte Seiten', () => {
  assert.ok(!exists('statistik'));
  assert.ok(!read('sw.js').includes('statistik'));
});
