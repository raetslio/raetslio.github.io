/* ======================================================================
   Startseite: Profil (aus dem Konto-Knopf) und Zähler auf den Kacheln
   (angefangene Rätsel je Art, Spiel-/Druckverlauf, Hefte). Verändert keine Daten.
   ====================================================================== */
'use strict';
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var GV = 'raetsel_heft_spiele', HV = 'raetsel_heft_verlauf', BKI = 'raetsel_hefte_v2';
  var TYPE_TO_TILE = { sudoku: 'sudoku', ws: 'wortsuche', binoxxo: 'binoxxo', maze: 'labyrinth', hitori: 'hitori', mauer: 'mauer', magic: 'magic' };
  function read(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } }
  function badge(key, n, text) {
    var t = document.querySelector('.st-tile[data-key="' + key + '"] .st-badge'); if (!t) return;
    t.textContent = text || ''; t.classList.toggle('hidden', !n);
  }
  function profile() {
    var lab = $('account-label'), signed = lab && lab.textContent.trim() && lab.textContent.trim() !== 'Anmelden';
    var name = signed ? lab.textContent.trim() : 'Anmelden', av = $('st-avatar'), img = $('account-avatar-btn');
    $('st-hello').textContent = signed ? 'Willkommen zurück' : 'Willkommen';
    $('st-name').textContent = name;
    $('st-sub').textContent = signed ? 'Mein Konto öffnen' : 'Rätselstände und Hefte auf allen Geräten';
    var src = signed && img ? img.getAttribute('src') : '';
    navAvatar(!!signed, src, name);
    if (src) { if (!av.firstChild || av.firstChild.tagName !== 'IMG' || av.firstChild.getAttribute('src') !== src) { av.textContent = ''; var i = document.createElement('img'); i.alt = ''; i.referrerPolicy = 'no-referrer'; i.src = src; av.appendChild(i); } }
    else if (signed) av.textContent = name.charAt(0).toUpperCase();
    else av.innerHTML = '<svg class="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"/></svg>';
  }
  /* Untere Leiste: Konto-Symbol durch Profilbild bzw. Anfangsbuchstaben ersetzen */
  function navAvatar(signed, src, name) {
    Array.prototype.forEach.call(document.querySelectorAll('#rs-appnav button[data-tab="konto"]'), function (b) { navAvatarOne(b, signed, src, name); });
  }
  function navAvatarOne(b, signed, src, name) {
    var cur = b.querySelector('.rs-bn-av'), ico = b.querySelector('svg.icon-svg');
    if (!signed) { if (cur) cur.remove(); if (ico) ico.style.display = ''; return; }
    if (ico) ico.style.display = 'none';
    if (!cur) { cur = document.createElement('span'); cur.className = 'rs-bn-av'; cur.setAttribute('aria-hidden', 'true'); b.insertBefore(cur, b.firstChild); }
    if (src) { var im = cur.firstChild; if (!im || im.tagName !== 'IMG' || im.getAttribute('src') !== src) { cur.textContent = ''; im = document.createElement('img'); im.alt = ''; im.referrerPolicy = 'no-referrer'; im.src = src; cur.appendChild(im); } }
    else cur.textContent = name.charAt(0).toUpperCase();
  }
  function counts() {
    var g = read(GV), items = g && Array.isArray(g.items) ? g.items : [], open = {}, openAll = 0;
    items.forEach(function (it) { if (it.done) return; var k = TYPE_TO_TILE[it.type]; if (k) { open[k] = (open[k] || 0) + 1; openAll++; } });
    Object.keys(TYPE_TO_TILE).forEach(function (t) { var k = TYPE_TO_TILE[t]; badge(k, open[k], open[k] + ' angefangen'); });
    badge('spiele', openAll, openAll + ' offen');
    var h = read(HV), hn = h && Array.isArray(h.items) ? h.items.length : 0; badge('verlauf', hn, String(hn));
    var b = read(BKI), bn = b && Array.isArray(b.list) ? b.list.length : 0; badge('heft', bn, bn + (bn === 1 ? ' Heft' : ' Hefte'));
  }
  var NAMES = { sudoku: 'Sudoku', ws: 'Suchsel', binoxxo: 'Binoxxo', maze: 'Labyrinth', hitori: 'Hitori', mauer: 'Zahlenmauer', magic: 'Magisches Quadrat' };
  var last = null;
  /* Zuletzt angefangenes, noch nicht gelöstes Rätsel groß oben anbieten */
  function resumeCard() {
    var g = read(GV), items = g && Array.isArray(g.items) ? g.items : [], box = $('st-resume'); if (!box) return;
    last = items.filter(function (it) { return it && !it.done && it.started && NAMES[it.type]; })[0] || null;
    box.classList.toggle('hidden', !last); if (!last) return;
    $('st-resume-name').textContent = NAMES[last.type] + (last.pct ? ' · ' + last.pct + ' % gelöst' : '');
    $('st-resume-fill').style.width = Math.max(4, Math.min(100, last.pct || 0)) + '%';
  }
  function resume() { resumeCard(); if (last) openLast(); else if (typeof switchMode === 'function') switchMode('spiele'); }
  function openLast() {
    if (typeof gvOpen === 'function') { try { gvOpen(last); return; } catch (e) {} }
    try { localStorage.setItem('rs_resume', last.id); } catch (e) {} /* andere Seite (z. B. Konto): rs-home.js öffnet es nach dem Wechsel */
    if (typeof switchMode === 'function') switchMode('start');
  }
  /* Untere Leiste (Handy): aktuelle Seite markieren */
  function navSync() {
    var sel = document.querySelector('#rs-drawer .nav-tab[aria-selected="true"]'), cur = document.body.classList.contains('rs-konto') ? 'konto' : sel ? sel.id.replace('tab-', '') : 'start';
    document.querySelectorAll('#rs-appnav button[data-tab]').forEach(function (b) {
      var t = b.getAttribute('data-tab'), on = t === cur || (t === 'more' && cur === 'support'); if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
  }
  function render() { profile(); counts(); resumeCard(); navSync(); }
  window.RSSTART = { render: render, resume: resume };
  var dr = $('rs-drawer'); if (dr && window.MutationObserver) new MutationObserver(navSync).observe(dr, { attributes: true, attributeFilter: ['aria-selected'], subtree: true });
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') render(); });
  var lab = $('account-label');
  if (lab && window.MutationObserver) {
    var mo = new MutationObserver(profile);
    mo.observe(lab, { childList: true, characterData: true, subtree: true });
    var btn = $('btn-account'); if (btn) mo.observe(btn, { childList: true });
  }
  render();
})();
