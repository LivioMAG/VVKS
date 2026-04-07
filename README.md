# VVKS

## Funktionen

- Anforderungen und Produkte manuell erfassen.
- Bewertungsmatrix mit automatischer Auswertung und Ranking.
- PDF-Export der aktuellen Bewertung.
- Kompletten Projektstand als CSV exportieren/importieren (Anforderungen, Produkte, Matrix-Bewertungen).
- Startdialog beim Öffnen: neues Projekt erstellen oder bestehende Projekt-CSV laden.
- CSV-Template-Download und CSV-Import für:
  - Anforderungen (`title,category,description,type,priority,note`)
  - Produkte (`name,vendor,summary,price,note`)

## CSV-Hinweise

- Erst das Template herunterladen, dann in Excel/Sheets ausfüllen.
- Pflichtfelder:
  - Anforderungen: `title`, `category`, `description`, `type`, `priority`
  - Produkte: `name`, `vendor`, `summary`
- Erlaubte Werte in Anforderungen:
  - `type`: `must` oder `nice`
  - `priority`: `critical`, `high`, `medium`, `low`
- Beim Import werden bestehende Anforderungen/Produkte ersetzt und die Matrix-Bewertungen zurückgesetzt.


## Projekt-CSV (Vollimport/-export)

- Über **"Projekt als CSV exportieren"** wird der komplette Stand als eine CSV-Datei gespeichert.
- Über **"Projekt öffnen"** (oder den Startdialog) kann diese Datei wieder vollständig geladen werden.
- Enthalten sind: Anforderungen, Produkte und alle Matrix-Bewertungen.
