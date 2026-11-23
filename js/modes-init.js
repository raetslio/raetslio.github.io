/* ======================================================================
   Rätselarten umschalten, Zustand sichern, Start der Erweiterungen
   switchMode für alle Tabs, Speichern/Wiederherstellen des Zustands und Start aller Objekte.
   ====================================================================== */
'use strict';

var NEW_MODES = { binoxxo: 'view-binoxxo', labyrinth: 'view-labyrinth', hitori: 'view-hitori', mauer: 'view-mauer', magic: 'view-magic', heft: 'view-heft', verlauf: 'view-verlauf', spiele: 'view-spiele' };
var origSwitch = window.switchMode;
window.switchMode = function (m) {
  var isNew = !!NEW_MODES[m];
  Object.keys(NEW_MODES).forEach(function (k) { $(NEW_MODES[k]).classList.toggle('hidden', k !== m); $('tab-' + k).setAttribute('aria-selected', k === m ? 'true' : 'false'); });
  var pb = $('btn-open-print'); if (pb) pb.classList.toggle('hidden', m === 'heft' || m === 'verlauf' || m === 'spiele');
  if (!isNew) { origSwitch(m); return; }
  window.appState.mode = m;
  ['sudoku', 'wortsuche'].forEach(function (k) { $('view-' + k).classList.add('hidden'); $('tab-' + k).setAttribute('aria-selected', 'false'); });
  if (m === 'heft') refreshUI();
  if (m === 'verlauf') hvRender();
  if (m === 'spiele') gvRender();
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
