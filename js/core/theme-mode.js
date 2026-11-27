/* ======================================================================
   Design (hell/dunkel) und Wechsel der Rätselarten
   applyTheme / toggleTheme sowie switchMode für die Grundansichten.
   ====================================================================== */

function systemPrefersDark() {
  return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
}

/* Akzentfarben: Hauptfarbe der Oberfläche (hell / dunkel getrennt, damit der Kontrast stimmt) */
var RS_ACCENTS = {
  'default': { name: 'Blaugrau' },
  green:  { name: 'Grün',    l: ['#3f6e49', '#e4efe6', '#26442d'], d: ['#88be91', '#243628', '#dff0e2'] },
  orange: { name: 'Terrakotta', l: ['#a8573a', '#f5e5de', '#5e2a18'], d: ['#e0a084', '#3e2a22', '#fbe6dc'] },
  violet: { name: 'Violett', l: ['#6a4f8c', '#ece6f3', '#3d2a57'], d: ['#bda6dc', '#342c42', '#efe6fa'] },
  rose:   { name: 'Rosé',    l: ['#a03b52', '#f6e3e8', '#5a1c2b'], d: ['#e49aab', '#3e2430', '#fbe3ea'] },
  teal:   { name: 'Türkis',  l: ['#1f7a7a', '#ddefef', '#0f4747'], d: ['#7cc7c7', '#1f3a3a', '#dff4f4'] }
};
function applyAccent(name) {
  var key = RS_ACCENTS[name] ? name : 'default';
  if (typeof appState !== 'undefined') appState.accent = key;
  var root = document.documentElement, dark = root.getAttribute('data-theme') === 'dark';
  var vars = ['--primary', '--primary-container', '--on-primary-container', '--focus', '--data-1', '--ws-hl-0'];
  var a = RS_ACCENTS[key];
  if (!a.l) { vars.forEach(function (v) { root.style.removeProperty(v); }); }
  else {
    var c = dark ? a.d : a.l;
    root.style.setProperty('--primary', c[0]); root.style.setProperty('--focus', c[0]); root.style.setProperty('--data-1', c[0]); root.style.setProperty('--ws-hl-0', c[0]);
    root.style.setProperty('--primary-container', c[1]); root.style.setProperty('--on-primary-container', c[2]);
  }
  try { if (key === 'default') localStorage.removeItem('rs_accent'); else localStorage.setItem('rs_accent', key); } catch (e) {}
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
  if (typeof applyAccent === 'function') applyAccent(appState.accent);
  var names = { system: 'Gerät', light: 'Hell', dark: 'Dunkel' };
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
