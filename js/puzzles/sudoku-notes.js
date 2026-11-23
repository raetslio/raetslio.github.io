/* ======================================================================
   Sudoku: Notizblock
   Kandidaten-Notizen in den Feldern.
   ====================================================================== */
'use strict';

var SN = window.SN = (function () {
  var on = false;
  function S() { return window.appState.sudoku; }
  function ensure() {
    var s = S(), n = s.size;
    if (!s.notes || s.notesFor !== s.solution || s.notes.length !== n) { s.notes = []; for (var r = 0; r < n; r++) { s.notes.push([]); for (var c = 0; c < n; c++) s.notes[r].push([]); } s.notesFor = s.solution; }
  }
  function dropPeers(r, c, v) {
    var s = S(), n = s.size, sr = s.subR, sc = s.subC, br = Math.floor(r / sr) * sr, bc = Math.floor(c / sc) * sc;
    for (var i = 0; i < n; i++) { rm(r, i, v); rm(i, c, v); }
    for (var a = 0; a < sr; a++) for (var b = 0; b < sc; b++) rm(br + a, bc + b, v);
  }
  function rm(r, c, v) { var l = S().notes[r][c], i = l.indexOf(v); if (i >= 0) l.splice(i, 1); }
  var oEnter = window.enterSudokuValue, oRender = window.renderSudokuGrid, oReset = window.resetSudokuEntries;
  window.enterSudokuValue = function (val) {
    var s = S();
    if (on && s.selected && !s.revealed && s.givens[s.selected.r][s.selected.c] === 0) {
      var r = s.selected.r, c = s.selected.c; ensure();
      if (s.entries[r][c] > 0) { window.showSudokuFeedback('Dieses Feld hat schon eine Zahl. Leere es zuerst, um Notizen zu machen.', 'info'); return; }
      if (val === 0) s.notes[r][c] = []; else { var i = s.notes[r][c].indexOf(val); if (i >= 0) s.notes[r][c].splice(i, 1); else { s.notes[r][c].push(val); s.notes[r][c].sort(function (a, b) { return a - b; }); } }
      window.renderSudokuGrid(); window.schedulePersist(); return;
    }
    oEnter(val); window.schedulePersist();
    if (s.selected && s.notes && s.notesFor === s.solution) {
      var rr = s.selected.r, cc = s.selected.c;
      if (val === 0) s.notes[rr][cc] = []; else if (s.entries[rr][cc] === val) { s.notes[rr][cc] = []; dropPeers(rr, cc, val); window.renderSudokuGrid(); }
    }
  };
  window.renderSudokuGrid = function () {
    oRender();
    var s = S(); if (!s.notes || s.notesFor !== s.solution || s.revealed) return;
    var n = s.size, k = Math.ceil(Math.sqrt(n)), fs = Math.max(6, s.cellZoom / k * 0.8), cells = document.querySelectorAll('#sudoku-grid .sudoku-cell');
    for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) {
      var nt = s.notes[r][c]; if (!nt.length || s.givens[r][c] || s.entries[r][c]) continue;
      var d = document.createElement('div'); d.className = 'sn-grid'; d.style.cssText = 'grid-template-columns:repeat(' + k + ',1fr);grid-template-rows:repeat(' + k + ',1fr);font-size:' + fs.toFixed(1) + 'px';
      var h = ''; for (var v = 1; v <= n; v++) h += '<span>' + (nt.indexOf(v) >= 0 ? v : '') + '</span>';
      d.innerHTML = h; cells[r * n + c].appendChild(d);
    }
  };
  window.resetSudokuEntries = function (btn) { oReset(btn); if (!btn || btn.dataset.armed !== 'true') { S().notes = null; window.renderSudokuGrid(); } };
  function ui() {
    var b = $('btn-notes'), pad = $('sudoku-keypad'), h = $('sudoku-keypad-hint');
    if (b) { b.setAttribute('aria-pressed', on ? 'true' : 'false'); b.classList.toggle('btn-primary', on); b.querySelector('span').textContent = on ? 'Notizblock: an' : 'Notizblock: aus'; }
    if (pad) pad.classList.toggle('notes-on', on);
    if (h) h.textContent = on ? 'Notizblock aktiv – Zahl tippt eine kleine Notiz ins Feld (nochmal tippen entfernt sie).' : 'Zifferntastatur — Feld antippen und Zahl wählen (oder Tastatur nutzen)';
  }
  document.addEventListener('keydown', function (e) { if (window.appState.mode === 'sudoku' && (e.key === 'n' || e.key === 'N') && !/INPUT|TEXTAREA|SELECT/.test(e.target.tagName) && !e.ctrlKey && !e.metaKey) { SN.toggle(); } });
  return {
    toggle: function () { on = !on; ui(); },
    clearAll: function () { S().notes = null; window.renderSudokuGrid(); window.schedulePersist(); }
  };
})();
