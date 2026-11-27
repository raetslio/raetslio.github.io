/* ======================================================================
   Konto (Supabase) – Anmeldung ist Pflicht
   Anmelden (E-Mail, Google oder GitHub), Abmelden, Konto löschen, Synchronisierung von Heften,
   Verläufen und App-Zustand, getrennte Datenbereiche pro Konto/Gerät.
   Eigenständiges Skript (Objekt RSAUTH), braucht die Supabase-Bibliothek.
   ====================================================================== */

/* ======================================================================
   KONTO (Supabase, Pflicht) – Sync von Rätselständen, Heften & Druckeinstellungen
   ====================================================================== */
(function () {
  'use strict';
  /* >>> HIER EINTRAGEN (Supabase → Project Settings → API) <<< */
  var SUPABASE_URL = 'https://dnhjzlnbuqmyqgjxxygx.supabase.co';
  var SUPABASE_ANON_KEY = 'sb_publishable_BrUErzbAbLbrL2LXEPBiuQ_1ijwQtWQ';

  /* >>> CAPTCHA (Cloudflare Turnstile): Site Key hier eintragen. Leer = kein Captcha. <<< */
  var TURNSTILE_SITE_KEY = '0x4AAAAAAGSlJc4Rua-I1o6g';

  var U = window.RSAUTH_UTILS; /* Hilfsfunktionen aus js/account-utils.js (geprueft in tests/) */
  var esc = U.esc, canon = U.canon, hash = U.hash, provName = U.provName, provIcon = U.provIcon, err = U.err, pkErr = U.pkErr, pkDate = U.pkDate, isEmptyDefault = U.isEmptyDefault, parseJ = U.parseJ, hefteOf = U.hefteOf, histOf = U.histOf, summarize = U.summarize;
  var BK_IDX = 'raetsel_hefte_v2', BK_PRE = U.BK_PRE;
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
  var SP = U.SP;
  var $ = function (id) { return document.getElementById(id); };
  /* Einladungslink erkannt? (muss vor dem Supabase-Start gelesen werden, der die Adresse bereinigt) */
  var INVITE = (/[#&?]type=(invite|recovery)/.exec(location.hash + location.search) || [])[1] || '', inviteShown = false, welcome = false;
  /* Beim ersten Anmelden lädt die Seite einmal neu (Konto-Daten werden getrennt). Darum den Einladungs-Hinweis merken. */
  try { if (INVITE) sessionStorage.setItem('rs_welcome', INVITE); } catch (e) {}
  function pwKind() { try { return sessionStorage.getItem('rs_welcome') || ''; } catch (e) { return INVITE; } }
  function needWelcome() { return !!pwKind(); }
  /* Eingeladene ohne eigenes Passwort werden bei jedem Laden abgemeldet (Flag pw_set wird beim Speichern des Passworts gesetzt). */
  function pwMissing(u) {
    if (!u) return false;
    var md = u.user_metadata || {}, am = u.app_metadata || {};
    if (md.pw_set) return false;
    if (!(u.invited_at || md.invited_by)) return false;
    var pr = am.providers || [am.provider]; for (var i = 0; i < pr.length; i++) if (pr[i] !== 'email') return false;
    return true;
  }
  function enforcePw(session) {
    if (!session || needWelcome() || !pwMissing(session.user)) return false;
    try { sessionStorage.setItem('rs_nopw', '1'); } catch (e) {}
    sb.auth.signOut().catch(function () {}).then(function () { loggedIn(null); showNoPw(); });
    return true;
  }
  function showNoPw() {
    if (GATE && !ON_LOGIN) return; var f = null; try { f = sessionStorage.getItem('rs_nopw'); } catch (e) {} if (!f) return;
    try { sessionStorage.removeItem('rs_nopw'); } catch (e) {}
    view = 'forgot'; RSAUTH.open(); msg('Für dieses Konto wurde noch kein Passwort festgelegt, deshalb wurdest du abgemeldet. Fordere hier einen Link an, um dein Passwort zu setzen.', 'info');
  }
  function showPw(session) { inviteShown = true; welcome = pwKind() === 'invite'; view = 'recovery'; loggedIn(session); view = 'recovery'; RSAUTH.open(); }
  function clearWelcome() { try { sessionStorage.removeItem('rs_welcome'); } catch (e) {} }
  var sb = null, user = null, pushTimer = null, syncing = false, lastMsg = '', view = 'login';
  var otpGate = false, otpEmail = '', otpStage = 'send';
  var configured = SUPABASE_URL.indexOf('DEIN-PROJEKT') < 0 && SUPABASE_ANON_KEY.indexOf('DEIN-ANON') < 0;

  /* ---------- Anmeldepflicht ---------- */
  var ON_LOGIN = /^\/login\/?(index\.html)?$/.test(location.pathname);
  var ON_KONTO = /^\/konto\/?(index\.html)?$/.test(location.pathname); /* eigene Konto-Seite */
  var GATE = true; /* true = ohne Anmeldung kein Zugriff auf die Rätselseiten */
  function nextUrl() {
    var n = '/sudoku/', q = null;
    try { q = new URLSearchParams(location.search).get('next'); if (q) sessionStorage.setItem('rs_next', q); else q = sessionStorage.getItem('rs_next'); } catch (e) {}
    if (q && q.charAt(0) === '/' && q.charAt(1) !== '/' && q.indexOf('/login') !== 0) n = q;
    return n;
  }
  function toLogin() {
    if (!GATE || ON_LOGIN) return;
    location.replace('/login/?next=' + encodeURIComponent(location.pathname + location.search) + location.hash);
  }
  function toApp() { if (ON_LOGIN) { var n = nextUrl(); try { sessionStorage.removeItem('rs_next'); } catch (e) {} location.replace(n); } }
  function reveal() { if (typeof window.__rsReveal === 'function') window.__rsReveal(); }
  function backUrl() {
    var b = null; try { b = sessionStorage.getItem('rs_konto_back'); } catch (e) {}
    if (!b) { try { var r = new URL(document.referrer); if (r.origin === location.origin) b = r.pathname + r.search; } catch (e) {} }
    return (b && b.charAt(0) === '/' && b.charAt(1) !== '/' && !/^\/(login|konto)\//.test(b)) ? b : '/sudoku/';
  }
  function lockModal() {
    if (!ON_LOGIN && !ON_KONTO) return;
    var m = $('acct-modal'); if (m) m.setAttribute('data-open', 'true');
    var c = $('acct-close');
    if (c) c.style.display = 'none'; /* Konto-Seite hat das Menü zum Wechseln */
  }

  /* Frische Anmeldung: Sync-Merkzettel dieses Geräts verwerfen, damit bei Konflikten der Stand des Kontos gewinnt */
  var freshSync = false;
  /* Nach der Rückkehr von Google/GitHub: War es ein bereits bestehendes Konto (Identität deutlich jünger als das Konto), wurde es verknüpft */
  /* Mitteilung überlebt ein Neuladen (Sync/Kontowechsel): erst nach dem Anzeigen (10 s) verwerfen, spätestens nach 2 Min. */
  function noteSet(text, kind) { try { sessionStorage.setItem('rs_note', JSON.stringify({ t: text, k: kind, at: Date.now() })); } catch (e) {} }
  function noteShow() {
    var n = null; try { n = JSON.parse(sessionStorage.getItem('rs_note') || 'null'); } catch (e) {}
    if (!n || Date.now() - n.at > 120000) { try { sessionStorage.removeItem('rs_note'); } catch (e) {} return false; }
    view = 'login'; RSAUTH.open();
    setTimeout(function () {
      msg(n.t, n.k);
      setTimeout(function () { try { sessionStorage.removeItem('rs_note'); } catch (e) {} }, 10000);
    }, 60);
    return true;
  }
  function oauthNote() {
    if (noteShow()) return;
    /* Manuell verknüpft (Konto → „verknüpfen“): Nutzer erklären, was jetzt gilt */
    var lp = null; try { lp = sessionStorage.getItem('rs_link_prov'); } catch (e) {}
    if (lp && user) {
      try { sessionStorage.removeItem('rs_link_prov'); } catch (e) {}
      var li = (user.identities || []).filter(function (i) { return i.provider === lp; })[0];
      if (li) {
        var le = li.identity_data && li.identity_data.email, mail = user.email || '';
        var other = le && mail && le.toLowerCase() !== mail.toLowerCase();
        noteSet(provName(lp) + (other ? ' (' + le + ')' : '') + ' wurde mit deinem Konto' + (mail ? ' (' + mail + ')' : '') + ' verknüpft. Du kannst dich ab jetzt mit beidem anmelden – mit deiner bisherigen Methode oder mit ' + provName(lp) + '. Es bleibt dasselbe Konto, alle Daten, Hefte und der Verlauf bleiben erhalten.', 'success');
        noteShow();
      }
      return;
    }
    var prov = null; try { prov = sessionStorage.getItem('rs_oauth_prov'); } catch (e) {}
    if (!prov || !user) return;
    try { sessionStorage.removeItem('rs_oauth_prov'); } catch (e) {}
    var idn = (user.identities || []).filter(function (i) { return i.provider === prov; })[0];
    if (!idn || !idn.created_at || !user.created_at) return;
    if (new Date(idn.created_at) - new Date(user.created_at) > 120000) {
      noteSet('Es gab bereits ein Konto mit dieser E-Mail-Adresse. Es wurde mit ' + provName(prov) + ' verknüpft – du bist in deinem bestehenden Konto angemeldet.', 'success');
      noteShow();
    }
  }

