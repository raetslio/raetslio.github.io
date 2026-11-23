/* ======================================================================
   Statistik (Bestzeiten, gelöste Rätsel, Serien)
   Merkt jedes gelöste Rätsel (einmal pro Rätsel) und zeigt im Tab „Spielverlauf“ Bestzeiten,
   Anzahl gelöster Rätsel und Tages-Serien. Wird über das Konto synchronisiert (Schlüssel „stats“).
   ====================================================================== */
'use strict';

var ST_KEY = 'raetsel_heft_stats';
function stLoad() {
  try { var d = JSON.parse(localStorage.getItem(ST_KEY) || 'null'); if (d && Array.isArray(d.items)) return d; } catch (e) {}
  return { items: [], del: {} };
}
function stSave(d) { try { localStorage.setItem(ST_KEY, JSON.stringify(d)); } catch (e) {} }
function stDay(t) { var x = new Date(t); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); }
/* Zusammenführen: pro Rätsel-ID ein Eintrag, bei Doppelten gilt der frühere Lösezeitpunkt und die bessere Zeit/Schrittzahl */
function stMerge(a, b) {
  var m = {};
  (a && a.items || []).concat(b && b.items || []).forEach(function (it) {
    var o = m[it.id];
    if (!o) { m[it.id] = Object.assign({}, it); return; }
    if (it.t < o.t) o.t = it.t;
    if (it.sec && (!o.sec || it.sec < o.sec)) o.sec = it.sec;
    if (it.steps && (!o.steps || it.steps < o.steps)) o.steps = it.steps;
  });
  return { items: Object.keys(m).map(function (k) { return m[k]; }).sort(function (x, y) { return y.t - x.t; }), del: {} };
}
function stRecordAll() {
  if (!window.__rsInit) return;
  var d = stLoad(), have = {}, changed = false, A = window.appState;
  d.items.forEach(function (x) { have[x.id] = 1; });
  GV_TYPES.forEach(function (t) {
    var e; try { e = gvSnap(t); } catch (x) { return; }
    if (!e || !e.done || have[e.id] || (A[t] && A[t].revealed)) return;
    var it = { id: e.id, type: e.type, size: e.size, diff: e.diff, t: Date.now() };
    if (e.type === 'sudoku' && e.state.elapsedSec > 0) it.sec = e.state.elapsedSec;
    if (e.type === 'maze' && e.state.steps > 0) it.steps = e.state.steps;
    d.items.unshift(it); have[e.id] = 1; changed = true;
  });
  if (changed) { stSave(d); stRender(); }
}
function stFmt(sec) { return String(Math.floor(sec / 60)).padStart(2, '0') + ':' + String(sec % 60).padStart(2, '0'); }
function stStreaks(items) {
  var days = {}; items.forEach(function (i) { days[stDay(i.t)] = 1; });
  var keys = Object.keys(days).sort(), best = 0, run = 0, prev = null;
  keys.forEach(function (k) {
    var p = k.split('-'), cur = Date.UTC(+p[0], +p[1] - 1, +p[2]);
    run = (prev !== null && cur - prev === 86400000) ? run + 1 : 1; prev = cur; if (run > best) best = run;
  });
  var n = new Date(), c = 0, t = new Date(n.getFullYear(), n.getMonth(), n.getDate());
  if (!days[stDay(t)]) t.setDate(t.getDate() - 1);
  while (days[stDay(t)]) { c++; t.setDate(t.getDate() - 1); }
  return { cur: c, best: best };
}
function stRender() {
  var box = $('st-box'); if (!box) return;
  var items = stLoad().items, sk = stStreaks(items), cnt = {}, best = {};
  items.forEach(function (i) {
    cnt[i.type] = (cnt[i.type] || 0) + 1;
    var v = i.sec || i.steps; if (!v) return;
    var k = i.type + '|' + i.size + '|' + i.diff, o = best[k];
    if (!o || v < o.v) best[k] = { v: v, i: i };
  });
  var rows = Object.keys(best).sort().map(function (k) {
    var b = best[k], it = b.i;
    return '<div class="hv-item"><div style="flex:1;min-width:210px"><strong>' + TYPE_LABEL[it.type] + ' ' + sizeTxt(it.type, it.size) + '</strong> · ' + DIFFS[it.diff] +
      '<br><span class="label">Bestzeit ' + (it.sec ? stFmt(b.v) : b.v + ' Schritte') + '</span></div></div>';
  }).join('');
  var types = Object.keys(cnt).map(function (t) { return TYPE_LABEL[t] + ': ' + cnt[t]; }).join(' · ');
  box.innerHTML = '<p><span class="tag">Gelöst: ' + items.length + '</span> <span class="tag">Aktuelle Serie: ' + sk.cur + (sk.cur === 1 ? ' Tag' : ' Tage') + '</span> <span class="tag">Längste Serie: ' + sk.best + (sk.best === 1 ? ' Tag' : ' Tage') + '</span></p>' +
    (types ? '<p class="muted-note">' + types + '</p>' : '') +
    (rows || '<div class="bk-empty">Noch keine Bestzeiten. Löse ein Rätsel – es erscheint hier automatisch.</div>');
}
(function () {
  var prev = window.saveStateToHost;
  window.saveStateToHost = function () { try { stRecordAll(); } catch (x) {} return prev.apply(this, arguments); };
  stRender();
})();
window.ST = { render: stRender, merge: stMerge };
