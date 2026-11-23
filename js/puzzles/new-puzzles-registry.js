/* ======================================================================
   Neue Rätselarten: Register NXT
   Verbindet die neuen Rätselarten mit Heft, Druckfenster, Druckverlauf und Spielverlauf.
   ====================================================================== */
'use strict';

function nxExtras(s, multi, mk) { s.extras = s.extras || []; while (s.extras.length < multi - 1) s.extras.push(mk()); return [s.data].concat(s.extras); }
function nxGv(type, s, ent, fillCount, emptyCount, solved) {
  var e = { id: type + '_' + djb(JSON.stringify(s.data)), type: type, size: s.n, diff: s.diff, started: fillCount > 0, done: solved && fillCount > 0, pct: emptyCount ? Math.min(100, Math.round(fillCount / emptyCount * 100)) : 0,
    sig: djb(JSON.stringify(ent)), data: { n: s.n, diff: s.diff, op: s.op, data: s.data }, state: { entries: ent } };
  return e;
}
var NXT = {
  hitori: {
    label: 'Hitori', sizes: HT_SIZES, defSize: 8, draw: htDraw,
    create: function (n, diff) { return htCreate(n, diff); },
    current: function () { return ht.data ? { data: ht.data, diff: ht.diff } : null; },
    sheetInfo: function () { return { title: 'Hitori ' + ht.n + '×' + ht.n, diff: ht.diff }; },
    prefix: function () { return 'hitori_' + ht.n + 'x' + ht.n; },
    extras: function (multi) { return nxExtras(ht, multi, function () { return htCreate(ht.n, ht.diff); }); },
    hvSnap: function (multi) { if (!ht.data) return null; NXT.hitori.extras(multi); return { size: ht.n, diff: ht.diff, key: JSON.stringify(ht.data.grid), data: { n: ht.n, diff: ht.diff, data: ht.data, extras: ht.extras.slice(0, multi - 1) } }; },
    hvApply: function (d) { ht.n = d.n; ht.diff = d.diff; ht.data = d.data; ht.extras = d.extras || []; },
    gvSnap: function () {
      if (!ht.data || !ht.st.length) return null; var t = 0, sh = 0, a = htAnalyze(ht.data.grid, ht.st, ht.n);
      ht.st.forEach(function (r) { r.forEach(function (v) { if (v) t++; if (v === 1) sh++; }); });
      var solSh = 0; ht.data.solution.forEach(function (r) { r.forEach(function (v) { if (v) solSh++; }); });
      var e = nxGv('hitori', ht, ht.st, t, 0, a.solved); e.pct = a.solved ? 100 : Math.min(99, Math.round(Math.min(1, sh / Math.max(1, solSh)) * 100)); e.started = t > 0; return e;
    },
    fresh: function (dd) { return nRange(dd.n).map(function () { return new Array(dd.n).fill(0); }); },
    gvOpen: function (d, st) { ht.n = d.n; ht.diff = d.diff; ht.data = d.data; ht.st = st.entries; ht.revealed = false; ht.extras = []; banner($('ht-feedback'), ''); HT.render(); }
  },
  magic: {
    label: 'Magisches Quadrat', sizes: MG_SIZES, defSize: 4, draw: mgDraw,
    create: function (n, diff) { return mgCreate(n, diff); },
    current: function () { return mg.data ? { data: mg.data, diff: mg.diff } : null; },
    sheetInfo: function () { return { title: 'Magisches Quadrat ' + mg.n + '×' + mg.n, diff: mg.diff }; },
    prefix: function () { return 'magisches-quadrat_' + mg.n + 'x' + mg.n; },
    extras: function (multi) { return nxExtras(mg, multi, function () { return mgCreate(mg.n, mg.diff); }); },
    hvSnap: function (multi) { if (!mg.data) return null; NXT.magic.extras(multi); return { size: mg.n, diff: mg.diff, key: JSON.stringify(mg.data.givens), data: { n: mg.n, diff: mg.diff, data: mg.data, extras: mg.extras.slice(0, multi - 1) } }; },
    hvApply: function (d) { mg.n = d.n; mg.diff = d.diff; mg.data = d.data; mg.extras = d.extras || []; },
    gvSnap: function () {
      if (!mg.data || !mg.entries.length) return null; var f = 0, em = 0, a = mgAnalyze(mg.entries, mg.n);
      for (var r = 0; r < mg.n; r++) for (var c = 0; c < mg.n; c++) if (!mg.data.givens[r][c]) { em++; if (mg.entries[r][c]) f++; }
      return nxGv('magic', mg, mg.entries, f, em, a.solved);
    },
    fresh: function (dd) { return copyM(dd.givens); },
    gvOpen: function (d, st) { mg.n = d.n; mg.diff = d.diff; mg.data = d.data; mg.entries = st.entries; mg.revealed = false; mg.extras = []; banner($('mg-feedback'), ''); NXMG.build(); }
  },
  mauer: {
    label: 'Zahlenmauer', sizes: [3, 4, 5, 6, 7], defSize: 4, draw: mwDraw,
    create: function (n, diff, op) { return mwCreate(n, diff, op || 'plus'); },
    current: function () { return mw.data ? { data: mw.data, diff: mw.diff } : null; },
    sheetInfo: function () { return { title: 'Zahlenmauer ' + mw.n + ' Zeilen · ' + OP_LABEL[mw.op], diff: mw.diff }; },
    prefix: function () { return 'zahlenmauer_' + mw.op + '_' + mw.n; },
    extras: function (multi) { return nxExtras(mw, multi, function () { return mwCreate(mw.n, mw.diff, mw.op); }); },
    hvSnap: function (multi) { if (!mw.data) return null; NXT.mauer.extras(multi); return { size: mw.n, diff: mw.diff, key: mw.op + JSON.stringify(mw.data.cells), data: { n: mw.n, diff: mw.diff, op: mw.op, data: mw.data, extras: mw.extras.slice(0, multi - 1) } }; },
    hvApply: function (d) { mw.n = d.n; mw.diff = d.diff; mw.op = d.op || (d.data && d.data.op) || 'plus'; mw.data = d.data; mw.extras = d.extras || []; },
    gvSnap: function () {
      if (!mw.data || !mw.entries.length) return null; var f = 0, em = 0, a = mwAnalyze(mw.op, mw.entries);
      for (var i = 0; i < mw.n; i++) for (var j = 0; j <= i; j++) if (!mw.data.given[i][j]) { em++; if (mw.entries[i][j] !== null) f++; }
      return nxGv('mauer', mw, mw.entries, f, em, a.solved);
    },
    fresh: function (dd) { return dd.cells.map(function (r, i) { return r.map(function (v, j) { return dd.given[i][j] ? v : null; }); }); },
    gvOpen: function (d, st) { mw.n = d.n; mw.diff = d.diff; mw.op = d.op || (d.data && d.data.op) || 'plus'; mw.data = d.data; mw.entries = st.entries; mw.revealed = false; mw.extras = []; MW.sizes(); banner($('mw-feedback'), ''); MW.build(); }
  }
};
function nxTypeOf(mode) { return NXT[mode] ? mode : null; }
function nxSave() { return { ht: Object.assign({}, ht), mg: Object.assign({}, mg), mw: Object.assign({}, mw) }; }
function nxRestoreRaw(o) { Object.assign(ht, o.ht); Object.assign(mg, o.mg); Object.assign(mw, o.mw); }
function nxState() {
  return {
    ht: ht.data ? { n: ht.n, diff: ht.diff, data: ht.data, st: ht.st, revealed: ht.revealed, extras: ht.extras || [] } : null,
    mg: mg.data ? { n: mg.n, diff: mg.diff, data: mg.data, entries: mg.entries, revealed: mg.revealed, extras: mg.extras || [] } : null,
    mw: mw.data ? { n: mw.n, op: mw.op, diff: mw.diff, data: mw.data, entries: mw.entries, revealed: mw.revealed, extras: mw.extras || [] } : null
  };
}
function nxLoad(s) {
  if (!s) return;
  try {
    if (s.ht && s.ht.data && Array.isArray(s.ht.st)) { ht.n = s.ht.n; ht.diff = s.ht.diff; ht.data = s.ht.data; ht.st = s.ht.st; ht.revealed = !!s.ht.revealed; ht.extras = s.ht.extras || []; HT.render(); }
    if (s.mg && s.mg.data && Array.isArray(s.mg.entries)) { mg.n = s.mg.n; mg.diff = s.mg.diff; mg.data = s.mg.data; mg.entries = s.mg.entries; mg.revealed = !!s.mg.revealed; mg.extras = s.mg.extras || []; NXMG.build(); }
    if (s.mw && s.mw.data && Array.isArray(s.mw.entries)) { mw.n = s.mw.n; mw.op = s.mw.op || s.mw.data.op || 'plus'; mw.diff = s.mw.diff; mw.data = s.mw.data; mw.entries = s.mw.entries; mw.revealed = !!s.mw.revealed; mw.extras = s.mw.extras || []; MW.sizes(); MW.build(); }
  } catch (e) {}
}
