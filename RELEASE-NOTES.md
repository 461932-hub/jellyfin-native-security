Preview 9: Cinema-Bewegungen in beide Richtungen und einrastende Vollbildvorschau.

Kleine Vorschauen wachsen aus der Kachel und schrumpfen dorthin zurueck. Der
Pfeil oeffnet das grosse Infofenster; X, Escape und Hintergrundklick schliessen
es mit dem Rueckweg zur sichtbaren Ausgangskachel. Unterbrochenes Oeffnen wird
von der sichtbaren Groesse aus umgekehrt. Der Hintergrund blendet passend aus.
Die Bewegungsablaeufe und ihre Zeitkurven stammen aus dem vorhandenen Cinema-
Paket. Reduzierte Bewegung wird respektiert; Navigation, Wiedergabestart und
Abmeldung raeumen eigene Vorschauen ohne verzoegerten Rueckweg auf.

Auf Start-, Film- und Serienseiten belegt das grosse Bild die verfuegbare
Fensterhoehe unter der sichtbaren nativen Kopfleiste. Versteckte alte Header
zaehlen dabei nicht mit. Bildanfragen folgen der Breite und Pixeldichte bis
3840 Pixel. In niedrigen Querformatfenstern bleiben Titel und Abspielen sichtbar.

Das Mausrad rastet vom Hero zum ersten Katalogbereich ein und nach oben zurueck.
Im Katalog bleibt vertikales Scrollen frei. Ein eigener oberer Anschlag stoppt
Radnachlauf, bevor das grosse Bild erneut geoeffnet wird. Horizontale Gesten,
Formulare, native Menues und Dialoge behalten ihre Bedienung. Ein Wechsel der
Fenstergroesse erhaelt die aktuelle Katalogposition.

Die vorhandenen nativen Aktionen, Player, Berechtigungspruefungen und der
TV-Direct-Play-Fix bleiben bestehen. Vorschauen enthalten nur Standbilder.
Startseite: native horizontale Reihen. Bibliothek: festes Miniaturraster.
Meine Medien bleibt auf der Cinema-Startseite ausgeblendet.

Vorhandene CasaOS-Test-App aktualisieren:
ghcr.io/461932-hub/jellyfin-native-security:12.4-preview9
Vorhandene Ports und Ordner erhalten. Anschliessend Strg+F5.

Pruefumfang: isolierte Browserfaelle fuer / und /media, API-Regressionen,
Docker-Start und synthetische TV-Geraetezuordnung. Echte Start- und Serienseite
wurden zusaetzlich im Diagnosebrowser mit neuen Webdateien geprueft; keine
Medienwiedergabe oder Produktionsaenderung. Kein neuer physischer TV-Test.
Eigener Testkandidat, keine offizielle Jellyfin-Veroeffentlichung.
