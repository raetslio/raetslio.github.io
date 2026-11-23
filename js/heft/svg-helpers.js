/* ======================================================================
   SVG-Helfer für Blätter und Hefte
   Zeichnen von Rätseln, Texten und Rahmen als SVG (Raster, Lösungen, Titelkacheln).
   ====================================================================== */
'use strict';

var INK = '#1f2326', MUTED = '#6a7276', ACC = '#3c5a6e', SOLINK = '#2f5a78';
function T(x, y, s, fs, o) {
  o = o || {};
  return '<text x="' + x.toFixed(2) + '" y="' + y.toFixed(2) + '" font-size="' + fs + '" font-weight="' + (o.w || 400) + '" fill="' + (o.fill || INK) + '" text-anchor="' + (o.a || 'start') + '"' + (o.ff ? ' font-family="' + o.ff + '"' : '') + '>' + esc(s) + '</text>';
}
function wrap(text, widthMm, fs) {
  var max = Math.max(10, Math.floor(widthMm / (fs * 0.5))), words = String(text).split(/\s+/), lines = [], cur = '';
  words.forEach(function (w) { if ((cur + ' ' + w).trim().length > max) { lines.push(cur); cur = w; } else cur = (cur + ' ' + w).trim(); });
  if (cur) lines.push(cur);
  return lines;
}
var PW = 'width="210mm" height="296mm"';
function pageWrap(inner) {
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 210 297" ' + PW + ' font-family="Hanken Grotesk, Outfit, Arial, sans-serif"><rect width="210" height="297" fill="#fff"/>' + inner + '</svg>';
}
function bxGridSvg(gx, gy, size, d, sol) {
  var n = d.n, cs = size / n, p = [];
  for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) {
    var given = d.givens[r][c] >= 0, v = given ? d.givens[r][c] : (sol ? d.solution[r][c] : -1);
    var x = gx + c * cs, y = gy + r * cs, cx = x + cs / 2, cy = y + cs / 2, rr = cs * 0.27;
    if (given) p.push('<rect x="' + x.toFixed(2) + '" y="' + y.toFixed(2) + '" width="' + cs.toFixed(2) + '" height="' + cs.toFixed(2) + '" fill="#eceeed"/>');
    if (v < 0) continue;
    var col = given ? INK : SOLINK, sw = Math.max(0.35, cs * 0.075);
    if (v === 0) p.push('<circle cx="' + cx.toFixed(2) + '" cy="' + cy.toFixed(2) + '" r="' + rr.toFixed(2) + '" fill="none" stroke="' + col + '" stroke-width="' + sw.toFixed(2) + '"/>');
    else p.push('<path d="M' + (cx - rr).toFixed(2) + ' ' + (cy - rr).toFixed(2) + 'L' + (cx + rr).toFixed(2) + ' ' + (cy + rr).toFixed(2) + 'M' + (cx + rr).toFixed(2) + ' ' + (cy - rr).toFixed(2) + 'L' + (cx - rr).toFixed(2) + ' ' + (cy + rr).toFixed(2) + '" stroke="' + col + '" stroke-width="' + sw.toFixed(2) + '" stroke-linecap="round"/>');
  }
  for (var i = 1; i < n; i++) {
    p.push('<path d="M' + (gx + i * cs).toFixed(2) + ' ' + gy + 'v' + size + 'M' + gx + ' ' + (gy + i * cs).toFixed(2) + 'h' + size + '" stroke="#b9c2bd" stroke-width="0.18"/>');
  }
  p.push('<rect x="' + gx + '" y="' + gy + '" width="' + size + '" height="' + size + '" fill="none" stroke="' + INK + '" stroke-width="0.5"/>');
  return p.join('');
}
function mazeSvg(gx, gy, size, d, sol) {
  var cs = size / d.n, sw = Math.max(0.25, Math.min(0.6, cs * 0.12));
  var s = '<path d="' + mazeWallPath(d, gx, gy, cs) + '" fill="none" stroke="' + INK + '" stroke-width="' + sw.toFixed(2) + '" stroke-linecap="round"/>';
  if (sol) s += '<polyline points="' + mazePathPts(d, gx, gy, cs, d.path) + '" fill="none" stroke="#b86b4b" stroke-opacity=".85" stroke-width="' + Math.max(0.4, cs * 0.18).toFixed(2) + '" stroke-linejoin="round" stroke-linecap="round"/>';
  s += T(gx + cs / 2, gy - 1.4, 'Start', 2.6, { a: 'middle', fill: MUTED }) + T(gx + size - cs / 2, gy + size + 3.6, 'Ziel', 2.6, { a: 'middle', fill: MUTED });
  return s;
}
function wsList(it, x, y, w, h, fs0) {
  var words = it.data.words, fs = fs0, cols, rows, lh;
  for (; fs >= 1.9; fs -= 0.15) {
    var colW = Math.max.apply(null, words.map(function (s) { return s.length; })) * fs * 0.62 + fs * 1.8;
    cols = Math.max(1, Math.floor(w / colW)); rows = Math.ceil(words.length / cols); lh = fs * 1.5;
    if (rows * lh <= h) break;
  }
  var cw = w / cols, o = [];
  words.forEach(function (wd, i) {
    var c = Math.floor(i / rows), r = i % rows, bx0 = x + c * cw, by = y + r * lh + fs;
    o.push('<rect x="' + bx0.toFixed(2) + '" y="' + (by - fs * 0.75).toFixed(2) + '" width="' + (fs * 0.7).toFixed(2) + '" height="' + (fs * 0.7).toFixed(2) + '" fill="none" stroke="' + MUTED + '" stroke-width="0.2"/>');
    o.push(T(bx0 + fs * 1.1, by, wd, fs, { w: 500 }));
  });
  return o.join('');
}
/* Rätsel in Rechteck zeichnen */
function drawPuzzle(it, x, y, w, h, sol, withList) {
  var d = it.data, s;
  if (it.type === 'ws') {
    var wsObj = { size: d.size, grid: d.grid, placements: d.placements };
    if (!withList) { s = Math.min(w, h); return window.renderWsPrintGrid(x + (w - s) / 2, y, s, wsObj, sol, true, false); }
    if (w >= h * 1.25) {
      s = Math.min(h, w * 0.6);
      return window.renderWsPrintGrid(x, y, s, wsObj, sol, true, false) + wsList(it, x + s + 5, y, w - s - 5, h, 3.4);
    }
    s = Math.min(w, h * 0.7);
    return window.renderWsPrintGrid(x + (w - s) / 2, y, s, wsObj, sol, true, false) + wsList(it, x, y + s + 6, w, h - s - 6, it.big ? 3.6 : 3.2);
  }
  if (it.type === 'maze') { s = Math.min(w, h - 9); return mazeSvg(x + (w - s) / 2, y + 4.5, s, d, sol); }
  if (NXT[it.type]) return NXT[it.type].draw(x, y, w, h, d, sol);
  s = Math.min(w, h);
  if (it.type === 'sudoku') return window.renderSudokuPrintGrid(x + (w - s) / 2, y, s, d.n, d.subR, d.subC, { solution: d.solution, givens: d.givens }, sol, true, false);
  return bxGridSvg(x + (w - s) / 2, y, s, d, sol);
}
function slotRect(per, i) {
  if (per === 1) return { x: 15, y: 20, w: 180, h: 262 };
  if (per === 2) return { x: 15, y: i === 0 ? 20 : 155, w: 180, h: 127 };
  return { x: i % 2 === 0 ? 15 : 108, y: i < 2 ? 20 : 155, w: 87, h: 127 };
}
function puzzleSlot(it, per, i) {
  var r = slotRect(per, i), fs = per === 4 ? 4.2 : 5, o = '';
  o += '<rect x="' + r.x + '" y="' + r.y + '" width="9.5" height="7.2" rx="1.5" fill="' + ACC + '"/>' + T(r.x + 4.75, r.y + 5.3, String(it.no), 4.4, { w: 700, fill: '#fff', a: 'middle' });
  o += T(r.x + 12, r.y + 5.2, it.name, fs, { w: 700 });
  if (bk.opts.showMeta) o += T(r.x + 12, r.y + 10, TYPE_LABEL[it.type] + ' · ' + sizeLabel(it) + ' · ' + DIFFS[it.diff], 2.9, { fill: MUTED });
  it.big = per === 1;
  return o + drawPuzzle(it, r.x, r.y + 14, r.w, r.h - 14, false, true);
}
function solSlot(it, per, i) {
  var r = slotRect(per, i), o = '';
  o += T(r.x, r.y + 4.5, (it.no ? 'Lösung ' + it.no + ' · ' : 'Lösung · ') + it.name, per === 4 ? 3.6 : 4.4, { w: 700 });
  return o + drawPuzzle(it, r.x, r.y + 8, r.w, r.h - 8, true, false);
}
function chrome(pg, n) {
  var o = '', op = bk.opts;
  if (pg.kind === 'cover' || pg.noHeader) return o;
  if (op.runHeader) o += T(15, 11, op.title, 3, { fill: MUTED }) + T(195, 11, pg.running || '', 3, { fill: MUTED, a: 'end' }) + '<line x1="15" y1="13" x2="195" y2="13" stroke="#c9d0cc" stroke-width="0.25"/>';
  if (op.pageNumbers && !pg.noNumber) {
    var outer = op.pageNumPos === 'outer';
    o += T(outer ? (n % 2 ? 195 : 15) : 105, 290, String(n), 3.6, { fill: MUTED, a: outer ? (n % 2 ? 'end' : 'start') : 'middle' });
  }
  return o;
}
function textBlock(paras, x, y, w, fs, gap) {
  var o = '', lh = fs * 1.5;
  paras.forEach(function (p) {
    wrap(p, w, fs).forEach(function (l) { o += T(x, y, l, fs); y += lh; });
    y += gap;
  });
  return { svg: o, y: y };
}
