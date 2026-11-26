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

  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function canon(v) {
    if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']';
    if (v && typeof v === 'object') return '{' + Object.keys(v).sort().map(function (k) { return JSON.stringify(k) + ':' + canon(v[k]); }).join(',') + '}';
    return JSON.stringify(v === undefined ? null : v);
  }
  function hash(v) { var s = canon(v), h = 5381; for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return s.length + ':' + h; }
  /* Frische Anmeldung: Sync-Merkzettel dieses Geräts verwerfen, damit bei Konflikten der Stand des Kontos gewinnt */
  var freshSync = false;
  var PROV = { email: 'E-Mail', google: 'Google', github: 'GitHub' };
  function provName(k) { return PROV[k] || k; }
  var ICONS = {
    logout: '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>',
    google: '<svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.6 5.9c4.5-4.2 7-10.3 7-17.6z"/><path fill="#FBBC05" d="M10.5 28.7A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.8-4.7l-7.9-6.1A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.8l7.9-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.9 2.3-8.3 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/></svg>',
    github: '<svg width="18" height="18" viewBox="0 0 16 16" aria-hidden="true" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>',
    key: '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="7.5" cy="15.5" r="4"/><path d="M10.5 12.5L20 3"/><path d="M17 6l3 3"/><path d="M14 9l2.5 2.5"/></svg>',
    email: '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>'
  };
  function provIcon(k) { return ICONS[k] || ''; }
  /* Nach der Rückkehr von Google/GitHub: War es ein bereits bestehendes Konto (Identität deutlich jünger als das Konto), wurde es verknüpft */
  function oauthNote() {
    var prov = null; try { prov = sessionStorage.getItem('rs_oauth_prov'); } catch (e) {}
    if (!prov || !user) return;
    try { sessionStorage.removeItem('rs_oauth_prov'); } catch (e) {}
    var idn = (user.identities || []).filter(function (i) { return i.provider === prov; })[0];
    if (!idn || !idn.created_at || !user.created_at) return;
    if (new Date(idn.created_at) - new Date(user.created_at) > 120000) {
      view = 'login'; RSAUTH.open();
      setTimeout(function () { msg('Es gab bereits ein Konto mit dieser E-Mail-Adresse. Es wurde mit ' + provName(prov) + ' verknüpft – du bist in deinem bestehenden Konto angemeldet.', 'success'); }, 60);
    }
  }

  /* ---------- Profilbild ---------- */
  var avatarCustom = null, nameCustom = '';
  function nmKey() { return 'rs_name_' + (user ? user.id : ''); }
  function avKey() { return 'rs_avatar_' + (user ? user.id : ''); }
  function loadAvatarCache() { avatarCustom = null; nameCustom = ''; try { if (user) { var cv = localStorage.getItem(avKey()); avatarCustom = cv === 'none' ? '' : (cv || null); nameCustom = localStorage.getItem(nmKey()) || ''; } } catch (e) {} }
  function setAvCache(v) { try { if (v === null || v === undefined) localStorage.removeItem(avKey()); else localStorage.setItem(avKey(), v === '' ? 'none' : v); } catch (e) {} }
  /* Kein Name aus dem Google-/GitHub-Konto: nur eigener Anzeigename, sonst E-Mail */
  function displayName() { return nameCustom || (user ? user.email : ''); }
  function avatarUrl() {
    if (avatarCustom) return avatarCustom;
    if (avatarCustom === '') return ''; /* Bild bewusst entfernt: auch kein Google-/GitHub-Bild */
    var md = (user && user.user_metadata) || {};
    return md.avatar_url || md.picture || '';
  }
  function avatarHtml(size) {
    var u = avatarUrl(), st = 'width:' + size + 'px;height:' + size + 'px;border-radius:50%;flex:none;';
    if (u) return '<img src="' + esc(u) + '" alt="Profilbild" referrerpolicy="no-referrer" style="' + st + 'object-fit:cover;background:var(--surface-variant,#ddd)">';
    var ch = user && user.email ? user.email.charAt(0).toUpperCase() : '?';
    return '<span aria-hidden="true" style="' + st + 'display:inline-flex;align-items:center;justify-content:center;background:var(--sage,#7a9a7e);color:#fff;font-weight:600;font-size:' + Math.round(size * 0.45) + 'px">' + esc(ch) + '</span>';
  }
  function resizeImage(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        try {
          var S = 192, c = document.createElement('canvas'); c.width = c.height = S;
          var side = Math.min(img.width, img.height), sx = (img.width - side) / 2, sy = (img.height - side) / 2;
          var ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, S, S);
          ctx.drawImage(img, sx, sy, side, side, 0, 0, S, S);
          URL.revokeObjectURL(url); resolve(c.toDataURL('image/jpeg', 0.85));
        } catch (e) { reject(e); }
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('bad image')); };
      img.src = url;
    });
  }
  async function saveProfile(av, nm) {
    var r = (av !== null || nm)
      ? await sb.from('user_data').upsert({ user_id: user.id, k: 'profile', v: { avatar: av, name: nm || '' }, updated_at: new Date().toISOString() })
      : await sb.from('user_data').delete().eq('k', 'profile');
    if (r.error) throw r.error;
    avatarCustom = av; nameCustom = nm || '';
    setAvCache(av);
    try {
      if (nm) localStorage.setItem(nmKey(), nm); else localStorage.removeItem(nmKey());
    } catch (e) {}
    renderBtn(); render();
  }
  function saveAvatar(dataUrl) { return saveProfile(dataUrl, nameCustom); }
  function profileBlock() {
    return '<div style="display:flex;align-items:center;gap:14px">' + avatarHtml(64) +
      '<div style="display:flex;flex-direction:column;gap:6px;min-width:0"><div style="overflow-wrap:anywhere"><b>' + esc(displayName()) + '</b><div class="muted-note">' + esc(user.email) + '</div></div>' +
      '<div style="display:flex;flex-wrap:wrap;gap:6px"><button type="button" class="btn btn-sm" onclick="RSAUTH.pickAvatar()">' + (avatarUrl() ? 'Bild ändern' : 'Profilbild festlegen') + '</button>' +
      (avatarUrl() ? '<button type="button" class="btn btn-sm" onclick="RSAUTH.removeAvatar()">Entfernen</button>' : '') + '</div></div>' +
      '<input id="acct-avatar-file" type="file" accept="image/*" style="display:none" onchange="RSAUTH.setAvatar(this)"></div>' +
      '<div class="field-group"><label class="field-label" for="acct-name">Anzeigename</label><div style="display:flex;gap:8px"><input id="acct-name" class="input-control" type="text" maxlength="40" autocomplete="nickname" placeholder="' + esc(user.email.split('@')[0]) + '" value="' + esc(nameCustom) + '" style="flex:1;min-width:0"><button type="button" class="btn" onclick="RSAUTH.saveName()">Speichern</button></div></div>';
  }

  /* ---------- Konto existiert nicht mehr (z. B. in Supabase gelöscht) ---------- */
  var aliveChecked = false;
  async function checkAlive() {
    if (!sb || !user) return true;
    try {
      var r = await sb.auth.getUser();
      if (!r.error) { aliveChecked = true; return true; }
      var st = r.error.status, code = r.error.code || '', m = r.error.message || '';
      if (st === 401 || st === 403 || st === 404 || /user_not_found|session_not_found|bad_jwt/i.test(code) || /does not exist|user not found|session.*not.*found|invalid jwt/i.test(m)) {
        await accountGone(); return false;
      }
    } catch (e) {}
    return true;
  }
  async function accountGone() {
    try { sessionStorage.setItem('rs_gone', '1'); } catch (e) {}
    discardOwner = user ? user.id : null;
    try { if (user) { localStorage.removeItem(HK + '_' + user.id); localStorage.removeItem('rs_avatar_' + user.id); } } catch (e) {}
    clearTimeout(pushTimer);
    try { await sb.auth.signOut({ scope: 'local' }); } catch (e) {}
    loggedIn(null); view = 'login'; showGone();
  }
  function showGone() {
    if (GATE && !ON_LOGIN) return; var f = null; try { f = sessionStorage.getItem('rs_gone'); } catch (e) {} if (!f) return;
    try { sessionStorage.removeItem('rs_gone'); } catch (e) {}
    view = 'login'; RSAUTH.open(); setTimeout(function () { msg('Dein Konto existiert nicht mehr, deshalb wurdest du abgemeldet.', 'warning'); }, 60);
  }
  function methodsBlock() {
    var ids = (user && user.identities) || [], have = ids.map(function (i) { return i.provider; });
    var rows = ids.map(function (i) {
      return '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin:4px 0"><span style="display:inline-flex;align-items:center;gap:8px">' + provIcon(i.provider) + provName(i.provider) + '</span>' +
        (ids.length > 1 ? '<button type="button" class="btn btn-sm" onclick="RSAUTH.unlink(\'' + i.provider + '\')">Trennen</button>' : '') + '</div>';
    }).join('');
    var add = ['google', 'github'].filter(function (k) { return have.indexOf(k) < 0; }).map(function (k) {
      return '<button type="button" class="btn btn-sm" onclick="RSAUTH.link(\'' + k + '\')" style="display:inline-flex;align-items:center;gap:6px">' + provIcon(k) + provName(k) + ' verknüpfen</button>';
    }).join(' ');
    return '<div class="panel-subblock"><span class="label">Anmeldemethoden</span>' + rows + (add ? '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:8px">' + add + '</div>' : '') + '</div>';
  }
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
      [/token has expired|otp_expired|invalid.*(token|otp)|otp.*invalid/i, 'Der Code ist falsch oder abgelaufen. Fordere bei Bedarf einen neuen an.'],
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
    var dn = user ? displayName() : ''; l.textContent = user ? (dn.length > 18 ? dn.slice(0, 16) + '…' : dn) : 'Anmelden';
    b.classList.toggle('btn-sage', !!user);
    var svg = b.querySelector('svg.icon-svg'), img = $('account-avatar-btn'), u = user ? avatarUrl() : '';
    if (u) {
      if (!img) { img = document.createElement('img'); img.id = 'account-avatar-btn'; img.alt = ''; img.referrerPolicy = 'no-referrer'; img.style.cssText = 'width:20px;height:20px;border-radius:50%;object-fit:cover;flex:none'; b.insertBefore(img, l); }
      if (img.getAttribute('src') !== u) img.src = u;
      if (svg) svg.style.display = 'none';
    } else {
      if (img) img.remove();
      if (svg) svg.style.display = '';
    }
  }

  /* ---------- Face ID / Fingerabdruck (Passkeys) ---------- */
  function pkOk() {
    try { return !!(window.PublicKeyCredential && sb && sb.auth && typeof sb.auth.signInWithPasskey === 'function' && typeof sb.auth.registerPasskey === 'function'); } catch (e) { return false; }
  }
  function pkErr(e) {
    var n = (e && e.name) || '', c = (e && e.code) || '', m = (e && e.message) || '';
    if (n === 'NotAllowedError' || n === 'AbortError' || /not allowed|cancel|abort|timed out/i.test(m)) return 'Abgebrochen. Du kannst es erneut versuchen oder dich mit Passwort anmelden.';
    if (c === 'passkey_disabled') return 'Face ID / Fingerabdruck ist in Supabase noch nicht aktiviert (Authentication → Passkeys).';
    if (c === 'too_many_passkeys') return 'Du hast die maximale Anzahl an Passkeys erreicht. Lösche zuerst einen alten.';
    if (c === 'webauthn_credential_exists') return 'Dieses Gerät ist bereits für dein Konto eingerichtet.';
    if (c === 'webauthn_credential_not_found') return 'Auf diesem Gerät wurde kein passender Passkey gefunden. Melde dich mit Passwort an und richte ihn im Konto ein.';
    if (c === 'webauthn_challenge_expired') return 'Die Abfrage ist abgelaufen. Bitte versuche es erneut.';
    if (c === 'email_not_confirmed') return 'Bitte bestätige zuerst deine E-Mail-Adresse.';
    return err(e);
  }
  function pkBlock() {
    if (!pkOk()) return '';
    return '<div class="panel-subblock"><span class="label" style="display:inline-flex;align-items:center;gap:6px">' + provIcon('key') + 'Passkey (Face ID / Fingerabdruck)</span>' +
      '<p class="muted-note">Melde dich auf diesem Gerät statt mit Passwort per Face ID, Fingerabdruck oder Geräte-PIN an. Das Passwort funktioniert weiterhin.</p>' +
      '<div id="acct-passkeys"></div>' +
      '<button type="button" class="btn" onclick="RSAUTH.passkeyAdd()" style="display:inline-flex;align-items:center;gap:8px">' + provIcon('key') + 'Passkey einrichten</button></div>';
  }
  function pkDate(v) { try { return new Date(v).toLocaleDateString('de-DE'); } catch (e) { return ''; } }
  async function loadPasskeys() {
    var box = $('acct-passkeys'); if (!box || !user || !pkOk()) return;
    try {
      var r = await sb.auth.passkey.list();
      if (r.error) { box.innerHTML = ''; return; }
      var list = Array.isArray(r.data) ? r.data : ((r.data && r.data.passkeys) || []);
      box = $('acct-passkeys'); if (!box) return;
      box.innerHTML = list.map(function (p) {
        return '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin:4px 0"><span style="overflow-wrap:anywhere;min-width:0">' + esc(p.friendly_name || 'Passkey') +
          (p.created_at ? '<span class="muted-note"> · eingerichtet am ' + esc(pkDate(p.created_at)) + '</span>' : '') + '</span>' +
          '<span style="display:inline-flex;gap:6px;flex:none"><button type="button" class="btn btn-sm" onclick="RSAUTH.passkeyRename(\'' + esc(p.id) + '\')">Umbenennen</button>' +
          '<button type="button" class="btn btn-sm" onclick="RSAUTH.passkeyDelete(\'' + esc(p.id) + '\')">Löschen</button></span></div>';
      }).join('') + (list.length ? otpToggleHtml() : '');
      if (!list.length && otpOn()) { sb.auth.updateUser({ data: { otp_required: false } }).then(function (u) { if (u && u.data && u.data.user) user = u.data.user; }); }
    } catch (e) {}
  }
  function otpOn() { return !!(user && user.user_metadata && user.user_metadata.otp_required); }
  function otpToggleHtml() {
    return '<label style="display:flex;gap:8px;align-items:flex-start;margin:10px 0"><input type="checkbox" id="acct-otp-req" style="margin-top:3px"' + (otpOn() ? ' checked' : '') + ' onchange="RSAUTH.otpToggle(this.checked)">' +
      '<span>Bei Anmeldung mit Passwort zusätzlich einen Code per E-Mail verlangen<span class="muted-note" style="display:block">Schützt dein Konto, falls jemand dein Passwort kennt. Gilt nicht für die Anmeldung mit Passkey, Google oder GitHub.</span></span></label>';
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

  function render() { renderBody(); if (!user) capInit(); else loadPasskeys(); }
  function renderBody() {
    var body = $('acct-body'), t = $('acct-title'); if (!body) return;
    if (!configured) {
      t.textContent = 'Konto';
      body.innerHTML = '<p class="muted-note">Die Anmeldung ist noch nicht eingerichtet. Trage in der Datei bei <b>SUPABASE_URL</b> und <b>SUPABASE_ANON_KEY</b> deine Projektdaten ein.</p>';
      return;
    }
    if (!sb) { body.innerHTML = '<p class="muted-note">Der Anmeldedienst konnte nicht geladen werden. Prüfe deine Internetverbindung und lade die Seite neu.</p>'; return; }
    if (view === 'recovery') {
      t.textContent = welcome ? 'Willkommen bei Rätslio?' : 'Neues Passwort';
      body.innerHTML = '<p class="muted-note">' + (welcome ? 'Dein Konto ist bestätigt. Lege jetzt dein Passwort fest, damit du dich später jederzeit anmelden kannst.' : 'Wähle ein neues Passwort für dein Konto.') + '</p>' + field('acct-pw1', 'Neues Passwort (min. 8 Zeichen)', 'password', 'new-password') + field('acct-pw2', 'Passwort wiederholen', 'password', 'new-password') +
        '<button type="button" class="btn btn-primary" onclick="RSAUTH.setNewPassword()">Passwort speichern</button>';
      return;
    }
    if (user && view === 'pksetup') {
      t.textContent = 'Passkey einrichten';
      body.innerHTML = '<div style="display:flex;justify-content:center;color:var(--sage,#7a9a7e)">' + provIcon('key').replace(/width="18" height="18"/, 'width="56" height="56"') + '</div>' +
        '<p style="margin:0;text-align:center">Dein Konto ist erstellt. Möchtest du jetzt einen <b>Passkey</b> einrichten? Dann meldest du dich auf diesem Gerät mit Face ID, Fingerabdruck oder Geräte-PIN an – ohne Passwort.</p>' +
        '<button type="button" class="btn btn-primary" onclick="RSAUTH.passkeyAdd()" style="display:flex;align-items:center;justify-content:center;gap:8px">' + provIcon('key') + 'Passkey jetzt einrichten</button>' +
        '<button type="button" class="btn btn-sm" onclick="RSAUTH.passkeySkip()">Später</button>' +
        '<p class="muted-note">Du kannst das auch später unter „Mein Konto“ tun. Dein Passwort funktioniert weiterhin.</p>';
      return;
    }
    if (user) {
      t.textContent = 'Mein Konto';
      var pwBlock = hasEmailLogin() ? '<div class="panel-subblock"><span class="label">Passwort ändern</span>' + field('acct-pw1', 'Neues Passwort (min. 8 Zeichen)', 'password', 'new-password') + '<button type="button" class="btn" onclick="RSAUTH.changePassword()">Passwort ändern</button></div>' : '';
      body.innerHTML = profileBlock() + '<p id="acct-sync" class="muted-note">' + esc(lastMsg || 'Deine Rätselstände, Hefte und Arbeitsblatt-Einstellungen werden auf allen Geräten synchronisiert.') + '</p>' +
        '<button type="button" class="btn btn-primary" onclick="RSAUTH.syncNow()">Jetzt synchronisieren</button>' +
        '<button type="button" class="btn btn-logout" onclick="RSAUTH.logout()">' + provIcon('logout') + '<span>Abmelden</span></button>' +
        themeBlock() + pwBlock + pkBlock() + methodsBlock() +
        '<div class="panel-subblock"><span class="label">Jemanden einladen</span><p class="muted-note">Wir senden eine E-Mail mit einem Link zur Anmeldung bei Rätslio?.</p>' + field('acct-invite', 'E-Mail der eingeladenen Person', 'email', 'off') + '<button type="button" class="btn" onclick="RSAUTH.invite()">Einladung senden</button></div>' +
        '<div class="panel-subblock"><span class="label">Konto löschen</span><p class="muted-note">Löscht dein Konto und alle in der Cloud gespeicherten Daten endgültig.</p>' + field('acct-del', 'Zur Bestätigung LÖSCHEN eingeben', 'text', 'off') + '<button type="button" class="btn" style="color:var(--error);border-color:var(--error)" onclick="RSAUTH.deleteAccount()">Konto endgültig löschen</button></div>';
      return;
    }
    if (view === 'otp') {
      t.textContent = 'Code bestätigen';
      body.innerHTML = otpStage === 'send'
        ? '<p class="muted-note">Für dieses Konto ist die Anmeldung mit Passwort zusätzlich durch einen Code geschützt. Wir senden ihn an <b>' + esc(otpEmail) + '</b>.</p>' + capHtml() +
          '<button type="button" class="btn btn-primary" onclick="RSAUTH.otpSend()">Code per E-Mail senden</button><button type="button" class="btn btn-sm" onclick="RSAUTH.otpCancel()">Abbrechen</button>'
        : '<p class="muted-note">Gib den Code ein, den wir an <b>' + esc(otpEmail) + '</b> geschickt haben.</p>' + field('acct-otp', 'Code aus der E-Mail', 'text', 'one-time-code') +
          '<button type="button" class="btn btn-primary" onclick="RSAUTH.otpVerify()">Anmelden</button><button type="button" class="btn btn-sm" onclick="RSAUTH.otpAgain()">Neuen Code anfordern</button><button type="button" class="btn btn-sm" onclick="RSAUTH.otpCancel()">Abbrechen</button>';
      var oi = $('acct-otp'); if (oi) { oi.setAttribute('inputmode', 'numeric'); oi.addEventListener('keydown', function (e) { if (e.key === 'Enter') RSAUTH.otpVerify(); }); }
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
    body.innerHTML = '<p class="muted-note">' + (GATE ? 'Bitte melde dich an oder registriere dich, um Rätslio? zu nutzen. Deine Rätselstände, Hefte und Arbeitsblätter sind dann auf allen Geräten verfügbar.' : 'Freiwillig: Mit Konto sind deine Rätselstände, Hefte und Arbeitsblätter auf allen Geräten verfügbar.') + '</p>' + field('acct-email', 'E-Mail', 'email', 'email') + field('acct-pw', 'Passwort' + (reg ? ' (min. 8 Zeichen)' : ''), 'password', reg ? 'new-password' : 'current-password') + capHtml() +
      '<button type="button" class="btn btn-primary" onclick="RSAUTH.' + (reg ? 'register' : 'login') + '()">' + (reg ? 'Konto erstellen' : 'Anmelden') + '</button>' +
      '<div class="muted-note" style="text-align:center;margin:2px 0">oder</div>' +
      (pkOk() ? (reg ? '' : '<button type="button" class="btn" onclick="RSAUTH.passkeyLogin()" style="display:flex;align-items:center;justify-content:center;gap:8px">' + provIcon('key') + 'Mit Passkey anmelden</button>') : '') +
      '<button type="button" class="btn" onclick="RSAUTH.google()" style="display:flex;align-items:center;justify-content:center;gap:8px">' + provIcon('google') + 'Mit Google fortfahren</button>' +
      '<button type="button" class="btn" onclick="RSAUTH.github()" style="display:flex;align-items:center;justify-content:center;gap:8px">' + provIcon('github') + 'Mit GitHub fortfahren</button>' +
      '<div style="display:flex;flex-wrap:wrap;gap:8px;justify-content:space-between">' +
      '<button type="button" class="btn btn-sm" onclick="RSAUTH.show(\'' + (reg ? 'login' : 'register') + '\')">' + (reg ? 'Schon ein Konto? Anmelden' : 'Neu hier? Registrieren') + '</button>' +
      (reg ? '' : '<button type="button" class="btn btn-sm" onclick="RSAUTH.show(\'forgot\')">Passwort vergessen?</button>') + '</div>';
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

  /* ---------- Daten nur hinzufügen (Geräte-Übernahme) ---------- */
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
  function checkImport() { /* Konto ist Pflicht: keine Nachfrage mehr zur Übernahme von Gerätedaten */ }
  /* Konto nur mit Passkey: nach der E-Mail-Bestätigung gleich den Passkey einrichten lassen */
  function pkNewMail() { try { return localStorage.getItem('rs_pk_new') || ''; } catch (e) { return ''; } }
  function checkPk() {
    if (!user || switching || !pkNewMail()) return;
    if (pkNewMail() !== String(user.email || '').toLowerCase()) return;
    if (view === 'recovery' || view === 'import' || needWelcome()) return; /* nie ein anderes Fenster verdrängen */
    if (!pkOk()) { try { localStorage.removeItem('rs_pk_new'); } catch (e) {} return; }
    view = 'pksetup'; RSAUTH.open();
  }
  function themeBlock() {
    var cur = (window.appState && appState.theme) || 'system';
    var opts = [['system', 'Gerät'], ['light', 'Hell'], ['dark', 'Dunkel']];
    return '<div class="panel-subblock"><span class="label">Darstellung</span><div id="acct-theme" style="display:flex;flex-wrap:wrap;gap:8px">' + opts.map(function (o) {
      return '<button type="button" class="btn btn-sm' + (cur === o[0] ? ' btn-primary' : '') + '" data-theme-opt="' + o[0] + '" aria-pressed="' + (cur === o[0]) + '" onclick="RSAUTH.setTheme(\'' + o[0] + '\')">' + o[1] + '</button>';
    }).join('') + '</div><p class="muted-note">„Gerät“ folgt der Einstellung deines Geräts.</p></div>';
  }
  async function waitSync() { for (var i = 0; i < 24 && syncing; i++) await new Promise(function (r) { setTimeout(r, 250); }); await sync(); }

  async function sync() {
    if (!sb || !user || syncing || switching) return;
    syncing = true; setStatus('Synchronisiere …');
    var needReload = false;
    try {
      var res = await sb.from('user_data').select('k,v,updated_at'); if (res.error) throw res.error;
      if (!aliveChecked && !(await checkAlive())) { syncing = false; return; }
      var remote = {}; res.data.forEach(function (r) { remote[r.k] = r.v; });
      if ('profile' in remote) {
        var pa = remote.profile && remote.profile.avatar != null ? remote.profile.avatar : null, pn = remote.profile && remote.profile.name || ''; delete remote.profile;
        if (pa !== avatarCustom || pn !== nameCustom) { avatarCustom = pa; nameCustom = pn; setAvCache(pa); try { if (pn) localStorage.setItem(nmKey(), pn); else localStorage.removeItem(nmKey()); } catch (e) {} renderBtn(); var ab = $('acct-body'); if (ab && user && view !== 'import' && !ab.contains(document.activeElement)) render(); }
      }
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
    } catch (e) {
      freshSync = false; syncing = false;
      if (await checkAlive()) setStatus('Synchronisierung fehlgeschlagen: ' + err(e));
      return;
    }
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
    consumeFresh(); loadAvatarCache();
    /* Lokaler Spielstand bleibt auch ohne Anmeldung erhalten */
    try { if (user) localStorage.setItem('rs_cloud_on', '1'); else localStorage.removeItem('rs_cloud_on'); } catch (e) {}
    renderBtn(); render();
    if (!user) { toLogin(); return; }
    reveal();
    if (ON_LOGIN) { if (view !== 'recovery' && !(needWelcome() && !inviteShown)) toApp(); return; }
    oauthNote();
    setTimeout(checkPk, 400); setTimeout(checkImport, 1200);
  }

  /* ---------- Öffentliche API ---------- */
  window.RSAUTH = {
    open: function () {
      var m = $('acct-modal'); if (!m) return; if (GATE && !ON_LOGIN && !user) { toLogin(); return; }
      /* Eingeloggt: „Mein Konto“ ist eine eigene Seite. Einrichtungs-Schritte (Passkey, Passwort) bleiben Fenster. */
      if (user && !ON_KONTO && !ON_LOGIN && view === 'login') { try { sessionStorage.setItem('rs_konto_back', location.pathname + location.search); } catch (e) {} location.href = '/konto/'; return; }
       m.setAttribute('data-open', 'true'); msg(''); render(); var f = m.querySelector('input'); if (f) f.focus(); },
    close: function () { if (ON_LOGIN) return; if (ON_KONTO && view === 'login') { location.href = backUrl(); return; } clearWelcome(); welcome = false; var m = $('acct-modal'); if (m) m.setAttribute('data-open', 'false'); },
    show: function (v) { view = v; msg(''); render(); },
    login: async function () {
      var e = val('acct-email').trim(), p = val('acct-pw'); if (!e || !p) { msg('Bitte E-Mail und Passwort eingeben.', 'warning'); return; }
      if (capNeed()) return;
      msg('Anmelden …', 'info');
      otpGate = true; var r;
      try { r = await sb.auth.signInWithPassword({ email: e, password: p, options: capOpt() }); } finally { otpGate = false; }
      if (r.error) { capReset(); msg(err(r.error), 'error'); return; }
      var umd = (r.data && r.data.user && r.data.user.user_metadata) || {};
      if (umd.otp_required) {
        /* Passwort stimmt, aber der Code per E-Mail fehlt noch: Sitzung sofort wieder beenden */
        try { await sb.auth.signOut({ scope: 'local' }); } catch (x) {}
        otpEmail = e; otpStage = 'send'; capReset(); view = 'otp'; render(); msg('Passwort richtig. Jetzt noch den Code aus der E-Mail eingeben.', 'info'); return;
      }
      markFresh(); loggedIn(r.data.session); msg('Angemeldet.', 'success'); sync();
    },
    register: async function () {
      var e = val('acct-email').trim(), p = val('acct-pw'); if (!e || p.length < 8) { msg('Bitte E-Mail und ein Passwort mit mindestens 8 Zeichen eingeben.', 'warning'); return; }
      if (capNeed()) return;
      msg('Konto wird erstellt …', 'info');
      var r = await sb.auth.signUp({ email: e, password: p, options: Object.assign({ emailRedirectTo: location.origin + location.pathname }, capOpt()) });
      if (r.error) { capReset(); msg(err(r.error), 'error'); return; }
      try { localStorage.setItem('rs_pk_new', e.toLowerCase()); } catch (x) {} /* danach Passkey vorschlagen */
      if (r.data.session) { markFresh(); loggedIn(r.data.session); sync(); }
      else { view = 'login'; render(); msg('Fast geschafft: Wir haben dir eine Bestätigungsmail geschickt. Klicke auf den Link darin. Danach schlagen wir dir vor, einen Passkey einzurichten.', 'success'); }
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
      var r = await sb.auth.updateUser({ password: a, data: { pw_set: true } });
      if (r.error) { msg(err(r.error), 'error'); return; }
      var wasWelcome = welcome; welcome = false; clearWelcome();
      view = 'login'; render(); msg(wasWelcome ? 'Passwort gespeichert. Willkommen bei Rätslio? – du bist angemeldet.' : 'Passwort geändert. Du bist angemeldet.', 'success'); sync(); if (ON_LOGIN) { setTimeout(toApp, 900); return; } setTimeout(checkPk, 1200); setTimeout(checkImport, 2000);
    },
    changePassword: async function () {
      var a = val('acct-pw1'); if (a.length < 8) { msg('Das Passwort muss mindestens 8 Zeichen haben.', 'warning'); return; }
      var r = await sb.auth.updateUser({ password: a, data: { pw_set: true } });
      if (r.error) { msg(err(r.error), 'error'); return; }
      $('acct-pw1').value = ''; msg('Passwort geändert.', 'success');
    },
    invite: async function () {
      var e = val('acct-invite').trim(); if (!e) { msg('Bitte gib die E-Mail-Adresse der Person ein.', 'warning'); return; }
      msg('Einladung wird gesendet …', 'info');
      try {
        var r = await sb.functions.invoke('invite-user', { body: { email: e } });
        if (r.error) { msg('Die Einladung konnte nicht gesendet werden. Bitte versuche es später erneut.', 'error'); return; }
        if (!r.data || !r.data.ok) { msg((r.data && r.data.error) || 'Die Einladung konnte nicht gesendet werden.', 'error'); return; }
        var f = $('acct-invite'); if (f) f.value = '';
        msg('Einladung an ' + e + ' wurde gesendet.', 'success');
      } catch (x) { msg('Keine Verbindung zum Server.', 'error'); }
    },
    logout: async function () {
      clearTimeout(pushTimer); if (user) await sync();
      try { if (user) localStorage.removeItem(HK + '_' + user.id); } catch (e) {}
      await sb.auth.signOut(); loggedIn(null); view = 'login'; render(); msg('Abgemeldet.', 'info');
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
      msg('Weiterleitung zu Google …', 'info'); markFresh(); try { sessionStorage.setItem('rs_oauth_prov', 'google'); } catch (e) {}
      var r = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + location.pathname } });
      if (r.error) { try { sessionStorage.removeItem('rs_fresh_login'); } catch (e) {} msg(err(r.error), 'error'); }
    },
    link: async function (prov) {
      msg('Weiterleitung zu ' + provName(prov) + ' …', 'info');
      var r = await sb.auth.linkIdentity({ provider: prov, options: { redirectTo: location.origin + location.pathname } });
      if (r.error) msg(/manual linking/i.test(r.error.message || '') ? 'Das Verknüpfen ist in Supabase noch nicht aktiviert (Authentication → Sign In / Providers → „Allow manual linking").' : err(r.error), 'error');
    },
    unlink: async function (prov) {
      var ids = (user && user.identities) || [], idn = ids.filter(function (i) { return i.provider === prov; })[0];
      if (!idn || ids.length < 2) { msg('Mindestens eine Anmeldemethode muss bleiben.', 'warning'); return; }
      if (!confirm(provName(prov) + ' wirklich von deinem Konto trennen?')) return;
      var r = await sb.auth.unlinkIdentity(idn);
      if (r.error) { msg(err(r.error), 'error'); return; }
      var g = await sb.auth.getUser(); if (g.data && g.data.user) user = g.data.user;
      render(); msg(provName(prov) + ' wurde getrennt.', 'success');
    },
    passkeyLogin: async function () {
      if (capNeed()) return;
      msg('Passkey wird abgefragt …', 'info');
      var r; try { r = await sb.auth.signInWithPasskey(capOn() ? { options: { captchaToken: capToken } } : undefined); } catch (x) { r = { error: x }; }
      capReset();
      if (!r || r.error || !r.data || !r.data.session) { msg(pkErr(r && r.error), 'error'); return; }
      markFresh(); loggedIn(r.data.session); msg('Angemeldet.', 'success'); sync();
    },
    otpSend: async function () {
      if (capNeed()) return;
      msg('Code wird gesendet …', 'info');
      var r = await sb.auth.signInWithOtp({ email: otpEmail, options: Object.assign({ shouldCreateUser: false }, capOpt()) });
      capReset();
      if (r.error) { msg(err(r.error), 'error'); return; }
      otpStage = 'verify'; render(); msg('Wir haben dir einen Code per E-Mail geschickt.', 'success');
    },
    otpVerify: async function () {
      var c = val('acct-otp').replace(/\s/g, ''); if (!c) { msg('Bitte den Code aus der E-Mail eingeben.', 'warning'); return; }
      msg('Code wird geprüft …', 'info');
      var r = await sb.auth.verifyOtp({ email: otpEmail, token: c, type: 'email' });
      if (r.error || !r.data || !r.data.session) { msg(err(r.error || new Error('invalid token')), 'error'); return; }
      markFresh(); view = 'login'; loggedIn(r.data.session); msg('Angemeldet.', 'success'); sync();
    },
    otpAgain: function () { otpStage = 'send'; msg(''); render(); },
    otpCancel: function () { otpEmail = ''; view = 'login'; msg(''); render(); },
    otpToggle: async function (on) {
      var r = await sb.auth.updateUser({ data: { otp_required: !!on } });
      if (r.error) { msg(err(r.error), 'error'); var cb = $('acct-otp-req'); if (cb) cb.checked = !on; return; }
      if (r.data && r.data.user) user = r.data.user;
      msg(on ? 'Bei Anmeldung mit Passwort wird jetzt zusätzlich ein Code per E-Mail verlangt.' : 'Der zusätzliche E-Mail-Code ist ausgeschaltet.', 'success');
    },
    passkeySkip: function () { try { localStorage.removeItem('rs_pk_new'); } catch (e) {} view = 'login'; render(); msg('Du kannst den Passkey jederzeit unter „Mein Konto“ einrichten.', 'info'); setTimeout(checkImport, 600); },
    passkeyAdd: async function () {
      msg('Passkey wird eingerichtet …', 'info');
      var r; try { r = await sb.auth.registerPasskey(); } catch (x) { r = { error: x }; }
      if (!r || r.error) { msg(pkErr(r && r.error), 'error'); return; }
      try { localStorage.removeItem('rs_pk_new'); } catch (e) {}
      var wasSetup = view === 'pksetup'; if (wasSetup) { view = 'login'; render(); }
      msg('Eingerichtet. Du kannst dich auf diesem Gerät jetzt mit deinem Passkey anmelden.', 'success'); loadPasskeys();
      if (wasSetup) setTimeout(checkImport, 1500);
    },
    passkeyRename: async function (id) {
      var n = prompt('Neuer Name für diesen Zugang (z. B. „iPhone“):', ''); if (n === null) return;
      n = n.trim().slice(0, 120); if (!n) return;
      var r; try { r = await sb.auth.passkey.update({ passkeyId: id, friendlyName: n }); } catch (x) { r = { error: x }; }
      if (r && r.error) { msg(pkErr(r.error), 'error'); return; }
      msg('Name geändert.', 'success'); loadPasskeys();
    },
    passkeyDelete: async function (id) {
      if (!confirm('Diesen Face-ID-/Fingerabdruck-Zugang wirklich löschen?')) return;
      var r; try { r = await sb.auth.passkey.delete({ passkeyId: id }); } catch (x) { r = { error: x }; }
      if (r && r.error) { msg(pkErr(r.error), 'error'); return; }
      msg('Zugang gelöscht.', 'success'); loadPasskeys();
    },
    github: async function () {
      msg('Weiterleitung zu GitHub …', 'info'); markFresh(); try { sessionStorage.setItem('rs_oauth_prov', 'github'); } catch (e) {}
      var r = await sb.auth.signInWithOAuth({ provider: 'github', options: { redirectTo: location.origin + location.pathname } });
      if (r.error) { try { sessionStorage.removeItem('rs_fresh_login'); } catch (e) {} msg(err(r.error), 'error'); }
    },
    saveName: async function () {
      var n = val('acct-name').trim().replace(/\s+/g, ' ').slice(0, 40);
      try { msg('Name wird gespeichert …', 'info'); await saveProfile(avatarCustom, n); msg(n ? 'Anzeigename gespeichert.' : 'Anzeigename entfernt.', 'success'); }
      catch (e) { msg('Der Name konnte nicht gespeichert werden: ' + err(e), 'error'); }
    },
    setTheme: function (m) {
      if (typeof applyTheme !== 'function') return;
      applyTheme(m); if (typeof schedulePersist === 'function') schedulePersist();
      var box = $('acct-theme'); if (!box) return;
      Array.prototype.forEach.call(box.querySelectorAll('button'), function (b) { var on = b.getAttribute('data-theme-opt') === m; b.classList.toggle('btn-primary', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
    },
    pickAvatar: function () { var f = $('acct-avatar-file'); if (f) f.click(); },
    setAvatar: async function (input) {
      var f = input && input.files && input.files[0]; if (!f) return; input.value = '';
      if (!/^image\//.test(f.type)) { msg('Bitte wähle eine Bilddatei aus.', 'warning'); return; }
      try { msg('Profilbild wird gespeichert …', 'info'); await saveAvatar(await resizeImage(f)); msg('Profilbild gespeichert.', 'success'); }
      catch (e) { msg('Das Profilbild konnte nicht gespeichert werden: ' + err(e), 'error'); }
    },
    removeAvatar: async function () {
      try { await saveAvatar(''); msg('Profilbild entfernt.', 'success'); }
      catch (e) { msg('Das Profilbild konnte nicht entfernt werden: ' + err(e), 'error'); }
    },
    syncNow: async function () { msg(''); await sync(); },
  };

  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !ON_KONTO) { var m = $('acct-modal'); if (m && m.getAttribute('data-open') === 'true') RSAUTH.close(); } });

  /* ---------- Start ---------- */
  if (ON_LOGIN) { /* Anmeldeseite: Darstellung immer „Gerät“, gespeicherte Wahl bleibt unberührt */
    try { var sv = localStorage.getItem('rs_theme'); if (typeof applyTheme === 'function') applyTheme('system'); if (sv === null) localStorage.removeItem('rs_theme'); else lsSetRaw.call(localStorage, 'rs_theme', sv); } catch (e) {}
  }
  if (ON_LOGIN) nextUrl(); /* Ziel merken, falls die Anmeldung über Google/GitHub die Seite verlässt */
  renderBtn(); lockModal();
  if (configured && window.supabase) {
    try {
      sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, experimental: { passkey: true } } });
      sb.auth.onAuthStateChange(function (ev, session) {
        if (ev === 'SIGNED_IN' && otpGate) return; /* Passwort-Anmeldung läuft: erst nach Code-Prüfung entscheiden */
        if (ev === 'PASSWORD_RECOVERY') { try { if (!pwKind()) sessionStorage.setItem('rs_welcome', 'recovery'); } catch (e) {} if (!inviteShown) showPw(session); }
        else if (ev === 'SIGNED_OUT') { loggedIn(null); }
        else if (ev === 'SIGNED_IN' && needWelcome() && !inviteShown && session) { showPw(session); }
        else if (ev === 'SIGNED_IN' && enforcePw(session)) { }
        else if (ev === 'SIGNED_IN' && !user) { loggedIn(session); setTimeout(sync, 0); }
      });
      sb.auth.getSession().then(function (r) {
        if (r.data && r.data.session && enforcePw(r.data.session)) { }
        else if (r.data && r.data.session && needWelcome() && !inviteShown) { showPw(r.data.session); }
        else if (r.data && r.data.session) { loggedIn(r.data.session); setTimeout(sync, 400); }
        else { loggedIn(null); showNoPw(); showGone(); }
      });
    } catch (e) { sb = null; }
  }
  /* Dienst nicht verfügbar: mit gespeicherter Anmeldung offline weiterspielen, sonst zur Anmeldeseite */
  if (!sb) {
    var hasTok = false; try { hasTok = !!localStorage.getItem('sb-dnhjzlnbuqmyqgjxxygx-auth-token'); } catch (e) {}
    if (hasTok && !ON_LOGIN) reveal(); else if (!ON_LOGIN) toLogin(); else { lockModal(); render(); }
  }
})();
