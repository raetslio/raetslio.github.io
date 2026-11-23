/* ======================================================================
   Spielverlauf (angefangene Rätsel)
   Merkt angefangene Rätsel und öffnet sie zum Weiterspielen.
   ====================================================================== */
'use strict';

var GV_KEY = 'raetsel_heft_spiele', GV_MAX = 60, gvSuppress = {};
function gvLoad() {
  try { var d = JSON.parse(localStorage.getItem(GV_KEY) || 'null'); if (d && Array.isArray(d.items)) { if (!d.del || Array.isArray(d.del)) d.del = {}; return d; } } catch (e) {}
  return { items: [], del: {} };
}
function gvSave(d) {
  d.items.sort(function (a, b) { return b.t - a.t; }); d.items = d.items.slice(0, GV_MAX);
  var ids = Object.keys(d.del).sort(function (a, b) { return d.del[b] - d.del[a]; }).slice(0, 200), nd = {}; ids.forEach(function (i) { nd[i] = d.del[i]; }); d.del = nd;
  for (var i = 0; i < 40; i++) {
    try { localStorage.setItem(GV_KEY, JSON.stringify(d)); return true; } catch (e) { if (d.items.length <= 1) return false; d.items.pop(); }
  }
  return false;
}
function gvCopy(a) { return JSON.parse(JSON.stringify(a)); }
/* Momentaufnahme des aktuell geöffneten Rätsels einer Art (oder null) */
function gvSnap(type) {
  var A = window.appState, e = null;
  if (type === 'sudoku') {
    var s = A.sudoku; if (!s.solution || !s.solution.length || !s.entries || !s.entries.length) return null;
    var emp = 0, fil = 0;
    for (var r = 0; r < s.size; r++) for (var c = 0; c < s.size; c++) if (!s.givens[r][c]) { emp++; if (s.entries[r][c] > 0) fil++; }
    var notes = (s.notes && s.notesFor === s.solution) ? s.notes : null;
    e = { id: 'sudoku_' + djb(JSON.stringify(s.givens)), type: 'sudoku', size: s.size, diff: Math.max(0, DIFF_KEYS.indexOf(s.difficulty)), started: fil > 0,
      done: fil > 0 && window.isSudokuCompleteAndValid(), pct: emp ? Math.round(fil / emp * 100) : 0,
      sig: djb(JSON.stringify(s.entries) + JSON.stringify(notes || 0)) + ':' + Math.floor((s.elapsedSec || 0) / 30),
      data: { size: s.size, subR: s.subR, subC: s.subC, difficulty: s.difficulty, solution: s.solution, givens: s.givens },
      state: { entries: s.entries, notes: notes, elapsedSec: s.elapsedSec || 0 } };
  } else if (type === 'ws') {
    var w = A.ws; if (!w.grid || !w.grid.length || !w.placements) return null;
    var tot = w.placements.length, fnd = (w.foundIds || []).length;
    e = { id: 'ws_' + djb(JSON.stringify(w.grid)), type: 'ws', size: w.size, diff: wsDiff({ size: w.size, rev: !!(w.dirs && w.dirs.r) }), started: fnd > 0,
      done: tot > 0 && fnd === tot, pct: tot ? Math.round(fnd / tot * 100) : 0, sig: (w.foundIds || []).join(','),
      data: { size: w.size, grid: w.grid, placements: w.placements, wordsRaw: w.wordsRaw, dirs: w.dirs, umlautDirect: w.umlautDirect, unplaced: w.unplaced || [] },
      state: { foundIds: w.foundIds || [] } };
  } else if (type === 'binoxxo') {
    if (!bx.data || !bx.entries.length) return null;
    var be = 0, bf = 0, ok = true;
    for (var br = 0; br < bx.n; br++) for (var bc = 0; bc < bx.n; bc++) { if (bx.data.givens[br][bc] < 0) { be++; if (bx.entries[br][bc] >= 0) bf++; } if (bx.entries[br][bc] !== bx.data.solution[br][bc]) ok = false; }
    e = { id: 'binoxxo_' + djb(JSON.stringify(bx.data.givens)), type: 'binoxxo', size: bx.n, diff: bx.diff, started: bf > 0, done: ok && bf > 0, pct: be ? Math.round(bf / be * 100) : 0,
      sig: djb(JSON.stringify(bx.entries)), data: { n: bx.n, diff: bx.diff, data: bx.data }, state: { entries: bx.entries } };
  } else if (NXT[type]) {
    e = NXT[type].gvSnap();
  } else {
    if (!mz.data) return null;
    e = { id: 'maze_' + mz.n + '_' + djb(mz.data.path.join(',')), type: 'maze', size: mz.n, diff: mazeDiff(mz.n, mz.data.h), started: mz.steps > 0, done: !!mz.won, pct: mz.won ? 100 : 0,
      sig: mz.pos + ':' + mz.steps + ':' + (mz.won ? 1 : 0), data: { n: mz.n, data: mz.data }, state: { pos: mz.pos, trail: mz.trail, steps: mz.steps, won: !!mz.won } };
  }
  return e;
}
function gvRecordAll() {
  if (!window.__rsInit) return;
  var d = gvLoad(), changed = false;
  GV_TYPES.forEach(function (t) {
    var e; try { e = gvSnap(t); } catch (x) { return; }
    if (!e) return;
    var i = -1; d.items.forEach(function (x, k) { if (x.id === e.id) i = k; });
    if (i < 0 && !e.started) return;
    if (i >= 0 && d.items[i].sig === e.sig) return;
    if (i < 0 && gvSuppress[e.id] === e.sig) return;
    delete gvSuppress[e.id];
    e = gvCopy(e); e.t = Date.now(); e.created = i >= 0 ? (d.items[i].created || e.t) : e.t;
    if (i >= 0) d.items[i] = e; else d.items.unshift(e);
    changed = true;
  });
  if (changed) { gvSave(d); gvRender(); }
}
function gvCurrentIds() {
  var out = [];
  GV_TYPES.forEach(function (t) { try { var e = gvSnap(t); if (e) out.push(e.id); } catch (x) {} });
  return out;
}
function gvMsg(t, k) { banner($('gv-status'), t, k || 'info'); }
function gvFmtTime(sec) { return String(Math.floor(sec / 60)).padStart(2, '0') + ':' + String(sec % 60).padStart(2, '0'); }
function gvRender() {
  var box = $('gv-list'); if (!box) return;
  var d = gvLoad(), cur = gvCurrentIds(), ft = $('gv-f-type').value, fs = $('gv-f-status').value;
  $('gv-count').textContent = String(d.items.length);
  var items = d.items.filter(function (i) { return (ft === 'all' || i.type === ft) && (fs === 'all' || (fs === 'done') === !!i.done); });
  box.innerHTML = items.length ? items.map(function (it) {
    var dt = new Date(it.t).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    var info = it.type === 'maze' ? (it.done ? 'Ziel erreicht in ' + it.state.steps + ' Schritten' : 'Schritte bisher: ' + (it.state.steps || 0)) : it.pct + ' % ' + (it.type === 'ws' ? 'gefunden' : 'ausgefüllt');
    if (it.type === 'sudoku' && it.state.elapsedSec) info += ' · Zeit ' + gvFmtTime(it.state.elapsedSec);
    var bar = it.type === 'maze' ? (it.done ? 100 : 0) : it.pct;
    var b = function (a, l, cls) { return '<button type="button" class="btn btn-sm' + (cls ? ' ' + cls : '') + '" data-id="' + esc(it.id) + '" data-a="' + a + '">' + l + '</button>'; };
    return '<div class="hv-item"><div style="flex:1;min-width:210px"><strong>' + TYPE_LABEL[it.type] + ' ' + sizeTxt(it.type, it.size) + '</strong> · ' + DIFFS[it.diff] +
      (cur.indexOf(it.id) >= 0 ? ' <span class="tag">Geöffnet</span>' : '') + (it.done ? ' <span class="tag">Gelöst</span>' : '') +
      '<br><span class="label">Zuletzt gespielt ' + dt + ' Uhr · ' + info + '</span><div class="gv-bar" role="img" aria-label="Fortschritt ' + bar + ' Prozent"><span style="width:' + bar + '%"></span></div></div>' +
      '<div class="hv-act">' + b('open', it.done ? 'Erneut öffnen' : 'Weiterspielen', it.done ? '' : 'btn-primary') + b('del', 'Entfernen') + '</div></div>';
  }).join('') : '<div class="bk-empty">' + (d.items.length ? 'Keine Rätsel für diesen Filter.' : 'Noch keine angefangenen Rätsel. Trage in einem Rätsel etwas ein – es erscheint dann hier automatisch.') + '</div>';
}
function gvOpen(it) {
  var A = window.appState, d = it.data, st = it.state, $v = function (id, v) { var e = $(id); if (e) e.value = v; };
  if (it.type === 'sudoku') {
    var s = A.sudoku;
    s.size = d.size; s.subR = d.subR; s.subC = d.subC; s.difficulty = d.difficulty || 'leicht';
    s.solution = d.solution; s.givens = d.givens; s.entries = st.entries; s.checkedStatus = null; s.revealed = false; s.selected = null;
    s.elapsedSec = st.elapsedSec || 0; s.extraPuzzles = []; s.cellZoom = window.autoZoomForSudokuSize(d.size);
    s.notes = st.notes || null; s.notesFor = st.notes ? s.solution : null;
    $v('sudoku-size-input', String(d.size)); $v('sudoku-zoom-slider', String(s.cellZoom));
    var zv = $('sudoku-zoom-val'); if (zv) zv.textContent = s.cellZoom + ' px';
    document.querySelectorAll('#sudoku-diff-segmented .seg-btn').forEach(function (bb) { bb.setAttribute('aria-pressed', bb.dataset.diff === s.difficulty ? 'true' : 'false'); });
    var dh = $('sudoku-diff-hint'); if (dh && window.DIFF_CONFIG[s.difficulty]) dh.textContent = window.DIFF_CONFIG[s.difficulty].hint;
    window.onSudokuSizeInput(d.size); window.hideSudokuFeedback();
    var cw = $('btn-clear-wrong'); if (cw) cw.classList.add('hidden');
    window.renderSudokuAll(); window.updateSudokuTimerDisplay();
    window.switchMode('sudoku');
  } else if (it.type === 'ws') {
    var w = A.ws;
    w.size = d.size; w.wordsRaw = d.wordsRaw || ''; w.dirs = d.dirs; w.umlautDirect = !!d.umlautDirect; w.grid = d.grid; w.placements = d.placements; w.unplaced = d.unplaced || [];
    w.foundIds = st.foundIds || []; w.revealed = false; w.startCell = null;
    $v('ws-size-input', String(d.size)); var sl = $('ws-size-label'); if (sl) sl.textContent = d.size + '×' + d.size; $v('ws-words-input', w.wordsRaw);
    [['dir-h', 'h'], ['dir-v', 'v'], ['dir-d', 'd'], ['dir-r', 'r']].forEach(function (p) { var c = $(p[0]); if (c) c.checked = !!w.dirs[p[1]]; });
    var ut = $('ws-umlaut-toggle'); if (ut) ut.checked = w.umlautDirect;
    window.renderWsAll(); window.hideWsFeedback();
    window.switchMode('wortsuche');
  } else if (it.type === 'binoxxo') {
    bx.n = d.n; bx.diff = d.diff; bx.data = d.data; bx.entries = st.entries; bx.revealed = false; bx.wrong = {}; bx.extras = [];
    banner($('bx-feedback'), ''); BX.render();
    window.switchMode('binoxxo');
  } else if (NXT[it.type]) {
    NXT[it.type].gvOpen(d, st); window.switchMode(it.type);
  } else {
    mz.n = d.n; mz.hard = (d.data && d.data.h) || 0; mz.data = d.data; mz.extras = [];
    mz.pos = st.pos || 0; mz.trail = (st.trail && st.trail.length) ? st.trail : [0]; mz.steps = st.steps || 0; mz.won = !!st.won; mz.sol = false;
    MZ.restart(true);
    window.switchMode('labyrinth');
  }
  if (window.schedulePersist) window.schedulePersist();
}
function gvInit() {
  var box = $('gv-list'); if (!box) return;
  box.addEventListener('click', function (e) {
    var btn = e.target.closest('button[data-a]'); if (!btn) return;
    var d = gvLoad(), it = d.items.filter(function (x) { return x.id === btn.dataset.id; })[0]; if (!it) return;
    if (btn.dataset.a === 'open') { try { gvOpen(it); } catch (err) { gvMsg('Das Rätsel konnte nicht geöffnet werden: ' + err.message, 'error'); } }
    else if (btn.dataset.a === 'del') {
      gvSuppress[it.id] = it.sig;
      d.items = d.items.filter(function (x) { return x.id !== it.id; }); d.del[it.id] = Date.now(); gvSave(d); gvRender();
    }
  });
  $('gv-f-type').addEventListener('change', gvRender); $('gv-f-status').addEventListener('change', gvRender);
  function clearWhere(pred, text, label) {
    var d = gvLoad(), n = d.items.filter(pred).length;
    if (!n) { gvMsg('Es gibt nichts zu entfernen.', 'info'); return; }
    BK.dialog('<h3 class="section-title" style="margin:0 0 8px">Spielverlauf <strong>aufräumen</strong>?</h3><p>' + n + (n === 1 ? ' Eintrag wird' : ' Einträge werden') + ' ' + text + ' Der Fortschritt darin geht verloren.</p>', function () {
      var dd = gvLoad(), now = Date.now();
      dd.items = dd.items.filter(function (x) { if (pred(x)) { dd.del[x.id] = now; gvSuppress[x.id] = x.sig; return false; } return true; });
      gvSave(dd); gvRender();
    }, label);
  }
  $('gv-clear-done').addEventListener('click', function () { clearWhere(function (x) { return !!x.done; }, 'entfernt (nur gelöste Rätsel).', 'Gelöste entfernen'); });
  $('gv-clear').addEventListener('click', function () { clearWhere(function () { return true; }, 'entfernt.', 'Alle entfernen'); });
  var origSave = window.saveStateToHost;
  window.saveStateToHost = function () { try { gvRecordAll(); } catch (x) {} return origSave.apply(this, arguments); };
  gvRender();
}
window.GV = { render: gvRender, merge: function (a, b) { return hvMerge(a, b, GV_MAX); } };
