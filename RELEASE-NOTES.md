Preview 23: CasaOS-Import ohne NaN in den Portfeldern.

Der CasaOS-Dialog liest YAML vor der Docker-Variablenaufloesung. Der bisherige
Portplatzhalter in der Kurzsyntax konnte dabei als falsche Portzeichenfolge
zerlegt werden: Host 8096, interner Container-Port NaN. Die Vorlagen verwenden
jetzt explizite Portobjekte mit numerischem target, published und Protokoll,
wie die originale CasaOS-Vorlage. Der Web-UI-Port ist ebenfalls eine Zahl.

Standard-/CPU-Vorlage: Host 8096 -> Container 8096/TCP.
Parallelvorlage: Host 8100 -> Container 8096/TCP.
Bei belegtem Hostport diesen und den Web-UI-Port gemeinsam auf eine freie Zahl
aendern. Der interne Container-Port bleibt 8096. Neue Dateien in eine frische
Importmaske laden; bereits geoeffnete alte Dialoge werden nicht automatisch
korrigiert. Zusaetzliche HTTPS-/UDP-Ports der Standardvorlage bleiben erhalten.

Der neue Regressionstest liest die unveraenderte YAML mit einem YAML-Parser und
prueft die numerische Konvertierung des CasaOS-Importdialogs. Er reproduziert
zuerst den alten NaN-Fall und prueft dann alle vier ausgelieferten Dateien vor
jeder Compose-Interpolation. Zusaetzlich pruefen acht Compose-Modelle getrennte
AppIDs und von Betreibern geaenderte numerische Host-/Web-UI-Ports.

Image: ghcr.io/461932-hub/jellyfin-native-security:12.4-preview23
Die Laufzeit, der originale Erstassistent, Cinema und die Sicherheitskorrekturen
entsprechen Preview22. Nur Installationsvorlagen, Anleitung, Pruefung und
Versionskennzeichnung sind angepasst. Keine laufenden Server geaendert.

Pruefungen vor Veroeffentlichung: 5 rohe Port-Importfaelle, 8 Compose-Modelle,
198 isolierte Cinema-Browserfaelle, 186 API-Tests, Dockerstart, 7 TV-Identitaets-
faelle sowie die echten Erstinstallations-/Browserpruefungen von Preview22.
Kein Live-Test der kompletten CasaOS-Oberflaeche und kein physischer GPU-/TV-Test.
Linux/amd64; Community-Testkandidat, keine offizielle Jellyfin-Veroeffentlichung.
