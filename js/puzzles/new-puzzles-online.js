/* ======================================================================
   Neue Rätselarten: Online spielen
   Spielzustand und Bedienung für Hitori (HT), Magisches Quadrat (NXMG) und Zahlenmauer (MW)
   samt Zahlenfeld für das Handy.
   ====================================================================== */
'use strict';

var ht = { n: 8, diff: 1, data: null, st: [], revealed: false, extras: [] };
var mg = { n: 4, diff: 1, data: null, entries: [], revealed: false, extras: [], els: [] };
var mw = { n: 4, op: 'plus', diff: 1, data: null, entries: [], revealed: false, extras: [], els: [] };
var HT_SIZES = [5, 6, 7, 8, 9, 10, 12], MG_SIZES = [3, 4, 5, 6, 7];
var NX_IM = (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) ? 'none' : 'numeric';
var nxLast = { mg: null, mw: null };
function nxPad(key, gridId, maxFn) {
  var pad = $(key + '-pad'), root = $(gridId); if (!pad || !root) return;
  pad.innerHTML = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '⌫', '→'].map(function (k) {
    return '<button type="button" class="btn nx-pad-btn" data-k="' + k + '"' + (k === '⌫' ? ' aria-label="Löschen"' : k === '→' ? ' aria-label="Nächstes leeres Feld"' : '') + '>' + k + '</button>';
  }).join('');
  root.addEventListener('focusin', function (e) { if (e.target.tagName === 'INPUT') nxLast[key] = e.target; });
  ['pointerdown', 'mousedown'].forEach(function (ev) { pad.addEventListener(ev, function (e) { if (e.target.closest('button')) e.preventDefault(); }); });
  pad.addEventListener('click', function (e) {
    var bt = e.target.closest('button[data-k]'); if (!bt) return;
    var inputs = [].slice.call(root.querySelectorAll('input')); if (!inputs.length) return;
    var el = nxLast[key]; if (!el || !root.contains(el)) el = inputs.filter(function (i) { return !i.value; })[0] || inputs[0];
    var k = bt.dataset.k;
    if (k === '→') {
      var idx = inputs.indexOf(el), nx = null;
      for (var q = 1; q <= inputs.length; q++) { var c = inputs[(idx + q) % inputs.length]; if (!c.value) { nx = c; break; } }
      (nx || inputs[(idx + 1) % inputs.length]).focus(); return;
    }
    el.focus();
    var v = el.value;
    if (k === '⌫') v = v.slice(0, -1);
    else {
      if (v === '0') v = '';
      v = v + k;
      if (maxFn && +v > maxFn()) v = k;
      if (v.length > el.maxLength) return;
      if (maxFn && v === '0') return;
    }
    el.value = v; el.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
function nxPersist() { if (window.__rsInit && window.schedulePersist) window.schedulePersist(); }
function nxChips(id, attr, cur) { document.querySelectorAll('#' + id + ' button').forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute(attr) === String(cur) ? 'true' : 'false'); }); }
function nxDiffs(id, fn) { $(id).innerHTML = DIFFS.map(function (d, i) { return '<button type="button" class="seg-btn" data-v="' + i + '" onclick="' + fn + '(' + i + ')">' + d + '</button>'; }).join(''); }
function nxSizes(id, list, fn) { $(id).innerHTML = list.map(function (s) { return '<button type="button" class="chip-btn" data-v="' + s + '" onclick="' + fn + '(' + s + ')">' + s + '×' + s + '</button>'; }).join(''); }

/* --- Hitori --- */
window.HT = {
  init: function () {
    nxSizes('ht-sizes', HT_SIZES, 'HT.setSize'); nxDiffs('ht-diffs', 'HT.setDiff');
    var g = $('ht-grid');
    g.addEventListener('click', function (e) {
      var c = e.target.closest('.nx-cell'); if (!c) return;
      if (ht.revealed) { banner($('ht-feedback'), 'Die Lösung wird angezeigt – klicke auf „Lösung anzeigen“, um weiterzuspielen.', 'info'); return; }
      var r = +c.dataset.r, cc = +c.dataset.c; HT.set(r, cc, (ht.st[r][cc] + 1) % 3);
    });
    g.addEventListener('contextmenu', function (e) { var c = e.target.closest('.nx-cell'); if (!c) return; e.preventDefault(); if (!ht.revealed) HT.set(+c.dataset.r, +c.dataset.c, ht.st[+c.dataset.r][+c.dataset.c] === 2 ? 0 : 2); });
    g.addEventListener('keydown', function (e) {
      var c = e.target.closest('.nx-cell'); if (!c) return;
      var r = +c.dataset.r, cc = +c.dataset.c, n = ht.n, mv = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[e.key];
      if (mv) { e.preventDefault(); var nx = g.querySelector('[data-r="' + Math.max(0, Math.min(n - 1, r + mv[0])) + '"][data-c="' + Math.max(0, Math.min(n - 1, cc + mv[1])) + '"]'); if (nx) nx.focus(); return; }
      var val = { s: 1, S: 1, x: 1, X: 1, o: 2, O: 2, w: 2, W: 2, Backspace: 0, Delete: 0 }[e.key];
      if (val === undefined || ht.revealed) return; e.preventDefault(); HT.set(r, cc, val);
    });
    HT.newPuzzle();
  },
  setSize: function (s) { ht.n = s; HT.newPuzzle(); },
  setDiff: function (d) { ht.diff = d; HT.newPuzzle(); },
  newPuzzle: function () {
    ht.data = htCreate(ht.n, ht.diff); ht.extras = []; ht.st = nRange(ht.n).map(function () { return new Array(ht.n).fill(0); }); ht.revealed = false;
    banner($('ht-feedback'), ''); HT.render();
  },
  render: function () {
    var n = ht.n, g = $('ht-grid'), an = ht.revealed ? null : htAnalyze(ht.data.grid, ht.st, n, false), h = '';
    g.style.setProperty('--nxn', n);
    for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) {
      var sv = ht.revealed ? (ht.data.solution[r][c] ? 1 : 0) : ht.st[r][c], v = ht.data.grid[r][c];
      h += '<button type="button" class="nx-cell' + (sv === 1 ? ' sh' : '') + (sv === 2 ? ' ci' : '') + (an && an.conf[r + ',' + c] ? ' conflict' : '') + '" data-r="' + r + '" data-c="' + c + '" aria-label="Zeile ' + (r + 1) + ' Spalte ' + (c + 1) + ': Zahl ' + v + (sv === 1 ? ', geschwärzt' : sv === 2 ? ', sichtbar markiert' : '') + '">' + v + '</button>';
    }
    g.innerHTML = h; $('ht-badge').textContent = n + '×' + n + ' · ' + DIFFS[ht.diff];
    nxChips('ht-sizes', 'data-v', n); nxChips('ht-diffs', 'data-v', ht.diff); nxPersist();
  },
  set: function (r, c, v) {
    if (ht.revealed) return; ht.st[r][c] = v; HT.render();
    var cell = $('ht-grid').querySelector('[data-r="' + r + '"][data-c="' + c + '"]'); if (cell) cell.focus();
    var a = htAnalyze(ht.data.grid, ht.st, ht.n);
    banner($('ht-feedback'), a.solved ? 'Alle Einträge sind korrekt. Das Rätsel ist gelöst!' : '', 'success');
  },
  check: function () {
    if (ht.revealed) return; var a = htAnalyze(ht.data.grid, ht.st, ht.n);
    rsCheck('ht-feedback', a.nConf, 0, a.solved, 'Bisher kein Fehler – die sichtbaren Felder hängen aber noch nicht alle zusammen.', a.nConf ? 'Doppelte sichtbare Zahlen oder sich berührende schwarze Felder.' : '');
  },
  hint: function () {
    if (ht.revealed) return; var opts = [];
    for (var r = 0; r < ht.n; r++) for (var c = 0; c < ht.n; c++) if ((ht.st[r][c] === 1) !== !!ht.data.solution[r][c]) opts.push([r, c]);
    if (!opts.length) { HT.check(); return; }
    var p = opts[rnd(opts.length)], sh = !!ht.data.solution[p[0]][p[1]]; HT.set(p[0], p[1], sh ? 1 : 2);
    banner($('ht-feedback'), 'Tipp: Zeile ' + (p[0] + 1) + ', Spalte ' + (p[1] + 1) + (sh ? ' wird geschwärzt.' : ' bleibt sichtbar.'), 'info');
  },
  reveal: function () { ht.revealed = !ht.revealed; HT.render(); banner($('ht-feedback'), ht.revealed ? 'Lösung wird angezeigt (eine mögliche Lösung).' : '', 'info'); },
  clear: function () { ht.st = nRange(ht.n).map(function () { return new Array(ht.n).fill(0); }); ht.revealed = false; banner($('ht-feedback'), ''); HT.render(); }
};

/* --- Magisches Quadrat --- */
function mgVals() { return mg.revealed ? mg.data.solution : mg.entries; }
window.NXMG = {
  init: function () { nxSizes('mg-sizes', MG_SIZES, 'NXMG.setSize'); nxDiffs('mg-diffs', 'NXMG.setDiff'); NXMG.newPuzzle(); nxPad('mg', 'mg-grid', function () { return mg.n * mg.n; }); },
  setSize: function (s) { mg.n = s; NXMG.newPuzzle(); },
  setDiff: function (d) { mg.diff = d; NXMG.newPuzzle(); },
  newPuzzle: function () {
    mg.data = mgCreate(mg.n, mg.diff); mg.extras = []; mg.entries = copyM(mg.data.givens); mg.revealed = false; banner($('mg-feedback'), ''); NXMG.build();
  },
  build: function () {
    var n = mg.n, g = $('mg-grid'), vals = mgVals(); g.style.setProperty('--nxn', n + 1); g.innerHTML = ''; mg.els = [];
    function sumEl(k) { var d = document.createElement('div'); d.className = 'nx-sum'; d.dataset.k = k; return d; }
    for (var r = 0; r < n; r++) {
      mg.els.push([]);
      for (var c = 0; c < n; c++) {
        var d = document.createElement('div'), given = mg.data.givens[r][c] > 0; d.className = 'nx-cell' + (given ? ' given' : ''); d.dataset.r = r; d.dataset.c = c;
        if (given || mg.revealed) { d.textContent = vals[r][c]; if (mg.revealed && !given) d.classList.add('rev'); }
        else {
          var inp = document.createElement('input'); inp.type = 'text'; inp.inputMode = NX_IM; inp.maxLength = 2; inp.autocomplete = 'off'; inp.setAttribute('aria-label', 'Zeile ' + (r + 1) + ' Spalte ' + (c + 1));
          if (mg.entries[r][c]) inp.value = mg.entries[r][c];
          (function (rr, cc, el) {
            el.addEventListener('input', function () { var t = el.value.replace(/\D/g, '').slice(0, 2); el.value = t; mg.entries[rr][cc] = t ? +t : 0; NXMG.refresh(true); nxPersist(); });
            el.addEventListener('keydown', function (e) { var mv = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[e.key]; if (!mv) return; var tr = Math.max(0, Math.min(mg.n - 1, rr + mv[0])), tc = Math.max(0, Math.min(mg.n - 1, cc + mv[1])), t2 = mg.els[tr][tc]; if (t2) { var i2 = t2.querySelector('input'); if (i2) { e.preventDefault(); i2.focus(); i2.select(); } } });
          })(r, c, inp);
          d.appendChild(inp);
        }
        g.appendChild(d); mg.els[r].push(d);
      }
      g.appendChild(sumEl('r' + r));
    }
    for (c = 0; c < n; c++) g.appendChild(sumEl('c' + c));
    g.appendChild(sumEl('d1'));
    $('mg-badge').textContent = n + '×' + n + ' · ' + DIFFS[mg.diff];
    nxChips('mg-sizes', 'data-v', n); nxChips('mg-diffs', 'data-v', mg.diff); NXMG.refresh(false); nxPersist();
  },
  refresh: function (announce) {
    var n = mg.n, a = mgAnalyze(mgVals(), n), g = $('mg-grid');
    for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) mg.els[r][c].classList.toggle('conflict', !mg.revealed && !!a.conf[r + ',' + c]);
    function put(k, v) { var e = g.querySelector('[data-k="' + k + '"]'); if (!e) return; e.textContent = v === null ? '' : v; e.className = 'nx-sum' + (v === null ? '' : v === a.M ? ' ok' : ' bad'); }
    for (var i = 0; i < n; i++) { put('r' + i, a.rowS[i]); put('c' + i, a.colS[i]); } put('d1', a.d1);
    $('mg-info').innerHTML = 'Magische Zahl: <b>' + a.M + '</b> · Diagonale ↘ ' + (a.d1 === null ? '–' : a.d1) + ' · Diagonale ↗ ' + (a.d2 === null ? '–' : a.d2);
    if (announce) banner($('mg-feedback'), a.solved ? 'Alle Einträge sind korrekt. Das Rätsel ist gelöst!' : '', 'success');
  },
  check: function () {
    if (mg.revealed) return; var a = mgAnalyze(mg.entries, mg.n);
    rsCheck('mg-feedback', a.nConf || a.badLines, a.empty, a.solved, null, a.nConf ? 'Doppelte Zahlen oder Zahlen außerhalb von 1 bis ' + (mg.n * mg.n) + '.' : 'Eine Zeile, Spalte oder Diagonale hat nicht die Summe ' + a.M + '.');
  },
  hint: function () {
    if (mg.revealed) return; var opts = [];
    for (var r = 0; r < mg.n; r++) for (var c = 0; c < mg.n; c++) if (!mg.data.givens[r][c] && mg.entries[r][c] !== mg.data.solution[r][c]) opts.push([r, c]);
    if (!opts.length) { NXMG.check(); return; }
    var p = opts[rnd(opts.length)]; mg.entries[p[0]][p[1]] = mg.data.solution[p[0]][p[1]];
    var inp = mg.els[p[0]][p[1]].querySelector('input'); if (inp) inp.value = mg.entries[p[0]][p[1]];
    NXMG.refresh(true); nxPersist(); banner($('mg-feedback'), 'Tipp: Zeile ' + (p[0] + 1) + ', Spalte ' + (p[1] + 1) + ' wurde ausgefüllt.', 'info');
  },
  reveal: function () { mg.revealed = !mg.revealed; NXMG.build(); banner($('mg-feedback'), mg.revealed ? 'Lösung wird angezeigt (eine mögliche Lösung).' : '', 'info'); },
  clear: function () { mg.entries = copyM(mg.data.givens); mg.revealed = false; banner($('mg-feedback'), ''); NXMG.build(); }
};

/* --- Zahlenmauer --- */
function mwVals() { return mw.revealed ? mw.data.cells.map(function (r) { return r.slice(); }) : mw.entries; }
function mwFit(el, len) { el.style.fontSize = 'calc(var(--cw) * ' + Math.min(0.36, 1.5 / Math.max(3, len)).toFixed(3) + ')'; }
window.MW = {
  init: function () {
    $('mw-ops').innerHTML = OP_KEYS.map(function (k) { return '<button type="button" class="chip-btn" data-v="' + k + '" onclick="MW.setOp(\'' + k + '\')">' + OP_LABEL[k] + ' (' + OP_SIGN[k] + ')</button>'; }).join('');
    nxDiffs('mw-diffs', 'MW.setDiff'); MW.sizes(); MW.newPuzzle(); nxPad('mw', 'mw-wrap', null);
  },
  sizes: function () { var l = []; for (var s = 3; s <= MW_MAX[mw.op]; s++) l.push(s); $('mw-sizes').innerHTML = l.map(function (s) { return '<button type="button" class="chip-btn" data-v="' + s + '" onclick="MW.setSize(' + s + ')">' + s + ' Zeilen</button>'; }).join(''); },
  setOp: function (op) { mw.op = op; mw.n = Math.min(mw.n, MW_MAX[op]); MW.sizes(); MW.newPuzzle(); },
  setSize: function (s) { mw.n = s; MW.newPuzzle(); },
  setDiff: function (d) { mw.diff = d; MW.newPuzzle(); },
  newPuzzle: function () {
    mw.n = Math.min(mw.n, MW_MAX[mw.op]); mw.data = mwCreate(mw.n, mw.diff, mw.op); mw.extras = [];
    mw.entries = mw.data.cells.map(function (r, i) { return r.map(function (v, j) { return mw.data.given[i][j] ? v : null; }); }); mw.revealed = false;
    banner($('mw-feedback'), ''); MW.build();
  },
  build: function () {
    var n = mw.n, box = $('mw-wrap'), vals = mwVals(); mw.els = [];
    box.innerHTML = '<div class="nw-pyr" style="--nwn:' + n + '"></div>'; var pyr = box.firstChild;
    for (var i = 0; i < n; i++) {
      var row = document.createElement('div'); row.className = 'nw-row'; mw.els.push([]);
      for (var j = 0; j <= i; j++) {
        var d = document.createElement('div'), given = mw.data.given[i][j]; d.className = 'nw-cell' + (given ? ' given' : '');
        if (given || mw.revealed) { d.textContent = mw.data.cells[i][j]; mwFit(d, String(mw.data.cells[i][j]).length); if (mw.revealed && !given) d.classList.add('rev'); }
        else {
          var inp = document.createElement('input'); inp.type = 'text'; inp.inputMode = NX_IM; inp.maxLength = 8; inp.autocomplete = 'off'; inp.setAttribute('aria-label', 'Stein Zeile ' + (i + 1) + ', Position ' + (j + 1));
          if (mw.entries[i][j] !== null) { inp.value = mw.entries[i][j]; mwFit(d, String(inp.value).length); }
          (function (ii, jj, el, cell) {
            el.addEventListener('input', function () { var t = el.value.replace(/\D/g, '').slice(0, 8); el.value = t; mw.entries[ii][jj] = t === '' ? null : +t; mwFit(cell, t.length); MW.refresh(true); nxPersist(); });
            el.addEventListener('keydown', function (e) {
              var mv = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[e.key]; if (!mv) return;
              var tr = Math.max(0, Math.min(mw.n - 1, ii + mv[0])), tc = Math.max(0, Math.min(tr, jj + mv[1] + (mv[0] === 1 ? 0 : 0))); if (mv[0] === -1) tc = Math.min(tc, tr);
              var t2 = mw.els[tr] && mw.els[tr][tc]; if (t2) { var i2 = t2.querySelector('input'); if (i2) { e.preventDefault(); i2.focus(); i2.select(); } }
            });
          })(i, j, inp, d);
          d.appendChild(inp);
        }
        row.appendChild(d); mw.els[i].push(d);
      }
      pyr.appendChild(row);
    }
    $('mw-badge').textContent = n + ' Zeilen · ' + OP_LABEL[mw.op] + ' · ' + DIFFS[mw.diff];
    $('mw-oprule').innerHTML = 'Rechenart <b>' + OP_LABEL[mw.op] + ' (' + OP_SIGN[mw.op] + ')</b>: Jeder Stein ist gleich ' + OP_DESC[mw.op] + ' der beiden Steine direkt darunter.';
    nxChips('mw-ops', 'data-v', mw.op); nxChips('mw-sizes', 'data-v', n); nxChips('mw-diffs', 'data-v', mw.diff); MW.refresh(false); nxPersist();
  },
  refresh: function (announce) {
    var a = mwAnalyze(mw.op, mwVals());
    for (var i = 0; i < mw.n; i++) for (var j = 0; j <= i; j++) mw.els[i][j].classList.toggle('conflict', !mw.revealed && !!a.conf[i + ',' + j]);
    if (announce) banner($('mw-feedback'), a.solved ? 'Alle Einträge sind korrekt. Das Rätsel ist gelöst!' : '', 'success');
  },
  check: function () {
    if (mw.revealed) return; var a = mwAnalyze(mw.op, mw.entries);
    rsCheck('mw-feedback', a.nConf, a.empty, a.solved, null, 'Ein Stein passt nicht zu den beiden darunter.');
  },
  hint: function () {
    if (mw.revealed) return; var opts = [];
    for (var i = 0; i < mw.n; i++) for (var j = 0; j <= i; j++) if (!mw.data.given[i][j] && mw.entries[i][j] !== mw.data.cells[i][j]) opts.push([i, j]);
    if (!opts.length) { MW.check(); return; }
    var p = opts[rnd(opts.length)]; mw.entries[p[0]][p[1]] = mw.data.cells[p[0]][p[1]];
    var inp = mw.els[p[0]][p[1]].querySelector('input'); if (inp) { inp.value = mw.entries[p[0]][p[1]]; mwFit(mw.els[p[0]][p[1]], String(inp.value).length); }
    MW.refresh(true); nxPersist(); banner($('mw-feedback'), 'Tipp: Ein Stein in Zeile ' + (p[0] + 1) + ' (von oben) wurde ausgefüllt.', 'info');
  },
  reveal: function () { mw.revealed = !mw.revealed; MW.build(); banner($('mw-feedback'), mw.revealed ? 'Lösung wird angezeigt (eine mögliche Lösung).' : '', 'info'); },
  clear: function () { mw.entries = mw.data.cells.map(function (r, i) { return r.map(function (v, j) { return mw.data.given[i][j] ? v : null; }); }); mw.revealed = false; banner($('mw-feedback'), ''); MW.build(); }
};
