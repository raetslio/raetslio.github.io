/* ======================================================================
   Start der Grund-App
   initApp: Zustand wiederherstellen und die Oberfläche aufbauen.
   ====================================================================== */

async function initApp() {
  var cachedTheme = null;
  try { cachedTheme = localStorage.getItem('rs_theme'); } catch (e) {}
  try { var ca = localStorage.getItem('rs_accent'); if (ca) appState.accent = ca; } catch (e) {}
  applyTheme(cachedTheme || 'system');
  var saved = await loadStateFromHost();

  if (saved && typeof saved === 'object') {
    if (saved.accent) appState.accent = saved.accent;
    if (saved.theme) applyTheme(saved.theme); else applyAccent(appState.accent);
    if (saved.print) {
      Object.assign(appState.print, saved.print);
      var pn = document.getElementById('print-name');
      var pd = document.getElementById('print-date');
      var pm = document.getElementById('print-margin');
      var pi = document.getElementById('print-instr-size');
      if (pn) pn.value = appState.print.name || '';
      if (pd) pd.value = appState.print.date || '';
      if (pm) pm.value = String(appState.print.marginMm || 15);
      if (pi) pi.value = String(appState.print.instrPt || 9.5);
      var mv = document.getElementById('print-margin-val');
      if (mv) mv.textContent = `${appState.print.marginMm || 15} mm`;
      var iv = document.getElementById('print-instr-val');
      if (iv) iv.textContent = `${appState.print.instrPt || 9.5} pt`;
      setMultiPrint(appState.print.multiPrint || 1);
      setSolutionMode(appState.print.solutionMode || 'standard');
    }

    if (saved.sudoku && Array.isArray(saved.sudoku.solution) && saved.sudoku.solution.length >= 4 &&
        Array.isArray(saved.sudoku.givens) && saved.sudoku.givens.length === saved.sudoku.solution.length &&
        Array.isArray(saved.sudoku.entries) && saved.sudoku.entries.length === saved.sudoku.solution.length) {
      Object.assign(appState.sudoku, saved.sudoku);
      appState.sudoku.size = saved.sudoku.solution.length;
      appState.sudoku.extraPuzzles = [];
      var sgRestored = computeSubgrid(appState.sudoku.size);
      appState.sudoku.subR = saved.sudoku.subR || sgRestored.subR;
      appState.sudoku.subC = saved.sudoku.subC || sgRestored.subC;
      var sIn = document.getElementById('sudoku-size-input');
      if (sIn) sIn.value = String(appState.sudoku.size);
      var szSlider = document.getElementById('sudoku-zoom-slider');
      var szVal = document.getElementById('sudoku-zoom-val');
      if (szSlider) szSlider.value = String(appState.sudoku.cellZoom);
      if (szVal) szVal.textContent = `${appState.sudoku.cellZoom} px`;
      var dBtns = document.querySelectorAll('#sudoku-diff-segmented .seg-btn');
      dBtns.forEach(function (b) {
        b.setAttribute('aria-pressed', b.dataset.diff === appState.sudoku.difficulty ? 'true' : 'false');
      });
      var dHint = document.getElementById('sudoku-diff-hint');
      if (dHint && DIFF_CONFIG[appState.sudoku.difficulty]) {
        dHint.textContent = DIFF_CONFIG[appState.sudoku.difficulty].hint;
      }
      onSudokuSizeInput(appState.sudoku.size);
      renderSudokuAll();
      updateSudokuTimerDisplay();
    } else {
      requestSudokuGeneration();
    }

    if (saved.ws && Array.isArray(saved.ws.grid) && saved.ws.grid.length >= 10) {
      Object.assign(appState.ws, saved.ws);
      var wSizeIn = document.getElementById('ws-size-input');
      var wSizeLbl = document.getElementById('ws-size-label');
      var wWordsIn = document.getElementById('ws-words-input');
      var wZoomSl = document.getElementById('ws-zoom-slider');
      var wZoomVal = document.getElementById('ws-zoom-val');
      if (wSizeIn) wSizeIn.value = String(appState.ws.size);
      if (wSizeLbl) wSizeLbl.textContent = `${appState.ws.size}×${appState.ws.size}`;
      if (wWordsIn) wWordsIn.value = appState.ws.wordsRaw;
      if (wZoomSl) wZoomSl.value = String(appState.ws.cellZoom);
      if (wZoomVal) wZoomVal.textContent = `${appState.ws.cellZoom} px`;

      var dh = document.getElementById('dir-h');
      var dv = document.getElementById('dir-v');
      var dd = document.getElementById('dir-d');
      var dr = document.getElementById('dir-r');
      var ut = document.getElementById('ws-umlaut-toggle');
      if (dh) dh.checked = !!appState.ws.dirs.h;
      if (dv) dv.checked = !!appState.ws.dirs.v;
      if (dd) dd.checked = !!appState.ws.dirs.d;
      if (dr) dr.checked = !!appState.ws.dirs.r;
      if (ut) ut.checked = !!appState.ws.umlautDirect;
      renderWsAll();
    } else {
      var taInit = document.getElementById('ws-words-input');
      if (taInit) taInit.value = appState.ws.wordsRaw;
      generateWordSearch();
    }

    switchMode(saved.mode || 'sudoku');
    window.__rsSaved = saved;
    if (typeof window.extRestore === 'function') { try { window.extRestore(saved); } catch (e) {} }
  } else {
    var taDef = document.getElementById('ws-words-input');
    if (taDef) taDef.value = appState.ws.wordsRaw;
    requestSudokuGeneration();
    generateWordSearch();
    switchMode('sudoku');
  }

  rsApplyAbDefaults(true);
  startSudokuTimer();
  window.__rsInit = true;

  if (window.notebookAppApi && typeof window.notebookAppApi.notifyAppReady === 'function') {
    window.notebookAppApi.notifyAppReady();
  }
}

initApp();

/* ----------------------------------------------------------------------
   Arbeitsblatt: Name und Datum vorausfüllen (Einstellung im Konto)
   nameMode: 'line' (Schreiblinie, Standard) oder 'account' (Name des Kontos)
   dateMode: 'today' (heutiges Datum, Standard) oder 'line' (Schreiblinie)
   Von Hand geänderte Felder bleiben in dieser Sitzung unberührt.
   ---------------------------------------------------------------------- */
var rsAbTouched = { name: false, date: false };
function rsTodayStr() {
  var d = new Date(), p = function (n) { return (n < 10 ? '0' : '') + n; };
  return p(d.getDate()) + '.' + p(d.getMonth() + 1) + '.' + d.getFullYear();
}
function rsAccountName() {
  try { return (window.RSAUTH && typeof RSAUTH.printName === 'function' && RSAUTH.printName()) || ''; } catch (e) { return ''; }
}
function rsApplyAbDefaults(force) {
  if (typeof appState === 'undefined' || !appState.print) return;
  var p = appState.print;
  if (force) { rsAbTouched.name = false; rsAbTouched.date = false; }
  if (p.nameMode !== 'account') p.nameMode = 'line';
  if (p.dateMode !== 'line') p.dateMode = 'today';
  if (!rsAbTouched.name) p.name = p.nameMode === 'account' ? rsAccountName() : '';
  if (!rsAbTouched.date) p.date = p.dateMode === 'today' ? rsTodayStr() : '';
  var ni = document.getElementById('print-name'), di = document.getElementById('print-date');
  if (ni && ni.value !== p.name) ni.value = p.name;
  if (di && di.value !== p.date) di.value = p.date;
  if (typeof renderPrintPreview === 'function') { try { renderPrintPreview(); } catch (e) {} }
}
