/* ======================================================================
   Rätselarten umschalten, Zustand sichern, Start der Erweiterungen
   switchMode für alle Tabs, Speichern/Wiederherstellen des Zustands und Start aller Objekte.
   ====================================================================== */
'use strict';

var NEW_MODES = { start: 'view-start', binoxxo: 'view-binoxxo', labyrinth: 'view-labyrinth', hitori: 'view-hitori', mauer: 'view-mauer', magic: 'view-magic', heft: 'view-heft', verlauf: 'view-verlauf', spiele: 'view-spiele', support: 'view-support' };
var origSwitch = window.switchMode;
window.switchMode = function (m) {
  var isNew = !!NEW_MODES[m];
  Object.keys(NEW_MODES).forEach(function (k) { $(NEW_MODES[k]).classList.toggle('hidden', k !== m); $('tab-' + k).setAttribute('aria-selected', k === m ? 'true' : 'false'); });
  var pb = $('btn-open-print'); if (pb) pb.classList.toggle('hidden', m === 'heft' || m === 'verlauf' || m === 'spiele' || m === 'support' || m === 'start');
  if (!isNew) { origSwitch(m); return; }
  window.appState.mode = (m === 'support' ? 'start' : m); /* Support wird nie als „zuletzt geöffnet“ gemerkt */
  ['sudoku', 'wortsuche'].forEach(function (k) { $('view-' + k).classList.add('hidden'); $('tab-' + k).setAttribute('aria-selected', 'false'); });
  if (m === 'heft') refreshUI();
  if (m === 'verlauf') hvRender();
  if (m === 'spiele') gvRender();
  if (m === 'start' && window.RSSTART) window.RSSTART.render();
};
BX.init(); BX.bind(); MZ.init(); HT.init(); NXMG.init(); MW.init(); BK.init(); hvInit(); gvInit();
/* Spielstand beim Verlassen/Ausblenden der Seite sofort sichern (inkl. Sudoku-Zeit) */
function flushState() { if (window.__rsInit && typeof window.saveStateToHost === 'function') { try { window.saveStateToHost(); } catch (e) {} } }
window.addEventListener('pagehide', flushState);
document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') flushState(); });

/* Gespeicherten Zusatzzustand (Binoxxo, Labyrinth, Notizen, Modus) wiederherstellen */
window.extGetState = function () {
  var s = window.appState.sudoku;
  return {
    v: 1,
    notes: (s.notes && s.notesFor === s.solution) ? s.notes : null,
    extraPuzzles: s.extraPuzzles || [],
    bx: bx.data ? { n: bx.n, diff: bx.diff, data: bx.data, entries: bx.entries, revealed: bx.revealed, wrong: bx.wrong || {}, extras: bx.extras || [] } : null,
    mz: mz.data ? { n: mz.n, hard: mz.hard || 0, data: mz.data, pos: mz.pos, trail: mz.trail, steps: mz.steps, won: mz.won, sol: mz.sol, extras: mz.extras || [] } : null,
    mzAuto: MZ.auto,
    nx: nxState()
  };
};
window.extRestore = function (saved) {
  if (!saved || window.__rsExtDone) return;
  window.__rsExtDone = true;
  var e = saved.ext;
  try {
    if (e) {
      var s = window.appState.sudoku;
      if (Array.isArray(e.extraPuzzles)) s.extraPuzzles = e.extraPuzzles;
      if (Array.isArray(e.notes) && e.notes.length === s.size) { s.notes = e.notes; s.notesFor = s.solution; }
      if (e.bx && e.bx.data && Array.isArray(e.bx.entries)) {
        bx.n = e.bx.n; bx.diff = e.bx.diff; bx.data = e.bx.data; bx.entries = e.bx.entries;
        bx.revealed = !!e.bx.revealed; bx.wrong = e.bx.wrong || {}; bx.extras = e.bx.extras || [];
        BX.render();
      }
      if (e.mz && e.mz.data && Array.isArray(e.mz.data.open)) {
        mz.n = e.mz.n; mz.hard = e.mz.hard || 0; mz.data = e.mz.data; mz.extras = e.mz.extras || [];
        mz.pos = e.mz.pos || 0; mz.trail = Array.isArray(e.mz.trail) && e.mz.trail.length ? e.mz.trail : [0];
        mz.steps = e.mz.steps || 0; mz.won = !!e.mz.won; mz.sol = !!e.mz.sol;
        MZ.restart(true);
      }
      if (typeof e.mzAuto === 'boolean') { MZ.auto = e.mzAuto; var ma = $('mz-auto'); if (ma) ma.checked = e.mzAuto; }
      if (e.nx) nxLoad(e.nx);
    }
  } catch (err) {}
  try { window.renderSudokuGrid(); } catch (err) {}
  if (saved.mode && NEW_MODES[saved.mode]) window.switchMode(saved.mode);
};
if (window.__rsSaved) window.extRestore(window.__rsSaved);
else if (window.appState.mode && NEW_MODES[window.appState.mode]) window.switchMode(window.appState.mode);

/* ======================================================================
   Eigene Adresse für jede Unterseite (/sudoku/, /suchsel/, …)
   ====================================================================== */
(function () {
  var ROUTES = { start: 'start', sudoku: 'sudoku', wortsuche: 'suchsel', binoxxo: 'binoxxo', labyrinth: 'labyrinth', hitori: 'hitori', mauer: 'zahlenmauer', magic: 'magisches-quadrat', heft: 'heft', spiele: 'spiele', verlauf: 'verlauf', support: 'support' };
  var SLUGS = {}; Object.keys(ROUTES).forEach(function (m) { SLUGS[ROUTES[m]] = m; });
  var META = {
    start: ["Startseite", "Alle Rätselarten, Spielverlauf, Druckverlauf und Rätselhefte von Rätslio? auf einen Blick."],
    sudoku: ["Sudoku", "Sudoku online spielen oder drucken: in vielen Größen und vier Schwierigkeitsstufen, mit Notizen und Prüfen."],
    wortsuche: ["Suchsel", "Suchsel (Wortsuche) online lösen oder als Arbeitsblatt drucken – mit eigenen Wörtern, wählbarer Größe und Richtungen."],
    binoxxo: ["Binoxxo", "Binoxxo (Takuzu) online spielen und drucken: Fülle das Gitter mit X und O nach den Binoxxo-Regeln."],
    labyrinth: ["Labyrinth", "Labyrinthe online durchlaufen oder drucken – in verschiedenen Größen und Schwierigkeitsgraden."],
    hitori: ["Hitori", "Hitori online spielen und drucken: Schwärze Zahlen so, dass keine doppelt in Zeile oder Spalte steht."],
    mauer: ["Zahlenmauer", "Zahlenmauern online rechnen oder als Arbeitsblatt drucken – mit Plus, Minus, Mal und Geteilt."],
    magic: ["Magisches Quadrat", "Magische Quadrate online lösen und drucken: Alle Zeilen, Spalten und Diagonalen ergeben dieselbe Summe."],
    heft: ["Rätselheft", "Stelle dein eigenes Rätselheft aus Sudoku, Suchsel, Binoxxo und mehr zusammen – mit Lösungen und PDF-Export."],
    spiele: ["Spielverlauf", "Dein Spielverlauf bei Rätslio?: angefangene Rätsel öffnen und weiterspielen."],
    verlauf: ["Druckverlauf", "Dein Druckverlauf bei Rätslio?: zuletzt gedruckte Rätsel noch einmal öffnen oder drucken."],
    support: ["Support", "Support bei Rätslio?: Frage, Fehler oder Idee? Schreib uns direkt."]
  };
  function setMeta(sel, attr, val) { var el = document.querySelector(sel); if (el) el.setAttribute(attr, val); }
  function updateMeta(m) {
    var x = META[m], slug = ROUTES[m]; if (!x) return;
    document.title = x[0] + ' - Rätslio?';
    setMeta('meta[name="description"]', 'content', x[1]);
    setMeta('meta[property="og:title"]', 'content', x[0] + ' - Rätslio?');
    setMeta('meta[property="og:description"]', 'content', x[1]);
    if (slug) { var u = 'https://raetslio.github.io/' + slug + '/'; setMeta('link[rel="canonical"]', 'href', u); setMeta('meta[property="og:url"]', 'content', u); }
  }
  var web = /^https?:$/.test(location.protocol) && !/^\/(login|konto)\/?/.test(location.pathname);
  function pathMode() { var p = location.pathname.replace(/index\.html$/, '').split('/').filter(Boolean); return p.length ? (SLUGS[p[p.length - 1]] || null) : null; }
  var routeMode = pathMode(), inner = window.switchMode, fromPop = false;
  var onKonto = /^\/konto\/?(index\.html)?$/.test(location.pathname), started = false;
  window.switchMode = function (m) {
    if (onKonto && started && ROUTES[m]) { location.href = '/' + ROUTES[m] + '/'; return; } /* Konto-Seite: Menü führt zur gewählten Seite */
    if (!window.__rsInit && routeMode) m = routeMode;
    inner(m);
    updateMeta(m);
    if (!web || !ROUTES[m] || fromPop) return;
    var url = '/' + ROUTES[m] + '/';
    if (location.pathname === url) return;
    try { (window.__rsInit ? history.pushState : history.replaceState).call(history, { m: m }, '', url + location.search); } catch (e) {}
  };
  window.addEventListener('popstate', function () {
    var m = pathMode() || 'sudoku'; fromPop = true;
    try { window.switchMode(m); } finally { fromPop = false; }
  });
  /* Start: Adresse hat Vorrang vor dem zuletzt gespeicherten Modus */
  if (window.__rsInit) window.switchMode(routeMode || window.appState.mode || 'sudoku');
  started = true;
  if (onKonto) { Array.prototype.forEach.call(document.querySelectorAll('.nav-tab'), function (t) { t.setAttribute('aria-selected', 'false'); }); }
})();
