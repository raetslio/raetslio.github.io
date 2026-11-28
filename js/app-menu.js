/* ======================================================================
   Web-App-Leiste (iPhone, zum Home-Bildschirm hinzugefügt) und Support-Seite
   - Leiste „Start | Sudoku | Konto | Mehr“ (nur als installierte Web-App sichtbar, siehe css/start.css)
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
