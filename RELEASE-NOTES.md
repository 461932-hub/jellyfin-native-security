Preview 14: Vollstaendige Miniaturbilder in den Filmreihen der Startseite.

Bereits zwischengespeicherte Titel belegten die auf 24 Eintraege begrenzte
Auswahl, bevor fehlende Bilddaten bestimmt wurden. Dadurch blieb ein spaeterer
Teil von "Kuerzlich hinzugefuegt in Filme" dauerhaft bei den nativen Primaer-
Bildern, obwohl Miniaturbilder vorhanden waren.

Die aktuelle sichtbare Auswahl wird jetzt auf maximal 128 Titel begrenzt und
in aufeinanderfolgenden Schritten vervollstaendigt. Pro Metadatenanfrage werden
weiterhin hoechstens 24 fehlende Titel geladen. Bereits geladene Titel werden
sofort dargestellt und blockieren keine weiteren Anfrageplaetze. Das Nachladen
endet, sobald der aktuelle Vorrat im Zwischenspeicher vorliegt. Zeilen ausserhalb
des vertikalen Ladebereichs behalten das bisherige Ladeverhalten.

Die vorhandene Thumb-Auswahl und die 16:9-Darstellung aus Preview 13 bleiben
bestehen. Native Pfeile, Links, Player und Medienrechte bleiben erhalten.

Vorhandene CasaOS-Test-App aktualisieren:
ghcr.io/461932-hub/jellyfin-native-security:12.4-preview14
Ports und Ordner beibehalten. Anschliessend Strg+F5.

Pruefung: 76 Browserfaelle fuer / und /media, einschliesslich 40 Filmen ueber
mehrere begrenzte Anfragen, ausbleibender Doppelabrufe und seitlicher Navigation.
Echte native Oberflaeche: alle 16 Filme der Reihe laden ihre vorhandenen Thumb-
Bilder ueber authentifizierte Bildanfragen. Originaler Weiter-Pfeil geprueft;
Metadatenanfragen mit 24 und 12 Eintraegen. Keine Wiedergabe gestartet.
Bestehende API-, TV-Identitaets- und Docker-Pruefungen im Veroeffentlichungslauf.
Eigener Testkandidat, keine offizielle Jellyfin-Veroeffentlichung.
