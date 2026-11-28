/* ======================================================================
   Neue Rätselarten: Zeichnen für den Druck
   Arbeitsblatt, Lösung und Überdruck als SVG.
   ====================================================================== */
'use strict';

function fnum(v) { return +v.toFixed(2); }
function htDraw(x, y, w, h, d, sol) {
  var n = d.n, s = Math.min(w, h), gx = x + (w - s) / 2, cs = s / n, o = [], fs = cs * 0.5;
  for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) {
    var px = gx + c * cs, py = y + r * cs, black = sol && d.solution[r][c];
    if (black) o.push('<rect x="' + fnum(px) + '" y="' + fnum(py) + '" width="' + fnum(cs) + '" height="' + fnum(cs) + '" fill="#3a3f42"/>');
    o.push(T(px + cs / 2, py + cs / 2 + fs * 0.35, String(d.grid[r][c]), fs, { a: 'middle', w: 600, fill: black ? '#fff' : INK }));
  }
  for (var i = 1; i < n; i++) o.push('<path d="M' + fnum(gx + i * cs) + ' ' + y + 'v' + fnum(s) + 'M' + gx + ' ' + fnum(y + i * cs) + 'h' + fnum(s) + '" stroke="#b9c2bd" stroke-width="0.18"/>');
  o.push('<rect x="' + fnum(gx) + '" y="' + y + '" width="' + fnum(s) + '" height="' + fnum(s) + '" fill="none" stroke="' + INK + '" stroke-width="0.5"/>');
  return o.join('');
}
function mgDraw(x, y, w, h, d, sol, only) {
  var n = d.n, s = Math.min(w, h - 7), gx = x + (w - s) / 2, cs = s / n, o = [], fs = cs * (n >= 6 ? 0.42 : 0.5);
  for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) {
    var px = gx + c * cs, py = y + r * cs, g = d.givens[r][c] > 0;
    if (g && !only) o.push('<rect x="' + fnum(px) + '" y="' + fnum(py) + '" width="' + fnum(cs) + '" height="' + fnum(cs) + '" fill="#eceeed"/>');
    if (only ? (!g && sol) : (g || sol)) o.push(T(px + cs / 2, py + cs / 2 + fs * 0.35, String(d.solution[r][c]), fs, { a: 'middle', w: 600, fill: g ? INK : SOLINK }));
  }
  if (only) return o.join('');
  for (var i = 1; i < n; i++) o.push('<path d="M' + fnum(gx + i * cs) + ' ' + y + 'v' + fnum(s) + 'M' + gx + ' ' + fnum(y + i * cs) + 'h' + fnum(s) + '" stroke="#9aa3a8" stroke-width="0.25"/>');
  o.push('<rect x="' + fnum(gx) + '" y="' + y + '" width="' + fnum(s) + '" height="' + fnum(s) + '" fill="none" stroke="' + INK + '" stroke-width="0.6"/>');
  o.push(T(gx + s / 2, y + s + 5, 'Magische Zahl: ' + d.M + ' (jede Zeile, Spalte und beide Diagonalen)', 3, { a: 'middle', fill: MUTED }));
  return o.join('');
}
function mwDraw(x, y, w, h, d, sol, only) {
  var n = d.n, o = [], top = y, CFS = 2.8, CLH = 3.4;
  /* Beschriftung in Zeilen umbrechen, damit sie nie über die Breite des Rätsels hinausläuft (auch bei 2 oder 4 Rätseln pro Blatt) */
  var capText = 'Rechenart ' + OP_LABEL[d.op] + ' (' + OP_SIGN[d.op] + '): jeder Stein ist gleich ' + OP_DESC[d.op] + ' der zwei Steine darunter. Nur positive ganze Zahlen.';
  var capLines = wrap(capText, Math.max(20, w - 2), CFS * 1.15).filter(function (l) { return l; });
  var hh = h - (capLines.length * CLH + 3), cw = Math.min(w / n, hh / (n * 0.62)), ch = cw * 0.62;
  for (var i = 0; i < n; i++) for (var j = 0; j <= i; j++) {
    var px = x + (w - (i + 1) * cw) / 2 + j * cw, py = top + i * ch, g = d.given[i][j], txt = String(d.cells[i][j]);
    if (!only) o.push('<rect x="' + fnum(px + 0.3) + '" y="' + fnum(py + 0.3) + '" width="' + fnum(cw - 0.6) + '" height="' + fnum(ch - 0.6) + '" rx="0.8" fill="' + (g ? '#eceeed' : '#fff') + '" stroke="' + INK + '" stroke-width="0.4"/>');
    if (only ? (!g && sol) : (g || sol)) { var fs = Math.min(ch * 0.55, (cw - 2) / (txt.length * 0.62)); o.push(T(px + cw / 2, py + ch / 2 + fs * 0.35, txt, fs, { a: 'middle', w: 600, fill: g ? INK : SOLINK })); }
  }
  if (!only) capLines.forEach(function (l, li) { o.push(T(x + w / 2, top + n * ch + 4.2 + li * CLH, l, CFS, { a: 'middle', fill: MUTED })); });
  return o.join('');
}
