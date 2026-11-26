/* ======================================================================
   Rätselheft: Bedienoberfläche
   Liste, Einstellungen, Rätsel hinzufügen, Titelseite bearbeiten, Export-Knöpfe (Objekt BK).
   ====================================================================== */
'use strict';

var thumbTimer = null;
var ACCENTS = ['#2f6fed', '#e8590c', '#2b9348', '#8a3ffc', '#d6336c', '#3c5a6e'];
function refreshUI(keepTexts) {
  var items = displayItems(), el = $('bk-list'), o = bk.opts;
  $('bk-count').textContent = String(items.length);
  if (!items.length) el.innerHTML = '<div class="bk-empty">Noch keine Rätsel. Füge oben Rätsel hinzu – das Heft entsteht automatisch.</div>';
  else el.innerHTML = items.map(function (it, i) {
    var perOpts = ['auto', 1, 2, 4].map(function (v) { return '<option value="' + v + '"' + ((it.perPage || 'auto') == v ? ' selected' : '') + '>' + (v === 'auto' ? 'Auto (' + autoPer(it) + '/Seite)' : v + '/Seite') + '</option>'; }).join('');
    var dOpts = DIFFS.map(function (d, k) { return '<option value="' + k + '"' + (it.diff === k ? ' selected' : '') + '>' + d + '</option>'; }).join('');
    return '<div class="bk-item"><span class="no">' + (i + 1) + '</span><input class="input-control" type="text" maxlength="50" value="' + esc(it.name) + '" onchange="BK.rename(\'' + it.id + '\',this.value)" aria-label="Name">' +
      '<span style="display:flex;gap:4px"><button type="button" class="btn btn-sm" ' + (i === 0 ? 'disabled' : '') + ' onclick="BK.move(\'' + it.id + '\',-1)" aria-label="Nach oben">' + IC_UP + '</button><button type="button" class="btn btn-sm" ' + (i === items.length - 1 ? 'disabled' : '') + ' onclick="BK.move(\'' + it.id + '\',1)" aria-label="Nach unten">' + IC_DN + '</button></span>' +
      '<span></span><button type="button" class="btn btn-sm" onclick="BK.remove(\'' + it.id + '\')" aria-label="Entfernen">' + IC_X + '</button>' +
      '<span class="meta">' + TYPE_LABEL[it.type] + ' · ' + sizeLabel(it) + ' · <select aria-label="Schwierigkeit" onchange="BK.setDiff(\'' + it.id + '\',this.value)">' + dOpts + '</select> · <select aria-label="Rätsel pro Seite" onchange="BK.setPer(\'' + it.id + '\',this.value)">' + perOpts + '</select></span></div>';
  }).join('');
  var sel = $('bk-sel'); if (sel) { sel.innerHTML = bkIdx.list.map(function (x) { return '<option value="' + x.id + '"' + (x.id === bk.id ? ' selected' : '') + '>' + esc(x.name) + '</option>'; }).join(''); }
  var nm = $('bk-name'); if (nm && document.activeElement !== nm) nm.value = bk.name;
  $('bk-ex-count').textContent = String(bk.extras.length);
  var exl = $('bk-ex-list');
  if (exl && !(keepTexts && exl.contains(document.activeElement)) && !exl.contains(document.activeElement)) exl.innerHTML = bk.extras.length ? bk.extras.map(function (e, i) {
    var lab = { text: 'Textseite', image: 'Bildseite', notes: 'Notizseite', record: 'Rekordblatt' }[e.kind], body = '';
    body += '<div class="field-group"><label class="field-label">Überschrift</label><input class="input-control" type="text" maxlength="60" value="' + esc(e.title) + '" oninput="BK.setExtra(\'' + e.id + '\',\'title\',this.value)"></div>';
    if (e.kind === 'text') body += '<textarea class="textarea-control" rows="5" aria-label="Text" oninput="BK.setExtra(\'' + e.id + '\',\'text\',this.value)">' + esc(e.text) + '</textarea>';
    if (e.kind === 'image') body += '<input class="input-control" type="file" accept="image/*" aria-label="Bild wählen" onchange="BK.onExtraImage(\'' + e.id + '\',this)">' + (e.image ? '<span class="label">Bild gesetzt</span>' : '<span class="label">Noch kein Bild gewählt</span>');
    if (e.kind === 'notes') body += '<select class="select-control" aria-label="Seitenstil" onchange="BK.setExtra(\'' + e.id + '\',\'style\',this.value)">' + [['lines', 'Linien'], ['grid', 'Kariert'], ['dots', 'Punkte'], ['blank', 'Leer']].map(function (o) { return '<option value="' + o[0] + '"' + (e.style === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select>';
    if (e.kind === 'record') body += '<span class="label">Tabelle mit allen Rätseln zum Eintragen von Datum, Zeit und Sternen.</span>';
    return '<div class="bk-item" style="grid-template-columns:1fr auto auto;align-items:start"><div style="display:flex;flex-direction:column;gap:8px"><strong>' + lab + '</strong>' + body + '</div>' +
      '<div style="display:flex;flex-direction:column;gap:6px"><select class="select-control" aria-label="Position" onchange="BK.setExtra(\'' + e.id + '\',\'pos\',this.value,true)"><option value="front"' + (e.pos === 'front' ? ' selected' : '') + '>Vor den Rätseln</option><option value="end"' + (e.pos === 'end' ? ' selected' : '') + '>Nach den Rätseln</option></select><span style="display:flex;gap:4px"><button type="button" class="btn btn-sm" ' + (i === 0 ? 'disabled' : '') + ' onclick="BK.moveExtra(\'' + e.id + '\',-1)" aria-label="Nach oben">' + IC_UP + '</button><button type="button" class="btn btn-sm" ' + (i === bk.extras.length - 1 ? 'disabled' : '') + ' onclick="BK.moveExtra(\'' + e.id + '\',1)" aria-label="Nach unten">' + IC_DN + '</button><button type="button" class="btn btn-sm" onclick="BK.removeExtra(\'' + e.id + '\')" aria-label="Entfernen">' + IC_X + '</button></span></div><span></span></div>';
  }).join('') : '<div class="bk-empty">Noch keine Zusatzseiten.</div>';
  var sv = function (id, v, chk) { var e = $(id); if (!e || document.activeElement === e) return; if (chk) e.checked = !!v; else e.value = v; };
  sv('bk-title', o.title); sv('bk-subtitle', o.subtitle); sv('bk-owner', o.owner);
  [['bk-o-cover', 'cover'], ['bk-o-art', 'coverArt'], ['bk-o-csud', 'coverSudoku'], ['bk-o-cimg', 'coverUseImage'], ['bk-o-intro', 'intro'], ['bk-o-rules', 'rules'], ['bk-o-toc', 'toc'], ['bk-o-pn', 'pageNumbers'], ['bk-o-run', 'runHeader'], ['bk-o-meta', 'showMeta'], ['bk-o-pad', 'pad'], ['bk-o-sol', 'solutions']].forEach(function (p) { sv(p[0], o[p[1]], true); });
  sv('bk-o-pnpos', o.pageNumPos); sv('bk-o-cimgmode', o.coverImgMode); var ig = $('bk-img-grp'); if (ig) ig.classList.toggle('hidden', !bk.coverImage); sv('bk-o-format', o.format); sv('bk-o-covstyle', o.coverStyle); var fh = $('bk-format-hint'); if (fh) fh.classList.toggle('hidden', o.format !== 'a5'); sv('bk-o-notes', o.notes); sv('bk-o-solper', o.solPer);
  $('bk-accent').innerHTML = ACCENTS.map(function (c) { return '<button type="button" class="bk-swatch" style="background:' + c + '" aria-label="Akzentfarbe ' + c + '" aria-pressed="' + (o.accent === c) + '" onclick="BK.setAccent(\'' + c + '\')"></button>'; }).join('');
  document.querySelectorAll('#bk-sort .seg-btn').forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.s === o.sort ? 'true' : 'false'); });
  $('bk-sort-hint').textContent = { type: 'Sortiert nach Rätselart, innerhalb der Art nach Schwierigkeit.', diff: 'Sortiert nach Schwierigkeit, innerhalb der Stufe nach Rätselart.', manual: 'Eigene Reihenfolge – mit den Pfeilen verschieben.' }[o.sort];
  if (!keepTexts) {
    var types = TYPE_ORDER.filter(function (t) { return items.some(function (i) { return i.type === t; }); }), ti = $('bk-introText');
    if (ti && document.activeElement !== ti) ti.value = introFor(types.map(function (t) { return TYPE_LABEL[t]; }), items.length).join('\n');
    var box = $('bk-rules-ui');
    if (box && !box.contains(document.activeElement)) box.innerHTML = types.map(function (t) {
      return '<div class="bk-rule"><label class="check-item"><input type="checkbox" ' + (!o.rulesOff[t] ? 'checked' : '') + ' onchange="BK.toggleRule(\'' + t + '\',this.checked)"><span>' + TYPE_LABEL[t] + '</span></label><textarea class="textarea-control" rows="5" oninput="BK.setRules(\'' + t + '\',this.value)" aria-label="Spielregeln ' + TYPE_LABEL[t] + '">' + esc(rulesFor(t).join('\n')) + '</textarea><button type="button" class="btn btn-sm" onclick="BK.resetRules(\'' + t + '\')">Standardtext wiederherstellen</button></div>';
    }).join('') || '<div class="bk-empty">Füge Rätsel hinzu, dann kannst du deren Anleitungen bearbeiten.</div>';
  }
  clearTimeout(thumbTimer); thumbTimer = setTimeout(renderThumbs, 150);
  bkSave();
}
var lastSvgs = [];
function renderThumbs() {
  var box = $('bk-thumbs');
  if (!bk.items.length) { box.innerHTML = ''; $('bk-pages').textContent = '0 Seiten'; lastSvgs = []; return; }
  var r = renderAll(), a5 = bk.opts.format === 'a5'; lastSvgs = r.svgs;
  $('bk-pages').textContent = r.pages.length + ' Seiten' + (a5 ? ' · A5 (148 × 210 mm) · ' + r.pages.length / 4 + ' A4-Blätter' : ' · A4');
  var h = '', N = r.svgs.length;
  if (!a5) h = r.svgs.map(function (s, i) { return '<div class="bk-thumb" onclick="BK.zoom(' + i + ')">' + s + '<span>' + (i + 1) + '</span></div>'; }).join('');
  else {
    var groups = [[0]]; for (var i = 1; i < N; i += 2) groups.push(i + 1 < N ? [i, i + 1] : [i]);
    h = groups.map(function (g) {
      var cells = g.length === 2 ? g : (g[0] === 0 ? [-1, 0] : [g[0], -1]);
      return '<div class="bk-thumb bk-spread" onclick="BK.zoom(' + g.join(',') + ')">' + cells.map(function (k) { return k < 0 ? '<div class="pgv empty"></div>' : '<div class="pgv">' + r.svgs[k] + '</div>'; }).join('') + '<span>' + g.map(function (k) { return k + 1; }).join(' | ') + '</span></div>';
    }).join('');
  }
  box.innerHTML = h;
}
function bkStatus(msg, kind) { banner($('bk-status'), msg, kind); }

window.BK = {
  switchBooklet: function (id) {
    if (id === bk.id) return; bkSave();
    try { var d = JSON.parse(localStorage.getItem(BK_PRE + id) || 'null'); if (d) { setBk(d); bkIdx.current = id; idxSave(); } } catch (e) {}
    refreshUI(); bkStatus('Heft „' + bk.name + '“ geöffnet.', 'info');
  },
  newBooklet: function () { bkSave(); var f = freshBk('Heft ' + (bkIdx.list.length + 1)); setBk(f); bkSave(); refreshUI(); bkStatus('Neues Heft angelegt.', 'success'); },
  duplicateBooklet: function () { bkSave(); var c = JSON.parse(JSON.stringify(bk)); c.id = newId(); c.name = bk.name + ' (Kopie)'; setBk(c); bkSave(); refreshUI(); bkStatus('Heft dupliziert.', 'success'); },
  renameBooklet: function (v) { bk.name = v || 'Heft'; var e = bkIdx.list.filter(function (x) { return x.id === bk.id; })[0]; if (e) e.name = bk.name; var o = $('bk-sel').querySelector('option[value="' + bk.id + '"]'); if (o) o.textContent = bk.name; bkSave(); },
  deleteBooklet: function () {
    var del = function () {
      try { localStorage.removeItem(BK_PRE + bk.id); } catch (e) {}
      bkIdx.list = bkIdx.list.filter(function (x) { return x.id !== bk.id; });
      var next = bkIdx.list[0], d = null;
      if (next) { try { d = JSON.parse(localStorage.getItem(BK_PRE + next.id) || 'null'); } catch (e) {} }
      if (d) setBk(d); else { setBk(freshBk('Mein Heft')); }
      bkSave(); refreshUI(); bkStatus('Heft gelöscht.', 'success');
    };
    BK.dialog('<h3 class="section-title" style="margin:0 0 8px">Heft <strong>löschen</strong>?</h3><p>Das Heft „' + esc(bk.name) + '“ wird samt allen Rätseln endgültig gelöscht.</p>', del, 'Heft löschen');
  },
  exportBooklet: function () {
    bkSave(); var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify({ format: 'raetselheft', version: 2, booklet: bk })], { type: 'application/json' }));
    a.download = (bk.name || 'heft').replace(/[^\wäöüÄÖÜß-]+/g, '_') + '.raetselheft.json'; document.body.appendChild(a); a.click(); a.remove(); bkStatus('Heft als Datei gespeichert.', 'success');
  },
  importBooklet: function (inp) {
    var f = inp.files && inp.files[0]; if (!f) return; var fr = new FileReader();
    fr.onload = function () {
      try {
        var j = JSON.parse(fr.result), d = j.booklet || j; if (!Array.isArray(d.items)) throw new Error('Keine Heft-Datei');
        bkSave(); d.id = newId(); d.name = (d.name || 'Importiertes Heft'); setBk(d); bkSave(); refreshUI(); bkStatus('Heft „' + bk.name + '“ geladen.', 'success');
      } catch (e) { bkStatus('Die Datei konnte nicht gelesen werden: ' + e.message, 'error'); }
      inp.value = '';
    };
    fr.readAsText(f);
  },
  addExtra: function (kind) {
    var t = { text: 'Vorwort', image: 'Bildseite', notes: 'Notizen', record: 'Rekordblatt' }[kind];
    bk.extras.push({ id: newId(), kind: kind, title: t, text: kind === 'text' ? 'Schreibe hier deinen Text. Leere Zeilen trennen Absätze.' : '', image: null, style: 'lines', pos: kind === 'text' ? 'front' : 'end' });
    refreshUI();
  },
  removeExtra: function (id) { bk.extras = bk.extras.filter(function (e) { return e.id !== id; }); refreshUI(); },
  moveExtra: function (id, dir) { var i = bk.extras.findIndex(function (e) { return e.id === id; }), j = i + dir; if (i < 0 || j < 0 || j >= bk.extras.length) return; var t = bk.extras[i]; bk.extras[i] = bk.extras[j]; bk.extras[j] = t; refreshUI(); },
  setExtra: function (id, key, val, rebuild) {
    var e = bk.extras.filter(function (x) { return x.id === id; })[0]; if (!e) return; e[key] = val;
    if (rebuild) { refreshUI(); return; }
    clearTimeout(thumbTimer); thumbTimer = setTimeout(function () { renderThumbs(); bkSave(); }, 300);
  },
  onExtraImage: function (id, inp) {
    var f = inp.files && inp.files[0]; if (!f) return;
    readImage(f, 1600, function (data) { BK.setExtra(id, 'image', data, true); });
  },
  init: function () { bkLoad(); BK.onGenType(); refreshUI(); },
  onGenType: function () {
    var t = $('bk-gen-type').value, sel = $('bk-gen-size'); var opw = $('bk-gen-op-wrap'); if (opw) opw.classList.toggle('hidden', t !== 'mauer');
    if (t === 'ws') { sel.disabled = false; sel.innerHTML = [10, 12, 14, 16, 20, 24, 30].map(function (s) { return '<option value="' + s + '"' + (s === 16 ? ' selected' : '') + '>' + s + '×' + s + '</option>'; }).join(''); } else {
      sel.disabled = false; var def = { sudoku: 9, binoxxo: 8, maze: 15, hitori: 8, magic: 4, mauer: 4 }[t];
      sel.innerHTML = BK_SIZES[t].map(function (s) { return '<option value="' + s + '"' + (s === def ? ' selected' : '') + '>' + (t === 'mauer' ? s + ' Zeilen' : s + '×' + s) + '</option>'; }).join('');
    }
    $('bk-gen-diff').disabled = (t === 'maze' || t === 'ws');
    $('bk-gen-note').textContent = t === 'maze' ? 'Schwierigkeit ergibt sich aus der Größe.' : t === 'ws' ? 'Schwierigkeit ergibt sich aus Größe und Richtungen.' : t === 'mauer' ? 'Bei „Mal“ sind höchstens 4, bei „Geteilt“ höchstens 5 Zeilen möglich.' : '';
    var wb = $('bk-ws-box'); if (wb) { wb.classList.toggle('hidden', t !== 'ws'); if (t === 'ws' && !$('bk-ws-words').value) BK.wsFromTab(); }
  },
  generateAdd: function () {
    var t = $('bk-gen-type').value, cnt = Math.max(1, Math.min(20, +$('bk-gen-count').value || 1)), size = +$('bk-gen-size').value, diff = +$('bk-gen-diff').value, btn = $('bk-gen-btn');
    btn.disabled = true; bkStatus('Rätsel werden erzeugt …', 'info');
    setTimeout(function () {
      var added = 0;
      try {
        for (var i = 0; i < cnt; i++) {
          if (t === 'sudoku') {
            var sg = window.computeSubgrid(size), d = window.createSudokuPuzzleData(size, sg.subR, sg.subC, DIFF_KEYS[diff]);
            addItem('sudoku', { n: size, subR: sg.subR, subC: sg.subC, solution: d.solution, givens: d.givens }, diff); added++;
          } else if (t === 'binoxxo') {
            var b = bxCreate(size, diff); if (b) { addItem('binoxxo', b, diff); added++; }
          } else if (t === 'maze') { var mm = mazeCreate(size); addItem('maze', mm, mazeDiff(size, mm.h)); added++; }
          else if (NXT[t]) { var nd = NXT[t].create(size, diff, $('bk-gen-op') ? $('bk-gen-op').value : 'plus'); if (nd) { addItem(t, nd, diff); added++; } }
          else { var w = wsGenerate(size); if (w) { addItem('ws', w, wsDiff(w), ($('bk-ws-name').value || '').trim() || undefined); added++; } }
        }
      } catch (e) { bkStatus('Fehler beim Erzeugen: ' + e.message, 'error'); }
      btn.disabled = false; if (added) bkStatus(added + (added === 1 ? ' Rätsel hinzugefügt.' : ' Rätsel hinzugefügt.'), 'success');
      refreshUI();
    }, 30);
  },
  wsFromTab: function () { $('bk-ws-words').value = window.appState.ws.wordsRaw || ''; },
  addCurrent: function (type) {
    var A = window.appState, ok = false;
    if (type === 'sudoku') { var s = A.sudoku; if (s.solution.length) { addItem('sudoku', { n: s.size, subR: s.subR, subC: s.subC, solution: s.solution.map(function (r) { return r.slice(); }), givens: s.givens.map(function (r) { return r.slice(); }) }, Math.max(0, DIFF_KEYS.indexOf(s.difficulty))); ok = true; } }
    else if (type === 'ws') { var w = wsSnapshot(); if (w) { addItem('ws', w, wsDiff(w)); ok = true; } }
    else if (type === 'binoxxo') { var b = BX.current(); if (b) { addItem('binoxxo', { n: b.n, solution: b.solution, givens: b.givens }, b.diff); ok = true; } }
    else if (type === 'maze') { var m = MZ.current(); if (m) { addItem('maze', m, mazeDiff(m.n, m.h)); ok = true; } }
    else if (NXT[type]) { var cx = NXT[type].current(); if (cx) { addItem(type, JSON.parse(JSON.stringify(cx.data)), cx.diff); ok = true; } }
    if (ok) { refreshUI(); toast('Dein Rätsel wurde zum Rätselheft hinzugefügt (' + bk.items.length + ' im Heft).'); }
  },
  rename: function (id, v) { var it = bk.items.filter(function (i) { return i.id === id; })[0]; if (it) { it.name = v.trim() || it.name; refreshUI(); } },
  setDiff: function (id, v) { var it = bk.items.filter(function (i) { return i.id === id; })[0]; if (it) { it.diff = +v; refreshUI(); } },
  setPer: function (id, v) { var it = bk.items.filter(function (i) { return i.id === id; })[0]; if (it) { it.perPage = v; refreshUI(); } },
  remove: function (id) { bk.items = bk.items.filter(function (i) { return i.id !== id; }); refreshUI(); },
  move: function (id, dir) {
    if (bk.opts.sort !== 'manual') { bk.items = displayItems(); bk.opts.sort = 'manual'; }
    var i = bk.items.findIndex(function (x) { return x.id === id; }), j = i + dir;
    if (i < 0 || j < 0 || j >= bk.items.length) return;
    var t = bk.items[i]; bk.items[i] = bk.items[j]; bk.items[j] = t; refreshUI();
  },
  setSort: function (s) { if (s === 'manual' && bk.opts.sort !== 'manual') bk.items = displayItems(); bk.opts.sort = s; refreshUI(); },
  setOpt: function (k, v) {
    bk.opts[k] = v; clearTimeout(thumbTimer);
    thumbTimer = setTimeout(function () { renderThumbs(); bkSave(); }, 250);
    if (k === 'coverSudoku' || k === 'coverArt' || k === 'coverUseImage') setTimeout(function () { refreshUI(true); }, 0);
    if (k === 'toc' || k === 'rules' || k === 'solutions' || k === 'format') setTimeout(function () { refreshUI(); }, 0);
  },
  onCoverFile: function (inp) {
    var f = inp.files && inp.files[0]; if (!f) return;
    var fr = new FileReader();
    fr.onload = function () {
      var img = new Image();
      img.onload = function () {
        var sc = Math.min(1, 1400 / Math.max(img.width, img.height)), cv = document.createElement('canvas');
        cv.width = Math.round(img.width * sc); cv.height = Math.round(img.height * sc);
        var cx = cv.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, cv.width, cv.height); cx.drawImage(img, 0, 0, cv.width, cv.height);
        bk.coverImage = cv.toDataURL('image/jpeg', 0.85); bk.opts.coverUseImage = true; bk.opts.coverArt = true; bk.opts.cover = true;
        inp.value = ''; refreshUI(true);
      };
      img.onerror = function () { bkStatus('Das Bild konnte nicht gelesen werden.', 'error'); };
      img.src = fr.result;
    };
    fr.readAsDataURL(f);
  },
  removeCoverImage: function () { bk.coverImage = null; bk.opts.coverUseImage = false; refreshUI(true); },
  newCoverSudoku: function () { bk.cover = null; refreshUI(true); },
  setAccent: function (c) { bk.opts.accent = c; refreshUI(true); },
  toggleRule: function (t, on) { bk.opts.rulesOff[t] = !on; refreshUI(true); },
  setRules: function (t, v) { bk.opts.rulesText[t] = v; clearTimeout(thumbTimer); thumbTimer = setTimeout(function () { renderThumbs(); bkSave(); }, 300); },
  resetRules: function (t) { delete bk.opts.rulesText[t]; var b = $('bk-rules-ui'); if (b) b.innerHTML = ''; refreshUI(); },
  resetIntro: function () { bk.opts.introText = ''; var t = $('bk-introText'); if (t) t.blur(); refreshUI(); },
  clearAll: function () {
    var doIt = function () { bk.items = []; bk.counters = {}; bk.cover = null; refreshUI(); bkStatus('Das Heft wurde geleert.', 'success'); };
    if (!bk.items.length) { bkStatus('Das Heft ist bereits leer.', 'info'); return; }
    BK.dialog('<h3 class="section-title" style="margin:0 0 8px">Heft <strong>leeren</strong>?</h3><p>Alle ' + bk.items.length + ' Rätsel werden aus dem Heft entfernt. Titel und Einstellungen bleiben erhalten.</p>', doIt, 'Heft leeren');
  },
  zoom: function () {
    var idx = [].slice.call(arguments), d = document.createElement('div'); d.className = 'bk-zoom';
    d.innerHTML = idx.length === 1 ? '<div>' + lastSvgs[idx[0]] + '</div>' : '<div class="sp">' + idx.map(function (k) { return '<div>' + lastSvgs[k] + '</div>'; }).join('') + '</div>';
    d.onclick = function () { d.remove(); }; document.body.appendChild(d);
  },
  editCover: function () {
    if (!bk.opts.cover) { bkStatus('Die Titelseite ist ausgeschaltet.', 'warning'); return; }
    var d = document.createElement('div'); d.className = 'bk-zoom'; d.style.cursor = 'default';
    d.innerHTML = '<div class="bk-dlg panel cvedit" style="max-width:860px;display:grid;grid-template-columns:minmax(0,1fr) 240px;gap:16px;align-items:start"><div id="cv-stage" style="touch-action:none;text-align:center"></div><div><h3 class="section-title" style="margin:0 0 8px">Cover <strong>bearbeiten</strong></h3><p class="muted-note">Elemente mit Maus oder Finger verschieben. Mit dem Haken blendest du sie ein oder aus.</p><div id="cv-list" style="display:flex;flex-direction:column;gap:6px;margin:8px 0"></div><div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="btn btn-sm" id="cv-reset">Zurücksetzen</button><button type="button" class="btn btn-primary btn-sm" id="cv-done">Fertig</button></div></div></div>';
    document.body.appendChild(d);
    var stage = d.querySelector('#cv-stage'), list = d.querySelector('#cv-list');
    function paint() {
      ensureCover(); ACC = bk.opts.accent || '#2f6fed'; PW = 'width="210mm" height="296mm"';
      var pages = buildPages(); stage.innerHTML = renderPage(pages[0], pages);
      var sv = stage.querySelector('svg'); sv.style.cssText = 'width:100%;height:auto;display:block;max-height:78vh';
      list.innerHTML = coverReg.map(function (e) { return '<label class="check-item"><input type="checkbox" data-n="' + e.name + '"' + (elState(e.name).hide ? '' : ' checked') + '><span>' + esc(e.label) + (e.nomove ? '' : '') + '</span></label>'; }).join('');
      Array.prototype.forEach.call(stage.querySelectorAll('[data-el]'), function (g) { var n = g.getAttribute('data-el'); if (!(coverReg.filter(function (e) { return e.name === n; })[0] || {}).nomove) g.style.cursor = 'move'; });
    }
    function commit() { refreshUI(true); }
    list.addEventListener('change', function (e) { var n = e.target.getAttribute('data-n'); if (!n) return; var st = bk.opts.coverEl[n] = bk.opts.coverEl[n] || {}; st.hide = !e.target.checked; paint(); commit(); });
    d.querySelector('#cv-reset').onclick = function () { bk.opts.coverEl = {}; paint(); commit(); };
    d.querySelector('#cv-done').onclick = function () { d.remove(); };
    d.addEventListener('click', function (e) { if (e.target === d) d.remove(); });
    var drag = null;
    stage.addEventListener('pointerdown', function (e) {
      var g = e.target.closest && e.target.closest('[data-el]'); if (!g) return;
      var n = g.getAttribute('data-el'), reg = coverReg.filter(function (x) { return x.name === n; })[0]; if (reg && reg.nomove) return;
      var st = bk.opts.coverEl[n] = bk.opts.coverEl[n] || {};
      drag = { g: g, n: n, sx: e.clientX, sy: e.clientY, ox: st.dx || 0, oy: st.dy || 0, k: 210 / stage.querySelector('svg').getBoundingClientRect().width, st: st };
      try { stage.setPointerCapture(e.pointerId); } catch (x) {} e.preventDefault();
    });
    stage.addEventListener('pointermove', function (e) {
      if (!drag) return;
      drag.st.dx = +(drag.ox + (e.clientX - drag.sx) * drag.k).toFixed(1); drag.st.dy = +(drag.oy + (e.clientY - drag.sy) * drag.k).toFixed(1);
      drag.g.setAttribute('transform', 'translate(' + drag.st.dx + ' ' + drag.st.dy + ')');
    });
    var end = function () { if (!drag) return; drag = null; commit(); };
    stage.addEventListener('pointerup', end); stage.addEventListener('pointercancel', end);
    paint();
  },
  buildPdfBlob: async function (onProgress) {
    var a5 = bk.opts.format === 'a5', svgs = renderAll().svgs, sheets = sheetsFor(svgs, a5), ctx = { gs: {}, imgs: [] }, pages = [];
    var MM = 72 / 25.4, wmm = a5 ? 297 : 210, hmm = a5 ? 210 : 297, k = a5 ? 148.5 / 210 : 1;
    for (var i = 0; i < sheets.length; i++) {
      if (onProgress) onProgress(i + 1, sheets.length);
      var stream = 'q\n' + f2(MM) + ' 0 0 ' + f2(-MM) + ' 0 ' + f2(hmm * MM) + ' cm\n', used = {};
      for (var q = 0; q < sheets[i].length; q++) {
        var res = PDFX.convert(sheets[i][q], ctx);
        stream += 'q\n' + (a5 ? '1 0 0 1 ' + f2(q * 148.5) + ' 0 cm\n' + f2(k) + ' 0 0 ' + f2(k) + ' 0 0 cm\n' : '') + res.stream + 'Q\n';
        Object.keys(res.imgs).forEach(function (n) { used[n] = 1; });
      }
      stream += 'Q\n'; pages.push({ stream: stream, used: used });
      await new Promise(function (r) { setTimeout(r, 0); });
    }
    function f2(n) { return (+n.toFixed(4)).toString(); }
    var enc = new TextEncoder(), parts = [], offs = [], len = 0, nextObj = 1;
    var push = function (x) { var b = typeof x === 'string' ? enc.encode(x) : x; parts.push(b); len += b.length; };
    var pushLatin = function (s) { var b = new Uint8Array(s.length); for (var z = 0; z < s.length; z++) b[z] = s.charCodeAt(z) & 255; parts.push(b); len += b.length; };
    var objOf = function (n, body) { offs[n] = len; push(n + ' 0 obj\n' + body + '\nendobj\n'); };
    var N = pages.length, gsList = Object.keys(ctx.gs).map(function (kk) { return ctx.gs[kk]; });
    /* Objekt-Nummern: 1 Katalog, 2 Pages, 3 F1, 4 F2, dann GS, dann Bilder, dann je Seite 2 Objekte */
    var gsBase = 5, imBase = gsBase + gsList.length, pgBase = imBase + ctx.imgs.length, total = pgBase + 2 * N;
    push('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
    objOf(1, '<< /Type /Catalog /Pages 2 0 R >>');
    var kids = []; for (var p = 0; p < N; p++) kids.push((pgBase + 2 * p) + ' 0 R');
    objOf(2, '<< /Type /Pages /Kids [' + kids.join(' ') + '] /Count ' + N + ' >>');
    objOf(3, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
    objOf(4, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
    gsList.forEach(function (g, j) { objOf(gsBase + j, '<< /Type /ExtGState /ca ' + f2(g.fa) + ' /CA ' + f2(g.sa) + ' >>'); });
    ctx.imgs.forEach(function (im, j) {
      var n = imBase + j; offs[n] = len; push(n + ' 0 obj\n<< /Type /XObject /Subtype /Image /Width ' + im.w + ' /Height ' + im.h + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + im.bytes.length + ' >>\nstream\n'); push(im.bytes); push('\nendstream\nendobj\n');
    });
    var gsRes = gsList.map(function (g, j) { return '/' + g.name + ' ' + (gsBase + j) + ' 0 R'; }).join(' ');
    pages.forEach(function (pg, p) {
      var n = pgBase + 2 * p, xo = ctx.imgs.map(function (im, j) { return pg.used[im.name] ? '/' + im.name + ' ' + (imBase + j) + ' 0 R' : ''; }).join(' ');
      objOf(n, '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + f2(wmm * MM) + ' ' + f2(hmm * MM) + '] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> /ExtGState << ' + gsRes + ' >> /XObject << ' + xo + ' >> >> /Contents ' + (n + 1) + ' 0 R >>');
      offs[n + 1] = len; push((n + 1) + ' 0 obj\n<< /Length ' + pg.stream.length + ' >>\nstream\n'); pushLatin(pg.stream); push('\nendstream\nendobj\n');
    });
    var xr = len, x = 'xref\n0 ' + total + '\n0000000000 65535 f \n';
    for (var z = 1; z < total; z++) x += ('0000000000' + offs[z]).slice(-10) + ' 00000 n \n';
    push(x + 'trailer\n<< /Size ' + total + ' /Root 1 0 R >>\nstartxref\n' + xr + '\n%%EOF');
    return new Blob(parts, { type: 'application/pdf' });
  },
  downloadPdf: function () {
    if (!bk.items.length) { bkStatus('Füge zuerst Rätsel hinzu.', 'warning'); return; }
    var a5 = bk.opts.format === 'a5';
    var go = function () {
      bkStatus('PDF wird erstellt …', 'info');
      BK.buildPdfBlob(function (i, n) { bkStatus('PDF wird erstellt … Seite ' + i + ' von ' + n, 'info'); }).then(function (blob) {
        var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = (bk.opts.title || 'raetselheft').replace(/[^\wäöüÄÖÜß-]+/g, '_') + (a5 ? '_A5-Heft' : '') + '.pdf';
        document.body.appendChild(a); a.click(); a.remove();
        bkStatus(a5 ? 'PDF gespeichert (A4 quer). Beim Drucken: beidseitig und „An der kurzen Seite wenden“ aktivieren!' : 'PDF gespeichert.', 'success');
      }).catch(function (e) { bkStatus('PDF konnte nicht erstellt werden: ' + e.message, 'error'); });
    };
    if (!a5) { go(); return; }
    BK.dialog('<h3 class="section-title" style="margin:0 0 8px">PDF für den <strong>A5-Heftdruck</strong></h3><p>Das PDF hat A4-Querformat-Blätter mit je zwei A5-Seiten. Beim Drucken unbedingt:</p><ol style="margin:0;padding-left:20px;line-height:1.6"><li><b>Beidseitig drucken</b> (Duplex) aktivieren.</li><li><b>„An der kurzen Seite wenden“</b> (Short Edge) wählen.</li><li>Skalierung <b>100 %</b> (nicht „Anpassen“).</li><li>Blätter ineinanderlegen und in der Mitte falten.</li></ol>', go, 'PDF erstellen');
  },
  dialog: function (html, ok, label) {
    var d = document.createElement('div'); d.className = 'bk-zoom'; d.style.cursor = 'default';
    d.innerHTML = '<div class="bk-dlg panel">' + html + '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px;flex-wrap:wrap"><button type="button" class="btn" data-a="no">Abbrechen</button><button type="button" class="btn btn-primary" data-a="ok">' + (label || 'Druckdialog öffnen') + '</button></div></div>';
    d.addEventListener('click', function (e) { var a = e.target.getAttribute && e.target.getAttribute('data-a'); if (a === 'ok') { d.remove(); ok(); } else if (a === 'no' || e.target === d) d.remove(); });
    document.body.appendChild(d);
  },
  printBooklet: function () {
    if (!bk.items.length) { bkStatus('Füge zuerst Rätsel hinzu.', 'warning'); return; }
    var go = function () { printSvgs(renderAll().svgs, bk.opts.format === 'a5'); };
    if (bk.opts.format !== 'a5') { go(); return; }
    BK.dialog('<h3 class="section-title" style="margin:0 0 8px">Wichtig für den <strong>A5-Heftdruck</strong></h3><ol style="margin:0;padding-left:20px;line-height:1.6"><li>Papierformat <b>A4</b>, Ausrichtung <b>Querformat</b>.</li><li><b>Beidseitig drucken</b> (Duplex) aktivieren.</li><li>Unbedingt <b>„An der kurzen Seite wenden“</b> (Short Edge / Kurze Kante) wählen – sonst stehen die Rückseiten auf dem Kopf.</li><li>Skalierung <b>100 %</b>, Ränder <b>Keine</b>.</li><li>Blätter in der Reihenfolge ineinanderlegen und <b>in der Mitte falten</b>.</li></ol>', go);
  },
  printWorksheet: function (type) {
    var cur = null;
    if (type === 'binoxxo') { var b = BX.current(); if (b) cur = { type: 'binoxxo', name: 'Binoxxo', diff: b.diff, data: { n: b.n, solution: b.solution, givens: b.givens } }; }
    if (type === 'maze') { var m = MZ.current(); if (m) cur = { type: 'maze', name: 'Labyrinth', diff: mazeDiff(m.n, m.h), data: m }; }
    if (NXT[type]) { var cn = NXT[type].current(); if (cn) cur = { type: type, name: TYPE_LABEL[type], diff: cn.diff, data: cn.data }; }
    if (!cur) return;
    cur.name = { binoxxo: 'Binoxxo', maze: 'Irrgarten' }[type] || cur.name;
    var saved = bk.opts.pageNumbers; bk.opts.pageNumbers = false;
    var svgs = renderAll([cur]).svgs; bk.opts.pageNumbers = saved;
    printSvgs(svgs);
  },
  downloadHtml: function () {
    if (!bk.items.length) { bkStatus('Füge zuerst Rätsel hinzu.', 'warning'); return; }
    var a5 = bk.opts.format === 'a5', svgs = renderAll().svgs;
    var html = '<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><title>' + esc(bk.opts.title) + '</title><link href="https://fonts.googleapis.com/css2?family=Outfit:wght@100..900&family=Hanken+Grotesk:wght@100..900&display=swap" rel="stylesheet"><style>' + (a5 ? '@page{size:A4 landscape;margin:0}.pg{width:297mm;height:209mm;display:flex}.pg svg{width:148.5mm;height:210mm}' : '@page{size:A4 portrait;margin:0}.pg{width:210mm;height:296mm}.pg svg{width:210mm;height:296mm}') + '.note{background:#fff3cd;color:#5c4400;font:14px Arial,sans-serif;padding:10px 14px;margin:0}@media print{.note{display:none}}html,body{margin:0;background:#888}.pg{margin:8mm auto;background:#fff;overflow:hidden;page-break-after:always;break-after:page}.pg svg{display:block}@media print{html,body{background:none}.pg{margin:0}}</style></head><body>' + (a5 ? '<p class="note"><b>A5-Heft drucken:</b> A4 Querformat, beidseitig drucken, <b>„An der kurzen Seite wenden“</b> aktivieren, Skalierung 100 %, Ränder keine. Blätter ineinanderlegen und in der Mitte falten.</p>' : '') + sheetsFor(svgs, a5).map(function (s) { return '<div class="pg">' + s.join('') + '</div>'; }).join('') + '</body></html>';
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([html], { type: 'text/html' })); a.download = (bk.opts.title || 'raetselheft').replace(/[^\wäöüÄÖÜß-]+/g, '_') + '.html';
    document.body.appendChild(a); a.click(); a.remove();
  }
};
function sheetsFor(svgs, a5) {
  if (!a5) return svgs.map(function (s) { return [s]; });
  var N = svgs.length, out = [];
  for (var s = 0; s < N / 4; s++) { out.push([svgs[N - 1 - 2 * s], svgs[2 * s]]); out.push([svgs[2 * s + 1], svgs[N - 2 - 2 * s]]); }
  return out;
}
function printSvgs(svgs, a5) {
  var c = $('print-output-container'); c.innerHTML = '';
  sheetsFor(svgs, a5).forEach(function (pair) {
    var d = document.createElement('div'); d.className = a5 ? 'print-sheet-l' : 'print-page-sheet'; d.innerHTML = pair.join(''); c.appendChild(d);
  });
  var st = document.getElementById('dyn-page'); if (st) st.remove();
  if (a5) {
    st = document.createElement('style'); st.id = 'dyn-page'; st.textContent = '@page{size:A4 landscape;margin:0}@media print{html,body{width:297mm !important}}'; document.head.appendChild(st);
    window.addEventListener('afterprint', function () { var x = document.getElementById('dyn-page'); if (x) x.remove(); }, { once: true });
  }
  try { window.print(); bkStatus(a5 ? 'Druckdialog geöffnet. Bitte A4 quer, beidseitig und „An der kurzen Seite wenden“ aktivieren!' : 'Druckdialog geöffnet.', 'info'); } catch (e) { bkStatus('Direktdruck ist hier blockiert – nutze „Als PDF speichern“.', 'warning'); }
}
function toast(msg) {
  var t = document.createElement('div'); t.className = 'feedback-banner success'; t.textContent = msg;
  t.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:300;box-shadow:var(--sheet-shadow)';
  document.body.appendChild(t); setTimeout(function () { t.remove(); }, 2200);
}
