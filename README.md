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

## Frische Installation oder Aktualisierung

Die oeffentlichen Importvorlagen enthalten **keine eingerichtete Datenbank,
keine Konten, keine Bibliotheken, keine persoenliche Serveradresse und keinen
alten benutzerdefinierten CSS-Code**. Bei einem leeren eigenen Konfigurations-
ordner startet der unveraenderte Jellyfin-Einrichtungsassistent. Bestehende Daten
werden beim Aktualisieren bewusst weiterverwendet und nicht zurueckgesetzt.

Die Schritt-fuer-Schritt-Anleitung steht in [INSTALLATION.md](INSTALLATION.md).
Das oeffentlich lesbare Image lautet
`ghcr.io/461932-hub/jellyfin-native-security:12.4-preview27` (Linux/amd64).
Es ist ein Community-Testkandidat mit Cinema-Design und den bereits geprueften
zusaetzlichen Anmelde-/Bibliothekspruefungen, keine offizielle Jellyfin-Ausgabe.

| Datei | Zweck |
| --- | --- |
| `CasaOS-Import.yaml` | Intel-/AMD-Rendergeraet `/dev/dri`, HTTP, natives HTTPS und UDP-Ports |
| `CasaOS-Import-CPU.yaml` | Gleiche Installation ohne vorausgesetztes Grafikgeraet |
| `CasaOS-Import-Parallel.yaml` | Zusaetzliche Intel-/AMD-Installation mit eigenem freien HTTP-Port; keine belegten Zusatzports kopieren |
| `compose.yaml` | Direkte Docker-Compose-Installation ohne CasaOS; CPU-Vorgabe, Projektname bestimmt die Datenordner |

CasaOS vergibt bei einem **neuen Import** einen eigenen App-Namen. Die Vorlagen
verwenden seine `$AppID` fuer getrennte `/config`- und `/cache`-Ordner und
feste numerische Portfelder fuer den CasaOS-Import. Die Standardvorlage
verwendet Host-Port 8096, die Parallelvorlage 8100; vor dem Start einen freien
Port waehlen und den Web-UI-Port entsprechend setzen. Sie erzwingen weder denselben
Container-Namen noch dieselbe feste CasaOS-ID. Zum **Aktualisieren** dagegen die
vorhandene App bearbeiten und nur den Image-Tag aendern; nicht erneut importieren.
Ein zweiter neuer Container verweigert ausserdem den gleichzeitigen Zugriff auf
eine bereits von dieser Version gesperrte Konfiguration (Exitcode 75). Dieser
zusaetzliche Lock ersetzt kein Backup und wirkt nicht gegen aeltere Server,
die ihn noch nicht verwenden. Nie die Datenbank eines laufenden alten Servers teilen.

PUID, PGID, TZ, Netzmodus, Portzuordnungen, Medienordner, Geraetefreigaben,
Ressourcen, Neustartverhalten und Containerbefehl bleiben in CasaOS einstellbar.
PUID/PGID muessen positive numerische IDs sein. Der Starthelfer initialisiert nur
leere Mountwurzeln, ohne rekursive Besitzerwechsel. Danach startet der Server
unter PUID/PGID ohne effektive Capabilities und mit `no-new-privileges`.
Docker-Zusatzgruppen und Gruppen explizit durchgereichter `/dev/dri`-Geraete
bleiben fuer Hardwarezugriff erhalten; Geraete- und Medienrechte werden nicht
veraendert. Die CPU-Vorlage erfordert kein vorhandenes Rendergeraet. Einen echten
GPU-/Codec-Nachweis muessen Betreiber auf ihrer Hardware fuehren.

`/Media` und `/HDD` sind wie bei ueblichen Originalvorlagen beschreibbar;
Administratoren koennen sie in CasaOS schreibgeschuetzt einbinden. Die vorhandenen
Jellyfin-Rechte entscheiden weiterhin ueber Benutzeraktionen. Ressourcen erhalten
nur eine Speicherreservierung, kein festes Speichermaximum. Administratorseitige
`.sh`-Dateien unter einem optionalen `/custom-cont-init.d`-Mount laufen unter der
konfigurierten Benutzer-ID, nicht als root; LinuxServer-spezifische Root-Installations-
skripte sind damit nicht automatisch kompatibel. Die Cinema-Dateien sind bereits
im Image enthalten und brauchen keinen solchen Installationshook.

Fuer Android TV 0.19.10 bleibt der bereits vorhandene begrenzte Direct-Play-Pfad
erhalten. Seine vertrauenswuerdige Wiedergabe-Basisadresse muss der Betreiber
selbst setzen. Die oeffentliche Vorlage aktiviert keine unverschluesselten
TV-Ausnahmen. Das betrifft insbesondere alte Clients, die Bilder/Direct Play
nicht mit einem Authentifizierungsheader anfordern. Details, ausdrueckliche
LAN-Einrichtung und HTTPS/Proxy-Hinweise stehen in der Installationsanleitung.
Die Medienanmeldung wird fuer Kompatibilitaet nicht abgeschaltet.

## Cinema-Design mit originalen Funktionen

Die obere Leiste ist am Seitenanfang transparent. Das rote Wortlogo, grosse
Standbilder, breite Medienkarten, runde Auswahlflaechen und passende Menues
lehnen sich an das Cinema-Projekt an. Vorschauen enthalten keine eigenen
Videoelemente und keine Tonsteuerung.

Das grosse Bild waehlt einen Titel pro lokalem Kalendertag mit mindestens
vier von fuenf Sternen (Jellyfin CommunityRating >= 8). Filme stammen nur aus
der geoeffneten Filmbibliothek; Serien nur aus der jeweiligen Serienbibliothek.
Start darf die fuer den Benutzer verfuegbaren Filme und Serien kombinieren.
Sortierung, Buchstabenfilter und Seitengroesse des nativen Rasters bestimmen
nicht mehr das grosse Bild. Die Tagesauswahl bleibt beim Neuladen erhalten;
am naechsten Tag wird bei mehreren geeigneten Titeln ein anderer gewaehlt.

Neue gut bewertete Titel werden anhand von Jellyfins Hinzufuegedatum bevorzugt.
Sichtbare Seiten aktualisieren den Kandidatenvorrat etwa minuetlich. Eine
Anfrage liefert bis zu 64 bestbewertete Titel, eine zweite bis zu 16 neueste
Titel ab vier Sternen. Dadurch kann auch ein neuer Acht-von-zehn-Titel neben
vielen alten Zehnern erscheinen. Es gibt keine automatische Diashow. Ohne
geeigneten Titel bleibt der native Katalog erhalten, ohne einen schlechter
bewerteten oder fremden Titel einzusetzen. Bibliotheks-/Kontowechsel verwerfen
alte Anfragen; abgewiesene Anfragen entfernen das grosse Bild. Nur der Tag,
die ausgewaehlte Titel-ID und der juengste Hinzufuegezeitpunkt werden lokal,
getrennt nach Server, Benutzer und Bibliothek, gespeichert. Keine Zugangstokens.
Abspielen und Informationen nutzen weiterhin die vorhandenen nativen Aktionen,
auch wenn die ausgewaehlte Kachel gerade nicht im sichtbaren Raster steht.

Die grosse Vorschau wird unabhaengig von den Zusatzdaten der Kacheln aufgebaut.
Ein gleich grosser Platzhalter reserviert den Bereich waehrend der Auswahl;
das Raster springt dadurch nicht nachtraeglich nach unten. Bereits gepruefte
Bibliothekskandidaten und geschuetzte Bilddaten werden beim Zurueckkehren genutzt.
Das gilt auch fuer zwischengespeicherte Bibliotheksseiten in mobilen Webviews:
Die Gestaltung reagiert auf Jellyfins originale viewshow-/pageshow-Ereignisse
und auf native Sichtbarkeitswechsel. Filme, Serien und die Startseite erhalten
dadurch nach dem Wiedereroeffnen erneut ihre passende grosse Vorschau. Die
originalen Navigationslinks, Kachelraster, Filter und Wiedergabeaktionen bleiben
zustaendig. Handy-Hochformat und Querformat werden in einem isolierten
Chromium-Test mit Touch-Eingabe geprueft; ein physischer Handy-App-Test ist
dadurch nicht ersetzt.
Die obere Handy-Leiste beruecksichtigt die zusaetzliche Zurueck-Taste der App.
Menue, Zurueck, Glocke, SyncPlay, Uebertragen, Suche und Profil bleiben in
einer Zeile. Darunter stehen Bibliotheksname und Anzahl sowie eine eigene
vollstaendige Zeile fuer Abspielen/Zufall, Filter, Sortierung, Ansicht und
die Blaettertasten. Die originale Stack-Struktur und ihre nativen Aktionen
bleiben bestehen. Die echte React/MUI-Oberflaeche wird zusaetzlich auf einer
frischen Docker-Testinstanz bei 320/360/390 Pixeln mit einer zusaetzlichen,
originalgetreu geformten App-Zurueck-Taste und bedienbarem Profilmenue geprueft.
Auf schmalen Handyansichten bis 650 CSS-Pixel stehen die originalen Film-,
Serien-, Staffel- und Folgenkacheln in den Film-/Serienbibliotheken
zu zweit nebeneinander, weitere darunter. Das gilt auch fuer Medienreihen.
Die grosse Vorschau, horizontale Startseiten-Reihen, explizite Listenansichten und das Raster auf
groesseren Bildschirmen bleiben erhalten. Es wird nur die Anordnung geaendert.
Das grosse Bild und sein Logo erhalten fetchpriority=high. Der vorhandene
Bildadapter zieht solche wartenden Bilder vor normale Cover vor, behaelt aber
hoechstens sechs aktive Abrufe und alle bisherigen Anmelde-, Ursprung-, Groessen-
und Sitzungspruefungen. Ein bereits wartendes Bild kann ohne Doppelabruf hoch-
gestuft werden. Beim ersten Appstart bleibt die vorbereitete Ladeansicht erhalten.

Das Wortlogo verwendet das unveraenderte originale Cinema-Bild statt eines
Schrift-Ersatzes. In der Verwaltungsuebersicht stehen dieses Logo und die
native Versionsnummer nebeneinander. Der konfigurierte Servername bleibt
erhalten; sein Text wird dort nur visuell ausgeblendet.

Die Bibliotheks-Werkzeugleiste verwendet die gewaehlte helle Cinema-Variante.
"Alle abspielen" und die Zufallswiedergabe bilden einen gemeinsamen weissen
Knopf mit feiner Trennlinie. Filter, Sortierung, Ansicht und Seitenwechsel
haben getrennte runde Ziele mit einheitlichem Abstand. Originale Buttons,
Symbole, Hinweise, Menues und deaktivierte Zustaende bleiben erhalten. Kleine
Fenster behalten die native kompakte Darstellung und koennen die Gruppen
bei Platzmangel umbrechen. Tastaturfokus bleibt sichtbar.

Beim Blaettern mit Vorheriges/Naechstes bleibt ein bereits heruntergescrollter
Katalog unter der nativen Kopfleiste. Auch verzoegerte native Scroll-Resets
zeigen nicht erneut die grosse Vorschau. Die erste Reihe der neuen Seite wird
sichtbar; bewusstes Scrollen, Beruehren oder eine Scrolltaste beenden die
kurze Positionssicherung sofort. Bibliothekswechsel, Abmeldung und das Ende
des Ladevorgangs raeumen sie ebenfalls auf. Die nativen Paging-Handler bleiben
unveraendert. Eine spaeter eingebaute Liste erhaelt weiterhin die responsive
Vorschauhoehe und den Uebergang per Mausrad.

Die Benachrichtigungsglocke uebernimmt das Verhalten des Cinema-Headers:
hoechstens fuenf neu hinzugefuegte Filme aus den letzten fuenf Tagen. Der rote
Zaehler zeigt ungesehene Eintraege. Oeffnen markiert sie fuer das jeweilige
Server-/Benutzerpaar als gesehen; in lokalen Einstellungen wird nur dieser
Zeitpunkt gespeichert. Neue Eintraege werden einmal pro Minute geladen,
waehrend der Client sichtbar ist. Ein Klick oeffnet das vorhandene Cinema-
Infofenster. Die vorhandenen SyncPlay-, Cast-, Such- und Kontoknoepfe bleiben
aktiv. Filme und Bilder werden mit der aktuellen Anmeldung angefordert.
Abmeldung oder Kontowechsel entfernen die Liste und brechen laufende Anfragen
ab. Abgewiesene Anfragen entfernen bisherige Eintraege. Anfrageadressen enthalten
keine Zugangstokens. Die Glocke ist bei cinema=off ebenfalls abgeschaltet.

Die vorhandenen Jellyfin-Seiten, Navigationslinks, Such-, Filter-, SyncPlay-,
Cast- und Kontomenues bleiben erhalten. Der neue grosse Abspielknopf klickt
die vorhandene native Abspieltaste desselben Titels; er startet keinen eigenen
Player und veraendert keine Wiedergabe- oder Transcoding-Einstellungen.
Karten werden bei Mausberuehrung als schwebende Vorschau vergroessert. Ein
Klick oeffnet das Cinema-Infofenster mit Beschreibung, Besetzung, nativen
Abspiel-/Favoritenaktionen und bei Serien einer Staffel-/Folgenauswahl.
Eine Verknuepfung zur originalen Detailseite bleibt im Fenster vorhanden.

Die Staffelauswahl zeigt hinter jedem Staffelnamen die vom Server gemeldete
Gesamtzahl der Folgen, beispielsweise "Staffel 1 · 25 Folgen". Auch "Alle
Staffeln" erhaelt die Gesamtzahl aus der vorhandenen Folgenabfrage. Die Zahlen
stammen aus derselben Benutzeransicht wie die Folgenliste, unabhaengig von deren
30er-Seitengroesse. Hoechstens drei Zaehlanfragen laufen parallel und liefern
keine Folgenobjekte oder Bilder. Beim Schliessen werden sie abgebrochen.
Fehlt eine Zahl voruebergehend, bleibt die Staffel waehlbar; die ausgewaehlte
Folgenantwort kann die Zahl anschliessend ergaenzen.

Oeffnen und Schliessen verwenden jetzt die Bewegungsablaeufe aus dem Cinema-
Projekt. Kleine Vorschauen schrumpfen zur Kachel zurueck, grosse Infofenster
zur sichtbaren Ausgangskachel. Auch ein Schliessen waehrend des Oeffnens geht
von der gerade sichtbaren Groesse aus. Beim Wechsel zur Nachbarkachel beginnt
das Schrumpfen sofort, waehrend die neue Kachel ihre eigene Oeffnungsverzoegerung
behaelt. Das gilt auch fuer Nachbarn in der Reihe darunter. Beim Weiterbewegen
werden ausstehende Oeffnungen verworfen; Knopfe in der offenen Vorschau bleiben
bedienbar. Escape, X und Hintergrundklick bleiben verfuegbar. Abmeldung, Seitenwechsel und Wiedergabestart entfernen die eigenen
Vorschauen sofort; reduzierte Bewegung deaktiviert die Uebergaenge.

Das grosse Vorschaubild nutzt die verfuegbare Fensterhoehe abzueglich der
sichtbaren Jellyfin-Kopfleiste. Bildanfragen folgen der Aufloesung bis maximal
3840 Pixel Breite. Kurze Querformatfenster erhalten kompakte Titel und Aktionen.
Das Mausrad rastet vom grossen Bild zum Katalog ein und wieder zurueck. Im
Katalog bleibt normales Scrollen erhalten; Radnachlauf oeffnet das grosse Bild
nicht ungewollt. Horizontale Gesten bleiben den nativen Reihen vorbehalten.
Ein Groessenwechsel erhaelt den aktuellen Abstand im Katalog.

Die Startseite behaelt ihre nativen horizontalen Reihen und Schieberegler;
Filme und Serien behalten das feste Bibliotheksraster. Gemischte Videoreihen
auf Start zeigen Filme, Serien, Folgen und Staffeln einheitlich in 16:9. Der
Platz wird schon vor dem Laden der Metadaten reserviert. Staffeln bevorzugen
eigene Miniaturen oder vorhandene horizontale Bilder der uebergeordneten Serie;
Musikalben und andere Kartentypen behalten ihr natives Format. Originale
Staffel-Verknuepfungen bleiben erhalten.
Die Bilddaten fuer sichtbare Reihen werden in begrenzten Schritten vervollstaendigt.
Bereits zwischengespeicherte Titel belegen nicht mehr die Anfrageplaetze fuer
spaetere Filme. Pro Metadatenanfrage bleiben hoechstens 24 fehlende Titel erlaubt;
der aktuelle Arbeitsvorrat ist auf 128 Titel begrenzt. Vorhandene Miniaturbilder
werden so auch in spaeteren Filmreihen und beim seitlichen Weiterschieben geladen. Der vorhandene native
Bildtyp wird in den nativen Bibliotheksansichten standardmaessig auf Miniatur
statt Primaer gesetzt, einschliesslich Sammlungen, Favoriten und weiterer Tabs.
Bestehende Primaer-Einstellungen werden einmal pro Ansicht und Browser uebernommen,
auch wenn die fruehere Filme-/Serien-Vorgabe schon gespeichert war. Sortierung,
Filter, Titelanzeige und bewusst eingestellte Listenlayouts bleiben erhalten.
Andere vorhandene Bildtypen und jede spaetere manuelle Auswahl (auch Primaer)
bleiben erhalten. Neue Folgenansichten behalten ihre native Seriensortierung,
Lieder ihre Listenansicht. Die Vorgabe wird vor dem ersten nativen Rendern gesetzt
und gilt fuer diesen Webclient; native TV-Apps haben eigene Ansichtseinstellungen.

Die native Buchstabenleiste markiert die aktuelle Auswahl in Cinema-Rot. Beim
Verlassen oder erneuten Aufrufen einer Bibliotheksansicht wird nur der Buchstaben-
filter aufgehoben und dessen Seitenposition auf den Anfang gesetzt. Das gilt
auch fuer Wechsel zwischen Bibliotheken/Tabs sowie Browser-Zurueck. Sortierung,
andere Filter und die ausgewaehlte Darstellung bleiben erhalten. Ein Infofenster,
das die aktuelle Seite offen laesst, und Aenderungen innerhalb derselben Ansicht
loeschen die Buchstabenauswahl nicht.

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
docker build --platform linux/amd64 -t jellyfin-native-security:12.4-preview27 .
```

Der Build prueft die Quellpruefsummen, kompiliert die Linux-x64-Laufzeit und
uebernimmt Webclient und FFmpeg aus dem fest auf Digest gebundenen offiziellen
12.4-Image. Saemtliche zugehoerigen geaenderten Serverquellen sind ebenfalls
im Image unter `/usr/share/jellyfin-native-source/` enthalten.

Der GitHub-Build prueft 260 isolierte Cinema-Browserfaelle, davon 34 fuer
mobile Seitenwechsel und Kacheln sowie 28 fuer die originalgetreue
Kopf-/Werkzeugleistenstruktur. Dazu kommen 186 API-Tests unter
Linux. Dazu kommen die
originalen Erstinstallations-/Browserpruefungen, acht Compose-Modelle und
fuenf rohe CasaOS-Port-Importfaelle. Details und Grenzen stehen in den
Pruefergebnissen des jeweiligen Releases; `PRUEFBERICHT.txt` und
`PROXY-HINWEISE.txt` dokumentieren zusaetzlich die frueheren Serverpruefungen.
Der Build fuehrt einen getrennten echten Docker-Start
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
