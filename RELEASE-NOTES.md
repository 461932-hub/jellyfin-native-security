Preview 26: Zwei Kacheln nebeneinander auf dem Handy.

Film- und Serienbibliotheken zeigen auf schmalen Bildschirmen bis 650 CSS-Pixel
zwei Medienkacheln pro Zeile. Weitere Kacheln folgen darunter. Beide Spalten
teilen sich die verfuegbare Breite; die Kacheln werden nicht seitlich abgeschnitten.
Das gilt auch fuer Medienreihen innerhalb dieser Bibliotheken.
Preview25 hatte aufgrund einer noch offenen Rueckfrage eine Kachel pro Zeile
verwendet. Dieses Update setzt die inzwischen bestaetigte Zweispaltenauswahl um.

Die grosse Vorschau behaelt ihr bisheriges Aussehen. Startseiten-Reihen,
explizite Listenansichten, Personenkacheln und das Raster auf groesseren
Bildschirmen behalten ihr bisheriges Layout. Originale Kacheln, Navigation,
Aktionen und Wiedergabelogik bleiben zustaendig. Servercode und vorhandene
Sicherheitskorrekturen werden nicht geaendert. Webdateien: Cachekennung v22.

Image: ghcr.io/461932-hub/jellyfin-native-security:12.4-preview26
Update: BESTEHENDE CasaOS-App bearbeiten und nur den Image-Tag aendern.
Kein neuer YAML-Import. Danach die Handy-App vollstaendig schliessen und neu
oeffnen. Vorhandene Datenordner, Ports, Konten und Einstellungen beibehalten.

Pruefumfang: 232 isolierte Cinema-Browserfaelle einschliesslich 34 Handyfaellen
bei / und /media. Vier Kacheln pruefen beide Spalten und den Umbruch in die
naechste Zeile bei 320, 360 und 390 CSS-Pixel. Serien, Filme, Medienreihen,
native Listen, Startseite, Desktop-Raster und Seitenwechsel werden geprueft.
Hinzu kommen die bestehenden 186 API-Tests, Dockerstart, TV-Identitaets-,
Compose-, CasaOS-Portimport- und originalen Erstinstallations-/Browserpruefungen.

Die Handyansicht wird in isoliertem Chromium mit Touch-Eingabe nachgestellt.
Kein physischer Handy-App-, Fire-TV-, GPU- oder CasaOS-Gesamtoberflaechentest.
Linux/amd64; Community-Testkandidat, keine offizielle Jellyfin-Version.
Kein laufender Benutzer-Server wird automatisch aktualisiert.
