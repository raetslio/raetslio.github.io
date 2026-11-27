/* ======================================================================
   Binoxxo: Logik
   Gültige Zeilen, Lösen, Eindeutigkeitsprüfung und Erzeugen von Rätseln.
   ====================================================================== */
'use strict';

var rowCache = {};
function validRows(n) {
  if (rowCache[n]) return rowCache[n];
  var res = [], half = n / 2;
  (function rec(row, ones, zeros) {
    var l = row.length;
    if (l === n) { res.push(row.slice()); return; }
    for (var v = 0; v < 2; v++) {
      if (v ? ones >= half : zeros >= half) continue;
      if (l >= 2 && row[l - 1] === v && row[l - 2] === v) continue;
      row.push(v); rec(row, ones + v, zeros + 1 - v); row.pop();
    }
  })([], 0, 0);
  rowCache[n] = res;
  return res;
}
function bxSolution(n) {
  var rows = validRows(n), half = n / 2;
  for (var attempt = 0; attempt < 400; attempt++) {
    var order = shuf(rows.slice()), grid = [], used = {}, colOnes = new Array(n).fill(0), nodes = 0, ok = false;
    (function dfs(r) {
      if (ok || nodes > 30000) return;
      if (r === n) {
        var seen = {};
        for (var c = 0; c < n; c++) { var k = ''; for (var i = 0; i < n; i++) k += grid[i][c]; if (seen[k]) return; seen[k] = 1; }
        ok = true; return;
      }
      for (var oi = 0; oi < order.length && !ok; oi++) {
        var row = order[oi], key = row.join('');
        if (used[key]) continue;
        nodes++;
        var good = true;
        for (var c = 0; c < n; c++) {
          if (colOnes[c] + row[c] > half || (r + 1 - colOnes[c] - row[c]) > half) { good = false; break; }
          if (r >= 2 && grid[r - 1][c] === row[c] && grid[r - 2][c] === row[c]) { good = false; break; }
        }
        if (!good) continue;
        used[key] = 1; grid.push(row); for (c = 0; c < n; c++) colOnes[c] += row[c];
        dfs(r + 1);
        if (ok) return;
        grid.pop(); delete used[key]; for (c = 0; c < n; c++) colOnes[c] -= row[c];
      }
    })(0);
    if (ok) return grid.map(function (r) { return r.slice(); });
  }
  return null;
}
/* Löser mit Propagation; liefert Anzahl Lösungen (max limit). -1 = leer */
function bxCount(g, n, limit, budget) {
  var half = n / 2, nodes = 0, count = 0, aborted = false;
  function lineIdx(l) { return l < n ? { b: l * n, s: 1 } : { b: l - n, s: n }; }
  function propagate(a) {
    var changed = true;
    while (changed) {
      changed = false;
      for (var l = 0; l < 2 * n; l++) {
        var li = lineIdx(l), ones = 0, zeros = 0, k;
        for (k = 0; k < n; k++) { var v = a[li.b + k * li.s]; if (v === 1) ones++; else if (v === 0) zeros++; }
        if (ones > half || zeros > half) return false;
        if (ones + zeros < n && (ones === half || zeros === half)) {
          var fill = ones === half ? 0 : 1;
          for (k = 0; k < n; k++) if (a[li.b + k * li.s] === 255) a[li.b + k * li.s] = fill;
          changed = true;
        }
        for (k = 0; k + 2 < n; k++) {
          var i1 = li.b + k * li.s, i2 = i1 + li.s, i3 = i2 + li.s, x = a[i1], y = a[i2], z = a[i3];
          var e = (x === 255) + (y === 255) + (z === 255);
          if (e === 0) { if (x === y && y === z) return false; }
          else if (e === 1) {
            if (x === 255 && y === z) { a[i1] = 1 - y; changed = true; }
            else if (y === 255 && x === z) { a[i2] = 1 - x; changed = true; }
            else if (z === 255 && x === y) { a[i3] = 1 - x; changed = true; }
          }
        }
      }
    }
    for (var o = 0; o < 2; o++) {
      var seen = {};
      for (var q = 0; q < n; q++) {
        var s = '', full = true;
        for (var t = 0; t < n; t++) { var vv = o === 0 ? a[q * n + t] : a[t * n + q]; if (vv === 255) { full = false; break; } s += vv; }
        if (full) { if (seen[s]) return false; seen[s] = 1; }
      }
    }
    return true;
  }
  function rec(a) {
    if (aborted || count >= limit) return;
    if (++nodes > budget) { aborted = true; return; }
    if (!propagate(a)) return;
    var p = a.indexOf(255);
    if (p < 0) { count++; return; }
    for (var v = 0; v < 2; v++) { var b = a.slice(); b[p] = v; rec(b); if (aborted || count >= limit) return; }
  }
  var start = new Uint8Array(n * n);
  for (var i = 0; i < n; i++) for (var j = 0; j < n; j++) start[i * n + j] = g[i][j] < 0 ? 255 : g[i][j];
  rec(start);
  return aborted ? limit : count;
}
/* Regelprüfung eines vollständigen Gitters (alle Zellen 0/1): gleich viele X und O je Zeile/Spalte,
   keine drei gleichen in Folge, keine zwei gleichen Zeilen oder Spalten. Jede regelkonforme Lösung zählt als richtig. */
function bxValidFull(a, n) {
  var half = n / 2, rows = {}, cols = {}, i, j;
  for (i = 0; i < n; i++) {
    var rs = '', cs = '', r1 = 0, c1 = 0;
    for (j = 0; j < n; j++) {
      var x = a[i][j], y = a[j][i];
      if ((x !== 0 && x !== 1) || (y !== 0 && y !== 1)) return false;
      rs += x; cs += y; r1 += x; c1 += y;
      if (j >= 2 && a[i][j] === a[i][j - 1] && a[i][j] === a[i][j - 2]) return false;
      if (j >= 2 && a[j][i] === a[j - 1][i] && a[j][i] === a[j - 2][i]) return false;
    }
    if (r1 !== half || c1 !== half || rows[rs] || cols[cs]) return false;
    rows[rs] = 1; cols[cs] = 1;
  }
  return true;
}
var BX_RATIO = [0.55, 0.45, 0.37, 0.30];
function bxCreate(n, diff) {
  var sol = bxSolution(n);
  if (!sol) return null;
  var giv = sol.map(function (r) { return r.slice(); });
  var cells = []; for (var i = 0; i < n * n; i++) cells.push(i);
  shuf(cells);
  var target = Math.round(n * n * BX_RATIO[diff]), clues = n * n;
  for (var k = 0; k < cells.length && clues > target; k++) {
    var r = Math.floor(cells[k] / n), c = cells[k] % n, keep = giv[r][c];
    giv[r][c] = -1;
    if (bxCount(giv, n, 2, 4000) === 1) clues--; else giv[r][c] = keep;
  }
  return { n: n, solution: sol, givens: giv };
}
