Preview 19: taegliche Vier-Sterne-Auswahl fuer die grossen Vorschaubilder.

Pro Tag ein Titel ab vier von fuenf Sternen. In Filme kommt er ausschliesslich
aus der geoeffneten Filmbibliothek; in Serien aus der jeweiligen Serienbibliothek.
Start kombiniert berechtigte Filme und Serien. Es wird nicht mehr einfach die
erste Kachel verwendet. Der Titel bleibt beim Sortieren und Neuladen gleich.
Am naechsten lokalen Kalendertag wird bei mehreren Kandidaten ein anderer
gewaehlt. Es gibt keine zeitgesteuerte Diashow.

Neu hinzugefuegte gut bewertete Titel werden bevorzugt. Sichtbare Seiten
aktualisieren etwa minuetlich. Zwei begrenzte Anfragen verbinden bis zu 64
bestbewertete mit bis zu 16 neuesten Titeln ab vier Sternen. Ohne geeigneten
Titel bleibt der native Katalog verfuegbar; keine fremde Bibliothek oder
schlechter bewertete Kachel dient als Ersatz. Abspielen und Mehr Infos bleiben
an die nativen Aktionen gebunden, auch bei nicht sichtbarer Ausgangskachel.
Die Bewertung wird als Sternezahl am grossen Bild angezeigt.

Kandidaten und Anfragen bleiben an die aktuelle Anmeldung und Bibliothek
gebunden. Alte Antworten nach Bibliotheks-/Kontowechsel werden verworfen;
Abmeldung bereinigt alle Zusatzansichten gemeinsam. Nur Tageskennung,
Titel-ID und juengster Hinzufuegezeitpunkt werden lokal pro Server/Benutzer/
Bibliothek gespeichert. Keine Zugangstokens in URLs oder lokalen Einstellungen.

Vorhandene CasaOS-Test-App aktualisieren:
ghcr.io/461932-hub/jellyfin-native-security:12.4-preview19
Ports und Ordner beibehalten. Anschliessend Strg+F5.

Pruefung: 160 Browserfaelle (90 bisherige Oberflaeche, 36 Glocke, 34 neue
Tagesauswahl) fuer / und /media. Einschliesslich Tageswechsel, stabile Auswahl,
neuem Vier-Sterne-Titel neben 70 alten Fuenf-Sterne-Titeln, Bibliotheksgrenzen,
Serien-/Filmunterscheidung, nativen Aktionen, fehlenden Bewertungen, abgewiesenem
Zugriff, Kontowechsel mit echten Anfrageabbruechen und unveraenderter Scrollposition.
Lokale native Oberflaeche: sechs Pruefungen bestanden; 30 geeignete Serien und
24 Filme gefunden, gewaehlt wurden etwa 4,3 bzw. 4,2 Sterne. Bibliothekszuordnung,
Infofenster und stabile Tagesauswahl unabhaengig gegen die API geprueft.
Eigene Webdateien dabei nur im Diagnosebrowser. Keine Wiedergabe gestartet
oder Servereinstellungen geaendert. API-, TV- und Containerpruefungen vor Release.
Eigener Testkandidat, keine offizielle Jellyfin-Veroeffentlichung.
