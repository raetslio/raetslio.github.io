/* ======================================================================
   Rätselheft: Texte
   Spielregeln, Namenslisten und Beschriftungen für Hefte und Blätter.
   ====================================================================== */
'use strict';

var RULES = {
  sudoku: ['Fülle das Gitter so aus, dass in jeder Zeile, in jeder Spalte und in jedem eingezeichneten Block jede Zahl genau einmal vorkommt.',
    'Die Zahlen reichen von 1 bis zur Kantenlänge des Gitters (bei 9×9 also von 1 bis 9). Die vorgegebenen Zahlen bleiben unverändert.',
    'Tipp: Beginne bei Zeilen, Spalten oder Blöcken, in denen nur noch wenige Zahlen fehlen, und streiche Möglichkeiten gedanklich aus.'],
  ws: ['Im Buchstabengitter sind alle Wörter der Wortliste versteckt. Sie verlaufen waagerecht, senkrecht oder diagonal – bei höheren Stufen auch rückwärts.',
    'Kreise jedes gefundene Wort ein und streiche es in der Liste durch. Umlaute (Ä, Ö, Ü) stehen als ein Buchstabe im Gitter.',
    'Tipp: Suche zuerst nach seltenen Buchstaben wie Q, X oder Z, dann findest du Wörter schneller.'],
  binoxxo: ['Fülle jedes leere Feld mit einem X oder einem O.',
    'Regel 1: Nie mehr als zwei gleiche Zeichen direkt nebeneinander – weder in einer Zeile noch in einer Spalte.',
    'Regel 2: Jede Zeile und jede Spalte enthält gleich viele X und O.',
    'Regel 3: Keine zwei Zeilen und keine zwei Spalten sind identisch.',
    'Tipp: Zwei gleiche Zeichen nebeneinander? Dann ist das Feld daneben das andere Zeichen. Steht zwischen zwei gleichen Zeichen eine Lücke, gehört dort das andere Zeichen hin.'],
  maze: ['Finde den Weg vom Start (Öffnung am oberen Rand) zum Ziel (Öffnung am unteren Rand).',
    'Du darfst nur durch die Gänge laufen und nicht über die Wände. Zeichne deinen Weg mit einem Stift ein.',
    'Tipp: Wenn du in einer Sackgasse landest, gehe zurück bis zur letzten Kreuzung. Manchmal hilft es, vom Ziel rückwärts zu suchen.'],
  hitori: ['Schwärze einige Felder, sodass in jeder Zeile und in jeder Spalte keine Zahl mehr als einmal sichtbar bleibt.',
    'Geschwärzte Felder dürfen sich nicht an einer Seite berühren – diagonal ist erlaubt.',
    'Alle nicht geschwärzten Felder müssen zusammenhängen: Du kommst waagerecht und senkrecht von jedem sichtbaren Feld zu jedem anderen.',
    'Tipp: Steht eine Zahl zweimal direkt nebeneinander, muss genau eines der beiden Felder geschwärzt werden. Neben einem geschwärzten Feld bleibt immer ein sichtbares Feld.'],
  mauer: ['Eine Zahlenmauer besteht aus Steinen. Jeder Stein ist mit den zwei Steinen direkt darunter durch die angegebene Rechenart verbunden.',
    'Plus: Der obere Stein ist die Summe. Minus: der Unterschied (große minus kleine Zahl). Mal: das Produkt. Geteilt: große durch kleine Zahl, es bleibt kein Rest.',
    'Berechne die leeren Steine. Du kannst von unten nach oben rechnen – oder auch von oben nach unten, indem du die Rechnung umkehrst.',
    'Tipp: Beginne dort, wo zwei Steine einer Rechnung schon bekannt sind.'],
  magic: ['Trage alle Zahlen von 1 bis zur Anzahl der Felder genau einmal ein (3×3: 1 bis 9, 4×4: 1 bis 16, 5×5: 1 bis 25 …).',
    'Jede Zeile, jede Spalte und beide Diagonalen ergeben dieselbe Summe – die magische Zahl (3×3: 15, 4×4: 34, 5×5: 65, 6×6: 111, 7×7: 175).',
    'Tipp: Suche eine Zeile, Spalte oder Diagonale, in der nur noch eine Zahl fehlt, und rechne sie aus. Die magische Zahl minus die anderen Zahlen ergibt die fehlende Zahl.']
};
var HEFT_INTRO = function (types, count) {
  return ['Willkommen in deinem Rätselheft! Auf den folgenden Seiten warten ' + count + (count === 1 ? ' Rätsel' : ' Rätsel') + ' der Arten ' + types.join(', ') + '.',
    'So ist das Heft aufgebaut: Zuerst kommen Inhaltsverzeichnis und Spielregeln, danach die Rätsel, am Ende die Lösungen. Jedes Rätsel hat eine Nummer und einen Namen – unter der gleichen Nummer findest du hinten die Lösung.',
    'Schwierigkeit: Jedes Rätsel ist mit einer Stufe gekennzeichnet: Leicht, Mittel, Schwer oder Experte. Starte am besten mit einer leichten Stufe und steigere dich.',
    'Je nach Größe stehen ein, zwei oder vier Rätsel auf einer Seite. Die Lösungen sind verkleinert, vier pro Seite.',
    'Tipps: Arbeite mit Bleistift und Radiergummi. Schaue erst in die Lösungen, wenn du es wirklich versucht hast – und freu dich über jedes gelöste Rätsel!'];
};
