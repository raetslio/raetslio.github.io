/* ======================================================================
   Sudoku
   Generator, Lösbarkeitsprüfung, Spielfeld, Tastenfeld, Eingabe und Zeitmessung.
   ====================================================================== */

function computeSubgrid(n) {
  var bestR = 1;
  var bestC = n;
  var bestDiff = n;
  for (var r = 2; r * r <= n; r++) {
    if (n % r === 0) {
      var c = n / r;
      if (Math.abs(c - r) < bestDiff) {
        bestDiff = Math.abs(c - r);
        bestR = r;
        bestC = c;
      }
    }
  }
  return { subR: bestR, subC: bestC };
}

function shuffleArray(arr) {
  for (var i = arr.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

function generateSolvedBoard(n, subR, subC) {
  var board = new Array(n);
  for (var r = 0; r < n; r++) {
    board[r] = new Array(n);
    for (var c = 0; c < n; c++) {
      if (subR > 1 && subC > 1) {
        board[r][c] = ((r % subR) * subC + Math.floor(r / subR) + c) % n + 1;
      } else {
        board[r][c] = (r + c) % n + 1;
      }
    }
  }

  /* Symbol permutation */
  var symbols = [];
  for (var s = 1; s <= n; s++) symbols.push(s);
  shuffleArray(symbols);

  /* Row order permutation preserving sub-bands */
  var rowOrder = [];
  if (subR > 1 && subC > 1) {
    var bandCount = n / subR;
    var bandIndices = [];
    for (var b = 0; b < bandCount; b++) bandIndices.push(b);
    shuffleArray(bandIndices);
    for (var bi = 0; bi < bandIndices.length; bi++) {
      var band = bandIndices[bi];
      var innerRows = [];
      for (var ir = 0; ir < subR; ir++) innerRows.push(band * subR + ir);
      shuffleArray(innerRows);
      for (var k = 0; k < innerRows.length; k++) rowOrder.push(innerRows[k]);
    }
  } else {
    for (var rr = 0; rr < n; rr++) rowOrder.push(rr);
    shuffleArray(rowOrder);
  }

  /* Column order permutation preserving sub-stacks */
  var colOrder = [];
  if (subR > 1 && subC > 1) {
    var stackCount = n / subC;
    var stackIndices = [];
    for (var st = 0; st < stackCount; st++) stackIndices.push(st);
    shuffleArray(stackIndices);
    for (var si = 0; si < stackIndices.length; si++) {
      var stack = stackIndices[si];
      var innerCols = [];
      for (var ic = 0; ic < subC; ic++) innerCols.push(stack * subC + ic);
      shuffleArray(innerCols);
      for (var m = 0; m < innerCols.length; m++) colOrder.push(innerCols[m]);
    }
  } else {
    for (var cc = 0; cc < n; cc++) colOrder.push(cc);
    shuffleArray(colOrder);
  }

  var result = new Array(n);
  for (var nr = 0; nr < n; nr++) {
    result[nr] = new Array(n);
    for (var nc = 0; nc < n; nc++) {
      result[nr][nc] = symbols[board[rowOrder[nr]][colOrder[nc]] - 1];
    }
  }

  /* Extra transpose for square boxes */
  if (subR === subC && Math.random() < 0.5) {
    var trans = new Array(n);
    for (var tr = 0; tr < n; tr++) {
      trans[tr] = new Array(n);
      for (var tc = 0; tc < n; tc++) {
        trans[tr][tc] = result[tc][tr];
      }
    }
    return trans;
  }
  return result;
}

function countSolutionsLimited(puzzle, n, subR, subC, limit) {
  var rowMask = new Array(n).fill(0);
  var colMask = new Array(n).fill(0);
  var boxMask = new Array(n).fill(0);
  var hasBoxes = subR > 1 && subC > 1;
  var empties = [];

  for (var r = 0; r < n; r++) {
    for (var c = 0; c < n; c++) {
      var v = puzzle[r][c];
      if (v > 0) {
        var bit = 1 << v;
        rowMask[r] |= bit;
        colMask[c] |= bit;
        if (hasBoxes) {
          var b = Math.floor(r / subR) * (n / subC) + Math.floor(c / subC);
          boxMask[b] |= bit;
        }
      } else {
        empties.push([r, c]);
      }
    }
  }

  var allBits = (1 << (n + 1)) - 2;
  var solutions = 0;
  var steps = 0;
  var maxSteps = 5000;

  function backtrack(idx) {
    if (solutions >= limit || steps > maxSteps) return;
    steps++;
    if (idx === empties.length) {
      solutions++;
      return;
    }
    /* MRV selection among remaining empties */
    var bestIdx = idx;
    var bestCount = n + 1;
    var bestCands = 0;
    for (var i = idx; i < empties.length; i++) {
      var cr = empties[i][0];
      var cc = empties[i][1];
      var cb = hasBoxes ? Math.floor(cr / subR) * (n / subC) + Math.floor(cc / subC) : 0;
      var used = rowMask[cr] | colMask[cc] | (hasBoxes ? boxMask[cb] : 0);
      var cands = allBits & ~used;
      var cnt = 0;
      var tmp = cands;
      while (tmp) { tmp &= tmp - 1; cnt++; }
      if (cnt === 0) return;
      if (cnt < bestCount) {
        bestCount = cnt;
        bestIdx = i;
        bestCands = cands;
        if (cnt === 1) break;
      }
    }

    var swap = empties[idx];
    empties[idx] = empties[bestIdx];
    empties[bestIdx] = swap;

    var rr = empties[idx][0];
    var rc = empties[idx][1];
    var rb = hasBoxes ? Math.floor(rr / subR) * (n / subC) + Math.floor(rc / subC) : 0;

    for (var v = 1; v <= n; v++) {
      var bbit = 1 << v;
      if (bestCands & bbit) {
        puzzle[rr][rc] = v;
        rowMask[rr] |= bbit;
        colMask[rc] |= bbit;
        if (hasBoxes) boxMask[rb] |= bbit;
        backtrack(idx + 1);
        puzzle[rr][rc] = 0;
        rowMask[rr] &= ~bbit;
        colMask[rc] &= ~bbit;
        if (hasBoxes) boxMask[rb] &= ~bbit;
        if (solutions >= limit || steps > maxSteps) break;
      }
    }

    var unswap = empties[idx];
    empties[idx] = empties[bestIdx];
    empties[bestIdx] = unswap;
  }

  backtrack(0);
  /* Wurde die Suche abgebrochen, ist Eindeutigkeit nicht bewiesen: wie "mehrere Lösungen" behandeln */
  return steps > maxSteps ? limit : solutions;
}

/* Logischer Löser (nackte + versteckte Einzelwerte) für große Gitter.
   Löst er das Rätsel vollständig, ist die Lösung zwingend eindeutig. */
function sudokuLogicSolvable(g, n, subR, subC, deadline) {
  var W = n + 1, N = n * n, hasBoxes = subR > 1 && subC > 1, bw = hasBoxes ? n / subC : 1;
  var val = new Int16Array(N), rowH = new Uint8Array(n * W), colH = new Uint8Array(n * W), boxH = new Uint8Array(n * W);
  var boxOf = new Int16Array(N), units = [], r, c, i, u;
  for (r = 0; r < n; r++) for (c = 0; c < n; c++) boxOf[r * n + c] = hasBoxes ? Math.floor(r / subR) * bw + Math.floor(c / subC) : 0;
  for (u = 0; u < n; u++) { units.push([], []); if (hasBoxes) units.push([]); }
  var per = hasBoxes ? 3 : 2;
  for (r = 0; r < n; r++) for (c = 0; c < n; c++) {
    i = r * n + c; units[r * per].push(i); units[c * per + 1].push(i);
    if (hasBoxes) units[boxOf[i] * per + 2].push(i);
  }
  var empty = 0;
  for (r = 0; r < n; r++) for (c = 0; c < n; c++) {
    var v = g[r][c]; i = r * n + c; val[i] = v;
    if (v > 0) { rowH[r * W + v] = 1; colH[c * W + v] = 1; boxH[boxOf[i] * W + v] = 1; } else empty++;
  }
  function can(i, v) { var rr = (i / n) | 0, cc = i % n; return !rowH[rr * W + v] && !colH[cc * W + v] && !boxH[boxOf[i] * W + v]; }
  function put(i, v) { var rr = (i / n) | 0, cc = i % n; val[i] = v; rowH[rr * W + v] = 1; colH[cc * W + v] = 1; boxH[boxOf[i] * W + v] = 1; empty--; }
  var progress = true, cnt = new Int16Array(W), last = new Int32Array(W);
  while (progress && empty > 0) {
    progress = false;
    if (Date.now() > deadline) return false;
    for (i = 0; i < N; i++) {
      if (val[i]) continue;
      var k = 0, only = 0;
      for (var x = 1; x <= n && k < 2; x++) if (can(i, x)) { k++; only = x; }
      if (k === 0) return false;
      if (k === 1) { put(i, only); progress = true; }
    }
    for (u = 0; u < units.length; u++) {
      var cells = units[u], x2, j;
      for (x2 = 1; x2 <= n; x2++) { cnt[x2] = 0; }
      for (j = 0; j < cells.length; j++) {
        i = cells[j]; if (val[i]) continue;
        for (x2 = 1; x2 <= n; x2++) if (can(i, x2)) { cnt[x2]++; last[x2] = i; }
      }
      for (x2 = 1; x2 <= n; x2++) {
        if (cnt[x2] === 1 && !val[last[x2]] && can(last[x2], x2)) { put(last[x2], x2); progress = true; }
      }
    }
  }
  return empty === 0;
}

function createSudokuPuzzleData(n, subR, subC, diffKey) {
  var solution = generateSolvedBoard(n, subR, subC);
  var givens = new Array(n);
  for (var r = 0; r < n; r++) {
    givens[r] = solution[r].slice();
  }

  var ratio = (DIFF_CONFIG[diffKey] || DIFF_CONFIG.leicht).clueRatio;
  var totalCells = n * n;
  var targetClues = Math.max(n, Math.round(totalCells * ratio));
  var targetRemove = totalCells - targetClues;

  var coords = [];
  for (var cr = 0; cr < n; cr++) {
    for (var cc = 0; cc < n; cc++) {
      coords.push([cr, cc]);
    }
  }
  shuffleArray(coords);

  var removed = 0;
  if (n <= 9) {
    for (var i = 0; i < coords.length && removed < targetRemove; i++) {
      var rr = coords[i][0];
      var rc = coords[i][1];
      var saved = givens[rr][rc];
      givens[rr][rc] = 0;
      if (countSolutionsLimited(givens, n, subR, subC, 2) === 1) {
        removed++;
      } else {
        givens[rr][rc] = saved;
      }
    }
  } else {
    /* Große Gitter: Hinweis nur entfernen, wenn das Rätsel weiterhin logisch (und damit eindeutig) lösbar ist.
       Zeitbudget begrenzt die Arbeit; es bleiben dann eher mehr Hinweise stehen, aber nie mehrdeutig. */
    var deadline = Date.now() + Math.min(2500, 300 + n * n * 1.2);
    for (var j = 0; j < coords.length && removed < targetRemove && Date.now() < deadline; j++) {
      var r2 = coords[j][0], c2 = coords[j][1], sv = givens[r2][c2];
      givens[r2][c2] = 0;
      if (sudokuLogicSolvable(givens, n, subR, subC, deadline)) removed++; else givens[r2][c2] = sv;
    }
  }

  return { solution: solution, givens: givens };
}

function autoZoomForSudokuSize(n) {
  if (n <= 6) return 48;
  if (n <= 9) return 40;
  if (n <= 12) return 34;
  if (n <= 16) return 30;
  if (n <= 25) return 26;
  return 22;
}

function startSudokuTimer() {
  if (sudokuTimerId) clearInterval(sudokuTimerId);
  sudokuTimerId = setInterval(function () {
    if (appState.mode === 'sudoku' && !appState.sudoku.revealed) {
      appState.sudoku.elapsedSec++;
      updateSudokuTimerDisplay();
    }
  }, 1000);
}

function updateSudokuTimerDisplay() {
  var el = document.getElementById('sudoku-timer-stat');
  if (!el) return;
  var sec = appState.sudoku.elapsedSec || 0;
  var mm = String(Math.floor(sec / 60)).padStart(2, '0');
  var ss = String(sec % 60).padStart(2, '0');
  el.textContent = `${mm}:${ss}`;
}

function selectSudokuPreset(n) {
  var input = document.getElementById('sudoku-size-input');
  if (input) input.value = String(n);
  onSudokuSizeInput(n);
  requestSudokuGeneration();
}

function onSudokuSizeInput(val) {
  var n = parseInt(val, 10);
  if (isNaN(n)) return;
  if (n < 4) n = 4;
  if (n > 55) n = 55;
  var sg = computeSubgrid(n);
  var preview = document.getElementById('sudoku-subgrid-preview');
  if (preview) {
    preview.textContent = sg.subR > 1 ? `Blöcke: ${sg.subR}×${sg.subC}` : 'Lateinisches Quadrat (ohne Blöcke)';
  }
  var primeNote = document.getElementById('sudoku-prime-note');
  if (primeNote) {
    if (sg.subR === 1) {
      primeNote.textContent = `Hinweis: ${n} ist eine Primzahl — es wird ein Lateinisches Quadrat ohne Unterblöcke erzeugt.`;
      primeNote.classList.remove('hidden');
    } else {
      primeNote.classList.add('hidden');
    }
  }
  var chips = document.querySelectorAll('#sudoku-size-presets .chip-btn');
  chips.forEach(function (ch) {
    ch.setAttribute('aria-pressed', parseInt(ch.dataset.size, 10) === n ? 'true' : 'false');
  });
}

function setSudokuDifficulty(diff) {
  if (!DIFF_CONFIG[diff]) return;
  appState.sudoku.difficulty = diff;
  var btns = document.querySelectorAll('#sudoku-diff-segmented .seg-btn');
  btns.forEach(function (b) {
    b.setAttribute('aria-pressed', b.dataset.diff === diff ? 'true' : 'false');
  });
  var hint = document.getElementById('sudoku-diff-hint');
  if (hint) hint.textContent = DIFF_CONFIG[diff].hint;
  requestSudokuGeneration();
}

function requestSudokuGeneration() {
  var input = document.getElementById('sudoku-size-input');
  var n = input ? parseInt(input.value, 10) : appState.sudoku.size;
  if (isNaN(n) || n < 4) n = 4;
  if (n > 55) n = 55;
  if (input) input.value = String(n);

  var sg = computeSubgrid(n);
  appState.sudoku.size = n;
  appState.sudoku.subR = sg.subR;
  appState.sudoku.subC = sg.subC;
  appState.sudoku.cellZoom = autoZoomForSudokuSize(n);

  var zoomSlider = document.getElementById('sudoku-zoom-slider');
  var zoomVal = document.getElementById('sudoku-zoom-val');
  if (zoomSlider) zoomSlider.value = String(appState.sudoku.cellZoom);
  if (zoomVal) zoomVal.textContent = `${appState.sudoku.cellZoom} px`;

  var data = createSudokuPuzzleData(n, sg.subR, sg.subC, appState.sudoku.difficulty);
  appState.sudoku.solution = data.solution;
  appState.sudoku.givens = data.givens;
  appState.sudoku.entries = new Array(n);
  for (var r = 0; r < n; r++) {
    appState.sudoku.entries[r] = new Array(n).fill(0);
  }
  appState.sudoku.checkedStatus = null;
  appState.sudoku.revealed = false;
  appState.sudoku.selected = null;
  appState.sudoku.elapsedSec = 0;
  appState.sudoku.extraPuzzles = [];

  onSudokuSizeInput(n);
  hideSudokuFeedback();
  renderSudokuAll();
  updateSudokuTimerDisplay();
  schedulePersist();
}

function ensureSudokuExtraPuzzles(countNeeded) {
  var s = appState.sudoku;
  if (!s.extraPuzzles) s.extraPuzzles = [];
  while (s.extraPuzzles.length < countNeeded - 1) {
    s.extraPuzzles.push(createSudokuPuzzleData(s.size, s.subR, s.subC, s.difficulty));
  }
}

function setSudokuCellZoom(val) {
  var z = parseInt(val, 10);
  if (isNaN(z)) return;
  appState.sudoku.cellZoom = z;
  var zVal = document.getElementById('sudoku-zoom-val');
  if (zVal) zVal.textContent = `${z} px`;
  renderSudokuGrid();
  schedulePersist();
}

function renderSudokuAll() {
  renderSudokuRules();
  renderSudokuGrid();
  renderSudokuKeypad();
  updateSudokuMeta();
}

function renderSudokuRules() {
  var s = appState.sudoku;
  var badge = document.getElementById('sudoku-rule-badge');
  if (badge) {
    badge.textContent = s.subR > 1
      ? `${s.size}×${s.size} · Unterblöcke ${s.subR}×${s.subC}`
      : `${s.size}×${s.size} · Lateinisches Quadrat`;
  }
  var list = document.getElementById('sudoku-rules-list');
  if (!list) return;
  list.innerHTML = '';
  var rules = getSudokuRules(s.size, s.subR, s.subC);
  rules.forEach(function (txt) {
    var li = document.createElement('li');
    li.textContent = txt;
    list.appendChild(li);
  });
}

function renderSudokuGrid() {
  var gridEl = document.getElementById('sudoku-grid');
  if (!gridEl) return;
  var s = appState.sudoku;
  var n = s.size;
  var px = s.cellZoom;
  var hasBoxes = s.subR > 1 && s.subC > 1;

  gridEl.style.gridTemplateColumns = `repeat(${n}, ${px}px)`;
  gridEl.style.gridTemplateRows = `repeat(${n}, ${px}px)`;
  gridEl.innerHTML = '';

  var selR = s.selected ? s.selected.r : -1;
  var selC = s.selected ? s.selected.c : -1;
  var selVal = 0;
  if (selR >= 0 && selC >= 0 && s.givens[selR] && s.entries[selR]) {
    selVal = s.givens[selR][selC] || s.entries[selR][selC] || (s.revealed && s.solution[selR] ? s.solution[selR][selC] : 0);
  }
  var selBox = (hasBoxes && selR >= 0) ? Math.floor(selR / s.subR) * (n / s.subC) + Math.floor(selC / s.subC) : -1;

  var fontSize = n >= 10 ? Math.max(10, Math.round(px * 0.42)) : Math.max(12, Math.round(px * 0.54));

  for (var r = 0; r < n; r++) {
    var gRow = Array.isArray(s.givens[r]) ? s.givens[r] : [];
    var eRow = Array.isArray(s.entries[r]) ? s.entries[r] : [];
    var solRow = Array.isArray(s.solution[r]) ? s.solution[r] : [];
    for (var c = 0; c < n; c++) {
      var cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'sudoku-cell';
      cell.style.fontSize = `${fontSize}px`;
      cell.setAttribute('role', 'gridcell');

      var givenVal = gRow[c] || 0;
      var userVal = eRow[c] || 0;
      var displayVal = givenVal || (s.revealed ? (solRow[c] || 0) : userVal);

      if (givenVal > 0) {
        cell.classList.add('given');
      } else if (s.revealed) {
        cell.classList.add('cell-solution');
      }

      if (hasBoxes) {
        if ((c + 1) % s.subC === 0 && c < n - 1) cell.classList.add('box-right');
        if ((r + 1) % s.subR === 0 && r < n - 1) cell.classList.add('box-bottom');
      }
      if (c === n - 1) cell.classList.add('edge-right');
      if (r === n - 1) cell.classList.add('edge-bottom');

      if (selR === r && selC === c) {
        cell.classList.add('selected');
      } else if (selR >= 0) {
        var curBox = hasBoxes ? Math.floor(r / s.subR) * (n / s.subC) + Math.floor(c / s.subC) : -2;
        if (r === selR || c === selC || (hasBoxes && curBox === selBox)) {
          cell.classList.add('peer');
        }
        if (selVal > 0 && displayVal === selVal) {
          cell.classList.add('same-val');
        }
      }

      if (!s.revealed && s.checkedStatus && givenVal === 0 && userVal > 0) {
        var st = s.checkedStatus[r][c];
        if (st === 'correct') cell.classList.add('cell-correct');
        if (st === 'wrong') cell.classList.add('cell-wrong');
      }

      cell.setAttribute('aria-label', `Zeile ${r + 1}, Spalte ${c + 1}, ` + (displayVal > 0 ? `Wert ${displayVal}` : 'leer') + (givenVal > 0 ? ', vorgegeben' : ''));
      cell.textContent = displayVal > 0 ? String(displayVal) : '';
      cell.dataset.r = String(r);
      cell.dataset.c = String(c);
      cell.onclick = onSudokuCellClick;
      gridEl.appendChild(cell);
    }
  }
}

function onSudokuCellClick(e) {
  var btn = e.currentTarget;
  var r = parseInt(btn.dataset.r, 10);
  var c = parseInt(btn.dataset.c, 10);
  digitBuffer = '';
  appState.sudoku.selected = { r: r, c: c };
  renderSudokuGrid();
}

function renderSudokuKeypad() {
  var pad = document.getElementById('sudoku-keypad');
  if (!pad) return;
  var n = appState.sudoku.size;
  pad.innerHTML = '';
  for (var num = 1; num <= n; num++) {
    (function (val) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'key-btn';
      b.textContent = String(val);
      b.onclick = function () { enterSudokuValue(val); };
      pad.appendChild(b);
    })(num);
  }
  var clearBtn = document.createElement('button');
  clearBtn.type = 'button';
  clearBtn.className = 'key-btn key-accent';
  clearBtn.title = 'Feld leeren';
  clearBtn.innerHTML = '<svg class="icon-svg-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z"/><path d="M18 9l-6 6M12 9l6 6"/></svg><span>Löschen</span>';
  clearBtn.style.gridColumn = 'span 2';
  clearBtn.onclick = function () { enterSudokuValue(0); };
  pad.appendChild(clearBtn);
}

function enterSudokuValue(val) {
  var s = appState.sudoku;
  if (!s.selected) {
    showSudokuFeedback('Bitte zuerst ein leeres Spielfeld antippen oder anklicken.', 'info');
    return;
  }
  if (s.revealed) {
    showSudokuFeedback('Die Lösung wird angezeigt. Blende sie aus, um weiter einzugeben.', 'info');
    return;
  }
  var r = s.selected.r;
  var c = s.selected.c;
  if (s.givens[r][c] > 0) {
    showSudokuFeedback('Vorgegebene Felder können nicht überschrieben werden.', 'warning');
    return;
  }
  s.entries[r][c] = val;
  if (s.checkedStatus) s.checkedStatus[r][c] = null;
  renderSudokuGrid();
  updateSudokuMeta();
  schedulePersist();

  if (val > 0 && isSudokuCompleteAndValid()) {
    showSudokuFeedback('Glückwunsch! Das gesamte Sudoku wurde fehlerfrei gelöst.', 'success');
  }
}

function isSudokuCompleteAndValid() {
  var s = appState.sudoku;
  var n = s.size;
  for (var r = 0; r < n; r++) {
    for (var c = 0; c < n; c++) {
      var v = s.givens[r][c] || s.entries[r][c];
      if (v !== s.solution[r][c]) return false;
    }
  }
  return true;
}

function updateSudokuMeta() {
  var s = appState.sudoku;
  var n = s.size;
  var totalEmpty = 0;
  var filled = 0;
  for (var r = 0; r < n; r++) {
    var gRow = Array.isArray(s.givens[r]) ? s.givens[r] : [];
    var eRow = Array.isArray(s.entries[r]) ? s.entries[r] : [];
    for (var c = 0; c < n; c++) {
      if ((gRow[c] || 0) === 0) {
        totalEmpty++;
        if ((eRow[c] || 0) > 0) filled++;
      }
    }
  }
  var diffTag = document.getElementById('sudoku-diff-tag');
  if (diffTag) diffTag.textContent = (DIFF_CONFIG[s.difficulty] || DIFF_CONFIG.leicht).label;
  var stat = document.getElementById('sudoku-progress-stat');
  if (stat) stat.textContent = `${filled} / ${totalEmpty} ausgefüllt`;

  var revealBtn = document.getElementById('btn-sudoku-reveal');
  if (revealBtn) {
    revealBtn.textContent = s.revealed ? 'Lösung ausblenden' : 'Lösung anzeigen';
  }
}

function checkSudoku() {
  var s = appState.sudoku;
  if (s.revealed) return;
  var n = s.size;
  if (!Array.isArray(s.givens) || s.givens.length !== n || !Array.isArray(s.solution) || s.solution.length !== n) return;
  var status = new Array(n);
  var wrongCount = 0;
  var correctCount = 0;
  var remaining = 0;

  for (var r = 0; r < n; r++) {
    status[r] = new Array(n).fill(null);
    var gRow = Array.isArray(s.givens[r]) ? s.givens[r] : [];
    var eRow = Array.isArray(s.entries[r]) ? s.entries[r] : [];
    var solRow = Array.isArray(s.solution[r]) ? s.solution[r] : [];
    for (var c = 0; c < n; c++) {
      if ((gRow[c] || 0) === 0) {
        var v = eRow[c] || 0;
        if (v === 0) {
          remaining++;
        } else if (v === solRow[c]) {
          status[r][c] = 'correct';
          correctCount++;
        } else {
          status[r][c] = 'wrong';
          wrongCount++;
        }
      }
    }
  }
  s.checkedStatus = status;
  renderSudokuGrid();

  var clearWrongBtn = document.getElementById('btn-clear-wrong');
  if (clearWrongBtn) clearWrongBtn.classList.toggle('hidden', wrongCount === 0);

  if (wrongCount === 0 && remaining === 0) {
    showSudokuFeedback(`Perfekt! Alle ${correctCount} Felder sind korrekt gelöst.`, 'success');
  } else if (wrongCount > 0) {
    showSudokuFeedback(`${wrongCount} falsche Eingabe(n) markiert, ${correctCount} richtig, noch ${remaining} Felder offen.`, 'error');
  } else {
    showSudokuFeedback(`Alle bisherigen ${correctCount} Eingaben sind richtig — noch ${remaining} Felder offen.`, 'info');
  }
}

function clearWrongSudokuCells() {
  var s = appState.sudoku;
  if (!s.checkedStatus) return;
  var n = s.size;
  for (var r = 0; r < n; r++) {
    for (var c = 0; c < n; c++) {
      if (s.checkedStatus[r][c] === 'wrong') {
        s.entries[r][c] = 0;
        s.checkedStatus[r][c] = null;
      }
    }
  }
  var clearWrongBtn = document.getElementById('btn-clear-wrong');
  if (clearWrongBtn) clearWrongBtn.classList.add('hidden');
  renderSudokuGrid();
  updateSudokuMeta();
  showSudokuFeedback('Alle fehlerhaften Einträge wurden entfernt.', 'info');
  schedulePersist();
}

function toggleSudokuReveal() {
  appState.sudoku.revealed = !appState.sudoku.revealed;
  renderSudokuGrid();
  updateSudokuMeta();
  if (appState.sudoku.revealed) {
    showSudokuFeedback('Die vollständige Lösung wird angezeigt.', 'info');
  } else {
    hideSudokuFeedback();
  }
  schedulePersist();
}

function resetSudokuEntries(btn) {
  if (btn && btn.dataset.armed !== 'true') {
    btn.dataset.armed = 'true';
    btn.textContent = 'Nochmal klicken zum Leeren';
    setTimeout(function () {
      if (btn.dataset.armed === 'true') {
        btn.dataset.armed = 'false';
        btn.textContent = 'Eingaben leeren';
      }
    }, 3000);
    return;
  }
  if (btn) {
    btn.dataset.armed = 'false';
    btn.textContent = 'Eingaben leeren';
  }
  var s = appState.sudoku;
  var n = s.size;
  for (var r = 0; r < n; r++) {
    for (var c = 0; c < n; c++) {
      s.entries[r][c] = 0;
    }
  }
  s.checkedStatus = null;
  s.revealed = false;
  var clearWrongBtn = document.getElementById('btn-clear-wrong');
  if (clearWrongBtn) clearWrongBtn.classList.add('hidden');
  hideSudokuFeedback();
  renderSudokuGrid();
  updateSudokuMeta();
  schedulePersist();
}

function showSudokuFeedback(msg, kind) {
  var box = document.getElementById('sudoku-feedback');
  var txt = document.getElementById('sudoku-feedback-text');
  if (!box || !txt) return;
  box.className = `feedback-banner ${kind || 'info'}`;
  txt.textContent = msg;
}

function hideSudokuFeedback() {
  var box = document.getElementById('sudoku-feedback');
  if (box) box.classList.add('hidden');
}

/* Keyboard handling for Sudoku */
document.addEventListener('keydown', function (e) {
  var modal = document.getElementById('print-modal');
  var modalOpen = !!(modal && modal.getAttribute('data-open') === 'true');
  if (modalOpen) {
    if (e.key === 'Escape') { e.preventDefault(); closePrintModal(); }
    return;
  }
  if (appState.mode !== 'sudoku') return;
  var activeTag = document.activeElement ? document.activeElement.tagName : '';
  if (activeTag === 'INPUT' || activeTag === 'TEXTAREA') return;

  var s = appState.sudoku;
  var n = s.size;

  if (e.key === 'Escape') {
    s.selected = null;
    digitBuffer = '';
    renderSudokuGrid();
    return;
  }

  if (!s.selected) return;
  var r = s.selected.r;
  var c = s.selected.c;

  if (e.key === 'ArrowUp') { e.preventDefault(); s.selected = { r: (r - 1 + n) % n, c: c }; digitBuffer = ''; renderSudokuGrid(); return; }
  if (e.key === 'ArrowDown') { e.preventDefault(); s.selected = { r: (r + 1) % n, c: c }; digitBuffer = ''; renderSudokuGrid(); return; }
  if (e.key === 'ArrowLeft') { e.preventDefault(); s.selected = { r: r, c: (c - 1 + n) % n }; digitBuffer = ''; renderSudokuGrid(); return; }
  if (e.key === 'ArrowRight') { e.preventDefault(); s.selected = { r: r, c: (c + 1) % n }; digitBuffer = ''; renderSudokuGrid(); return; }
  if (e.key === 'Backspace' || e.key === 'Delete' || (e.key === '0' && (n <= 9 || digitBuffer === ''))) {
    e.preventDefault();
    digitBuffer = '';
    enterSudokuValue(0);
    return;
  }

  if (/^[0-9]$/.test(e.key)) {
    e.preventDefault();
    if (n <= 9) {
      var vSingle = parseInt(e.key, 10);
      if (vSingle >= 1 && vSingle <= n) enterSudokuValue(vSingle);
    } else {
      if (digitBufferTimer) clearTimeout(digitBufferTimer);
      var combined = parseInt(digitBuffer + e.key, 10);
      if (digitBuffer !== '' && combined >= 1 && combined <= n) {
        digitBuffer = '';
        enterSudokuValue(combined);
      } else {
        var vStart = parseInt(e.key, 10);
        if (vStart >= 1 && vStart <= n) {
          digitBuffer = e.key;
          enterSudokuValue(vStart);
          digitBufferTimer = setTimeout(function () { digitBuffer = ''; }, 900);
        } else {
          digitBuffer = '';
        }
      }
    }
  }
});
