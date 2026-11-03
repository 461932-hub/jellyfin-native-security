Preview 3 behebt den nachgestellten Android-TV-Direktstartfehler bei geaenderter
Geraetekennung nach der Anmeldung. Der begrenzte Videoabruf erhaelt jetzt den
bereits authentifizierten Geraetekontext der Wiedergabeaushandlung, statt auf
die urspruengliche Token-Geraetekennung zurueckzufallen. Die native Anmelde-,
Widerrufs-, Bibliotheks- und Quellenpruefung bleibt erhalten.

Ein eigener Docker-Laufzeittest prueft originale Videodaten trotz geaenderter
Kennung sowie weiterhin gesperrte fremde Bibliotheken, Stoppen und Abmelden.
Keine normalen Sitzungstokens werden in die neue Direktstream-URL geschrieben.

Eigener Jellyfin-12.4-Testkandidat mit nativen Anmelde-/Bibliothekspruefungen
fuer Medien und Bilder sowie begrenzten Android-TV-0.19.10-Direct-Play-Adressen.

Preview 2 korrigiert den CasaOS-Import: feste Bind-Ordner ersetzen benannte
Volumes, damit keine `[object Object]`-Eintraege entstehen. Hostport 8099 wird
an Containerport 8096 weitergeleitet. Der kurze Starthelfer bereitet nur leere
Config-/Cache-Mountwurzeln vor und startet Jellyfin anschliessend als Benutzer
1000 ohne effektive Capabilities. Fremde nichtleere Verzeichnisse werden nicht
automatisch uebernommen. Medien bleiben nur lesbar eingebunden.

CasaOS: das alte Importformular schliessen und die neue `CasaOS-Import.yaml`
erneut importieren. Der neue Testserver verwendet eigene Ordner unter
`/DATA/AppData/jellyfin-native-security-test/` und ausdruecklich erlaubtes HTTP im Heimnetz.
Die GHCR-Paketsichtbarkeit muss fuer anonymes Laden auf Public gesetzt sein.

Linux-API-Tests, Docker-Startpruefung und Image-Digest liegen als Nachweise bei.
Der physische Fire-TV-Test und die Produktionsfreigabe stehen gesondert aus.
Vollstaendige Quellen, Lizenz, Aenderungspatch und Grenzen siehe Repository.
