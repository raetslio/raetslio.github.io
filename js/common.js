/* ======================================================================
   Gemeinsame Hilfen der Erweiterungen
   Icons, Schwierigkeitsnamen, Rätselarten-Beschriftungen und Namenslisten fürs Heft.
   Ab hier läuft der Code im strikten Modus ('use strict').
   ====================================================================== */
'use strict';

var ICON = function (p) { return '<svg class="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + p + '"/></svg>'; };
var IC_UP = ICON('M6 15l6-6 6 6'), IC_DN = ICON('M6 9l6 6 6-6'), IC_X = ICON('M18 6L6 18M6 6l12 12');
var DIFFS = ['Leicht', 'Mittel', 'Schwer', 'Experte'];
var DIFF_KEYS = ['leicht', 'mittel', 'schwer', 'experte'];
var TYPE_LABEL = { sudoku: 'Sudoku', ws: 'Suchsel', binoxxo: 'Binoxxo', maze: 'Labyrinth', hitori: 'Hitori', mauer: 'Zahlenmauer', magic: 'Magisches Quadrat' };
var TYPE_ORDER = ['sudoku', 'ws', 'binoxxo', 'maze', 'hitori', 'magic', 'mauer'];
var NAME_POOL = {
  sudoku: ['Zahlenreise', 'Neun Felder', 'Zahlenmosaik', 'Stille Quadrate', 'Ziffernzauber', 'Der Zahlenwächter', 'Kopfnuss', 'Ordnung im Gitter', 'Zahlengarten', 'Quadratur', 'Denkpause', 'Feldforschung'],
  ws: ['Buchstabenmeer', 'Wörterwald', 'Versteckspiel', 'Spurensuche', 'Wortschatzkiste', 'Buchstabensalat', 'Verflixte Wörter', 'Der Wortfinder', 'Lesezeichen', 'Buchstabenbeet', 'Wortjagd', 'Sucher und Finder'],
  binoxxo: ['Kreuz und Kreis', 'Tic und Tac', 'Doppelt gemoppelt', 'Ping und Pong', 'Zwei Gesichter', 'Gleichgewicht', 'Null und Kreuz', 'Die Balance', 'Paarlauf', 'Hin und Her', 'Ausgleich', 'Schwarz auf Weiß'],
  maze: ['Der Irrgarten', 'Im Heckenlabyrinth', 'Wege im Nebel', 'Der Minotaurus', 'Verflixte Gänge', 'Der Weg hinaus', 'Schlossgarten', 'Verlaufen verboten', 'Irrwege', 'Die Kreuzung', 'Zickzackpfad', 'Goldener Ausgang'],
  hitori: ['Schwarz-Weiß-Spiel', 'Wegstreichen', 'Doppelgänger', 'Schatten im Gitter', 'Unter dem Strich', 'Streichkonzert', 'Zahlenfinsternis', 'Tintenfleck', 'Versteckte Zahlen', 'Durchgestrichen', 'Der Zensor', 'Zahlenjagd'],
  mauer: ['Die Zahlenpyramide', 'Steine stapeln', 'Mauerbau', 'Von unten nach oben', 'Pyramidenrätsel', 'Der Turmbau', 'Stein auf Stein', 'Rechenmauer', 'Ziegelwerk', 'Die Mauer', 'Gipfelsturm', 'Rechenpyramide'],
  magic: ['Magische Summe', 'Zauberquadrat', 'Das Zahlenquadrat', 'Gleiche Summen', 'Merlins Quadrat', 'Magisches Gitter', 'Quadratischer Zauber', 'Die magische Zahl', 'Summenzauber', 'Alles gleich', 'Dürers Quadrat', 'Zahlenmagie']
};
function $(id) { return document.getElementById(id); }
function rnd(n) { return Math.floor(Math.random() * n); }
function shuf(a) { for (var i = a.length - 1; i > 0; i--) { var j = rnd(i + 1); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function banner(el, msg, kind) {
  if (!el) return;
  if (!msg) { el.classList.add('hidden'); return; }
  el.className = 'feedback-banner ' + (kind || 'info');
  el.textContent = msg;
}

/* Einheitliche Rückmeldung bei Aktionen (alle Rätselarten) */
function rsMsg(id, msg, kind, ms) {
  var el = document.getElementById(id); if (!el) return;
  var t = el.querySelector('span') || el;
  el.className = 'feedback-banner ' + (kind || 'info'); t.textContent = msg;
  clearTimeout(el._rsT); if (ms) el._rsT = setTimeout(function () { el.classList.add('hidden'); }, ms);
}
function rsRun(btn, fn, fbId) {
  if (btn.disabled) return;
  var old = btn.innerHTML; btn.disabled = true; btn.setAttribute('aria-busy', 'true');
  rsMsg(fbId, 'Rätsel wird erstellt …', 'info');
  function done() { btn.disabled = false; btn.removeAttribute('aria-busy'); btn.innerHTML = old; }
  setTimeout(function () {
    var r;
    try { r = fn(); } catch (e) { rsMsg(fbId, 'Das Rätsel konnte nicht erstellt werden. Bitte versuche es noch einmal.', 'error'); return done(); }
    Promise.resolve(r).then(function (v) {
      /* Erfolg nur, wenn wirklich ein Rätsel erstellt wurde (false = abgebrochen) */
      if (v === false) { var el = document.getElementById(fbId); if (el) el.classList.add('hidden'); }
      else rsMsg(fbId, 'Rätsel erfolgreich erstellt.', 'success', 2500);
      done();
    }, function () { rsMsg(fbId, 'Das Rätsel konnte nicht erstellt werden. Bitte versuche es noch einmal.', 'error'); done(); });
  }, 30);
}
function rsAddToBook(key, fbId) {
  try { BK.addCurrent(key); rsMsg(fbId, 'Dein Rätsel wurde zum Rätselheft hinzugefügt.', 'success', 3000); }
  catch (e) { rsMsg(fbId, 'Das Rätsel konnte nicht zum Heft hinzugefügt werden.', 'error'); }
}

/* Einheitliche Prüf-Rückmeldung für alle Rätselarten */
function rsCheck(id, wrong, empty, solved, hint, detail) {
  if (solved) return rsMsg(id, 'Alle Einträge sind korrekt. Das Rätsel ist gelöst!', 'success');
  if (wrong) return rsMsg(id, (wrong === 1 ? '1 Fehler' : wrong + ' Fehler') + ' (rot markiert).' + (empty ? ' Noch ' + empty + ' offen.' : '') + (detail ? ' ' + detail : ''), 'error');
  rsMsg(id, hint || ('Alle bisherigen Einträge sind korrekt – noch ' + empty + ' offen.'), 'info');
}

/* ======================================================================
   Barrierefreiheit: Bestätigungsdialog, Fokusführung, Tastaturbedienung
   ====================================================================== */
(function () {
  var FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]):not([type=hidden]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
  function visible(el) { return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length); }
  function focusables(root) { return Array.prototype.filter.call(root.querySelectorAll(FOCUSABLE), visible); }

  /* Verständlicher Bestätigungsdialog (Ersatz für confirm): gibt ein Promise<boolean> zurück.
     Vorausgewählt ist immer "Abbrechen", Escape und Klick daneben brechen ab. */
  window.rsConfirm = function (text, opt) {
    opt = opt || {};
    return new Promise(function (resolve) {
      var prev = document.activeElement, old = document.getElementById('rs-confirm'); if (old) old.remove();
      var m = document.createElement('div');
      m.id = 'rs-confirm'; m.className = 'modal-backdrop rs-confirm'; m.setAttribute('data-open', 'true'); m.setAttribute('data-rs-confirm', '1');
      m.setAttribute('role', 'alertdialog'); m.setAttribute('aria-modal', 'true'); m.setAttribute('aria-labelledby', 'rs-confirm-t'); m.setAttribute('aria-describedby', 'rs-confirm-d');
      var card = document.createElement('div'); card.className = 'modal-card';
      var h = document.createElement('h2'); h.id = 'rs-confirm-t'; h.className = 'section-title'; h.textContent = opt.title || 'Bist du sicher?';
      var p = document.createElement('p'); p.id = 'rs-confirm-d'; p.textContent = text;
      var row = document.createElement('div'); row.className = 'rs-confirm-actions';
      var no = document.createElement('button'); no.type = 'button'; no.className = 'btn'; no.textContent = opt.cancel || 'Abbrechen';
      var ok = document.createElement('button'); ok.type = 'button'; ok.className = 'btn ' + (opt.danger ? 'rs-danger' : 'btn-primary'); ok.textContent = opt.ok || 'OK';
      row.appendChild(no); row.appendChild(ok); card.appendChild(h); card.appendChild(p); card.appendChild(row); m.appendChild(card);
      function end(v) { document.removeEventListener('keydown', key, true); m.remove(); if (prev && prev.focus) { try { prev.focus(); } catch (e) {} } resolve(v); }
      function key(e) {
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); end(false); }
        else if (e.key === 'Tab') { var f = focusables(m); if (!f.length) return; var i = f.indexOf(document.activeElement);
          if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); } }
      }
      no.onclick = function () { end(false); }; ok.onclick = function () { end(true); };
      m.onclick = function (e) { if (e.target === m) end(false); };
      document.addEventListener('keydown', key, true);
      document.body.appendChild(m); no.focus();
    });
  };

  /* Vorhandene Dialoge: Fokus hinein, Tab bleibt im Dialog, Escape schließt, Fokus kehrt zurück */
  var returnTo = null;
  function openModal() { return Array.prototype.filter.call(document.querySelectorAll('.modal-backdrop[data-open="true"]'), function (m) { return !m.hasAttribute('data-rs-confirm'); }).pop(); }
  function watch() {
    var mo = new MutationObserver(function (list) {
      list.forEach(function (r) {
        var m = r.target; if (m.hasAttribute('data-rs-confirm')) return;
        if (m.getAttribute('data-open') === 'true') {
          if (!returnTo) returnTo = r.oldValue === 'true' ? null : document.activeElement;
          setTimeout(function () { var f = focusables(m.querySelector('.modal-card') || m); if (f[0] && !m.contains(document.activeElement)) f[0].focus(); }, 30);
        } else if (returnTo) { var t = returnTo; returnTo = null; if (t && t.focus && document.contains(t)) try { t.focus(); } catch (e) {} }
      });
    });
    document.querySelectorAll('.modal-backdrop').forEach(function (m) { mo.observe(m, { attributes: true, attributeFilter: ['data-open'], attributeOldValue: true }); });
  }
  document.addEventListener('keydown', function (e) {
    var m = openModal(); if (!m) return;
    if (e.key === 'Escape' && !/^\/login\/?/.test(location.pathname)) { e.preventDefault(); m.setAttribute('data-open', 'false'); }
    else if (e.key === 'Tab') { var f = focusables(m); if (!f.length) return; var i = f.indexOf(document.activeElement);
      if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); } }
  });

  /* "Zum Inhalt springen" für Tastatur- und Screenreader-Nutzer */
  function skip() {
    if (document.querySelector('.rs-skip')) return;
    var a = document.createElement('a'); a.className = 'rs-skip'; a.href = '#'; a.textContent = 'Zum Inhalt springen';
    a.addEventListener('click', function (e) { e.preventDefault(); var mn = document.querySelector('main:not(.hidden)'); if (mn) { mn.setAttribute('tabindex', '-1'); mn.focus(); mn.scrollIntoView(); } });
    document.body.insertBefore(a, document.body.firstChild);
  }
  function init() { skip(); watch(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
