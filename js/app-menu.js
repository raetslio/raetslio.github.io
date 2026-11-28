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
  var btn = $('rs-am-btn'), more = $('rs-appmore'), isOpen = function () { return false; }, setOpen = function () {};
  if (btn && more) {
    isOpen = function () { return more.classList.contains('rs-open'); };
    var refreshTheme = function () {
      var t = (window.appState && window.appState.theme) || 'system';
      Array.prototype.forEach.call(more.querySelectorAll('[data-theme-set]'), function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-theme-set') === t ? 'true' : 'false'); });
    };
    setOpen = function (o) {
      more.classList.toggle('rs-open', o);
      more.setAttribute('aria-hidden', o ? 'false' : 'true');
      btn.setAttribute('aria-expanded', o ? 'true' : 'false');
      btn.classList.toggle('rs-am-on', o);
      if (o) refreshTheme();
    };
    btn.addEventListener('click', function (e) { e.stopPropagation(); setOpen(!isOpen()); });
    /* Scrollen auf der Seite schließt das „Mehr“-Fenster (kurz nach dem Öffnen und Scrollen im Fenster selbst zählen nicht) */
    var openedAt = 0, openBase = setOpen;
    setOpen = function (o) { if (o) openedAt = Date.now(); openBase(o); };
    document.addEventListener('scroll', function (e) { if (isOpen() && Date.now() - openedAt > 250 && !(e.target && e.target.nodeType === 1 && more.contains(e.target))) setOpen(false); }, { capture: true, passive: true });
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

  /* ---- Leiste: gleitende Markierung, Wischgesten, kleine Rückmeldungen ----
     - Eine Markierung („Pille“) gleitet zum aktuellen Eintrag und folgt beim Wischen dem Finger.
     - Seitlich wischen: Eintrag unter dem Finger wird beim Loslassen geöffnet.
     - Nach oben wischen: „Mehr“ öffnet sich; nach unten wischen (Leiste oder Fenster): „Mehr“ schließt sich. */
  var nav = $('rs-appnav');
  if (nav) {
    var btns = Array.prototype.slice.call(nav.querySelectorAll('button')), drag = null, quietUntil = 0, lastCur = null;
    var pill = document.createElement('span'); pill.className = 'rs-am-pill'; pill.setAttribute('aria-hidden', 'true'); nav.insertBefore(pill, nav.firstChild);
    var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    var buzz = function (ms) { try { if (!reduce && navigator.vibrate) navigator.vibrate(ms); } catch (e) {} };
    var under = function (x, y) { var el = document.elementFromPoint(x, y); return el && el.closest ? el.closest('#rs-appnav button') : null; };
    var clearHover = function () { btns.forEach(function (b) { b.classList.remove('rs-am-hover'); }); };
    var active = function () { return nav.querySelector('button.rs-am-on') || nav.querySelector('button[aria-current="page"]'); };
    /* Markierung unter einen Eintrag setzen; bei x (Finger) folgt sie frei, sonst rastet sie am Eintrag ein */
    var place = function (b, fx, instant) {
      if (!b || !nav.offsetWidth) { pill.style.opacity = '0'; return; }
      var w = b.offsetWidth, left = b.offsetLeft;
      if (typeof fx === 'number') { var nr = nav.getBoundingClientRect(); left = Math.min(Math.max(fx - nr.left - w / 2, btns[0].offsetLeft), btns[btns.length - 1].offsetLeft); }
      pill.style.transition = instant || reduce ? 'none' : '';
      pill.style.opacity = '1'; pill.style.width = w + 'px'; pill.style.height = b.offsetHeight + 'px'; pill.style.top = b.offsetTop + 'px';
      pill.style.transform = 'translateX(' + left + 'px)' + (drag && (drag.moved || drag.dir === 'v') && !reduce ? ' translateY(' + (drag.ry || 0).toFixed(1) + 'px) scale(' + (drag.sx || 1.12).toFixed(3) + ',' + (drag.sy || 1.1).toFixed(3) + ')' : '');
    };
    var sync = function (instant) { if (!drag || !drag.moved) place(active(), undefined, instant); };
    var first = true;
    var refresh = function () {
      sync(first); first = false;
      var cur = active(); if (cur && cur !== lastCur) { if (lastCur && !reduce) { cur.classList.remove('rs-am-pop'); void cur.offsetWidth; cur.classList.add('rs-am-pop'); } lastCur = cur; }
    };
    if (window.MutationObserver) new MutationObserver(refresh).observe(nav, { attributes: true, attributeFilter: ['aria-current', 'class'], subtree: true });
    window.addEventListener('resize', function () { sync(true); });
    if (window.ResizeObserver) new ResizeObserver(function () { sync(true); }).observe(nav);
    window.addEventListener('load', function () { sync(true); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { sync(true); });
    refresh();

    /* Liquid-Glass-Gefühl: der graue Wähler dehnt sich beim Ziehen und federt zurück */
    var stretch = function (dx, dy) { /* nur der graue Wähler dehnt sich, die Leiste bleibt stehen */
      if (reduce || !drag) return;
      var ay = Math.abs(dy), ax = Math.abs(dx);
      drag.ry = (dy < 0 ? -1 : 1) * (1 - Math.exp(-ay / 60)) * 10;
      drag.sx = 1.1 + (1 - Math.exp(-ax / 120)) * 0.12; drag.sy = 1.08 + (1 - Math.exp(-ay / 60)) * 0.14;
    };
    var release = function () { nav.classList.remove('rs-am-pressed'); };
    var onStart = function (x, y) { drag = { x: x, y: y, moved: false, dir: '', b: under(x, y) }; };
    var onMove = function (x, y) {
      if (!drag) return; var dx = x - drag.x, dy = y - drag.y;
      if (!drag.dir) {
        if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
        drag.dir = Math.abs(dy) > Math.abs(dx) ? 'v' : 'h';
      }
      stretch(dx, dy);
      if (drag.dir === 'v') { drag.dy = dy; place(drag.b || active(), undefined, true); return; }
      drag.moved = true; var b = under(x, y) || drag.b;
      if (b !== drag.b) { drag.b = b; buzz(8); }
      btns.forEach(function (q) { q.classList.toggle('rs-am-hover', q === drag.b); });
      nav.classList.add('rs-am-dragging'); place(drag.b, x, true);
    };
    var onEnd = function () {
      var d = drag; drag = null; clearHover(); nav.classList.remove('rs-am-dragging'); release();
      if (!d) return;
      if (d.dir === 'v' && Math.abs(d.dy || 0) > 24) {
        quietUntil = Date.now() + 600;
        if (d.dy < 0 && !isOpen()) { buzz(12); setOpen(true); } else if (d.dy > 0 && isOpen()) setOpen(false);
        sync(); return;
      }
      if (d.moved && d.b) { quietUntil = Date.now() + 600; buzz(12); place(d.b); d.b.click(); setTimeout(sync, 60); } else sync();
    };
    nav.addEventListener('touchstart', function (e) { if (e.touches.length !== 1) { drag = null; release(); return; } onStart(e.touches[0].clientX, e.touches[0].clientY); }, { passive: true });
    nav.addEventListener('touchmove', function (e) { onMove(e.touches[0].clientX, e.touches[0].clientY); }, { passive: true });
    nav.addEventListener('touchend', onEnd, { passive: true });
    nav.addEventListener('touchcancel', function () { drag = null; clearHover(); nav.classList.remove('rs-am-dragging'); release(); sync(); }, { passive: true });
    /* Maus (Computer): gleiches Verhalten */
    nav.addEventListener('mousedown', function (e) { if (e.button === 0) onStart(e.clientX, e.clientY); });
    window.addEventListener('mousemove', function (e) { if (drag && e.buttons) onMove(e.clientX, e.clientY); });
    window.addEventListener('mouseup', function () { if (drag) onEnd(); });
    /* Das Klick-Ereignis, das der Browser nach dem Wischen selbst erzeugt, wird verworfen (sonst doppelt) */
    nav.addEventListener('click', function (e) { if (e.isTrusted && Date.now() < quietUntil) { e.stopPropagation(); e.preventDefault(); } }, true);
    /* Nach unten wischen schließt das „Mehr“-Fenster */
    if (more) {
      var md = null;
      more.addEventListener('touchstart', function (e) { var t = e.touches[0]; md = { x: t.clientX, y: t.clientY }; }, { passive: true });
      more.addEventListener('touchend', function (e) { var t = e.changedTouches[0]; if (md && t.clientY - md.y > 40 && Math.abs(t.clientX - md.x) < 40) setOpen(false); md = null; }, { passive: true });
    }
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
      var em = $('sup-email'), hp = $('sup-web');
      var r = await RSAUTH.supportPost(top ? top.value : 'question', txt.value, from ? 'Support (von ' + from + ')' : '/support/', { email: em ? em.value : '', hp: hp ? hp.value : '' });
      busy = false; send.disabled = false;
      if (r.ok) txt.value = '';
      say(r.text, r.kind);
    });
  }
})();
