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
    return '<div class="panel-subblock"><span class="label">Anmeldemethoden</span>' + rows + (add ? '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:8px">' + add + '</div>' : '') + pkBlock() + '</div>';
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

  function msg(text, kind) {
    var el = $('acct-msg'); if (!el) return;
    if (!text) { el.classList.add('hidden'); return; }
    el.className = 'feedback-banner ' + (kind || 'info'); el.textContent = text;
  }

  /* ---------- Header-Button ---------- */
  function renderBtn() {
    try { if (typeof rsApplyAbDefaults === 'function') rsApplyAbDefaults(); } catch (e) {}
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
  /* Passkey nur anzeigen, wenn Browser UND Gerät ihn wirklich nutzen können (Face ID, Fingerabdruck, Geräte-PIN) */
  var pkDev = false, mailStage = 'form', mailNew = '', profDraft = '', supDraft = '', secOpen = { sec: false, des: false, ab: false };
  function pkDetect() {
    try {
      if (!window.PublicKeyCredential || typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable !== 'function') return;
      PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable().then(function (ok) {
        if (ok === pkDev) return; pkDev = !!ok;
        if (!pkDev) return;
        var em = document.getElementById('acct-email'), pw = document.getElementById('acct-pw');
        if ((em && em.value) || (pw && pw.value)) return; /* nichts überschreiben, was gerade getippt wird */
        if (typeof render === 'function' && document.getElementById('acct-body')) render();
        if (typeof checkPk === 'function') checkPk();
      }).catch(function () { pkDev = false; });
    } catch (e) { pkDev = false; }
  }
  function pkOk() {
    try { return !!(pkDev && window.PublicKeyCredential && sb && sb.auth && typeof sb.auth.signInWithPasskey === 'function' && typeof sb.auth.registerPasskey === 'function'); } catch (e) { return false; }
  }
  function pkBlock() {
    if (!pkOk()) return '';
    /* Teil des Blocks „Anmeldemethoden“ (siehe methodsBlock) */
    return '<div style="margin-top:12px"><span style="display:inline-flex;align-items:center;gap:8px;font-weight:600">' + provIcon('key') + 'Passkey (Face ID / Fingerabdruck)</span>' +
      '<p class="muted-note">Melde dich auf diesem Gerät statt mit Passwort per Face ID, Fingerabdruck oder Geräte-PIN an. Das Passwort funktioniert weiterhin.</p>' +
      '<div id="acct-passkeys"></div>' +
      '<button type="button" class="btn btn-sm" onclick="RSAUTH.passkeyAdd()" style="display:inline-flex;align-items:center;gap:6px">' + provIcon('key') + 'Passkey einrichten</button></div>';
  }
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
      }).join('');
      var ob = $('acct-otpbox'); if (ob) ob.innerHTML = list.length ? '<div class="panel-subblock"><span class="label">Zusätzliche Sicherheit</span>' + otpToggleHtml() + '</div>' : '';
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

  function render() { renderBody(); if (!user || (user && $('acct-captcha'))) capInit(); if (user) loadPasskeys(); }
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
    if (user && view === 'profsetup') {
      t.textContent = 'Profil einrichten';
      body.innerHTML = '<p class="muted-note">Dein Konto ist erstellt. Wie sollen wir dich nennen? Name und Profilbild sind freiwillig. Ohne Namen nehmen wir den Teil deiner E-Mail-Adresse vor dem @.</p>' +
        '<div style="display:flex;align-items:center;gap:14px">' + avatarHtml(72) + '<div style="display:flex;flex-wrap:wrap;gap:6px"><button type="button" class="btn btn-sm" onclick="RSAUTH.pickAvatar()">' + (avatarUrl() ? 'Bild ändern' : 'Profilbild wählen') + '</button>' + (avatarUrl() ? '<button type="button" class="btn btn-sm" onclick="RSAUTH.removeAvatar()">Entfernen</button>' : '') + '</div>' +
        '<input id="acct-avatar-file" type="file" accept="image/*" style="display:none" onchange="RSAUTH.setAvatar(this)"></div>' +
        '<div class="field-group"><label class="field-label" for="acct-name">Anzeigename (optional)</label><input id="acct-name" class="input-control" type="text" maxlength="40" autocomplete="nickname" placeholder="' + esc(user.email.split('@')[0]) + '" value="' + esc(profDraft || nameCustom) + '" oninput="RSAUTH.nameDraft(this.value)"></div>' +
        '<button type="button" class="btn btn-primary" onclick="RSAUTH.profDone()">Fertig</button><button type="button" class="btn btn-sm" onclick="RSAUTH.profSkip()">Überspringen</button>';
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
      var sessBlock = '<div class="panel-subblock"><span class="label">Geräte</span><p class="muted-note">Meldet dich überall ab, auch auf diesem Gerät, zum Beispiel wenn ein Gerät verloren ging.</p><button type="button" class="btn btn-logout" onclick="RSAUTH.logoutAll()">' + provIcon('logout') + '<span>Auf allen Geräten abmelden</span></button></div>';
      var delBlock = '<div class="panel-subblock"><span class="label">Konto löschen</span><p class="muted-note">Löscht dein Konto und alle in der Cloud gespeicherten Daten endgültig.</p>' + field('acct-del', 'Zur Bestätigung LÖSCHEN eingeben', 'text', 'off') + '<button type="button" class="btn" style="color:var(--error);border-color:var(--error)" onclick="RSAUTH.deleteAccount()">Konto endgültig löschen</button></div>';
      var mailBlock = '', mailNotice = '';
      try {
        var pend = localStorage.getItem('rs_mail_pending');
        if (pend && user.email && pend === user.email.toLowerCase()) { localStorage.setItem('rs_mail_notice', '1'); localStorage.removeItem('rs_mail_pending'); }
        if (localStorage.getItem('rs_mail_notice') === '1') mailNotice = '<div class="feedback-banner success" role="status" style="display:flex;gap:8px;align-items:center;justify-content:space-between"><span>Fertig: Deine E-Mail-Adresse wurde auf <b>' + esc(user.email || '') + '</b> geändert.</span><button type="button" class="btn btn-sm" style="flex:none;width:auto;white-space:nowrap" onclick="RSAUTH.mailNoticeClose()">OK</button></div>';
      } catch (x) {}
      if (hasEmailLogin()) {
        mailBlock = '<div class="panel-subblock"><span class="label">E-Mail-Adresse ändern</span>';
        if (mailStage === 'send') {
          mailBlock += '<p class="muted-note">Passwort stimmt. Zur Sicherheit senden wir einen Code an deine <b>aktuelle</b> Adresse <b>' + esc(user.email || '') + '</b>.</p>' + capHtml() +
            '<button type="button" class="btn btn-primary" onclick="RSAUTH.mailSendCode()">Code an aktuelle Adresse senden</button><button type="button" class="btn btn-sm" onclick="RSAUTH.mailCancel()">Abbrechen</button>';
        } else if (mailStage === 'code') {
          mailBlock += '<p class="muted-note">Gib den Code ein, den wir an <b>' + esc(user.email || '') + '</b> geschickt haben. Danach senden wir einen Bestätigungslink an <b>' + esc(mailNew) + '</b>.</p>' + field('acct-mailcode', 'Code aus der E-Mail', 'text', 'one-time-code') +
            '<button type="button" class="btn btn-primary" onclick="RSAUTH.mailVerify()">Code bestätigen</button><button type="button" class="btn btn-sm" onclick="RSAUTH.mailSendCode()">Neuen Code anfordern</button><button type="button" class="btn btn-sm" onclick="RSAUTH.mailCancel()">Abbrechen</button>';
        } else if (user.new_email) {
          mailBlock += '<p class="muted-note">Fast fertig: Wir haben einen Bestätigungslink an <b>' + esc(user.new_email) + '</b> geschickt. Klicke darauf, dann gilt die neue Adresse. Bis dahin meldest du dich weiter mit <b>' + esc(user.email || '') + '</b> an.</p>' +
            '<button type="button" class="btn btn-sm" onclick="RSAUTH.mailRestart()">Andere Adresse wählen</button>';
        } else {
          mailBlock += '<p class="muted-note">Aktuell: <b>' + esc(user.email || '') + '</b>. Gib die neue Adresse und dein Passwort ein. Danach bestätigst du mit einem Code an die aktuelle Adresse und einem Link an die neue.</p>' +
            field('acct-newmail', 'Neue E-Mail-Adresse', 'email', 'email') + field('acct-mailpw', 'Dein Passwort', 'password', 'current-password') + capHtml() +
            '<button type="button" class="btn" onclick="RSAUTH.changeEmail()">Weiter</button>';
        }
        mailBlock += '</div>';
      }
      body.innerHTML = mailNotice + profileBlock() + '<p id="acct-sync" class="muted-note">' + esc(lastMsg || 'Deine Rätselstände, Hefte und Arbeitsblatt-Einstellungen werden auf allen Geräten synchronisiert.') + '</p>' +
        '<button type="button" class="btn btn-primary" onclick="RSAUTH.syncNow()">Jetzt synchronisieren</button>' +
        '<button type="button" class="btn btn-logout" onclick="RSAUTH.logout()">' + provIcon('logout') + '<span>Abmelden</span></button>' +
        designSection() + abBlock() +
        details('sec', provIcon('key'), 'Sicherheit', mailBlock + pwBlock + methodsBlock() + '<div id="acct-otpbox"></div>' + sessBlock + delBlock) +
        '<div class="panel-subblock"><span class="label">Jemanden einladen</span><p class="muted-note">Wir senden eine E-Mail mit einem Link zur Anmeldung bei Rätslio?.</p>' + field('acct-invite', 'E-Mail der eingeladenen Person', 'email', 'off') + '<button type="button" class="btn" onclick="RSAUTH.invite()">Einladung senden</button></div>' +
        '<div class="panel-subblock" id="acct-support"><span class="label">Support</span><p class="muted-note">Frage, Fehler oder Idee? Schreib uns direkt. Deine E-Mail-Adresse (' + esc(user.email || '') + ') wird mitgeschickt, damit wir dir antworten können.</p>' +
        '<div class="field-group"><label class="field-label" for="acct-sup-topic">Worum geht es?</label><select id="acct-sup-topic" class="input-control"><option value="question">Frage</option><option value="bug">Fehler melden</option><option value="idea">Idee / Wunsch</option><option value="other">Sonstiges</option></select></div>' +
        '<div class="field-group"><label class="field-label" for="acct-sup-msg">Nachricht</label><textarea id="acct-sup-msg" class="input-control" rows="5" maxlength="4000" placeholder="Beschreibe kurz, was du erlebt hast oder dir wünschst." style="resize:vertical">' + esc(supDraft) + '</textarea></div>' +
        '<button type="button" class="btn btn-primary" onclick="RSAUTH.supportSend()">Nachricht senden</button></div>';
      
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
  /* Nach dem Erstellen eines Kontos: Name und Profilbild abfragen (optional) */
  function profNewMail() { try { return localStorage.getItem('rs_prof_new') || ''; } catch (e) { return ''; } }
  function checkProf() {
    if (!user || switching) return;
    var md = user.user_metadata || {};
    if (md.prof_done) { try { localStorage.removeItem('rs_prof_new'); } catch (e) {} return; } /* auf einem anderen Gerät schon erledigt */
    if (!profNewMail()) { /* Erste Anmeldung über Google/GitHub: Konto ist gerade erst entstanden */
      var ap = (user.app_metadata || {}).provider, c = Date.parse(user.created_at), l = Date.parse(user.last_sign_in_at);
      if (ap && ap !== 'email' && isFinite(c) && isFinite(l) && Math.abs(l - c) < 15 * 60 * 1000) { try { localStorage.setItem('rs_prof_new', String(user.email || '').toLowerCase()); } catch (e) {} }
    }
    if (!profNewMail()) return;
    if (profNewMail() !== String(user.email || '').toLowerCase()) return;
    if (view === 'recovery' || view === 'import' || needWelcome()) return;
    view = 'profsetup'; RSAUTH.open();
  }
  function checkPk() {
    if (!user || switching || !pkNewMail()) return;
    if (pkNewMail() !== String(user.email || '').toLowerCase()) return;
    if (view === 'recovery' || view === 'import' || view === 'profsetup' || needWelcome()) return; /* nie ein anderes Fenster verdrängen */
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
  var IC_AB = '<svg class="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>';
  var IC_DS = '<svg class="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.8-.8 1.8-1.7 0-.5-.2-.9-.5-1.2-.3-.3-.5-.7-.5-1.2 0-.9.7-1.6 1.6-1.6H17a4 4 0 0 0 4-4C21 6.6 17 3 12 3z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10" cy="7" r="1"/><circle cx="15" cy="7" r="1"/></svg>';
  function details(key, icon, title, inner) {
    return '<details class="acct-sec" id="acct-sec-' + key + '"' + (secOpen[key] ? ' open' : '') + ' ontoggle="RSAUTH.secToggle(\'' + key + '\',this.open)"><summary>' + icon + '<span>' + title + '</span></summary>' + inner + '</details>';
  }
  function accentBlock() {
    var cur = (window.appState && appState.accent) || 'default';
    var cols = { 'default': '#3c5a6e', green: '#3f6e49', orange: '#a8573a', violet: '#6a4f8c', rose: '#a03b52', teal: '#1f7a7a' };
    return '<div class="panel-subblock"><span class="label">Akzentfarbe</span><div id="acct-accent" style="display:flex;flex-wrap:wrap;gap:10px">' + Object.keys(cols).map(function (k) {
      var nm = (window.RS_ACCENTS && RS_ACCENTS[k] && RS_ACCENTS[k].name) || k;
      return '<button type="button" class="acct-swatch" title="' + nm + '" aria-label="' + nm + '" aria-pressed="' + (cur === k) + '" style="background:' + cols[k] + '" onclick="RSAUTH.setAccent(\'' + k + '\')"></button>';
    }).join('') + '</div></div>';
  }
  function designSection() { return details('des', IC_DS, 'Design', themeBlock() + accentBlock()); }
  function abBlock() {
    var p = (window.appState && appState.print) || {}, nm = p.nameMode === 'account' ? 'account' : 'line', dm = p.dateMode === 'line' ? 'line' : 'today', sl = p.showLink !== false;
    function row(key, label, cur, opts) {
      return '<div class="field-group"><span class="field-label">' + label + '</span><div style="display:flex;flex-wrap:wrap;gap:8px">' + opts.map(function (o) {
        return '<button type="button" class="btn btn-sm' + (cur === o[0] ? ' btn-primary' : '') + '" aria-pressed="' + (cur === o[0]) + '" onclick="RSAUTH.setAb(\'' + key + '\',\'' + o[0] + '\')">' + o[1] + '</button>';
      }).join('') + '</div></div>';
    }
    var inner = '<div class="panel-subblock">' +
      row('nameMode', 'Name vorausfüllen', nm, [['line', 'Schreiblinie'], ['account', 'Name des Kontos']]) +
      row('dateMode', 'Datum vorausfüllen', dm, [['today', 'Datum des Tages'], ['line', 'Schreiblinie']]) +
      '<label style="display:flex;gap:8px;align-items:flex-start;margin:6px 0"><input type="checkbox" style="margin-top:3px"' + (sl ? ' checked' : '') + ' onchange="RSAUTH.setLink(this.checked)"><span>Webseiten-Link unten auf dem Blatt anzeigen<span class="muted-note" style="display:block">„Arbeitsblatt · raetslio.github.io“ in der Fußzeile.</span></span></label>' +
      '<p class="muted-note">Gilt für das Druckfenster. Name und Datum kannst du dort weiterhin von Hand ändern.</p></div>';
    return details('ab', IC_AB, 'Arbeitsblätter', inner);
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

  /* Hinweis „E-Mail-Adresse geändert“: bleibt nach Neuladen sichtbar, bis er bestätigt wurde */
  var mailPopupOpen = false;
  function mailDonePopup() {
    if (!user || mailPopupOpen || typeof rsConfirm !== 'function') return;
    try {
      var pend = localStorage.getItem('rs_mail_pending');
      if (pend && user.email && pend === user.email.toLowerCase()) { localStorage.setItem('rs_mail_notice', '1'); localStorage.removeItem('rs_mail_pending'); }
      if (localStorage.getItem('rs_mail_notice') !== '1') return;
    } catch (e) { return; }
    mailPopupOpen = true;
    rsConfirm('Deine E-Mail-Adresse wurde auf ' + (user.email || '') + ' geändert. Ab jetzt meldest du dich damit an.', { title: 'E-Mail-Adresse geändert', ok: 'OK', cancel: 'Schließen' }).then(function () {
      mailPopupOpen = false;
      try { localStorage.removeItem('rs_mail_notice'); } catch (e) {}
      render();
    });
  }
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
    setTimeout(checkProf, 300); setTimeout(checkPk, 400); setTimeout(checkImport, 1200); setTimeout(mailDonePopup, 500);
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
      try { localStorage.setItem('rs_pk_new', e.toLowerCase()); localStorage.setItem('rs_prof_new', e.toLowerCase()); } catch (x) {} /* danach Profil und Passkey vorschlagen */
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
      view = 'login'; render(); msg(wasWelcome ? 'Passwort gespeichert. Willkommen bei Rätslio? – du bist angemeldet.' : 'Passwort geändert. Du bist angemeldet.', 'success'); sync(); if (ON_LOGIN) { try { if (wasWelcome && user && user.email) localStorage.setItem('rs_prof_new', user.email.toLowerCase()); } catch (x) {} setTimeout(toApp, 900); return; } try { if (wasWelcome && user && user.email) localStorage.setItem('rs_prof_new', user.email.toLowerCase()); } catch (x) {} setTimeout(checkProf, 1000); setTimeout(checkPk, 1200); setTimeout(checkImport, 2000);
    },
    changePassword: async function () {
      var a = val('acct-pw1'); if (a.length < 8) { msg('Das Passwort muss mindestens 8 Zeichen haben.', 'warning'); return; }
      var r = await sb.auth.updateUser({ password: a, data: { pw_set: true } });
      if (r.error) { msg(err(r.error), 'error'); return; }
      $('acct-pw1').value = ''; msg('Passwort geändert.', 'success');
    },
    changeEmail: async function () {
      var e = val('acct-newmail').trim().toLowerCase(), pw = val('acct-mailpw');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) { msg('Bitte gib eine gültige E-Mail-Adresse ein.', 'warning'); return; }
      if (user && user.email && e === user.email.toLowerCase()) { msg('Das ist bereits deine E-Mail-Adresse.', 'info'); return; }
      if (!pw) { msg('Bitte gib zur Bestätigung dein Passwort ein.', 'warning'); return; }
      if (capNeed()) return;
      msg('Passwort wird geprüft …', 'info');
      var c; otpGate = true;
      try { c = await sb.auth.signInWithPassword({ email: user.email, password: pw, options: capOpt() }); } catch (x) { c = { error: x }; } finally { otpGate = false; }
      capReset();
      if (c.error) { msg(err(c.error), 'error'); return; }
      mailNew = e; mailStage = 'send'; secOpen.sec = true; render(); msg('');
      if (!capOn()) RSAUTH.mailSendCode();
    },
    mailSendCode: async function () {
      if (!user || !mailNew) return;
      if (capNeed()) return;
      msg('Code wird gesendet …', 'info');
      var r = await sb.auth.signInWithOtp({ email: user.email, options: Object.assign({ shouldCreateUser: false }, capOpt()) });
      capReset();
      if (r.error) { msg(err(r.error), 'error'); return; }
      mailStage = 'code'; render(); msg('Wir haben einen Code an ' + user.email + ' geschickt.', 'success');
    },
    mailVerify: async function () {
      var c = val('acct-mailcode').replace(/\s/g, ''); if (!c) { msg('Bitte den Code aus der E-Mail eingeben.', 'warning'); return; }
      msg('Code wird geprüft …', 'info');
      var r = await sb.auth.verifyOtp({ email: user.email, token: c, type: 'email' });
      if (r.error) { msg(err(r.error), 'error'); return; }
      var u = await sb.auth.updateUser({ email: mailNew }, { emailRedirectTo: location.origin + location.pathname });
      if (u.error) { msg(err(u.error), 'error'); return; }
      if (u.data && u.data.user) user = u.data.user;
      try { localStorage.setItem('rs_mail_pending', mailNew); localStorage.removeItem('rs_mail_notice'); } catch (x) {}
      var n = mailNew; mailStage = 'form'; mailNew = ''; render(); msg('Wir haben einen Bestätigungslink an ' + n + ' geschickt.', 'success');
    },
    mailCancel: function () { mailStage = 'form'; mailNew = ''; msg(''); render(); },
    mailRestart: function () { try { localStorage.removeItem('rs_mail_pending'); } catch (x) {} if (user) user.new_email = ''; mailStage = 'form'; msg(''); render(); },
    mailNoticeClose: function () { try { localStorage.removeItem('rs_mail_notice'); } catch (x) {} render(); },
    secToggle: function (k, o) { secOpen[k] = !!o; },
    setAccent: function (k) { if (typeof applyAccent !== 'function') return; applyAccent(k); if (typeof schedulePersist === 'function') schedulePersist(); render(); },
    setLink: function (on) { if (typeof appState === 'undefined' || !appState.print) return; appState.print.showLink = !!on; if (typeof renderPrintPreview === 'function') { try { renderPrintPreview(); } catch (e) {} } if (typeof schedulePersist === 'function') schedulePersist(); },
    supportSend: async function () {
      var m = val('acct-sup-msg').trim(), t = val('acct-sup-topic') || 'question';
      supDraft = m;
      if (m.length < 5) { msg('Bitte schreibe eine Nachricht (mindestens 5 Zeichen).', 'warning'); return; }
      msg('Nachricht wird gesendet …', 'info');
      try {
        var r = await sb.functions.invoke('support', { body: { topic: t, message: m, page: location.pathname, ua: navigator.userAgent } });
        if (r.error) { var st = r.error.context && r.error.context.status; msg(st === 404 ? 'Der Support ist noch nicht eingerichtet (Funktion „support“ fehlt). Bitte versuche es später erneut.' : 'Die Nachricht konnte nicht gesendet werden (' + (st ? 'Fehler ' + st : 'keine Verbindung') + '). Bitte versuche es später erneut.', 'error'); return; }
        if (!r.data || !r.data.ok) { msg(((r.data && r.data.error) || 'Die Nachricht konnte nicht gesendet werden.') + (r.data && r.data.code ? ' (' + r.data.code + ')' : ''), 'error'); return; }
        supDraft = ''; var el = $('acct-sup-msg'); if (el) el.value = '';
        msg('Danke! Deine Nachricht ist bei uns angekommen. Wir antworten dir per E-Mail.', 'success');
      } catch (e) { msg('Die Nachricht konnte nicht gesendet werden. Bitte versuche es später erneut.', 'error'); }
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
    logoutAll: async function () {
      if (!(await rsConfirm('Du wirst auf allen Geräten abgemeldet, auch auf diesem. Danach musst du dich überall neu anmelden.', { title: 'Auf allen Geräten abmelden', ok: 'Überall abmelden', danger: true }))) return;
      clearTimeout(pushTimer); if (user) await sync();
      try { if (user) localStorage.removeItem(HK + '_' + user.id); } catch (e) {}
      var r = await sb.auth.signOut({ scope: 'global' });
      if (r && r.error) { msg(err(r.error), 'error'); return; }
      loggedIn(null); view = 'login'; render(); msg('Auf allen Geräten abgemeldet.', 'info');
    },
    printName: function () { return nameCustom || (user && user.email ? user.email.split('@')[0] : ''); },
    setAb: function (key, val) {
      if (typeof appState === 'undefined' || !appState.print) return;
      appState.print[key] = val;
      if (typeof rsApplyAbDefaults === 'function') rsApplyAbDefaults(true);
      if (typeof schedulePersist === 'function') schedulePersist();
      render();
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
      msg('Weiterleitung zu ' + provName(prov) + ' …', 'info'); try { sessionStorage.setItem('rs_link_prov', prov); } catch (e) {}
      var r = await sb.auth.linkIdentity({ provider: prov, options: { redirectTo: location.origin + location.pathname } });
      if (r.error) { try { sessionStorage.removeItem('rs_link_prov'); } catch (e) {} }
      if (r.error) msg(/manual linking/i.test(r.error.message || '') ? 'Das Verknüpfen ist in Supabase noch nicht aktiviert (Authentication → Sign In / Providers → „Allow manual linking").' : err(r.error), 'error');
    },
    unlink: async function (prov) {
      var ids = (user && user.identities) || [], idn = ids.filter(function (i) { return i.provider === prov; })[0];
      if (!idn || ids.length < 2) { msg('Mindestens eine Anmeldemethode muss bleiben.', 'warning'); return; }
      if (!(await rsConfirm(provName(prov) + ' wirklich von deinem Konto trennen? Du kannst dich dann nicht mehr damit anmelden.', { title: 'Anmeldemethode trennen', ok: 'Trennen', danger: true }))) return;
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
    nameDraft: function (v) { profDraft = v; },
    profDone: async function () {
      var n = (profDraft || '').trim().replace(/\s+/g, ' ').slice(0, 40);
      if (n) { try { msg('Wird gespeichert …', 'info'); await saveProfile(avatarCustom, n); } catch (e) { msg('Der Name konnte nicht gespeichert werden: ' + err(e), 'error'); return; } }
      RSAUTH.profSkip();
    },
    profSkip: function () {
      try { localStorage.removeItem('rs_prof_new'); } catch (e) {} profDraft = ''; view = 'login'; msg('');
      try { sb.auth.updateUser({ data: { prof_done: true } }).catch(function () {}); } catch (e) {}
      var willPk = false; try { willPk = !!pkNewMail() && pkNewMail() === String((user && user.email) || '').toLowerCase() && pkOk(); } catch (e) {}
      if (willPk) { render(); setTimeout(checkPk, 200); } else if (!ON_KONTO) { RSAUTH.close(); render(); } else render();
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
      if (!(await rsConfirm('Diesen Face-ID-/Fingerabdruck-Zugang wirklich löschen? Das lässt sich nicht rückgängig machen.', { title: 'Zugang löschen', ok: 'Löschen', danger: true }))) return;
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
  renderBtn(); lockModal(); pkDetect();
  try { if (/[#?&]type=email_change\b/.test(location.hash + location.search)) localStorage.setItem('rs_mail_notice', '1'); } catch (e) {} /* Link aus der Bestätigungs-E-Mail */
  if (configured && window.supabase) {
    try {
      sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, experimental: { passkey: true } } });
      sb.auth.onAuthStateChange(function (ev, session) {
        if (ev === 'SIGNED_IN' && otpGate) return; /* Passwort-Anmeldung läuft: erst nach Code-Prüfung entscheiden */
        if (ev === 'PASSWORD_RECOVERY') { try { if (!pwKind()) sessionStorage.setItem('rs_welcome', 'recovery'); } catch (e) {} if (!inviteShown) showPw(session); }
        else if (ev === 'SIGNED_OUT') { loggedIn(null); }
        else if (ev === 'USER_UPDATED' && session && user) { user = session.user; setTimeout(mailDonePopup, 300); }
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
