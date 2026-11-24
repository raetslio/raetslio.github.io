# Rätslio? – Projektübersicht

Die App besteht aus **einer Seite (`sudoku/index.html`)**, die für jede Unterseite kopiert wird (`/sudoku/`, `/suchsel/`, `/statistik/` …; erzeugt mit `python3 tools/build-routes.py`). `index.html` im Hauptordner leitet nur auf `/sudoku/` weiter und mehreren Dateien in Unterordnern.
Sie läuft ohne Build-Schritt: Dateien auf einen Webserver legen (oder `index.html` direkt öffnen) – fertig.

## Ordner

| Ordner / Datei | Inhalt |
| --- | --- |
| `index.html` | Seitenaufbau (Tabs, Spielbereiche, Fenster) und die Reihenfolge der Skripte |
| `css/` | Aussehen, aufgeteilt nach Themen (siehe unten) |
| `js/` | Programmcode, aufgeteilt nach Rätselarten und Funktionen |
| `icons/` | Logo (SVG), App-Symbole und Tab-Symbol |
| `manifest.webmanifest` | Angaben für die Installation als Web-App |
| `sw.js` | Service Worker für die Offline-Nutzung (muss im Hauptordner liegen) |

## Stile (`css/`)

`tokens.css` (Farben, Schriften, Abstände, Dunkelmodus) → `base.css` (Grundlagen, Kopfzeile) → `components.css` (Schaltflächen, Panels, Formulare) → `board.css` (Spielfelder) → `modals.css` (Fenster, Druckansicht) → `extensions.css` (Binoxxo, Labyrinth, neue Rätselarten, Heft, Verläufe)

## Programmcode (`js/`)

Die Dateien werden **in genau dieser Reihenfolge** geladen (steht so in `index.html`).
Sie teilen sich einen gemeinsamen Bereich: Funktionen und Variablen einer Datei sind in den folgenden Dateien sichtbar.

1. `host-fallback.js` – Speicher-Schnittstelle (im Kopf der Seite)
2. **Grund-App:** `core/constants.js` · `core/persistence.js` · `core/theme-mode.js` · `core/instructions.js` · `puzzles/sudoku.js` · `puzzles/wortsuche.js` · `print/print-modal.js` · `core/init.js`
3. **Erweiterungen** (strikter Modus): `common.js` · `puzzles/binoxxo-logic.js` · `puzzles/labyrinth-logic.js` · `puzzles/binoxxo-online.js` · `puzzles/labyrinth-online.js` · `heft/*` (Daten, Texte, SVG-Helfer, Aufbau, Oberfläche) · `print/print-extra.js` · `puzzles/sudoku-notes.js` · `print/pdf-export.js` · `history/*` (Druck- und Spielverlauf) · `puzzles/new-puzzles-*.js` (Hitori, Zahlenmauer, Magisches Quadrat) · `modes-init.js`
4. `pwa.js` – meldet den Service Worker an
5. Supabase-Bibliothek (von jsdelivr) → `account.js` – Konto, Anmeldung, Synchronisierung, Backup

Jede Datei beginnt mit einem Kopf, der erklärt, wofür sie da ist.

## Neue Rätselart hinzufügen (Kurzfassung)

1. Logik und Spielzustand: neue Datei in `js/puzzles/` anlegen.
2. Zeichnen für den Druck und Eintrag im Register `NXT` (siehe `puzzles/new-puzzles-registry.js`) – damit funktionieren Heft, Druckfenster, Druckverlauf und Spielverlauf.
3. Tab und Ansicht in `index.html` ergänzen und die neue Datei dort in die Skript-Liste eintragen.
4. Datei in `sw.js` unter `APP_FILES` aufnehmen und die Versionsnummer erhöhen.

## Hinweise

- Offline-Nutzung und Installation als App funktionieren nur über `https://` (oder `localhost`).
- Nach Änderungen an der App in `sw.js` die Zahl bei `VERSION` erhöhen.
