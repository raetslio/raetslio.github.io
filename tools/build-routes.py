#!/usr/bin/env python3
"""Erzeugt je Unterseite einen Ordner mit index.html (Kopie von sudoku/index.html) mit eigenem Titel,
eigener Beschreibung, og:-Tags und canonical-Link. Die Texte hier müssen zu META in js/modes-init.js passen.
Aufruf im Hauptordner:  python3 tools/build-routes.py
Quelle der Wahrheit: app-body.html (Oberflaeche und Skriptliste, einmalig) und sudoku/index.html (Kopf/Huelle). Bearbeiten, dann das Skript laufen lassen."""
import re, pathlib, html
BASE = 'https://raetslio.github.io'
ROUTES = {
 'sudoku': ('Sudoku', 'Sudoku online spielen oder drucken: in vielen Größen und vier Schwierigkeitsstufen, mit Notizen und Prüfen.'),
 'suchsel': ('Suchsel', 'Suchsel (Wortsuche) online lösen oder als Arbeitsblatt drucken – mit eigenen Wörtern, wählbarer Größe und Richtungen.'),
 'binoxxo': ('Binoxxo', 'Binoxxo (Takuzu) online spielen und drucken: Fülle das Gitter mit X und O nach den Binoxxo-Regeln.'),
 'labyrinth': ('Labyrinth', 'Labyrinthe online durchlaufen oder drucken – in verschiedenen Größen und Schwierigkeitsgraden.'),
 'hitori': ('Hitori', 'Hitori online spielen und drucken: Schwärze Zahlen so, dass keine doppelt in Zeile oder Spalte steht.'),
 'zahlenmauer': ('Zahlenmauer', 'Zahlenmauern online rechnen oder als Arbeitsblatt drucken – mit Plus, Minus, Mal und Geteilt.'),
 'magisches-quadrat': ('Magisches Quadrat', 'Magische Quadrate online lösen und drucken: Alle Zeilen, Spalten und Diagonalen ergeben dieselbe Summe.'),
 'heft': ('Rätselheft', 'Stelle dein eigenes Rätselheft aus Sudoku, Suchsel, Binoxxo und mehr zusammen – mit Lösungen und PDF-Export.'),
 'spiele': ('Spielverlauf', 'Dein Spielverlauf bei Rätslio?: angefangene Rätsel öffnen und weiterspielen.'),
 'verlauf': ('Druckverlauf', 'Dein Druckverlauf bei Rätslio?: zuletzt gedruckte Rätsel noch einmal öffnen oder drucken.'),
 'support': ('Support', 'Support bei Rätslio?: Frage, Fehler oder Idee? Schreib uns direkt.'),
}
src = pathlib.Path('sudoku/index.html').read_text(encoding='utf-8')
def build(slug, name, desc):
    e = html.escape(desc, quote=True); url = f'{BASE}/{slug}/'
    title = 'Rätslio? — Sudoku, Suchsel, Binoxxo, Labyrinth, Hitori, Zahlenmauer, Magisches Quadrat &amp; Rätselheft' if slug == 'sudoku' else f'{name} — Rätslio?'
    s = re.sub(r'<title>.*?</title>', lambda m: f'<title>{title}</title>', src, count=1, flags=re.S)
    s = re.sub(r'\s*<link rel="canonical"[^>]*>', '', s)
    s = re.sub(r'\s*<meta property="og:url"[^>]*>', '', s)
    s = re.sub(r'<meta name="description" content="[^"]*">', lambda m: f'<meta name="description" content="{e}">\n  <link rel="canonical" href="{url}">', s, count=1)
    s = re.sub(r'<meta property="og:title" content="[^"]*">', lambda m: f'<meta property="og:title" content="{html.escape(name, quote=True)} — Rätslio?">\n  <meta property="og:url" content="{url}">', s, count=1)
    s = re.sub(r'<meta property="og:description" content="[^"]*">', lambda m: f'<meta property="og:description" content="{e}">', s, count=1)
    return s
# Anmeldeseite /login/: gleiche Seite, aber nur das Anmeldefenster sichtbar (Klasse rs-login), nicht indexierbar
def build_login():
    s = build('sudoku', 'Anmelden', 'Bitte melde dich bei Rätslio? an oder registriere dich.')
    s = s.replace('<title>Rätslio? — Sudoku, Suchsel, Binoxxo, Labyrinth, Hitori, Zahlenmauer, Magisches Quadrat &amp; Rätselheft</title>', '<title>Anmelden — Rätslio?</title>')
    s = re.sub(r'\s*<link rel="canonical"[^>]*>', '', s)
    s = re.sub(r'\s*<meta property="og:url"[^>]*>', '', s)
    s = s.replace('<meta charset="UTF-8">', '<meta charset="UTF-8">\n  <meta name="robots" content="noindex, nofollow">', 1)
    s = s.replace('<body>', '<body class="rs-login">', 1)
    return s
pathlib.Path('login').mkdir(exist_ok=True); pathlib.Path('login/index.html').write_text(build_login(), encoding='utf-8')
# Konto-Seite /konto/: gleiche Seite, nur das Konto-Fenster sichtbar (Klasse rs-konto), nicht indexierbar
def build_konto():
    s = build('sudoku', 'Mein Konto', 'Dein Konto bei Rätslio?: Profil, Anmeldung, Einladungen und Datensicherung.')
    s = s.replace('<title>Rätslio? — Sudoku, Suchsel, Binoxxo, Labyrinth, Hitori, Zahlenmauer, Magisches Quadrat &amp; Rätselheft</title>', '<title>Mein Konto — Rätslio?</title>')
    s = re.sub(r'\s*<link rel="canonical"[^>]*>', '', s)
    s = re.sub(r'\s*<meta property="og:url"[^>]*>', '', s)
    s = s.replace('<meta charset="UTF-8">', '<meta charset="UTF-8">\n  <meta name="robots" content="noindex, nofollow">', 1)
    s = s.replace('<body>', '<body class="rs-konto">', 1)
    return s
pathlib.Path('konto').mkdir(exist_ok=True); pathlib.Path('konto/index.html').write_text(build_konto(), encoding='utf-8')
for slug, (name, desc) in ROUTES.items():
    d = pathlib.Path(slug); d.mkdir(exist_ok=True); (d/'index.html').write_text(build(slug, name, desc), encoding='utf-8')
# sitemap.xml
urls = ''.join(f'  <url><loc>{BASE}/{s}/</loc></url>\n' for s in ROUTES if s not in ('spiele', 'verlauf', 'support'))
pathlib.Path('sitemap.xml').write_text('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + f'  <url><loc>{BASE}/</loc></url>\n' + urls + '</urlset>\n', encoding='utf-8')
print('ok', len(ROUTES))
