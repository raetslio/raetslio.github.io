/* ======================================================================
   Labyrinth: Online spielen
   Oberfläche, Steuerung (Wischen, Pfeiltasten, Steuerkreuz) und Zeichnen (Objekt MZ).
   ====================================================================== */
'use strict';

var mz = { hard: 0, n: 15, data: null, pos: 0, trail: [0], steps: 0, won: false, sol: false };
var MZ_SIZES = [8, 10, 15, 20, 30, 40, 60, 80, 100];
var CS = 10, MG = 6;
window.MZ = {
  init: function () {
    $('mz-sizes').innerHTML = MZ_SIZES.map(function (s) { return '<button type="button" class="chip-btn" data-v="' + s + '" onclick="MZ.setSize(' + s + ')">' + s + '×' + s + '</button>'; }).join('');
    $('mz-hard').innerHTML = ['Normal', 'Schwer', 'Extrem'].map(function (s, i) { return '<button type="button" class="chip-btn" data-h="' + i + '" onclick="MZ.setHard(' + i + ')">' + s + '</button>'; }).join('');
    MZ.newPuzzle();
    var wrap = $('mz-wrap'), dragging = false;
    function cellAt(e) {
      var svg = wrap.querySelector('svg'); if (!svg) return -1;
      var pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
      var p = pt.matrixTransform(svg.getScreenCTM().inverse());
      var x = Math.floor(p.x / CS), y = Math.floor(p.y / CS);
      return (x < 0 || y < 0 || x >= mz.n || y >= mz.n) ? -1 : y * mz.n + x;
    }
    var last = null, start = null, moved = false;
    function svgPt(e) {
      var svg = wrap.querySelector('svg'), pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
      var p = pt.matrixTransform(svg.getScreenCTM().inverse()); return { x: p.x, y: p.y, cx: e.clientX, cy: e.clientY };
    }
    function cellOf(p) { var x = Math.floor(p.x / CS), y = Math.floor(p.y / CS); return (x < 0 || y < 0 || x >= mz.n || y >= mz.n) ? -1 : y * mz.n + x; }
    wrap.addEventListener('pointerdown', function (e) { dragging = true; try { wrap.setPointerCapture(e.pointerId); } catch (x) {} MZ.stopWalk(); last = start = svgPt(e); moved = false; });
    wrap.addEventListener('pointermove', function (e) {
      if (!dragging || !last) return;
      var rect = wrap.querySelector('svg').getBoundingClientRect(), cellPx = rect.width * CS / (mz.n * CS + 2 * MG), thr = Math.max(cellPx * 0.7, 18);
      var dx = e.clientX - last.cx, dy = e.clientY - last.cy, guard = 0;
      while (guard++ < 8 && Math.max(Math.abs(dx), Math.abs(dy)) >= thr) {
        var d;
        if (Math.abs(dx) >= Math.abs(dy)) { d = dx > 0 ? 1 : 3; last.cx += dx > 0 ? thr : -thr; }
        else { d = dy > 0 ? 2 : 0; last.cy += dy > 0 ? thr : -thr; }
        MZ.move(d);
        dx = e.clientX - last.cx; dy = e.clientY - last.cy;
      }
    });
    wrap.addEventListener('pointerup', function (e) {
      dragging = false; last = null;
    });
    wrap.addEventListener('pointercancel', function () { dragging = false; last = null; });
    document.addEventListener('keydown', function (e) {
      if (window.appState.mode !== 'labyrinth') return;
      if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
      var m = { ArrowUp: 0, ArrowRight: 1, ArrowDown: 2, ArrowLeft: 3, w: 0, d: 1, s: 2, a: 3, W: 0, D: 1, S: 2, A: 3 }[e.key];
      if (m !== undefined) { e.preventDefault(); if (e.shiftKey) MZ.run(m); else { MZ.stopWalk(); MZ.move(m); } }
    });
  },
  setSize: function (s) { mz.n = s; MZ.newPuzzle(); },
  setHard: function (h) { mz.hard = h; MZ.newPuzzle(); },
  newPuzzle: function () { mz.extras = []; mz.data = mazeCreate(mz.n); MZ.restart(); },
  restart: function (keep) {
    MZ.stopWalk(); if (!keep) { mz.pos = 0; mz.trail = [0]; mz.steps = 0; mz.won = false; mz.sol = false; } banner($('mz-feedback'), '');
    var n = mz.n, W = n * CS, svg = '<svg viewBox="' + (-MG) + ' ' + (-MG) + ' ' + (W + 2 * MG) + ' ' + (W + 2 * MG) + '" role="img" aria-label="Labyrinth">' +
      '<rect x="0" y="0" width="' + W + '" height="' + W + '" fill="none"/>' +
      '<polyline id="mz-sol" points="" fill="none" stroke="var(--secondary)" stroke-opacity=".6" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"/>' +
      '<polyline id="mz-trail" points="" fill="none" stroke="var(--data-3)" stroke-opacity=".75" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"/>' +
      '<path d="' + mazeWallPath(mz.data, 0, 0, CS) + '" fill="none" stroke="var(--on-surface)" stroke-width="' + (n > 25 ? 0.9 : 1.2) + '" stroke-linecap="round"/>' +
      '<text x="' + CS / 2 + '" y="-1.8" text-anchor="middle" font-size="3.4" fill="var(--on-surface-variant)">Start</text>' +
      '<text x="' + (W - CS / 2) + '" y="' + (W + 5) + '" text-anchor="middle" font-size="3.4" fill="var(--on-surface-variant)">Ziel</text>' +
      '<circle id="mz-pl" r="3" fill="var(--primary)" stroke="var(--on-primary)" stroke-width=".6"/></svg>';
    $('mz-wrap').innerHTML = svg;
    $('mz-badge').textContent = n + '×' + n + ' · ' + DIFFS[mazeDiff(n, mz.data.h)];
    $('mz-diff-hint').textContent = 'Schwierigkeit: ' + DIFFS[mazeDiff(n, mz.data.h)] + ' (Größe und Labyrinth-Typ)';
    document.querySelectorAll('#mz-sizes .chip-btn').forEach(function (b) { b.setAttribute('aria-pressed', +b.dataset.v === n ? 'true' : 'false'); });
    document.querySelectorAll('#mz-hard .chip-btn').forEach(function (b) { b.setAttribute('aria-pressed', +b.dataset.h === (mz.data.h || 0) ? 'true' : 'false'); });
    MZ.draw();
  },
  draw: function () {
    var n = mz.n, pl = $('mz-pl'); if (!pl) return;
    var cx = (mz.pos % n + 0.5) * CS, cy = (Math.floor(mz.pos / n) + 0.5) * CS;
    pl.setAttribute('cx', cx); pl.setAttribute('cy', cy);
    $('mz-trail').setAttribute('points', mazePathPts({ n: n }, 0, 0, CS, mz.trail).split(' ').slice(1, mz.trail.length + 1).join(' '));
    $('mz-sol').setAttribute('points', mz.sol ? mazePathPts(mz.data, 0, 0, CS, mz.data.path) : '');
    $('mz-stats').textContent = 'Schritte: ' + mz.steps + ' · Kürzester Weg: ' + (mz.data.path.length - 1);
    if (window.__rsInit && window.schedulePersist) window.schedulePersist();
  },
  move: function (d) {
    if (mz.won) return;
    var n = mz.n; if (!(mz.data.open[mz.pos] & (1 << d))) return;
    var np = (Math.floor(mz.pos / n) + DY[d]) * n + (mz.pos % n) + DX[d];
    if (mz.trail.length > 1 && mz.trail[mz.trail.length - 2] === np) mz.trail.pop(); else mz.trail.push(np);
    mz.pos = np; mz.steps++;
    MZ.draw();
    if (np === n * n - 1) {
      mz.won = true;
      var best = mz.data.path.length - 1;
      banner($('mz-feedback'), 'Ziel erreicht in ' + mz.steps + ' Schritten' + (mz.steps === best ? ' – perfekter Weg!' : ' (kürzester Weg: ' + best + ').'), 'success');
    }
  },
  toCell: function (c) {
    if (c < 0 || c === mz.pos) return;
    var n = mz.n, dx = (c % n) - (mz.pos % n), dy = Math.floor(c / n) - Math.floor(mz.pos / n);
    for (var d = 0; d < 4; d++) if (DX[d] === dx && DY[d] === dy) { MZ.move(d); return; }
  },
  auto: true,
  timer: null,
  stopWalk: function () { if (MZ.timer) { clearInterval(MZ.timer); MZ.timer = null; } },
  pathTo: function (t) {
    var n = mz.n, prev = {}, q = [mz.pos]; prev[mz.pos] = -1;
    for (var h = 0; h < q.length; h++) {
      var c = q[h]; if (c === t) break;
      for (var d = 0; d < 4; d++) { if (!(mz.data.open[c] & (1 << d))) continue; var nn = c + DY[d] * n + DX[d]; if (prev[nn] === undefined) { prev[nn] = c; q.push(nn); } }
    }
    if (prev[t] === undefined) return null;
    var path = []; for (var p = t; p !== mz.pos; p = prev[p]) path.push(p); return path.reverse();
  },
  stepTo: function (c) { var n = mz.n, dx = (c % n) - (mz.pos % n), dy = Math.floor(c / n) - Math.floor(mz.pos / n); for (var d = 0; d < 4; d++) if (DX[d] === dx && DY[d] === dy) { MZ.move(d); return; } },
  limitAtJunction: function (path) {
    var n = mz.n, open = mz.data.open, prev = mz.pos;
    for (var i = 0; i < path.length - 1; i++) {
      var c = path[i], outs = 0;
      for (var d = 0; d < 4; d++) { if (!(open[c] & (1 << d))) continue; if (c + DY[d] * n + DX[d] !== prev) outs++; }
      if (outs !== 1) return path.slice(0, i + 1);
      prev = c;
    }
    return path;
  },
  follow: function (c) { var path = MZ.pathTo(c); if (path && path.length <= 3) path.forEach(function (x) { MZ.stepTo(x); }); },
  walk: function (list, ms) {
    MZ.stopWalk(); if (!list || !list.length) return; var i = 0;
    MZ.timer = setInterval(function () { if (i >= list.length || mz.won) { MZ.stopWalk(); return; } MZ.stepTo(list[i++]); }, ms || 26);
  },
  run: function (d) {
    if (mz.won) return; MZ.stopWalk();
    var n = mz.n, open = mz.data.open, cur = mz.pos, dir = d, list = [];
    for (var g = 0; g < n * n; g++) {
      if (!(open[cur] & (1 << dir))) break;
      cur = cur + DY[dir] * n + DX[dir]; list.push(cur);
      if (cur === n * n - 1) break;
      var from = (dir + 2) % 4, outs = [0, 1, 2, 3].filter(function (k) { return k !== from && (open[cur] & (1 << k)); });
      if (outs.length !== 1) break; dir = outs[0];
    }
    MZ.walk(list, 22);
  },
  dpad: function (d) { if (MZ.auto) MZ.run(d); else { MZ.stopWalk(); MZ.move(d); } },
  reveal: function () { mz.sol = !mz.sol; MZ.draw(); },
  current: function () { return mz.data ? { n: mz.n, open: mz.data.open, path: mz.data.path, h: mz.data.h } : null; }
};
