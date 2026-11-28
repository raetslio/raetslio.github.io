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

  /* ---- Liquid-Glass-Wähler (Leiste unten und „Darstellung“ im Mehr-Fenster) ----
     Wie bei Apple: Der Wähler gleitet zum aktiven Eintrag. Wer ihn drückt, hebt ihn an (größer, heller). Beim Ziehen folgt er dem Finger
     mit leichter Verzögerung und dehnt sich in Bewegungsrichtung; am Rand gibt er gummiartig nach. Beim Loslassen federt er zum nächsten Eintrag. */
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var buzz = function (ms) { try { if (!reduce && navigator.vibrate) navigator.vibrate(ms); } catch (e) {} };
  function liquid(box, o) {
    var pill = document.createElement('span'); pill.className = 'rs-am-pill ' + (o.cls || ''); pill.setAttribute('aria-hidden', 'true'); box.insertBefore(pill, box.firstChild);
    var btns = o.buttons(), S = null, quietUntil = 0, raf = 0, first = true;
    var geo = function (b) { return { l: b.offsetLeft, w: b.offsetWidth, t: b.offsetTop, h: b.offsetHeight }; };
    var bounds = function () { return { min: btns[0].offsetLeft, max: btns[btns.length - 1].offsetLeft }; };
    var paint = function (left, w, h, top, sx, sy, ty, instant) {
      pill.style.transition = instant ? 'none' : '';
      pill.style.opacity = '1'; pill.style.width = w + 'px'; pill.style.height = h + 'px'; pill.style.top = top + 'px';
      pill.style.transform = 'translate(' + left.toFixed(1) + 'px,' + (ty || 0).toFixed(1) + 'px) scale(' + (sx || 1).toFixed(3) + ',' + (sy || 1).toFixed(3) + ')';
    };
    var rest = function (instant) {
      if (S && S.lift) return;
      var b = o.active(); if (!b || !box.offsetWidth) { pill.style.opacity = '0'; return; }
      var g = geo(b); if (pill.classList.contains('rs-lift')) pill.classList.remove('rs-lift'); paint(g.l, g.w, g.h, g.t, 1, 1, 0, instant || reduce);
    };
    var nearest = function (x) { /* Eintrag, der zur Mitte des Wählers (x) am nächsten liegt */
      var r = box.getBoundingClientRect(), best = btns[0], d = 1e9;
      btns.forEach(function (b) { var c = r.left + b.offsetLeft + b.offsetWidth / 2, k = Math.abs(c - x); if (k < d) { d = k; best = b; } });
      return best;
    };
    var frame = function () {
      raf = 0; if (!S || !S.lift) return;
      var bd = bounds(), t = S.target;
      var over = t < bd.min ? bd.min - t : t > bd.max ? t - bd.max : 0; /* Gummiband am Rand */
      var tt = over ? (t < bd.min ? bd.min - Math.sqrt(over) * 3 : bd.max + Math.sqrt(over) * 3) : t;
      var prev = S.pos; S.pos += (tt - S.pos) * 0.32; var v = S.pos - prev; S.v += (v - S.v) * 0.4;
      var av = Math.abs(S.v), g = geo(S.cur || btns[0]);
      var sx = 1.16 + Math.min(av / 36, 0.34), sy = 1.16 - Math.min(av / 120, 0.07);
      paint(S.pos, g.w, g.h, g.t, sx, sy, S.ty || 0, true);
      if (Math.abs(tt - S.pos) > 0.3 || av > 0.3 || S.down) raf = requestAnimationFrame(frame);
    };
    var go = function () { if (!raf) raf = requestAnimationFrame(frame); };
    var lift = function () {
      if (S.lift || reduce) { S.lift = true; return; }
      S.lift = true; if (!pill.classList.contains('rs-lift')) pill.classList.add('rs-lift'); var b = o.active() || S.b || btns[0]; S.pos = b.offsetLeft; S.target = S.pos; S.v = 0; S.cur = b; go();
    };
    var down = function (x, y) {
      var r = box.getBoundingClientRect();
      S = { down: true, x: x, y: y, dir: '', moved: false, lift: false, pos: 0, target: 0, v: 0, ty: 0, b: nearest(x), cur: null, dy: 0, left: r.left };
      if (S.b === o.active()) lift();
    };
    var move = function (x, y) {
      if (!S || !S.down) return; var dx = x - S.x, dy = y - S.y;
      if (!S.dir) { if (Math.abs(dx) < 5 && Math.abs(dy) < 5) return; S.dir = (o.vertical && Math.abs(dy) > Math.abs(dx)) ? 'v' : 'h'; lift(); try { if (S.pid !== undefined) box.setPointerCapture(S.pid); } catch (x) {} } /* Erfassen erst beim Ziehen, sonst gehen normale Tipps an die Leiste statt an den Knopf */
      if (S.dir === 'v') { S.dy = dy; S.ty = (dy < 0 ? -1 : 1) * (1 - Math.exp(-Math.abs(dy) / 60)) * 10; go(); return; }
      S.moved = true; var w = (S.cur || btns[0]).offsetWidth;
      S.target = x - S.left - w / 2; go();
      var n = nearest(x); if (n !== S.cur) { S.cur = n; buzz(8); }
      btns.forEach(function (b) { var on = b === S.cur; if (b.classList.contains('rs-am-hover') !== on) b.classList.toggle('rs-am-hover', on); });
    };
    var up = function () {
      if (!S) return; var d = S; S = null; if (raf) { cancelAnimationFrame(raf); raf = 0; }
      btns.forEach(function (b) { if (b.classList.contains('rs-am-hover')) b.classList.remove('rs-am-hover'); });
      var cur = o.active();
      if (d.dir === 'v' && Math.abs(d.dy) > 24 && o.vertical) { quietUntil = Date.now() + 600; o.vertical(d.dy); }
      else if (d.moved && d.cur) { quietUntil = Date.now() + 600; buzz(12); if (d.cur !== cur) { var g = geo(d.cur); paint(g.l, g.w, g.h, g.t, 1, 1, 0, false); d.cur.click(); } }
      if (pill.classList.contains('rs-lift')) pill.classList.remove('rs-lift'); setTimeout(function () { rest(false); }, 0);
    };
    box.addEventListener('pointerdown', function (e) { if (e.pointerType === 'mouse' && e.button !== 0) return; down(e.clientX, e.clientY); S && (S.pid = e.pointerId); });
    box.addEventListener('pointermove', function (e) { move(e.clientX, e.clientY); });
    box.addEventListener('pointerup', up);
    box.addEventListener('pointercancel', function () { S = null; if (raf) { cancelAnimationFrame(raf); raf = 0; } btns.forEach(function (b) { if (b.classList.contains('rs-am-hover')) b.classList.remove('rs-am-hover'); }); if (pill.classList.contains('rs-lift')) pill.classList.remove('rs-lift'); rest(false); });
    /* Klick nach dem Ziehen verwerfen (sonst doppelt) */
    box.addEventListener('click', function (e) { if (e.isTrusted && Date.now() < quietUntil) { e.stopPropagation(); e.preventDefault(); } }, true);
    var sync = function (instant) { rest(instant); };
    var refresh = function () { sync(first); first = false; if (o.onChange) o.onChange(); };
    if (window.MutationObserver) new MutationObserver(refresh).observe(box, { attributes: true, attributeFilter: ['aria-current', 'aria-pressed', 'class'], subtree: true });
    window.addEventListener('resize', function () { sync(true); });
    if (window.ResizeObserver) new ResizeObserver(function () { sync(true); }).observe(box);
    window.addEventListener('load', function () { sync(true); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { sync(true); });
    return { sync: sync, refresh: refresh };
  }

  var nav = $('rs-appnav');
  if (nav) {
    var nbtns = Array.prototype.slice.call(nav.querySelectorAll('button')), lastCur = null;
    var nlq = liquid(nav, {
      buttons: function () { return nbtns; },
      active: function () { return nav.querySelector('button.rs-am-on') || nav.querySelector('button[aria-current="page"]'); },
      vertical: function (dy) { if (dy < 0 && !isOpen()) { buzz(12); setOpen(true); } else if (dy > 0 && isOpen()) setOpen(false); },
      onChange: function () {
        var cur = nav.querySelector('button.rs-am-on') || nav.querySelector('button[aria-current="page"]');
        if (cur && cur !== lastCur) { if (lastCur && !reduce) { cur.classList.remove('rs-am-pop'); void cur.offsetWidth; cur.classList.add('rs-am-pop'); } lastCur = cur; }
      }
    });
    nlq.refresh();
    /* Nach unten wischen schließt das „Mehr“-Fenster */
    if (more) {
      var md = null;
      more.addEventListener('touchstart', function (e) { var t = e.touches[0]; md = { x: t.clientX, y: t.clientY }; }, { passive: true });
      more.addEventListener('touchend', function (e) { var t = e.changedTouches[0]; if (md && t.clientY - md.y > 40 && Math.abs(t.clientX - md.x) < 40) setOpen(false); md = null; }, { passive: true });
    }
  }
  /* „Darstellung“ im Mehr-Fenster: gleicher Wähler wie die Leiste */
  var seg = more && more.querySelector('.rs-am-seg');
  if (seg) {
    var sbtns = Array.prototype.slice.call(seg.querySelectorAll('button'));
    var sl = liquid(seg, { cls: 'rs-seg-pill', buttons: function () { return sbtns; }, active: function () { return seg.querySelector('button[aria-pressed="true"]'); } });
    if (window.MutationObserver) new MutationObserver(function () { sl.sync(true); }).observe(more, { attributes: true, attributeFilter: ['class'] });
    sl.refresh();
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
