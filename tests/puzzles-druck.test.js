/* Eindeutigkeit bei den Groessen, die auch gedruckt werden (Arbeitsblaetter und Raetselhefte). */
const test = require('node:test');
const assert = require('node:assert/strict');
const { assertUnique, ctx, G, solveBySingles, countSudoku, countBx, countHitori, countMagic } = require('./lib/puzzle-lib.js');

test('Sudoku: grosse Formate (10 bis 20) sind allein durch zwingende Schluesse loesbar, also eindeutig', () => {
  const diffs = Object.keys(G('DIFF_CONFIG'));
  for (const n of [10, 11, 14, 15, 16, 20]) for (const d of diffs) {
    const sg = ctx.computeSubgrid(n);
    const p = ctx.createSudokuPuzzleData(n, sg.subR, sg.subC, d);
    assert.ok(solveBySingles(p.givens, n, sg.subR, sg.subC) || countSudoku(p.givens, n, sg.subR, sg.subC, 2) === 1, `Sudoku ${n}x${n} (${d}) nicht beweisbar eindeutig`);
    assert.ok(ctx.sudokuRulesOk(p.solution, n, sg.subR, sg.subC), `Sudoku ${n}: gespeicherte Loesung ungueltig`);
  }
});

test('Binoxxo 12: eindeutig (alle Stufen)', () => {
  for (let d = 0; d < 4; d++) {
    const p = ctx.bxCreate(12, d);
    assertUnique(assert, countBx(p.givens, 12, 2), `Binoxxo 12 (Stufe ${d})`);
  }
});

test('Hitori 7 bis 10: eindeutig', () => {
  for (const n of [7, 8, 9, 10]) for (const d of [0, 3]) {
    const p = ctx.htCreate(n, d);
    assertUnique(assert, countHitori(p.grid, n, 2), `Hitori ${n} (Stufe ${d})`);
  }
});

test('Magisches Quadrat 5 bis 7: eindeutig', () => {
  for (const n of [5, 6, 7]) for (const d of [0, 3]) {
    const p = ctx.mgCreate(n, d);
    assertUnique(assert, countMagic(p.givens, n, 2), `Magisches Quadrat ${n} (Stufe ${d})`);
  }
});

/* ---------- Suchsel ---------- */
function occurrences(grid, n, word, vecs) {
  const sets = new Set();
  for (const [dr, dc] of vecs) for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) {
    let ok = true; const cells = [];
    for (let t = 0; t < word.length; t++) { const a = r + dr * t, b = k + dc * t; if (a < 0 || b < 0 || a >= n || b >= n || grid[a][b] !== word[t]) { ok = false; break; } cells.push(a * n + b); }
    if (ok) sets.add(cells.sort((x, y) => x - y).join(','));
  }
  return sets.size;
}
test('Suchsel: jedes platzierte Wort steht genau einmal im Gitter (ohne Ausnahme)', () => {
  const lists = [
    G('DEFAULT_WS_WORDS').join('\n'),
    'AB\nBA\nOTTO\nAHA\nEI\nIE\nUHU\nOMA\nNA\nAN\nNU',
    'ROSE\nROSEN\nHAUS\nHAUSBAU\nBAU\nEL\nLE\nSEL',
    'KATZE\nHUND\nMAUS\nVOGEL\nFISCH\nPFERD\nKUH\nSCHAF\nZIEGE\nHASE\nIGEL\nBAER\nFUCHS\nWOLF'
  ];
  const combos = [{ h: true, v: true, d: true, r: false }, { h: true, v: true, d: true, r: true }, { h: true, v: false, d: false, r: false }, { h: true, v: true, d: false, r: true }];
  const ws = G('appState.ws');
  for (const raw of lists) for (const size of [8, 10, 16, 25]) for (const dirs of combos) for (let rep = 0; rep < 2; rep++) {
    ws.wordsRaw = raw; ws.size = size; ws.dirs = dirs;
    ctx.generateWordSearch();
    const vecs = ctx.buildAllowedVectors(dirs);
    const listed = new Set(Array.from(ws.placements).map((p) => p.word)), unplaced = Array.from(ws.unplaced);
    for (const w of ctx.parseWsWords(raw, ws.umlautDirect)) assert.ok(listed.has(w) || unplaced.includes(w), `${w} ist weder platziert noch als nicht platziert gemeldet`);
    for (const pl of ws.placements) {
      let s = ''; for (let k = 0; k < pl.word.length; k++) s += ws.grid[pl.sr + pl.dr * k][pl.sc + pl.dc * k];
      assert.equal(s, pl.word, `Platzierung von ${pl.word} stimmt nicht mit dem Gitter ueberein`);
      assert.equal(occurrences(ws.grid, size, pl.word, vecs), 1, `${pl.word} kommt mehrfach vor (${size}, ${JSON.stringify(dirs)})`);
    }
  }
});
test('Suchsel: Standard-Wortliste verliert kein Wort (ab 10x10)', () => {
  const ws = G('appState.ws');
  for (const size of [10, 16, 25]) {
    ws.wordsRaw = G('DEFAULT_WS_WORDS').join('\n'); ws.size = size; ws.dirs = { h: true, v: true, d: true, r: false };
    ctx.generateWordSearch();
    assert.equal(ws.unplaced.length, 0, `Standard-Wortliste verliert Woerter in ${size}x${size}`);
  }
});
test('Suchsel: Woerter, die in anderen Woertern stecken, werden erkannt', () => {
  assert.deepEqual(Array.from(ctx.wsContainedWords(['ROSE', 'ROSEN', 'HAUS'], false)), ['ROSE']);
  assert.deepEqual(Array.from(ctx.wsContainedWords(['ESEL', 'LESE'], false)), []);
  assert.deepEqual(Array.from(ctx.wsContainedWords(['SEL', 'LESEN'], true)), ['SEL']);
  assert.deepEqual(Array.from(ctx.wsContainedWords(['KATZE', 'HUND'], true)), []);
});
