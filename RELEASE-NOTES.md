Preview 7: Cinema startet direkt als Standardoberflaeche.

- Das Einstiegdokument laedt Cinema-Startlogik und Gestaltung vor dem Client.
  Der vorbereitete Aufbau ersetzt das vorherige Aufblitzen der alten Ansicht.
- Standbild-Hero auf Start-, Film- und Serienseiten; keine Vorschauvideos.
- Vergroesserte schwebende Karten bei Mausberuehrung, ausserhalb der Rails.
- Klick auf Titel oder Mehr Infos oeffnet das Cinema-Infofenster mit
  Beschreibung, Besetzung, originalen Aktionen und optionaler Detailseite.
- Serienfenster mit Staffelwahl, seitenweise geladenen Folgen und Weitergabe
  des Episodenstarts an Jellyfins originalen Wiedergabebefehl.
- Die Startseite behaelt horizontale Schiebereihen. Bibliotheken bleiben feste
  Raster. Miniatur ist der einmal gesetzte native Standard je Bibliothek und
  Browser; Sortierung und spaetere bewusste Ansichtswahlen werden erhalten.
- Native Navigation, Suche, Filter, SyncPlay, Cast, Player und Rechtepruefungen
  bleiben angebunden. Sitzungstokens stehen weiter nicht in Metadaten-/Bild-URLs.
- Originalmodus bei Bedarf explizit mit web/index.html?cinema=off aufrufbar.

Die nativen Medien- und Bibliothekspruefungen sowie der TV-Direct-Play-Fix aus
Preview 3 bleiben unveraendert. Native TV-Apps laden nicht diese Weboberflaeche.

Die vorhandene CasaOS-Test-App auf folgendes Image aktualisieren:
ghcr.io/461932-hub/jellyfin-native-security:12.4-preview7
Vorhandene Port-, Medien-, Config- und Cache-Pfade beibehalten. Danach den
Browser mit Strg+F5 neu laden. Der Wechsel ist erst nach dem NAS-Update aktiv.

Dieser Stand ist ein eigener Testkandidat, keine offizielle Jellyfin-Ausgabe.
CI prueft Browserverhalten an isolierten Beispieldaten sowie API-, Docker-
und TV-Geraetezuordnungsfaelle. Kein neuer physischer TV-Test wird behauptet.

Preview 7 reserviert auch die Rasterspalten vor dem Nachladen. Die nativen
Bibliotheksbilder bleiben unveraendert; eigene spaetere Ansichtswahlen werden
weiter beachtet. Die Browserpruefung deckt die stabile Spaltenaufteilung ab.

Preview 7 laesst Hover-Vorschauen aus der urspruenglichen Bildkachel wachsen,
blendet Aktionen weich ein und respektiert reduzierte Bewegung. Die Reihe
behaelt ihre Position. Meine Medien entfaellt auf der Cinema-Startseite;
die Bibliotheken bleiben ueber die native Kopfnavigation erreichbar.
