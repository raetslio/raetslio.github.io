/* ======================================================================
   Binoxxo: Online spielen
   Oberfläche, Eingabe und Prüfung des Binoxxo-Spiels (Objekt BX).
   ====================================================================== */
'use strict';

var bx = { n: 8, diff: 1, data: null, entries: [], revealed: false, wrong: {} };
var BX_SIZES = [6, 8, 10, 12, 14];
window.BX = {
  init: function () {
    $('bx-sizes').innerHTML = BX_SIZES.map(function (s) { return '<button type="button" class="chip-btn" data-v="' + s + '" onclick="BX.setSize(' + s + ')">' + s + '×' + s + '</button>'; }).join('');
    $('bx-diffs').innerHTML = DIFFS.map(function (d, i) { return '<button type="button" class="seg-btn" data-v="' + i + '" onclick="BX.setDiff(' + i + ')">' + d + '</button>'; }).join('');
    BX.newPuzzle();
  },
  bind: function () {
    var g = $('bx-grid');
    g.addEventListener('click', function (e) {
      var c = e.target.closest('.bx-cell'); if (!c) return;
      var r = +c.dataset.r, cc = +c.dataset.c;
      if (bx.revealed) { banner($('bx-feedback'), 'Die Lösung wird angezeigt – klicke auf „Lösung anzeigen“, um weiterzuspielen.', 'info'); return; }
      var v = bx.entries[r][cc]; BX.set(r, cc, v < 0 ? 1 : v === 1 ? 0 : -1);
    });
    g.addEventListener('contextmenu', function (e) { var c = e.target.closest('.bx-cell'); if (!c) return; e.preventDefault(); BX.set(+c.dataset.r, +c.dataset.c, -1); });
    g.addEventListener('keydown', function (e) {
      var c = e.target.closest('.bx-cell'); if (!c) return;
      var r = +c.dataset.r, cc = +c.dataset.c, k = e.key, n = bx.n, mv = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[k];
      if (mv) { e.preventDefault(); var nr = Math.max(0, Math.min(n - 1, r + mv[0])), nc = Math.max(0, Math.min(n - 1, cc + mv[1])); var nx = g.querySelector('[data-r="' + nr + '"][data-c="' + nc + '"]'); if (nx) nx.focus(); return; }
      var val = { x: 1, X: 1, '1': 1, o: 0, O: 0, '0': 0, Backspace: -1, Delete: -1, ' ': -2 }[k];
      if (val === undefined) return; e.preventDefault();
      if (val === -2) { e.target.click(); return; }
      if (!bx.revealed) BX.set(r, cc, val);
    });
  },
  hint: function () {
    if (bx.revealed) return;
    var n = bx.n, opts = [];
    for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) if (bx.data.givens[r][c] < 0 && bx.entries[r][c] !== bx.data.solution[r][c]) opts.push([r, c]);
    if (!opts.length) { BX.check(); return; }
    var p = opts[rnd(opts.length)]; BX.set(p[0], p[1], bx.data.solution[p[0]][p[1]]);
    banner($('bx-feedback'), 'Tipp: Zeile ' + (p[0] + 1) + ', Spalte ' + (p[1] + 1) + ' wurde ausgefüllt.', 'info');
  },
  setSize: function (s) { bx.n = s; BX.newPuzzle(); },
  setDiff: function (d) { bx.diff = d; BX.newPuzzle(); },
  newPuzzle: function () {
    var data = null, tries = 0;
    while (!data && tries++ < 5) data = bxCreate(bx.n, bx.diff);
    if (!data) { banner($('bx-feedback'), 'Erzeugung fehlgeschlagen – bitte erneut versuchen.', 'error'); return; }
    bx.extras = []; bx.data = data; bx.entries = data.givens.map(function (r) { return r.slice(); }); bx.revealed = false; bx.wrong = {};
    banner($('bx-feedback'), '');
    BX.render();
  },
  render: function () {
    var n = bx.n, g = $('bx-grid'), cs = n <= 6 ? 56 : n <= 8 ? 48 : n <= 10 ? 42 : n <= 12 ? 36 : 32;
    g.style.setProperty('--bxn', n); var conf = bxConflicts(bx.revealed ? bx.data.solution : bx.entries, n);
    var h = '';
    for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) {
      var given = bx.data.givens[r][c] >= 0, v = bx.revealed ? bx.data.solution[r][c] : bx.entries[r][c];
      var cls = 'bx-cell' + (given ? ' given' : '') + (v === 1 ? ' x' : v === 0 ? ' o' : '') + (bx.wrong[r + ',' + c] ? ' wrong' : '') + (!bx.revealed && conf[r + ',' + c] ? ' conflict' : '') + (bx.revealed && !given ? ' rev' : '');
      h += '<button type="button" class="' + cls + '" data-r="' + r + '" data-c="' + c + '" aria-label="Zeile ' + (r + 1) + ' Spalte ' + (c + 1) + ': ' + (v === 1 ? 'X' : v === 0 ? 'O' : 'leer') + '">' + (v === 1 ? 'X' : v === 0 ? 'O' : '') + '</button>';
    }
    g.innerHTML = h;
    $('bx-badge').textContent = n + '×' + n + ' · ' + DIFFS[bx.diff];
    if (window.__rsInit && window.schedulePersist) window.schedulePersist();
    document.querySelectorAll('#bx-sizes .chip-btn').forEach(function (b) { b.setAttribute('aria-pressed', +b.dataset.v === n ? 'true' : 'false'); });
    document.querySelectorAll('#bx-diffs .seg-btn').forEach(function (b) { b.setAttribute('aria-pressed', +b.dataset.v === bx.diff ? 'true' : 'false'); });
  },
  set: function (r, c, v) {
    if (bx.revealed || bx.data.givens[r][c] >= 0) return;
    bx.entries[r][c] = v; delete bx.wrong[r + ',' + c];
    BX.render();
    var cell = document.querySelector('#bx-grid [data-r="' + r + '"][data-c="' + c + '"]'); if (cell) cell.focus();
    var full = bx.entries.every(function (row) { return row.every(function (x) { return x >= 0; }); });
    if (full) BX.check();
  },
  check: function () {
    if (bx.revealed) return;
    var n = bx.n, wrong = 0, empty = 0; bx.wrong = {};
    for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) {
      var v = bx.entries[r][c];
      if (v < 0) empty++; else if (v !== bx.data.solution[r][c]) { wrong++; bx.wrong[r + ',' + c] = 1; }
    }
    BX.render();
    if (!wrong && !empty) banner($('bx-feedback'), 'Geschafft! Das Binoxxo ist richtig gelöst.', 'success');
    else if (wrong) banner($('bx-feedback'), wrong + (wrong === 1 ? ' Feld ist' : ' Felder sind') + ' falsch (rot markiert).' + (empty ? ' Noch ' + empty + ' leer.' : ''), 'error');
    else banner($('bx-feedback'), 'Bisher alles richtig – noch ' + empty + ' Felder offen.', 'info');
  },
  reveal: function () { bx.revealed = !bx.revealed; bx.wrong = {}; BX.render(); banner($('bx-feedback'), bx.revealed ? 'Lösung wird angezeigt.' : '', 'info'); },
  clear: function () { bx.entries = bx.data.givens.map(function (r) { return r.slice(); }); bx.revealed = false; bx.wrong = {}; banner($('bx-feedback'), ''); BX.render(); },
  current: function () { return bx.data ? { n: bx.n, solution: bx.data.solution, givens: bx.data.givens, diff: bx.diff } : null; }
};
