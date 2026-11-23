/* ======================================================================
   Labyrinth: Logik
   Gänge schnitzen, Lösungsweg suchen und Schwierigkeit bestimmen.
   ====================================================================== */
'use strict';

var DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0];
function mazeCarve(n, p) {
  var open = new Array(n * n).fill(0), seen = new Uint8Array(n * n), list = [0];
  seen[0] = 1;
  while (list.length) {
    var idx = Math.random() < p ? list.length - 1 : Math.floor(Math.random() * list.length), cur = list[idx], cx = cur % n, cy = Math.floor(cur / n), dirs = shuf([0, 1, 2, 3]), moved = false;
    for (var i = 0; i < 4; i++) {
      var d = dirs[i], nx = cx + DX[d], ny = cy + DY[d];
      if (nx < 0 || ny < 0 || nx >= n || ny >= n || seen[ny * n + nx]) continue;
      var ni = ny * n + nx;
      open[cur] |= (1 << d); open[ni] |= (1 << ((d + 2) % 4));
      seen[ni] = 1; list.push(ni); moved = true; break;
    }
    if (!moved) { list[idx] = list[list.length - 1]; list.pop(); }
  }
  return open;
}
function mazeSolve(open, n) {
  var prev = new Int32Array(n * n).fill(-1), q = [0]; prev[0] = 0;
  for (var h = 0; h < q.length; h++) {
    var c0 = q[h]; if (c0 === n * n - 1) break;
    for (var dd = 0; dd < 4; dd++) {
      if (!(open[c0] & (1 << dd))) continue;
      var nn = (Math.floor(c0 / n) + DY[dd]) * n + (c0 % n) + DX[dd];
      if (prev[nn] < 0) { prev[nn] = c0; q.push(nn); }
    }
  }
  var path = [], p = n * n - 1;
  while (p !== 0) { path.push(p); p = prev[p]; }
  path.push(0); path.reverse();
  return path;
}
/* h: 0 normal (lange Gänge), 1 schwer (viele Abzweige), 2 extrem (sehr viele Sackgassen, langer Lösungsweg) */
function mazeCreate(n, h) {
  if (h === undefined) h = mz.hard || 0;
  if (h === 0) { var o0 = mazeCarve(n, 1); return { n: n, open: o0, path: mazeSolve(o0, n), h: 0 }; }
  var best = null, tries = h === 2 ? (n > 60 ? 4 : 8) : 2, pr = h === 2 ? 0.9 : 0.75;
  for (var t = 0; t < tries; t++) {
    var o = mazeCarve(n, pr), pa = mazeSolve(o, n);
    if (!best || pa.length > best.path.length) best = { n: n, open: o, path: pa, h: h };
  }
  return best;
}
function mazeDiff(n, h) { var b = n <= 10 ? 0 : n <= 20 ? 1 : n <= 30 ? 2 : 3; return h === 2 ? 3 : h === 1 ? Math.max(b, 2) : b; }
/* Wände als SVG-Pfad in Einheiten */
function mazeWallPath(m, ox, oy, cs) {
  var n = m.n, d = [];
  function f(v) { return +v.toFixed(3); }
  for (var y = 0; y < n; y++) for (var x = 0; x < n; x++) {
    var o = m.open[y * n + x], x0 = ox + x * cs, y0 = oy + y * cs;
    if (!(o & 1) && !(x === 0 && y === 0)) d.push('M' + f(x0) + ' ' + f(y0) + 'h' + f(cs));
    if (!(o & 8)) d.push('M' + f(x0) + ' ' + f(y0) + 'v' + f(cs));
    if (y === n - 1 && !(o & 4) && !(x === n - 1)) d.push('M' + f(x0) + ' ' + f(y0 + cs) + 'h' + f(cs));
    if (x === n - 1) d.push('M' + f(x0 + cs) + ' ' + f(y0) + 'v' + f(cs));
  }
  return d.join('');
}
function mazePathPts(m, ox, oy, cs, path) {
  var pts = [];
  pts.push((ox + cs / 2).toFixed(2) + ',' + (oy - cs * 0.6).toFixed(2));
  path.forEach(function (c) { pts.push((ox + (c % m.n + 0.5) * cs).toFixed(2) + ',' + (oy + (Math.floor(c / m.n) + 0.5) * cs).toFixed(2)); });
  pts.push((ox + (m.n - 0.5) * cs).toFixed(2) + ',' + (oy + (m.n + 0.6) * cs).toFixed(2));
  return pts.join(' ');
}

function bxConflicts(a, n) {
  var bad = {};
  for (var o = 0; o < 2; o++) for (var q = 0; q < n; q++) {
    var cnt = [0, 0], line = [];
    for (var t = 0; t < n; t++) { var r = o ? t : q, c = o ? q : t, v = a[r][c]; line.push([r, c, v]); if (v >= 0) cnt[v]++; }
    for (t = 0; t + 2 < n; t++) if (line[t][2] >= 0 && line[t][2] === line[t + 1][2] && line[t][2] === line[t + 2][2]) for (var k = 0; k < 3; k++) bad[line[t + k][0] + ',' + line[t + k][1]] = 1;
    for (var s = 0; s < 2; s++) if (cnt[s] > n / 2) line.forEach(function (l) { if (l[2] === s) bad[l[0] + ',' + l[1]] = 1; });
  }
  return bad;
}
