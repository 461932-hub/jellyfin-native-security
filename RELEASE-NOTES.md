Preview 13: Einheitliches Querformat in gemischten Startseitenreihen.

Jellyfin mischt in zuletzt hinzugefuegten Serien auch einzelne Folgen und
Staffeln. Die bisherige fruehe Querformat-Regel erfasste nur Filme und Serien.
Folgen und Staffeln behielten deshalb teilweise ihre native Hochkantflaeche.

Die Startseite reserviert jetzt fuer alle vier Videotypen eine 16:9-Bildflaeche,
noch bevor Metadaten und Bilder eintreffen. Folgen werden ebenso markiert wie
Serien; Staffeln erhalten ihre eigene Miniatur oder ein vorhandenes Querbild
der uebergeordneten Serie. Eltern-IDs werden validiert, Bildanfragen bleiben
lokal und verwenden die bestehende geschuetzte Bildintegration. Ein fehlendes
Querbild faellt auf das vorhandene Poster im gleichen 16:9-Rahmen zurueck.

Staffeln behalten ihre originalen Detailverknuepfungen. Musikalben und andere
Kartentypen behalten ihr natives Format. Das manuell waehlbare Bibliotheksraster,
Vorschauanimationen aus Preview 12, Player und Medienrechte bleiben erhalten.

Vorhandene CasaOS-Test-App aktualisieren:
ghcr.io/461932-hub/jellyfin-native-security:12.4-preview13
Ports und Ordner beibehalten. Anschliessend Strg+F5.

Pruefung: 72 Browserfaelle fuer / und /media, einschliesslich gemischter Reihen
vor/nach dem Bildladen, eigener und geerbter Bilder, ungueltiger Eltern-IDs,
nativer Musikformate und unveraenderter Staffelaktionen. Echte native
Oberflaeche: 36 Videokacheln einschliesslich Folgen und Staffeln im 16:9-Format,
geschuetztes Staffelbild und originale Detailnavigation geprueft. Keine
Wiedergabe gestartet. Bestehende API-, TV-Identitaets- und Docker-Pruefungen.
Eigener Testkandidat, keine offizielle Jellyfin-Veroeffentlichung.
