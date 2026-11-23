/* ======================================================================
   Design (hell/dunkel) und Wechsel der Rätselarten
   applyTheme / toggleTheme sowie switchMode für die Grundansichten.
   ====================================================================== */

function systemPrefersDark() {
  return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
}

function applyTheme(themeName) {
  var mode = (themeName === 'dark' || themeName === 'light') ? themeName : 'system';
  appState.theme = mode;
  var effective = mode === 'system' ? (systemPrefersDark() ? 'dark' : 'light') : mode;
  var root = document.documentElement;
  if (effective === 'dark') {
    root.setAttribute('data-theme', 'dark');
  } else {
    root.removeAttribute('data-theme');
  }
  try { localStorage.setItem('rs_theme', mode); } catch (e) {}
  var names = { system: 'System', light: 'Hell', dark: 'Dunkel' };
  var btn = document.getElementById('btn-theme-toggle');
  var sun = document.getElementById('icon-theme-sun');
  var moon = document.getElementById('icon-theme-moon');
  var sys = document.getElementById('icon-theme-system');
  var label = document.getElementById('theme-label');
  if (btn) {
    btn.setAttribute('aria-pressed', mode === 'dark' ? 'true' : 'false');
    btn.title = 'Darstellung: ' + names[mode] + (mode === 'system' ? ' (folgt dem Gerät)' : '') + ' – klicken zum Wechseln';
  }
  if (sun) sun.classList.toggle('hidden', mode !== 'light');
  if (moon) moon.classList.toggle('hidden', mode !== 'dark');
  if (sys) sys.classList.toggle('hidden', mode !== 'system');
  if (label) label.textContent = names[mode];
}

function toggleTheme() {
  var order = ['system', 'light', 'dark'];
  applyTheme(order[(order.indexOf(appState.theme) + 1) % order.length]);
  schedulePersist();
}

if (window.matchMedia) {
  var rsMq = window.matchMedia('(prefers-color-scheme: dark)');
  var rsMqHandler = function () { if (appState.theme === 'system') applyTheme('system'); };
  if (rsMq.addEventListener) rsMq.addEventListener('change', rsMqHandler);
  else if (rsMq.addListener) rsMq.addListener(rsMqHandler);
}

function switchMode(newMode) {
  appState.mode = newMode === 'wortsuche' ? 'wortsuche' : 'sudoku';
  var tabSu = document.getElementById('tab-sudoku');
  var tabWs = document.getElementById('tab-wortsuche');
  var viewSu = document.getElementById('view-sudoku');
  var viewWs = document.getElementById('view-wortsuche');
  if (tabSu) tabSu.setAttribute('aria-selected', appState.mode === 'sudoku' ? 'true' : 'false');
  if (tabWs) tabWs.setAttribute('aria-selected', appState.mode === 'wortsuche' ? 'true' : 'false');
  if (viewSu) viewSu.classList.toggle('hidden', appState.mode !== 'sudoku');
  if (viewWs) viewWs.classList.toggle('hidden', appState.mode !== 'wortsuche');

  updatePrintModalModeUI();
  if (appState.mode === 'wortsuche') {
    renderWsOverlay();
  }
  schedulePersist();
}
