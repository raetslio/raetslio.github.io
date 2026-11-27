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
  /* Passkey nur anzeigen, wenn Browser UND Gerät ihn wirklich nutzen können (Face ID, Fingerabdruck, Geräte-PIN) */
  var pkDev = false, mailStage = 'form', mailNew = '', secOpen = false;
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
      var delBlock = '<div class="panel-subblock"><span class="label">Konto löschen</span><p class="muted-note">Löscht dein Konto und alle in der Cloud gespeicherten Daten endgültig.</p>' + field('acct-del', 'Zur Bestätigung LÖSCHEN eingeben', 'text', 'off') + '<button type="button" class="btn" style="color:var(--error);border-color:var(--error)" onclick="RSAUTH.deleteAccount()">Konto endgültig löschen</button></div>';
      var mailBlock = '', mailNotice = '';
      try {
        var pend = localStorage.getItem('rs_mail_pending');
        if (pend && user.email && pend === user.email.toLowerCase()) { localStorage.setItem('rs_mail_notice', '1'); localStorage.removeItem('rs_mail_pending'); }
        if (localStorage.getItem('rs_mail_notice') === '1') mailNotice = '<div class="feedback-banner success" role="status" style="display:flex;gap:8px;align-items:center;justify-content:space-between"><span>Fertig: Deine E-Mail-Adresse wurde auf <b>' + esc(user.email || '') + '</b> geändert.</span><button type="button" class="btn btn-sm" onclick="RSAUTH.mailNoticeClose()">OK</button></div>';
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
        themeBlock() +
        '<details class="acct-sec" id="acct-sec"' + (secOpen ? ' open' : '') + ' ontoggle="RSAUTH.secToggle(this.open)"><summary>' + provIcon('key') + '<span>Sicherheit</span></summary>' + mailBlock + pwBlock + methodsBlock() + '<div id="acct-otpbox"></div>' + delBlock + '</details>' +
        '<div class="panel-subblock"><span class="label">Jemanden einladen</span><p class="muted-note">Wir senden eine E-Mail mit einem Link zur Anmeldung bei Rätslio?.</p>' + field('acct-invite', 'E-Mail der eingeladenen Person', 'email', 'off') + '<button type="button" class="btn" onclick="RSAUTH.invite()">Einladung senden</button></div>' ;
      
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

