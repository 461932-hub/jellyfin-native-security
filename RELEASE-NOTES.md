Preview 10: originales Cinema-Logo auf Hauptseite und Verwaltungsuebersicht.

Das unveraenderte PNG-Wortlogo aus dem vorhandenen Cinema-Paket ersetzt den
bisherigen roten Schrift-Ersatz. Das Logo wird lokal als Webdatei ausgeliefert;
es benoetigt weder fremde Bildserver noch eine Anmeldung.

In der Verwaltungsuebersicht stehen Logo und tatsaechliche native Versionsnummer
in einer Zeile. Der Servername wird dort nur visuell ausgeblendet; Konfiguration,
Zugaenglichkeit und die originale Verknuepfung zur Startseite bleiben erhalten.
Die Gestaltung ist direkt im Webpaket enthalten, weil die Verwaltungsoberflaeche
servereigenes Branding-CSS nicht laedt.

Beide Cinema-Schliessanimationen, Hero-Einrasten und responsive Bilddarstellung
aus Preview 9 bleiben bestehen. Native Funktionen, Player und Medienrechte
werden durch die Logo-Aenderung nicht geaendert.

Vorhandene CasaOS-Test-App aktualisieren:
ghcr.io/461932-hub/jellyfin-native-security:12.4-preview10
Vorhandene Ports und Ordner beibehalten. Anschliessend Strg+F5.

Pruefung: originale PNG-Datei bytegleich, lokale Paketvorschau auf echter Haupt-
und Verwaltungsseite, originale Navigation und Versionsanzeige, bestehende
Browser-/API-/Docker-Pruefungen. Kein neuer physischer TV-Test.
Eigener Testkandidat, keine offizielle Jellyfin-Veroeffentlichung.
