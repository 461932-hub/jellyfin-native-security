Preview 28: Geschuetzte Cover in der Fire-TV-Filmliste

Bei einer umfangreichen Filmliste konnten Metadaten und Besetzung den
Durchlauf des Bildfilters fruehzeitig beenden. Spaetere Kacheln bekamen
dann keine Bildberechtigung und der Server antwortete beim Laden mit 401.
Die Filmseite lud den einzelnen Titel separat.

Der Filter verarbeitet die Bilder aller Titel einer Listenseite vor den
Bildern der Besetzung. Er durchlaeuft nur die vorgesehenen Bildfelder.
Berechtigungen gelten weiterhin zehn Minuten fuer das jeweilige Bild.
Bei einer HTTP-Verbindung im Heimnetz gilt die vorhandene Einstellung
JELLYFIN_SecureMedia__AllowInsecureHttpImages.

Image: ghcr.io/461932-hub/jellyfin-native-security:12.4-preview28
Update: Die bestehende CasaOS-App bearbeiten, Tag aendern und speichern.
Anschliessend Jellyfin auf dem Fire TV vollstaendig schliessen und neu oeffnen.

Die Regressionstests pruefen 100 Filme pro Antwort mit umfangreicher
Besetzung. Der Docker-Test prueft einen autorisierten Coverabruf und die
Ablehnung ohne Bildberechtigung, fuer einen anderen Bildtyp, bei fehlenden
Bibliotheksrechten und nach Abmeldung. Der Teststand nutzt synthetische
Daten. Die Korrektur muss nach der Installation am Fire TV bestaetigt werden.
