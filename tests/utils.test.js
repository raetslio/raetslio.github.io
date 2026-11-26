/* Automatische Tests fuer js/account-utils.js. Start: node --test tests/ */
const test = require('node:test');
const assert = require('node:assert/strict');
const U = require('../js/account-utils.js');

test('esc maskiert HTML-Zeichen', () => {
  assert.equal(U.esc('<a href="x">&</a>'), '&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;');
  assert.equal(U.esc(5), '5');
});

test('canon und hash sind unabhaengig von der Schluesselreihenfolge', () => {
  assert.equal(U.canon({ b: 1, a: [1, { d: 2, c: 3 }] }), U.canon({ a: [1, { c: 3, d: 2 }], b: 1 }));
  assert.equal(U.hash({ a: 1, b: 2 }), U.hash({ b: 2, a: 1 }));
  assert.notEqual(U.hash({ a: 1 }), U.hash({ a: 2 }));
  assert.equal(U.canon(undefined), 'null');
});

test('err uebersetzt bekannte Fehler und reicht unbekannte durch', () => {
  assert.equal(U.err(new Error('Invalid login credentials')), 'E-Mail oder Passwort ist falsch.');
  assert.match(U.err({ message: 'Email not confirmed' }), /bestätige/);
  assert.match(U.err({ message: 'Failed to fetch' }), /Keine Verbindung/);
  assert.match(U.err({ message: 'email rate limit exceeded' }), /Zu viele Versuche/);
  assert.equal(U.err({ message: 'etwas ganz anderes' }), 'etwas ganz anderes');
  assert.equal(U.err('Text'), 'Text');
});

test('pkErr: Abbruch, Fehlercodes und Rueckfall auf err', () => {
  assert.match(U.pkErr({ name: 'NotAllowedError' }), /Abgebrochen/);
  assert.match(U.pkErr({ message: 'The operation timed out' }), /Abgebrochen/);
  assert.match(U.pkErr({ code: 'passkey_disabled' }), /nicht aktiviert/);
  assert.match(U.pkErr({ code: 'too_many_passkeys' }), /maximale Anzahl/);
  assert.match(U.pkErr({ code: 'webauthn_credential_not_found' }), /kein passender Passkey/);
  assert.equal(U.pkErr({ message: 'Invalid login credentials' }), 'E-Mail oder Passwort ist falsch.');
});

test('provName und provIcon', () => {
  assert.equal(U.provName('google'), 'Google');
  assert.equal(U.provName('unbekannt'), 'unbekannt');
  assert.match(U.provIcon('key'), /^<svg/);
  assert.equal(U.provIcon('gibt-es-nicht'), '');
});

test('pkDate und parseJ sind fehlertolerant', () => {
  assert.equal(U.pkDate('2026-11-26T10:00:00Z').length > 0, true);
  assert.equal(U.parseJ('{"a":1}').a, 1);
  assert.equal(U.parseJ('kaputt'), null);
  assert.equal(U.parseJ(undefined), null);
});

test('isEmptyDefault erkennt leere Standardhefte', () => {
  assert.ok(U.isEmptyDefault({ name: 'Mein Heft', items: [] }));
  assert.ok(U.isEmptyDefault({ name: 'Heft 3' }));
  assert.ok(!U.isEmptyDefault({ name: 'Mein Heft', items: [1] }));
  assert.ok(!U.isEmptyDefault({ name: 'Ferienheft', items: [] }));
});

test('hefteOf, histOf und summarize', () => {
  const data = {
    [U.BK_PRE + 'a']: JSON.stringify({ name: 'Ferienheft', items: [1] }),
    [U.BK_PRE + 'b']: JSON.stringify({ name: 'Mein Heft', items: [] }),
    [U.BK_PRE + 'c']: 'kaputt',
    [U.SP.verlauf.ls]: JSON.stringify({ items: [1, 2] }),
    [U.SP.spiele.ls]: JSON.stringify({ items: [1] }),
    fremd: '1'
  };
  const h = U.hefteOf(data);
  assert.equal(h.length, 1);
  assert.equal(h[0].id, 'a');
  assert.equal(U.histOf(data, 'verlauf').items.length, 2);
  assert.equal(U.histOf({}, 'spiele'), null);
  const s = U.summarize(data);
  assert.deepEqual([s.nH, s.nV, s.nS], [1, 2, 1]);
  assert.equal(s.sig, U.summarize(JSON.parse(JSON.stringify(data))).sig);
  assert.equal(U.summarize(null).nH, 0);
});
