Preview 17: aufgeraeumte Bibliotheks-Werkzeugleiste in der weissen Cinema-Variante.

"Alle abspielen" und die Zufallspfeile bilden wie im Original eine gemeinsame
Flaeche mit feiner Trennlinie. Die Flaeche ist weiss mit dunklem Text und dunklen
Symbolen. Filter, Sortierung, Ansichtsmenue und Seitenwechsel erhalten gleich
grosse runde Knoepfe, dezente Konturen und klare Abstaende. Deaktivierte Pfeile
bleiben erkennbar; Tastaturfokus und reduzierte Bewegung werden beruecksichtigt.
Auf kleinen Bildschirmen bleibt die native kompakte Darstellung erhalten,
bei Platzmangel brechen die Werkzeuggruppen um.

Die Aenderung betrifft nur das Aussehen der vorhandenen Werkzeuggruppen.
Native Buttons, Symbole, Beschriftungen, Menues und Funktionen bleiben aktiv.
Wiedergabe, Berechtigungen und Serverlogik wurden nicht geaendert.

Vorhandene CasaOS-Test-App aktualisieren:
ghcr.io/461932-hub/jellyfin-native-security:12.4-preview17
Ports und Ordner beibehalten. Anschliessend Strg+F5.

Pruefung: native Filme-Werkzeugleiste mit verbundenem Abspielknopf, originalen
Filter-/Sortier-/Ansichtsmenues und funktionierendem Vor-/Zurueckblaettern.
Alle Ziele passen bei 1920, 1280, 800, 390 und 320 Pixeln Breite in das Fenster.
Keine Wiedergabe gestartet, keine Einstellungen auf dem Server geaendert.
Die bestehenden Browser-, API-, TV-Identitaets- und Containerpruefungen laufen
vor der Veroeffentlichung. Keine neue physische TV-Wiedergabepruefung.
Eigener Testkandidat, keine offizielle Jellyfin-Veroeffentlichung.
