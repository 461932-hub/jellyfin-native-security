Preview 11: Miniatur als Standard in den nativen Bibliotheksansichten.

Die fruehere Vorgabe nur fuer Filme und Serien wird auf die nativen
Bibliotheksansichten und ihre Tabs erweitert, darunter Sammlungen und Favoriten.
Gespeicherte Primaer-Einstellungen werden einmalig auf Miniatur umgestellt,
auch bei bereits vorhandener v1-Markierung. Neue Tabs werden vor ihrer Anzeige
mit dem vollstaendigen nativen Ansichtsschema vorbereitet.

Sortierung, Filter, Titel-/Jahresanzeige und gespeicherte Listenlayouts bleiben
erhalten. Andere bereits ausgewaehlte Bildtypen sowie jede spaetere bewusste
manuelle Auswahl bleiben erhalten. Folgen behalten ihre native Seriensortierung,
Lieder ihre Listenansicht. Die Aenderung gilt fuer den Webclient; native TV-Apps
verwalten ihre Darstellung selbst. Wiedergabe und Medienrechte bleiben erhalten.

Vorhandene CasaOS-Test-App aktualisieren:
ghcr.io/461932-hub/jellyfin-native-security:12.4-preview11
Vorhandene Ports und Ordner beibehalten. Anschliessend Strg+F5.

Pruefung: echte native Serienansicht und Sammlungs-Tab mit markierter Miniatur,
manuelle Primaer-Auswahl nach Neuladen, 58 Browserpruefungen fuer / und /media
mit Migration alter Einstellungen, Filter-/Sortiererhalt, ungueltigen Daten und
fremden Links. Zusaetzlich bestehende API-, TV-Identitaets- und Docker-Pruefungen.
Kein neuer physischer TV-Test. Eigener Testkandidat, keine offizielle
Jellyfin-Veroeffentlichung.
