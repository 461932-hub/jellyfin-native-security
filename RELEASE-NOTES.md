Preview 25: Film- und Serienkacheln auf dem Handy untereinander.

In den Film- und Serienbibliotheken stehen Medienkacheln auf schmalen
Bildschirmen bis 650 CSS-Pixel jetzt einzeln untereinander. Die Kacheln nehmen
die verfuegbare Breite ein; Nachbarkacheln ragen nicht seitlich heraus.
Auch Medienreihen innerhalb dieser Bibliotheken verwenden diese Anordnung.

Die grosse Vorschau behaelt ihr bisheriges Aussehen. Die Startseite behaelt
ihre horizontalen Reihen. Explizite Listenansichten, Personenkacheln und das
mehrspaltige Raster auf groesseren Bildschirmen bleiben bei ihrem bisherigen
Layout. Originale Kacheln, Navigation, Aktionen und Wiedergabelogik bleiben
zustaendig. Servercode und die Sicherheitskorrekturen werden nicht geaendert.
Die Webdateien erhalten die Cachekennung v21.

Image: ghcr.io/461932-hub/jellyfin-native-security:12.4-preview25
Update: Die BESTEHENDE CasaOS-App bearbeiten und nur den Image-Tag aendern.
Kein neuer YAML-Import. Danach die Handy-App vollstaendig schliessen und neu
oeffnen. Vorhandene Datenordner, Ports, Konten und Einstellungen beibehalten.

Pruefumfang: 232 isolierte Cinema-Browserfaelle einschliesslich 34 Handyfaellen
bei / und /media. Anordnung bei 320, 360 und 390 CSS-Pixel, Serien und Filme,
Medienreihen, native Listen, Startseite, Desktop-Raster sowie die bisherigen
Seiten-/Sichtbarkeitswechsel werden geprueft. Hinzu kommen die bestehenden
186 API-Tests, Dockerstart, TV-Identitaets-, Compose-, CasaOS-Portimport- und
originalen Erstinstallations-/Browserpruefungen.

Die Handyansicht wird in isoliertem Chromium mit Touch-Eingabe nachgestellt.
Kein physischer Handy-App-, Fire-TV-, GPU- oder CasaOS-Gesamtoberflaechentest.
Linux/amd64; Community-Testkandidat, keine offizielle Jellyfin-Version.
Kein laufender Benutzer-Server wird automatisch aktualisiert.
