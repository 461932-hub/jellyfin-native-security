Preview 4: Cinema-Erscheinungsbild auf dem originalen Jellyfin-Webclient.

- Transparente Kopfleiste am Seitenanfang, rotes Wortlogo und runde Auswahl.
- Grosse Standbildvorschau auf Start- und Bibliotheksseiten sowie breite Karten.
- Keine Vorschauvideos, kein Tonknopf und kein eigener Ersatzplayer.
- Abspielen delegiert an den vorhandenen nativen Abspielknopf des Titels.
- Navigation, Detailseiten, Suche, Filter, SyncPlay, Casting und Kontomenues
  bleiben originale Jellyfin-Funktionen.
- Metadaten und Bilder verwenden bestehende Anmeldung und Bibliotheksrechte.
  Keine Sitzungstokens in Bild-/Metadatenadressen; eigene Daten werden bei
  Abmeldung oder Kontowechsel entfernt. Root- und /media-Basispfade geprueft.
- Fuer diesen Browser abschaltbar mit web/index.html?cinema=off; anschaltbar
  mit web/index.html?cinema=on.

Die Server-Sicherheitspruefungen und der TV-Direct-Play-Fix aus Preview 3
bleiben unveraendert. Native TV-Apps nutzen die Webgestaltung nicht.

Zum Aktualisieren der vorhandenen CasaOS-Test-App nur das Image auf
 ghcr.io/461932-hub/jellyfin-native-security:12.4-preview4
setzen und neu erstellen lassen. Eigene Port-, Medien- und Config-Pfade
beibehalten. Keine Neuinstallation mit fremden Konfigurationsordnern.
Anschliessend den Webclient mit Strg+F5 neu laden.

Dieser Stand ist ein eigener Testkandidat, keine offizielle Jellyfin-Ausgabe.
Browserpruefungen verwenden isolierte Beispieldaten; CI prueft weiterhin die
nativen API-, Docker- und TV-Geraetezuordnungsfaelle. Ein vollstaendiger Test
aller Benutzerfunktionen und aller physischen Endgeraete wird nicht behauptet.
