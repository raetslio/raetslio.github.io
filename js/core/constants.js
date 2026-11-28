/* ======================================================================
   Gemeinsame Konstanten und App-Zustand
   Farbpaletten, Schwierigkeitsstufen, Standard-Wortliste und das zentrale
   Zustandsobjekt appState, auf das alle anderen Dateien zugreifen.
   ====================================================================== */

var WS_HIGHLIGHT_HEX = [
  '#3c5a6e',
  '#5f7c63',
  '#b86b4b',
  '#b0883b',
  '#7b648f',
  '#3b7d7c',
  '#a85b6e',
  '#6d7c46',
  '#516896',
  '#966a50'
];

var PRINT_PALETTE = {
  ink: '#1f2326',
  muted: '#555d62',
  ruleLight: '#b9c2bd',
  ruleStrong: '#1f2326',
  givenBg: '#f1f3f2',
  solutionInk: '#2f5a78',
  ghostBold: '#2b5575',
  ghostGrid: '#4f6d82'
};

var DIFF_CONFIG = {
  leicht: { label: 'Leicht', clueRatio: 0.62, hint: 'Ca. 62 % vorgegebene Zahlen' },
  mittel: { label: 'Mittel', clueRatio: 0.48, hint: 'Ca. 48 % vorgegebene Zahlen' },
  schwer: { label: 'Schwer', clueRatio: 0.36, hint: 'Ca. 36 % vorgegebene Zahlen' },
  experte: { label: 'Experte', clueRatio: 0.27, hint: 'Ca. 27 % vorgegebene Zahlen' }
};

var DEFAULT_WS_WORDS = [
  'SOMMER',
  'WOLKE',
  'STERN',
  'WALD',
  'FLUSS',
  'BERG',
  'BLUME',
  'SONNE',
  'REGEN',
  'VOGEL',
  'BRÜCKE',
  'GARTEN'
];

var appState = {
  mode: 'sudoku',
  theme: 'system',
  accent: 'default',
  sudoku: {
    size: 9,
    subR: 3,
    subC: 3,
    difficulty: 'leicht',
    cellZoom: 40,
    solution: [],
    givens: [],
    entries: [],
    checkedStatus: null,
    revealed: false,
    selected: null,
    elapsedSec: 0,
    extraPuzzles: []
  },
  ws: {
    size: 16,
    cellZoom: 32,
    wordsRaw: DEFAULT_WS_WORDS.join('\n'),
    dirs: { h: true, v: true, d: true, r: false },
    umlautDirect: true,
    grid: [],
    placements: [],
    unplaced: [],
    foundIds: [],
    revealed: false,
    startCell: null
  },
  print: {
    name: '',
    date: '',
    nameMode: 'line',   /* 'line' = Schreiblinie, 'account' = Name aus dem Konto */
    showLink: true,     /* Webseiten-Link unten auf dem Blatt */
    dateMode: 'today',  /* 'today' = Datum des Tages, 'line' = Schreiblinie */
    showTitleField: false, /* Titel-Feld im Druckfenster anzeigen */
    title: '',          /* Titel für dieses Blatt (aus dem Druckfenster); leer = Standard */
    titleDefault: '',   /* eigener Standardtitel (Konto); leer = Name des Rätsels */
    subtitle: '',       /* Untertitel / Kopfzeile unter dem Titel */
    showInstr: true,    /* Anleitung auf dem Blatt anzeigen */
    footerText: '',     /* eigene Fußzeile statt „Arbeitsblatt · raetslio.github.io“ */
    marginMm: 15,
    instrPt: 9.5,
    multiPrint: 1,
    solutionMode: 'standard',
    previewSheet: 'sheet1'
  }
};

var sudokuTimerId = null;
var digitBuffer = '';
var digitBufferTimer = null;
var persistTimer = null;
