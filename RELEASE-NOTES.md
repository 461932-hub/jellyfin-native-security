Preview 15: Rote Buchstabenauswahl mit Zuruecksetzen beim Seitenwechsel.

Die Buchstabenleiste zeigt die aktive Auswahl in Cinema-Rot. Beim Wechsel von
Serien zur Startseite oder zu einer anderen Bibliothek werden die Markierung
und der tatsaechliche Alphabetfilter gemeinsam aufgehoben. Auch alte gespeicherte
Buchstaben der Zielansicht werden entfernt. Browser-Zurueck und Bibliotheks-/
Tabwechsel werden beruecksichtigt. Ein neuer Seitenaufruf startet ohne alten
Buchstabenfilter.

Dafuer wird Jellyfins eigener Alphabet-Ansichtswert zurueckgesetzt, einschliesslich
der Seitenposition. Sortierung, andere Filter, Titelanzeige und Bildtyp bleiben
erhalten. Verhindert ein Infofenster die Linknavigation oder bleibt man in
derselben Bibliotheksansicht, bleibt die aktive Buchstabenauswahl erhalten.
Die originalen Buchstabenknopfe und Medienabfragen bleiben angebunden.

Vorhandene CasaOS-Test-App aktualisieren:
ghcr.io/461932-hub/jellyfin-native-security:12.4-preview15
Ports und Ordner beibehalten. Anschliessend Strg+F5.

Pruefung: 86 Browserfaelle fuer / und /media, einschliesslich roter Markierung,
verhindertem Detail-Link, gleichbleibender Ansicht, Navigation ohne Hash-Ereignis,
Startseite, Serien/Filme, altem Zielfilter, Browser-Zurueck und erhaltener
Sortierung/weiteren Filtern. Echte native Oberflaeche: A filtert 62 Serien auf
einen Eintrag; nach dem Wechsel und der Rueckkehr erscheinen wieder alle 62.
Originale Kopfzeilenlinks, Filmansicht und Auswahl # mit Browser-Zurueck geprueft.
Keine Wiedergabe gestartet. Bestehende API-, TV-Identitaets- und Docker-Pruefungen.
Eigener Testkandidat, keine offizielle Jellyfin-Veroeffentlichung.
