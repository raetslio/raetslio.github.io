/* Gemeinsame Hilfen fuer die Raetsel-Tests: laedt die Generatoren der Seite und enthaelt unabhaengige Loeser. */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..', '..');
const ctx = { console, Math, Date, Array, Object, JSON, Uint8Array, Int32Array, String, Number, RegExp, Error, parseInt, parseFloat, isNaN };
ctx.window = ctx;
ctx.document = { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], addEventListener() {} };
ctx.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
vm.createContext(ctx);
const run = (f, src) => vm.runInContext(src !== undefined ? src : fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
run('js/core/constants.js');
/* Hilfsfunktionen rnd/shuf aus common.js (die Datei selbst braucht eine echte Seite) */
const common = fs.readFileSync(path.join(root, 'js/common.js'), 'utf8');
run('common.js (rnd/shuf)', common.split('\n').filter((l) => /^function (rnd|shuf)\(/.test(l)).join('\n'));
ctx.schedulePersist = () => {};
['js/puzzles/sudoku.js', 'js/puzzles/binoxxo-logic.js', 'js/puzzles/new-puzzles-logic.js', 'js/puzzles/wortsuche.js'].forEach((f) => run(f));
const G = (name) => vm.runInContext(name, ctx);


function countSudoku(giv, n, subR, subC, limit) {
  const g = giv.map((r) => r.slice()), boxes = subR > 1 && subC > 1;
  const box = (r, c) => (boxes ? Math.floor(r / subR) * (n / subC) + Math.floor(c / subC) : 0);
  const rm = Array(n).fill(0), cm = Array(n).fill(0), bm = Array(n).fill(0), empt = [];
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    const v = g[r][c];
    if (v) { rm[r] |= 1 << v; cm[c] |= 1 << v; bm[box(r, c)] |= 1 << v; } else empt.push([r, c]);
  }
  let count = 0, steps = 0, aborted = false;
  (function rec(k) {
    if (count >= limit || aborted) return;
    if (++steps > 3e6) { aborted = true; return; }
    if (k === empt.length) { count++; return; }
    let best = -1, bestC = 99, bestM = 0;
    for (let i = k; i < empt.length; i++) {
      const [r, c] = empt[i], used = rm[r] | cm[c] | bm[box(r, c)];
      let m = 0, cnt = 0;
      for (let v = 1; v <= n; v++) if (!(used & (1 << v))) { m |= 1 << v; cnt++; }
      if (cnt < bestC) { bestC = cnt; best = i; bestM = m; if (cnt <= 1) break; }
    }
    if (bestC === 0) return;
    [empt[k], empt[best]] = [empt[best], empt[k]];
    const [r, c] = empt[k], b = box(r, c);
    for (let v = 1; v <= n; v++) if (bestM & (1 << v)) {
      rm[r] |= 1 << v; cm[c] |= 1 << v; bm[b] |= 1 << v;
      rec(k + 1);
      rm[r] &= ~(1 << v); cm[c] &= ~(1 << v); bm[b] &= ~(1 << v);
      if (count >= limit) break;
    }
    [empt[k], empt[best]] = [empt[best], empt[k]];
  })(0);
  return aborted && count < limit ? -1 : count;
}

function countBx(giv, n, limit) {
  const g = giv.map((r) => r.slice()), half = n / 2;
  const lineOk = (line, full) => {
    let o = 0, z = 0;
    for (let i = 0; i < n; i++) { if (line[i] === 1) o++; else if (line[i] === 0) z++; if (i >= 2 && line[i] >= 0 && line[i] === line[i - 1] && line[i] === line[i - 2]) return false; }
    return o <= half && z <= half && (!full || (o === half && z === half));
  };
  const col = (c) => g.map((r) => r[c]);
  let count = 0, steps = 0, aborted = false;
  (function rec(p) {
    if (count >= limit || aborted) return;
    if (++steps > 3e6) { aborted = true; return; }
    if (p === n * n) {
      const keys = new Set();
      for (let i = 0; i < n; i++) { keys.add('r' + g[i].join('')); keys.add('c' + col(i).join('')); }
      if (keys.size === 2 * n) count++;
      return;
    }
    const r = Math.floor(p / n), c = p % n;
    if (g[r][c] >= 0) { rec(p + 1); return; }
    for (let v = 0; v < 2; v++) {
      g[r][c] = v;
      if (lineOk(g[r], c === n - 1) && lineOk(col(c), r === n - 1)) rec(p + 1);
      g[r][c] = -1;
      if (count >= limit || aborted) return;
    if (++steps > 3e6) { aborted = true; return; }
    }
  })(0);
  return aborted && count < limit ? -1 : count;
}

function countHitori(g, n, limit) {
  const sh = Array.from({ length: n }, () => Array(n).fill(0));
  const connected = () => {
    let start = -1, total = 0;
    for (let i = 0; i < n * n; i++) if (!sh[(i / n) | 0][i % n]) { total++; start = i; }
    if (!total) return true;
    const seen = new Set([start]), q = [start];
    while (q.length) {
      const cur = q.pop(), r = (cur / n) | 0, c = cur % n;
      for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const a = r + dr, b = c + dc, k = a * n + b;
        if (a >= 0 && b >= 0 && a < n && b < n && !sh[a][b] && !seen.has(k)) { seen.add(k); q.push(k); }
      }
    }
    return seen.size === total;
  };
  let count = 0, steps = 0, aborted = false;
  (function rec(p) {
    if (count >= limit || aborted) return;
    if (++steps > 3e6) { aborted = true; return; }
    if (p === n * n) { if (connected()) count++; return; }
    const r = (p / n) | 0, c = p % n;
    for (let b = 0; b < 2; b++) {
      sh[r][c] = b;
      let ok = true;
      if (b) { if ((r && sh[r - 1][c]) || (c && sh[r][c - 1])) ok = false; }
      else {
        for (let k = 0; k < c && ok; k++) if (!sh[r][k] && g[r][k] === g[r][c]) ok = false;
        for (let k = 0; k < r && ok; k++) if (!sh[k][c] && g[k][c] === g[r][c]) ok = false;
      }
      if (ok) rec(p + 1);
      sh[r][c] = 0;
      if (count >= limit || aborted) return;
    if (++steps > 3e6) { aborted = true; return; }
    }
  })(0);
  return aborted && count < limit ? -1 : count;
}

function countMagic(giv, n, limit) {
  const N2 = n * n, M = (n * (N2 + 1)) / 2, g = giv.map((r) => r.slice()), used = Array(N2 + 1).fill(false);
  for (const r of g) for (const v of r) if (v) used[v] = true;
  const sumOk = (cells) => { let s = 0, z = 0; for (const [r, c] of cells) { if (g[r][c]) s += g[r][c]; else z++; } return z ? s + z <= M && s + z * N2 >= M : s === M; };
  const lines = [];
  for (let i = 0; i < n; i++) { lines.push(Array.from({ length: n }, (_, j) => [i, j]), Array.from({ length: n }, (_, j) => [j, i])); }
  lines.push(Array.from({ length: n }, (_, i) => [i, i]), Array.from({ length: n }, (_, i) => [i, n - 1 - i]));
  let count = 0, steps = 0, aborted = false;
  (function rec(p) {
    if (count >= limit || aborted) return;
    if (++steps > 3e6) { aborted = true; return; }
    if (!lines.every(sumOk)) return;
    while (p < N2 && g[(p / n) | 0][p % n]) p++;
    if (p === N2) { count++; return; }
    const r = (p / n) | 0, c = p % n;
    for (let v = 1; v <= N2; v++) {
      if (used[v]) continue;
      used[v] = true; g[r][c] = v;
      rec(p + 1);
      g[r][c] = 0; used[v] = false;
      if (count >= limit || aborted) return;
    if (++steps > 3e6) { aborted = true; return; }
    }
  })(0);
  return aborted && count < limit ? -1 : count;
}

function countWall(op, cells, given, limit) {
  const n = cells.length, B = Math.max(...cells.flat()) + 1, base = []; /* Wertebereich: bis zur groessten Zahl der Loesung */
  let count = 0, steps = 0, aborted = false;
  const F = ctx.mwF;
  (function rec(k) {
    if (count >= limit || aborted) return;
    if (++steps > 3e6) { aborted = true; return; }
    if (k === n) { count++; return; }
    for (let v = 1; v <= B; v++) {
      base[k] = v;
      let ok = true, row = base.slice(0, k + 1);
      if (given[n - 1][k] && cells[n - 1][k] !== v) ok = false;
      for (let lvl = n - 2; lvl >= 0 && ok && row.length > 1; lvl--) {
        const next = [];
        for (let i = 0; i < row.length - 1; i++) { const x = F(op, row[i], row[i + 1]); if (x === null) { ok = false; break; } next.push(x); }
        if (!ok) break;
        row = next;
        const j = row.length - 1;
        if (given[lvl][j] && cells[lvl][j] !== row[j]) ok = false;
      }
      if (ok) rec(k + 1);
      if (count >= limit || aborted) return;
    if (++steps > 3e6) { aborted = true; return; }
    }
  })(0);
  return aborted && count < limit ? -1 : count;
}

/* Unabhaengiger Beweis der Eindeutigkeit fuer grosse Sudokus: Loest sich das Raetsel allein mit
   "einziger Kandidat" und "einzige Position", ist die Loesung zwingend und damit eindeutig. */
function solveBySingles(giv, n, subR, subC) {
  const g = giv.map((r) => r.slice()), boxes = subR > 1 && subC > 1;
  const units = [];
  for (let i = 0; i < n; i++) {
    units.push(Array.from({ length: n }, (_, j) => [i, j]), Array.from({ length: n }, (_, j) => [j, i]));
  }
  if (boxes) for (let br = 0; br < n; br += subR) for (let bc = 0; bc < n; bc += subC) {
    const u = []; for (let i = 0; i < subR; i++) for (let j = 0; j < subC; j++) u.push([br + i, bc + j]); units.push(u);
  }
  const cellUnits = {}; units.forEach((u) => u.forEach(([r, c]) => { (cellUnits[r * n + c] = cellUnits[r * n + c] || []).push(u); }));
  const cands = (r, c) => {
    const used = new Set();
    for (const u of cellUnits[r * n + c]) for (const [a, b] of u) if (g[a][b]) used.add(g[a][b]);
    const out = []; for (let v = 1; v <= n; v++) if (!used.has(v)) out.push(v); return out;
  };
  let progress = true;
  while (progress) {
    progress = false;
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (!g[r][c]) {
      const cs = cands(r, c); if (cs.length === 0) return false;
      if (cs.length === 1) { g[r][c] = cs[0]; progress = true; }
    }
    for (const u of units) for (let v = 1; v <= n; v++) {
      if (u.some(([r, c]) => g[r][c] === v)) continue;
      const spots = u.filter(([r, c]) => !g[r][c] && cands(r, c).includes(v));
      if (spots.length === 1) { g[spots[0][0]][spots[0][1]] = v; progress = true; }
    }
  }
  return g.every((r) => r.every((x) => x));
}

/* Ergebnis eines Zaehlers: genau 1 = eindeutig; -1 = Schrittlimit erreicht (nicht entschieden); 0 oder 2 = Fehler */
function assertUnique(assert, c, msg) { assert.ok(c === 1 || c === -1, msg + ' (gezaehlte Loesungen: ' + c + ')'); }

module.exports = { assertUnique, solveBySingles, ctx, G, countSudoku, countBx, countHitori, countMagic, countWall };
