Preview 12: Nachbarkachel schliesst die alte Vorschau sofort wie in Cinema.

Beim Wechsel zu einem anderen Titel beginnt die alte schwebende Vorschau nun
sofort ihre Rueckanimation. Bisher blieb sie bis zum Oeffnen der neuen Vorschau
stehen. Das gilt sowohl seitlich als auch beim Wechsel zur Reihe darunter.
Die originale Schliessanimation dauert weiterhin 260 ms; die neue Kachel hat
ihre eigene Oeffnungsverzoegerung von 550 ms. Ein Verlassen ohne Nachbarkachel
behaelt die kurze 140-ms-Toleranz. Vorschauknopfe bleiben erreichbar.

Ausstehende Oeffnungen werden beim Weiterbewegen verworfen. Uebergaenge zwischen
Kindern derselben Kachel starten die Wartezeit nicht erneut. Alte Schliess-Timer
koennen keine neu geoeffnete Vorschau mehr schliessen.

Miniatur-Vorgaben aus Preview 11, originale Menues, Player und Medienrechte
bleiben erhalten. Keine Aenderung an nativen TV-Apps.

Vorhandene CasaOS-Test-App aktualisieren:
ghcr.io/461932-hub/jellyfin-native-security:12.4-preview12
Ports und Ordner beibehalten. Anschliessend Strg+F5.

Pruefung: 64 Browserfaelle fuer / und /media, einschliesslich echter
Zeigerbewegungen zu seitlichen und darunterliegenden Kacheln, abgebrochener
Oeffnung und erreichbarer Vorschauknopfe. Zusaetzliche Pruefung auf der echten
nativen LAN-Oberflaeche mit lokalen Vorschau-Dateien; keine Wiedergabe gestartet.
Bestehende API-, TV-Identitaets- und Docker-Pruefungen im Veroeffentlichungslauf.
Eigener Testkandidat, keine offizielle Jellyfin-Veroeffentlichung.
