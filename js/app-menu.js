/* ======================================================================
   Web-App-Leiste (iPhone, zum Home-Bildschirm hinzugefügt) und Support-Seite
   - Leiste „Start | Sudoku | Konto | Mehr“ (nur als installierte Web-App sichtbar, siehe css/start.css)
   - Über die Leiste wischen: Finger ziehen, der Eintrag unter dem Finger wird beim Loslassen geöffnet
   - „Mehr“ öffnet ein Fenster über der Leiste: Abmelden, Support, Darstellung (Hell / Dunkel / Gerät)
   - Support-Seite /support/: Formular, Versand über RSAUTH.supportPost (js/account.js)
   Verändert keine Rätsel-Funktionen.
   ====================================================================== */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };

  /* Von welcher Seite kam man zum Support? (wird der Nachricht mitgegeben) */
  var base = window.switchMode;
  if (typeof base === 'function') {
    window.switchMode = function (m) {
      if (m === 'support' && !/^\/support\/?/.test(location.pathname)) { try { sessionStorage.setItem('rs_sup_from', location.pathname); } catch (e) {} }
      return base.apply(this, arguments);
    };
  }

  /* ---- „Mehr“-Fenster ---- */
  var btn = $('rs-am-btn'), more = $('rs-appmore');
  if (btn && more) {
    var isOpen = function () { return more.classList.contains('rs-open'); };
    var refreshTheme = function () {
      var t = (window.appState && window.appState.theme) || 'system';
      Array.prototype.forEach.call(more.querySelectorAll('[data-theme-set]'), function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-theme-set') === t ? 'true' : 'false'); });
    };
    var setOpen = function (o) {
      more.classList.toggle('rs-open', o);
      more.setAttribute('aria-hidden', o ? 'false' : 'true');
      btn.setAttribute('aria-expanded', o ? 'true' : 'false');
      btn.classList.toggle('rs-am-on', o);
      if (o) refreshTheme();
    };
    btn.addEventListener('click', function (e) { e.stopPropagation(); setOpen(!isOpen()); });
    document.addEventListener('click', function (e) { if (isOpen() && !more.contains(e.target)) setOpen(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && isOpen()) { setOpen(false); try { btn.focus(); } catch (x) {} } });
    $('rs-am-support').addEventListener('click', function () { setOpen(false); window.switchMode('support'); });
    $('rs-am-logout').addEventListener('click', function () { setOpen(false); if (window.RSAUTH && RSAUTH.logout) RSAUTH.logout(); });
    Array.prototype.forEach.call(more.querySelectorAll('[data-theme-set]'), function (b) {
      b.addEventListener('click', function () {
        if (typeof applyTheme === 'function') applyTheme(b.getAttribute('data-theme-set'));
        if (typeof schedulePersist === 'function') schedulePersist();
        refreshTheme();
      });
    });
    /* Menü oder Seitenwechsel schließt das Fenster */
    var drawer = $('rs-drawer'); if (drawer && window.MutationObserver) new MutationObserver(function () { if (isOpen()) setOpen(false); }).observe(drawer, { attributes: true, attributeFilter: ['aria-selected'], subtree: true });
  }

  /* ---- Wischen über die Leiste: Finger auf der Leiste ziehen, beim Loslassen wird der Eintrag unter dem Finger geöffnet ---- */
  var nav = $('rs-appnav');
  if (nav) {
    var btns = Array.prototype.slice.call(nav.querySelectorAll('button')), drag = null, quietUntil = 0;
    var under = function (x, y) { var el = document.elementFromPoint(x, y); return el && el.closest ? el.closest('#rs-appnav button') : null; };
    var clearHover = function () { btns.forEach(function (b) { b.classList.remove('rs-am-hover'); }); };
    nav.addEventListener('touchstart', function (e) {
      if (e.touches.length !== 1) { drag = null; return; }
      var t = e.touches[0]; drag = { x: t.clientX, moved: false, b: under(t.clientX, t.clientY) };
    }, { passive: true });
    nav.addEventListener('touchmove', function (e) {
      if (!drag) return; var t = e.touches[0];
      if (!drag.moved && Math.abs(t.clientX - drag.x) < 10) return;
      drag.moved = true; drag.b = under(t.clientX, t.clientY);
      btns.forEach(function (b) { b.classList.toggle('rs-am-hover', b === drag.b); });
    }, { passive: true });
    nav.addEventListener('touchend', function () {
      var d = drag; drag = null; clearHover();
      if (d && d.moved && d.b) { quietUntil = Date.now() + 600; d.b.click(); }
    }, { passive: true });
    nav.addEventListener('touchcancel', function () { drag = null; clearHover(); }, { passive: true });
    /* Das Klick-Ereignis, das der Browser nach dem Wischen selbst erzeugt, wird verworfen (sonst doppelt) */
    nav.addEventListener('click', function (e) { if (e.isTrusted && Date.now() < quietUntil) { e.stopPropagation(); e.preventDefault(); } }, true);
  }

  /* ---- Support-Seite ---- */
  var send = $('sup-send'), txt = $('sup-text'), top = $('sup-topic'), out = $('sup-msg'), busy = false;
  function say(text, kind) {
    if (!out) return;
    out.textContent = text || ''; out.className = 'feedback-banner ' + (kind || 'info') + (text ? '' : ' hidden');
  }
  if (send && txt) {
    send.addEventListener('click', async function () {
      if (busy) return;
      if (!window.RSAUTH || !RSAUTH.supportPost) { say('Der Support ist gerade nicht erreichbar. Bitte lade die Seite neu.', 'error'); return; }
      var from = ''; try { from = sessionStorage.getItem('rs_sup_from') || ''; } catch (e) {}
      busy = true; send.disabled = true; say('Nachricht wird gesendet …', 'info');
      var r = await RSAUTH.supportPost(top ? top.value : 'question', txt.value, from ? 'Support (von ' + from + ')' : '/support/');
      busy = false; send.disabled = false;
      if (r.ok) txt.value = '';
      say(r.text, r.kind);
    });
  }
})();
