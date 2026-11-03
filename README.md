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
`ghcr.io/461932-hub/jellyfin-native-security:12.4-preview6` bereit.
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
Container und ihre Einstellungen werden nicht eingebunden. Eigene
Ordner auf dem CasaOS-Host speichern Konfiguration und Cache:

| Zweck | Hostordner |
| --- | --- |
| Konfiguration und Datenbank | `/DATA/AppData/jellyfin-native-security-test/config` |
| Cache | `/DATA/AppData/jellyfin-native-security-test/cache` |

Preview 2 verwendet absolute Bind-Pfade, weil aeltere CasaOS-Importoberflaechen
benannte Docker-Volumes als `[object Object]` uebernehmen. Die Portzuordnung
lautet **Host 8099 -> Container 8096**. Ein eventuell noch offenes Formular mit
falschen Werten schliessen und die neue Importdatei erneut laden.

Preview 3 korrigiert ausserdem den Android-TV-Geraetekontext: Die App verwendet
nach der Anmeldung eine benutzerspezifische DeviceId, die von der urspruenglich
beim Token gespeicherten Geraetekennung abweichen kann. Der begrenzte Direktstream
uebernimmt jetzt die bei seiner Erstellung authentifizierte Kennung. Der native
Server prueft weiterhin Sitzungstoken, Widerruf, Bibliotheksrechte und die Bindung
an Film, Quelle und Wiedergabesitzung. Diese Korrektur verhindert den dadurch
verursachten HTTP-401-Direktstartfehler und den anschliessenden Player-Fallback.

Bei `ContainerBitrateExceedsLimit` die maximale Streaming-Bitrate der TV-App
beziehungsweise die gewaehlte Wiedergabequalitaet pruefen. Ein beispielsweise
auf 2 Mbit/s begrenzter Client kann auch eine passende H264-Datei oberhalb dieses
Limits absichtlich umwandeln lassen.

Der kurze Starthelfer beginnt als root und setzt ausschliesslich die Besitzer
leerer `/config`- und `/cache`-Mountwurzeln auf **1000:1000**. Er verweigert die
automatische Aenderung fremder nichtleerer oder nicht lesbarer Verzeichnisse.
Es gibt keinen rekursiven Besitzerwechsel. Danach startet `gosu` den Server
als Benutzer 1000. Der laufende Server hat keine effektiven Linux-Capabilities
und darf ueber `no-new-privileges` keine neuen Rechte erlangen. Der Starthelfer
setzt diese Kernel-Einstellung auch selbst vor dem Programmstart. Fuer den
Starthelfer sind im Container nur CHOWN, SETUID und SETGID freigegeben;
das Container-Dateisystem bleibt schreibgeschuetzt. `/DATA/Media` und `/DATA/hdd`
werden nur lesbar eingebunden. Die alten Medienzugriffsschutz-Plugins bitte
aus diesem frischen Testcontainer heraushalten; sie koennten ihre bisherige
Wiedergabeanpassung erneut anwenden. Cinema und Vorschlagsboard sind separate
Erweiterungen. Seit Preview 5 startet Cinema direkt als Standardoberflaeche.

## Cinema-Design mit originalen Funktionen

Die obere Leiste ist am Seitenanfang transparent. Das rote Wortlogo, grosse
Standbilder, breite Medienkarten, runde Auswahlflaechen und passende Menues
lehnen sich an das Cinema-Projekt an. Vorschauen enthalten keine eigenen
Videoelemente und keine Tonsteuerung.

Die vorhandenen Jellyfin-Seiten, Navigationslinks, Such-, Filter-, SyncPlay-,
Cast- und Kontomenues bleiben erhalten. Der neue grosse Abspielknopf klickt
die vorhandene native Abspieltaste desselben Titels; er startet keinen eigenen
Player und veraendert keine Wiedergabe- oder Transcoding-Einstellungen.
Karten werden bei Mausberuehrung als schwebende Vorschau vergroessert. Ein
Klick oeffnet das Cinema-Infofenster mit Beschreibung, Besetzung, nativen
Abspiel-/Favoritenaktionen und bei Serien einer Staffel-/Folgenauswahl.
Eine Verknuepfung zur originalen Detailseite bleibt im Fenster vorhanden.

Die Startseite behaelt ihre nativen horizontalen Reihen und Schieberegler;
Filme und Serien behalten das feste Bibliotheksraster. Der vorhandene native
Ansichtswert fuer Filme und Serien wird einmal pro Bibliothek und Browser auf
Kachelansicht / Miniatur gesetzt. Sortierung und weitere Einstellungen bleiben
erhalten, ebenso eine spaeter bewusst geaenderte Ansicht.

Das Einstiegdokument laedt die Cinema-Startlogik und das CSS vor den normalen
Clientskripten. Eine passende Cinema-Ladeansicht reserviert den Platz, bis die
vorbereitete Ansicht bereit ist. Die alte ungestaltete Seite wird dabei nicht
vorher angezeigt. Ein ausbleibender Start bietet eine Erneut-laden-Aktion.

Die Erweiterung liest nur Metadaten zu den bereits angezeigten erlaubten
Titeln. Sie bindet sich an die aktuelle Anmeldung und denselben Server-Ursprung
einschliesslich Basispfad. Zugangstokens stehen im Anfrageheader, nicht in
Bild- oder Metadatenadressen. Bei Abmeldung und Kontowechsel werden die eigenen
Vorschauen und Zwischenspeicher entfernt. Ein fehlgeschlagener Abruf laesst
die originalen Seiten benutzbar.

Mit `web/index.html?cinema=off` laesst sich die Gestaltung fuer diesen Browser
abschalten, mit `web/index.html?cinema=on` wieder einschalten. Anschliessend
normale Jellyfin-Adressen funktionieren weiterhin. Die Webdateien liegen
offen unter `web/` und im Image bei den vollstaendigen Quellen. Die nativen
Anmelde-, Medien- und Bibliothekspruefungen entsprechen weiter Preview 3.

Native Android-TV-/Fire-TV-Apps verwenden diese Webgestaltung nicht. Der
vorhandene TV-Direct-Play-Pfad wird nicht umgestellt.

## Build und Nachweise

```sh
docker build --platform linux/amd64 -t jellyfin-native-security:12.4-preview6 .
```

Der Build prueft die Quellpruefsummen, kompiliert die Linux-x64-Laufzeit und
uebernimmt Webclient und FFmpeg aus dem fest auf Digest gebundenen offiziellen
12.4-Image. Saemtliche zugehoerigen geaenderten Serverquellen sind ebenfalls
im Image unter `/usr/share/jellyfin-native-source/` enthalten.

Die lokalen Vorpruefungen umfassen 186 API-Tests, 65 dokumentierte Schritte an
einer frischen Serverinstanz und sieben Browserpruefungen. Details und Grenzen
stehen in `PRUEFBERICHT.txt` und `PROXY-HINWEISE.txt`. Der GitHub-Build fuehrt
die API-Tests erneut unter Linux sowie einen getrennten echten Docker-Start
mit frisch angelegten root-eigenen Bind-Ordnern und anonymen Bild-/Videoanfragen
aus. Zusaetzlich werden der Rechteabwurf, der Neustart mit vorhandenen Daten,
die Ablehnung fremder Verzeichnisse und der Medien-Leseschutz geprueft. Ein
weiterer echter Laufzeittest reproduziert die geaenderte TV-Geraetekennung,
prueft den originalen Videoabruf, Bibliotheksrechte, Stoppen und Abmelden.
Ergebnisse stehen
erst nach erfolgreichem CI-Lauf im Release zur Verfuegung.

Ein physischer Fire-TV-Test dieses Forks sowie der echte Produktionsproxy
bleiben gesondert zu pruefen. Andere Codecs, Untertitel oder Bandbreitenlimits
koennen weiterhin eine regulaere Umwandlung erfordern. Die begrenzte
Wiedergabeadresse ist ein zeitlich begrenztes Geheimnis fuer den einzelnen
Film; nach zehn Minuten ohne angemeldete Fortschrittsmeldung oder nach
Serverneustart kann erneutes Oeffnen erforderlich sein. Fuer bereits laufende
HTTP-Uebertragungen gibt es keinen rueckwirkenden Widerruf.
