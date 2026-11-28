  /* ---------- Öffentliche API ---------- */
  window.RSAUTH = {
    open: function () {
      var m = $('acct-modal'); if (!m) return;
      if (ON_SUPPORT && !user) { location.href = '/login/?next=' + encodeURIComponent('/support/'); return; }
      if (GATE && !ON_LOGIN && !user) { toLogin(); return; }
      /* Eingeloggt: „Mein Konto“ ist eine eigene Seite. Einrichtungs-Schritte (Passkey, Passwort) bleiben Fenster. */
      if (user && !ON_LOGIN && view === 'login' && typeof window.rsShowKonto === 'function' && window.rsShowKonto()) return; /* Konto ohne Neuladen */
      if (user && !ON_KONTO && !ON_LOGIN && view === 'login') { try { sessionStorage.setItem('rs_konto_back', location.pathname + location.search); } catch (e) {} location.href = '/konto/'; return; }
       m.setAttribute('data-open', 'true'); msg(''); render(); var f = m.querySelector('input'); if (f) f.focus(); },
    close: function () { if (ON_LOGIN) return; if (document.body.classList.contains('rs-konto') && view === 'login') return; clearWelcome(); welcome = false; var m = $('acct-modal'); if (m) m.setAttribute('data-open', 'false'); },
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
      mailNew = e; mailStage = 'send'; secOpen.sec = true; acctTab = 'sec'; render(); msg('');
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
    tab: function (k) { acctTab = k; render(); try { window.scrollTo(0, 0); } catch (e) {} },
    tabReset: function () { acctTab = ''; },
    leave: function () { if (typeof window.switchMode === 'function') window.switchMode('start'); },
    setAccent: function (k) { if (typeof applyAccent !== 'function') return; applyAccent(k); if (typeof schedulePersist === 'function') schedulePersist(); render(); },
    setLink: function (on) { if (typeof appState === 'undefined' || !appState.print) return; appState.print.showLink = !!on; if (typeof renderPrintPreview === 'function') { try { renderPrintPreview(); } catch (e) {} } if (typeof schedulePersist === 'function') schedulePersist(); },
    /* Support-Nachricht senden (für die Seite /support/). Gibt { ok, kind, text } zurück, zeigt selbst nichts an. */
    supportPost: async function (topic, message, page, extra) {
      var m = String(message || '').trim(), t = topic || 'question', em = '';
      if (m.length < 5) return { ok: false, kind: 'warning', text: 'Bitte schreibe eine Nachricht (mindestens 5 Zeichen).' };
      if (!user) { /* ohne Anmeldung: E-Mail-Adresse für die Antwort nötig */
        em = String((extra && extra.email) || '').trim();
        if (!/^[^\s@<>"',;]+@[^\s@<>"',;]+\.[^\s@<>"',;]{2,}$/.test(em) || em.length > 200) return { ok: false, kind: 'warning', text: 'Bitte gib eine gültige E-Mail-Adresse an, damit wir dir antworten können.' };
      }
      try {
        var r = await sb.functions.invoke('support', { body: { topic: t, message: m, page: page || location.pathname, ua: navigator.userAgent, email: em, hp: (extra && extra.hp) || '' } });
        if (r.error) { var st = r.error.context && r.error.context.status; return { ok: false, kind: 'error', text: st === 404 ? 'Der Support ist noch nicht eingerichtet (Funktion „support“ fehlt). Bitte versuche es später erneut.' : 'Die Nachricht konnte nicht gesendet werden (' + (st ? 'Fehler ' + st : 'keine Verbindung') + '). Bitte versuche es später erneut.' }; }
        if (!r.data || !r.data.ok) return { ok: false, kind: 'error', text: ((r.data && r.data.error) || 'Die Nachricht konnte nicht gesendet werden.') + (r.data && r.data.code ? ' (' + r.data.code + ')' : '') };
        return { ok: true, kind: 'success', text: 'Danke! Deine Nachricht ist bei uns angekommen. Wir antworten dir per E-Mail.' };
      } catch (e) { return { ok: false, kind: 'error', text: 'Die Nachricht konnte nicht gesendet werden. Bitte versuche es später erneut.' }; }
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
      noAutoPk(); await sb.auth.signOut(); loggedIn(null); view = 'login'; render(); msg('Abgemeldet.', 'info');
    },
    logoutAll: async function () {
      if (!(await rsConfirm('Du wirst auf allen Geräten abgemeldet, auch auf diesem. Danach musst du dich überall neu anmelden.', { title: 'Auf allen Geräten abmelden', ok: 'Überall abmelden', danger: true }))) return;
      clearTimeout(pushTimer); if (user) await sync();
      try { if (user) localStorage.removeItem(HK + '_' + user.id); } catch (e) {}
      noAutoPk(); var r = await sb.auth.signOut({ scope: 'global' });
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
      noAutoPk(); await sb.auth.signOut().catch(function () {}); loggedIn(null); view = 'login'; render(); msg('Dein Konto und alle Cloud-Daten wurden gelöscht.', 'success');
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
    passkeyLogin: async function (auto) {
      /* auto === true: automatischer Versuch beim Öffnen der Anmeldeseite (erst wenn das Captcha gelöst ist, bei Abbruch ohne Fehlermeldung) */
      if (auto === true) { if (capOn() && !capToken) return; } else if (capNeed()) return;
      msg('Passkey wird abgefragt …', 'info');
      var r; try { r = await sb.auth.signInWithPasskey(capOn() ? { options: { captchaToken: capToken } } : undefined); } catch (x) { r = { error: x }; }
      capReset();
      if (!r || r.error || !r.data || !r.data.session) { if (auto === true) msg(''); else msg(pkErr(r && r.error), 'error'); return; }
      pkMark(true); try { sessionStorage.removeItem('rs_no_autopk'); } catch (e) {}
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
      pkMark(true);
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

