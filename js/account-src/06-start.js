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
