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

