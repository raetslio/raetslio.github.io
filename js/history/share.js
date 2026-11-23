/* ======================================================================
   Rätsel teilen
   Erzeugt aus einem Rätsel aus dem Spielverlauf einen Link bzw. Code (ohne Fortschritt) und öffnet
   solche Links/Codes als frisches Rätsel. Alles steckt im Link selbst – es wird nichts hochgeladen.
   ====================================================================== */
'use strict';

var SH_PRE = 'RS1-';
function shB64(buf) { var b = new Uint8Array(buf), s = ''; for (var i = 0; i < b.length; i += 8192) s += String.fromCharCode.apply(null, b.subarray(i, i + 8192)); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function shUnB64(t) { t = t.replace(/-/g, '+').replace(/_/g, '/'); while (t.length % 4) t += '='; var s = atob(t), b = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) b[i] = s.charCodeAt(i); return b; }
async function shPipe(bytes, stream) { var r = new Response(new Blob([bytes]).stream().pipeThrough(stream)); return new Uint8Array(await r.arrayBuffer()); }
async function shEncode(item) {
  var raw = new TextEncoder().encode(JSON.stringify({ v: 1, type: item.type, data: item.data }));
  if (typeof CompressionStream === 'function') return SH_PRE + 'z' + shB64(await shPipe(raw, new CompressionStream('deflate-raw')));
  return SH_PRE + 'p' + shB64(raw);
}
async function shDecode(text) {
  var t = String(text || '').trim(), m = t.match(/rs=([^&\s]+)/); if (m) t = decodeURIComponent(m[1]);
  t = t.replace(/\s+/g, '');
  if (t.indexOf(SH_PRE) !== 0 || t.length > 400000) throw new Error('Das ist kein gültiger Rätsel-Code.');
  var mode = t.charAt(SH_PRE.length), bytes = shUnB64(t.slice(SH_PRE.length + 1));
  if (mode === 'z') { if (typeof DecompressionStream !== 'function') throw new Error('Dieser Browser kann den Code nicht öffnen.'); bytes = await shPipe(bytes, new DecompressionStream('deflate-raw')); }
  else if (mode !== 'p') throw new Error('Das ist kein gültiger Rätsel-Code.');
  var o = JSON.parse(new TextDecoder().decode(bytes));
  if (!o || o.v !== 1 || GV_TYPES.indexOf(o.type) < 0 || !o.data || typeof o.data !== 'object') throw new Error('Das ist kein gültiger Rätsel-Code.');
  return o;
}
function shFreshState(type, d) {
  if (type === 'sudoku') return { entries: d.solution.map(function (r) { return r.map(function () { return 0; }); }), notes: null, elapsedSec: 0 };
  if (type === 'ws') return { foundIds: [] };
  if (type === 'binoxxo') return { entries: d.data.givens.map(function (r) { return r.slice(); }) };
  if (type === 'maze') return { pos: 0, trail: [0], steps: 0, won: false };
  return { entries: NXT[type].fresh(d.data) };
}
async function shOpenCode(text) {
  try {
    var o = await shDecode(text);
    try { gvRecordAll(); } catch (x) {}
    gvOpen({ type: o.type, data: o.data, state: shFreshState(o.type, o.data) });
    gvMsg('Das geteilte Rätsel wurde geöffnet.', 'success');
    return true;
  } catch (e) { gvMsg('Das Rätsel konnte nicht geöffnet werden: ' + e.message, 'error'); return false; }
}
async function shCreate(id) {
  var it = gvLoad().items.filter(function (x) { return x.id === id; })[0]; if (!it) return;
  var code = await shEncode(it), link = location.origin + location.pathname + '#rs=' + code;
  var box = $('sh-out'), ta = $('sh-link'); if (!box || !ta) return;
  ta.value = link; box.classList.remove('hidden');
  try { await navigator.clipboard.writeText(link); gvMsg('Link kopiert. Wer ihn öffnet, bekommt dasselbe Rätsel – ohne deinen Fortschritt.', 'success'); }
  catch (e) { ta.focus(); ta.select(); gvMsg('Link erstellt – bitte unten kopieren.', 'info'); }
  box.scrollIntoView({ block: 'nearest' });
}
function shHash() {
  if (location.hash.indexOf('#rs=') !== 0) return;
  var h = location.hash;
  try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
  var n = 0, w = setInterval(function () { if (window.__rsInit || ++n > 100) { clearInterval(w); if (window.__rsInit) shOpenCode(h); } }, 100);
}
(function () {
  var list = $('gv-list'), ta = $('sh-link');
  if (list) list.addEventListener('click', function (e) { var b = e.target.closest('button[data-a="share"]'); if (b) shCreate(b.dataset.id); });
  var go = $('sh-open'); if (go) go.addEventListener('click', function () { var i = $('sh-in'); if (i && i.value.trim()) shOpenCode(i.value).then(function (ok) { if (ok) i.value = ''; }); });
  var cp = $('sh-copy'); if (cp) cp.addEventListener('click', function () { if (!ta) return; ta.select(); try { navigator.clipboard.writeText(ta.value); gvMsg('Link kopiert.', 'success'); } catch (e) { document.execCommand('copy'); } });
  window.addEventListener('hashchange', shHash); shHash();
})();
