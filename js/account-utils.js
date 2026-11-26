/* ======================================================================
   Konto-Hilfsfunktionen (rein, ohne Zugriff auf Seite oder Datenbank)
   Fehlertexte, Icons, Daten-Zusammenfassung fuer die Synchronisierung.
   Wird von js/account.js genutzt und in tests/ automatisch geprueft.
   ====================================================================== */
(function (root) {
  'use strict';
  var BK_PRE = 'raetsel_heft_v2_';
  var SP = { verlauf: { ls: 'raetsel_heft_verlauf', mod: 'HV' }, spiele: { ls: 'raetsel_heft_spiele', mod: 'GV' } };
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function canon(v) {
    if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']';
    if (v && typeof v === 'object') return '{' + Object.keys(v).sort().map(function (k) { return JSON.stringify(k) + ':' + canon(v[k]); }).join(',') + '}';
    return JSON.stringify(v === undefined ? null : v);
  }
  function hash(v) { var s = canon(v), h = 5381; for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return s.length + ':' + h; }
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
  function pkDate(v) { try { return new Date(v).toLocaleDateString('de-DE'); } catch (e) { return ''; } }
  function isEmptyDefault(d) { return d && (!d.items || !d.items.length) && (!d.extras || !d.extras.length) && /^(Mein Heft|Heft \d+)$/.test(d.name || ''); }
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
  var api = { BK_PRE: BK_PRE, SP: SP, esc: esc, canon: canon, hash: hash, provName: provName, provIcon: provIcon, err: err, pkErr: pkErr, pkDate: pkDate, isEmptyDefault: isEmptyDefault, parseJ: parseJ, hefteOf: hefteOf, histOf: histOf, summarize: summarize };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.RSAUTH_UTILS = api;
})(typeof window !== 'undefined' ? window : globalThis);
