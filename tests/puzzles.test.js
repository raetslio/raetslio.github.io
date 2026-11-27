/* Eindeutigkeit der erzeugten Raetsel (kleine Groessen, schnell). Die Raetsel werden mit dem echten
   Generator der Seite erzeugt und mit unabhaengig geschriebenen Loesern nachgezaehlt. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { assertUnique, ctx, G, countSudoku, countBx, countHitori, countMagic, countWall } = require('./lib/puzzle-lib.js');
/* ---------- Sudoku ---------- */
test('Sudoku: jedes erzeugte Raetsel hat genau eine Loesung (alle Stufen, Groessen 4, 6, 9, 12)', () => {
  const diffs = Object.keys(G('DIFF_CONFIG'));
  const sizes = [[4, 2, 2, 3], [6, 2, 3, 3], [9, 3, 3, 3], [12, 3, 4, 1]];
  for (const [n, sr, sc, times] of sizes) for (const d of diffs) for (let i = 0; i < times; i++) {
    const p = ctx.createSudokuPuzzleData(n, sr, sc, d);
    assertUnique(assert, countSudoku(p.givens, n, sr, sc, 2), `Sudoku ${n}x${n} (${d}) ist nicht eindeutig`);
    assert.ok(ctx.sudokuRulesOk(p.solution, n, sr, sc), 'gespeicherte Loesung verletzt die Regeln');
  }
});
test('Sudoku: Regelpruefung akzeptiert jede gueltige Loesung, lehnt Fehler ab', () => {
  const p = ctx.createSudokuPuzzleData(4, 2, 2, Object.keys(G('DIFF_CONFIG'))[0]);
  assert.ok(ctx.sudokuRulesOk(p.solution, 4, 2, 2));
  const bad = p.solution.map((r) => r.slice()); bad[0][0] = bad[0][1];
  assert.ok(!ctx.sudokuRulesOk(bad, 4, 2, 2));
  const holes = p.solution.map((r) => r.slice()); holes[2][2] = 0;
  assert.ok(!ctx.sudokuRulesOk(holes, 4, 2, 2));
});

/* ---------- Binoxxo ---------- */
test('Binoxxo: jedes erzeugte Raetsel hat genau eine Loesung (alle Stufen, Groessen 6, 8, 10)', () => {
  for (const n of [6, 8, 10]) for (let d = 0; d < 4; d++) for (let i = 0; i < 2; i++) {
    const p = ctx.bxCreate(n, d);
    assert.ok(p, `Binoxxo ${n} konnte nicht erzeugt werden`);
    assertUnique(assert, countBx(p.givens, n, 2), `Binoxxo ${n} (Stufe ${d}) ist nicht eindeutig`);
    assert.ok(ctx.bxValidFull(p.solution, n));
  }
});
test('Binoxxo: Regelpruefung', () => {
  const p = ctx.bxCreate(6, 0);
  assert.ok(ctx.bxValidFull(p.solution, 6));
  const bad = p.solution.map((r) => r.slice()); bad[0][0] = 1 - bad[0][0];
  assert.ok(!ctx.bxValidFull(bad, 6));
  assert.ok(!ctx.bxValidFull(p.givens, 6) || p.givens.every((r) => r.every((x) => x >= 0)));
});

/* ---------- Hitori ---------- */
test('Hitori: jedes erzeugte Raetsel hat genau eine Loesung', () => {
  for (const [n, d] of [[5, 0], [5, 2], [6, 1], [6, 3]]) {
    const p = ctx.htCreate(n, d);
    assertUnique(assert, countHitori(p.grid, n, 2), `Hitori ${n}x${n} (Stufe ${d}) ist nicht eindeutig`);
    const st = p.solution.map((r) => r.map((x) => (x ? 1 : 0)));
    assert.ok(ctx.htAnalyze(p.grid, st, n).solved, 'gespeicherte Loesung wird von der Pruefung nicht akzeptiert');
  }
});

/* ---------- Magisches Quadrat ---------- */
test('Magisches Quadrat: jedes erzeugte Raetsel hat genau eine Loesung (3x3, 4x4)', () => {
  for (const n of [3, 4]) for (let d = 0; d < 4; d++) {
    const p = ctx.mgCreate(n, d);
    assertUnique(assert, countMagic(p.givens, n, 2), `Magisches Quadrat ${n}x${n} (Stufe ${d}) ist nicht eindeutig`);
    assert.ok(ctx.mgAnalyze(p.solution, n).solved);
  }
});

/* ---------- Zahlenmauer ---------- */
test('Zahlenmauer: jedes erzeugte Raetsel hat genau eine Loesung (alle Rechenarten)', () => {
  for (const op of ['plus', 'minus', 'mal', 'geteilt']) for (let d = 0; d < 4; d++) {
    const p = ctx.mwCreate(4, d, op);
    assertUnique(assert, countWall(op, p.cells, p.given, 2), `Zahlenmauer (${op}, Stufe ${d}) ist nicht eindeutig`);
    const e = p.cells.map((r, i) => r.map((v) => v));
    assert.ok(ctx.mwAnalyze(op, e).solved);
  }
});
