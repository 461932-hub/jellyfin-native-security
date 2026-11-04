Preview 21: beim Blaettern in der Filmliste bleiben.

Wenn die grosse Vorschau bereits nach oben weggescrollt ist, zeigen die nativen
Vorheriges-/Naechstes-Pfeile direkt die erste Reihe der neuen Katalogseite.
Der native Sprung zum Dokumentanfang fuehrt nicht erneut zur Vorschau, auch
bei verzoegertem Laden oder einem spaeten Scroll-Reset nach dem Rendern.
Native Klick-Handler, Tastaturbedienung und deaktivierte Zustaende bleiben
unveraendert. Seitennavigation bei sichtbarer Vorschau bleibt ebenfalls nativ.

Bewusstes Scrollen, Beruehren oder Scrolltasten beenden die Positionssicherung.
Hochscrollen kann damit weiterhin zur grossen Vorschau zurueckkehren. Laden,
Bibliothekswechsel, Abmeldung und eine feste Zeitgrenze beenden die Sicherung;
es wird weder eine neue Route noch ein anderes Benutzerkonto festgehalten.
Dokument- und verschachtelte Seitenscroller sowie kurze letzte Seiten werden
unterstuetzt. Spaet gemountete native Kataloge erhalten nun ebenfalls die
responsive Vorschauhoehe und den bestehenden Uebergang per Mausrad.

Vorhandene CasaOS-Test-App aktualisieren:
ghcr.io/461932-hub/jellyfin-native-security:12.4-preview21
Ports und Ordner beibehalten. Anschliessend Strg+F5.

Pruefung: 194 Browserfaelle (90 Darstellung, 36 Glocke, 34 Tagesauswahl,
14 Ladefolge, 20 Katalog-Seitenwechsel) fuer / und /media. Die neuen Faelle
pruefen sofortige und verzoegerte native Scroll-Resets, beide Richtungen,
Tastatur, tieferes Scrollen, eine kurze letzte Seite, sichtbare Vorschau,
Abbruch durch bewusste Eingabe, Route und Abmeldung, verschachtelte Scroller
und die abgeschaltete Cinema-Darstellung. Zusaetzlich vier Pruefungen mit
den echten nativen Pfeilen am LAN-Testserver: Vorwaerts und rueckwaerts kein
Vorschaubild in den erfassten Frames; bewusste Rueckkehr per Mausrad moeglich.
Eigene Webdateien dabei nur im Diagnosebrowser, keine Servereinstellungen
geaendert oder Wiedergabe gestartet. API-, TV- und Containerpruefungen vor
Veroeffentlichung. Keine neuen Medien-/Authentifizierungsregeln.
Eigener Testkandidat, keine offizielle Jellyfin-Veroeffentlichung.
