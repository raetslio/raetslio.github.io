/* ======================================================================
   Speichern und Laden des Spielstands
   Schreibt den Zustand über notebookAppApi weg und stellt ihn beim Start wieder her.
   ====================================================================== */

function schedulePersist() {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(function () {
    saveStateToHost();
  }, 250);
}

async function saveStateToHost() {
  if (!window.notebookAppApi || typeof window.notebookAppApi.setAppState !== 'function') return;
  try {
    await window.notebookAppApi.setAppState({
      mode: appState.mode,
      theme: appState.theme,
      sudoku: {
        size: appState.sudoku.size,
        subR: appState.sudoku.subR,
        subC: appState.sudoku.subC,
        difficulty: appState.sudoku.difficulty,
        cellZoom: appState.sudoku.cellZoom,
        solution: appState.sudoku.solution,
        givens: appState.sudoku.givens,
        entries: appState.sudoku.entries,
        revealed: appState.sudoku.revealed,
        elapsedSec: appState.sudoku.elapsedSec
      },
      ws: {
        size: appState.ws.size,
        cellZoom: appState.ws.cellZoom,
        wordsRaw: appState.ws.wordsRaw,
        dirs: appState.ws.dirs,
        umlautDirect: appState.ws.umlautDirect,
        grid: appState.ws.grid,
        placements: appState.ws.placements,
        unplaced: appState.ws.unplaced,
        foundIds: appState.ws.foundIds,
        revealed: appState.ws.revealed
      },
      print: appState.print,
      ext: (typeof window.extGetState === 'function') ? window.extGetState() : null
    });
  } catch (e) {
    /* Safe fallback if storage unavailable */
  }
}

async function loadStateFromHost() {
  if (!window.notebookAppApi || typeof window.notebookAppApi.getAppState !== 'function') return null;
  try {
    return await window.notebookAppApi.getAppState();
  } catch (e) {
    return null;
  }
}
