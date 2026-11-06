Preview 27: Kompakte Kopf- und Werkzeugleisten in der Handy-App.

Die obere Leiste beruecksichtigt die app-eigene Zurueck-Taste. Zusammen mit
Menue, Glocke, SyncPlay, Uebertragen, Suche und Profil passt sie bei schmalen
Ansichten in eine Zeile. Der Profilknopf bricht nicht mehr alleine nach unten um.
Unter Bibliotheksname und Anzahl bleibt eine vollstaendige Werkzeugzeile fuer
Abspielen/Zufall, Filter, Sortierung, Ansicht und beide Blaettertasten.

Die Korrektur reduziert bei schmalen Bildschirmen die Desktop-Abstaende,
beruecksichtigt die zusaetzlichen Kindraender des originalen MUI-Stacks und
passt die Werkzeuggroessen an die verfuegbare Breite an. Alle originalen
Bedienelemente und ihre Handler bleiben bestehen. Das Zweispaltenraster und
die grosse Vorschau bleiben erhalten. Servercode und Sicherheitskorrekturen
werden nicht geaendert. Webdateien: Cachekennung v23.

Image: ghcr.io/461932-hub/jellyfin-native-security:12.4-preview27
Update: BESTEHENDE CasaOS-App bearbeiten und nur den Image-Tag aendern.
Kein neuer YAML-Import. Danach die Handy-App vollstaendig schliessen und neu
oeffnen. Vorhandene Datenordner, Ports, Konten und Einstellungen beibehalten.

Pruefumfang: 260 isolierte Cinema-Browserfaelle einschliesslich der bisherigen
34 Handyfaelle und 28 neuer Kopf-/Werkzeugleistenfaelle. Der neue Test bildet
die originale MUI-Struktur mit zusaetzlicher App-Zurueck-Taste, Profilhuelle,
Kindraendern und Werkzeuggruppen nach. Preview26 reproduziert darin den
Profil-Umbruch. Die Korrektur prueft 320/360/390 Pixel bei / und /media sowie
groessere Bildschirme und einzeln bedienbare Tasten.

Zusaetzlich wird die echte React/MUI-Oberflaeche des gebauten Images auf einer
frischen Docker-Testinstanz nach regulaerer Anmeldung geprueft: App-Zurueck-
Taste ueber das NativeShell-Merkmal nachstellen, Leisten bei 320/360/390 Pixeln
vermessen und das Profilmenue oeffnen. Diese beiden Faelle ergaenzen die sechs
bestehenden originalen Browser-Setupfaelle. Hinzu kommen 186 API-Tests,
Dockerstart, TV-Identitaets-, Compose-, CasaOS-Portimport- und Installationsfaelle.

Die Browserpruefungen verwenden kuenstliche Konten und Daten. Ein physischer
Android-/iOS-App-, Fire-TV-, GPU- oder CasaOS-Gesamtoberflaechentest ist damit
nicht ersetzt. Linux/amd64; Community-Testkandidat, keine offizielle Jellyfin-
Version. Kein laufender Benutzer-Server wird automatisch aktualisiert.
