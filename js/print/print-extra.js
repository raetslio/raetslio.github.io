/* ======================================================================
   Druckfenster für Binoxxo, Labyrinth und die neuen Rätselarten
   Blattaufbau (Arbeitsblatt, Lösungsblatt, Überdruck), Mehrfachdruck und Dateinamen.
   ====================================================================== */
'use strict';

function bxGlyphs(gx, gy, size, d) {
  var n = d.n, cs = size / n, p = [], rr = cs * 0.27, sw = Math.max(0.35, cs * 0.075);
  for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) {
    if (d.givens[r][c] >= 0) continue;
    var v = d.solution[r][c], cx = gx + (c + 0.5) * cs, cy = gy + (r + 0.5) * cs;
    if (v === 0) p.push('<circle cx="' + cx.toFixed(2) + '" cy="' + cy.toFixed(2) + '" r="' + rr.toFixed(2) + '" fill="none" stroke="' + SOLINK + '" stroke-width="' + sw.toFixed(2) + '"/>');
    else p.push('<path d="M' + (cx - rr).toFixed(2) + ' ' + (cy - rr).toFixed(2) + 'L' + (cx + rr).toFixed(2) + ' ' + (cy + rr).toFixed(2) + 'M' + (cx + rr).toFixed(2) + ' ' + (cy - rr).toFixed(2) + 'L' + (cx - rr).toFixed(2) + ' ' + (cy + rr).toFixed(2) + '" stroke="' + SOLINK + '" stroke-width="' + sw.toFixed(2) + '" stroke-linecap="round"/>');
  }
  return p.join('');
}
function mazePathOnly(gx, gy, size, d) {
  var cs = size / d.n;
  return '<polyline points="' + mazePathPts(d, gx, gy, cs, d.path) + '" fill="none" stroke="#b86b4b" stroke-opacity=".85" stroke-width="' + Math.max(0.4, cs * 0.18).toFixed(2) + '" stroke-linejoin="round" stroke-linecap="round"/>';
}
function extPuzzles(type, count) {
  if (type === 'binoxxo') { bx.extras = bx.extras || []; while (bx.extras.length < count - 1) bx.extras.push(bxCreate(bx.n, bx.diff)); return [bx.data].concat(bx.extras); }
  mz.extras = mz.extras || []; while (mz.extras.length < count - 1) mz.extras.push(mazeCreate(mz.n)); return [mz.data].concat(mz.extras);
}
function buildNewSheet(sheetType, ghost) {
  var A = window.appState, p = A.print, m = p.marginMm, W = 210, Hh = 297, cw = W - 2 * m, type = NXT[A.mode] ? A.mode : (A.mode === 'binoxxo' ? 'binoxxo' : 'maze');
  var over = sheetType === 'overprint', sol = sheetType === 'sheet2' || over, base = !over, gh = over && ghost, PP = window.PRINT_PALETTE;
  var o = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + Hh + '" width="100%" height="100%">'];
  if (!over) o.push('<rect width="' + W + '" height="' + Hh + '" fill="#fff"/>');
  var n = type === 'binoxxo' ? bx.n : mz.n, dl = type === 'binoxxo' ? bx.diff : mazeDiff(mz.n, mz.hard);
  var NI = NXT[type] ? NXT[type].sheetInfo() : null;
  var title = rsSheetTitle((NI ? NI.title : (type === 'binoxxo' ? 'Binoxxo ' : 'Labyrinth ') + n + '×' + n) + (sheetType === 'sheet2' ? ' — Lösungsblatt' : ''), sheetType === 'sheet2'), meta = 'Schwierigkeit: ' + DIFFS[NI ? NI.diff : dl];
  var y = m + 4.5;
  if (base || gh) {
    var hs = gh ? PP.ghostBold : PP.ink, sb = gh ? PP.ghostGrid : PP.muted, op = gh ? ' opacity="0.65"' : '';
    o.push('<g' + op + ' font-family="Outfit, Hanken Grotesk, sans-serif"><text x="' + m + '" y="' + y + '" font-size="6.2" font-weight="600" fill="' + hs + '">' + esc(title) + '</text><text x="' + (W - m) + '" y="' + y + '" font-size="3.6" font-weight="500" fill="' + sb + '" text-anchor="end">' + esc(meta) + '</text>');
    y += 6.5;
    o.push('<text x="' + m + '" y="' + y + '" font-size="3.4" font-weight="500" fill="' + sb + '">Name:</text>' + (p.name.trim() ? '<text x="' + (m + 12) + '" y="' + y + '" font-size="3.6" font-weight="600" fill="' + hs + '">' + esc(p.name.trim()) + '</text>' : '<line x1="' + (m + 12) + '" y1="' + (y + 0.5) + '" x2="' + (m + 88) + '" y2="' + (y + 0.5) + '" stroke="' + sb + '" stroke-width="0.4"/>'));
    o.push('<text x="' + (W - m - 46) + '" y="' + y + '" font-size="3.4" font-weight="500" fill="' + sb + '">Datum:</text>' + (p.date.trim() ? '<text x="' + (W - m - 32) + '" y="' + y + '" font-size="3.6" font-weight="600" fill="' + hs + '">' + esc(p.date.trim()) + '</text>' : '<line x1="' + (W - m - 32) + '" y1="' + (y + 0.5) + '" x2="' + (W - m) + '" y2="' + (y + 0.5) + '" stroke="' + sb + '" stroke-width="0.4"/>'));
    var subS = String(p.subtitle || '').trim(); if (subS) { o.push('<text x="' + m + '" y="' + (y + 5.2).toFixed(2) + '" font-family="Outfit, Hanken Grotesk, sans-serif" font-size="3.8" font-weight="500" fill="' + sb + '">' + esc(subS) + '</text>'); y += 5; }
    y += 3.5; o.push('<line x1="' + m + '" y1="' + y + '" x2="' + (W - m) + '" y2="' + y + '" stroke="' + hs + '" stroke-width="0.35"/></g>');
  } else y += 10 + (String(p.subtitle || '').trim() ? 5 : 0);
  y += 5;
  var instr = RULES[type], im = p.instrPt * 0.3528, ls = im * 1.38, cpl = Math.floor(cw / (im * 0.48)), lines = [];
  instr.forEach(function (t, i) { window.wrapTextLines((i + 1) + '. ' + t, cpl).forEach(function (l) { lines.push(l); }); });
  if (base || gh) {
    o.push('<g' + (gh ? ' opacity="0.65"' : '') + ' font-family="Hanken Grotesk, sans-serif" font-size="' + im.toFixed(2) + '" fill="' + (gh ? PP.ghostGrid : PP.muted) + '">' + lines.map(function (l, i) { return '<text x="' + m + '" y="' + (y + i * ls).toFixed(2) + '">' + esc(l) + '</text>'; }).join('') + '</g>');
  }
  if (p.showInstr === false) lines = [];
  if (lines.length) y += lines.length * ls + 4.5;
  var avail = Hh - m - 7 - y, multi = p.multiPrint || 1, cols = multi === 1 ? 1 : 2, rows = multi === 4 ? 2 : 1, gap = multi === 1 ? 0 : 8;
  var sw = (cw - (cols - 1) * gap) / cols, sh = (avail - (rows - 1) * gap) / rows, lr = multi > 1 ? 5.5 : 0, pad = type === 'maze' ? 9 : 0, bs = Math.min(sw, sh - lr - pad);
  var list = NXT[type] ? NXT[type].extras(multi) : extPuzzles(type, multi);
  for (var i = 0; i < multi; i++) {
    var sx = m + (i % cols) * (sw + gap) + (sw - bs) / 2, sy = y + Math.floor(i / cols) * (sh + gap);
    if (multi > 1 && (base || gh)) o.push('<text x="' + sx + '" y="' + (sy + 3.2).toFixed(2) + '" font-family="Outfit, sans-serif" font-size="3.2" font-weight="600" fill="' + (gh ? PP.ghostBold : PP.muted) + '">Rätsel ' + (i + 1) + '</text>');
    if (NXT[type]) {
      var nx0 = m + (i % cols) * (sw + gap), ny0 = sy + lr;
      if (over) o.push((gh ? '<g opacity="0.45">' + NXT[type].draw(nx0, ny0, sw, sh - lr, list[i], false) + '</g>' : '') + NXT[type].draw(nx0, ny0, sw, sh - lr, list[i], true, true));
      else o.push(NXT[type].draw(nx0, ny0, sw, sh - lr, list[i], sol));
      continue;
    }
    var gy = sy + lr + pad / 2, d = list[i], bd = { n: d.n, solution: d.solution, givens: d.givens };
    if (type === 'binoxxo') {
      if (over) o.push((gh ? '<g opacity="0.45">' + bxGridSvg(sx, gy, bs, bd, false) + '</g>' : '') + bxGlyphs(sx, gy, bs, bd));
      else o.push(bxGridSvg(sx, gy, bs, bd, sol));
    } else {
      if (over) o.push((gh ? '<g opacity="0.45">' + mazeSvg(sx, gy, bs, d, false) + '</g>' : '') + mazePathOnly(sx, gy, bs, d));
      else o.push(mazeSvg(sx, gy, bs, d, sol));
    }
  }
  if (base) o.push('<text x="' + (W / 2) + '" y="' + (Hh - m + 2).toFixed(2) + '" font-family="Outfit, sans-serif" font-size="2.7" fill="' + PP.muted + '" text-anchor="middle">' + esc(rsSheetFooter(sheetType === 'sheet2' ? 'Lösungsblatt' : 'Arbeitsblatt')) + '</text>');
  o.push('</svg>'); return o.join('');
}
var origBuildA4 = window.buildA4SvgString;
window.buildA4SvgString = function (sheetType, ghost) { var md = window.appState.mode; return (md === 'binoxxo' || md === 'labyrinth' || NXT[md]) ? buildNewSheet(sheetType, ghost) : origBuildA4(sheetType, ghost); };
var origModeUI = window.updatePrintModalModeUI;
window.updatePrintModalModeUI = function () { origModeUI(); var md = window.appState.mode, g = $('print-multi-group'); if (g) g.classList.toggle('hidden', !(md === 'sudoku' || md === 'binoxxo' || md === 'labyrinth' || NXT[md])); };
window.extPrintPrefix = function () { var md = window.appState.mode; if (NXT[md]) return NXT[md].prefix(); return md === 'binoxxo' ? 'binoxxo_' + bx.n + 'x' + bx.n : md === 'labyrinth' ? 'labyrinth_' + mz.n + 'x' + mz.n : null; };
