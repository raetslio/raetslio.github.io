/* ======================================================================
   Export als PDF
   Vektor-PDF mit echtem Text aus den SVG-Seiten.
   ====================================================================== */
'use strict';

var PDFX = (function () {
  var CP = { 0x20AC: 128, 0x201A: 130, 0x0192: 131, 0x201E: 132, 0x2026: 133, 0x2020: 134, 0x2021: 135, 0x2030: 137, 0x0160: 138, 0x2039: 139, 0x0152: 140, 0x017D: 142, 0x2018: 145, 0x2019: 146, 0x201C: 147, 0x201D: 148, 0x2022: 149, 0x2013: 150, 0x2014: 151, 0x2122: 153, 0x0161: 154, 0x203A: 155, 0x0153: 156, 0x017E: 158, 0x0178: 159 };
  function enc(s) { var o = ''; for (var i = 0; i < s.length; i++) { var c = s.charCodeAt(i), b = c < 256 && !(c >= 128 && c < 160) ? c : (CP[c] || 63); o += String.fromCharCode(b); } return o; }
  function esc(b) { return b.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)'); }
  var mc = document.createElement('canvas').getContext('2d');
  function tw(s, fs, bold) { mc.font = (bold ? 'bold ' : '') + (fs * 20) + 'px Arial, Helvetica, sans-serif'; return mc.measureText(s).width / 20; }
  var NAMED = { white: '#ffffff', black: '#000000' };
  function col(c) {
    if (!c || c === 'none' || c === 'transparent') return null; c = NAMED[c] || c;
    var m = /^#([0-9a-f]{3})$/i.exec(c); if (m) return m[1].split('').map(function (x) { return parseInt(x + x, 16) / 255; });
    m = /^#([0-9a-f]{6})$/i.exec(c); if (m) return [0, 2, 4].map(function (i) { return parseInt(m[1].substr(i, 2), 16) / 255; });
    m = /^rgba?\(([^)]+)\)/.exec(c); if (m) { var p = m[1].split(',').map(parseFloat); return [p[0] / 255, p[1] / 255, p[2] / 255]; }
    return [0, 0, 0];
  }
  function f(n) { return (+n.toFixed(3)).toString(); }
  function xform(t) {
    var out = '', re = /(translate|rotate|scale)\(([^)]*)\)/g, m;
    while ((m = re.exec(t || ''))) {
      var a = m[2].trim().split(/[\s,]+/).map(parseFloat);
      if (m[1] === 'translate') out += '1 0 0 1 ' + f(a[0]) + ' ' + f(a[1] || 0) + ' cm\n';
      else if (m[1] === 'scale') out += f(a[0]) + ' 0 0 ' + f(a.length > 1 ? a[1] : a[0]) + ' 0 0 cm\n';
      else { var r = a[0] * Math.PI / 180, c = Math.cos(r), s = Math.sin(r), cx = a[1] || 0, cy = a[2] || 0; out += '1 0 0 1 ' + f(cx) + ' ' + f(cy) + ' cm\n' + f(c) + ' ' + f(s) + ' ' + f(-s) + ' ' + f(c) + ' 0 0 cm\n1 0 0 1 ' + f(-cx) + ' ' + f(-cy) + ' cm\n'; }
    }
    return out;
  }
  function rr(x, y, w, h, r) {
    if (!r) return f(x) + ' ' + f(y) + ' ' + f(w) + ' ' + f(h) + ' re\n';
    r = Math.min(r, w / 2, h / 2); var k = r * 0.5523;
    return f(x + r) + ' ' + f(y) + ' m\n' + f(x + w - r) + ' ' + f(y) + ' l\n' + f(x + w - r + k) + ' ' + f(y) + ' ' + f(x + w) + ' ' + f(y + r - k) + ' ' + f(x + w) + ' ' + f(y + r) + ' c\n' + f(x + w) + ' ' + f(y + h - r) + ' l\n' + f(x + w) + ' ' + f(y + h - r + k) + ' ' + f(x + w - r + k) + ' ' + f(y + h) + ' ' + f(x + w - r) + ' ' + f(y + h) + ' c\n' + f(x + r) + ' ' + f(y + h) + ' l\n' + f(x + r - k) + ' ' + f(y + h) + ' ' + f(x) + ' ' + f(y + h - r + k) + ' ' + f(x) + ' ' + f(y + h - r) + ' c\n' + f(x) + ' ' + f(y + r) + ' l\n' + f(x) + ' ' + f(y + r - k) + ' ' + f(x + r - k) + ' ' + f(y) + ' ' + f(x + r) + ' ' + f(y) + ' c\nh\n';
  }
  function circ(cx, cy, r) { var k = r * 0.5523; return f(cx + r) + ' ' + f(cy) + ' m\n' + f(cx + r) + ' ' + f(cy + k) + ' ' + f(cx + k) + ' ' + f(cy + r) + ' ' + f(cx) + ' ' + f(cy + r) + ' c\n' + f(cx - k) + ' ' + f(cy + r) + ' ' + f(cx - r) + ' ' + f(cy + k) + ' ' + f(cx - r) + ' ' + f(cy) + ' c\n' + f(cx - r) + ' ' + f(cy - k) + ' ' + f(cx - k) + ' ' + f(cy - r) + ' ' + f(cx) + ' ' + f(cy - r) + ' c\n' + f(cx + k) + ' ' + f(cy - r) + ' ' + f(cx + r) + ' ' + f(cy - k) + ' ' + f(cx + r) + ' ' + f(cy) + ' c\nh\n'; }
  function pathData(d) {
    var toks = d.match(/[a-zA-Z]|-?\d*\.?\d+(?:e-?\d+)?/g) || [], i = 0, out = '', x = 0, y = 0, sx = 0, sy = 0, cmd = '';
    function num() { return parseFloat(toks[i++]); }
    while (i < toks.length) {
      if (/[a-zA-Z]/.test(toks[i])) cmd = toks[i++];
      var rel = cmd === cmd.toLowerCase(), C = cmd.toUpperCase();
      if (C === 'Z') { out += 'h\n'; x = sx; y = sy; continue; }
      if (C === 'M') { var a = num(), b = num(); x = rel ? x + a : a; y = rel ? y + b : b; sx = x; sy = y; out += f(x) + ' ' + f(y) + ' m\n'; cmd = rel ? 'l' : 'L'; }
      else if (C === 'L') { var a2 = num(), b2 = num(); x = rel ? x + a2 : a2; y = rel ? y + b2 : b2; out += f(x) + ' ' + f(y) + ' l\n'; }
      else if (C === 'H') { var a3 = num(); x = rel ? x + a3 : a3; out += f(x) + ' ' + f(y) + ' l\n'; }
      else if (C === 'V') { var a4 = num(); y = rel ? y + a4 : a4; out += f(x) + ' ' + f(y) + ' l\n'; }
      else { i++; }
    }
    return out;
  }
  function jpegDims(bytes) { var i = 2; while (i < bytes.length) { if (bytes[i] !== 0xFF) { i++; continue; } var m = bytes[i + 1]; if (m >= 0xC0 && m <= 0xCF && m !== 0xC4 && m !== 0xC8 && m !== 0xCC) return { h: (bytes[i + 5] << 8) | bytes[i + 6], w: (bytes[i + 7] << 8) | bytes[i + 8] }; i += 2 + ((bytes[i + 2] << 8) | bytes[i + 3]); } return { w: 1, h: 1 }; }
  /* ctx: { gs: {key->name}, imgs: [], fonts } ; liefert Inhaltsstrom für ein SVG (Koordinaten wie viewBox) */
  function convert(svgText, ctx) {
    var doc = new DOMParser().parseFromString(svgText, 'image/svg+xml'), root = doc.documentElement, clips = {}, out = '', usedImgs = {};
    Array.prototype.forEach.call(doc.querySelectorAll('clipPath'), function (cp) { var r = cp.querySelector('rect'); if (r) clips[cp.getAttribute('id')] = { x: +r.getAttribute('x'), y: +r.getAttribute('y'), w: +r.getAttribute('width'), h: +r.getAttribute('height'), r: +(r.getAttribute('rx') || 0) }; });
    function gsName(fa, sa) { var k = f(fa) + '_' + f(sa); if (!ctx.gs[k]) ctx.gs[k] = { name: 'GS' + Object.keys(ctx.gs).length, fa: fa, sa: sa }; return ctx.gs[k].name; }
    function walk(el, st) {
      var tag = el.tagName; if (!tag || tag === 'clipPath' || tag === 'defs') return;
      var s = Object.assign({}, st), g = function (n) { return el.getAttribute(n); };
      ['fill', 'stroke', 'stroke-width', 'font-size', 'font-weight', 'text-anchor', 'stroke-linecap', 'stroke-linejoin', 'stroke-dasharray', 'dominant-baseline', 'paint-order'].forEach(function (n) { if (g(n) !== null) s[n] = g(n); });
      ['opacity', 'fill-opacity', 'stroke-opacity'].forEach(function (n) { if (g(n) !== null) s[n] = (s[n] === undefined ? 1 : s[n]) * parseFloat(g(n)); });
      var fa = (s['fill-opacity'] === undefined ? 1 : s['fill-opacity']) * (s.opacity === undefined ? 1 : s.opacity), sa = (s['stroke-opacity'] === undefined ? 1 : s['stroke-opacity']) * (s.opacity === undefined ? 1 : s.opacity);
      if (tag === 'g' || tag === 'svg') { var pre = ''; if (g('transform')) pre = xform(g('transform')); out += 'q\n' + pre; Array.prototype.forEach.call(el.children, function (c) { walk(c, s); }); out += 'Q\n'; return; }
      var fill = col(s.fill === undefined ? '#000' : s.fill), stroke = col(s.stroke);
      out += 'q\n' + xform(g('transform'));
      var cp = g('clip-path'); if (cp) { var cm = /url\(#([^)]+)\)/.exec(cp); if (cm && clips[cm[1]]) { var c = clips[cm[1]]; out += rr(c.x, c.y, c.w, c.h, c.r) + 'W n\n'; } }
      function setStyle() {
        out += '/' + gsName(fa, sa) + ' gs\n';
        if (fill) out += f(fill[0]) + ' ' + f(fill[1]) + ' ' + f(fill[2]) + ' rg\n';
        if (stroke) {
          out += f(stroke[0]) + ' ' + f(stroke[1]) + ' ' + f(stroke[2]) + ' RG\n' + f(parseFloat(s['stroke-width'] === undefined ? 1 : s['stroke-width'])) + ' w\n';
          out += ({ round: 1, square: 2 }[s['stroke-linecap']] || 0) + ' J ' + ({ round: 1, bevel: 2 }[s['stroke-linejoin']] || 0) + ' j\n';
          if (s['stroke-dasharray'] && s['stroke-dasharray'] !== 'none') out += '[' + s['stroke-dasharray'].replace(/,/g, ' ') + '] 0 d\n';
        }
      }
      function paint(shape) { setStyle(); out += shape + (fill && stroke ? 'B\n' : fill ? 'f\n' : stroke ? 'S\n' : 'n\n'); }
      if (tag === 'rect') { var w = +g('width'), h = +g('height'); if (w > 0 && h > 0) paint(rr(+(g('x') || 0), +(g('y') || 0), w, h, +(g('rx') || 0))); }
      else if (tag === 'circle') paint(circ(+g('cx'), +g('cy'), +g('r')));
      else if (tag === 'line') { var f2 = fill; fill = null; paint(f(+g('x1')) + ' ' + f(+g('y1')) + ' m\n' + f(+g('x2')) + ' ' + f(+g('y2')) + ' l\n'); fill = f2; }
      else if (tag === 'path') paint(pathData(g('d') || ''));
      else if (tag === 'polygon' || tag === 'polyline') {
        var pts = (g('points') || '').trim().split(/[\s,]+/).map(parseFloat), sh = ''; for (var i = 0; i + 1 < pts.length; i += 2) sh += f(pts[i]) + ' ' + f(pts[i + 1]) + (i === 0 ? ' m\n' : ' l\n');
        if (tag === 'polygon') sh += 'h\n'; else { var f3 = fill; fill = null; paint(sh); fill = f3; sh = null; }
        if (sh) paint(sh);
      } else if (tag === 'image') {
        var href = g('href') || g('xlink:href') || '', m = /^data:image\/jpeg;base64,(.*)$/.exec(href);
        if (m) {
          var key = m[1].length + ':' + m[1].slice(0, 40) + m[1].slice(-40), im = ctx.imgs.filter(function (q) { return q.key === key; })[0];
          if (!im) { var bin = atob(m[1]), by = new Uint8Array(bin.length); for (var j = 0; j < bin.length; j++) by[j] = bin.charCodeAt(j); var d = jpegDims(by); im = { key: key, bytes: by, w: d.w, h: d.h, name: 'Im' + ctx.imgs.length }; ctx.imgs.push(im); }
          usedImgs[im.name] = 1;
          var x = +g('x'), y = +g('y'), bw = +g('width'), bh = +g('height'), par = g('preserveAspectRatio') || '', sc = /slice/.test(par) ? Math.max(bw / im.w, bh / im.h) : Math.min(bw / im.w, bh / im.h), dw = im.w * sc, dh = im.h * sc, dx = x + (bw - dw) / 2, dy = y + (bh - dh) / 2;
          out += '/' + gsName(s.opacity === undefined ? 1 : s.opacity, 1) + ' gs\n' + rr(x, y, bw, bh, 0) + 'W n\n' + f(dw) + ' 0 0 ' + f(-dh) + ' ' + f(dx) + ' ' + f(dy + dh) + ' cm\n/' + im.name + ' Do\n';
        }
      } else if (tag === 'text') {
        var fs = parseFloat(s['font-size'] || 4), bold = parseInt(s['font-weight'] || 400, 10) >= 600, txt = el.textContent, bytes = enc(txt), x0 = +(g('x') || 0), y0 = +(g('y') || 0), wd = tw(txt, fs, bold);
        var an = s['text-anchor'] || 'start'; if (an === 'middle') x0 -= wd / 2; else if (an === 'end') x0 -= wd;
        if (s['dominant-baseline'] === 'central') y0 += fs * 0.35;
        var font = '/' + (bold ? 'F2' : 'F1') + ' ' + f(fs) + ' Tf\n', tm = '1 0 0 -1 ' + f(x0) + ' ' + f(y0) + ' Tm\n', show = '(' + esc(bytes) + ') Tj\n';
        if (stroke && fill && s['paint-order'] === 'stroke') { var f4 = fill; setStyle(); out += 'BT\n' + font + '1 Tr\n' + tm + show + 'ET\n'; fill = f4; out += 'BT\n' + font + '0 Tr\n' + tm + show + 'ET\n'; }
        else if (fill || stroke) { setStyle(); out += 'BT\n' + font + (fill && stroke ? '2' : stroke ? '1' : '0') + ' Tr\n' + tm + show + 'ET\n'; }
      }
      out += 'Q\n';
    }
    var base = {};
    Array.prototype.forEach.call(root.children, function (c) { walk(c, base); });
    return { stream: out, imgs: usedImgs };
  }
  return { convert: convert };
})();
