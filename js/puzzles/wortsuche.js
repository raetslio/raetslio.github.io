/* ======================================================================
   Suchsel (Wortsuche)
   Wörter platzieren, Raster erzeugen und das Zwei-Klick-Markieren im Spiel.
   ====================================================================== */

function normalizeWordForWs(raw, umlautDirect) {
  var up = raw.trim().toUpperCase();
  up = up.replace(/ß/g, 'SS');
  if (!umlautDirect) {
    up = up.replace(/Ä/g, 'AE').replace(/Ö/g, 'OE').replace(/Ü/g, 'UE');
    up = up.replace(/[^A-Z]/g, '');
  } else {
    up = up.replace(/[^A-ZÄÖÜ]/g, '');
  }
  return up;
}

function parseWsWords(rawText, umlautDirect) {
  var tokens = rawText.split(/[\n,;]+/);
  var seen = {};
  var result = [];
  for (var i = 0; i < tokens.length; i++) {
    var clean = normalizeWordForWs(tokens[i], umlautDirect);
    if (clean.length >= 2 && !seen[clean]) {
      seen[clean] = true;
      result.push(clean);
      if (result.length >= 150) break;
    }
  }
  return result;
}

function onWsSizeChange(val) {
  var sz = parseInt(val, 10);
  if (isNaN(sz)) return;
  appState.ws.size = Math.max(10, Math.min(35, sz));
  var lbl = document.getElementById('ws-size-label');
  if (lbl) lbl.textContent = `${appState.ws.size}×${appState.ws.size}`;
  generateWordSearch();
}

function onWsWordsInput() {
  var ta = document.getElementById('ws-words-input');
  if (!ta) return;
  appState.ws.wordsRaw = ta.value;
  updateWsWordCounter();
}

function updateWsWordCounter() {
  var counter = document.getElementById('ws-word-counter');
  if (!counter) return;
  var parsed = parseWsWords(appState.ws.wordsRaw, appState.ws.umlautDirect);
  counter.textContent = `${parsed.length} / 150`;
}

function onWsOptionsChange() {
  var dh = document.getElementById('dir-h');
  var dv = document.getElementById('dir-v');
  var dd = document.getElementById('dir-d');
  var dr = document.getElementById('dir-r');
  appState.ws.dirs = {
    h: dh ? dh.checked : true,
    v: dv ? dv.checked : true,
    d: dd ? dd.checked : true,
    r: dr ? dr.checked : false
  };
  if (!appState.ws.dirs.h && !appState.ws.dirs.v && !appState.ws.dirs.d) {
    appState.ws.dirs.h = true;
    if (dh) dh.checked = true;
  }
  generateWordSearch();
}

function onWsUmlautToggle() {
  var t = document.getElementById('ws-umlaut-toggle');
  appState.ws.umlautDirect = t ? t.checked : true;
  updateWsWordCounter();
  generateWordSearch();
}

function setWsCellZoom(val) {
  var z = parseInt(val, 10);
  if (isNaN(z)) return;
  appState.ws.cellZoom = z;
  var lbl = document.getElementById('ws-zoom-val');
  if (lbl) lbl.textContent = `${z} px`;
  renderWsGrid();
  renderWsOverlay();
  schedulePersist();
}

function buildAllowedVectors(dirs) {
  var vecs = [];
  if (dirs.h) {
    vecs.push([0, 1]);
    if (dirs.r) vecs.push([0, -1]);
  }
  if (dirs.v) {
    vecs.push([1, 0]);
    if (dirs.r) vecs.push([-1, 0]);
  }
  if (dirs.d) {
    vecs.push([1, 1]);
    vecs.push([-1, 1]);
    if (dirs.r) {
      vecs.push([-1, -1]);
      vecs.push([1, -1]);
    }
  }
  if (vecs.length === 0) vecs.push([0, 1]);
  return vecs;
}

/* Stellt sicher, dass jedes Wort genau einmal im Gitter vorkommt. Zufällige Füllbuchstaben werden
   bei Doppelfunden neu gewürfelt. Gibt false zurück, wenn ein Doppelfund nur aus Wortbuchstaben besteht. */
function wsMakeUnique(grid, n, placements, vectors, weights) {
  var isWord = [], r, c, k;
  for (r = 0; r < n; r++) isWord.push(new Array(n).fill(false));
  placements.forEach(function (pl) { for (k = 0; k < pl.word.length; k++) isWord[pl.sr + pl.dr * k][pl.sc + pl.dc * k] = true; });
  function cellsKey(cells) { return cells.map(function (x) { return x[0] * n + x[1]; }).sort(function (a, b) { return a - b; }).join(','); }
  for (var iter = 0; iter < 400; iter++) {
    var extras = [];
    placements.forEach(function (pl) {
      var w = pl.word, own = [];
      for (var q = 0; q < w.length; q++) own.push([pl.sr + pl.dr * q, pl.sc + pl.dc * q]);
      var ownKey = cellsKey(own), seen = {};
      for (var vi = 0; vi < vectors.length; vi++) {
        var dr = vectors[vi][0], dc = vectors[vi][1];
        for (var sr = 0; sr < n; sr++) for (var sc = 0; sc < n; sc++) {
          var er = sr + dr * (w.length - 1), ec = sc + dc * (w.length - 1);
          if (er < 0 || er >= n || ec < 0 || ec >= n) continue;
          var ok = true, cells = [];
          for (var t = 0; t < w.length; t++) { var rr = sr + dr * t, cc = sc + dc * t; if (grid[rr][cc] !== w[t]) { ok = false; break; } cells.push([rr, cc]); }
          if (!ok) continue;
          var key = cellsKey(cells);
          if (key === ownKey || seen[key]) continue;
          seen[key] = 1; extras.push(cells);
        }
      }
    });
    if (!extras.length) return true;
    var changed = false;
    for (var e = 0; e < extras.length; e++) {
      var fill = extras[e].filter(function (x) { return !isWord[x[0]][x[1]]; });
      if (!fill.length) return false;
      var pick = fill[Math.floor(Math.random() * fill.length)], old = grid[pick[0]][pick[1]], nl = old, tries = 0;
      while (nl === old && tries++ < 50) nl = weights[Math.floor(Math.random() * weights.length)];
      if (nl !== old) { grid[pick[0]][pick[1]] = nl; changed = true; }
    }
    if (!changed) return false;
  }
  return false;
}

/* Liefert alle platzierten Wörter, die noch an einer zweiten Stelle im Gitter stehen. */
function wsDuplicateWords(grid, n, placements, vectors) {
  var out = [];
  function key(cells) { return cells.sort(function (a, b) { return a - b; }).join(','); }
  placements.forEach(function (pl) {
    var w = pl.word, own = [], q;
    for (q = 0; q < w.length; q++) own.push((pl.sr + pl.dr * q) * n + pl.sc + pl.dc * q);
    var ownKey = key(own), dup = false;
    for (var vi = 0; vi < vectors.length && !dup; vi++) {
      var dr = vectors[vi][0], dc = vectors[vi][1];
      for (var sr = 0; sr < n && !dup; sr++) for (var sc = 0; sc < n && !dup; sc++) {
        var er = sr + dr * (w.length - 1), ec = sc + dc * (w.length - 1);
        if (er < 0 || er >= n || ec < 0 || ec >= n) continue;
        var ok = true, cells = [];
        for (var t = 0; t < w.length; t++) { var rr = sr + dr * t, cc = sc + dc * t; if (grid[rr][cc] !== w[t]) { ok = false; break; } cells.push(rr * n + cc); }
        if (ok && key(cells) !== ownKey) dup = true;
      }
    }
    if (dup) out.push(pl);
  });
  return out;
}

function generateWordSearch() {
  var ws = appState.ws;
  var n = ws.size;
  var words = parseWsWords(ws.wordsRaw, ws.umlautDirect);
  words.sort(function (a, b) { return b.length - a.length; });

  var grid = new Array(n);
  for (var r = 0; r < n; r++) {
    grid[r] = new Array(n).fill('');
  }

  var vectors = buildAllowedVectors(ws.dirs);
  var placements = [];
  var unplaced = [];

  var alpha = ws.umlautDirect ? 'ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÜ' : 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  var weights = ws.umlautDirect ? 'AAAAAAAAABCCCDDEEEEEEEEEEEFFGGGHHIIIIIIJJKKLLLMMMNNNNNNOOOOOOPPQRRRRRRSSSSSSTTTTTTUUUUVWWXYZZÄÖÜ' : alpha;
  /* Mehrere Versuche, bis jedes Wort garantiert genau einmal vorkommt */
  for (var attempt = 0, uniqueOk = false; attempt < 60 && !uniqueOk; attempt++) {
  for (var gr = 0; gr < n; gr++) grid[gr].fill('');
  placements = []; unplaced = [];
  for (var wi = 0; wi < words.length; wi++) {
    var word = words[wi];
    if (word.length > n) {
      unplaced.push(word);
      continue;
    }
    var candidates = [];
    for (var vi = 0; vi < vectors.length; vi++) {
      var dr = vectors[vi][0];
      var dc = vectors[vi][1];
      for (var sr = 0; sr < n; sr++) {
        var er = sr + dr * (word.length - 1);
        if (er < 0 || er >= n) continue;
        for (var sc = 0; sc < n; sc++) {
          var ec = sc + dc * (word.length - 1);
          if (ec < 0 || ec >= n) continue;
          var valid = true;
          var overlap = 0;
          for (var k = 0; k < word.length; k++) {
            var cr = sr + dr * k;
            var cc = sc + dc * k;
            var ch = grid[cr][cc];
            if (ch !== '' && ch !== word[k]) {
              valid = false;
              break;
            }
            if (ch === word[k]) overlap++;
          }
          if (valid) {
            candidates.push({ sr: sr, sc: sc, er: er, ec: ec, dr: dr, dc: dc, overlap: overlap });
          }
        }
      }
    }

    if (candidates.length === 0) {
      unplaced.push(word);
      continue;
    }

    /* Prefer intersections mildly, otherwise randomize */
    shuffleArray(candidates);
    candidates.sort(function (a, b) { return b.overlap - a.overlap; });
    var topPool = Math.min(candidates.length, 6);
    var chosen = candidates[Math.floor(Math.random() * topPool)];

    for (var p = 0; p < word.length; p++) {
      grid[chosen.sr + chosen.dr * p][chosen.sc + chosen.dc * p] = word[p];
    }
    placements.push({
      id: placements.length,
      word: word,
      sr: chosen.sr,
      sc: chosen.sc,
      er: chosen.er,
      ec: chosen.ec,
      dr: chosen.dr,
      dc: chosen.dc,
      colorIdx: placements.length % WS_HIGHLIGHT_HEX.length
    });
  }

  for (var fr = 0; fr < n; fr++) {
    for (var fc = 0; fc < n; fc++) {
      if (grid[fr][fc] === '') {
        grid[fr][fc] = weights[Math.floor(Math.random() * weights.length)];
      }
    }
  }

  uniqueOk = wsMakeUnique(grid, n, placements, vectors, weights);
  }

  /* Garantie: Jedes Wort der Liste steht genau einmal im Gitter. Lässt sich ein Doppelfund nicht durch andere
     Füllbuchstaben beseitigen (Wort steckt in einem anderen, zu viele kurze Wörter), fliegt das kürzeste betroffene
     Wort aus dem Rätsel und wird als nicht platziert gemeldet. */
  for (var guard = 0; guard < 300 && !uniqueOk; guard++) {
    var dups = wsDuplicateWords(grid, n, placements, vectors);
    if (!dups.length) { uniqueOk = true; break; }
    dups.sort(function (a, b) { return a.word.length - b.word.length; });
    var gone = dups[0];
    placements = placements.filter(function (pl) { return pl !== gone; });
    unplaced.push(gone.word);
    uniqueOk = wsMakeUnique(grid, n, placements, vectors, weights) && !wsDuplicateWords(grid, n, placements, vectors).length;
  }

  ws.grid = grid;
  ws.placements = placements;
  ws.unplaced = unplaced;
  ws.foundIds = [];
  ws.revealed = false;
  ws.startCell = null;

  ws.ambiguous = !uniqueOk;
  ws.contained = wsContainedWords(placements.map(function (pl) { return pl.word; }), !!ws.dirs.r);
  if (unplaced.length > 0) {
    showWsFeedback(`Hinweis: ${unplaced.length} Wort/Wörter konnten nicht eindeutig ins ${n}×${n}-Gitter gesetzt werden (${unplaced.slice(0, 4).join(', ')}${unplaced.length > 4 ? '…' : ''}).`, 'warning');
  } else if (ws.contained.length > 0) {
    showWsFeedback(`Hinweis: ${ws.contained.slice(0, 3).join(', ')}${ws.contained.length > 3 ? '…' : ''} steckt in einem anderen Wort der Liste und kommt deshalb mehrfach im Gitter vor.`, 'warning');
  } else if (ws.ambiguous) {
    showWsFeedback('Hinweis: Einzelne Wörter kommen mehrfach im Gitter vor. Weniger kurze Wörter oder ein größeres Gitter helfen.', 'warning');
  } else {
    hideWsFeedback();
  }

  renderWsAll();
  schedulePersist();
}

/* Wörter, die in einem anderen Wort der Liste stecken (z. B. ROSE in ROSEN, bei Rückwärts-Richtungen auch gespiegelt).
   Sie kommen im Gitter zwangsläufig mehrfach vor und können nicht eindeutig sein. */
function wsContainedWords(words, allowReverse) {
  var out = [];
  for (var i = 0; i < words.length; i++) {
    var w = words[i], rv = w.split('').reverse().join(''), hit = false;
    for (var j = 0; j < words.length && !hit; j++) {
      if (i === j || words[j].length < w.length) continue;
      if ((words[j].length > w.length && words[j].indexOf(w) >= 0) || (allowReverse && words[j].indexOf(rv) >= 0)) hit = true;
    }
    if (hit) out.push(w);
  }
  return out;
}

function renderWsAll() {
  renderWsRules();
  renderWsGrid();
  renderWsOverlay();
  renderWsWordlist();
  updateWsMeta();
  updateWsWordCounter();
}

function renderWsRules() {
  var ws = appState.ws;
  var badge = document.getElementById('ws-rule-badge');
  if (badge) {
    badge.textContent = `${ws.size}×${ws.size} · ${ws.umlautDirect ? 'Umlaute direkt' : 'Umlaute als AE/OE/UE'}`;
  }
  var list = document.getElementById('ws-rules-list');
  if (!list) return;
  list.innerHTML = '';
  var rules = getWsRules(ws.size, ws.umlautDirect, ws.dirs);
  rules.forEach(function (txt) {
    var li = document.createElement('li');
    li.textContent = txt;
    list.appendChild(li);
  });
}

function renderWsGrid() {
  var gridEl = document.getElementById('ws-grid');
  var stageEl = document.getElementById('ws-stage');
  if (!gridEl || !stageEl) return;
  var ws = appState.ws;
  var n = ws.size;
  var px = ws.cellZoom;

  gridEl.style.gridTemplateColumns = `repeat(${n}, ${px}px)`;
  gridEl.style.gridTemplateRows = `repeat(${n}, ${px}px)`;
  stageEl.style.width = `${n * px + 4}px`;
  stageEl.style.height = `${n * px + 4}px`;
  gridEl.innerHTML = '';

  var fontSize = Math.max(11, Math.round(px * 0.54));

  for (var r = 0; r < n; r++) {
    for (var c = 0; c < n; c++) {
      var cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'ws-cell';
      cell.style.fontSize = `${fontSize}px`;
      cell.setAttribute('role', 'gridcell');
      var letter = (ws.grid[r] && ws.grid[r][c]) ? ws.grid[r][c] : '';
      cell.textContent = letter;
      cell.setAttribute('aria-label', `Buchstabe ${letter} in Zeile ${r + 1}, Spalte ${c + 1}`);
      if (c === n - 1) cell.classList.add('ws-edge-right');
      if (r === n - 1) cell.classList.add('ws-edge-bottom');

      if (ws.startCell && ws.startCell.r === r && ws.startCell.c === c) {
        cell.classList.add('ws-start');
      }

      cell.dataset.r = String(r);
      cell.dataset.c = String(c);
      cell.onclick = onWsCellClick;
      gridEl.appendChild(cell);
    }
  }
}

/* 2-Click Selection System (Requirement 5) */
function onWsCellClick(e) {
  var btn = e.currentTarget;
  var r = parseInt(btn.dataset.r, 10);
  var c = parseInt(btn.dataset.c, 10);
  var ws = appState.ws;

  if (!ws.startCell) {
    ws.startCell = { r: r, c: c };
    renderWsGrid();
    showWsFeedback('Startbuchstabe gewählt — jetzt den letzten Buchstaben des Wortes antippen.', 'info');
    return;
  }

  /* Tapping the same start cell cancels selection */
  if (ws.startCell.r === r && ws.startCell.c === c) {
    ws.startCell = null;
    renderWsGrid();
    hideWsFeedback();
    return;
  }

  var r1 = ws.startCell.r;
  var c1 = ws.startCell.c;
  var dr = r - r1;
  var dc = c - c1;

  if (dr !== 0 && dc !== 0 && Math.abs(dr) !== Math.abs(dc)) {
    ws.startCell = { r: r, c: c };
    renderWsGrid();
    showWsFeedback('Keine gerade Linie. Neuer Startbuchstabe gesetzt — bitte Endbuchstaben waagerecht, senkrecht oder diagonal wählen.', 'warning');
    return;
  }

  var sr = Math.sign(dr);
  var sc = Math.sign(dc);
  var len = Math.max(Math.abs(dr), Math.abs(dc)) + 1;
  var picked = '';
  for (var k = 0; k < len; k++) {
    picked += ws.grid[r1 + sr * k][c1 + sc * k];
  }
  var pickedRev = picked.split('').reverse().join('');

  var matchedPlacement = null;
  for (var i = 0; i < ws.placements.length; i++) {
    var pl = ws.placements[i];
    if (ws.foundIds.indexOf(pl.id) !== -1) continue;
    var exactCoords = (pl.sr === r1 && pl.sc === c1 && pl.er === r && pl.ec === c) ||
                      (pl.sr === r && pl.sc === c && pl.er === r1 && pl.ec === c1);
    if (exactCoords || (picked.length === pl.word.length && (picked === pl.word || pickedRev === pl.word) && exactCoords)) {
      matchedPlacement = pl;
      break;
    }
  }

  /* Also allow matching if user found a duplicate occurrence of an unfound word in straight line */
  if (!matchedPlacement) {
    for (var j = 0; j < ws.placements.length; j++) {
      var pl2 = ws.placements[j];
      if (ws.foundIds.indexOf(pl2.id) !== -1) continue;
      if (picked === pl2.word || pickedRev === pl2.word) {
        matchedPlacement = {
          id: pl2.id,
          word: pl2.word,
          sr: r1, sc: c1, er: r, ec: c,
          colorIdx: pl2.colorIdx
        };
        pl2.sr = r1; pl2.sc = c1; pl2.er = r; pl2.ec = c;
        break;
      }
    }
  }

  ws.startCell = null;
  renderWsGrid();

  if (matchedPlacement) {
    ws.foundIds.push(matchedPlacement.id);
    renderWsOverlay();
    renderWsWordlist();
    updateWsMeta();
    schedulePersist();

    if (ws.foundIds.length === ws.placements.length) {
      showWsFeedback(`Alle ${ws.placements.length} Wörter erfolgreich gefunden!`, 'success');
    } else {
      showWsFeedback(`Gefunden: ${matchedPlacement.word} (${ws.foundIds.length} / ${ws.placements.length}).`, 'success');
    }
  } else {
    showWsFeedback(`„${picked}“ gehört nicht zu den gesuchten Wörtern.`, 'error');
  }
}

function renderWsOverlay() {
  var svg = document.getElementById('ws-svg-overlay');
  if (!svg) return;
  var ws = appState.ws;
  var n = ws.size;
  var px = ws.cellZoom;
  var totalSize = n * px + 4;
  svg.setAttribute('viewBox', `0 0 ${totalSize} ${totalSize}`);
  svg.innerHTML = '';

  var borderOffset = 2;
  var capsuleWidth = Math.max(12, px * 0.72);

  for (var i = 0; i < ws.placements.length; i++) {
    var pl = ws.placements[i];
    var isVisible = ws.revealed || ws.foundIds.indexOf(pl.id) !== -1;
    if (!isVisible) continue;

    var x1 = borderOffset + (pl.sc + 0.5) * px;
    var y1 = borderOffset + (pl.sr + 0.5) * px;
    var x2 = borderOffset + (pl.ec + 0.5) * px;
    var y2 = borderOffset + (pl.er + 0.5) * px;
    var color = WS_HIGHLIGHT_HEX[pl.colorIdx % WS_HIGHLIGHT_HEX.length];

    var line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', String(x1));
    line.setAttribute('y1', String(y1));
    line.setAttribute('x2', String(x2));
    line.setAttribute('y2', String(y2));
    line.setAttribute('stroke', color);
    line.setAttribute('stroke-width', String(capsuleWidth));
    line.setAttribute('stroke-linecap', 'round');
    line.setAttribute('stroke-opacity', '0.36');
    svg.appendChild(line);
  }
}

function renderWsWordlist() {
  var listEl = document.getElementById('ws-wordlist');
  if (!listEl) return;
  var ws = appState.ws;
  listEl.innerHTML = '';

  if (ws.placements.length === 0) {
    var empty = document.createElement('span');
    empty.className = 'label';
    empty.textContent = 'Keine gültigen Wörter im Gitter platziert. Geben Sie mindestens ein Wort (mind. 2 Buchstaben) ein.';
    listEl.appendChild(empty);
    return;
  }

  var sorted = ws.placements.slice().sort(function (a, b) {
    return a.word.localeCompare(b.word, 'de');
  });

  for (var i = 0; i < sorted.length; i++) {
    var pl = sorted[i];
    var isFound = ws.foundIds.indexOf(pl.id) !== -1;
    var isActive = isFound || ws.revealed;
    var hex = WS_HIGHLIGHT_HEX[pl.colorIdx % WS_HIGHLIGHT_HEX.length];

    var chip = document.createElement('span');
    chip.className = 'ws-word-chip' + (isFound ? ' found' : '');
    if (isActive) {
      chip.style.borderColor = hex;
      chip.style.backgroundColor = hex + '24';
    }

    var dot = document.createElement('span');
    dot.className = 'ws-color-dot';
    dot.style.backgroundColor = hex;

    var txt = document.createElement('span');
    txt.textContent = pl.word;

    chip.appendChild(dot);
    chip.appendChild(txt);
    listEl.appendChild(chip);
  }
}

function updateWsMeta() {
  var ws = appState.ws;
  var cnt = document.getElementById('ws-count-tag');
  if (cnt) cnt.textContent = `${ws.foundIds.length} / ${ws.placements.length} Wörter gefunden`;
  var placed = document.getElementById('ws-placed-stat');
  if (placed) placed.textContent = `${ws.placements.length} Wörter im Gitter`;
  var revBtn = document.getElementById('btn-ws-reveal');
  if (revBtn) {
    var svgHtml = '<svg class="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>';
    revBtn.innerHTML = svgHtml + (ws.revealed ? 'Lösung ausblenden' : 'Lösung anzeigen');
  }
}

function toggleWsSolution() {
  appState.ws.revealed = !appState.ws.revealed;
  appState.ws.startCell = null;
  renderWsGrid();
  renderWsOverlay();
  renderWsWordlist();
  updateWsMeta();
  schedulePersist();
  if (appState.ws.revealed) {
    showWsFeedback('Die Lösung ist eingeblendet. Die Wörter sind im Gitter farbig markiert.', 'info');
  } else {
    hideWsFeedback();
  }
}

function resetWsProgress() {
  appState.ws.foundIds = [];
  appState.ws.revealed = false;
  appState.ws.startCell = null;
  hideWsFeedback();
  renderWsGrid();
  renderWsOverlay();
  renderWsWordlist();
  updateWsMeta();
  schedulePersist();
}

function showWsFeedback(msg, kind) {
  var box = document.getElementById('ws-feedback');
  var txt = document.getElementById('ws-feedback-text');
  if (!box || !txt) return;
  box.className = `feedback-banner ${kind || 'info'}`;
  txt.textContent = msg;
}

function hideWsFeedback() {
  var box = document.getElementById('ws-feedback');
  if (box) box.classList.add('hidden');
}
