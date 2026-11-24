#!/usr/bin/env python3
"""Erzeugt je Unterseite einen Ordner mit index.html (Kopie von sudoku/index.html, nur Titel/Beschreibung angepasst).
Aufruf im Hauptordner:  python3 tools/build-routes.py
Quelle der Wahrheit ist sudoku/index.html – nur diese Datei bearbeiten, dann das Skript laufen lassen."""
import re, pathlib
ROUTES = {'suchsel':'Suchsel','binoxxo':'Binoxxo','labyrinth':'Labyrinth','hitori':'Hitori','zahlenmauer':'Zahlenmauer',
 'magisches-quadrat':'Magisches Quadrat','heft':'Rätselheft','spiele':'Spielverlauf','verlauf':'Druckverlauf'}
src = pathlib.Path('sudoku/index.html').read_text(encoding='utf-8')
for slug, name in ROUTES.items():
    s = re.sub(r'<title>.*?</title>', f'<title>{name} — Rätslio?</title>', src, 1, flags=re.S)
    d = pathlib.Path(slug); d.mkdir(exist_ok=True); (d/'index.html').write_text(s, encoding='utf-8')
print('ok', len(ROUTES))
