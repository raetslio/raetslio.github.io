/* Seitenmenü: öffnen/schließen, Wischgesten, Tastatur. Verändert keine Rätsel-Funktionen. */
(function () {
  'use strict';
  var body = document.body, drawer = document.getElementById('rs-drawer'), back = document.getElementById('rs-backdrop');
  var openBtn = document.getElementById('rs-menu-btn'), closeBtn = document.getElementById('rs-menu-close');
  if (!drawer || !openBtn) return;
  function isOpen() { return body.classList.contains('rs-menu-open'); }
  function setOpen(o) {
    body.classList.toggle('rs-menu-open', o);
    openBtn.setAttribute('aria-expanded', o ? 'true' : 'false');
    drawer.setAttribute('aria-hidden', o ? 'false' : 'true');
    drawer.style.transform = ''; back.style.opacity = '';
    if (o) { var sel = drawer.querySelector('.nav-tab[aria-selected="true"]') || closeBtn; try { sel.focus({ preventScroll: true }); } catch (e) {} }
    else if (document.activeElement && drawer.contains(document.activeElement)) { try { openBtn.focus({ preventScroll: true }); } catch (e) {} }
  }
  openBtn.addEventListener('click', function () { setOpen(true); });
  closeBtn.addEventListener('click', function () { setOpen(false); });
  back.addEventListener('click', function () { setOpen(false); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && isOpen()) setOpen(false); });
  /* Nach Auswahl einer Rätselart bzw. nach Konto-Klick Menü schließen */
  drawer.addEventListener('click', function (e) { if (e.target.closest('.nav-tab, #btn-account')) setOpen(false); });
  var cur = null; /* Wischen: vom linken Rand öffnen, im Menü nach links schließen */
  var W = function () { return drawer.offsetWidth || 300; };
  document.addEventListener('touchstart', function (e) {
    if (e.touches.length !== 1) return; var t = e.touches[0];
    if (isOpen()) cur = { x: t.clientX, y: t.clientY, mode: 'close', lock: false };
    else if (t.clientX < 20 && !e.target.closest('input,textarea,select')) cur = { x: t.clientX, y: t.clientY, mode: 'open', lock: false };
    else cur = null;
  }, { passive: true });
  document.addEventListener('touchmove', function (e) {
    if (!cur) return; var t = e.touches[0], dx = t.clientX - cur.x, dy = t.clientY - cur.y;
    if (!cur.lock) {
      if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { cur = null; return; }
      if ((cur.mode === 'open' && dx > 10) || (cur.mode === 'close' && dx < -10)) { cur.lock = true; drawer.classList.add('rs-dragging'); } else return;
    }
    var p = cur.mode === 'open' ? Math.min(Math.max(dx / W(), 0), 1) : 1 - Math.min(Math.max(-dx / W(), 0), 1);
    cur.p = p; drawer.style.transform = 'translateX(' + ((p - 1) * 100) + '%)'; back.style.visibility = 'visible'; back.style.opacity = p;
  }, { passive: true });
  document.addEventListener('touchend', function () {
    if (!cur) return; var c = cur; cur = null; if (!c.lock) return;
    drawer.classList.remove('rs-dragging'); back.style.visibility = '';
    setOpen(c.p > 0.4);
  }, { passive: true });
  document.addEventListener('touchcancel', function () { if (cur && cur.lock) { drawer.classList.remove('rs-dragging'); back.style.visibility = ''; setOpen(isOpen()); } cur = null; }, { passive: true });
})();
