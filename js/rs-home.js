/* ======================================================================
   Startseite-Anbindung & Einstellungen merken
   - Merkt pro Rätselart Größe/Schwierigkeit (localStorage 'rs_last_settings')
   - Lässt den Einstellungsbereich eingeklappt und zeigt "Neues Rätsel" groß davor
   - Führt Schnellstart ('rs_quick') und Weiterspielen ('rs_resume') von der Startseite aus
   ====================================================================== */
'use strict';
(function () {
  var KEY = 'rs_last_settings';
  function load() { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { return {}; } }
  function pageKey(d) { return d.id; }
  function snap(d) {
    var o = { v: {}, g: {} };
    d.querySelectorAll('input[id],select[id]').forEach(function (e) { if (e.type === 'file') return; o.v[e.id] = e.type === 'checkbox' ? e.checked : e.value; });
    d.querySelectorAll('.segmented[id],.chip-group[id]').forEach(function (g) {
      var b = Array.prototype.slice.call(g.querySelectorAll('button')), i = b.findIndex(function (x) { return x.getAttribute('aria-pressed') === 'true'; });
      if (i >= 0) o.g[g.id] = i;
    });
    return o;
  }
  function apply(d, o) {
    Object.keys(o.v || {}).forEach(function (id) {
      var e = document.getElementById(id); if (!e || e.type === 'file') return;
      var v = o.v[id]; if (e.type === 'checkbox') { if (e.checked === v) return; e.checked = v; } else { if (e.value === String(v)) return; e.value = v; }
      e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true }));
    });
    Object.keys(o.g || {}).forEach(function (id) {
      var g = document.getElementById(id), b = g && g.querySelectorAll('button')[o.g[id]];
      if (b && b.getAttribute('aria-pressed') !== 'true') b.click();
    });
  }
  function bigButton(d) {
    var btn = d.querySelector('.rs-primary'); if (!btn || d.previousElementSibling && d.previousElementSibling.classList.contains('rs-new-big')) return btn;
    var c = btn.cloneNode(true); c.classList.add('rs-new-big'); c.removeAttribute('id');
    c.style.cssText = 'width:100%;min-height:52px;font-size:1.1rem;margin:0 0 12px';
    d.parentNode.insertBefore(c, d); return c;
  }
  function start() {
    var all = load(), dets = document.querySelectorAll('details.rs-settings'), quick = null, resume = null;
    try { quick = JSON.parse(localStorage.getItem('rs_quick') || 'null'); resume = localStorage.getItem('rs_resume'); localStorage.removeItem('rs_quick'); localStorage.removeItem('rs_resume'); } catch (e) {}
    dets.forEach(function (d) {
      d.removeAttribute('open');
      if (all[d.id]) apply(d, all[d.id]);
      if (quick && quick.id === d.id && quick.preset) apply(d, quick.preset);
      var save = function () { var a = load(); a[d.id] = snap(d); try { localStorage.setItem(KEY, JSON.stringify(a)); } catch (e) {} };
      d.addEventListener('click', function () { setTimeout(save, 50); }); d.addEventListener('change', save); d.addEventListener('input', save);
      bigButton(d);
    });
    if (resume && typeof gvLoad === 'function') {
      var it = gvLoad().items.filter(function (x) { return x.id === resume; })[0];
      if (it) { try { gvOpen(it); } catch (e) {} }
    } else if (quick) {
      var d = document.getElementById(quick.id), b = d && d.previousElementSibling; if (b && b.classList.contains('rs-new-big')) setTimeout(function () { b.click(); }, 150);
    }
  }
  var n = 0, t = setInterval(function () { if (window.__rsInit || ++n > 100) { clearInterval(t); if (window.__rsInit) start(); } }, 100);
})();
