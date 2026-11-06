Preview 24: Grosse Vorschau beim mobilen Bibliothekswechsel.

Beim Wiedereroeffnen einer bereits geladenen Seite kann Jellyfin nur deren
Sichtbarkeit aendern und die nativen viewshow-/pageshow-Ereignisse ausloesen.
Die Cinema-Ergaenzung reagierte bisher vor allem auf neue DOM-Inhalte und
Hashwechsel. Dadurch konnte die grosse Vorschau nach einem solchen Wechsel
fehlen, obwohl die darunterliegenden originalen Inhalte bereits sichtbar waren.

Die Ergaenzung aktualisiert sich jetzt auch bei den originalen Seitenereignissen
und beim Aendern von hide-Klasse, display oder hidden. Bei ueberlappenden
Seitentransitionen wird die neu angezeigte Seite bevorzugt. Zuruecknavigation
und zwischengespeicherte Home-/Favoriten-Tabs werden ebenfalls beruecksichtigt.
Eigene Layout-Klassen und CSS-Variablen loesen keine endlose Neuberechnung aus.

Die grosse Startseitenvorschau und ihr responsives Hoch-/Querformat bleiben
erhalten. Filme und Serien verwenden weiterhin ihre jeweilige Bibliothek und
die Tagesauswahl ab vier Sternen. Ohne geeigneten Titel bleibt wie bisher der
native Katalog verfuegbar. Navigationslinks, horizontale Startseiten-Reihen,
Bibliotheksraster, Originalaktionen, Medienrechte und Anmeldeschutz bleiben
zustaendig. Es werden keine Navigationshandler ersetzt und keine Tokens in
Medienadressen geschrieben. Die Webdateien erhalten die Cachekennung v20.

Image: ghcr.io/461932-hub/jellyfin-native-security:12.4-preview24
Bestehende CasaOS-App aktualisieren: nur den Image-Tag aendern; kein neuer
Import und keine neue Konfiguration erforderlich. Die Handy-App danach
vollstaendig schliessen und neu oeffnen, damit sie die neuen Webdateien laedt.

Pruefungen vor Veroeffentlichung: 224 isolierte Cinema-Browserfaelle, davon
26 Touch-/Handyfaelle bei / und /media mit Hoch-/Querformat, Filmen, Serien,
Home, Sichtbarkeitswechseln, Favoriten und ueberlappenden Seiten. Der neue
Test reproduziert den fehlenden Bibliotheks-Hero auf Preview23. Hinzu kommen
186 API-Tests, Dockerstart, 7 TV-Identitaetsfaelle, 8 Compose-Modelle, 5 rohe
Port-Importfaelle sowie die echten Erstinstallations-/Browserpruefungen.

Die Handy-Seitenereignisse werden im Chromium-Test mit kuenstlichen Daten
nachgestellt. Kein physischer Android-/iOS-App-, CasaOS-Gesamtoberflaechen-,
GPU- oder Fire-TV-Test. Linux/amd64; Community-Testkandidat, keine offizielle
Jellyfin-Veroeffentlichung. Kein laufender Benutzer-Server wird automatisch
aktualisiert.
