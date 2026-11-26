/* Rätselheft: Drag-and-Drop, „ganz nach oben/unten“, Ladeanzeige, Tastatur im Zoom */
'use strict';
(function () {
  if (typeof BK === 'undefined' || typeof refreshUI !== 'function') return;
  var list = document.getElementById('bk-list'); if (!list) return;

  /* Verschieben an Zielposition (nutzt manuelle Reihenfolge wie BK.move) */
  BK.moveTo = function (id, toIdx) {
    if (bk.opts.sort !== 'manual') { bk.items = displayItems(); bk.opts.sort = 'manual'; }
    var i = bk.items.findIndex(function (x) { return x.id === id; });
    if (i < 0) return; toIdx = Math.max(0, Math.min(bk.items.length - 1, toIdx));
    if (i === toIdx) return;
    var it = bk.items.splice(i, 1)[0]; bk.items.splice(toIdx, 0, it);
    refreshUI(); flash(id);
  };
  function flash(id) {
    var el = list.querySelector('[data-id="' + id + '"]'); if (!el) return;
    el.classList.add('bk-moved'); try { el.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (e) {}
  }

  /* Nach jedem Neuaufbau Zeilen mit IDs und Griffen versehen */
  function decorate() {
    var items = displayItems(), rows = list.querySelectorAll('.bk-item');
    rows.forEach(function (row, i) {
      var it = items[i]; if (!it) return;
      row.dataset.id = it.id; row.setAttribute('draggable', 'true');
      var no = row.querySelector('.no'); if (no) { no.title = 'Ziehen zum Verschieben'; no.setAttribute('aria-label', 'Position ' + (i + 1) + ', ziehen zum Verschieben'); }
    });
  }
  var origRefresh = refreshUI;
  refreshUI = function (k) { origRefresh(k); decorate(); };
  decorate();

  /* Maus/Desktop: HTML5-Drag */
  var dragId = null;
  function clear() { list.querySelectorAll('.bk-over-top,.bk-over-bottom,.bk-dragging').forEach(function (e) { e.classList.remove('bk-over-top', 'bk-over-bottom', 'bk-dragging'); }); }
  function rowAt(t) { return t && t.closest ? t.closest('.bk-item[data-id]') : null; }
  list.addEventListener('dragstart', function (e) {
    var row = rowAt(e.target); if (!row || /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) { e.preventDefault(); return; }
    dragId = row.dataset.id; row.classList.add('bk-dragging'); e.dataTransfer.effectAllowed = 'move';
    try { e.dataTransfer.setData('text/plain', dragId); } catch (x) {}
  });
  list.addEventListener('dragover', function (e) {
    if (!dragId) return; var row = rowAt(e.target); if (!row) return; e.preventDefault();
    var r = row.getBoundingClientRect(), top = e.clientY < r.top + r.height / 2;
    list.querySelectorAll('.bk-over-top,.bk-over-bottom').forEach(function (x) { x.classList.remove('bk-over-top', 'bk-over-bottom'); });
    row.classList.add(top ? 'bk-over-top' : 'bk-over-bottom');
  });
  list.addEventListener('drop', function (e) {
    if (!dragId) return; var row = rowAt(e.target); if (!row) return; e.preventDefault();
    var r = row.getBoundingClientRect(), top = e.clientY < r.top + r.height / 2;
    var ids = displayItems().map(function (x) { return x.id; }), from = ids.indexOf(dragId), to = ids.indexOf(row.dataset.id);
    if (from < to) to -= 1; if (!top) to += 1; if (from < to && !top) to -= 0;
    var id = dragId; dragId = null; clear(); BK.moveTo(id, Math.max(0, Math.min(ids.length - 1, to < 0 ? 0 : to)));
  });
  list.addEventListener('dragend', function () { dragId = null; clear(); });

  /* iPhone/Touch: Nummer als Griff, Finger ziehen */
  var t = null;
  list.addEventListener('touchstart', function (e) {
    var no = e.target.closest && e.target.closest('.no'); if (!no) return;
    var row = rowAt(no); if (!row) return; t = { id: row.dataset.id, row: row, over: null, top: false };
    row.classList.add('bk-dragging'); if (navigator.vibrate) navigator.vibrate(8);
  }, { passive: true });
  list.addEventListener('touchmove', function (e) {
    if (!t) return; e.preventDefault();
    var p = e.touches[0], el = document.elementFromPoint(p.clientX, p.clientY), row = rowAt(el);
    list.querySelectorAll('.bk-over-top,.bk-over-bottom').forEach(function (x) { x.classList.remove('bk-over-top', 'bk-over-bottom'); });
    if (row && row !== t.row) { var r = row.getBoundingClientRect(); t.over = row; t.top = p.clientY < r.top + r.height / 2; row.classList.add(t.top ? 'bk-over-top' : 'bk-over-bottom'); } else t.over = null;
    if (p.clientY < 90) window.scrollBy(0, -12); else if (p.clientY > innerHeight - 90) window.scrollBy(0, 12);
  }, { passive: false });
  function touchEnd() {
    if (!t) return; var s = t; t = null; clear();
    if (!s.over) return;
    var ids = displayItems().map(function (x) { return x.id; }), from = ids.indexOf(s.id), to = ids.indexOf(s.over.dataset.id);
    if (from < to) to -= 1; if (!s.top) to += 1; BK.moveTo(s.id, to);
  }
  list.addEventListener('touchend', touchEnd); list.addEventListener('touchcancel', function () { t = null; clear(); });

  /* Tastatur: Alt+Pfeil auf der Nummer verschiebt, Pos1/Ende ganz nach oben/unten */
  list.addEventListener('keydown', function (e) {
    var row = rowAt(e.target); if (!row || !e.altKey) return;
    var ids = displayItems().map(function (x) { return x.id; }), i = ids.indexOf(row.dataset.id);
    if (e.key === 'ArrowUp') { e.preventDefault(); BK.moveTo(row.dataset.id, i - 1); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); BK.moveTo(row.dataset.id, i + 1); }
    else if (e.key === 'Home') { e.preventDefault(); BK.moveTo(row.dataset.id, 0); }
    else if (e.key === 'End') { e.preventDefault(); BK.moveTo(row.dataset.id, ids.length - 1); }
  });

  /* Ladeanzeige der Vorschau */
  var origThumbs = renderThumbs, box = document.getElementById('bk-thumbs');
  renderThumbs = function () {
    if (box) box.classList.add('bk-loading');
    requestAnimationFrame(function () { try { origThumbs(); } finally { if (box) box.classList.remove('bk-loading'); decorateThumbs(); } });
  };
  function decorateThumbs() {
    if (!box) return;
    box.querySelectorAll('.bk-thumb').forEach(function (th) { th.tabIndex = 0; th.setAttribute('role', 'button'); th.setAttribute('aria-label', 'Seite vergrößern'); });
  }
  if (box) box.addEventListener('keydown', function (e) { if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('bk-thumb')) { e.preventDefault(); e.target.click(); } });

  /* Zoom: Escape schließt */
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { var z = document.querySelector('.bk-zoom'); if (z) z.remove(); } });
})();
