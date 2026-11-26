# Rätslio? – Projektübersicht

Rätslio? ist eine statische Web-App (GitHub Pages, `https://raetslio.github.io/`) mit Sudoku, Suchsel, Binoxxo, Labyrinth, Hitori, Zahlenmauer, Magischem Quadrat und einem Rätselheft mit PDF-Export. Sie braucht **keinen Build-Schritt** für den Betrieb: Dateien auf einen Webserver legen, fertig. Wegen der absoluten Pfade (`/sudoku/`, `/css/…`), der Anmeldepflicht und des Service Workers läuft sie nur über einen Webserver (`https://` oder `localhost`), nicht per Doppelklick auf eine Datei.

## Seitenaufbau

Die App besteht aus **einer Quellseite, `sudoku/index.html`**. Aus ihr erzeugt `python3 tools/build-routes.py` (Aufruf im Hauptordner) für jede Unterseite einen Ordner mit eigener `index.html`, eigenem Titel und eigener Beschreibung:

- Rätselarten: `/sudoku/`, `/suchsel/`, `/binoxxo/`, `/labyrinth/`, `/hitori/`, `/zahlenmauer/`, `/magisches-quadrat/`
- Rätselheft und Verläufe: `/heft/`, `/spiele/` (Spielverlauf), `/verlauf/` (Druckverlauf)
- Konto: `/login/`, `/konto/` (beide nicht indexierbar)

Das Skript schreibt auch `sitemap.xml` neu. `/statistik/` wird **nicht** von `build-routes.py` erzeugt und ist eine eigene Datei. Nach jeder Änderung an `sudoku/index.html` muss das Skript laufen, damit alle Unterseiten gleich bleiben. Die `index.html` im Hauptordner leitet nur auf `/sudoku/` weiter, `404.html` leitet unbekannte Adressen um.

`tools/ui-sidebar.py` war eine einmalige Umstellung auf das Seitenmenü und die Rätsel-Einstellungen (läuft idempotent auf `sudoku/index.html` und `statistik/index.html`).

## Ordner

| Ordner / Datei | Inhalt |
| --- | --- |
| `sudoku/index.html` | Quellseite: Seitenmenü, Spielbereiche, Fenster, Reihenfolge der Skripte |
| `css/` | Aussehen, nach Themen aufgeteilt (siehe unten) |
| `js/` | Programmcode, nach Rätselarten und Funktionen aufgeteilt |
| `icons/` | Logo (SVG), App-Symbole, Favicon |
| `tools/` | Hilfsskripte (`build-routes.py`, `ui-sidebar.py`) |
| `supabase/functions/invite-user/` | Edge Function: Einladung per E-Mail (max. 5 pro Nutzer und Tag) |
| `manifest.webmanifest` | Angaben für die Installation als Web-App (Start: `/sudoku/`) |
| `sw.js` | Service Worker für die Offline-Nutzung (muss im Hauptordner liegen) |
| `.github/workflows/entpacken.yml` | Entpackt eine hochgeladene `raetslio.zip` ins Repo (siehe „Aktualisieren“) |

## Stile (`css/`)

Reihenfolge in der Seite:

`tokens.css` (Farben, Schriften, Abstände, Dunkelmodus) → `base.css` (Grundlagen, Kopfzeile) → `components.css` (Schaltflächen, Panels, Formulare) → `board.css` (Spielfelder) → `modals.css` (Fenster, Druckansicht) → `extensions.css` (Binoxxo, Labyrinth, neue Rätselarten, Heft, Verläufe, Animationen, Dunkelmodus-Feinschliff) → `heft-polish.css` (Rätselheft: Seitenverwaltung, Vorschau, iPhone, Druck) → `sidebar.css` (Seitenmenü und Kopfzeile)

## Programmcode (`js/`)

Die Dateien werden **in genau dieser Reihenfolge** geladen (steht so in `sudoku/index.html`). Sie teilen sich einen gemeinsamen Bereich: Funktionen und Variablen einer Datei sind in den folgenden Dateien sichtbar.

1. `host-fallback.js` – Speicher-Schnittstelle (im Kopf der Seite)
2. **Grund-App:** `core/constants.js` · `core/persistence.js` · `core/theme-mode.js` · `core/instructions.js` · `puzzles/sudoku.js` · `puzzles/wortsuche.js` · `print/print-modal.js` · `core/init.js`
3. **Erweiterungen** (strikter Modus): `common.js` · `puzzles/binoxxo-logic.js` · `puzzles/labyrinth-logic.js` · `puzzles/binoxxo-online.js` · `puzzles/labyrinth-online.js` · `heft/*` (`heft-data`, `heft-texts`, `svg-helpers`, `heft-build`, `heft-ui`, `heft-polish`) · `print/print-extra.js` · `puzzles/sudoku-notes.js` · `print/pdf-export.js` · `history/*` (`print-history`, `play-history`, `share`, `extras`) · `puzzles/new-puzzles-*.js` (Logik, Online, Druck, Register für Hitori, Zahlenmauer, Magisches Quadrat) · `modes-init.js`
4. `sidebar.js` – Seitenmenü: öffnen/schließen, Wischgesten, Tastatur
5. `pwa.js` – meldet den Service Worker an
6. Supabase-Bibliothek (von jsdelivr) → `account.js` – Konto, Anmeldung, Synchronisierung, Backup

Jede Datei beginnt mit einem Kopf, der erklärt, wofür sie da ist.

## Rätselheft

`js/heft/` enthält das Heft: `heft-data.js` (Rätsel erzeugen und verwalten), `heft-texts.js` (Anleitungen, Einleitung), `svg-helpers.js`, `heft-build.js` (Seiten, Titelseite, Inhaltsverzeichnis) und `heft-ui.js` (Bedienoberfläche, Export). `heft-polish.js` ergänzt das Verschieben von Rätseln per Ziehen (Maus und Finger) oder Tastatur (Alt + Pfeil, Pos1, Ende), eine Ladeanzeige der Vorschau und die Bedienung der Vorschau per Tastatur. Formate: A4 oder A5 (als Broschüre, vier Seiten pro A4-Blatt).

## Anmeldepflicht

Alle Rätselseiten sind nur mit Konto nutzbar. Ohne Anmeldung leitet ein kleines Skript im Kopf jeder Seite (und `js/account.js`) auf `/login/` um; nach der Anmeldung geht es zur ursprünglichen Seite zurück (`?next=`). Abschalten: in `js/account.js` `GATE = false` setzen (und den Block „Anmeldepflicht (Teil 1)“ im Kopf von `sudoku/index.html` entfernen, danach `build-routes.py` ausführen). In Supabase muss `https://raetslio.github.io/login/` unter *Authentication → URL Configuration → Redirect URLs* erlaubt sein.

„Mein Konto“ ist die eigene Seite `/konto/`; Passkey- und Passwort-Einrichtung erscheinen als Fenster. Die Datenbank-Tabellen und Berechtigungen (Row Level Security) müssen in Supabase eingerichtet sein; die Einladungsfunktion wird mit `supabase functions deploy invite-user` bereitgestellt.

## Neue Rätselart hinzufügen (Kurzfassung)

1. Logik und Spielzustand: neue Datei in `js/puzzles/` anlegen.
2. Zeichnen für den Druck und Eintrag im Register `NXT` (siehe `puzzles/new-puzzles-registry.js`) – damit funktionieren Heft, Druckfenster, Druckverlauf und Spielverlauf.
3. Tab und Ansicht in `sudoku/index.html` ergänzen, die neue Datei in die Skript-Liste eintragen, die Seite in `ROUTES` von `tools/build-routes.py` aufnehmen und das Skript ausführen.
4. Datei in `sw.js` unter `APP_FILES` aufnehmen und die Versionsnummer erhöhen.

## Aktualisieren über GitHub

`raetslio.zip` im Hauptordner des Repos hochladen. Der Workflow prüft, dass `index.html` auf oberster Ebene im ZIP liegt (nicht in einem Unterordner), ersetzt `css/`, `js/`, `icons/`, `index.html`, `sw.js`, `manifest.webmanifest`, `README.md` und die Logos, entpackt den Rest (Unterseiten, `tools/`, `supabase/` …) darüber, committet und löscht das ZIP. Dateien, die nicht mehr im ZIP sind, bleiben in den Unterseiten-Ordnern erhalten.

## Hinweise

- Offline-Nutzung und Installation als App funktionieren nur über `https://` (oder `localhost`).
- Nach jeder Änderung an der App in `sw.js` die Zahl bei `VERSION` erhöhen (aktuell `raetslio-v49`), sonst bleibt der alte Zwischenspeicher aktiv.
