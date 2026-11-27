/* ======================================================================
   Druckfenster und A4-Vektorlayout
   Arbeitsblatt, Lösungsblatt, Überdruck und PNG-Export für Sudoku und Suchsel.
   ====================================================================== */

function openPrintModal() {
  var modal = document.getElementById('print-modal');
  if (!modal) return;
  printModalOpener = document.activeElement || null;
  modal.setAttribute('data-open', 'true');
  if (typeof rsApplyAbDefaults === 'function') rsApplyAbDefaults();
  updatePrintModalModeUI();
  renderPrintPreview();
  var closeBtn = modal.querySelector('.modal-header .btn');
  if (closeBtn) closeBtn.focus();
}

var printModalOpener = null;

function closePrintModal() {
  var modal = document.getElementById('print-modal');
  if (!modal) return;
  modal.setAttribute('data-open', 'false');
  if (printModalOpener && typeof printModalOpener.focus === 'function' && document.body.contains(printModalOpener)) {
    printModalOpener.focus();
  }
  printModalOpener = null;
}

function onModalBackdropClick(e) {
  if (e.target && e.target.id === 'print-modal') {
    closePrintModal();
  }
}

function updatePrintModalModeUI() {
  /* Requirement 2: Multi-Print strictly visible ONLY for Sudoku, hidden completely for Suchsel */
  var multiGroup = document.getElementById('print-multi-group');
  if (multiGroup) {
    multiGroup.classList.toggle('hidden', appState.mode !== 'sudoku');
  }
  updateMultiPrintWarning();
  updatePreviewToolbarUI();
}

function updateMultiPrintWarning() {
  var warn = document.getElementById('print-multi-warning');
  if (!warn) return;
  var show = appState.mode === 'sudoku' && appState.print.multiPrint === 4 && appState.sudoku.size > 10;
  warn.classList.toggle('hidden', !show);
}

function onPrintSettingChange() {
  var nameIn = document.getElementById('print-name');
  var dateIn = document.getElementById('print-date');
  var marginIn = document.getElementById('print-margin');
  var instrIn = document.getElementById('print-instr-size');

  if (nameIn) { if (nameIn.value !== appState.print.name) rsAbTouched.name = true; appState.print.name = nameIn.value; }
  if (dateIn) { if (dateIn.value !== appState.print.date) rsAbTouched.date = true; appState.print.date = dateIn.value; }
  if (marginIn) appState.print.marginMm = parseFloat(marginIn.value);
  if (instrIn) appState.print.instrPt = parseFloat(instrIn.value);

  var mVal = document.getElementById('print-margin-val');
  if (mVal) mVal.textContent = `${appState.print.marginMm} mm`;
  var iVal = document.getElementById('print-instr-val');
  if (iVal) iVal.textContent = `${appState.print.instrPt} pt`;

  renderPrintPreview();
  schedulePersist();
}

function setMultiPrint(count) {
  appState.print.multiPrint = count;
  var btns = document.querySelectorAll('#print-multi-group .seg-btn');
  btns.forEach(function (b) {
    b.setAttribute('aria-pressed', parseInt(b.dataset.multi, 10) === count ? 'true' : 'false');
  });
  if (count > 1) ensureSudokuExtraPuzzles(count);
  updateMultiPrintWarning();
  renderPrintPreview();
  schedulePersist();
}

function setSolutionMode(mode) {
  appState.print.solutionMode = mode === 'overprint' ? 'overprint' : 'standard';
  var cStd = document.getElementById('opt-card-standard');
  var cOvp = document.getElementById('opt-card-overprint');
  if (cStd) cStd.setAttribute('data-selected', appState.print.solutionMode === 'standard' ? 'true' : 'false');
  if (cOvp) cOvp.setAttribute('data-selected', appState.print.solutionMode === 'overprint' ? 'true' : 'false');

  var radios = document.querySelectorAll('input[name="solutionMode"]');
  radios.forEach(function (r) {
    r.checked = r.value === appState.print.solutionMode;
  });

  if (appState.print.solutionMode === 'overprint' && appState.print.previewSheet === 'sheet2') {
    appState.print.previewSheet = 'overprint';
  } else if (appState.print.solutionMode === 'standard' && appState.print.previewSheet === 'overprint') {
    appState.print.previewSheet = 'sheet2';
  }

  updatePreviewToolbarUI();
  renderPrintPreview();
  schedulePersist();
}

function setPreviewSheet(sheet) {
  appState.print.previewSheet = sheet;
  updatePreviewToolbarUI();
  renderPrintPreview();
}

/* Labyrinth: keine Überdruck-Lösung (bei allen anderen Rätseln bleibt sie) */
function noOvpMode() { return ['labyrinth', 'hitori'].indexOf(appState.mode) >= 0; }
function applyOverprintAvailability() {
  var noOvp = noOvpMode();
  if (noOvp) {
    if (appState.print.solutionMode === 'overprint') appState.print.solutionMode = 'standard';
    if (appState.print.previewSheet === 'overprint') appState.print.previewSheet = 'sheet2';
    var cS = document.getElementById('opt-card-standard'), cO = document.getElementById('opt-card-overprint');
    if (cS) cS.setAttribute('data-selected', 'true');
    if (cO) cO.setAttribute('data-selected', 'false');
    document.querySelectorAll('input[name="solutionMode"]').forEach(function (r) { r.checked = r.value === 'standard'; });
  }
  var sel = ['#solution-option-group', '#opt-card-overprint', '#overprint-guide-box', '#prev-btn-overprint', '.overprint-action-row'];
  sel.forEach(function (q) { document.querySelectorAll(q).forEach(function (el) { el.style.display = noOvp ? 'none' : ''; }); });
}

function updatePreviewToolbarUI() {
  applyOverprintAvailability();
  var cur = appState.print.previewSheet;
  var b1 = document.getElementById('prev-btn-sheet1');
  var b2 = document.getElementById('prev-btn-sheet2');
  var b3 = document.getElementById('prev-btn-overprint');
  if (b1) b1.setAttribute('aria-pressed', cur === 'sheet1' ? 'true' : 'false');
  if (b2) b2.setAttribute('aria-pressed', cur === 'sheet2' ? 'true' : 'false');
  if (b3) b3.setAttribute('aria-pressed', cur === 'overprint' ? 'true' : 'false');

  var ghostWrap = document.getElementById('preview-ghost-wrap');
  if (ghostWrap) {
    ghostWrap.classList.toggle('hidden', cur !== 'overprint');
  }

  var sheetBox = document.getElementById('a4-sheet-box');
  if (sheetBox) {
    sheetBox.classList.toggle('transparent-sheet', cur === 'overprint');
  }
}

/* Word wrapping helper for SVG text */
function wrapTextLines(text, maxChars) {
  var words = text.split(' ');
  var lines = [];
  var current = '';
  for (var i = 0; i < words.length; i++) {
    var test = current ? `${current} ${words[i]}` : words[i];
    if (test.length > maxChars && current) {
      lines.push(current);
      current = words[i];
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function escapeXml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* Core A4 Vector SVG Generator (210mm x 297mm)
   Guarantees identical coordinates between Blatt 1, Blatt 2, and Overprint */
function buildA4SvgString(sheetType, includeGhostGuides) {
  var p = appState.print;
  var margin = p.marginMm;
  var pageW = 210;
  var pageH = 297;
  var contentW = pageW - 2 * margin;
  var contentH = pageH - 2 * margin;

  var isOverprint = sheetType === 'overprint';
  var isSolution = sheetType === 'sheet2' || isOverprint;
  var drawBaseElements = !isOverprint;
  var drawGhost = isOverprint && includeGhostGuides;

  var svgParts = [];
  svgParts.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${pageW} ${pageH}" width="100%" height="100%">`);

  /* Paper background */
  if (!isOverprint) {
    svgParts.push(`<rect x="0" y="0" width="${pageW}" height="${pageH}" fill="#ffffff"/>`);
  }

  /* Bold Ghost Margin Frame when alignment guides active (Requirement 4) */
  if (drawGhost) {
    svgParts.push(`<rect x="${margin}" y="${margin}" width="${contentW}" height="${contentH}" fill="none" stroke="${PRINT_PALETTE.ghostBold}" stroke-width="0.65" stroke-dasharray="3.2,2.2" opacity="0.72"/>`);
    /* Corner registration crosshairs */
    var tick = 4.5;
    svgParts.push(`<path d="M${margin - 2} ${margin}h${tick} M${margin} ${margin - 2}v${tick}" stroke="${PRINT_PALETTE.ghostBold}" stroke-width="0.7" opacity="0.85"/>`);
    svgParts.push(`<path d="M${pageW - margin + 2} ${margin}h-${tick} M${pageW - margin} ${margin - 2}v${tick}" stroke="${PRINT_PALETTE.ghostBold}" stroke-width="0.7" opacity="0.85"/>`);
    svgParts.push(`<path d="M${margin - 2} ${pageH - margin}h${tick} M${margin} ${pageH - margin + 2}v-${tick}" stroke="${PRINT_PALETTE.ghostBold}" stroke-width="0.7" opacity="0.85"/>`);
    svgParts.push(`<path d="M${pageW - margin + 2} ${pageH - margin}h-${tick} M${pageW - margin} ${pageH - margin + 2}v-${tick}" stroke="${PRINT_PALETTE.ghostBold}" stroke-width="0.7" opacity="0.85"/>`);
  }

  /* Header metrics (strictly inside safe top margin so top edge NEVER clips - Requirement 3) */
  var curY = margin + 4.5;
  var titleText = '';
  var metaTag = '';
  if (appState.mode === 'sudoku') {
    var s = appState.sudoku;
    titleText = sheetType === 'sheet2' ? `Sudoku ${s.size}×${s.size} — Lösungsblatt` : `Sudoku ${s.size}×${s.size}`;
    metaTag = `Schwierigkeit: ${(DIFF_CONFIG[s.difficulty] || DIFF_CONFIG.leicht).label}`;
  } else {
    var ws = appState.ws;
    titleText = sheetType === 'sheet2' ? `Suchsel ${ws.size}×${ws.size} — Lösungsblatt` : `Suchsel ${ws.size}×${ws.size}`;
    metaTag = `${ws.placements.length} versteckte Wörter`;
  }

  var nameStr = p.name.trim();
  var dateStr = p.date.trim();

  if (drawBaseElements || drawGhost) {
    var hStroke = drawGhost ? PRINT_PALETTE.ghostBold : PRINT_PALETTE.ink;
    var hSub = drawGhost ? PRINT_PALETTE.ghostGrid : PRINT_PALETTE.muted;
    var hOpacity = drawGhost ? ' opacity="0.65"' : '';
    var ruleW = drawGhost ? '0.55' : '0.35';

    svgParts.push(`<g${hOpacity} font-family="Outfit, Hanken Grotesk, sans-serif">`);
    svgParts.push(`<text x="${margin}" y="${curY}" font-size="6.2" font-weight="600" fill="${hStroke}">${escapeXml(titleText)}</text>`);
    svgParts.push(`<text x="${pageW - margin}" y="${curY}" font-size="3.6" font-weight="500" fill="${hSub}" text-anchor="end">${escapeXml(metaTag)}</text>`);

    curY += 6.5;
    /* Name & Datum row */
    svgParts.push(`<text x="${margin}" y="${curY}" font-size="3.4" font-weight="500" fill="${hSub}">Name:</text>`);
    if (nameStr) {
      svgParts.push(`<text x="${margin + 12}" y="${curY}" font-size="3.6" font-weight="600" fill="${hStroke}">${escapeXml(nameStr)}</text>`);
    } else {
      svgParts.push(`<line x1="${margin + 12}" y1="${curY + 0.5}" x2="${margin + 88}" y2="${curY + 0.5}" stroke="${hSub}" stroke-width="0.4"/>`);
    }

    svgParts.push(`<text x="${pageW - margin - 46}" y="${curY}" font-size="3.4" font-weight="500" fill="${hSub}">Datum:</text>`);
    if (dateStr) {
      svgParts.push(`<text x="${pageW - margin - 32}" y="${curY}" font-size="3.6" font-weight="600" fill="${hStroke}">${escapeXml(dateStr)}</text>`);
    } else {
      svgParts.push(`<line x1="${pageW - margin - 32}" y1="${curY + 0.5}" x2="${pageW - margin}" y2="${curY + 0.5}" stroke="${hSub}" stroke-width="0.4"/>`);
    }

    curY += 3.5;
    svgParts.push(`<line x1="${margin}" y1="${curY}" x2="${pageW - margin}" y2="${curY}" stroke="${hStroke}" stroke-width="${ruleW}"/>`);
    svgParts.push(`</g>`);
  } else {
    /* Overprint without ghost still advances identical vertical coordinates! */
    curY += 10;
  }

  curY += 5.0;

  /* Instructions (Requirement 8: exact same text as online game mode!) */
  var instrList = appState.mode === 'sudoku'
    ? getSudokuRules(appState.sudoku.size, appState.sudoku.subR, appState.sudoku.subC)
    : getWsRules(appState.ws.size, appState.ws.umlautDirect, appState.ws.dirs);

  var instrPt = p.instrPt;
  var instrMm = instrPt * 0.3528;
  var lineStep = instrMm * 1.38;
  var approxCharsPerLine = Math.floor(contentW / (instrMm * 0.48));

  var instrLinesAll = [];
  for (var ii = 0; ii < instrList.length; ii++) {
    var wrapped = wrapTextLines(`${ii + 1}. ${instrList[ii]}`, approxCharsPerLine);
    for (var wl = 0; wl < wrapped.length; wl++) {
      instrLinesAll.push(wrapped[wl]);
    }
  }

  if (drawBaseElements || drawGhost) {
    var iFill = drawGhost ? PRINT_PALETTE.ghostGrid : PRINT_PALETTE.muted;
    var iOp = drawGhost ? ' opacity="0.65"' : '';
    svgParts.push(`<g${iOp} font-family="Hanken Grotesk, sans-serif" font-size="${instrMm.toFixed(2)}" fill="${iFill}">`);
    for (var il = 0; il < instrLinesAll.length; il++) {
      svgParts.push(`<text x="${margin}" y="${(curY + il * lineStep).toFixed(2)}">${escapeXml(instrLinesAll[il])}</text>`);
    }
    svgParts.push(`</g>`);
  }

  curY += instrLinesAll.length * lineStep + 4.5;

  /* Available Puzzle Area */
  var footerReserve = 7;
  var availH = pageH - margin - footerReserve - curY;

  if (appState.mode === 'sudoku') {
    var multi = p.multiPrint || 1;
    if (multi > 1) ensureSudokuExtraPuzzles(multi);
    var su = appState.sudoku;
    var n = su.size;

    var colsCount = multi === 1 ? 1 : 2;
    var rowsCount = multi === 4 ? 2 : 1;
    var slotGap = multi === 1 ? 0 : 8;
    var slotW = (contentW - (colsCount - 1) * slotGap) / colsCount;
    var slotH = (availH - (rowsCount - 1) * slotGap) / rowsCount;
    var labelReserve = multi > 1 ? 5.5 : 0;
    var boardSize = Math.min(slotW, slotH - labelReserve);

    for (var idx = 0; idx < multi; idx++) {
      var srIdx = Math.floor(idx / colsCount);
      var scIdx = idx % colsCount;
      var slotX = margin + scIdx * (slotW + slotGap) + (slotW - boardSize) / 2;
      var slotY = curY + srIdx * (slotH + slotGap);

      if (multi > 1 && (drawBaseElements || drawGhost)) {
        var lblCol = drawGhost ? PRINT_PALETTE.ghostBold : PRINT_PALETTE.muted;
        var lblOp = drawGhost ? ' opacity="0.7"' : '';
        svgParts.push(`<text x="${slotX}" y="${(slotY + 3.2).toFixed(2)}" font-family="Outfit, sans-serif" font-size="3.2" font-weight="600" fill="${lblCol}"${lblOp}>Rätsel ${idx + 1}</text>`);
      }
      var gridY = slotY + labelReserve;
      var pData = idx === 0 ? { solution: su.solution, givens: su.givens } : su.extraPuzzles[idx - 1];
      svgParts.push(renderSudokuPrintGrid(slotX, gridY, boardSize, n, su.subR, su.subC, pData, isSolution, drawBaseElements, drawGhost));
    }
  } else {
    /* Wortsuche / Suchsel: 1 per page + Wordlist below grid */
    var ws = appState.ws;
    var wn = ws.size;
    var wordCount = ws.placements.length;
    var wordCols = wordCount > 45 ? 4 : (wordCount > 16 ? 3 : 2);
    var wordRows = Math.max(1, Math.ceil(wordCount / wordCols));
    var wordLineH = wordCount > 60 ? 3.8 : 4.8;
    var wordListH = Math.min(availH * 0.44, wordRows * wordLineH + 10);
    var maxGridH = availH - wordListH - 6;
    var wsBoardSize = Math.min(contentW, maxGridH);
    var wsX = margin + (contentW - wsBoardSize) / 2;
    var wsY = curY;

    svgParts.push(renderWsPrintGrid(wsX, wsY, wsBoardSize, ws, isSolution, drawBaseElements, drawGhost));

    /* Wordlist section below grid */
    var wlY = wsY + wsBoardSize + 7;
    if (drawBaseElements || drawGhost) {
      var wlCol = drawGhost ? PRINT_PALETTE.ghostBold : PRINT_PALETTE.ink;
      var wlSub = drawGhost ? PRINT_PALETTE.ghostGrid : PRINT_PALETTE.muted;
      var wlOp = drawGhost ? ' opacity="0.68"' : '';
      svgParts.push(`<g${wlOp} font-family="Outfit, Hanken Grotesk, sans-serif">`);
      svgParts.push(`<text x="${margin}" y="${wlY.toFixed(2)}" font-size="3.6" font-weight="600" fill="${wlCol}">Zu suchende Wörter (${wordCount}):</text>`);
      var sortedWords = ws.placements.slice().sort(function (a, b) {
        return a.word.localeCompare(b.word, 'de');
      });
      var colW = contentW / wordCols;
      var wordFontSize = wordCount > 60 ? 2.8 : 3.3;
      for (var wi = 0; wi < sortedWords.length; wi++) {
        var wItem = sortedWords[wi];
        var wc = wi % wordCols;
        var wr = Math.floor(wi / wordCols);
        var wx = margin + wc * colW;
        var wy = wlY + 5 + wr * wordLineH;
        if (wy > pageH - margin - 2) break;
        if (isSolution && !drawGhost) {
          var dotColor = WS_HIGHLIGHT_HEX[wItem.colorIdx % WS_HIGHLIGHT_HEX.length];
          svgParts.push(`<circle cx="${(wx + 1.4).toFixed(2)}" cy="${(wy - 1.0).toFixed(2)}" r="1.15" fill="${dotColor}"/>`);
          svgParts.push(`<text x="${(wx + 3.8).toFixed(2)}" y="${wy.toFixed(2)}" font-size="${wordFontSize}" font-weight="500" fill="${wlSub}">${escapeXml(wItem.word)}</text>`);
        } else {
          svgParts.push(`<text x="${wx.toFixed(2)}" y="${wy.toFixed(2)}" font-size="${wordFontSize}" font-weight="500" fill="${wlSub}">${escapeXml(wItem.word)}</text>`);
        }
      }
      svgParts.push(`</g>`);
    }
  }

  /* Footer line */
  if (drawBaseElements) {
    var footLabel = sheetType === 'sheet2' ? 'Lösungsblatt' : 'Arbeitsblatt';
    svgParts.push(`<text x="${pageW / 2}" y="${(pageH - margin + 2).toFixed(2)}" font-family="Outfit, sans-serif" font-size="2.7" fill="${PRINT_PALETTE.muted}" text-anchor="middle">${footLabel}${appState.print.showLink === false ? '' : ' · raetslio.github.io'}</text>`);
  }

  svgParts.push(`</svg>`);
  return svgParts.join('');
}

function renderSudokuPrintGrid(gx, gy, sizeMm, n, subR, subC, pData, isSolution, drawBase, drawGhost) {
  var parts = [];
  var cellMm = sizeMm / n;
  var hasBoxes = subR > 1 && subC > 1;
  var fontSize = n >= 10 ? Math.max(1.8, cellMm * 0.44) : Math.max(2.2, cellMm * 0.56);

  /* Base cell fills and gridlines */
  if (drawBase || drawGhost) {
    var gOp = drawGhost ? ' opacity="0.65"' : '';
    var thinStroke = drawGhost ? PRINT_PALETTE.ghostGrid : PRINT_PALETTE.ruleLight;
    var strongStroke = drawGhost ? PRINT_PALETTE.ghostBold : PRINT_PALETTE.ruleStrong;
    var thinW = drawGhost ? '0.28' : '0.18';
    var strongW = drawGhost ? '0.68' : '0.48';

    parts.push(`<g${gOp}>`);
    if (drawBase) {
      for (var r = 0; r < n; r++) {
        for (var c = 0; c < n; c++) {
          if (pData.givens[r][c] > 0) {
            parts.push(`<rect x="${(gx + c * cellMm).toFixed(3)}" y="${(gy + r * cellMm).toFixed(3)}" width="${cellMm.toFixed(3)}" height="${cellMm.toFixed(3)}" fill="${PRINT_PALETTE.givenBg}"/>`);
          }
        }
      }
    }

    /* Thin inner grid lines */
    for (var i = 1; i < n; i++) {
      var isBoxV = hasBoxes && (i % subC === 0);
      var isBoxH = hasBoxes && (i % subR === 0);
      var vx = (gx + i * cellMm).toFixed(3);
      var hy = (gy + i * cellMm).toFixed(3);
      parts.push(`<line x1="${vx}" y1="${gy.toFixed(3)}" x2="${vx}" y2="${(gy + sizeMm).toFixed(3)}" stroke="${isBoxV ? strongStroke : thinStroke}" stroke-width="${isBoxV ? strongW : thinW}"/>`);
      parts.push(`<line x1="${gx.toFixed(3)}" y1="${hy}" x2="${(gx + sizeMm).toFixed(3)}" y2="${hy}" stroke="${isBoxH ? strongStroke : thinStroke}" stroke-width="${isBoxH ? strongW : thinW}"/>`);
    }

    /* Outer border */
    parts.push(`<rect x="${gx.toFixed(3)}" y="${gy.toFixed(3)}" width="${sizeMm.toFixed(3)}" height="${sizeMm.toFixed(3)}" fill="none" stroke="${strongStroke}" stroke-width="${strongW}"/>`);

    /* Given digits */
    var givenInk = drawGhost ? PRINT_PALETTE.ghostBold : PRINT_PALETTE.ink;
    parts.push(`<g font-family="Outfit, sans-serif" font-size="${fontSize.toFixed(2)}" font-weight="700" fill="${givenInk}" text-anchor="middle" dominant-baseline="central">`);
    for (var gr = 0; gr < n; gr++) {
      for (var gc = 0; gc < n; gc++) {
        var gv = pData.givens[gr][gc];
        if (gv > 0) {
          var cx = (gx + (gc + 0.5) * cellMm).toFixed(3);
          var cy = (gy + (gr + 0.5) * cellMm).toFixed(3);
          parts.push(`<text x="${cx}" y="${cy}">${gv}</text>`);
        }
      }
    }
    parts.push(`</g></g>`);
  }

  /* Solution digits (only non-givens) */
  if (isSolution) {
    parts.push(`<g font-family="Outfit, sans-serif" font-size="${fontSize.toFixed(2)}" font-weight="600" fill="${PRINT_PALETTE.solutionInk}" text-anchor="middle" dominant-baseline="central">`);
    for (var sr = 0; sr < n; sr++) {
      for (var sc = 0; sc < n; sc++) {
        if (pData.givens[sr][sc] === 0) {
          var sv = pData.solution[sr][sc];
          var sx = (gx + (sc + 0.5) * cellMm).toFixed(3);
          var sy = (gy + (sr + 0.5) * cellMm).toFixed(3);
          parts.push(`<text x="${sx}" y="${sy}">${sv}</text>`);
        }
      }
    }
    parts.push(`</g>`);
  }

  return parts.join('');
}

function renderWsPrintGrid(gx, gy, sizeMm, ws, isSolution, drawBase, drawGhost) {
  var parts = [];
  var n = ws.size;
  var cellMm = sizeMm / n;
  var fontSize = Math.max(2.0, cellMm * 0.54);

  /* Colored capsule highlights (Requirement 6: exact same colors as online!) */
  if (isSolution) {
    var capWidth = cellMm * 0.72;
    parts.push(`<g>`);
    for (var pi = 0; pi < ws.placements.length; pi++) {
      var pl = ws.placements[pi];
      var x1 = (gx + (pl.sc + 0.5) * cellMm).toFixed(3);
      var y1 = (gy + (pl.sr + 0.5) * cellMm).toFixed(3);
      var x2 = (gx + (pl.ec + 0.5) * cellMm).toFixed(3);
      var y2 = (gy + (pl.er + 0.5) * cellMm).toFixed(3);
      var hex = WS_HIGHLIGHT_HEX[pl.colorIdx % WS_HIGHLIGHT_HEX.length];
      parts.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${hex}" stroke-width="${capWidth.toFixed(3)}" stroke-linecap="round" stroke-opacity="0.38"/>`);
    }
    parts.push(`</g>`);
  }

  if (drawBase || drawGhost) {
    var gOp = drawGhost ? ' opacity="0.65"' : '';
    var gridCol = drawGhost ? PRINT_PALETTE.ghostGrid : PRINT_PALETTE.ruleLight;
    var borderCol = drawGhost ? PRINT_PALETTE.ghostBold : PRINT_PALETTE.ruleStrong;
    var gridW = drawGhost ? '0.28' : '0.16';
    var borderW = drawGhost ? '0.68' : '0.45';
    var letterCol = drawGhost ? PRINT_PALETTE.ghostBold : PRINT_PALETTE.ink;

    parts.push(`<g${gOp}>`);
    for (var i = 1; i < n; i++) {
      var vx = (gx + i * cellMm).toFixed(3);
      var hy = (gy + i * cellMm).toFixed(3);
      parts.push(`<line x1="${vx}" y1="${gy.toFixed(3)}" x2="${vx}" y2="${(gy + sizeMm).toFixed(3)}" stroke="${gridCol}" stroke-width="${gridW}"/>`);
      parts.push(`<line x1="${gx.toFixed(3)}" y1="${hy}" x2="${(gx + sizeMm).toFixed(3)}" y2="${hy}" stroke="${gridCol}" stroke-width="${gridW}"/>`);
    }
    parts.push(`<rect x="${gx.toFixed(3)}" y="${gy.toFixed(3)}" width="${sizeMm.toFixed(3)}" height="${sizeMm.toFixed(3)}" fill="none" stroke="${borderCol}" stroke-width="${borderW}"/>`);

    parts.push(`<g font-family="Outfit, sans-serif" font-size="${fontSize.toFixed(2)}" font-weight="600" fill="${letterCol}" text-anchor="middle" dominant-baseline="central">`);
    for (var r = 0; r < n; r++) {
      for (var c = 0; c < n; c++) {
        var ch = ws.grid[r] && ws.grid[r][c] ? ws.grid[r][c] : '';
        var cx = (gx + (c + 0.5) * cellMm).toFixed(3);
        var cy = (gy + (r + 0.5) * cellMm).toFixed(3);
        parts.push(`<text x="${cx}" y="${cy}">${escapeXml(ch)}</text>`);
      }
    }
    parts.push(`</g></g>`);
  }

  return parts.join('');
}

function renderPrintPreview() {
  var box = document.getElementById('a4-sheet-box');
  if (!box) return;
  var ghostCheck = document.getElementById('preview-ghost-check');
  var includeGhost = ghostCheck ? ghostCheck.checked : false;
  try {
    box.innerHTML = buildA4SvgString(appState.print.previewSheet, includeGhost);
  } catch (e) {
    /* Beim Start können Rätseldaten noch fehlen – die Vorschau wird beim Öffnen des Druckfensters neu gezeichnet */
    box.innerHTML = '';
  }
}

function showPrintExportStatus(msg, kind) {
  var el = document.getElementById('print-export-status');
  if (!el) return;
  el.className = `feedback-banner ${kind || 'info'}`;
  el.textContent = msg;
}

function executePdfPrint(mode) {
  if (mode === 'overprint' && noOvpMode()) return;
  var container = document.getElementById('print-output-container');
  if (!container) return;
  container.innerHTML = '';

  var sheetsToPrint = [];
  if (mode === 'overprint') {
    sheetsToPrint.push('overprint');
  } else {
    sheetsToPrint.push('sheet1');
    sheetsToPrint.push(appState.print.solutionMode === 'overprint' ? 'overprint' : 'sheet2');
  }

  sheetsToPrint.forEach(function (st) {
    var pageDiv = document.createElement('div');
    pageDiv.className = 'print-page-sheet';
    /* Ghost guidelines are NEVER printed (only preview) */
    pageDiv.innerHTML = buildA4SvgString(st, false);
    container.appendChild(pageDiv);
  });

  try {
    window.print();
    showPrintExportStatus('Druckdialog wurde geöffnet. Für den Überdruck bitte „Tatsächliche Größe“ (100 %) wählen.', 'info');
  } catch (e) {
    showPrintExportStatus('Direktdruck wird in dieser Vorschauumgebung blockiert — nutzen Sie stattdessen den PNG-Export.', 'warning');
  }
}

function downloadSheetPng(sheetType) {
  if (sheetType === 'overprint' && noOvpMode()) return;
  /* Render crisp 300-DPI-proportion A4 PNG (1654 x 2339 px) */
  var w = 1654;
  var h = 2339;
  var svgMarkup = buildA4SvgString(sheetType, false);
  var svgDataUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgMarkup);

  var img = new Image();
  img.onload = function () {
    var canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    var ctx = canvas.getContext('2d');
    if (sheetType !== 'overprint') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
    } else {
      ctx.clearRect(0, 0, w, h);
    }
    ctx.drawImage(img, 0, 0, w, h);
    var pngUrl = canvas.toDataURL('image/png');
    var base64Data = pngUrl.split(',')[1];
    var prefix = (window.extPrintPrefix && window.extPrintPrefix()) || (appState.mode === 'sudoku' ? `sudoku_${appState.sudoku.size}x${appState.sudoku.size}` : `suchsel_${appState.ws.size}x${appState.ws.size}`);
    var suffix = sheetType === 'sheet1' ? 'arbeitsblatt' : (sheetType === 'sheet2' ? 'loesung' : 'ueberdruck');
    var filename = `${prefix}_${suffix}.png`;

    if (window.notebookAppApi && typeof window.notebookAppApi.triggerFileDownload === 'function') {
      window.notebookAppApi.triggerFileDownload({
        content: base64Data,
        contentType: 'image/png',
        encoding: 'base64',
        filename: filename
      });
    } else {
      var a = document.createElement('a');
      a.href = pngUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
    showPrintExportStatus(`Datei „${filename}“ wurde erfolgreich exportiert.`, 'success');
  };
  img.onerror = function () {
    showPrintExportStatus('PNG-Export konnte nicht erzeugt werden.', 'error');
  };
  img.src = svgDataUrl;
}
