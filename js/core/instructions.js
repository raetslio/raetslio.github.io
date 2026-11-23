/* ======================================================================
   Spielregeln für Sudoku und Suchsel
   Eine einzige Textquelle für die Anzeige im Spiel und für den Druck.
   ====================================================================== */

function getSudokuRules(size, subR, subC) {
  var hasBoxes = subR > 1 && subC > 1;
  var rules = [
    `Füllen Sie jedes leere Feld mit einer ganzen Zahl von 1 bis ${size}.`,
    `In jeder waagerechten Zeile und jeder senkrechten Spalte darf jede Zahl von 1 bis ${size} genau einmal vorkommen.`
  ];
  if (hasBoxes) {
    rules.push(`Auch in jedem stark umrandeten ${subR}×${subC}-Unterblock muss jede Zahl von 1 bis ${size} genau einmal stehen.`);
  } else {
    rules.push(`Da ${size} eine Primzahl ist, besitzt dieses Lateinische Quadrat keine Unterblöcke — nur Zeilen und Spalten zählen.`);
  }
  return rules;
}

function getWsRules(size, umlautDirect, dirs) {
  var dirNames = [];
  if (dirs.h) dirNames.push('waagerecht');
  if (dirs.v) dirNames.push('senkrecht');
  if (dirs.d) dirNames.push('diagonal');
  var dirText = dirNames.length > 0 ? dirNames.join(', ') : 'waagerecht';
  var revText = dirs.r ? ' auch rückwärts' : ' ausschließlich vorwärts';
  var umlautText = umlautDirect
    ? 'Umlaute (Ä, Ö, Ü) stehen direkt im Gitter.'
    : 'Umlaute werden umgeschrieben (AE, OE, UE).';
  return [
    `Finden Sie alle unten aufgelisteten Suchwörter im ${size}×${size}-Buchstabengitter.`,
    `Die Wörter sind ${dirText} sowie${revText} versteckt.`,
    `Markieren Sie ein Wort per Zweiklick-Auswahl (ersten und letzten Buchstaben antippen) bzw. umranden Sie es auf dem Arbeitsblatt. ${umlautText}`
  ];
}
