Preview 20: grosse Vorschau frueher laden und Bilder priorisieren.

Die grosse Vorschau wartet bei Seitenwechseln nicht mehr auf die Zusatzdaten
der Filmkacheln. Ihre Auswahl startet direkt, unabhaengig von deren Verarbeitung.
Waehrenddessen reserviert ein passender Platzhalter den Bereich, damit das Raster
nicht nachtraeglich nach unten springt. Beim Zurueckkehren werden bereits gepruefte
Bibliothekskandidaten und geschuetzte Bilddaten weiterverwendet. Tagesauswahl,
Vier-Sterne-Grenze und Bibliothekszuordnung bleiben erhalten.

Grosses Bild und Logo erhalten hohe Ladeprioritaet. Der bestehende geschuetzte
Bildadapter zieht wartende Bilder mit fetchpriority=high vor normale Cover vor.
Bereits aktive Abrufe laufen weiter; hoechstens sechs sind gleichzeitig aktiv.
Ein schon wartendes Bild kann ohne Doppelabruf hochgestuft werden. Anmeldung,
Berechtigungen, gleicher Ursprung, Antwort-/Groessenpruefungen und Sitzungswechsel
bleiben erhalten. Keine Zugangstokens in Bildadressen. Der aktualisierte eingebettete
Bildadapter wird beim Docker-Start gegen seine Quelldatei verglichen.

Vorhandene CasaOS-Test-App aktualisieren:
ghcr.io/461932-hub/jellyfin-native-security:12.4-preview20
Ports und Ordner beibehalten. Anschliessend Strg+F5.

Pruefung: 174 Browserfaelle (90 Darstellung, 36 Glocke, 34 Tagesauswahl, 14 Ladefolge)
fuer / und /media. Die neuen Faelle verwenden den echten geschuetzten Bildadapter:
verzoegerte Auswahl, blockierte Kacheldaten, feste Platzhalterhoehe, Vorziehen des
grossen Bildes, Prioritaetswechsel ohne Doppelabruf, Cache beim Zurueckkehren,
Kontowechsel mit wartenden Bildern und weiterhin verweigerte Bildantworten.
Lokale native Gegenmessung: erste grosse Vorschau ca. 807 -> 652 ms,
beim erneuten Oeffnen ca. 499 -> 146 ms. Einzelne Diagnosemessungen im Heimnetz,
keine allgemeine Ladezeitgarantie. Eigene Dateien nur im Diagnosebrowser; keine
Wiedergabe gestartet oder Servereinstellungen geaendert. Alle 2673 Quellpruefsummen
lokal geprueft. API-, TV- und Containerpruefungen vor Veroeffentlichung.
Eigener Testkandidat, keine offizielle Jellyfin-Veroeffentlichung.
