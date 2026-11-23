/* ======================================================================
   Neue Rätselarten: Logik (Hitori, Magisches Quadrat, Zahlenmauer)
   Hilfsfunktionen, Erzeugen, Prüfen und Lösbarkeit der drei Rätselarten.
   ====================================================================== */
'use strict';

var GV_TYPES = ['sudoku', 'ws', 'binoxxo', 'maze', 'hitori', 'magic', 'mauer'];
/* ===== Hilfsfunktionen ===== */
var OP_KEYS = ['plus', 'minus', 'mal', 'geteilt'];
var OP_LABEL = { plus: 'Plus', minus: 'Minus', mal: 'Mal', geteilt: 'Geteilt' };
var OP_SIGN = { plus: '+', minus: '−', mal: '×', geteilt: ':' };
var OP_DESC = { plus: 'der Summe', minus: 'dem Unterschied (große minus kleine Zahl)', mal: 'dem Produkt', geteilt: 'dem Quotienten (große durch kleine Zahl, ohne Rest)' };
var NB = [[1, 0], [-1, 0], [0, 1], [0, -1]];
function nRange(n, s) { var a = []; for (var i = 0; i < n; i++) a.push(i + (s || 0)); return a; }
function copyM(a) { return a.map(function (r) { return r.slice(); }); }
function sizeTxt(type, size) { return type === 'mauer' ? size + ' Zeilen' : size + '×' + size; }

/* ===== HITORI ===== */
function htLatin(n) {
  var rp = shuf(nRange(n)), cp = shuf(nRange(n)), sp = shuf(nRange(n, 1)), g = [];
  for (var r = 0; r < n; r++) { g.push([]); for (var c = 0; c < n; c++) g[r].push(sp[(rp[r] + cp[c]) % n]); }
  return g;
}
function htConnected(open, n) {
  var total = 0, start = -1, i;
  for (i = 0; i < n * n; i++) if (open(Math.floor(i / n), i % n)) { total++; start = i; }
  if (!total) return true;
  var seen = new Uint8Array(n * n), q = [start], cnt = 0; seen[start] = 1;
  while (q.length) {
    var cur = q.pop(); cnt++;
    for (var k = 0; k < 4; k++) {
      var nr = Math.floor(cur / n) + NB[k][0], nc = cur % n + NB[k][1];
      if (nr < 0 || nc < 0 || nr >= n || nc >= n || seen[nr * n + nc] || !open(nr, nc)) continue;
      seen[nr * n + nc] = 1; q.push(nr * n + nc);
    }
  }
  return cnt === total;
}
function htCreate(n, diff) {
  var dens = [0.16, 0.21, 0.26, 0.31][diff], target = Math.round(n * n * dens), best = null;
  for (var at = 0; at < 40; at++) {
    var lat = htLatin(n), sh = [], r, c;
    for (r = 0; r < n; r++) sh.push(new Array(n).fill(0));
    var order = shuf(nRange(n * n)), cnt = 0;
    for (var k = 0; k < order.length && cnt < target; k++) {
      var rr = Math.floor(order[k] / n), cc = order[k] % n, adj = false;
      for (var d = 0; d < 4; d++) { var ar = rr + NB[d][0], ac = cc + NB[d][1]; if (ar >= 0 && ac >= 0 && ar < n && ac < n && sh[ar][ac]) adj = true; }
      if (adj) continue;
      sh[rr][cc] = 1;
      if (!htConnected(function (a, b) { return !sh[a][b]; }, n)) { sh[rr][cc] = 0; continue; }
      cnt++;
    }
    var g = copyM(lat);
    for (r = 0; r < n; r++) for (c = 0; c < n; c++) if (sh[r][c]) {
      var cand = [];
      for (var t = 0; t < n; t++) { if (!sh[r][t]) cand.push(lat[r][t]); if (!sh[t][c]) cand.push(lat[t][c]); }
      g[r][c] = cand[rnd(cand.length)];
    }
    var res = { n: n, grid: g, solution: sh };
    if (!best || cnt > best.cnt) best = { cnt: cnt, d: res };
    if (cnt >= target - 1) return res;
  }
  return best.d;
}
/* st: 0 leer, 1 geschwärzt, 2 sichtbar markiert */
function htAnalyze(g, st, n, strict) {
  strict = strict !== false;
  var conf = {}, r, c, seen, v;
  function mark(a, b) { conf[a + ',' + b] = 1; }
  for (r = 0; r < n; r++) { seen = {}; for (c = 0; c < n; c++) if (st[r][c] !== 1 && (strict || st[r][c] === 2)) { v = g[r][c]; if (seen[v] !== undefined) { mark(r, c); mark(r, seen[v]); } else seen[v] = c; } }
  for (c = 0; c < n; c++) { seen = {}; for (r = 0; r < n; r++) if (st[r][c] !== 1 && (strict || st[r][c] === 2)) { v = g[r][c]; if (seen[v] !== undefined) { mark(r, c); mark(seen[v], c); } else seen[v] = r; } }
  for (r = 0; r < n; r++) for (c = 0; c < n; c++) if (st[r][c] === 1) {
    if (c + 1 < n && st[r][c + 1] === 1) { mark(r, c); mark(r, c + 1); }
    if (r + 1 < n && st[r + 1][c] === 1) { mark(r, c); mark(r + 1, c); }
  }
  var connected = htConnected(function (a, b) { return st[a][b] !== 1; }, n);
  return { conf: conf, nConf: Object.keys(conf).length, connected: connected, solved: !Object.keys(conf).length && connected };
}

/* ===== MAGISCHES QUADRAT ===== */
function mgOdd(m) {
  var s = [], i, r = 0, c = (m - 1) / 2;
  for (i = 0; i < m; i++) s.push(new Array(m).fill(0));
  for (var k = 1; k <= m * m; k++) { s[r][c] = k; var nr = (r - 1 + m) % m, nc = (c + 1) % m; if (s[nr][nc]) { nr = (r + 1) % m; nc = c; } r = nr; c = nc; }
  return s;
}
function mgBuild(n) {
  var s = [], i, j;
  if (n % 2) return mgOdd(n);
  if (n % 4 === 0) {
    for (i = 0; i < n; i++) { s.push([]); for (j = 0; j < n; j++) { var v = i * n + j + 1; if (i % 4 === j % 4 || (i % 4) + (j % 4) === 3) v = n * n + 1 - v; s[i].push(v); } }
    return s;
  }
  var m = n / 2, k = (n - 2) / 4, a = mgOdd(m);
  for (i = 0; i < n; i++) s.push(new Array(n).fill(0));
  for (i = 0; i < m; i++) for (j = 0; j < m; j++) { s[i][j] = a[i][j]; s[i + m][j + m] = a[i][j] + m * m; s[i][j + m] = a[i][j] + 2 * m * m; s[i + m][j] = a[i][j] + 3 * m * m; }
  for (i = 0; i < m; i++) for (j = 0; j < n; j++) {
    var sw = false, jj = j;
    if (j < k) { sw = true; if (i === (m - 1) / 2) jj = j + 1; } else if (j > n - k) sw = true;
    if (sw) { var t = s[i][jj]; s[i][jj] = s[i + m][jj]; s[i + m][jj] = t; }
  }
  return s;
}
function mgTransform(s) {
  var n = s.length, r, c;
  if (rnd(2)) { var t = []; for (r = 0; r < n; r++) { t.push([]); for (c = 0; c < n; c++) t[r].push(s[c][r]); } s = t; }
  if (rnd(2)) s = s.slice().reverse();
  if (rnd(2)) s = s.map(function (row) { return row.slice().reverse(); });
  return s;
}
function mgCount(n, giv, limit) {
  var N2 = n * n, M = n * (N2 + 1) / 2, g = copyM(giv), used = new Uint8Array(N2 + 2), nodes = 0, count = 0, i, j;
  for (i = 0; i < n; i++) for (j = 0; j < n; j++) if (g[i][j]) used[g[i][j]] = 1;
  var rowsL = [], colsL = [], d1 = [], d2 = [];
  for (i = 0; i < n; i++) { rowsL.push([]); colsL.push([]); }
  for (i = 0; i < n; i++) for (j = 0; j < n; j++) { rowsL[i].push([i, j]); colsL[j].push([i, j]); if (i === j) d1.push([i, j]); if (i + j === n - 1) d2.push([i, j]); }
  function ok(cells) {
    var s = 0, z = 0;
    for (var q = 0; q < cells.length; q++) { var v = g[cells[q][0]][cells[q][1]]; if (v) s += v; else z++; }
    return z === 0 ? s === M : (s + z <= M && s + z * N2 >= M);
  }
  function check(r, c) { return ok(rowsL[r]) && ok(colsL[c]) && (r !== c || ok(d1)) && (r + c !== n - 1 || ok(d2)); }
  function rec(idx) {
    if (count >= limit || nodes > 400000) return;
    if (idx === N2) { if (ok(d1) && ok(d2)) count++; return; }
    var r = Math.floor(idx / n), c = idx % n;
    if (g[r][c]) { if (check(r, c)) rec(idx + 1); return; }
    for (var v = 1; v <= N2; v++) {
      if (used[v]) continue;
      g[r][c] = v; used[v] = 1; nodes++;
      if (check(r, c)) rec(idx + 1);
      used[v] = 0; g[r][c] = 0;
      if (count >= limit || nodes > 400000) return;
    }
  }
  rec(0);
  return nodes > 400000 ? limit : count;
}
function mgCreate(n, diff) {
  var sol = mgTransform(mgBuild(n)), N2 = n * n, M = n * (N2 + 1) / 2;
  var target = Math.max(2, Math.round(N2 * [0.6, 0.46, 0.36, 0.28][diff])), giv = copyM(sol), order = shuf(nRange(N2)), keep = N2, uniq = n <= 4;
  for (var k = 0; k < order.length && keep > target; k++) {
    var r = Math.floor(order[k] / n), c = order[k] % n, v = giv[r][c];
    giv[r][c] = 0;
    if (!uniq || mgCount(n, giv, 2) === 1) keep--; else giv[r][c] = v;
  }
  return { n: n, M: M, solution: sol, givens: giv };
}
/* vals: Matrix (0 = leer) */
function mgAnalyze(vals, n) {
  var N2 = n * n, M = n * (N2 + 1) / 2, conf = {}, seen = {}, r, c, empty = 0;
  for (r = 0; r < n; r++) for (c = 0; c < n; c++) {
    var v = vals[r][c];
    if (!v) { empty++; continue; }
    if (v < 1 || v > N2) conf[r + ',' + c] = 1;
    if (seen[v]) { conf[r + ',' + c] = 1; conf[seen[v]] = 1; } else seen[v] = r + ',' + c;
  }
  function sum(cells) { var s = 0; for (var q = 0; q < cells.length; q++) { var x = vals[cells[q][0]][cells[q][1]]; if (!x) return null; s += x; } return s; }
  var rowS = [], colS = [], d1 = [], d2 = [], badLines = 0;
  for (r = 0; r < n; r++) { var rr = [], cc = []; for (c = 0; c < n; c++) { rr.push([r, c]); cc.push([c, r]); } rowS.push(sum(rr)); colS.push(sum(cc)); d1.push([r, r]); d2.push([r, n - 1 - r]); }
  var s1 = sum(d1), s2 = sum(d2);
  rowS.concat(colS, [s1, s2]).forEach(function (x) { if (x !== null && x !== M) badLines++; });
  return { M: M, conf: conf, nConf: Object.keys(conf).length, empty: empty, rowS: rowS, colS: colS, d1: s1, d2: s2, badLines: badLines, solved: !empty && !Object.keys(conf).length && !badLines };
}

/* ===== ZAHLENMAUER ===== */
var MW_MAX = { plus: 7, minus: 7, mal: 4, geteilt: 5 };
function mwF(op, a, b) {
  if (op === 'plus') return a + b;
  if (op === 'minus') return Math.abs(a - b);
  if (op === 'mal') return a * b;
  var lo = Math.min(a, b), hi = Math.max(a, b);
  return lo > 0 && hi % lo === 0 ? hi / lo : null;
}
function mwRows(op, base) {
  var rows = [base.slice()];
  while (rows[0].length > 1) {
    var prev = rows[0], next = [];
    for (var i = 0; i < prev.length - 1; i++) { var v = mwF(op, prev[i], prev[i + 1]); if (v === null) return null; next.push(v); }
    rows.unshift(next);
  }
  return rows;
}
/* Umkehrung: aus Ergebnis t und einem Nachbarn k die möglichen anderen Zahlen */
function mwInv(op, t, k) {
  var c = [];
  if (op === 'plus') { if (t - k >= 1) c.push(t - k); }
  else if (op === 'minus') { if (k + t >= 0) c.push(k + t); if (t > 0 && k - t >= 0) c.push(k - t); }
  else if (op === 'mal') { if (k > 0 && t % k === 0) c.push(t / k); }
  else { if (k > 0) c.push(k * t); if (t > 0 && k % t === 0 && k / t !== k * t) c.push(k / t); }
  return c;
}
function mwDeducible(op, rows, given) {
  var n = rows.length, val = rows.map(function (r, i) { return r.map(function (x, j) { return given[i][j] ? x : null; }); }), ch = true, i, j;
  while (ch) {
    ch = false;
    for (i = 0; i < n - 1; i++) for (j = 0; j <= i; j++) {
      var t = val[i][j], a = val[i + 1][j], b = val[i + 1][j + 1];
      if (t === null && a !== null && b !== null) { val[i][j] = mwF(op, a, b); ch = true; }
      else if (t !== null && (a === null) !== (b === null)) {
        var k = a !== null ? a : b, cand = mwInv(op, t, k);
        if (cand.length === 1) { if (a === null) val[i + 1][j] = cand[0]; else val[i + 1][j + 1] = cand[0]; ch = true; }
      }
    }
  }
  for (i = 0; i < n; i++) for (j = 0; j <= i; j++) if (val[i][j] === null) return false;
  return true;
}
function mwCreate(n, diff, op) {
  n = Math.min(n, MW_MAX[op]);
  var rows = null, tries = 0, pool;
  while (!rows && tries++ < 4000) {
    var base = [], k;
    if (op === 'plus') { var mx = [6, 9, 15, 25][diff]; for (k = 0; k < n; k++) base.push(1 + rnd(mx)); }
    else if (op === 'minus') { var mn = [9, 15, 30, 60][diff]; for (k = 0; k < n; k++) base.push(1 + rnd(mn)); }
    else if (op === 'mal') { var mm = [2, 3, 4, 5][diff]; for (k = 0; k < n; k++) base.push(1 + rnd(mm)); }
    else { pool = [[1, 2, 4, 8], [1, 2, 3, 4, 6, 8, 12], [1, 2, 3, 4, 6, 8, 9, 12, 16, 18, 24], [1, 2, 3, 4, 6, 8, 9, 12, 16, 18, 24, 27, 32, 36, 48]][diff]; for (k = 0; k < n; k++) base.push(pool[rnd(pool.length)]); }
    rows = mwRows(op, base);
  }
  if (!rows) rows = mwRows(op, nRange(n).map(function () { return 1; }));
  var total = n * (n + 1) / 2, target = Math.max(2, Math.round(total * [0.62, 0.48, 0.38, 0.3][diff]));
  var given = rows.map(function (r) { return r.map(function () { return true; }); }), cells = [], i, j;
  for (i = 0; i < n; i++) for (j = 0; j <= i; j++) cells.push([i, j]);
  shuf(cells); var keep = total;
  for (k = 0; k < cells.length && keep > target; k++) {
    given[cells[k][0]][cells[k][1]] = false;
    if (mwDeducible(op, rows, given)) keep--; else given[cells[k][0]][cells[k][1]] = true;
  }
  return { n: n, op: op, cells: rows, given: given };
}
/* e: Zeilen mit Zahl oder null; liefert falsche Steine */
function mwAnalyze(op, e) {
  var n = e.length, conf = {}, i, j, empty = 0;
  for (i = 0; i < n; i++) for (j = 0; j <= i; j++) if (e[i][j] === null) empty++;
  for (i = 0; i < n - 1; i++) for (j = 0; j <= i; j++) {
    var t = e[i][j], a = e[i + 1][j], b = e[i + 1][j + 1];
    if (t === null || a === null || b === null) continue;
    if (mwF(op, a, b) !== t) { conf[i + ',' + j] = 1; conf[(i + 1) + ',' + j] = 1; conf[(i + 1) + ',' + (j + 1)] = 1; }
  }
  return { conf: conf, nConf: Object.keys(conf).length, empty: empty, solved: !empty && !Object.keys(conf).length };
}
