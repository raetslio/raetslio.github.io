#!/usr/bin/env python3
"""Einmalige Umstellung der Oberfläche (Seitenmenü, Rätsel-Einstellungen). Läuft auf sudoku/index.html.
Danach tools/build-routes.py ausführen. Idempotent: bereits umgestellte Dateien werden übersprungen."""
import re, pathlib

MENU_SVG = '<svg class="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h10"/></svg>'
CLOSE_SVG = '<svg class="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>'
SLIDERS_SVG = '<svg class="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/></svg>'
CHEV_SVG = '<svg class="rs-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>'
PUZZLES = ['sudoku', 'wortsuche', 'binoxxo', 'hitori', 'magic', 'mauer', 'labyrinth']
VIEWS = {'wortsuche': 'wortsuche', 'binoxxo': 'binoxxo', 'hitori': 'hitori', 'magic': 'magic', 'mauer': 'mauer', 'labyrinth': 'labyrinth', 'sudoku': 'sudoku'}

def run(path):
    p = pathlib.Path(path); s = p.read_text(encoding='utf-8')
    if 'id="rs-drawer"' in s: print('skip', path); return
    s = s.replace('width=device-width, initial-scale=1.0">', 'width=device-width, initial-scale=1.0, viewport-fit=cover">', 1)
    s = s.replace('<link rel="stylesheet" href="css/extensions.css">', '<link rel="stylesheet" href="css/extensions.css">\n  <link rel="stylesheet" href="css/sidebar.css">', 1)
    # --- Kopfbereich ---
    m = re.search(r'<nav class="nav-tabs".*?</nav>', s, re.S); nav = m.group(0)
    btns = re.findall(r'\s*<button type="button" id="tab-([\w-]+)".*?</button>', nav, re.S)
    full = {b: re.search(r'<button type="button" id="tab-%s".*?</button>' % b, nav, re.S).group(0) for b in btns}
    def grp(title, ids): return '<div class="rs-drawer-label">%s</div>\n' % title + '\n'.join('          ' + full[i] for i in ids if i in full)
    rest = [b for b in btns if b not in PUZZLES]
    nav_new = ('<nav class="nav-tabs" aria-label="Rätselmodus wählen">\n          ' + grp('Rätselarten', PUZZLES) +
               '\n          ' + grp('Sammlungen', rest) + '\n        </nav>')
    mb = re.search(r'\s*<button type="button" id="btn-account".*?</button>', s, re.S); acct = mb.group(0).strip()
    acct = acct.replace('class="btn"', 'class="btn rs-account"', 1)
    mp = re.search(r'<button type="button" id="btn-open-print".*?</button>', s, re.S); pr = mp.group(0)
    pr = re.sub(r'(</svg>)\s*(Druckfenster &amp; Export)\s*(</button>)', r'\1\n          <span class="rs-print-label">\2</span>\n        \3', pr, flags=re.S)
    pr = pr.replace('class="btn btn-primary"', 'class="btn btn-primary" aria-label="Druckfenster &amp; Export"', 1)
    mh = re.search(r'<header class="site-header">\s*(<div class="brand-block">.*?</div>)\s*<div class="header-controls">.*?</header>', s, re.S)
    brand = mh.group(1)
    header = ('<header class="site-header">\n      <button type="button" id="rs-menu-btn" class="rs-icon-btn" aria-label="Menü öffnen" aria-expanded="false" aria-controls="rs-drawer">' + MENU_SVG + '</button>\n      ' + brand +
              '\n      <div class="header-controls">\n        ' + pr + '\n      </div>\n    </header>')
    s = s[:mh.start()] + header + s[mh.end():]
    drawer = ('<div id="rs-backdrop" class="rs-backdrop" aria-hidden="true"></div>\n  <aside id="rs-drawer" class="rs-drawer" aria-label="Hauptmenü" aria-hidden="true">\n'
              '    <div class="rs-drawer-head"><span class="rs-drawer-title">Rätslio?</span>'
              '<button type="button" id="rs-menu-close" class="rs-icon-btn" aria-label="Menü schließen">' + CLOSE_SVG + '</button></div>\n'
              '    <div class="rs-drawer-scroll">\n        ' + nav_new + '\n    </div>\n'
              '    <div class="rs-drawer-foot">\n        ' + acct + '\n    </div>\n  </aside>\n  ')
    s = s.replace('<div class="app-shell">', drawer + '<div class="app-shell">', 1)
    # --- Rätsel-Einstellungen ---
    for v in PUZZLES:
        mm = re.search(r'(<main id="view-%s" class="page-grid)( hidden)?(">\s*<div class="main-column">)' % v, s)
        if not mm: print('?', v); continue
        ma = re.search(r'\n\s*<aside class="side-column".*?</aside>', s[mm.end():], re.S)
        aside = ma.group(0).strip(); a0 = mm.end() + ma.start(); a1 = mm.end() + ma.end()
        s = s[:a0] + s[a1:]
        det = ('\n        <details class="panel rs-settings" id="settings-%s"><summary>%s<span>Rätsel-Einstellungen</span>%s</summary>\n          <div class="rs-settings-body">\n          %s\n          </div>\n        </details>\n' % (v, SLIDERS_SVG, CHEV_SVG, aside))
        s = s[:mm.start()] + mm.group(1) + ' rs-single' + (mm.group(2) or '') + mm.group(3) + det + s[mm.end():]
    p.write_text(s, encoding='utf-8'); print('ok', path)

for f in ('sudoku/index.html',):
    run(f)
