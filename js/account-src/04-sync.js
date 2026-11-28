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
    if (flatMode) return '<div class="acct-flat">' + inner + '</div>';
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
    anonSupport(false); try { sessionStorage.removeItem('rs_no_autopk'); } catch (e) {}
    reveal();
    if (ON_LOGIN) { if (view !== 'recovery' && !(needWelcome() && !inviteShown)) toApp(); return; }
    oauthNote();
    setTimeout(checkProf, 300); setTimeout(checkPk, 400); setTimeout(checkImport, 1200); setTimeout(mailDonePopup, 500);
  }

