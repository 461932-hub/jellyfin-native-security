Preview 22: allgemeine Neuinstallation mit originalem Einrichtungsassistenten.

Die CasaOS-Vorlagen enthalten keine feste private IP, keinen festen Testcontainer
und keine Verknuepfung auf bereits eingerichtete Testdaten. Neue Importe erhalten
von CasaOS eine eigene AppID, eigene Konfiguration und eigenen Cache. Updates
erfolgen dagegen an der vorhandenen App und erhalten deren Daten. Im Image liegen
keine eingerichteten Benutzer oder Bibliotheken. Die Ladeanzeige blockiert
unangemeldete eigenstaendige Assistenten-/Anmeldeseiten nicht mehr.

Der originale Jellyfin-Assistent wird im echten Browser gegen zwei leere
Container durchlaufen: eigener Servername, Sprache, Benutzer samt Passwort,
leere Bibliothek, Metadatenland/-sprache, Fernzugriff und Abschluss. Die zweite
Instanz bleibt unabhaengig und unkonfiguriert. Nach einem Neustart bleibt die
erste eingerichtet. Der Bericht und ein Bild der echten Startseite liegen bei.

Wieder enthalten bzw. ergaenzt: PUID, PGID, TZ, HTTP-/HTTPS- sowie korrekte
UDP-Ports, Medienordner, Intel-/AMD-Geraetefreigabe, Ressourcen und native
Neustart-/Netzeinstellungen. CPU- und Parallelvorlagen ermoeglichen Rechner
ohne /dev/dri bzw. weitere Instanzen ohne bereits belegte Zusatzports.
PUID/PGID, Docker-Zusatzgruppen und Gruppen durchgereichter Rendergeraete
werden beim Rechteabwurf korrekt uebernommen. Eigene optionale Startskripte
laufen unter PUID/PGID. Keine root-Hooks, keine pauschalen Geraete-Rechteaenderungen.
Ein Lock verweigert gleichzeitige Konfigurationsnutzung zwischen neuen Containern.

Die bereits vorhandenen Sicherheitskorrekturen fuer Bilder/Videos und das
Cinema-Design bleiben enthalten. Keine automatische Ableitung einer TV-
Wiedergabeadresse aus Host-Headern. Betreiber tragen ihre eigene vertrauenswuerdige
Adresse ein; unverschluesselte TV-Ausnahmen sind in den oeffentlichen Vorlagen aus.
Normale native Menues, Bibliotheken, Player, Rechte und der Setup-Assistent
werden nicht ersetzt. Medienordner koennen wie beim Original beschreibbar oder
in CasaOS auf Wunsch schreibgeschuetzt eingebunden werden.

Image: ghcr.io/461932-hub/jellyfin-native-security:12.4-preview22
Neuinstallation: passende CasaOS-Datei aus diesem Release importieren.
Update: vorhandene App behalten und nur Image-Tag aendern; vorher sichern.
Anleitung: INSTALLATION.md. Keine Aenderungen an laufenden Nutzer-Servern.

Pruefungen: 198 isolierte Cinema-Browserfaelle, 186 API-Tests, echter Docker-Start,
7 TV-Identitaetsfaelle, 8 Compose-Modelle und zusaetzliche echte Erstinstallations-
/Browserpruefungen. Hardwaregruppen werden mit einem kuenstlichen Character-Device
getestet, nicht mit einer realen GPU. Kein Live-CasaOS-UI-, physischer Fire-TV-
oder neuer Codec-Test dieses Releases. Linux/amd64; kein ARM-/Raspberry-Pi-Image.
Community-Testkandidat, keine offizielle Jellyfin-Freigabe und keine pauschale
Sicherheitsgarantie. Ein stabiler oeffentlicher Produktrelease braucht zusaetzlich
reale Betreiber-/Hardwaretests.
