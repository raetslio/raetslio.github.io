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
  var m = {}, del = {};
  [a, b].forEach(function (x) { var o = x && x.del; if (o && !Array.isArray(o)) Object.keys(o).forEach(function (k) { del[k] = Math.max(del[k] || 0, o[k]); }); });
  (a && a.items || []).concat(b && b.items || []).forEach(function (it) {
    if (del[it.id] && it.t <= del[it.id]) return;
    var o = m[it.id];
    if (!o) { m[it.id] = Object.assign({}, it); return; }
    if (it.t < o.t) o.t = it.t;
    if (it.sec && (!o.sec || it.sec < o.sec)) o.sec = it.sec;
    if (it.steps && (!o.steps || it.steps < o.steps)) o.steps = it.steps;
  });
  var keep = Object.keys(del).sort(function (x, y) { return del[y] - del[x]; }).slice(0, 300), nd = {}; keep.forEach(function (k) { nd[k] = del[k]; });
  return { items: Object.keys(m).map(function (k) { return m[k]; }).sort(function (x, y) { return y.t - x.t; }), del: nd };
}
function stRecordAll() {
  if (!window.__rsInit) return;
  var d = stLoad(), have = {}, changed = false, A = window.appState;
  d.items.forEach(function (x) { have[x.id] = 1; });
  GV_TYPES.forEach(function (t) {
    var e; try { e = gvSnap(t); } catch (x) { return; }
    if (!e || !e.done || have[e.id] || (d.del && d.del[e.id]) || (A[t] && A[t].revealed)) return;
    var it = { id: e.id, type: e.type, size: e.size, diff: e.diff, t: Date.now() };
    if (e.type === 'sudoku' && e.state.elapsedSec > 0) it.sec = e.state.elapsedSec;
    if (e.type === 'maze' && e.state.steps > 0) it.steps = e.state.steps;
    if (e.type !== 'sudoku' && window.tmGet) { var tt = tmGet(e.id); if (tt > 0) it.sec = tt; }
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
function stReset() {
  if (!confirm('Statistik wirklich zurücksetzen? Alle Bestzeiten, gelöschten Zähler und Serien werden gelöscht. Der Spielverlauf bleibt erhalten.')) return;
  var d = stLoad(), now = Date.now(), del = d.del || {};
  d.items.forEach(function (i) { del[i.id] = now; });
  try { GV_TYPES.forEach(function (t) { var e = gvSnap(t); if (e && e.done) del[e.id] = now; }); } catch (x) {}
  stSave({ items: [], del: del });
  if (window.tmReset) window.tmReset();
  stRender();
}
function stRender() {
  var box = $('st-box'); if (!box) return;
  var items = stLoad().items, sk = stStreaks(items), cnt = {}, best = {}, tt = {};
  items.forEach(function (i) {
    cnt[i.type] = (cnt[i.type] || 0) + 1;
    if (i.sec) { var o = tt[i.type] || (tt[i.type] = { n: 0, sum: 0, min: 1e9 }); o.n++; o.sum += i.sec; if (i.sec < o.min) o.min = i.sec; }
    var v = i.sec || i.steps; if (!v) return;
    var k = i.type + '|' + i.size + '|' + i.diff, o2 = best[k];
    if (!o2 || (i.sec ? 0 : 1) < (o2.i.sec ? 0 : 1) || ((i.sec ? 0 : 1) === (o2.i.sec ? 0 : 1) && v < o2.v)) best[k] = { v: v, i: i };
  });
  var rows = Object.keys(best).sort().map(function (k) {
    var b = best[k], it = b.i;
    return '<div class="hv-item"><div style="flex:1;min-width:210px"><strong>' + TYPE_LABEL[it.type] + ' ' + sizeTxt(it.type, it.size) + '</strong> · ' + DIFFS[it.diff] +
      '<br><span class="label">Bestzeit ' + (it.sec ? stFmt(b.v) : b.v + ' Schritte') + '</span></div></div>';
  }).join('');
  /* Verlauf der letzten 14 Tage */
  var days = [], perDay = {}, today = new Date(); items.forEach(function (i) { var k = stDay(i.t); perDay[k] = (perDay[k] || 0) + 1; });
  for (var q = 13; q >= 0; q--) { var dt = new Date(today.getFullYear(), today.getMonth(), today.getDate() - q); days.push({ k: stDay(dt), l: dt.getDate() + '.' + (dt.getMonth() + 1) + '.', n: perDay[stDay(dt)] || 0 }); }
  var mx = Math.max.apply(null, days.map(function (x) { return x.n; }).concat([1])), sum14 = days.reduce(function (a, x) { return a + x.n; }, 0);
  var bars = days.map(function (x, i) {
    var h = Math.round(x.n / mx * 60), bx = i * 34 + 4;
    return '<rect x="' + bx + '" y="' + (74 - h) + '" width="26" height="' + Math.max(h, x.n ? 2 : 1) + '" rx="3" fill="' + (x.n ? 'var(--primary)' : 'var(--outline-variant)') + '"><title>' + x.l + ': ' + x.n + ' gelöst</title></rect>' +
      (x.n ? '<text x="' + (bx + 13) + '" y="' + (70 - h) + '" text-anchor="middle" font-size="10" fill="var(--on-surface)">' + x.n + '</text>' : '') +
      (i % 2 === 0 || i === 13 ? '<text x="' + (bx + 13) + '" y="90" text-anchor="middle" font-size="9" fill="var(--on-surface-variant)">' + x.l + '</text>' : '');
  }).join('');
  var chart = '<div class="panel-subblock"><span class="label">Letzte 14 Tage · ' + sum14 + ' gelöst</span><div style="overflow-x:auto"><svg viewBox="0 0 480 96" width="100%" style="min-width:420px;max-width:640px" role="img" aria-label="Gelöste Rätsel pro Tag in den letzten 14 Tagen">' + bars + '</svg></div></div>';
  /* Zeiten pro Rätselart im Vergleich */
  var tk = Object.keys(tt).sort(function (a, b) { return tt[a].sum / tt[a].n - tt[b].sum / tt[b].n; });
  var tmax = Math.max.apply(null, tk.map(function (t) { return tt[t].sum / tt[t].n; }).concat([1]));
  var cmp = tk.length ? '<div class="panel-subblock"><span class="label">Zeiten pro Rätselart (Ø im Vergleich)</span>' + tk.map(function (t) {
    var o = tt[t], avg = Math.round(o.sum / o.n);
    return '<div style="margin:6px 0"><div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap"><strong>' + TYPE_LABEL[t] + '</strong><span class="label">Ø ' + stFmt(avg) + ' · Bestzeit ' + stFmt(o.min) + ' · ' + o.n + '×</span></div>' +
      '<div class="gv-bar" role="img" aria-label="Durchschnitt ' + stFmt(avg) + '"><span style="width:' + Math.max(4, Math.round(avg / tmax * 100)) + '%"></span></div></div>';
  }).join('') + '</div>' : '';
  var types = Object.keys(cnt).map(function (t) { return TYPE_LABEL[t] + ': ' + cnt[t]; }).join(' · ');
  box.innerHTML = '<p><span class="tag">Gelöst: ' + items.length + '</span> <span class="tag">Aktuelle Serie: ' + sk.cur + (sk.cur === 1 ? ' Tag' : ' Tage') + '</span> <span class="tag">Längste Serie: ' + sk.best + (sk.best === 1 ? ' Tag' : ' Tage') + '</span></p>' +
    (types ? '<p class="muted-note">' + types + '</p>' : '') + (items.length ? chart + cmp : '') +
    (rows ? '<span class="label">Bestzeiten</span>' + rows : '<div class="bk-empty">Noch keine Bestzeiten. Löse ein Rätsel – es erscheint hier automatisch.</div>') +
    (items.length ? '<p style="margin-top:10px"><button type="button" class="btn btn-sm" id="st-reset">Statistik zurücksetzen</button></p>' : '');
  var rb = $('st-reset'); if (rb) rb.addEventListener('click', stReset);
}
(function () {
  var prev = window.saveStateToHost;
  window.saveStateToHost = function () { try { stRecordAll(); } catch (x) {} return prev.apply(this, arguments); };
  /* Erst nach dem Laden aller Skripte rendern (sizeTxt, GV_TYPES usw. stehen in später geladenen Dateien) */
  function first() { try { stRender(); } catch (x) {} }
  if (document.readyState === 'complete') first(); else window.addEventListener('load', first);
})();
window.ST = { render: function () { try { stRender(); } catch (x) {} }, merge: stMerge };
