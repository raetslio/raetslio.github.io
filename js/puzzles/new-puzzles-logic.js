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
/* Zählt alle gültigen Lösungen (max. limit). Gibt {count, sols, aborted} zurück. */
function htSolve(g, n, limit, budget) {
  var N = n * n, nodes = 0, sols = [], aborted = false;
  function conn(s) { /* weiß + unbekannt zusammenhängend? */
    return htConnected(function (a, b) { return s[a * n + b] !== 1; }, n);
  }
  function setWhite(s, i, q) {
    s[i] = 2; var r = (i / n) | 0, c = i % n, v = g[r][c], t, j;
    for (t = 0; t < n; t++) {
      j = r * n + t; if (t !== c && g[r][t] === v) { if (s[j] === 2) return false; if (s[j] === 0) { s[j] = 1; q.push(j); } }
      j = t * n + c; if (t !== r && g[t][c] === v) { if (s[j] === 2) return false; if (s[j] === 0) { s[j] = 1; q.push(j); } }
    }
    return true;
  }
  function prop(s, q) {
    while (q.length) {
      var i = q.pop();
      if (s[i] === 1) {
        var r = (i / n) | 0, c = i % n;
        for (var d = 0; d < 4; d++) {
          var nr = r + NB[d][0], nc = c + NB[d][1];
          if (nr < 0 || nc < 0 || nr >= n || nc >= n) continue;
          var j = nr * n + nc;
          if (s[j] === 1) return false;
          if (s[j] === 0) { if (!setWhite(s, j, q)) return false; }
        }
      }
    }
    return true;
  }
  function rec(s) {
    if (aborted || sols.length >= limit) return;
    if (++nodes > budget) { aborted = true; return; }
    if (!conn(s)) return;
    var p = -1, i;
    for (i = 0; i < N; i++) if (s[i] === 0) { p = i; break; }
    if (p < 0) { sols.push(s.slice()); return; }
    for (var w = 0; w < 2; w++) {
      var t = s.slice(), q = [], ok;
      if (w === 0) { ok = setWhite(t, p, q); } else { t[p] = 1; q.push(p); ok = true; }
      if (ok && prop(t, q)) rec(t);
      if (aborted || sols.length >= limit) return;
    }
  }
  var s0 = new Uint8Array(N); /* Zellen ohne irgendeinen Doppelgänger dürfen trotzdem geschwärzt werden: bewusst nicht vorbelegt */
  rec(s0);
  return { count: aborted ? limit : sols.length, sols: sols, aborted: aborted };
}
function htCreate(n, diff) {
  var dens = [0.16, 0.21, 0.26, 0.31][diff], target = Math.round(n * n * dens), best = null;
  var deadline = Date.now() + 6000;
  for (var at = 0; at < 400 && (Date.now() < deadline || !best); at++) {
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
    /* Eindeutigkeit prüfen und ggf. gezielt nachbessern */
    for (var fix = 0; fix < 60; fix++) {
      var res0 = htSolve(g, n, 2, 20000);
      if (res0.aborted) break;
      if (res0.count === 1) { return { n: n, grid: g, solution: sh }; }
      /* zweite Lösung finden, die von der gespeicherten abweicht */
      var alt = null, i2;
      for (i2 = 0; i2 < res0.sols.length; i2++) {
        var same = true; for (var q2 = 0; q2 < n * n; q2++) if ((res0.sols[i2][q2] === 1) !== !!sh[(q2 / n) | 0][q2 % n]) { same = false; break; }
        if (!same) { alt = res0.sols[i2]; break; }
      }
      if (!alt) break; /* gespeicherte Lösung ungültig – neuer Versuch */
      var A = [], B = [];
      for (i2 = 0; i2 < n * n; i2++) {
        var r3 = (i2 / n) | 0, c3 = i2 % n, inS = !!sh[r3][c3], inA = alt[i2] === 1;
        if (inS && !inA) A.push(i2); else if (!inS && inA) B.push(i2);
      }
      var done = false;
      shuf(A);
      for (var ai = 0; ai < A.length && !done; ai++) {
        var zr = (A[ai] / n) | 0, zc = A[ai] % n, vals = [];
        for (var t2 = 0; t2 < n; t2++) {
          if (t2 !== zc && !sh[zr][t2] && alt[zr * n + t2] !== 1) vals.push(g[zr][t2]);
          if (t2 !== zr && !sh[t2][zc] && alt[t2 * n + zc] !== 1) vals.push(g[t2][zc]);
        }
        if (vals.length) { g[zr][zc] = vals[rnd(vals.length)]; done = true; }
      }
      shuf(B);
      for (var bi = 0; bi < B.length && !done; bi++) {
        var br = (B[bi] / n) | 0, bc = B[bi] % n, bad = false;
        for (var d2 = 0; d2 < 4; d2++) { var xr = br + NB[d2][0], xc = bc + NB[d2][1]; if (xr >= 0 && xc >= 0 && xr < n && xc < n && sh[xr][xc]) bad = true; }
        if (bad) continue;
        sh[br][bc] = 1;
        if (!htConnected(function (a, b) { return !sh[a][b]; }, n)) { sh[br][bc] = 0; continue; }
        var vs = [];
        for (var t3 = 0; t3 < n; t3++) { if (t3 !== bc && !sh[br][t3]) vs.push(g[br][t3]); if (t3 !== br && !sh[t3][bc]) vs.push(g[t3][bc]); }
        if (vs.length) g[br][bc] = vs[rnd(vs.length)];
        done = true;
      }
      if (!done) break;
    }
    best = best || true;
  }
  /* Notfall (sollte praktisch nie eintreten): kleinere Dichte versuchen */
  return diff > 0 ? htCreate(n, diff - 1) : htCreate(n, 0);
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
/* Logische Lösbarkeit: Linie (Zeile/Spalte/Diagonale) mit genau einer Lücke ergibt die Zahl zwingend.
   Wird so alles gefüllt, ist die Lösung eindeutig – auch bei großen Quadraten. */
function mgPeel(n, giv) {
  var N2 = n * n, M = n * (N2 + 1) / 2, g = copyM(giv), used = new Uint8Array(N2 + 2), i, j, empty = 0;
  var lines = [], d1 = [], d2 = [];
  for (i = 0; i < n; i++) { var rw = [], cl = []; for (j = 0; j < n; j++) { rw.push([i, j]); cl.push([j, i]); } lines.push(rw, cl); d1.push([i, i]); d2.push([i, n - 1 - i]); }
  lines.push(d1, d2);
  for (i = 0; i < n; i++) for (j = 0; j < n; j++) { if (g[i][j]) used[g[i][j]] = 1; else empty++; }
  var ch = true;
  while (ch && empty > 0) {
    ch = false;
    for (var l = 0; l < lines.length; l++) {
      var cells = lines[l], sum = 0, miss = null, nm = 0;
      for (var q = 0; q < cells.length; q++) { var v = g[cells[q][0]][cells[q][1]]; if (v) sum += v; else { nm++; miss = cells[q]; } }
      if (nm === 1) {
        var x = M - sum;
        if (x < 1 || x > N2 || used[x]) return false;
        g[miss[0]][miss[1]] = x; used[x] = 1; empty--; ch = true;
      }
    }
    if (empty === 1) {
      var lastC = null, lastV = 0;
      for (i = 0; i < n; i++) for (j = 0; j < n; j++) if (!g[i][j]) lastC = [i, j];
      for (i = 1; i <= N2; i++) if (!used[i]) lastV = i;
      if (lastC && lastV) { g[lastC[0]][lastC[1]] = lastV; used[lastV] = 1; empty--; ch = true; }
    }
  }
  return empty === 0;
}
function mgCreate(n, diff) {
  var sol = mgTransform(mgBuild(n)), N2 = n * n, M = n * (N2 + 1) / 2;
  var target = Math.max(2, Math.round(N2 * [0.6, 0.46, 0.36, 0.28][diff])), giv = copyM(sol), order = shuf(nRange(N2)), keep = N2;
  for (var k = 0; k < order.length && keep > target; k++) {
    var r = Math.floor(order[k] / n), c = order[k] % n, v = giv[r][c];
    giv[r][c] = 0;
    /* nur entfernen, wenn die Lösung nachweislich eindeutig bleibt */
    if (mgPeel(n, giv) || (n <= 4 && mgCount(n, giv, 2) === 1)) keep--; else giv[r][c] = v;
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
