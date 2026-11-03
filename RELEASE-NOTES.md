Preview 16: Folgenanzahl direkt hinter den Staffelnamen.

In der Folgenauswahl stehen jetzt Staffelnamen und Gesamtzahl zusammen,
beispielsweise "Staffel 1 · 25 Folgen". "Alle Staffeln" zeigt ebenfalls die
Gesamtzahl. Eine einzelne Folge wird als "1 Folge" angezeigt, eine leere
Staffel als "0 Folgen". Die Auswahlwerte und die originale Folgenwiedergabe
bleiben erhalten.

Die Zahlen werden mit der aktuellen Anmeldung ueber dieselbe Serien-/
Folgenschnittstelle ermittelt. Zaehlanfragen verwenden Limit 0, ohne Bilder und
Benutzerdaten; maximal drei laufen parallel. Die bestehende paginierte
Folgenantwort aktualisiert die Zahl der aktuellen Auswahl ebenfalls. Fehlerhafte
oder fehlende Zaehler blockieren die Auswahl nicht. Schliessen, Titelwechsel
und Abmeldung verhindern weitere Anfragen und spaete Aktualisierungen.

Vorhandene CasaOS-Test-App aktualisieren:
ghcr.io/461932-hub/jellyfin-native-security:12.4-preview16
Ports und Ordner beibehalten. Anschliessend Strg+F5.

Pruefung: 90 Browserfaelle fuer / und /media; Gesamtzahl statt angezeigter
Seitengroesse, Einzahl/Mehrzahl/0, fehlgeschlagener Zaehler, weiter funktionierende
Auswahl/Wiedergabe und abgebrochene Zaehler ohne Uebernahme in den naechsten Titel.
Echte native Oberflaeche: Re:ZERO mit vier Staffeln (25, 25, 16, 7 Folgen),
Gesamtzahl 73, jeweils unabhaengig gegen die API geprueft. Authentifizierte
Zaehlanfragen, maximal drei gleichzeitig, sowie Staffelauswahl und Schliessen
geprueft. Keine Wiedergabe gestartet. Bestehende API-, TV- und Docker-Pruefungen.
Eigener Testkandidat, keine offizielle Jellyfin-Veroeffentlichung.
