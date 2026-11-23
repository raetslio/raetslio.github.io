/* ======================================================================
   Rätselheft aufbauen
   Seiten, Titelseite, Inhaltsverzeichnis, Regeln und Lösungsteil zusammensetzen.
   ====================================================================== */
'use strict';

function paras(s) { return String(s).split('\n').map(function (x) { return x.trim(); }).filter(Boolean); }
HEFT_INTRO = function (types, count) {
  var o = bk.opts, order = [];
  if (o.toc) order.push('Inhaltsverzeichnis'); if (o.rules) order.push('Spielregeln');
  var l = ['Willkommen in deinem Rätselheft! Auf den folgenden Seiten warten ' + count + (count === 1 ? ' Rätsel' : ' Rätsel') + ' der Arten ' + types.join(', ') + '.'];
  l.push('So ist das Heft aufgebaut: ' + (order.length ? 'Zuerst ' + order.join(' und ') + ', danach' : 'Zuerst') + ' die Rätsel' + (o.solutions ? ', am Ende die Lösungen. Unter der gleichen Nummer wie das Rätsel findest du hinten die Lösung.' : '.') + ' Jedes Rätsel hat eine Nummer und einen Namen.');
  l.push('Jedes Rätsel ist mit einer Schwierigkeit gekennzeichnet: Leicht, Mittel, Schwer oder Experte. Starte am besten leicht und steigere dich.');
  l.push('Je nach Größe stehen ein, zwei oder vier Rätsel auf einer Seite.');
  l.push('Tipp: Arbeite mit Bleistift und Radiergummi und freu dich über jedes gelöste Rätsel!');
  return l;
};
function introFor(types, count) { var c = bk.opts.introText; return c && c.trim() ? paras(c) : HEFT_INTRO(types, count); }
function rulesFor(t) { var c = (bk.opts.rulesText || {})[t]; return c && c.trim() ? paras(c) : RULES[t]; }
function buildPages(single) {
  var o = bk.opts, items = single || displayItems();
  items.forEach(function (it, i) { it.no = i + 1; });
  var pages = [], types = [];
  TYPE_ORDER.forEach(function (t) { if (items.some(function (i) { return i.type === t; })) types.push(t); });
  if (single) { single[0].no = ''; return [{ kind: 'ab', item: single[0], noHeader: true, noNumber: true }, { kind: 'sol', per: 1, items: [single[0]], noHeader: true, noNumber: true }]; }
  if (o.cover) pages.push({ kind: 'cover' });
  if (o.intro) pages.push({ kind: 'intro', running: 'Anleitung zum Heft' });
  if (o.toc) { var tp = Math.max(1, Math.ceil(items.length / 34)); for (var i = 0; i < tp; i++) pages.push({ kind: 'toc', part: i, running: 'Inhalt' }); }
  if (o.rules) {
    var cur = null, usedY = 0;
    types.filter(function (t) { return !o.rulesOff[t]; }).forEach(function (t) {
      var lines = 0; rulesFor(t).forEach(function (p) { lines += wrap(p, 180, 3.6).length; });
      var need = 14 + lines * 5.4 + rulesFor(t).length * 2 + 8;
      if (!cur || usedY + need > 255) { cur = { kind: 'rules', types: [], running: 'Spielregeln' }; pages.push(cur); usedY = 0; }
      cur.types.push(t); usedY += need;
    });
  }
  var addEx = function (pos) { o.extras = null; bk.extras.filter(function (e) { return e.pos === pos; }).forEach(function (e) { var cnt = e.kind === 'record' ? Math.max(1, Math.ceil(items.length / 22)) : 1; for (var q = 0; q < cnt; q++) pages.push({ kind: 'x', ex: e, part: q, running: e.title || 'Extra' }); }); };
  addEx('front');
  var pp = null;
  items.forEach(function (it) {
    var per = perOf(it);
    if (!pp || pp.per !== per || pp.items.length >= per) { pp = { kind: 'puz', per: per, items: [], running: 'Rätsel' }; pages.push(pp); }
    pp.items.push(it);
  });
  addEx('end');
  for (var k = 0; k < Math.max(0, Math.min(10, +o.notes || 0)); k++) pages.push({ kind: 'notes', running: 'Notizen' });
  var solItems = (o.solutions && coverSudokuOn() && bk.cover) ? [coverItem()].concat(items) : items;
  var solPer = +o.solPer || 4, solCount = o.solutions ? Math.ceil(solItems.length / solPer) : 0;
  if (o.pad) { var pad = (4 - ((pages.length + solCount) % 4)) % 4; for (var q = 0; q < pad; q++) pages.push({ kind: 'notes', running: 'Notizen' }); }
  if (o.solutions) for (var s = 0; s < solItems.length; s += solPer) pages.push({ kind: 'sol', per: solPer, items: solItems.slice(s, s + solPer), running: 'Lösungen' });
  if (o.format === 'a5') while (pages.length % 4) pages.push({ kind: 'blank', noHeader: true, noNumber: true });
  pages.forEach(function (p, i) { p.n = i + 1; });
  pages.items = items; pages.types = types; pages.typeNames = types.map(function (t) { return TYPE_LABEL[t]; });
  return pages;
}
function pageNoOf(pages, it) {
  for (var i = 0; i < pages.length; i++) if (pages[i].kind === 'puz' && pages[i].items.indexOf(it) >= 0) return pages[i].n;
  return '';
}
var DASH = '<line x1="15" y1="150.5" x2="195" y2="150.5" stroke="#c9d0cc" stroke-width="0.2" stroke-dasharray="1.5 1.5"/>', DASHV = '<line x1="105" y1="20" x2="105" y2="282" stroke="#c9d0cc" stroke-width="0.2" stroke-dasharray="1.5 1.5"/>';
var coverReg = [];
function elState(n) { return (bk.opts.coverEl || {})[n] || {}; }
function E(name, label, svg, op) {
  if (!svg) return '';
  if (!coverReg.some(function (e) { return e.name === name; })) coverReg.push({ name: name, label: label, nomove: !!(op && op.nomove) });
  var st = elState(name); if (st.hide) return '';
  return '<g data-el="' + name + '"' + ((st.dx || st.dy) ? ' transform="translate(' + (st.dx || 0) + ' ' + (st.dy || 0) + ')"' : '') + '>' + svg + '</g>';
}
function coverImageOn() { var o = bk.opts; return !!(o.cover && o.coverArt && o.coverUseImage && bk.coverImage && !elState('art').hide); }
function coverSudokuOn() { var o = bk.opts; return !!(o.cover && o.coverArt && o.coverSudoku && !coverImageOn() && !elState('art').hide); }
var clipN = 0;
function coverImageSvg(x, y, w, h, r, border) {
  var id = 'cvc' + (clipN++);
  return '<rect x="' + (x + 1.5) + '" y="' + (y + 2) + '" width="' + w + '" height="' + h + '" rx="' + r + '" fill="#000" fill-opacity="0.28"/><rect x="' + (x - border) + '" y="' + (y - border) + '" width="' + (w + 2 * border) + '" height="' + (h + 2 * border) + '" rx="' + (r + border) + '" fill="#fff"/><clipPath id="' + id + '"><rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="' + r + '"/></clipPath><image href="' + bk.coverImage + '" x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" preserveAspectRatio="xMidYMid slice" clip-path="url(#' + id + ')"/>';
}
function coverFull() { return '<image href="' + bk.coverImage + '" x="0" y="0" width="210" height="297" preserveAspectRatio="xMidYMid slice"/><rect width="210" height="297" fill="#000" fill-opacity="0.38"/>'; }
function ensureCover() {
  if (!coverSudokuOn() || bk.cover) return;
  var diff = rnd(2), d = window.createSudokuPuzzleData(9, 3, 3, DIFF_KEYS[diff]);
  bk.cover = { n: 9, subR: 3, subC: 3, solution: d.solution, givens: d.givens, diff: diff };
}
function coverItem() { return { id: 'cover', type: 'sudoku', name: 'Cover-Sudoku', no: 'Cover', diff: bk.cover.diff, data: bk.cover }; }
function coverSudokuSvg(x, y, size, pages, dark) {
  var s = '', gs = size - 16, solPg = pages.filter(function (p) { return p.kind === 'sol'; })[0];
  s += '<rect x="' + (x + 1.5) + '" y="' + (y + 2) + '" width="' + size + '" height="' + size + '" rx="5" fill="#000" fill-opacity="0.28"/><rect x="' + x + '" y="' + y + '" width="' + size + '" height="' + size + '" rx="5" fill="#fff"/>';
  s += window.renderSudokuPrintGrid(x + 8, y + 7, gs, 9, 3, 3, { solution: bk.cover.solution, givens: bk.cover.givens }, false, true, false);
  s += T(x + size / 2, y + size - 3, 'Cover-Rätsel · ' + DIFFS[bk.cover.diff] + (solPg ? ' · Lösung auf Seite ' + solPg.n : ''), 3, { fill: MUTED, a: 'middle', w: 600 });
  return s;
}
function miniCard(tp, cx, cy, rot, s) {
  var x = cx - s / 2, y = cy - s / 2, ox = x + 5, oy = y + 5, a = s - 10, g = '';
  g += '<g transform="rotate(' + rot + ' ' + cx + ' ' + cy + ')"><rect x="' + (x + 1.2) + '" y="' + (y + 1.8) + '" width="' + s + '" height="' + s + '" rx="4" fill="#000" fill-opacity="0.28"/><rect x="' + x + '" y="' + y + '" width="' + s + '" height="' + s + '" rx="4" fill="#fff"/>';
  var f = function (v) { return +v.toFixed(2); };
  if (tp === 'sudoku' || tp === 'binoxxo') {
    var c = a / 4, i;
    for (i = 1; i < 4; i++) g += '<path d="M' + f(ox + i * c) + ' ' + oy + 'v' + a + 'M' + ox + ' ' + f(oy + i * c) + 'h' + a + '" stroke="' + (tp === 'sudoku' && i === 2 ? INK : '#9aa3a8') + '" stroke-width="' + (tp === 'sudoku' && i === 2 ? 0.8 : 0.3) + '"/>';
    g += '<rect x="' + ox + '" y="' + oy + '" width="' + a + '" height="' + a + '" fill="none" stroke="' + INK + '" stroke-width="0.8"/>';
    var P = tp === 'sudoku' ? [[1, 0, 3, 0], [0, 4, 0, 2], [2, 0, 4, 0], [0, 3, 0, 1]] : [['X', 'O', '', 'O'], ['O', '', 'X', 'X'], ['', 'X', 'O', ''], ['X', 'O', '', 'O']];
    for (var r = 0; r < 4; r++) for (var q = 0; q < 4; q++) {
      var v = P[r][q]; if (!v) continue; var px = ox + (q + 0.5) * c, py = oy + (r + 0.5) * c;
      if (tp === 'sudoku') g += '<text x="' + f(px) + '" y="' + f(py + 2.4) + '" font-size="7" font-weight="700" text-anchor="middle" fill="' + INK + '" font-family="Outfit, Arial, sans-serif">' + v + '</text>';
      else if (v === 'O') g += '<circle cx="' + f(px) + '" cy="' + f(py) + '" r="3.4" fill="none" stroke="#e8590c" stroke-width="1.2"/>';
      else g += '<path d="M' + f(px - 3.2) + ' ' + f(py - 3.2) + 'l6.4 6.4M' + f(px + 3.2) + ' ' + f(py - 3.2) + 'l-6.4 6.4" stroke="' + ACC + '" stroke-width="1.2" stroke-linecap="round"/>';
    }
  } else if (tp === 'ws') {
    var cw = a / 5, L = 'SUCHENRATSELFINDENHEFTSPASS';
    g += '<line x1="' + f(ox + cw * 0.5) + '" y1="' + f(oy + cw * 2.5) + '" x2="' + f(ox + cw * 4.5) + '" y2="' + f(oy + cw * 2.5) + '" stroke="#ffb703" stroke-opacity="0.65" stroke-width="' + f(cw * 0.8) + '" stroke-linecap="round"/>';
    for (var rr = 0; rr < 5; rr++) for (var cc = 0; cc < 5; cc++) g += '<text x="' + f(ox + (cc + 0.5) * cw) + '" y="' + f(oy + (rr + 0.5) * cw + 2) + '" font-size="5.6" font-weight="700" text-anchor="middle" fill="' + INK + '" font-family="Outfit, Arial, sans-serif">' + L[rr * 5 + cc] + '</text>';
  } else {
    var u = a / 5;
    g += '<path d="M0 0H' + a + 'V' + a + 'H0ZM' + u * 1 + ' ' + u + 'H' + u * 3 + 'V' + u * 3 + 'M' + u * 2 + ' ' + u * 2 + 'V' + u * 4 + 'M' + u * 4 + ' ' + u + 'V' + u * 3 + 'M' + u * 3 + ' ' + u * 4 + 'H' + a + 'M' + u * 1 + ' ' + u * 3 + 'V' + a + '" transform="translate(' + ox + ' ' + oy + ')" fill="none" stroke="' + INK + '" stroke-width="0.9" stroke-linecap="round"/>';
    g += '<circle cx="' + f(ox + u * 0.5) + '" cy="' + f(oy + u * 0.5) + '" r="1.6" fill="#2b9348"/><circle cx="' + f(ox + a - u * 0.5) + '" cy="' + f(oy + a - u * 0.5) + '" r="1.6" fill="#e03131"/>';
  }
  return g + '</g>';
}
function star(cx, cy, r, op) {
  var p = []; for (var i = 0; i < 8; i++) { var rr = i % 2 ? r * 0.28 : r, an = Math.PI * i / 4 - Math.PI / 2; p.push((cx + rr * Math.cos(an)).toFixed(2) + ',' + (cy + rr * Math.sin(an)).toFixed(2)); }
  return '<polygon points="' + p.join(' ') + '" fill="#fff" fill-opacity="' + op + '"/>';
}
function burst(cx, cy, r, rot) {
  var p = []; for (var i = 0; i < 28; i++) { var rr = i % 2 ? r * 0.84 : r, an = Math.PI * i / 14; p.push((cx + rr * Math.cos(an)).toFixed(2) + ',' + (cy + rr * Math.sin(an)).toFixed(2)); }
  return '<g transform="rotate(' + rot + ' ' + cx + ' ' + cy + ')"><polygon points="' + p.join(' ') + '" fill="#e03131" stroke="#fff" stroke-width="1.2" stroke-linejoin="round"/></g>';
}
function pencil(cx, cy, rot) {
  return '<g transform="rotate(' + rot + ' ' + cx + ' ' + cy + ')"><rect x="' + (cx - 49) + '" y="' + (cy - 4.5) + '" width="16" height="9" rx="2" fill="#ff8fa3"/><rect x="' + (cx - 35) + '" y="' + (cy - 4.5) + '" width="3" height="9" fill="#bfc5c9"/><rect x="' + (cx - 32) + '" y="' + (cy - 4.5) + '" width="62" height="9" fill="#ffd43b"/><rect x="' + (cx - 32) + '" y="' + (cy - 1.6) + '" width="62" height="1.2" fill="#f08c00"/><polygon points="' + (cx + 30) + ',' + (cy - 4.5) + ' ' + (cx + 49) + ',' + cy + ' ' + (cx + 30) + ',' + (cy + 4.5) + '" fill="#f1d3a8"/><polygon points="' + (cx + 43) + ',' + (cy - 1.4) + ' ' + (cx + 49) + ',' + cy + ' ' + (cx + 43) + ',' + (cy + 1.4) + '" fill="#2b2f33"/></g>';
}
function magazineCover(pages) {
  var items = pages.items, art = bk.opts.coverArt, o = '', FH = 'Outfit, Arial, sans-serif';
  coverReg = [];
  var cimg = coverImageOn(), cfull = cimg && bk.opts.coverImgMode === 'full';
  o += '<rect width="210" height="297" fill="' + ACC + '"/>';
  var rays = ''; if (cfull) o += E('art', 'Bild (Hintergrund)', coverFull(), { nomove: true }); else for (var i = 0; i < 28; i += 2) { var a1 = Math.PI * 2 * i / 28, a2 = Math.PI * 2 * (i + 1) / 28; rays += '<polygon points="105,125 ' + (105 + 400 * Math.cos(a1)).toFixed(1) + ',' + (125 + 400 * Math.sin(a1)).toFixed(1) + ' ' + (105 + 400 * Math.cos(a2)).toFixed(1) + ',' + (125 + 400 * Math.sin(a2)).toFixed(1) + '" fill="#fff" fill-opacity="0.09"/>'; } if (!cfull) o += E('rays', 'Strahlen-Hintergrund', rays, { nomove: true });
  o += E('banner', 'Kopfzeile (Rätselarten)', '<rect y="0" width="210" height="32" fill="#000" fill-opacity="0.18"/>' + T(105, 20, (pages.typeNames.join('  ·  ') || 'RÄTSEL').toUpperCase(), 4.4, { w: 700, fill: '#fff', a: 'middle' }));
  var fs = 25, tl = wrap(bk.opts.title, 186, fs * 1.25), y0 = art ? 66 : 118;
  if (tl.length > 3) { fs = 19; tl = wrap(bk.opts.title, 186, fs * 1.25); y0 = art ? 62 : 112; }
  fs = Math.max(11, Math.min(fs, 180 / (Math.max.apply(null, tl.map(function (l) { return l.length; })) * 0.6)));
  var step = fs * 1.05;
  var tsvg = '';
  tl.forEach(function (l, i) {
    var yy = y0 + i * step;
    tsvg += '<text x="105" y="' + (yy + 1.6).toFixed(1) + '" font-size="' + fs + '" font-weight="900" text-anchor="middle" fill="#1f2326" font-family="' + FH + '">' + esc(l) + '</text>';
    tsvg += '<text x="105" y="' + yy.toFixed(1) + '" font-size="' + fs + '" font-weight="900" text-anchor="middle" fill="#ffd43b" stroke="#1f2326" stroke-width="1.5" stroke-linejoin="round" paint-order="stroke" font-family="' + FH + '">' + esc(l) + '</text>';
  });
  o += E('title', 'Titel', tsvg);
  var sy = y0 + (tl.length - 1) * step + 14, sub = bk.opts.subtitle;
  if (sub) { var sw = Math.min(180, sub.length * 3.1 + 14); o += E('subtitle', 'Untertitel', '<rect x="' + (105 - sw / 2) + '" y="' + (sy - 6.5) + '" width="' + sw + '" height="10.5" rx="5.2" fill="#fff"/>' + T(105, sy + 0.8, sub, 5, { w: 700, fill: ACC, a: 'middle' })); }
  if (art) {
    var oSave = o; o = '';
    var csud = (cimg && !cfull) || (coverSudokuOn() && bk.cover);
    if (cfull) { } else if (cimg) { var itop = Math.max(sy + 14, 130); o += coverImageSvg(30, itop, 150, 254 - itop, 5, 2.5); } else if (csud) { var ctop = Math.max(sy + 14, 130), csz = Math.max(92, Math.min(106, 254 - ctop)); o += coverSudokuSvg(105 - csz / 2, ctop, csz, pages); } else {
    var ty = pages.types.length ? pages.types.slice() : ['sudoku']; while (ty.length < 3) ty.push(ty[ty.length % pages.types.length || 0] || 'sudoku'); ty = ty.slice(0, 4);
    var pos = ty.length === 3 ? [[52, 192, -9], [105, 200, 3], [158, 192, 8]] : [[40, 190, -10], [85, 203, 4], [130, 196, -4], [172, 205, 9]];
    var cs = ty.length === 3 ? 60 : 52;
    ty.forEach(function (t, i) { o += miniCard(t, pos[i][0], pos[i][1], pos[i][2], cs); });
    }
    o = oSave + E('art', 'Bild / Rätsel', o);
    var by = sy + 30 < 150 ? 150 : sy + 30;
    o += E('badge', 'Rätselzahl-Stern', burst(170, Math.max(132, Math.min(by, 150)), 25, 12) + '<text x="170" y="' + (Math.max(132, Math.min(by, 150)) + 1) + '" font-size="15" font-weight="900" text-anchor="middle" fill="#fff" font-family="' + FH + '" transform="rotate(12 170 ' + Math.max(132, Math.min(by, 150)) + ')">' + items.length + '</text><text x="170" y="' + (Math.max(132, Math.min(by, 150)) + 8) + '" font-size="5" font-weight="800" text-anchor="middle" fill="#fff" font-family="' + FH + '" transform="rotate(12 170 ' + Math.max(132, Math.min(by, 150)) + ')">' + (items.length === 1 ? 'RÄTSEL' : 'RÄTSEL') + '</text>');
    o += E('pencil', 'Stift', pencil(105, csud ? 266 : 256, csud ? -3 : -7));
    o += E('stars', 'Sterne', star(22, 108, 6, 0.8) + star(190, 232, 5, 0.7) + star(14, 238, 4, 0.6) + star(38, 148, 3.5, 0.7) + star(194, 96, 4, 0.7));
  } else {
    o += E('badge', 'Rätselzahl-Stern', burst(105, 205, 30, 8) + '<text x="105" y="206" font-size="18" font-weight="900" text-anchor="middle" fill="#fff" font-family="' + FH + '" transform="rotate(8 105 205)">' + items.length + '</text><text x="105" y="214" font-size="6" font-weight="800" text-anchor="middle" fill="#fff" font-family="' + FH + '" transform="rotate(8 105 205)">RÄTSEL</text>');
  }
  if (bk.opts.owner) o += E('owner', 'Name', '<rect x="55" y="274" width="100" height="12" rx="6" fill="#000" fill-opacity="0.25"/>' + T(105, 282, 'Gehört ' + bk.opts.owner, 5, { w: 700, fill: '#fff', a: 'middle' }));
  return pageWrap(o);
}
function renderPage(pg, pages) {
  var o = '', n = pg.n, H = { w: 800, fill: ACC, ff: 'Outfit, Arial, sans-serif' };
  if (pg.kind === 'cover' && bk.opts.coverStyle === 'magazin') return magazineCover(pages);
  if (pg.kind === 'cover') {
    coverReg = [];
    var items = pages.items, bold = bk.opts.coverStyle !== 'light', art = bk.opts.coverArt;
    var BG = bold ? ACC : '#fff', FG = bold ? '#fff' : INK, TILE = bold ? '#fff' : ACC, SUB = bold ? '#fff' : MUTED, FH = 'Outfit, Arial, sans-serif';
    var cimg2 = coverImageOn(), cfull2 = cimg2 && bk.opts.coverImgMode === 'full';
    o += '<rect width="210" height="297" fill="' + BG + '"/>';
    if (cfull2) { o += E('art', 'Bild (Hintergrund)', coverFull(), { nomove: true }); FG = '#fff'; SUB = '#fff'; TILE = '#fff'; bold = true; }
    var types = pages.types.length ? pages.types : ['sudoku'], letters = (bk.opts.title + 'RÄTSELHEFT').toUpperCase().replace(/[^A-ZÄÖÜ]/g, '') || 'RAETSEL';
    var oS = o; o = '';
    if (art && cimg2) {
      if (!cfull2) o += coverImageSvg(32, 24, 146, 150, 5, 2.5);
    } else if (art && coverSudokuOn() && bk.cover) {
      o += coverSudokuSvg(32, 24, 146, pages);
    } else if (art) {
      var cs = 30, gp = 4, gx0 = 22, gy0 = 22;
      for (var i = 0; i < 25; i++) {
        var col = i % 5, row = Math.floor(i / 5), x = gx0 + col * (cs + gp), y = gy0 + row * (cs + gp), cx = x + cs / 2, cy = y + cs / 2;
        var tp = types[(col * 2 + row * 3 + (i >> 2)) % types.length], strong = (i * 7 + row) % 3 === 0;
        o += '<rect x="' + x + '" y="' + y + '" width="' + cs + '" height="' + cs + '" rx="5" fill="' + TILE + '" fill-opacity="' + (bold ? (strong ? 0.2 : 0.09) : (strong ? 0.16 : 0.07)) + '"/>';
        var go = strong ? 0.95 : 0.5, gcol = TILE;
        if (tp === 'sudoku') o += '<text x="' + cx + '" y="' + (cy + 6) + '" font-size="17" font-weight="700" text-anchor="middle" fill="' + gcol + '" fill-opacity="' + go + '" font-family="' + FH + '">' + (((i * 7) % 9) + 1) + '</text>';
        else if (tp === 'ws') o += '<text x="' + cx + '" y="' + (cy + 6) + '" font-size="17" font-weight="700" text-anchor="middle" fill="' + gcol + '" fill-opacity="' + go + '" font-family="' + FH + '">' + letters[i % letters.length] + '</text>';
        else if (tp === 'binoxxo') o += (i % 2 ? '<circle cx="' + cx + '" cy="' + cy + '" r="7" fill="none" stroke="' + gcol + '" stroke-opacity="' + go + '" stroke-width="2.2"/>' : '<path d="M' + (cx - 6.5) + ' ' + (cy - 6.5) + 'l13 13M' + (cx + 6.5) + ' ' + (cy - 6.5) + 'l-13 13" stroke="' + gcol + '" stroke-opacity="' + go + '" stroke-width="2.2" stroke-linecap="round"/>');
        else { var m = i % 2 ? 'M' + (x + 6) + ' ' + (y + 24) + 'V' + (y + 6) + 'H' + (x + 24) + 'V' + (y + 18) + 'H' + (x + 12) + 'V' + (y + 12) : 'M' + (x + 24) + ' ' + (y + 6) + 'V' + (y + 24) + 'H' + (x + 6) + 'V' + (y + 12) + 'H' + (x + 18) + 'V' + (y + 18); o += '<path d="' + m + '" fill="none" stroke="' + gcol + '" stroke-opacity="' + go + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'; }
      }
    }
    o = oS + E('art', 'Bild / Rätsel / Kacheln', o);
    var tl = wrap(bk.opts.title, 166, 14), y0 = art ? 224 : 120;
    o += E('banner', 'Kopfzeile', '<rect x="22" y="' + (y0 - 22) + '" width="14" height="1.6" fill="' + (bold ? '#fff' : ACC) + '"/>' + T(40, y0 - 20.6, 'RÄTSELHEFT  ·  ' + items.length + (items.length === 1 ? ' RÄTSEL' : ' RÄTSEL'), 3.2, { w: 600, fill: bold ? '#fff' : ACC }));
    var ts = ''; tl.forEach(function (l, i) { ts += T(22, y0 + i * 15.5, l, 14, { w: 800, fill: FG, ff: FH }); }); o += E('title', 'Titel', ts);
    var sy = y0 + (tl.length - 1) * 15.5 + 9;
    var ss = ''; wrap(bk.opts.subtitle, 166, 5.2).forEach(function (l, i) { ss += T(22, sy + i * 7.5, l, 5.2, { fill: SUB }).replace('/>', '/>').replace('fill="' + SUB + '"', 'fill="' + SUB + '" fill-opacity="0.85"'); });
    o += E('subtitle', 'Untertitel', ss);
    if (bk.opts.owner) o += E('owner', 'Name', T(22, 284, 'Gehört ' + bk.opts.owner, 4.4, { w: 600, fill: FG }));
    return pageWrap(o);
  }
  o += chrome(pg, n);
  if (pg.kind === 'intro') {
    o += T(15, 30, 'Anleitung zum Heft', 8, H) + textBlock(introFor(pages.typeNames, pages.items.length), 15, 44, 180, 3.8, 3.5).svg;
  } else if (pg.kind === 'toc') {
    o += T(15, 30, 'Inhalt', 8, H);
    var y = 44;
    pages.items.slice(pg.part * 34, pg.part * 34 + 34).forEach(function (it) {
      o += T(15, y, 'Nr. ' + it.no, 3.8, { w: 700, fill: ACC }) + T(32, y, it.name, 3.8, { w: 600 });
      if (bk.opts.showMeta) o += T(100, y, TYPE_LABEL[it.type] + ' · ' + sizeLabel(it) + ' · ' + DIFFS[it.diff], 3.2, { fill: MUTED });
      o += T(195, y, bk.opts.pageNumbers ? 'Seite ' + pageNoOf(pages, it) : '', 3.6, { a: 'end' }) + '<line x1="15" y1="' + (y + 1.8) + '" x2="195" y2="' + (y + 1.8) + '" stroke="#dde2df" stroke-width="0.2"/>';
      y += 7.2;
    });
  } else if (pg.kind === 'rules') {
    var yy = 30; o += T(15, yy, 'Spielregeln', 8, H); yy += 14;
    pg.types.forEach(function (t) {
      o += T(15, yy, TYPE_LABEL[t], 5.6, { w: 700 }); yy += 6;
      var b = textBlock(rulesFor(t), 15, yy, 180, 3.6, 1.6); o += b.svg; yy = b.y + 6;
    });
  } else if (pg.kind === 'puz') {
    pg.items.forEach(function (it, i) { o += puzzleSlot(it, pg.per, i); });
    if (pg.per >= 2) o += DASH; if (pg.per === 4) o += DASHV;
  } else if (pg.kind === 'sol') {
    pg.items.forEach(function (it, i) { o += solSlot(it, pg.per, i); });
    if (pg.per >= 2) o += DASH; if (pg.per === 4) o += DASHV;
  } else if (pg.kind === 'x') {
    var ex = pg.ex, yh = 30;
    o += T(15, yh, ex.title || '', 8, H);
    if (ex.kind === 'text') {
      var yy2 = 46;
      String(ex.text || '').split('\n').forEach(function (par) {
        if (!par.trim()) { yy2 += 4; return; }
        wrap(par, 180, 4).forEach(function (l) { o += T(15, yy2, l, 4); yy2 += 6; }); yy2 += 2;
      });
    } else if (ex.kind === 'image') {
      if (ex.image) o += '<image href="' + ex.image + '" x="15" y="42" width="180" height="235" preserveAspectRatio="xMidYMid meet"/>';
      else o += T(105, 150, 'Hier erscheint dein Bild', 4, { a: 'middle', fill: MUTED });
    } else if (ex.kind === 'notes') {
      var st = ex.style;
      if (st === 'lines') for (var l2 = 44; l2 < 280; l2 += 9) o += '<line x1="15" y1="' + l2 + '" x2="195" y2="' + l2 + '" stroke="#dde2df" stroke-width="0.25"/>';
      else if (st === 'grid') { for (var gx2 = 15; gx2 <= 195; gx2 += 5) o += '<line x1="' + gx2 + '" y1="40" x2="' + gx2 + '" y2="280" stroke="#e3e7e5" stroke-width="0.2"/>'; for (var gy2 = 40; gy2 <= 280; gy2 += 5) o += '<line x1="15" y1="' + gy2 + '" x2="195" y2="' + gy2 + '" stroke="#e3e7e5" stroke-width="0.2"/>'; }
      else if (st === 'dots') for (var dx2 = 15; dx2 <= 195; dx2 += 5) for (var dy2 = 40; dy2 <= 280; dy2 += 5) o += '<circle cx="' + dx2 + '" cy="' + dy2 + '" r="0.35" fill="#a9b2ae"/>';
    } else if (ex.kind === 'record') {
      var rows = pages.items.slice(pg.part * 22, pg.part * 22 + 22), ty = 42;
      o += '<rect x="15" y="' + ty + '" width="180" height="9" fill="' + ACC + '"/>' + T(18, ty + 6, 'Nr.', 3.6, { w: 700, fill: '#fff' }) + T(32, ty + 6, 'Rätsel', 3.6, { w: 700, fill: '#fff' }) + T(100, ty + 6, 'Datum', 3.6, { w: 700, fill: '#fff' }) + T(135, ty + 6, 'Zeit', 3.6, { w: 700, fill: '#fff' }) + T(163, ty + 6, 'Sterne', 3.6, { w: 700, fill: '#fff' });
      rows.forEach(function (it, i) {
        var ry = ty + 9 + i * 10.5;
        o += '<rect x="15" y="' + ry + '" width="180" height="10.5" fill="' + (i % 2 ? '#f6f8f7' : '#fff') + '" stroke="#dde2df" stroke-width="0.2"/>' + T(18, ry + 6.8, String(it.no), 3.8, { w: 700, fill: ACC }) + T(32, ry + 6.8, it.name, 3.8, { w: 600 });
        for (var s5 = 0; s5 < 5; s5++) { var sx = 166 + s5 * 5.6, pts = []; for (var q5 = 0; q5 < 10; q5++) { var rr5 = q5 % 2 ? 1.1 : 2.5, an5 = Math.PI * q5 / 5 - Math.PI / 2; pts.push((sx + rr5 * Math.cos(an5)).toFixed(2) + ',' + (ry + 5.3 + rr5 * Math.sin(an5)).toFixed(2)); } o += '<polygon points="' + pts.join(' ') + '" fill="none" stroke="#9aa3a8" stroke-width="0.3"/>'; }
        o += '<line x1="98" y1="' + (ry + 8) + '" x2="128" y2="' + (ry + 8) + '" stroke="#c9d0cc" stroke-width="0.25"/><line x1="133" y1="' + (ry + 8) + '" x2="158" y2="' + (ry + 8) + '" stroke="#c9d0cc" stroke-width="0.25"/>';
      });
    }
  } else if (pg.kind === 'notes') {
    o += T(15, 30, 'Notizen', 8, H);
    for (var ly = 44; ly < 280; ly += 9) o += '<line x1="15" y1="' + ly + '" x2="195" y2="' + ly + '" stroke="#dde2df" stroke-width="0.25"/>';
  } else if (pg.kind === 'ab') {
    var it2 = pg.item;
    o += T(15, 24, it2.name, 9, H) + T(15, 31, TYPE_LABEL[it2.type] + ' · ' + sizeLabel(it2) + ' · ' + DIFFS[it2.diff], 3.6, { fill: MUTED });
    o += T(105, 24, 'Name:', 3.8) + '<line x1="118" y1="24.5" x2="195" y2="24.5" stroke="' + INK + '" stroke-width="0.25"/>';
    o += T(105, 32, 'Datum:', 3.8) + '<line x1="118" y1="32.5" x2="195" y2="32.5" stroke="' + INK + '" stroke-width="0.25"/>';
    it2.big = true;
    o += drawPuzzle(it2, 15, 42, 180, 190, false, true) + T(15, 242, 'So geht’s', 4.6, { w: 700 }) + textBlock(RULES[it2.type], 15, 249, 180, 3.2, 1).svg;
  }
  return pageWrap(o);
}
function renderAll(single) {
  ACC = bk.opts.accent || '#2f6fed';
  PW = (bk.opts.format === 'a5' && !single) ? 'width="148.5mm" height="210mm"' : 'width="210mm" height="296mm"';
  if (!single) ensureCover();
  var pages = buildPages(single);
  return { pages: pages, svgs: pages.map(function (p) { return renderPage(p, pages); }) };
}
