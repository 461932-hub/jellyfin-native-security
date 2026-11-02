# Jellyfin 12.4: nativer Medienzugriffsschutz

Dieser eigene Testfork baut auf dem offiziellen Jellyfin-Tag **v12.4** auf.
Anmeldung und aktuelle Bibliotheksrechte werden fuer direkte Medien- und
Bibliotheksbildzugriffe zusaetzlich im Server geprueft. Android TV 0.19.10
erhaelt fuer unterstuetztes Direct Play eine begrenzte Wiedergabeberechtigung.
Die normale Codec-/Containerauswahl bleibt erhalten.

Es handelt sich um einen **Testkandidaten**, nicht um eine offizielle
Jellyfin-Veroeffentlichung. Vollstaendige Quellen und die urspruengliche Lizenz
liegen unter `server/`; `SOURCE-PATCH.diff` zeigt die Aenderungen gegen
[Jellyfin v12.4](https://github.com/jellyfin/jellyfin/tree/v12.4).

## Installation ueber CasaOS

Nach einem erfolgreichen Lauf unter **Actions** steht das Image unter
`ghcr.io/461932-hub/jellyfin-native-security:12.4-preview1` bereit.
Der Kontoinhaber muss das GitHub-Containerpaket einmal unter **Packages ->
jellyfin-native-security -> Package settings -> Change visibility -> Public**
oeffentlich lesbar machen. Ein oeffentliches Repository allein aendert die
Paket-Sichtbarkeit nicht. Siehe [GitHub-Paketberechtigungen](https://docs.github.com/en/packages/learn-github-packages/configuring-a-packages-access-control-and-visibility).

1. `CasaOS-Import.yaml` aus diesem Repository oder dem neuesten Release laden.
2. In CasaOS **+ -> Benutzerdefinierte App installieren -> Importieren** oeffnen.
3. Die YAML-Datei auswaehlen und die App **Jellyfin Sicherheitstest** installieren.
4. `http://192.168.0.113:8099/web/` oeffnen und ein neues Testkonto anlegen.
5. Zuerst einen kleinen Medienordner unter `/Media` oder `/HDD` hinzufuegen.
6. Im Fire TV den Testserver `http://192.168.0.113:8099` hinzufuegen und einen
   unterstuetzten Film in Originalqualitaet pruefen.

Die Datei ist fuer diesen ausdruecklichen **HTTP-Test im Heimnetz** vorbereitet.
Auch die normale Anmeldung laeuft dabei unverschluesselt. Fuer den spaeteren
Domainbetrieb eine feste HTTPS-Basisadresse und den passenden Jellyfin-Basispfad
konfigurieren sowie beide HTTP-Ausnahmen deaktivieren.

Eigener Container: `jellyfin-native-security-test`, Port **8099**. Die bisherigen
Container und ihre Einstellungen werden nicht eingebunden. Neue benannte
Docker-Volumes speichern Konfiguration und Cache:

| Zweck | Docker-Volume |
| --- | --- |
| Konfiguration und Datenbank | `jellyfin-native-security-test-config` |
| Cache | `jellyfin-native-security-test-cache` |

Die Volumes werden beim ersten Anlegen aus dem Image mit Besitzer **1000:1000**
initialisiert. Der Server laeuft als Benutzer 1000, mit schreibgeschuetztem
Container-Dateisystem und ohne Linux-Capabilities. `/DATA/Media` und `/DATA/hdd`
werden nur lesbar eingebunden. Die alten Medienzugriffsschutz-Plugins bitte
aus diesem frischen Testcontainer heraushalten; sie koennten ihre bisherige
Wiedergabeanpassung erneut anwenden. Cinema und Vorschlagsboard sind separate
Erweiterungen; dieses Image verwendet zuerst die Original-Weboberflaeche.

## Build und Nachweise

```sh
docker build --platform linux/amd64 -t jellyfin-native-security:12.4-preview1 .
```

Der Build prueft die Quellpruefsummen, kompiliert die Linux-x64-Laufzeit und
uebernimmt Webclient und FFmpeg aus dem fest auf Digest gebundenen offiziellen
12.4-Image. Saemtliche zugehoerigen geaenderten Serverquellen sind ebenfalls
im Image unter `/usr/share/jellyfin-native-source/` enthalten.

Die lokalen Vorpruefungen umfassen 186 API-Tests, 65 dokumentierte Schritte an
einer frischen Serverinstanz und sieben Browserpruefungen. Details und Grenzen
stehen in `PRUEFBERICHT.txt` und `PROXY-HINWEISE.txt`. Der GitHub-Build fuehrt
die API-Tests erneut unter Linux sowie einen getrennten echten Docker-Start
mit benannten Volumes und anonymen Bild-/Videoanfragen aus. Ergebnisse stehen
erst nach erfolgreichem CI-Lauf im Release zur Verfuegung.

Ein physischer Fire-TV-Test dieses Forks sowie der echte Produktionsproxy
bleiben gesondert zu pruefen. Andere Codecs, Untertitel oder Bandbreitenlimits
koennen weiterhin eine regulaere Umwandlung erfordern. Die begrenzte
Wiedergabeadresse ist ein zeitlich begrenztes Geheimnis fuer den einzelnen
Film; nach zehn Minuten ohne angemeldete Fortschrittsmeldung oder nach
Serverneustart kann erneutes Oeffnen erforderlich sein. Fuer bereits laufende
HTTP-Uebertragungen gibt es keinen rueckwirkenden Widerruf.
