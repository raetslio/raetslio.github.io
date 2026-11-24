/* ======================================================================
   Erweiterungen: Zeit für alle Rätselarten, Teilen direkt im Rätsel-Tab, Website teilen
   ====================================================================== */
'use strict';
(function () {
  var TM_KEY = 'raetsel_heft_zeiten', MODE_TYPE = { wortsuche: 'ws', binoxxo: 'binoxxo', labyrinth: 'maze', hitori: 'hitori', mauer: 'mauer', magic: 'magic' };
  var VIEW_TYPE = { 'view-sudoku': 'sudoku', 'view-wortsuche': 'ws', 'view-binoxxo': 'binoxxo', 'view-labyrinth': 'maze', 'view-hitori': 'hitori', 'view-mauer': 'mauer', 'view-magic': 'magic' };
  var times = {}, dirty = 0, pills = {};
  try { times = JSON.parse(localStorage.getItem(TM_KEY) || '{}') || {}; } catch (e) { times = {}; }
  function tmSave() { dirty = 0; var k = Object.keys(times); if (k.length > 200) { k.slice(0, k.length - 200).forEach(function (x) { delete times[x]; }); } try { localStorage.setItem(TM_KEY, JSON.stringify(times)); } catch (e) {} }
  window.tmGet = function (id) { return times[id] || 0; };
  window.tmReset = function () { times = {}; tmSave(); };
  function fmt(s) { return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); }
  /* Einheitliche Kopfzeile: Schwierigkeit · Fortschritt · Zeit (Elemente stehen in index.html) */
  var HEAD = { ws: ['ws-diff-tag', null], binoxxo: ['bx-diff-tag', 'bx-progress-stat'], maze: ['mz-diff-tag', 'mz-progress-stat'], hitori: ['ht-diff-tag', 'ht-progress-stat'], mauer: ['mw-diff-tag', 'mw-progress-stat'], magic: ['mg-diff-tag', 'mg-progress-stat'] };
  function addPills() {
    Object.keys(VIEW_TYPE).forEach(function (vid) {
      var t = VIEW_TYPE[vid]; if (t === 'sudoku') return;
      var p = document.getElementById('timer-' + t); if (p) pills[t] = p;
    });
  }
  function fillHead(t, e) {
    var h = HEAD[t]; if (!h) return;
    var d = document.getElementById(h[0]), g = h[1] && document.getElementById(h[1]);
    if (d) d.textContent = e && DIFFS[e.diff] ? DIFFS[e.diff] : (e && e.size ? e.size + '×' + e.size : '–');
    if (g) g.textContent = !e ? '–' : (t === 'maze' ? ((e.state && e.state.steps) || 0) + ' Schritte' : (e.pct || 0) + ' % ausgefüllt');
  }
  addPills();
  setInterval(function () {
    var t = MODE_TYPE[window.appState && window.appState.mode]; if (!t || !pills[t] || !window.__rsInit) return;
    var e; try { e = gvSnap(t); } catch (x) { e = null; }
    fillHead(t, e);
    if (!e) { pills[t].textContent = '00:00'; return; }
    if (e.started && !e.done && document.visibilityState === 'visible') { times[e.id] = (times[e.id] || 0) + 1; if (++dirty >= 5) tmSave(); }
    pills[t].textContent = fmt(times[e.id] || 0);
  }, 1000);
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden' && dirty) tmSave(); });
  window.addEventListener('pagehide', function () { if (dirty) tmSave(); });

  /* ---------- Teilen-Fenster ---------- */
  function toast(t) {
    var d = document.createElement('div'); d.className = 'stat-pill'; d.textContent = t; d.setAttribute('role', 'status');
    d.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);bottom:56px;z-index:200;box-shadow:0 2px 8px rgba(0,0,0,.3)'; document.body.appendChild(d); setTimeout(function () { d.remove(); }, 2600);
  }
  function copy(text) { return (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject()).then(function () { toast('Link kopiert.'); }, function () { var ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); toast('Link kopiert.'); } catch (e) { toast('Bitte Link manuell kopieren.'); } ta.remove(); }); }
  var css = document.createElement('style');
  css.textContent = '#qr-modal{position:fixed;inset:0;z-index:300;background:var(--overlay-scrim,rgba(0,0,0,.5));display:flex;align-items:center;justify-content:center;padding:12px}#qr-modal .qr-card{background:var(--background);color:var(--on-surface);border-radius:14px;padding:18px;max-width:420px;width:100%;max-height:96vh;overflow:auto;text-align:center}#qr-modal textarea{width:100%;font-size:12px}#qr-modal .qr-act{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-top:10px}';
  document.head.appendChild(css);
  function openShare(o) {
    var old = document.getElementById('qr-modal'); if (old) old.remove();
    var m = document.createElement('div'); m.id = 'qr-modal'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true'); m.setAttribute('aria-label', o.title);
    m.innerHTML = '<div class="qr-card"><img src="icons/icon.svg" width="64" height="64" alt="Rätslio?" style="border-radius:14px;margin-bottom:8px"><h2 class="section-title" style="margin:0 0 4px"><strong></strong></h2><p class="muted-note" style="margin:0"></p>' +
      '<textarea class="input-control" rows="3" readonly aria-label="Link"></textarea><div class="qr-act"></div></div>';
    m.querySelector('strong').textContent = o.title; m.querySelector('p').textContent = o.note; m.querySelector('textarea').value = o.url;
    var act = m.querySelector('.qr-act');
    function btn(l, cls, fn) { var b = document.createElement('button'); b.type = 'button'; b.className = 'btn btn-sm ' + cls; b.textContent = l; b.addEventListener('click', fn); act.appendChild(b); }
    btn('Link kopieren', 'btn-primary', function () { copy(o.url); });
    if (navigator.share) btn('Teilen …', '', function () {
      /* Mit Logo als Vorschaubild; wenn das Gerät keine Dateien kann, nur der Link */
      fetch('icons/rl-180.png').then(function (r) { return r.blob(); }).then(function (b) {
        var f = new File([b], 'Raetslio.png', { type: 'image/png' }), d = { files: [f], url: o.url, title: 'Rätslio?' };
        return (navigator.canShare && navigator.canShare(d)) ? d : { url: o.url };
      }).catch(function () { return { url: o.url }; }).then(function (d) { return navigator.share(d); }).catch(function () {});
    });
    btn('Schließen', '', close);
    function close() { m.remove(); document.removeEventListener('keydown', key); }
    function key(e) { if (e.key === 'Escape') close(); }
    m.addEventListener('click', function (e) { if (e.target === m) close(); }); document.addEventListener('keydown', key);
    document.body.appendChild(m); m.querySelector('.btn-primary').focus();
  }
  window.openShareDialog = openShare;
  function siteUrl() { return location.origin + location.pathname; }
  async function sharePuzzle(type) {
    var e; try { e = gvSnap(type); } catch (x) { e = null; }
    if (!e) { toast('Erzeuge zuerst ein Rätsel, dann kannst du es teilen.'); return; }
    var code = await shEncode(e);
    openShare({ title: TYPE_LABEL[type] + ' teilen', note: 'Wer den Link öffnet, bekommt dasselbe Rätsel – ohne Lösung und ohne deinen Fortschritt.', url: siteUrl() + '#rs=' + code });
  }
  function inject() {
    Object.keys(VIEW_TYPE).forEach(function (vid) {
      var v = document.getElementById(vid); if (!v || v.querySelector('.sh-tab')) return;
      var st = v.querySelector('aside .panel-stack'); if (!st) return;
      var d = document.createElement('div'); d.className = 'panel-subblock sh-tab';
      d.innerHTML = '<span class="label">Rätsel teilen</span><p class="muted-note">Link zu diesem Rätsel.</p><button type="button" class="btn">Teilen</button>';
      d.querySelector('button').addEventListener('click', function () { sharePuzzle(VIEW_TYPE[vid]); });
      st.appendChild(d);
    });
  }
  inject();
})();
