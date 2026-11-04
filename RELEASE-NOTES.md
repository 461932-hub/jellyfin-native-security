Preview 18: Benachrichtigungsglocke aus Cinema im nativen Header.

Die Glocke zeigt bis zu fuenf neue Filme aus den letzten fuenf Tagen, mit
Filmbild, Name und Zeitangabe. Der rote Zaehler steht fuer ungesehene Eintraege.
Beim Oeffnen werden sie fuer das aktuelle Server-/Benutzerpaar als gesehen
markiert. Ein Klick oeffnet das vorhandene Cinema-Infofenster. Neue Eintraege
werden bei sichtbarem Client einmal pro Minute geladen. Originale SyncPlay-,
Cast-, Such- und Kontoknoepfe bleiben erhalten.

Nur gleiche Serveradresse und aktuelle Anmeldung. Kein Zugangstoken in Bild-
oder Anfrageadressen. Anmeldung und Bibliotheksrechte bleiben erforderlich.
Abmeldung und Kontowechsel entfernen Eintraege und brechen laufende Anfragen
ab. Abgewiesene Anfragen leeren die Liste. Pro Glocke laeuft hoechstens eine
Anfrage, mit 15 Sekunden Zeitlimit und mindestens fuenf Sekunden Abstand.
Gespeichert wird nur der Gesehen-Zeitpunkt, getrennt nach Server und Benutzer.
Originaldarstellung mit cinema=off schaltet auch die Glocke ab.

Vorhandene CasaOS-Test-App aktualisieren:
ghcr.io/461932-hub/jellyfin-native-security:12.4-preview18
Ports und Ordner beibehalten. Anschliessend Strg+F5.

Pruefung: 90 bestehende Browserfaelle und 36 neue Benachrichtigungsfaelle fuer
/ und /media. Neu: Fuenf-Tage-Filter, Duplikate, ungueltige Daten, inerte Namen,
Anfragegrenzen, Gesehen-Zaehler, Nachladen, Hintergrundpause, native Header-
Wechsel, kleine Fenster, Kontowechsel, verweigerter Zugriff, Abmeldung mit
laufender Anfrage, fremde API-Adressen und Originalmodus.
Lokale native Oberflaeche: Glocke neben originalen Knoepfen, unabhaengiger
API-Abgleich, Oeffnen/Schliessen und 390-Pixel-Fenster. Das verwendete Testkonto
hat aktuell keine Filme im Fuenf-Tage-Zeitraum; der positive Fall ist isoliert
geprueft. Keine Wiedergabe gestartet oder Servereinstellungen geaendert.
Die API-, TV-Identitaets- und Containerpruefungen laufen vor Veroeffentlichung.
Eigener Testkandidat, keine offizielle Jellyfin-Veroeffentlichung.
