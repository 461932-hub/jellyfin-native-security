# Installation von Jellyfin Cinema

Diese Community-Version fuer **Linux/amd64** enthaelt das Cinema-Design und
die zusaetzlichen Medien-/Bild-Anmeldepruefungen. Konten und Bibliotheken
richtet jeder Betreiber selbst im **originalen Jellyfin-Assistenten** ein.
Das Image enthaelt keine eingerichtete Konfiguration und kein vorgegebenes
Administratorpasswort. Andere Architekturen sind in diesem Image nicht enthalten.

## Neu in CasaOS installieren

1. Eine passende Datei aus dem Release herunterladen:
   - **CasaOS-Import.yaml** fuer Intel/AMD mit vorhandenem `/dev/dri`.
   - **CasaOS-Import-CPU.yaml** fuer Rechner ohne dieses Grafikgeraet.
   - **CasaOS-Import-Parallel.yaml** fuer eine weitere Intel/AMD-Instanz,
     wenn Zusatzports der ersten Instanz bereits belegt sind.
2. CasaOS: **+ -> Benutzerdefinierte App installieren -> Importieren**.
3. Datei auswaehlen. Eigenen Titel, Benutzer-ID `PUID`, Gruppen-ID `PGID`,
   Zeitzone `TZ`, Medienpfade und freie Hostports pruefen. CasaOS vergibt
   ohne festgelegtes `name` einen eigenen App-Namen. Die numerischen
   Hostport-Vorgaben sind 8096 (Standard/CPU) bzw. 8100 (Parallel).
   Falls belegt, Hostport und Web-UI-Port auf dieselbe freie Zahl aendern.
   Der interne Container-Port bleibt 8096.
4. Die Hostpfade fuer `/config` und `/cache` muessen unter dem neuen
   `/DATA/AppData/<AppID>/` liegen. **Keine Datenordner eines anderen laufenden
   Servers eintragen.** `/Media` und `/HDD` duerfen auf eigene Medien zeigen.
5. Installieren und die neue App-Kachel oeffnen. Die Adresse ist
   `http://<SERVER-IP>:<GEWAEHLTER-HOSTPORT>/web/`.
6. Im originalen Assistenten Sprache, Servername, Administrator samt Passwort,
   Bibliotheken und Fernzugriff einrichten. Danach regulaer anmelden.

Der erste Import hat keine bestehenden Benutzer. Wird sofort eine Anmeldung
oder eine vorhandene Bibliothek angezeigt, zuerst den Hostpfad von `/config`
pruefen: der Server hat dann bereits eingerichtete Daten geladen. Ein privates
Browserfenster schliesst zusaetzlich alte Browser-Sitzungen als Ursache aus.
Nicht `IsStartupWizardCompleted` in einer produktiven Datenbank zuruecksetzen
und keine alten Daten loeschen. Einen neuen **leeren** Ordner verwenden.

Der alte CSS-Block `BEGIN JELLYFIN NATIVE CINEMA v1` wird fuer eine frische
Installation nicht benoetigt; das Design liegt bereits im Webclient des Images.

## Weitere Instanz oder bestehende Instanz aktualisieren

Ein **neuer Import** erhaelt durch CasaOS einen neuen App-Namen und eigene
`$AppID`-Datenpfade. Einen eigenen Titel und freien HTTP-Port waehlen. Die
Parallelvorlage kopiert keine festen HTTPS-/UDP-Hostports; sie koennen spaeter
einzeln hinzugefuegt werden. Ohne `/dev/dri` dort die Geraetefreigabe entfernen
oder die CPU-Vorlage verwenden und schon belegte Zusatzports entfernen.
Keine festen alten `container_name`, `x-casaos.id` oder Konfigurationspfade
uebernehmen. Medienordner koennen bei passenden Berechtigungen geteilt werden.

Zum **Aktualisieren** dagegen die vorhandene CasaOS-App bearbeiten: Image
`ghcr.io/461932-hub/jellyfin-native-security`, Tag `12.4-preview24`.

Preview24 aktualisiert die grosse Vorschau auch beim Wiedereroeffnen
zwischengespeicherter Seiten auf Handys. Nach dem Image-Update die Handy-App
vollstaendig schliessen und neu oeffnen. Bestehende Benutzer und Bibliotheken
liegen weiterhin in den vorhandenen Datenordnern; zum Aktualisieren die
bestehende CasaOS-App bearbeiten und nur den Image-Tag aendern.
Vorhandene Namen, Ports, Ordner und eigene Einstellungen erhalten, danach
aktualisieren und den Browser mit Strg+F5 neu laden. Nicht erneut importieren,
wenn die vorhandene Installation aktualisiert werden soll. Vorher sichern.

Ein Konfigurations-Lock verhindert ab dieser Version zwei neue Container mit
derselben Datenbank (Exitcode 75). Aeltere Images verwenden diesen Lock nicht;
gemeinsame Ordner mit alten laufenden Containern bleiben deshalb unzulaessig.

## Die originalen Container-Moeglichkeiten

| Einstellung | Bedeutung |
| --- | --- |
| PUID / PGID | Benutzer-/Gruppen-ID fuer Server, Medien und Datenordner; Vorgabe 1000/1000, jeweils positiv |
| TZ | Eigene Zeitzone, beispielsweise `Europe/Berlin` |
| 8096/TCP | Originaler HTTP-Web-/API-Port; Hostport frei waehlbar |
| 8920/TCP | Originales HTTPS; erst nach eigener Zertifikateinrichtung aktiv |
| 7359/UDP | Serversuche der Clients; fester Hostport pro Rechner nur einmal belegbar |
| 1900/UDP | SSDP fuer ein installiertes DLNA-Plugin; Multicast kann Host-Netzwerk erfordern |
| /config | Eigene Konfiguration und Datenbank; bleibt bei Updates erhalten |
| /cache | Eigener Cache und temporaere Umwandlungsdaten |
| /Media, /HDD | Eigene Medienpfade; Schreibschutz laesst sich in CasaOS aktivieren |
| Devices | Eigene vorhandene Grafik-/Videogeraete durchreichen |
| Network / Resources | Netzmodus, CPU und Speicher bleiben in CasaOS einstellbar |
| Restart policy | Vorgabe `unless-stopped`, in CasaOS veraenderbar |
| Command | Eigene Jellyfin-Startargumente bleiben moeglich |

Die Vorlagen setzen keine feste Speicherobergrenze, nur eine Reservierung
von 256 MiB. Die Regler in CasaOS koennen wie gewohnt angepasst werden.
Medien sind wie bei ueblichen Originalvorlagen beschreibbar. Fuer reine
Wiedergabe koennen sie explizit schreibgeschuetzt eingebunden werden.
Jellyfins Benutzerrechte werden dadurch nicht umgangen.

## Hardwarebeschleunigung

Die GPU-Vorlage enthaelt die CasaOS-Geraetezeile **Host `/dev/dri` ->
Container `/dev/dri`**. Dieser Pfad muss auf dem Host vorhanden sein.
Render-/Video-Gruppen der durchgereichten Geraete werden beim Rechteabwurf
beibehalten. Docker-`group_add` bleibt ebenfalls erhalten. Rechte und Besitzer
der Hostgeraete werden nicht umgeschrieben; `privileged` ist nicht erforderlich.
Danach die zur eigenen Grafik passende Hardwarebeschleunigung in Jellyfin
unter Wiedergabe/Transkodierung einschalten und unterstuetzte Codecs pruefen.

Die Raspberry-Pi-Pfade `/dev/vcsm`, `/dev/vchiq`, `/dev/video10` bis
`/dev/video12` und `/opt/vc/lib` aus manchen CasaOS-Vorlagen sind keine
allgemeinen AMD-/Intel-Geraete. Dieses **amd64-Image** ist kein Raspberry-Pi-
Image. Fehlende Geraetepfade nicht blind durchreichen. NVIDIA erfordert die
eigene passende Container-Runtime/GPU-Freigabe; die Intel-/AMD-Vorlage richtet
diese nicht automatisch ein. Ein echter GPU-/Codec-Test bleibt Aufgabe der
jeweiligen Hardwareinstallation. Der CI-Test prueft Geraetezugriffsrechte mit
einem kuenstlichen Character-Device und behauptet keine echte GPU-Messung.

Ein optionaler Mount auf `/custom-cont-init.d` unterstuetzt administratorseitige
`.sh`-Startskripte. Diese laufen vor Jellyfin unter PUID/PGID, nicht als root,
und ein Fehler stoppt den Start. Root-Installationsskripte fuer das LinuxServer-
S6-Image sind damit nicht automatisch kompatibel. Cinema braucht keinen Hook.
Der Fork verwendet weiterhin die offizielle Jellyfin-Basis samt FFmpeg;
Konfigurationsordner aus dem LinuxServer-Image nicht ungeprueft uebernehmen.

## TV-Kompatibilitaet und oeffentlicher Zugriff

Anmelde- und Bibliothekspruefungen bleiben unabhaengig von den folgenden
Kompatibilitaetsoptionen aktiv. Die oeffentlichen Vorlagen enthalten keine
Server-IP und erlauben nicht automatisch unverschluesselte TV-Berechtigungen.

Fuer den begrenzten Direct-Play-Pfad von **Android TV 0.19.10** unter CasaOS
`JELLYFIN_SecureMedia__PlaybackBaseUrl` auf die eigene vollstaendige,
vertrauenswuerdige HTTPS-Adresse mit Port und optionalem Basispfad setzen.
Beispiel: `https://media.example.org/jellyfin`. Anfrage-Host oder beliebige
Forwarded-Header ersetzen diese Konfiguration nicht. Bei TLS am Reverse-Proxy
muss Jellyfin dessen tatsaechliche Adresse unter den bekannten Proxys fuehren.
Ohne diese Adresse wird der spezielle TV-Direct-Play-Pfad nicht erzeugt;
die App kann auf Streaming/Remux ausweichen und eine Player-Meldung anzeigen.

Nur fuer einen **bewusst gewaehlt unverschluesselten LAN-Betrieb** dieselbe
Variable auf die eigene HTTP-Adresse setzen und ausdruecklich
`JELLYFIN_SecureMedia__AllowInsecureHttpPlayback=true` sowie fuer TV-Cover
`JELLYFIN_SecureMedia__AllowInsecureHttpImages=true` setzen. Dabei werden
Anmeldung und Berechtigungen unverschluesselt uebertragen. Eine private IP
aktiviert diese Ausnahmen nicht. Bei oeffentlichem Zugriff HTTPS verwenden
und beide Ausnahmen auf `false` lassen. Die Bildoption benoetigt fuer sich
keine Wiedergabe-Basisadresse; das TV-Geraet muss am Server angemeldet sein.

Die Bild-/Wiedergabeberechtigungen bleiben zeitlich und auf den jeweiligen
Inhalt begrenzt; sie sind trotzdem Geheimnisse. Proxy-Logs ohne unmaskierte
Abfrageparameter fuehren, wie in [PROXY-HINWEISE.txt](PROXY-HINWEISE.txt)
beschrieben. Keinen Sicherheitsfilter abschalten, um einen Client zu reparieren.

## Docker Compose ohne CasaOS

`compose.yaml` verwenden. Der Projektname bestimmt die Host-Datenordner:

```sh
docker compose -p mein-jellyfin -f compose.yaml up -d
```

Fuer eine weitere Instanz einen anderen Projektnamen und freie Hostports
waehlen. Den numerischen `published`-Wert der HTTP-Zuordnung und den Web-UI-Port
bei Bedarf gemeinsam auf einen freien Host-Port aendern. Andere feste Zusatzports muessen
ebenfalls frei sein oder aus der zweiten Datei entfernt werden. Die GPU-
Freigabe kann wie oben ergaenzt werden. Bestehende Daten werden nie absichtlich
geloescht oder zurueckgesetzt.

## CasaOS zeigt NaN im Portfeld

Alte Preview22-Dateien enthielten einen Docker-Portplatzhalter, den der
CasaOS-Importdialog vor der Variablenaufloesung falsch als Zahlen zerlegen
konnte. Ab Preview23 sind die Portfelder explizite numerische YAML-Objekte
wie in der originalen CasaOS-Vorlage. Standard: Host 8096 -> Container 8096,
Parallel: Host 8100 -> Container 8096, jeweils TCP. Der Web-UI-Port stimmt
mit dem vorgeschlagenen Host-Port ueberein. Eine alte geoeffnete Importmaske
schliessen und die neue Datei importieren; alternativ dort Container-Port
8096 und einen freien Host-/Web-UI-Port eintragen.

## Nachweise und Grenzen

Der Release enthaelt die maschinenlesbaren Pruefberichte: Compose-Aufloesung
fuer getrennte App-IDs, Start mit leeren Ordnern, vollstaendiger originaler
Assistent im Browser, getrennte Konten/Datenbanken, Neustart, Konfigurations-
Lock, PUID/PGID, Zusatz-/Geraetegruppen, Hooks und anonyme Bild-/Videosperren.
Dazu kommen die bestehenden Browser-, API- und TV-Identitaetspruefungen.
Die Windows-Arbeitsumgebung betreibt kein lokales Docker; echte Container-
Pruefungen laufen unter Linux in CI. Ein Live-Test der CasaOS-Oberflaeche und
ein physischer Fire-TV-/GPU-Test dieses Releases sind damit nicht ersetzt.

Quellen fuer die Installationsgrundlagen:

- [CasaOS: AppID-Aufloesung und automatische Namen](https://github.com/IceWhaleTech/CasaOS-AppManagement/blob/main/service/compose_app.go)
- [Jellyfin: Containerinstallation](https://jellyfin.org/docs/general/installation/container/)
- [Jellyfin: AMD-Geraete und Gruppen](https://jellyfin.org/docs/general/post-install/transcoding/hardware-acceleration/amd/)
- [CasaOS: urspruengliche Jellyfin-Vorlage](https://github.com/IceWhaleTech/CasaOS-AppStore/blob/main/Apps/Jellyfin/docker-compose.yml)
