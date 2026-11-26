#!/usr/bin/env python3
"""Setzt js/account.js aus den Teildateien in js/account-src/ zusammen (Reihenfolge nach Dateiname).
Aufruf im Hauptordner:  python3 tools/build-account.py
Quelle der Wahrheit sind die Teildateien; js/account.js nie von Hand bearbeiten.
Mit --check wird nur geprueft, ob js/account.js aktuell ist (fuer die Tests)."""
import pathlib, sys
parts = sorted(pathlib.Path('js/account-src').glob('*.js'))
out = ''.join(p.read_text(encoding='utf-8') for p in parts)
target = pathlib.Path('js/account.js')
if '--check' in sys.argv:
    sys.exit(0 if target.read_text(encoding='utf-8') == out else 1)
target.write_text(out, encoding='utf-8', newline='')
print('ok', len(parts), 'Teile,', len(out), 'Zeichen')
