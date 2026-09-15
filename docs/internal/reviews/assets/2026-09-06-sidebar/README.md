# Sidebar-Zähler, Prüfung vom 06.09.2026

Die laufende Electron-Demo hat die Änderung über Forge übernommen. Ihr Prozess blieb unverändert. `collapsed.png` zeigt die echte Demo mit Patient:innen bei einer vorübergehend auf 909 Pixel gesetzten Inhaltsbreite. Der tatsächliche Aufgabenbestand ist 154; eingeklappt steht dafür jetzt "9+", Tooltip und zugänglicher Name nennen weiterhin 154. `expanded-final.png` zeigt die volle Zahl in der breiten Navigation.

## Nachbesserung: Icon freihalten

`compact-counts.png` zeigt die endgültige Darstellung mit 1, 9, 10 und 154 in beiden Navigationsbreiten. Dafür wurde die tatsächliche Sidebar-Komponente mit diesen Props gerendert und vorübergehend als Layoutvorschau über der Demo angezeigt. Alle acht Fälle wurden visuell geprüft. Die Prüfung in `compact-verification.json` bestätigt die Darstellung "9+" ausschließlich eingeklappt oberhalb von 9, genaue Accessible Names und Tooltips, Zentrierung und Sichtbarkeit. Einschließlich des zwei Pixel breiten Randes überlappt das Badge weder sein Icon noch die benachbarten Navigationsbuttons. Vorschau und Größenemulation wurden entfernt; die echte Demo läuft weiter.

## Frühere Prüfung vor der Nachbesserung

Die Dateien `909-1.png` bis `1440-154.png` prüfen ein-, zwei- und dreistellige Badge-Texte bei 909 und 1440 Pixeln Fensterinhalt. Für 1 und 12 wurde ausschließlich der sichtbare DOM-Text vorübergehend ersetzt. App-Zähler und Datenbank wurden nicht geändert; der zugängliche Name blieb daher beim tatsächlichen Bestand "Übersicht, 154 offene Aufgaben". Der Text wurde danach wiederhergestellt und die vorübergehende Größenemulation entfernt.

`verification.json` enthält die gemessenen Rechtecke. Geprüft wurden horizontale und vertikale Zentrierung, vollständig sichtbarer Text, Lage innerhalb der Sidebar und Abstand zu den benachbarten Navigationsbuttons. Im schmalen Zustand endet das Badge bei x=65 innerhalb der 76 Pixel breiten Sidebar. Die Screenshots mit 1, 12 und 154 wurden visuell geprüft, ebenso die breite Ansicht mit 154.

ESLint für die geänderte Komponente und `git diff --check` bestanden. Der vollständige Datenbankvergleich blieb unverändert bei SHA-256 `2feca954a18a89b18a144e63c62da5c8e47b538ed16721e69745fc0d9efde280`. Es wurden keine Daten verändert und keine App-Version veröffentlicht.
