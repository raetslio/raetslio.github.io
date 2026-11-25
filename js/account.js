/* ======================================================================
   Optionales Konto (Supabase)
   Anmelden (E-Mail oder Google), Abmelden, Konto löschen, Synchronisierung von Heften,
   Verläufen und App-Zustand, getrennte Datenbereiche pro Konto/Gerät, Backup-Export/-Import.
   Eigenständiges Skript (Objekt RSAUTH), braucht die Supabase-Bibliothek.
   ====================================================================== */

/* ======================================================================
   OPTIONALES KONTO (Supabase) – Sync von Rätselständen, Heften & Druckeinstellungen
   ====================================================================== */
(function () {
  'use strict';
  /* >>> HIER EINTRAGEN (Supabase → Project Settings → API) <<< */
  var SUPABASE_URL = 'https://dnhjzlnbuqmyqgjxxygx.supabase.co';
  var SUPABASE_ANON_KEY = 'sb_publishable_BrUErzbAbLbrL2LXEPBiuQ_1ijwQtWQ';

  /* >>> CAPTCHA (Cloudflare Turnstile): Site Key hier eintragen. Leer = kein Captcha. <<< */
  var TURNSTILE_SITE_KEY = '';

  var BK_IDX = 'raetsel_hefte_v2', BK_PRE = 'raetsel_heft_v2_';
  var HK = 'rs_sync_hash';
  /* Getrennte Datenbereiche: Abgemeldet = eigener Bereich pro Gerät ('guest'), angemeldet = Bereich des Kontos.
     Jeder Bereich sieht und bearbeitet nur seine eigenen Daten. */
  var OWNER_KEY = 'rs_owner', NS_PRE = 'rs_ns_';
  var lsSetRaw = Storage.prototype.setItem, lsRemoveRaw = Storage.prototype.removeItem;
  var switching = false;
  function isAcctKey(k) { return typeof k === 'string' && (k.indexOf('raetsel_heft') === 0 || k === 'raetsel_hefte_v2' || k === 'rs_appstate_cache'); }
  var discardOwner = null;
  function switchNs(from, to) {
    var snap = {}, keys = [];
    for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (isAcctKey(k)) keys.push(k); }
    keys.forEach(function (k) { snap[k] = localStorage.getItem(k); });
    if (discardOwner !== from) { lsSetRaw.call(localStorage, NS_PRE + from, JSON.stringify(snap)); }
    else lsRemoveRaw.call(localStorage, NS_PRE + from);
    keys.forEach(function (k) { lsRemoveRaw.call(localStorage, k); });
    var tgt = null; try { tgt = JSON.parse(localStorage.getItem(NS_PRE + to) || 'null'); } catch (e) {}
    if (tgt) Object.keys(tgt).forEach(function (k) { if (isAcctKey(k) && typeof tgt[k] === 'string') lsSetRaw.call(localStorage, k, tgt[k]); });
    lsRemoveRaw.call(localStorage, NS_PRE + to);
    lsSetRaw.call(localStorage, OWNER_KEY, to);
    discardOwner = null;
  }
  /* true = Bereich wurde gewechselt, Seite lädt neu */
  function ensureNamespace() {
    try {
      var target = user ? user.id : 'guest', owner = localStorage.getItem(OWNER_KEY);
      if (owner === null) { lsSetRaw.call(localStorage, OWNER_KEY, target); return false; }
      if (owner === target) return false;
      switching = true;
      switchNs(owner, target);
      location.reload();
      return true;
    } catch (e) { switching = false; return false; }
  }
  var SP = { verlauf: { ls: 'raetsel_heft_verlauf', mod: 'HV' }, spiele: { ls: 'raetsel_heft_spiele', mod: 'GV' } };
  var $ = function (id) { return document.getElementById(id); };
  var sb = null, user = null, pushTimer = null, syncing = false, lastMsg = '', view = 'login';
  var configured = SUPABASE_URL.indexOf('DEIN-PROJEKT') < 0 && SUPABASE_ANON_KEY.indexOf('DEIN-ANON') < 0;

  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function canon(v) {
    if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']';
    if (v && typeof v === 'object') return '{' + Object.keys(v).sort().map(function (k) { return JSON.stringify(k) + ':' + canon(v[k]); }).join(',') + '}';
    return JSON.stringify(v === undefined ? null : v);
  }
  function hash(v) { var s = canon(v), h = 5381; for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return s.length + ':' + h; }
  /* Frische Anmeldung: Sync-Merkzettel dieses Geräts verwerfen, damit bei Konflikten der Stand des Kontos gewinnt */
  var freshSync = false;
  function markFresh() { try { sessionStorage.setItem('rs_fresh_login', '1'); } catch (e) {} }
  function consumeFresh() {
    try {
      if (user && sessionStorage.getItem('rs_fresh_login')) {
        sessionStorage.removeItem('rs_fresh_login');
        localStorage.removeItem(HK + '_' + user.id);
        freshSync = true;
      }
    } catch (e) {}
  }
  function getH() { try { return JSON.parse(localStorage.getItem(HK + '_' + (user ? user.id : '')) || '{}'); } catch (e) { return {}; } }
  function setH(h) { try { localStorage.setItem(HK + '_' + user.id, JSON.stringify(h)); } catch (e) {} }

  function err(e) {
    var m = (e && e.message) || String(e);
    var map = [
      [/Invalid login credentials/i, 'E-Mail oder Passwort ist falsch.'],
      [/Email not confirmed/i, 'Bitte bestätige zuerst deine E-Mail-Adresse (Link in der Bestätigungsmail).'],
      [/already registered|already been registered/i, 'Diese E-Mail ist bereits registriert. Bitte melde dich an.'],
      [/Password should be at least/i, 'Das Passwort ist zu kurz (mindestens 8 Zeichen).'],
      [/captcha/i, 'Die Captcha-Prüfung ist fehlgeschlagen. Bitte versuche es erneut.'],
      [/rate limit|too many/i, 'Zu viele Versuche. Bitte warte kurz und versuche es erneut.'],
      [/same password/i, 'Das neue Passwort muss sich vom alten unterscheiden.'],
      [/permission denied|row-level security|violates row/i, 'Datenbank-Berechtigung fehlt. Bitte einmal das Skript supabase-setup.sql im Supabase SQL Editor ausführen.'],
      [/Failed to fetch|NetworkError/i, 'Keine Verbindung zum Server.']
    ];
    for (var i = 0; i < map.length; i++) if (map[i][0].test(m)) return map[i][1];
    return m;
  }
  function msg(text, kind) {
    var el = $('acct-msg'); if (!el) return;
    if (!text) { el.classList.add('hidden'); return; }
    el.className = 'feedback-banner ' + (kind || 'info'); el.textContent = text;
  }

  /* ---------- Header-Button ---------- */
  function renderBtn() {
    var b = $('btn-account'), l = $('account-label'); if (!b || !l) return;
    l.textContent = user ? (user.email.length > 18 ? user.email.slice(0, 16) + '…' : user.email) : 'Anmelden';
    b.classList.toggle('btn-sage', !!user);
  }

  /* ---------- Modal ---------- */
  function field(id, label, type, ac, ph) {
    return '<div class="field-group"><label class="field-label" for="' + id + '">' + label + '</label><input id="' + id + '" class="input-control" type="' + type + '" autocomplete="' + ac + '"' + (ph ? ' placeholder="' + ph + '"' : '') + '></div>';
  }
  /* Passwort-Bereich nur zeigen, wenn das Konto auch per E-Mail/Passwort nutzbar ist (nicht bei reinen Google-Konten) */
  function hasEmailLogin() {
    try {
      var ids = user && user.identities;
      if (Array.isArray(ids) && ids.length) return ids.some(function (i) { return i.provider === 'email'; });
      var pr = user && user.app_metadata && user.app_metadata.providers;
      if (Array.isArray(pr) && pr.length) return pr.indexOf('email') >= 0;
    } catch (e) {}
    return true;
  }
  /* ---------- Captcha (Cloudflare Turnstile) ---------- */
  var capToken = '', capId = null, capLoading = false;
  function capOn() { return !!TURNSTILE_SITE_KEY; }
  function capHtml() { return capOn() ? '<div id="acct-captcha" style="display:flex;justify-content:center;min-height:65px;margin:4px 0"></div>' : ''; }
  function capReset() { capToken = ''; try { if (window.turnstile && capId !== null) window.turnstile.reset(capId); } catch (e) {} }
  function capInit() {
    capId = null; capToken = '';
    var box = $('acct-captcha'); if (!capOn() || !box) return;
    function draw() {
      var b = $('acct-captcha'); if (!b || !window.turnstile) return;
      try { capId = window.turnstile.render(b, { sitekey: TURNSTILE_SITE_KEY, language: 'de', callback: function (t) { capToken = t; }, 'expired-callback': function () { capToken = ''; }, 'error-callback': function () { capToken = ''; } }); } catch (e) {}
    }
    if (window.turnstile) { draw(); return; }
    if (capLoading) { setTimeout(capInit, 400); return; }
    capLoading = true;
    var sc = document.createElement('script'); sc.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'; sc.async = true;
    sc.onload = function () { capLoading = false; draw(); };
    sc.onerror = function () { capLoading = false; var b = $('acct-captcha'); if (b) b.innerHTML = '<p class="muted-note">Das Captcha konnte nicht geladen werden. Bitte Seite neu laden.</p>'; };
    document.head.appendChild(sc);
  }
  function capNeed() { if (capOn() && !capToken) { msg('Bitte bestätige zuerst das Captcha.', 'warning'); return true; } return false; }
  function capOpt() { return capOn() ? { captchaToken: capToken } : {}; }

  function render() { renderBody(); if (!user) capInit(); }
  function renderBody() {
    var body = $('acct-body'), t = $('acct-title'); if (!body) return;
    if (!configured) {
      t.textContent = 'Konto';
      body.innerHTML = '<p class="muted-note">Die Anmeldung ist noch nicht eingerichtet. Trage in der Datei bei <b>SUPABASE_URL</b> und <b>SUPABASE_ANON_KEY</b> deine Projektdaten ein.</p><p class="muted-note">Ohne Konto funktioniert alles wie bisher – die Anmeldung ist freiwillig.</p>' + backupBlock();
      return;
    }
    if (!sb) { body.innerHTML = '<p class="muted-note">Der Anmeldedienst konnte nicht geladen werden. Prüfe deine Internetverbindung und lade die Seite neu. Du kannst weiter ohne Konto spielen.</p>' + backupBlock(); return; }
    if (view === 'recovery') {
      t.textContent = 'Neues Passwort';
      body.innerHTML = '<p class="muted-note">Wähle ein neues Passwort für dein Konto.</p>' + field('acct-pw1', 'Neues Passwort (min. 8 Zeichen)', 'password', 'new-password') + field('acct-pw2', 'Passwort wiederholen', 'password', 'new-password') +
        '<button type="button" class="btn btn-primary" onclick="RSAUTH.setNewPassword()">Passwort speichern</button>';
      return;
    }
    if (user && view === 'import' && pendingImport) {
      var q = pendingImport.sm, bits = [];
      if (q.nH) bits.push(q.nH + (q.nH === 1 ? ' Heft' : ' Hefte'));
      if (q.nV) bits.push(q.nV + ' Druckverlauf-' + (q.nV === 1 ? 'Eintrag' : 'Einträge'));
      if (q.nS) bits.push(q.nS + ' Spielverlauf-' + (q.nS === 1 ? 'Eintrag' : 'Einträge'));
      t.textContent = 'Daten dieses Geräts übernehmen?';
      body.innerHTML = '<p style="margin:0">Auf diesem Gerät gibt es Daten, die du ohne Anmeldung angelegt hast: <b>' + esc(bits.join(', ')) + '</b>.</p>' +
        '<p class="muted-note">Wenn du sie übernimmst, werden sie nur zu deinem Konto <b>hinzugefügt</b>. Nichts in deinem Konto wird überschrieben oder gelöscht.</p>' +
        '<button type="button" class="btn btn-primary" onclick="RSAUTH.importAccept()">Zum Konto hinzufügen</button>' +
        '<button type="button" class="btn" onclick="RSAUTH.importDecline()">Nicht übernehmen</button>';
      return;
    }
    if (user) {
      t.textContent = 'Mein Konto';
      body.innerHTML = '<p style="margin:0">Angemeldet als <b>' + esc(user.email) + '</b></p><p id="acct-sync" class="muted-note">' + esc(lastMsg || 'Deine Rätselstände, Hefte und Arbeitsblatt-Einstellungen werden auf allen Geräten synchronisiert.') + '</p>' +
        '<button type="button" class="btn btn-primary" onclick="RSAUTH.syncNow()">Jetzt synchronisieren</button>' +
        (hasEmailLogin() ? '<div class="panel-subblock"><span class="label">Passwort ändern</span>' + field('acct-pw1', 'Neues Passwort (min. 8 Zeichen)', 'password', 'new-password') + '<button type="button" class="btn" onclick="RSAUTH.changePassword()">Passwort ändern</button></div>' : '') +
        deviceImportBtn() + backupBlock() +
        '<div class="panel-subblock"><button type="button" class="btn" onclick="RSAUTH.logout()">Abmelden</button></div>' +
        '<div class="panel-subblock"><span class="label">Konto löschen</span><p class="muted-note">Löscht dein Konto und alle in der Cloud gespeicherten Daten endgültig. Die Kopie dieser Daten auf diesem Gerät wird ebenfalls entfernt. Die Daten, die du ohne Anmeldung auf diesem Gerät hast, bleiben erhalten.</p>' + field('acct-del', 'Zur Bestätigung LÖSCHEN eingeben', 'text', 'off') + '<button type="button" class="btn" style="color:var(--error);border-color:var(--error)" onclick="RSAUTH.deleteAccount()">Konto endgültig löschen</button></div>';
      return;
    }
    if (view === 'forgot') {
      t.textContent = 'Passwort vergessen';
      body.innerHTML = '<p class="muted-note">Wir senden dir einen Link zum Zurücksetzen per E-Mail.</p>' + field('acct-email', 'E-Mail', 'email', 'email') + capHtml() +
        '<button type="button" class="btn btn-primary" onclick="RSAUTH.forgot()">Link senden</button><button type="button" class="btn btn-sm" onclick="RSAUTH.show(\'login\')">Zurück zur Anmeldung</button>';
      return;
    }
    var reg = view === 'register';
    t.textContent = reg ? 'Registrieren' : 'Anmelden';
    body.innerHTML = '<p class="muted-note">Freiwillig: Mit Konto sind deine Rätselstände, Hefte und Arbeitsblätter auf allen Geräten verfügbar.</p>' + field('acct-email', 'E-Mail', 'email', 'email') + field('acct-pw', 'Passwort' + (reg ? ' (min. 8 Zeichen)' : ''), 'password', reg ? 'new-password' : 'current-password') + capHtml() +
      '<button type="button" class="btn btn-primary" onclick="RSAUTH.' + (reg ? 'register' : 'login') + '()">' + (reg ? 'Konto erstellen' : 'Anmelden') + '</button>' +
      '<div class="muted-note" style="text-align:center;margin:2px 0">oder</div>' +
      '<button type="button" class="btn" onclick="RSAUTH.google()" style="display:flex;align-items:center;justify-content:center;gap:8px"><svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.6 5.9c4.5-4.2 7-10.3 7-17.6z"/><path fill="#FBBC05" d="M10.5 28.7A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.8-4.7l-7.9-6.1A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.8l7.9-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.9 2.3-8.3 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/></svg>Mit Google anmelden</button>' +
      '<div style="display:flex;flex-wrap:wrap;gap:8px;justify-content:space-between">' +
      '<button type="button" class="btn btn-sm" onclick="RSAUTH.show(\'' + (reg ? 'login' : 'register') + '\')">' + (reg ? 'Schon ein Konto? Anmelden' : 'Neu hier? Registrieren') + '</button>' +
      (reg ? '' : '<button type="button" class="btn btn-sm" onclick="RSAUTH.show(\'forgot\')">Passwort vergessen?</button>') + '</div>' + backupBlock();
    var pw = $('acct-pw'); if (pw) pw.addEventListener('keydown', function (e) { if (e.key === 'Enter') (reg ? RSAUTH.register : RSAUTH.login)(); });
  }
  function val(id) { var e = $(id); return e ? e.value : ''; }

  /* ---------- Sync-Kern ---------- */
  function localHefts() {
    var out = {};
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (k && k.indexOf(BK_PRE) === 0) { try { out['heft:' + k.slice(BK_PRE.length)] = JSON.parse(localStorage.getItem(k)); } catch (e) {} }
    }
    return out;
  }
  function isEmptyDefault(d) { return d && (!d.items || !d.items.length) && (!d.extras || !d.extras.length) && /^(Mein Heft|Heft \d+)$/.test(d.name || ''); }
  async function localApp() { try { var a = window.notebookAppApi; return a && a.getAppState ? await a.getAppState() : null; } catch (e) { return null; } }
  function setStatus(text) { lastMsg = text; var el = $('acct-sync'); if (el) el.textContent = text; }

  function rebuildIdx() {
    var list = [], keep = null;
    var hs = localHefts();
    Object.keys(hs).forEach(function (k) { list.push({ id: k.slice(5), name: hs[k].name || 'Heft' }); });
    try { keep = JSON.parse(localStorage.getItem(BK_IDX) || 'null'); } catch (e) {}
    var cur = keep && keep.current && list.some(function (x) { return x.id === keep.current; }) ? keep.current : (list[0] ? list[0].id : null);
    localStorage.setItem(BK_IDX, JSON.stringify({ current: cur, list: list }));
  }

  /* ---------- Daten nur hinzufügen (Geräte-Übernahme & Backup-Import) ---------- */
  function parseJ(t) { try { return JSON.parse(t); } catch (e) { return null; } }
  function hefteOf(data) {
    var out = [];
    Object.keys(data || {}).forEach(function (k) {
      if (k.indexOf(BK_PRE) === 0) { var d = parseJ(data[k]); if (d && typeof d === 'object' && !isEmptyDefault(d)) out.push({ id: k.slice(BK_PRE.length), d: d }); }
    });
    return out;
  }
  function histOf(data, sk) { var d = parseJ(data && data[SP[sk].ls]); return d && Array.isArray(d.items) ? d : null; }
  function summarize(data) {
    var h = hefteOf(data), v = histOf(data, 'verlauf'), g = histOf(data, 'spiele');
    return { hefte: h, nH: h.length, nV: v ? v.items.length : 0, nS: g ? g.items.length : 0, sig: hash(h.map(function (x) { return [x.id, x.d]; })) + '|' + hash(v) + '|' + hash(g) };
  }
  function addData(data) {
    var added = { hefte: 0, verlauf: 0, spiele: 0 };
    hefteOf(data).forEach(function (x) {
      var key = BK_PRE + x.id, ex = localStorage.getItem(key);
      if (ex !== null) {
        var e = parseJ(ex); if (e && hash(e) === hash(x.d)) return;
        key = BK_PRE + x.id + '-i' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
        x.d.name = (x.d.name || 'Heft') + ' (importiert)';
      }
      try { localStorage.setItem(key, JSON.stringify(x.d)); added.hefte++; } catch (e2) {}
    });
    Object.keys(SP).forEach(function (sk) {
      var inc = histOf(data, sk), mod = window[SP[sk].mod]; if (!inc || !inc.items.length || !mod) return;
      var cur = histOf(Object.keys(localStorage).reduce(function (o, k) { if (k === SP[sk].ls) o[k] = localStorage.getItem(k); return o; }, {}), sk) || { items: [], del: {} };
      var have = {}; cur.items.forEach(function (it) { have[it.id] = 1; });
      var merged = mod.merge(cur, { items: inc.items, del: {} });
      try { localStorage.setItem(SP[sk].ls, JSON.stringify(merged)); } catch (e3) { return; }
      merged.items.forEach(function (it) { if (!have[it.id]) added[sk]++; });
    });
    if (added.hefte) rebuildIdx();
    return added;
  }
  function addedText(a) {
    var parts = [];
    if (a.hefte) parts.push(a.hefte + (a.hefte === 1 ? ' Heft' : ' Hefte'));
    if (a.verlauf) parts.push(a.verlauf + ' Druckverlauf-' + (a.verlauf === 1 ? 'Eintrag' : 'Einträge'));
    if (a.spiele) parts.push(a.spiele + ' Spielverlauf-' + (a.spiele === 1 ? 'Eintrag' : 'Einträge'));
    return parts.length ? parts.join(', ') + ' hinzugefügt.' : 'Es gab nichts Neues zu ergänzen.';
  }
  var pendingImport = null;
  function guestSnap() { return parseJ(localStorage.getItem(NS_PRE + 'guest')); }
  function guestSummary() { var g = guestSnap(); if (!g) return null; var sm = summarize(g); return (sm.nH || sm.nV || sm.nS) ? { snap: g, sm: sm } : null; }
  function checkImport() {
    if (!user || switching || pendingImport) return;
    var g = guestSummary(); if (!g) return;
    var done = null; try { done = localStorage.getItem('rs_import_dec_' + user.id); } catch (e) {}
    if (done === g.sm.sig) return;
    pendingImport = g; view = 'import'; RSAUTH.open();
  }
  function deviceImportBtn() {
    return guestSummary() ? '<div class="panel-subblock"><span class="label">Daten dieses Geräts</span><p class="muted-note">Es gibt Hefte oder Verläufe, die du auf diesem Gerät ohne Anmeldung angelegt hast. Sie können zu deinem Konto hinzugefügt werden – nichts im Konto wird überschrieben.</p><button type="button" class="btn" onclick="RSAUTH.importAsk()">Gerätedaten übernehmen</button></div>' : '';
  }
  function backupBlock() {
    return '<div class="panel-subblock"><span class="label">Datensicherung</span><p class="muted-note">Sichert alle Hefte und Verläufe ' + (user ? 'deines Kontos' : 'dieses Geräts') + ' in einer Datei. Beim Importieren wird nur ergänzt, nichts überschrieben.</p>' +
      '<div style="display:flex;flex-wrap:wrap;gap:8px"><button type="button" class="btn" onclick="RSAUTH.exportBackup()">Backup exportieren</button><button type="button" class="btn" onclick="RSAUTH.pickBackup()">Backup importieren</button></div>' +
      '<input id="acct-import-file" type="file" accept="application/json,.json" style="display:none" onchange="RSAUTH.importBackup(this)"></div>';
  }
  async function waitSync() { for (var i = 0; i < 24 && syncing; i++) await new Promise(function (r) { setTimeout(r, 250); }); await sync(); }

  async function sync() {
    if (!sb || !user || syncing || switching) return;
    syncing = true; setStatus('Synchronisiere …');
    var needReload = false;
    try {
      var res = await sb.from('user_data').select('k,v,updated_at'); if (res.error) throw res.error;
      var remote = {}; res.data.forEach(function (r) { remote[r.k] = r.v; });
      var local = localHefts(), app = await localApp();
      if (!app && typeof window.saveStateToHost === 'function') { try { await window.saveStateToHost(); app = await localApp(); } catch (e) {} }
      if (app) local.appstate = app;
      Object.keys(SP).forEach(function (sk) {
        var lv = null; try { lv = JSON.parse(localStorage.getItem(SP[sk].ls) || 'null'); } catch (e) {}
        if (lv && Array.isArray(lv.items)) local[sk] = lv;
      });
      var H = getH(), toPush = {}, toDel = [];
      var remoteHeft = Object.keys(remote).some(function (k) { return k.indexOf('heft:') === 0; });
      var keys = {}; Object.keys(local).concat(Object.keys(remote)).forEach(function (k) { keys[k] = 1; });
      Object.keys(keys).forEach(function (k) {
        var inL = k in local, inR = k in remote, h = H[k];
        var hl = inL ? hash(local[k]) : null, hr = inR ? hash(remote[k]) : null;
        function applyRemote() {
          if (k === 'appstate') { if (window.notebookAppApi && window.notebookAppApi.setAppState) { window.notebookAppApi.setAppState(remote[k]); needReload = true; } }
          else if (SP[k]) { localStorage.setItem(SP[k].ls, JSON.stringify(remote[k])); if (window[SP[k].mod]) window[SP[k].mod].render(); }
          else { localStorage.setItem(BK_PRE + k.slice(5), JSON.stringify(remote[k])); needReload = true; }
          H[k] = hr;
        }
        function pushLocal() { if (k.indexOf('heft:') === 0 && isEmptyDefault(local[k])) return; toPush[k] = local[k]; H[k] = hl; }
        if (SP[k] && inL && inR && hl !== hr) {
          var mod = window[SP[k].mod], merged = mod ? mod.merge(local[k], remote[k]) : local[k];
          localStorage.setItem(SP[k].ls, JSON.stringify(merged));
          toPush[k] = merged; H[k] = hash(merged); if (mod) mod.render();
          return;
        }
        if (inL && inR) {
          if (hl === hr) { H[k] = hl; return; }
          var lc = hl !== h, rc = hr !== h;
          if (rc && !lc) applyRemote(); else if (lc && !rc) pushLocal(); else if (h === undefined) applyRemote(); else pushLocal();
        } else if (inL) {
          if (h !== undefined && k !== 'appstate' && !SP[k]) {
            if (hl === h) { localStorage.removeItem(BK_PRE + k.slice(5)); delete H[k]; needReload = true; } else pushLocal();
          } else if (k.indexOf('heft:') === 0 && h === undefined && isEmptyDefault(local[k]) && remoteHeft) {
            localStorage.removeItem(BK_PRE + k.slice(5)); needReload = true;
          } else pushLocal();
        } else if (inR) {
          if (h !== undefined && hr === h && !SP[k]) { toDel.push(k); delete H[k]; } else applyRemote();
        }
      });
      var rows = Object.keys(toPush).map(function (k) { return { user_id: user.id, k: k, v: toPush[k], updated_at: new Date().toISOString() }; });
      if (rows.length) { var u = await sb.from('user_data').upsert(rows); if (u.error) throw u.error; }
      if (toDel.length) { var d = await sb.from('user_data').delete().in('k', toDel); if (d.error) throw d.error; }
      setH(H);
      var wasHeft = needReload; if (wasHeft) rebuildIdx();
      setStatus('Synchronisiert um ' + new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) + ' Uhr.');
      if (needReload) {
        var lastRl = 0; try { lastRl = +sessionStorage.getItem('rs_last_reload') || 0; } catch (e) {}
        if (freshSync || Date.now() - lastRl > 20000) {
          try { sessionStorage.setItem('rs_last_reload', String(Date.now())); } catch (e) {}
          syncing = false; location.reload(); return;
        }
      }
    } catch (e) { setStatus('Synchronisierung fehlgeschlagen: ' + err(e)); }
    freshSync = false; syncing = false;
  }
  function schedulePush() {
    if (!user) return;
    if (switching) return;
    clearTimeout(pushTimer); pushTimer = setTimeout(function () { sync(); }, 1800);
  }

  /* Änderungen erkennen */
  (function hook() {
    var sp = window.schedulePersist;
    if (typeof sp === 'function') window.schedulePersist = function () { sp.apply(this, arguments); schedulePush(); };
    var os = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k) { if (switching && this === window.localStorage && isAcctKey(k)) return; os.apply(this, arguments); try { if (this === window.localStorage && typeof k === 'string' && k.indexOf('raetsel_heft') === 0) schedulePush(); } catch (e) {} };
    var orm = Storage.prototype.removeItem;
    Storage.prototype.removeItem = function (k) { if (switching && this === window.localStorage && isAcctKey(k)) return; orm.apply(this, arguments); try { if (this === window.localStorage && typeof k === 'string' && k.indexOf(BK_PRE) === 0) schedulePush(); } catch (e) {} };
    function pull() {
      if (!user || document.visibilityState !== 'visible') return;
      var pm = $('print-modal'); if (pm && pm.getAttribute('data-open') === 'true') return;
      sync();
    }
    document.addEventListener('visibilitychange', function () {
      if (!user) return;
      if (document.visibilityState === 'hidden') { clearTimeout(pushTimer); sync(); } else pull();
    });
    window.addEventListener('focus', pull);
    setInterval(pull, 60000);
  })();

  function loggedIn(session) {
    user = session ? session.user : null;
    if (ensureNamespace()) return;
    consumeFresh();
    /* Lokaler Spielstand bleibt auch ohne Anmeldung erhalten */
    try { if (user) localStorage.setItem('rs_cloud_on', '1'); else localStorage.removeItem('rs_cloud_on'); } catch (e) {}
    renderBtn(); render();
    if (user) setTimeout(checkImport, 1200);
  }

  /* ---------- Öffentliche API ---------- */
  window.RSAUTH = {
    open: function () { var m = $('acct-modal'); if (!m) return; m.setAttribute('data-open', 'true'); msg(''); render(); var f = m.querySelector('input'); if (f) f.focus(); },
    close: function () { var m = $('acct-modal'); if (m) m.setAttribute('data-open', 'false'); },
    show: function (v) { view = v; msg(''); render(); },
    login: async function () {
      var e = val('acct-email').trim(), p = val('acct-pw'); if (!e || !p) { msg('Bitte E-Mail und Passwort eingeben.', 'warning'); return; }
      if (capNeed()) return;
      msg('Anmelden …', 'info');
      var r = await sb.auth.signInWithPassword({ email: e, password: p, options: capOpt() });
      if (r.error) { capReset(); msg(err(r.error), 'error'); return; }
      markFresh(); loggedIn(r.data.session); msg('Angemeldet.', 'success'); sync();
    },
    register: async function () {
      var e = val('acct-email').trim(), p = val('acct-pw'); if (!e || p.length < 8) { msg('Bitte E-Mail und ein Passwort mit mindestens 8 Zeichen eingeben.', 'warning'); return; }
      if (capNeed()) return;
      msg('Konto wird erstellt …', 'info');
      var r = await sb.auth.signUp({ email: e, password: p, options: Object.assign({ emailRedirectTo: location.origin + location.pathname }, capOpt()) });
      if (r.error) { capReset(); msg(err(r.error), 'error'); return; }
      if (r.data.session) { markFresh(); loggedIn(r.data.session); msg('Konto erstellt und angemeldet.', 'success'); sync(); }
      else { view = 'login'; render(); msg('Fast geschafft: Wir haben dir eine Bestätigungsmail geschickt. Klicke auf den Link darin und melde dich dann an.', 'success'); }
    },
    forgot: async function () {
      var e = val('acct-email').trim(); if (!e) { msg('Bitte deine E-Mail-Adresse eingeben.', 'warning'); return; }
      if (capNeed()) return;
      var r = await sb.auth.resetPasswordForEmail(e, Object.assign({ redirectTo: location.origin + location.pathname }, capOpt()));
      capReset();
      if (r.error) { msg(err(r.error), 'error'); return; }
      msg('Falls ein Konto mit dieser E-Mail existiert, ist ein Link zum Zurücksetzen unterwegs.', 'success');
    },
    setNewPassword: async function () {
      var a = val('acct-pw1'), b = val('acct-pw2');
      if (a.length < 8) { msg('Das Passwort muss mindestens 8 Zeichen haben.', 'warning'); return; }
      if (a !== b) { msg('Die Passwörter stimmen nicht überein.', 'warning'); return; }
      var r = await sb.auth.updateUser({ password: a });
      if (r.error) { msg(err(r.error), 'error'); return; }
      view = 'login'; render(); msg('Passwort geändert. Du bist angemeldet.', 'success'); sync();
    },
    changePassword: async function () {
      var a = val('acct-pw1'); if (a.length < 8) { msg('Das Passwort muss mindestens 8 Zeichen haben.', 'warning'); return; }
      var r = await sb.auth.updateUser({ password: a });
      if (r.error) { msg(err(r.error), 'error'); return; }
      $('acct-pw1').value = ''; msg('Passwort geändert.', 'success');
    },
    logout: async function () {
      clearTimeout(pushTimer); if (user) await sync();
      try { if (user) localStorage.removeItem(HK + '_' + user.id); } catch (e) {}
      await sb.auth.signOut(); loggedIn(null); view = 'login'; render(); msg('Abgemeldet. Du siehst jetzt nur die Daten dieses Geräts.', 'info');
    },
    deleteAccount: async function () {
      if (val('acct-del').trim().toUpperCase() !== 'LÖSCHEN') { msg('Bitte gib zur Bestätigung LÖSCHEN ein.', 'warning'); return; }
      clearTimeout(pushTimer);
      var r = await sb.rpc('delete_my_account');
      if (r.error) { msg('Konto konnte nicht gelöscht werden: ' + err(r.error), 'error'); return; }
      try { Object.keys(localStorage).forEach(function (k) { if (k.indexOf(HK) === 0) localStorage.removeItem(k); }); } catch (e) {}
      discardOwner = user ? user.id : null;
      await sb.auth.signOut().catch(function () {}); loggedIn(null); view = 'login'; render(); msg('Dein Konto und alle Cloud-Daten wurden gelöscht.', 'success');
    },
    google: async function () {
      msg('Weiterleitung zu Google …', 'info'); markFresh();
      var r = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + location.pathname } });
      if (r.error) { try { sessionStorage.removeItem('rs_fresh_login'); } catch (e) {} msg(err(r.error), 'error'); }
    },
    syncNow: async function () { msg(''); await sync(); },
    importAsk: function () { var g = guestSummary(); if (!g) { msg('Auf diesem Gerät gibt es keine Daten zum Übernehmen.', 'info'); return; } pendingImport = g; view = 'import'; render(); },
    importAccept: async function () {
      if (!pendingImport || !user) return;
      var a = addData(pendingImport.snap);
      try { localStorage.setItem('rs_import_dec_' + user.id, pendingImport.sm.sig); } catch (e) {}
      pendingImport = null; view = 'login'; render(); msg(addedText(a), 'success');
      await waitSync(); setTimeout(function () { location.reload(); }, 700);
    },
    importDecline: function () {
      if (pendingImport && user) { try { localStorage.setItem('rs_import_dec_' + user.id, pendingImport.sm.sig); } catch (e) {} }
      pendingImport = null; view = 'login'; render(); msg('Die Daten dieses Geräts bleiben getrennt von deinem Konto.', 'info');
    },
    exportBackup: function () {
      var data = {};
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && (k.indexOf(BK_PRE) === 0 || k === SP.verlauf.ls || k === SP.spiele.ls)) data[k] = localStorage.getItem(k);
      }
      var out = { app: 'Rätslio', version: 1, exported: new Date().toISOString(), owner: user ? user.email : 'Gerät', data: data };
      var sm = summarize(data);
      try {
        var blob = new Blob([JSON.stringify(out)], { type: 'application/json' }), a = document.createElement('a');
        a.href = URL.createObjectURL(blob); a.download = 'raetslio-backup-' + new Date().toISOString().slice(0, 10) + '.json';
        document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
        msg('Backup gespeichert (' + sm.nH + ' Hefte, ' + sm.nV + ' Druck- und ' + sm.nS + ' Spielverlauf-Einträge).', 'success');
      } catch (e) { msg('Backup konnte nicht erstellt werden.', 'error'); }
    },
    pickBackup: function () { var f = $('acct-import-file'); if (f) f.click(); },
    importBackup: function (input) {
      var f = input && input.files && input.files[0]; if (!f) return;
      var rd = new FileReader();
      rd.onload = async function () {
        var j = parseJ(String(rd.result || '')); input.value = '';
        if (!j || j.app !== 'Rätslio' || !j.data || typeof j.data !== 'object') { msg('Diese Datei ist kein Rätslio-Backup.', 'error'); return; }
        var sm = summarize(j.data);
        if (!sm.nH && !sm.nV && !sm.nS) { msg('Das Backup enthält keine Daten.', 'warning'); return; }
        if (!confirm('Backup importieren?\n\n' + sm.nH + ' Hefte, ' + sm.nV + ' Druckverlauf- und ' + sm.nS + ' Spielverlauf-Einträge.\n\nVorhandene Daten bleiben erhalten, es wird nur ergänzt.')) return;
        var a = addData(j.data); msg(addedText(a), 'success');
        if (user) await waitSync();
        setTimeout(function () { location.reload(); }, 900);
      };
      rd.onerror = function () { msg('Datei konnte nicht gelesen werden.', 'error'); };
      rd.readAsText(f);
    }
  };

  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { var m = $('acct-modal'); if (m && m.getAttribute('data-open') === 'true') RSAUTH.close(); } });

  /* ---------- Start ---------- */
  renderBtn();
  if (configured && window.supabase) {
    try {
      sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
      sb.auth.onAuthStateChange(function (ev, session) {
        if (ev === 'PASSWORD_RECOVERY') { loggedIn(session); view = 'recovery'; RSAUTH.open(); }
        else if (ev === 'SIGNED_OUT') { loggedIn(null); }
        else if (ev === 'SIGNED_IN' && !user) { loggedIn(session); setTimeout(sync, 0); }
      });
      sb.auth.getSession().then(function (r) {
        if (r.data && r.data.session) { loggedIn(r.data.session); setTimeout(sync, 400); }
        else loggedIn(null);
      });
    } catch (e) { sb = null; }
  }
})();
