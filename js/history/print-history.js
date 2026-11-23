/* ======================================================================
   Druckverlauf (Arbeitsblatt-Verlauf)
   Merkt gedruckte Blätter, druckt sie erneut und öffnet sie zum Online-Spielen.
   ====================================================================== */
'use strict';

var HV_KEY = 'raetsel_heft_verlauf', HV_MAX = 50;
function hvLoad() {
  try { var d = JSON.parse(localStorage.getItem(HV_KEY) || 'null'); if (d && Array.isArray(d.items)) { if (!d.del || Array.isArray(d.del)) d.del = {}; return d; } } catch (e) {}
  return { items: [], del: {} };
}
function hvSave(d) {
  d.items.sort(function (a, b) { return b.t - a.t; }); d.items = d.items.slice(0, HV_MAX);
  var ids = Object.keys(d.del).sort(function (a, b) { return d.del[b] - d.del[a]; }).slice(0, 200), nd = {}; ids.forEach(function (i) { nd[i] = d.del[i]; }); d.del = nd;
  for (var i = 0; i < 30; i++) {
    try { localStorage.setItem(HV_KEY, JSON.stringify(d)); return true; } catch (e) { if (d.items.length <= 1) return false; d.items.pop(); }
  }
  return false;
}
function hvMerge(a, b, max) {
  var del = {}; [a, b].forEach(function (x) { var m = (x && x.del && !Array.isArray(x.del)) ? x.del : {}; Object.keys(m).forEach(function (id) { del[id] = Math.max(del[id] || 0, m[id]); }); });
  var map = {};
  [a, b].forEach(function (x) { ((x && x.items) || []).forEach(function (it) { if (del[it.id] && del[it.id] >= it.t) return; var o = map[it.id]; if (!o || it.t > o.t) map[it.id] = it; }); });
  var items = Object.keys(map).map(function (k) { return map[k]; }).sort(function (x, y) { return y.t - x.t; }).slice(0, max || HV_MAX);
  return { items: items, del: del };
}
function djb(s) { var h = 5381; for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); }
function hvSnapshot() {
  var A = window.appState, md = A.mode, p = A.print, multi = p.multiPrint || 1, type, size, diff, data, key;
  var pr = { name: p.name, date: p.date, marginMm: p.marginMm, instrPt: p.instrPt, multiPrint: multi, solutionMode: p.solutionMode };
  if (md === 'sudoku') {
    var s = A.sudoku; if (!s.solution || !s.solution.length) return null;
    if (multi > 1) window.ensureSudokuExtraPuzzles(multi);
    type = 'sudoku'; size = s.size; diff = Math.max(0, DIFF_KEYS.indexOf(s.difficulty));
    data = { size: s.size, subR: s.subR, subC: s.subC, difficulty: s.difficulty, solution: s.solution, givens: s.givens, extras: (s.extraPuzzles || []).slice(0, multi - 1) };
    key = JSON.stringify(s.givens);
  } else if (md === 'wortsuche') {
    var w = A.ws; if (!w.grid || !w.grid.length) return null;
    type = 'ws'; size = w.size; diff = wsDiff({ size: w.size, rev: !!w.dirs.r });
    data = { size: w.size, grid: w.grid, placements: w.placements, umlautDirect: w.umlautDirect, dirs: w.dirs, unplaced: w.unplaced || [] };
    key = JSON.stringify(w.grid);
  } else if (md === 'binoxxo') {
    if (!bx.data) return null; extPuzzles('binoxxo', multi);
    type = 'binoxxo'; size = bx.n; diff = bx.diff;
    data = { n: bx.n, diff: bx.diff, data: bx.data, extras: (bx.extras || []).slice(0, multi - 1) };
    key = JSON.stringify(bx.data.givens);
  } else if (md === 'labyrinth') {
    if (!mz.data) return null; extPuzzles('maze', multi);
    type = 'maze'; size = mz.n; diff = mazeDiff(mz.n, mz.data.h);
    data = { n: mz.n, data: mz.data, extras: (mz.extras || []).slice(0, multi - 1) };
    key = mz.n + ':' + mz.data.path.join(',');
  } else if (NXT[md]) {
    var ns = NXT[md].hvSnap(multi); if (!ns) return null;
    type = md; size = ns.size; diff = ns.diff; data = ns.data; key = ns.key;
  } else return null;
  return { id: type + '_' + djb(key), t: Date.now(), type: type, size: size, diff: diff, print: pr, data: JSON.parse(JSON.stringify(data)) };
}
function hvRecord() {
  var e; try { e = hvSnapshot(); } catch (err) { return; }
  if (!e) return;
  var d = hvLoad(), i = -1; d.items.forEach(function (x, k) { if (x.id === e.id) i = k; });
  e.prints = i >= 0 ? (d.items[i].prints || 1) + 1 : 1;
  if (i >= 0) d.items[i] = e; else d.items.unshift(e);
  if (!hvSave(d)) bkStatus('Der Verlauf konnte nicht gespeichert werden (Speicher voll).', 'warning');
  hvRender();
}
function hvWith(it, fn) {
  var A = window.appState, o = { mode: A.mode, print: A.print, sudoku: A.sudoku, ws: A.ws },
    ob = { n: bx.n, diff: bx.diff, data: bx.data, extras: bx.extras }, om = { n: mz.n, hard: mz.hard, data: mz.data, extras: mz.extras }, onx = nxSave();
  try {
    A.print = Object.assign({}, A.print, it.print);
    var d = it.data;
    if (it.type === 'sudoku') { A.mode = 'sudoku'; A.sudoku = Object.assign({}, o.sudoku, { size: d.size, subR: d.subR, subC: d.subC, difficulty: d.difficulty, solution: d.solution, givens: d.givens, extraPuzzles: d.extras || [] }); }
    else if (it.type === 'ws') { A.mode = 'wortsuche'; A.ws = Object.assign({}, o.ws, { size: d.size, grid: d.grid, placements: d.placements, umlautDirect: d.umlautDirect, dirs: d.dirs, unplaced: d.unplaced || [] }); }
    else if (it.type === 'binoxxo') { A.mode = 'binoxxo'; bx.n = d.n; bx.diff = d.diff; bx.data = d.data; bx.extras = d.extras || []; }
    else if (NXT[it.type]) { A.mode = it.type; NXT[it.type].hvApply(d); }
    else { A.mode = 'labyrinth'; mz.n = d.n; mz.hard = (d.data && d.data.h) || 0; mz.data = d.data; mz.extras = d.extras || []; }
    return fn();
  } finally {
    A.mode = o.mode; A.print = o.print; A.sudoku = o.sudoku; A.ws = o.ws;
    bx.n = ob.n; bx.diff = ob.diff; bx.data = ob.data; bx.extras = ob.extras;
    mz.n = om.n; mz.hard = om.hard; mz.data = om.data; mz.extras = om.extras; nxRestoreRaw(onx);
  }
}
/* Rätsel aus dem Druckverlauf frisch online spielen (ohne Eingaben) */
function hvZeros(n) { var a = []; for (var i = 0; i < n; i++) a.push(new Array(n).fill(0)); return a; }
function hvPlay(it) {
  var d = it.data, st, item;
  if (it.type === 'sudoku') st = { entries: hvZeros(d.size), notes: null, elapsedSec: 0 };
  else if (it.type === 'ws') { st = { foundIds: [] }; d = Object.assign({ wordsRaw: (d.placements || []).map(function (p) { return p.word; }).join('\n') }, d); }
  else if (it.type === 'binoxxo') st = { entries: d.data.givens.map(function (r) { return r.slice(); }) };
  else if (it.type === 'maze') st = { pos: 0, trail: [0], steps: 0, won: false };
  else if (NXT[it.type]) st = { entries: NXT[it.type].fresh(d.data) };
  else return;
  item = { type: it.type, data: JSON.parse(JSON.stringify(d)), state: st };
  gvOpen(item);
}
function hvSheet(it, which) { return hvWith(it, function () { return window.buildA4SvgString(which, false); }); }
function hvPng(it, which) {
  var svg = hvSheet(it, which), w = 1654, h = 2339, img = new Image();
  img.onload = function () {
    var cv = document.createElement('canvas'); cv.width = w; cv.height = h; var cx = cv.getContext('2d');
    if (which !== 'overprint') { cx.fillStyle = '#ffffff'; cx.fillRect(0, 0, w, h); }
    cx.drawImage(img, 0, 0, w, h);
    var a = document.createElement('a'); a.href = cv.toDataURL('image/png');
    a.download = it.type + '_' + it.size + 'x' + it.size + '_' + (which === 'sheet1' ? 'arbeitsblatt' : which === 'sheet2' ? 'loesung' : 'ueberdruck') + '.png';
    document.body.appendChild(a); a.click(); a.remove();
  };
  img.onerror = function () { hvMsg('PNG konnte nicht erzeugt werden.', 'error'); };
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}
function hvMsg(t, k) { banner($('hv-status'), t, k || 'info'); }
function hvRender() {
  var box = $('hv-list'); if (!box) return;
  var d = hvLoad(); $('hv-count').textContent = String(d.items.length);
  box.innerHTML = d.items.length ? d.items.map(function (it) {
    var dt = new Date(it.t).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    var multi = it.print.multiPrint > 1 ? ' · ' + it.print.multiPrint + ' pro Blatt' : '';
    var b = function (a, l, cls) { return '<button type="button" class="btn btn-sm' + (cls ? ' ' + cls : '') + '" data-id="' + esc(it.id) + '" data-a="' + a + '">' + l + '</button>'; };
    return '<div class="hv-item"><div><strong>' + TYPE_LABEL[it.type] + ' ' + sizeTxt(it.type, it.size) + '</strong> · ' + DIFFS[it.diff] + multi + '<br><span class="label">' + dt + ' Uhr' + (it.print.name ? ' · ' + esc(it.print.name) : '') + (it.prints > 1 ? ' · ' + it.prints + '× gedruckt' : '') + '</span></div><div class="hv-act">' +
      b('sol', 'Lösung drucken', 'btn-primary') + (it.type === 'maze' || it.type === 'hitori' ? '' : b('ovp', 'Überdruck')) + b('ab', 'Arbeitsblatt erneut') + b('play', 'Online spielen', 'btn-sage') + b('png', 'Lösung als PNG') + b('del', 'Entfernen') + '</div></div>';
  }).join('') : '<div class="bk-empty">Noch nichts im Verlauf. Sobald du ein Arbeitsblatt über „Druckfenster &amp; Export“ druckst oder als PNG speicherst, erscheint es hier.</div>';
}
function hvInit() {
  var box = $('hv-list'); if (!box) return;
  box.addEventListener('click', function (e) {
    var btn = e.target.closest('button[data-a]'); if (!btn) return;
    var d = hvLoad(), it = d.items.filter(function (x) { return x.id === btn.dataset.id; })[0]; if (!it) return;
    var a = btn.dataset.a;
    try {
      if (a === 'sol') { printSvgs([hvSheet(it, 'sheet2')]); hvMsg('Druckdialog für das Lösungsblatt geöffnet.', 'info'); }
      else if (a === 'ovp' && it.type !== 'maze' && it.type !== 'hitori') { printSvgs([hvSheet(it, 'overprint')]); hvMsg('Überdruck: im Druckdialog bitte „Tatsächliche Größe“ (100 %) wählen und das bedruckte Blatt passgenau einlegen.', 'info'); }
      else if (a === 'ab') { printSvgs([hvSheet(it, 'sheet1')]); hvMsg('Druckdialog für das Arbeitsblatt geöffnet.', 'info'); }
      else if (a === 'play') { hvPlay(it); }
      else if (a === 'png') hvPng(it, 'sheet2');
      else if (a === 'del') { d.items = d.items.filter(function (x) { return x.id !== it.id; }); d.del[it.id] = Date.now(); hvSave(d); hvRender(); }
    } catch (err) { hvMsg('Das Blatt konnte nicht erzeugt werden: ' + err.message, 'error'); }
  });
  $('hv-clear').addEventListener('click', function () {
    var d = hvLoad(); if (!d.items.length) { hvMsg('Der Verlauf ist bereits leer.', 'info'); return; }
    BK.dialog('<h3 class="section-title" style="margin:0 0 8px">Verlauf <strong>leeren</strong>?</h3><p>Alle ' + d.items.length + ' Einträge werden entfernt. Die Lösungen dieser Blätter können danach nicht mehr nachgedruckt werden.</p>', function () {
      var dd = hvLoad(), now = Date.now(); dd.items.forEach(function (x) { dd.del[x.id] = now; }); dd.items = []; hvSave(dd); hvRender();
    }, 'Verlauf leeren');
  });
  hvRender();
}
window.HV = { render: hvRender, merge: hvMerge, record: hvRecord };
var origExecPrint = window.executePdfPrint;
window.executePdfPrint = function (mode) { if (mode !== 'overprint') hvRecord(); return origExecPrint.apply(this, arguments); };
var origDownloadPng = window.downloadSheetPng;
window.downloadSheetPng = function (t) { if (t === 'sheet1') hvRecord(); return origDownloadPng.apply(this, arguments); };
