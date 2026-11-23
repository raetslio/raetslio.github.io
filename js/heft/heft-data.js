/* ======================================================================
   Rätselheft: Daten
   Speicherschlüssel, Standardwerte, Laden und Speichern von Heften.
   ====================================================================== */
'use strict';

var BK_KEY = 'raetsel_heft_v1', BK_IDX = 'raetsel_hefte_v2', BK_PRE = 'raetsel_heft_v2_';
function defaultOpts() { return { title: 'Mein Rätselheft', subtitle: 'Rätselspaß für zwischendurch', owner: '', sort: 'type', coverEl: {}, coverUseImage: false, coverImgMode: 'card', coverSudoku: true, format: 'a4', coverStyle: 'magazin', cover: true, coverArt: true, intro: true, introText: '', rules: true, rulesOff: {}, rulesText: {}, toc: true, pageNumbers: true, pageNumPos: 'center', runHeader: true, showMeta: true, notes: 0, pad: true, solutions: true, solPer: 4, accent: '#2f6fed' }; }
function freshBk(name) { return { id: newId(), name: name || 'Mein Heft', items: [], opts: defaultOpts(), counters: {}, cover: null, coverImage: null, extras: [] }; }
var bk = freshBk('Mein Heft'), bkIdx = { current: null, list: [] };
function idxSave() { try { localStorage.setItem(BK_IDX, JSON.stringify(bkIdx)); } catch (e) {} }
var saveWarned = false;
function bkSave() {
  try {
    localStorage.setItem(BK_PRE + bk.id, JSON.stringify(bk));
    var e = bkIdx.list.filter(function (x) { return x.id === bk.id; })[0]; if (e) e.name = bk.name; else bkIdx.list.push({ id: bk.id, name: bk.name });
    bkIdx.current = bk.id; idxSave(); saveWarned = false;
  } catch (err) { if (!saveWarned) { saveWarned = true; bkStatus('Speichern im Browser nicht möglich (Speicher voll?). Exportiere das Heft als Datei, um es zu sichern.', 'warning'); } }
}
function setBk(d) {
  var f = freshBk(d.name); Object.keys(f).forEach(function (k) { bk[k] = d[k] !== undefined ? d[k] : f[k]; });
  var so = d.opts || {}; if ('instructions' in so) { so.intro = so.rules = so.instructions; delete so.instructions; }
  bk.opts = Object.assign(defaultOpts(), so); bk.opts.rulesOff = bk.opts.rulesOff || {}; bk.opts.rulesText = bk.opts.rulesText || {}; bk.opts.coverEl = bk.opts.coverEl || {};
  bk.items = d.items || []; bk.counters = d.counters || {}; bk.extras = d.extras || []; bk.id = d.id || f.id;
}
function bkLoad() {
  var loaded = false;
  try {
    bkIdx = JSON.parse(localStorage.getItem(BK_IDX) || 'null') || { current: null, list: [] };
    if (bkIdx.current) { var d = JSON.parse(localStorage.getItem(BK_PRE + bkIdx.current) || 'null'); if (d) { setBk(d); loaded = true; } }
    if (!loaded) {
      var s = JSON.parse(localStorage.getItem(BK_KEY) || 'null');
      if (s && Array.isArray(s.items)) { s.name = 'Mein Heft'; setBk(s); loaded = true; }
    }
  } catch (e) {}
  if (!loaded) { setBk(freshBk('Mein Heft')); }
  if (!bkIdx.list.some(function (x) { return x.id === bk.id; })) bkIdx.list.push({ id: bk.id, name: bk.name });
}
function newId() { return 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function nextName(type) {
  var pool = NAME_POOL[type], i = bk.counters[type] || 0; bk.counters[type] = i + 1;
  return pool[i % pool.length] + (i >= pool.length ? ' ' + (Math.floor(i / pool.length) + 1) : '');
}
function wsDiff(d) {
  var s = d.size, v = s <= 12 ? 0 : s <= 18 ? 1 : s <= 26 ? 2 : 3;
  return Math.min(3, v + (d.rev ? 1 : 0));
}
function sizeLabel(it) {
  var d = it.data;
  if (it.type === 'mauer') return d.n + ' Zeilen · ' + OP_LABEL[d.op || (d.cells && d.op) || 'plus'];
  return it.type === 'ws' ? d.size + '×' + d.size : it.type === 'sudoku' ? d.n + '×' + d.n : d.n + '×' + d.n;
}
function autoPer(it) { var p = autoPer0(it); return bk.opts.format === 'a5' && p > 1 ? p / 2 : p; }
function autoPer0(it) {
  var d = it.data;
  if (it.type === 'sudoku') return d.n <= 6 ? 4 : d.n <= 12 ? 2 : 1;
  if (it.type === 'binoxxo') return d.n <= 8 ? 4 : 2;
  if (it.type === 'hitori') return d.n <= 8 ? 4 : 2;
  if (it.type === 'magic') return d.n <= 5 ? 4 : 2;
  if (it.type === 'mauer') return d.n <= 5 ? 4 : 2;
  if (it.type === 'ws') return d.size <= 12 ? 4 : d.size <= 20 ? 2 : 1;
  return d.n <= 12 ? 4 : d.n <= 25 ? 2 : 1;
}
function perOf(it) { return it.perPage === 'auto' || !it.perPage ? autoPer(it) : +it.perPage; }
function displayItems() {
  if (bk.opts.sort === 'manual') return bk.items.slice();
  var idx = {}; bk.items.forEach(function (it, i) { idx[it.id] = i; });
  var t = function (it) { return TYPE_ORDER.indexOf(it.type); };
  return bk.items.slice().sort(function (a, b) {
    var k = bk.opts.sort === 'diff' ? (a.diff - b.diff || t(a) - t(b)) : (t(a) - t(b) || a.diff - b.diff);
    return k || idx[a.id] - idx[b.id];
  });
}
function addItem(type, data, diff, name) {
  bk.items.push({ id: newId(), type: type, name: name || nextName(type), diff: diff, perPage: 'auto', data: data });
}
function wsGenerate(size) {
  var A = window.appState, ws = A.ws, keep = { size: ws.size, wordsRaw: ws.wordsRaw, dirs: ws.dirs, umlautDirect: ws.umlautDirect, grid: ws.grid, placements: ws.placements, unplaced: ws.unplaced, foundIds: ws.foundIds, revealed: ws.revealed };
  var out = null, warn = '';
  try {
    ws.size = size; ws.wordsRaw = $('bk-ws-words').value; ws.umlautDirect = $('bk-ws-uml').checked;
    ws.dirs = { h: $('bk-ws-h').checked, v: $('bk-ws-v').checked, d: $('bk-ws-d').checked, r: $('bk-ws-r').checked };
    if (!ws.dirs.h && !ws.dirs.v && !ws.dirs.d) ws.dirs.h = true;
    window.generateWordSearch(); out = wsSnapshot(); if (ws.unplaced && ws.unplaced.length) warn = ws.unplaced.length + ' Wort/Wörter passten nicht ins Gitter.';
  } finally {
    Object.keys(keep).forEach(function (k) { ws[k] = keep[k]; });
    try { window.renderWsAll(); } catch (e) {}
  }
  if (warn) bkStatus(warn, 'warning');
  return out && out.placements.length ? out : null;
}
function wsSnapshot() {
  var ws = window.appState.ws;
  if (!ws.grid || !ws.grid.length) return null;
  var words = ws.placements.map(function (p) { return p.word; }).sort(function (a, b) { return a.localeCompare(b, 'de'); });
  return { size: ws.size, grid: ws.grid.map(function (r) { return r.slice(); }),
    placements: ws.placements.map(function (p) { return { sr: p.sr, sc: p.sc, er: p.er, ec: p.ec, colorIdx: p.colorIdx, word: p.word }; }),
    words: words, rev: !!ws.dirs.r };
}
function readImage(f, max, cb) {
  var fr = new FileReader();
  fr.onload = function () {
    var img = new Image();
    img.onload = function () {
      var sc = Math.min(1, max / Math.max(img.width, img.height)), cv = document.createElement('canvas');
      cv.width = Math.round(img.width * sc); cv.height = Math.round(img.height * sc);
      var cx = cv.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, cv.width, cv.height); cx.drawImage(img, 0, 0, cv.width, cv.height);
      cb(cv.toDataURL('image/jpeg', 0.85), cv.width, cv.height);
    };
    img.onerror = function () { bkStatus('Das Bild konnte nicht gelesen werden.', 'error'); };
    img.src = fr.result;
  };
  fr.readAsDataURL(f);
}
var BK_SIZES = { sudoku: [4, 6, 9, 12, 16], binoxxo: [6, 8, 10, 12, 14], maze: [8, 10, 15, 20, 30, 40, 60, 80, 100], hitori: [5, 6, 7, 8, 9, 10, 12], magic: [3, 4, 5, 6, 7], mauer: [3, 4, 5, 6, 7] };
