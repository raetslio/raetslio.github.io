# Rätslio? – Projektübersicht

Rätslio? ist eine statische Web-App (GitHub Pages, `https://raetslio.github.io/`) mit Sudoku, Suchsel, Binoxxo, Labyrinth, Hitori, Zahlenmauer, Magischem Quadrat, einer Startseite und einem Rätselheft mit PDF-Export. Sie braucht **keinen Build-Schritt** für den Betrieb: Dateien auf einen Webserver legen, fertig. Wegen der absoluten Pfade (`/sudoku/`, `/css/…`), der Anmeldepflicht und des Service Workers läuft sie nur über einen Webserver (`https://` oder `localhost`), nicht per Doppelklick auf eine Datei.

## Seitenaufbau

Die App besteht aus **einer gemeinsamen Oberfläche `app-body.html`** (Markup und Skript-Reihenfolge, wird von jeder Seite per Skript eingebunden) und **einer Kopf-Vorlage `sudoku/index.html`** (Meta, Stile, Lade-Skript). Aus ihr erzeugt `python3 tools/build-routes.py` (Aufruf im Hauptordner) für jede Unterseite einen Ordner mit eigener `index.html`, eigenem Titel und eigener Beschreibung:

- Startseite: `/start/` (Kacheln der Rätselarten, Profil, Zähler für angefangene Rätsel, Verläufe und Hefte)
- Rätselarten: `/sudoku/`, `/suchsel/`, `/binoxxo/`, `/labyrinth/`, `/hitori/`, `/zahlenmauer/`, `/magisches-quadrat/`
- Rätselheft und Verläufe: `/heft/`, `/spiele/` (Spielverlauf), `/verlauf/` (Druckverlauf)
- Support: `/support/` (Formular für eingeloggte Nutzer, nicht in der Sitemap, per `robots.txt` gesperrt)
- Konto: `/login/`, `/konto/` (beide nicht indexierbar)
- Support-Antworten: `/answer/<ID>/` (nur für den Admin, eigenständige Seite ohne `app-body.html`, nicht indexierbar; siehe „Support“)

Das Skript schreibt auch `sitemap.xml` neu. Nach jeder Änderung an `sudoku/index.html` muss das Skript laufen, damit alle Unterseiten gleich bleiben. **Achtung:** `/start/` steht nicht in `ROUTES` und wird vom Skript nicht erzeugt. `start/index.html` ist eine Kopie von `sudoku/index.html` mit eigenem Titel, eigener Beschreibung, `canonical` und `og:`-Tags; Änderungen am Kopf müssen dort von Hand nachgezogen werden. Die `index.html` im Hauptordner leitet nur auf `/start/` weiter, `404.html` leitet unbekannte Adressen um.

`tools/ui-sidebar.py` war eine einmalige Umstellung auf das Seitenmenü und die Rätsel-Einstellungen (läuft idempotent auf `sudoku/index.html`).

## Ordner

| Ordner / Datei | Inhalt |
| --- | --- |
| `app-body.html` | Gemeinsame Oberfläche: Seitenmenü, Spielbereiche, Fenster, Reihenfolge der Skripte |
| `sudoku/index.html` | Kopf-Vorlage für alle Unterseiten (nur Meta-Daten unterscheiden sich) |
| `start/index.html` | Startseite, von Hand gepflegte Kopie der Kopf-Vorlage (siehe oben) |
| `answer/index.html` | Admin-Seite zum Beantworten von Support-Nachrichten |
| `css/` | Aussehen, nach Themen aufgeteilt (siehe unten) |
| `fonts/` | Selbst ausgelieferte Schriften (Outfit, Hanken Grotesk als `.woff2`, siehe `fonts/LIES-MICH.txt`). Kein Abruf bei Google. |
| `js/` | Programmcode, nach Rätselarten und Funktionen aufgeteilt |
| `icons/` | Logo (SVG), App-Symbole, Favicon |
| `tools/` | Hilfsskripte (`build-routes.py`, `build-account.py`, `ui-sidebar.py`) |
| `tests/` | Automatische Tests (`node --test`) |
| `supabase/functions/invite-user/` | Edge Function: Einladung per E-Mail (max. 5 pro Nutzer und Tag) |
| `supabase/functions/support/` | Edge Function: Support-Nachricht aus dem Konto, Mail an dich, Ticket in `support_tickets` |
| `supabase/functions/support-admin/` | Edge Function: Ticket laden und Antwort als Mail senden (nur Admin) |
| `supabase/support_tickets.sql` | Tabelle `support_tickets` (einmalig im Supabase-SQL-Editor ausführen) |
| `manifest.webmanifest` | Angaben für die Installation als Web-App (Start: `/start/`) |
| `sw.js` | Service Worker für die Offline-Nutzung (muss im Hauptordner liegen) |
| `.github/workflows/entpacken.yml` | Entpackt eine hochgeladene `raetslio.zip` ins Repo (siehe „Aktualisieren“) |
| `.github/workflows/tests.yml` | Führt bei jedem Push und Pull-Request die Tests aus |

## Stile (`css/`)

Reihenfolge in der Seite:

`fonts.css` (Schriften) → `tokens.css` (Farben, Schriften, Abstände, Dunkelmodus) → `base.css` (Grundlagen, Kopfzeile) → `components.css` (Schaltflächen, Panels, Formulare) → `board.css` (Spielfelder) → `modals.css` (Fenster, Druckansicht) → `extensions.css` (Binoxxo, Labyrinth, neue Rätselarten, Heft, Verläufe, Animationen, Dunkelmodus-Feinschliff) → `heft-polish.css` (Rätselheft: Seitenverwaltung, Vorschau, iPhone, Druck) → `sidebar.css` (Seitenmenü und Kopfzeile)

## Programmcode (`js/`)

Die Dateien werden **in genau dieser Reihenfolge** geladen (steht so in `sudoku/index.html`). Sie teilen sich einen gemeinsamen Bereich: Funktionen und Variablen einer Datei sind in den folgenden Dateien sichtbar.

1. `host-fallback.js` – Speicher-Schnittstelle (im Kopf der Seite)
2. **Grund-App:** `core/constants.js` · `core/persistence.js` · `core/theme-mode.js` · `core/instructions.js` · `puzzles/sudoku.js` · `puzzles/wortsuche.js` · `print/print-modal.js` · `core/init.js`
3. **Erweiterungen** (strikter Modus): `common.js` · `puzzles/binoxxo-logic.js` · `puzzles/labyrinth-logic.js` · `puzzles/binoxxo-online.js` · `puzzles/labyrinth-online.js` · `heft/*` (`heft-data`, `heft-texts`, `svg-helpers`, `heft-build`, `heft-ui`, `heft-polish`) · `print/print-extra.js` · `puzzles/sudoku-notes.js` · `print/pdf-export.js` · `history/*` (`print-history`, `play-history`, `share`, `extras`) · `puzzles/new-puzzles-*.js` (Logik, Online, Druck, Register für Hitori, Zahlenmauer, Magisches Quadrat) · `modes-init.js`
4. `sidebar.js` – Seitenmenü: öffnen/schließen, Wischgesten, Tastatur
5. `pwa.js` – meldet den Service Worker an
6. Supabase-Bibliothek (von jsdelivr) → `account.js` – Konto, Anmeldung, Synchronisierung

Jede Datei beginnt mit einem Kopf, der erklärt, wofür sie da ist.

## Rätselheft

`js/heft/` enthält das Heft: `heft-data.js` (Rätsel erzeugen und verwalten), `heft-texts.js` (Anleitungen, Einleitung), `svg-helpers.js`, `heft-build.js` (Seiten, Titelseite, Inhaltsverzeichnis) und `heft-ui.js` (Bedienoberfläche, Export). `heft-polish.js` ergänzt das Verschieben von Rätseln per Ziehen (Maus und Finger) oder Tastatur (Alt + Pfeil, Pos1, Ende), eine Ladeanzeige der Vorschau und die Bedienung der Vorschau per Tastatur. Formate: A4 oder A5 (als Broschüre, vier Seiten pro A4-Blatt).

## Anmeldepflicht

Alle Rätselseiten sind nur mit Konto nutzbar. Ohne Anmeldung leitet ein kleines Skript im Kopf jeder Seite (und `js/account.js`) auf `/login/` um; nach der Anmeldung geht es zur ursprünglichen Seite zurück (`?next=`). Abschalten: in `js/account.js` `GATE = false` setzen (und den Block „Anmeldepflicht (Teil 1)“ im Kopf von `sudoku/index.html` entfernen, danach `build-routes.py` ausführen). In Supabase muss `https://raetslio.github.io/login/` unter *Authentication → URL Configuration → Redirect URLs* erlaubt sein.

„Mein Konto“ ist die eigene Seite `/konto/`; Passkey- und Passwort-Einrichtung erscheinen als Fenster. Die Datenbank-Tabellen und Berechtigungen (Row Level Security) müssen in Supabase eingerichtet sein; die Einladungsfunktion wird mit `supabase functions deploy invite-user` bereitgestellt.

## Support

Eingeloggte Nutzer schreiben aus `/konto/` an den Support (Aufruf `sb.functions.invoke('support')` in `js/account-src/05-api.js`). Die Funktion `support` prüft die Anmeldung, legt ein Ticket mit zufälliger Answer-ID in `support_tickets` an (höchstens 5 Nachrichten pro Nutzer und Tag, höchstens 4000 Zeichen), und schickt dir per Gmail eine Mail mit dem Link `https://raetslio.github.io/answer/<ID>/`. Dort antwortest du: `answer/index.html` ruft `support-admin` auf, das nur für die in `ADMIN_EMAILS` (Standard: `SUPPORT_TO` bzw. `GMAIL_USER`) eingetragenen Konten arbeitet, das Ticket lädt und die Antwort als HTML-Mail an den Nutzer sendet. Der Nutzer erfährt die ID nie. Die Tabelle hat Row Level Security ohne Richtlinien: nur die Edge Functions (Service-Key) kommen an die Daten.

Einrichten: `supabase/support_tickets.sql` im SQL-Editor ausführen, Geheimnisse setzen (`GMAIL_USER`, `GMAIL_APP_PASSWORD`, optional `SUPPORT_TO`, `ADMIN_EMAILS`, Einzelheiten im Kopf der Funktionsdateien) und mit `supabase functions deploy support` sowie `supabase functions deploy support-admin` bereitstellen.

## Neue Rätselart hinzufügen (Kurzfassung)

1. Logik und Spielzustand: neue Datei in `js/puzzles/` anlegen.
2. Zeichnen für den Druck und Eintrag im Register `NXT` (siehe `puzzles/new-puzzles-registry.js`) – damit funktionieren Heft, Druckfenster, Druckverlauf und Spielverlauf.
3. Tab und Ansicht in `sudoku/index.html` ergänzen, die neue Datei in die Skript-Liste in `app-body.html` eintragen, die Seite in `ROUTES` von `tools/build-routes.py` aufnehmen und das Skript ausführen.
4. Datei in `sw.js` unter `APP_FILES` aufnehmen und die Versionsnummer erhöhen.

## Aktualisieren über GitHub

`raetslio.zip` im Hauptordner des Repos hochladen (oder den Workflow „ZIP entpacken“ von Hand starten). Der Workflow `entpacken.yml` startet nur, wenn sich `raetslio.zip` ändert, und arbeitet so:

1. Er prüft, dass die ZIP-Datei heil ist und `index.html` auf **oberster Ebene** im ZIP liegt (nicht in einem Unterordner, wie bei einem GitHub-Download). Sonst bricht er mit einer Fehlermeldung ab.
2. Er löscht `css/`, `js/`, `icons/` sowie `index.html`, `sw.js`, `manifest.webmanifest`, `README.md`, `logo.svg` und `logo-icon.svg`.
3. Er entpackt das ZIP darüber (vorhandene Dateien werden überschrieben) und löscht das ZIP.
4. Er committet und pusht die Änderungen als `github-actions[bot]`.

**Wichtig:** Dateien, die nicht in der obigen Liste stehen (Unterseiten wie `sudoku/`, `start/`, `answer/`, `tools/`, `tests/`, `supabase/`, `app-body.html`, `404.html`, `sitemap.xml` …), werden nur überschrieben, aber nicht gelöscht. Entfernte Dateien dort bleiben im Repo und müssen von Hand gelöscht werden. Weil die README bei jedem Update ersetzt wird, muss eine README-Änderung immer **im ZIP** stehen, eine Änderung nur im Repo geht beim nächsten Update verloren.

## Untere Leiste

- **Im Browser (Handy):** klassische Vollbreit-Leiste `#rs-bottomnav` (Start, Weiter, Konto, Menü).
- **Als Web-App auf dem iPhone** (zum Home-Bildschirm hinzugefügt, `display-mode: standalone`, höchstens 640 px breit): stattdessen die schwebende, abgerundete Glas-Leiste `#rs-appnav` mit **Start, Sudoku, Konto, Mehr**. „Mehr“ öffnet `#rs-appmore` mit **Abmelden, Support** und dem Umschalter **Hell / Dunkel / Gerät**. Beide Leisten stehen im Markup; welche sichtbar ist, entscheidet nur `css/start.css`. Logik in `js/app-menu.js`.
- **Support-Seite `/support/`:** eigene Ansicht `#view-support` (Modus `support` in `js/modes-init.js`, Route in `tools/build-routes.py`), im Seitenmenü ganz unten unter „Konto“. Versand über `RSAUTH.supportPost` (aus `js/account-src/05-api.js`) und die Edge Function `support`. Der Modus wird nie als „zuletzt geöffnet“ gespeichert. In „Mein Konto“ steht nur noch ein Link zur Support-Seite.

## Ladezustand und Fehlerfälle

- **Anmeldeprüfung:** Ist eine gespeicherte Anmeldung vorhanden, bleibt der Inhalt bis zur Prüfung verborgen. Dabei zeigt die Seite Logo und Ladering (Klasse `rs-gating`, Stile im Kopf-Skript). Antwortet der Dienst nicht, wird die Seite nach spätestens 5 Sekunden freigegeben.
- **Totalausfall:** Lässt sich `app-body.html` nicht laden, erscheint eine gestaltete Fehlerseite mit „Neu laden“ und, falls die App schon zwischengespeichert ist, „Offline weiterspielen“.
- **Ohne JavaScript:** Ein `<noscript>`-Hinweis erklärt, dass JavaScript nötig ist.
- Diese drei Bausteine stehen im Kopf von `sudoku/index.html` (und von Hand in `start/index.html` und `konto/index.html`); die übrigen Seiten erzeugt `build-routes.py`.

## Hinweise

- Offline-Nutzung und Installation als App funktionieren nur über `https://` (oder `localhost`).
- Nach jeder Änderung an der App in `sw.js` die Zahl bei `VERSION` erhöhen (aktuell `raetslio-v84`), sonst bleibt der alte Zwischenspeicher aktiv.

## Leitlinie

Änderungen halten sich klein und nutzen vorhandene Mechanismen (Spielverlauf, Einstellungen, Routen) statt neue Parallelstrukturen. Ein Rätsel soll in möglichst wenigen Tippen startbar sein; „Neues Rätsel“ steht immer vor den Einstellungen.

## Konto-Skript und Tests

- `js/account.js` wird **nicht von Hand bearbeitet**. Quelle sind die Teile in `js/account-src/` (Kern, Profil, Oberfläche, Sync, API, Start). Nach einer Änderung `python3 tools/build-account.py` ausführen.
- Rein rechnende Hilfsfunktionen (Fehlertexte, Icons, Daten-Zusammenfassung) stehen in `js/account-utils.js`.
- Automatische Tests: `node --test "tests/*.test.js"` im Hauptordner (Node 18 oder neuer, keine Abhängigkeiten). Sie prüfen die Hilfsfunktionen, die Meta-Daten aller Seiten, die Skript-Reihenfolge, den Offline-Cache, die Sitemap und ob `js/account.js` aktuell gebaut ist.
- `.github/workflows/tests.yml` führt die Tests und die Prüfung `python3 tools/build-account.py --check` bei jedem Push und Pull-Request automatisch auf GitHub aus.

## Eindeutigkeit der Rätsel

- Jeder Generator erzeugt nur Rätsel mit **genau einer Lösung** (Sudoku, Binoxxo, Hitori, Magisches Quadrat, Zahlenmauer; das Labyrinth ist ein Baum ohne Schleifen, beim Suchsel wird jedes Wort nur einmal im Gitter zugelassen und doppelte Fundstellen zählen trotzdem).
- Zusätzlich prüft die Seite eine fertig ausgefüllte Lösung **nach den Regeln** und nicht nur gegen die gespeicherte Lösung (Sudoku: `sudokuRulesOk`, Binoxxo: `bxValidFull`; Hitori, Magisches Quadrat und Zahlenmauer prüfen ohnehin nach Regeln). Eine regelkonforme Lösung wird deshalb nie als falsch bezeichnet.
- `tests/puzzles.test.js` erzeugt Rätsel mit dem echten Generator und zählt die Lösungen mit eigenen, unabhängigen Lösern nach.

### Gedruckte Arbeitsblätter und Hefte

Der Druck verwendet dieselben Generatoren wie der Bildschirm, ein gedrucktes Rätsel hat also immer genau eine Lösung (Sudoku bis 55×55, siehe `tests/puzzles-druck.test.js`).

- **Suchsel:** Jedes aufgelistete Wort steht genau einmal im Gitter. Lässt sich ein Doppelfund nicht durch andere Füllbuchstaben beseitigen (Wort steckt in einem anderen, z. B. ROSE in ROSEN, oder zu viele kurze Wörter), wird das kürzeste betroffene Wort aus dem Rätsel genommen und als „nicht eindeutig platzierbar“ gemeldet (Hinweis am Bildschirm und im Heft).
- **Zahlenmauer:** Eindeutig innerhalb der positiven ganzen Zahlen. Das steht auf dem Bildschirm und auf dem Arbeitsblatt.
