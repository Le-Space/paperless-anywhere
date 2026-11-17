# Map B — Lifecycle slice: today's UI → v0.2 places

Source: `B-lifecycle.md` (rows B-001 … B-291). Place codes: `places.md`.
One template in v0.2. Divergences of section 3.1 are settled to the safer behaviour:
- Start is disabled while backups are being read or unreadable (Übersicht behaviour), plus a retry button.
- "Sichern und beenden" is disabled while a backup runs (Übersicht behaviour).
- Fund offer appears for appPays OR leSpacePays (wider Übersicht condition, so nobody is left without an offer).
- VM log sits closed under G-ERR "Details" with one summary (Übersicht behaviour).
- Jetzt sichern, storage, trial restore: under Sicherung in both views. Certificate, export: reachable in both views.

Plain steps in Einfach (S-PROGRESS): start = 1 "Vorbereiten", 2 "Sicherheit prüfen", 3 "Paperless starten"; stop = 1 "Sichern", 2 "Kopien bestätigen", 3 "Maschine ausschalten".
"DE n" in the Change column = dead end n of section 3.3.

Columns: ID | Today | v0.2 place | Einfach | Technisch | Change

### 2.1 Lifecycle.svelte — overlay and "Übersicht" template

| ID | Today | v0.2 place | Einfach | Technisch | Change |
|---|---|---|---|---|---|
| B-001 | Vollbild "Erster Start" (FirstStart) | S-FIRST | plain: Stationen und Restzeit | yes; S-FIRST.T Teilschritte, Nachweis, Diagramm, Urkunde | same |
| B-002 | "Eigenes Image bauen? {Preis} werden … abgebucht" | G-DIALOG | plain: Preis in Euro oder "enthalten", zwei Knöpfe | yes; Credits, Wort "Image" | dialog; decline shows "Nicht gestartet" + Start button (DE 5) |
| B-003 | Status-Licht (LED) | S-STATUS | yes | yes | same |
| B-004 | "Einen Moment …" | S-STATUS | yes | yes | fixed dead end: load error gets "Noch einmal laden" (DE 1) |
| B-005 | "Paperless-ngx ist aus" | S-STATUS | yes | yes | merged with chip B-069 |
| B-006 | "Paperless-ngx startet" | S-STATUS | yes | yes | merged with chip B-069 |
| B-007 | "Paperless-ngx wird gesichert und beendet" | S-STATUS | yes | yes | merged with chip B-069 |
| B-008 | "Paperless-ngx wird ohne Sicherung gelöscht" | S-STATUS | yes | yes | merged with chip B-069 |
| B-009 | "Paperless-ngx läuft" | S-STATUS | yes | yes | merged with chip B-069 |
| B-010 | "Start unterbrochen" | S-STATUS, G-ALERT | yes | yes | merged with B-069, B-093; also alert |
| B-011 | "Der Start dauert etwa {10 min}." | S-STATUS | yes | yes | same |
| B-012 | "Lass dieses Fenster offen, bis … bereit ist." | S-PROGRESS | yes | yes | same |
| B-013 | "Erst die Sicherung, dann geht die Maschine aus." | S-PROGRESS | yes; own sentence when deleting without backup | yes | reworded: discarding says "Ohne Sicherung; die Maschine geht aus" (DE 14) |
| B-014 | Host-Name als Text | S-ACCESS | no; "Paperless öffnen" is enough | yes; technical line, host as link | merged with B-072 |
| B-015 | "Die Maschine läuft schon und kostet …" | G-ALERT, S-STATUS | yes; with "Start fortsetzen" and "Abbrechen und löschen" | yes | moved into the alert slot with buttons |
| B-016 | "Eigenes Image, gebaut am {Datum}." | S-NOTE, T-IMAGE | no | yes; build date, link to certificate | moved (note is .T) |
| B-017 | "Eine neuere Image-Version ist da." | S-NOTE | plain: "Ein Update ist da." | yes; image version | reworded |
| B-018 | "Jetzt neu bauen" | S-NOTE, T-IMAGE | plain: Knopf "Jetzt aktualisieren" | yes; also in T-IMAGE | merged with the setup's rebuild trigger |
| B-019 | "Neu bauen geht, wenn Paperless gestoppt ist." | S-NOTE | plain: Satz mit Knopf "Sichern und beenden" | yes; full procedure text linked in T-IMAGE | fixed dead end: button to S-STOP, then offers update (DE 19) |
| B-020 | "Beim ersten Start wird zuerst … Image gebaut" | S-STATUS, S-FIRST | plain: "Der erste Start dauert etwa 15 Minuten länger." | yes; names the image build | reworded |
| B-021 | "Öffentliches Image, zum Ausprobieren." | S-NOTE, T-IMAGE | plain: "Probebetrieb, ohne Sicherung" with Knopf "Eigene Maschine einrichten" | yes; public image, hash | reworded; consequence of B-260 made permanent |
| B-022 | "Letzte erfolgreiche Sicherung: {Zeit} · {n} Kopien" | B-LAST | yes; stale turns the Sicherung dot amber | yes; B-DETAIL.T below | moved to Sicherung; merged with B-106, B-183 |
| B-023 | "Letzte Sicherung beim Beenden: …" | B-LAST | yes | yes | moved |
| B-024 | "Auf Filecoin liegt eine neuere ({n} Kopien) …" | B-CHAIN.T | no | yes | moved |
| B-025 | "Noch keine erfolgreiche Sicherung bekannt" | B-LAST | yes; next to "Jetzt sichern" | yes | moved |
| B-026 | Fortschrittsbalken | S-PROGRESS | yes | yes | same |
| B-027 | "{Schritt} · noch etwa {N} min" | S-PROGRESS | plain: three plain steps and time left | yes; today's step label as technical line | reworded |
| B-028 | StartPanel (Start/Stopp) in Übersicht | S-PROGRESS.T | no; three plain steps instead | yes; full panel | moved out of the simple view; merged with B-100 |
| B-029 | "Paperless-ngx öffnen" | S-ACCESS | yes | yes | same |
| B-030 | "Mit der Sicherung kam ein weiterer Administrator …" | S-ACCESS | plain; with Knopf "Benutzer in Paperless ansehen" | yes | reworded; gets its own button |
| B-031 | "Die Sicherung ließ sich nicht wiederherstellen …" | G-ERR | plain; Knöpfe "Andere Sicherung wählen", "Löschen ohne Sicherung" | yes; Details with reason and error | merged with B-073; reason in Details, no "siehe Erweitert" (DE 13) |
| B-032 | "Anmeldung in Paperless-ngx" | S-ACCESS | yes | yes | same |
| B-033 | "Benutzer admin" | S-ACCESS | yes | yes | same |
| B-034 | "Passwort ••••••••" | S-ACCESS | yes | yes | same |
| B-035 | "Passwort anzeigen" / "Verbergen" | S-ACCESS | yes | yes | same |
| B-036 | "Kopieren" | S-ACCESS | yes | yes | fixed dead end: shows "Kopiert" or a failure sentence (DE 15) |
| B-037 | BackupNow ("Jetzt sichern") | B-LAST | yes | yes | moved to Sicherung, both views (DE 17) |
| B-038 | Evidence "Nachweis dieser VM" | S-PROOF | plain: one line "Geprüft: echte, verschlüsselte Maschine" | yes; S-PROOF.T full rows | merged with B-076 |
| B-039 | "Löschen ohne Sicherung" | S-STOP | yes | yes | same; "Jetzt sichern" stays visible beside it (DE 13) |
| B-040 | Confirm "Diese VM ohne Sicherung löschen? …" | G-DIALOG | plain: "Maschine", no MB figure | yes; MB of documents | dialog |
| B-041 | "Gerade antwortet keine Kopie der neuesten Sicherung …" | G-ALERT, S-STOP | plain; with Knopf "Sicherung ansehen" | yes | reworded: button to B-HEALTH instead of "Licht oben" |
| B-042 | "Sichern und beenden" | S-STOP | yes | yes | same; disabled while a backup runs |
| B-043 | "Prüfe, ob die Speicheranbieter antworten …" | S-STOP | plain: "Prüfe die Speicherorte …" | yes | reworded |
| B-044 | Storage (läuft) | B-STORAGE | yes | yes | moved to Sicherung (DE 17) |
| B-045 | TrialRestore (läuft) | B-TRIAL | plain: "Sicherung ausprobieren" | yes | moved to Sicherung, both views (DE 17) |
| B-046 | "Start fortsetzen" | S-STATUS, G-ALERT | yes | yes | same |
| B-047 | "Verwerfen (die VM dann … löschen)" | G-ALERT, G-DIALOG | plain: "Abbrechen und Maschine löschen" | yes; also "nur vergessen" with link to T-VMS | fixed dead end: one button also deletes the VM (DE 3) |
| B-048 | "… hier noch nicht fertig eingerichtet." | S-STATUS | yes | yes; missing items listed (B-098) | same |
| B-049 | "Einrichtung öffnen" | S-STATUS | yes; opens the guided setup | yes | same; no tab jump any more |
| B-050 | "Paperless anywhere starten" | S-STATUS | yes | yes | same |
| B-051 | "Sicherungen werden gelesen …" | S-RESTORE | yes | yes | same |
| B-052 | "Die Sicherungen ließen sich gerade nicht lesen. …" | S-RESTORE, G-ERR | plain; with Knopf "Noch einmal" | yes; Details | fixed dead end: retry button re-reads the list (DE 2) |
| B-053 | "Startet mit der neuesten Sicherung ({CID}, vom …)" | S-RESTORE | plain: date only, plus "Andere Sicherung wählen" | yes; CID tail, full choice S-RESTORE.T | reworded |
| B-054 | "Startet ohne Daten: … noch keine eigene Sicherung." | S-RESTORE | yes | yes | same |
| B-055 | Storage (aus) | MERGED→B-STORAGE | – (see B-044) | – | merged |
| B-056 | StartPanel (Stopp) bleibt stehen | S-PROGRESS.T | plain: "Gesichert und aus. Kostet nichts mehr." | yes; kept panel | merged with B-101 |
| B-057 | Evidence "Nachweis: Sicherung und Löschen" | S-PROOF | plain: one line "Gesichert am …, Maschine gelöscht" | yes; S-PROOF.T stop rows | merged with B-102 |
| B-058 | BackupChain | B-CHAIN.T | no | yes | moved; merged with B-092 |
| B-059 | TrialRestore bei übrig gebliebener Probe | B-TRIAL, G-ALERT | yes; alert "Eine Probe läuft noch" with "Probe beenden" | yes | moved; alert in both views because it costs (DE 9) |
| B-060 | "Der Schlüssel der gelöschten VM … noch freigegeben" | S-NOTE | no; app retries by itself | yes | same (.T note) |
| B-061 | "Der unterbrochene Start ist … verworfen" | S-NOTE | plain: "Der Start wurde beendet. Du kannst neu starten." | yes; Aleph status | reworded |
| B-062 | "Dieser Knoten … Die App versucht einen anderen." | S-NOTE, S-PROGRESS.T | no; plain step just continues | yes | same (.T note) |
| B-063 | "Die bezahlte Laufzeit ist zu Ende. …" | G-ALERT, P-STATE | yes; with Knopf "Paket verlängern" | yes | moved; cleared on dismiss, separate text if erase failed (DE 18) |
| B-064 | "Mit dem vorherigen Image starten" + Hinweis | G-ERR | plain: "Mit der vorherigen Version starten" | yes; also listed in T-IMAGE | reworded |
| B-065 | "Details aus der VM" (Log, ProviderHealth) | G-ERR | no | yes; "Details" with raw log and provider health | merged with B-105; closed by default |
| B-066 | Kaufangebot (Übersicht) | P-MONEY, G-ALERT | yes | yes | merged with B-104; wider condition kept |
| B-067 | "{n} Stunden gekauft für {x} €. …" | P-MONEY | plain: euros and hours | yes; credits | same |

### 2.2 Lifecycle.svelte — "Erweitert" template

| ID | Today | v0.2 place | Einfach | Technisch | Change |
|---|---|---|---|---|---|
| B-068 | Überschrift "Paperless-ngx" | MERGED→S-STATUS | – | – | merged into the status headline |
| B-069 | Chip "aus", "startet", "läuft" … | MERGED→S-STATUS | – | – | merged into headline B-004…B-010 |
| B-070 | "Deine Paperless-ngx-Maschine: starten, öffnen, …" | S-STATUS | no; headline and sentence say it | yes; as sub line | same |
| B-071 | "Paperless-ngx öffnen" | MERGED→S-ACCESS | – | – | merged with B-029 |
| B-072 | "Paperless-ngx läuft: {host}" | S-ACCESS | no | yes; technical line with host link | merged with B-014 |
| B-073 | "Wiederherstellung fehlgeschlagen ({Grund}: …)" | G-ERR | no; plain form is B-031 | yes; reason under "Details" | merged with B-031 |
| B-074 | "Was diese VM schreibt, liegt auf eigener Platte …" | S-NOTE | no | yes | same (.T note) |
| B-075 | "Diese VM schreibt auf die gemeinsame Image-Platte …" | S-NOTE | plain: "Daten liegen nicht auf eigener Platte" + Knopf "Aktualisieren" | yes; full wording | reworded; warning now also in Einfach |
| B-076 | Evidence (Erweitert) | MERGED→S-PROOF.T | – | – | merged with B-038 |
| B-077 | "Anmeldung: admin, ••••••••" | MERGED→S-ACCESS | – | – | merged with B-032…B-034 |
| B-078 | "Passwort anzeigen" / "Verbergen" | MERGED→S-ACCESS | – | – | merged with B-035 |
| B-079 | "Kopieren" | MERGED→S-ACCESS | – | – | merged with B-036 |
| B-080 | "Löschen ohne Sicherung" | MERGED→S-STOP | – | – | merged with B-039 |
| B-081 | Warnung "keine Kopie antwortet" | MERGED→G-ALERT | – | – | merged with B-041 |
| B-082 | "Sichern und beenden" | MERGED→S-STOP | – | – | merged with B-042; safer: disabled during a backup |
| B-083 | "Prüfe, ob die Speicheranbieter antworten …" | MERGED→S-STOP | – | – | merged with B-043 |
| B-084 | Auswahl "Beim Start" | S-RESTORE.T | plain: sentence + "Andere Sicherung wählen" | yes; full radio group | same |
| B-085 | "Neueste Sicherung wiederherstellen (…)" | S-RESTORE.T | plain: default, first entry of the date list | yes; CID, size, parts, copies, places | same |
| B-086 | "Neueste eigene Sicherung (mit Siegel …)" | S-RESTORE.T | plain: entries of the date list | yes; seal, snapshot kind | same |
| B-087 | "(noch keine mit dem Siegel …)" / "(lese …)" | S-RESTORE.T | no; B-051 and B-054 cover it | yes | same |
| B-088 | "Neueste Sicherung ohne Siegel deines Tresors …" | S-RESTORE.T | plain: under "Weitere anzeigen", with warning B-140 | yes; count and hint | same |
| B-089 | "Leeres Paperless-ngx" | S-RESTORE.T | plain: last entry "Leer starten" | yes | same |
| B-090 | "Die Sicherungen ließen sich gerade nicht lesen." | MERGED→S-RESTORE | – | – | merged with B-052; safer: Start disabled, retry button (DE 2) |
| B-091 | BackupExport ("Sicherung selbst holen") | B-EXPORT | plain: "Dokumente herunterladen" | yes; B-EXPORT.T ledger.json, key reveal | moved to Sicherung |
| B-092 | BackupChain (Erweitert) | MERGED→B-CHAIN.T | – | – | merged with B-058 |
| B-093 | "Ein Start wurde unterbrochen: VM {Hash} …" | G-ALERT, S-STATUS | plain: no hash, "seit {Zeit}" | yes; hash and time as technical line | merged with B-010, B-015 |
| B-094 | "Start fortsetzen" | MERGED→S-STATUS | – | – | merged with B-046 |
| B-095 | "Verwerfen (die VM dann … löschen)" | MERGED→G-ALERT | – | – | merged with B-047 (DE 3) |
| B-096 | "Startet produktiv: …" / "Startet als Test: …" | S-NOTE, T-NET | no | yes | same (.T note) |
| B-097 | "Paperless anywhere starten" | MERGED→S-STATUS | – | – | merged with B-050; safer: disabled while backups unread |
| B-098 | "Es fehlt noch: zahlendes Konto, Wallet …" | S-STATUS, S-NOTE | plain: B-048 with "Einrichtung öffnen" | yes; each missing item is a link | fixed dead end: items link to their setting (DE 6) |
| B-099 | "Deine Urkunde" | S-PROOF, T-IMAGE | yes; inside "Was wurde geprüft?" | yes; also in T-IMAGE | fixed dead end: reachable in both views, also while running (DE 16) |
| B-100 | StartPanel (Start) | MERGED→S-PROGRESS.T | – | – | merged with B-028 |
| B-101 | StartPanel (Stopp) | MERGED→S-PROGRESS.T | – | – | merged with B-056 |
| B-102 | Evidence (Stopp) | MERGED→S-PROOF.T | – | – | merged with B-057 |
| B-103 | Rohe Fortschrittszeile "{Text} …" | S-PROGRESS.T | no | yes; raw progress line | same |
| B-104 | Kaufangebot (Erweitert) | MERGED→P-MONEY | – | – | merged with B-066; wider condition kept |
| B-105 | "Was die VM zur Sicherung meldet" | MERGED→G-ERR | – | – | merged with B-065; closed by default |
| B-106 | "Letzte Sicherung: {Datum} · {have}/{want} Kopien" | B-DETAIL.T | plain: B-LAST; incomplete shows "Jetzt sichern" | yes; folded detail card | moved to Sicherung; visible while running too |
| B-107 | "Netz — Filecoin Mainnet / Calibration" | B-DETAIL.T | no | yes | moved |
| B-108 | "Bezahlt von — {0x…}" | B-DETAIL.T | no | yes | moved |
| B-109 | "Piece CID — {cid}" | B-DETAIL.T | no | yes | moved |
| B-110 | "Größe — {x} MiB (verschlüsselt), in n Teilen" | B-DETAIL.T | no | yes | moved |
| B-111 | "Dauer — {n} s" | B-DETAIL.T | no | yes | moved |
| B-112 | "Anbieter {id} ({Ort}) · Datensatz {n}, Piece {n}" | B-DETAIL.T | no | yes | moved |
| B-113 | "abrufen" "(verschlüsselt; nur dein Schlüssel …)" | B-DETAIL.T | no; "Dokumente herunterladen" in B-EXPORT | yes | moved |
| B-114 | "{n} Fehlversuch(e) bei Anbietern, ersetzt." | B-DETAIL.T | no | yes | moved |

### 2.3 Lifecycle.svelte — snippets used in both templates

| ID | Today | v0.2 place | Einfach | Technisch | Change |
|---|---|---|---|---|---|
| B-115 | "Deine Sicherungsorte nennen gesperrte Anbieter: …" | G-DIALOG, B-PLACES.T | plain: "Ein Speicherort wird ersetzt." | yes; names and reason | dialog; merged copies |
| B-116 | "Diese Speicheranbieter antworten gerade nicht: …" | G-DIALOG | plain: "Ein Speicherort antwortet gerade nicht." | yes; provider ids and names | dialog |
| B-117 | "statt {…}: {…} (anderer Betreiber, antwortet)" | G-DIALOG, B-PLACES.T | no | yes | dialog |
| B-118 | "Übernommen gehen die neuen Orte gleich …" | G-DIALOG | plain: "Danach wird gesichert." | yes; full wording | reworded |
| B-119 | "Einen Ersatz … gibt es nicht." | G-DIALOG | plain | yes | dialog |
| B-120 | "Ersatz übernehmen" | G-DIALOG | yes | yes | dialog |
| B-121 | "Später" | G-DIALOG, B-HEALTH | yes | yes | fixed dead end: reminder with button stays in B-HEALTH (DE 11) |
| B-122 | "Übernehmen und sichern" | G-DIALOG | yes | yes | dialog |
| B-123 | "Ohne Änderung weiter" / "Trotzdem versuchen" | G-DIALOG | yes | yes | dialog |
| B-124 | "Abbrechen" | G-DIALOG | yes | yes | fixed dead end: says "Nicht gesichert/beendet", question stays in B-HEALTH (DE 11) |
| B-125 | Fehlerkasten (Text) | G-ERR | plain: one sentence and one next-step button | yes; "Details" | merged copies |
| B-126 | "Details" + rohe Browser-Meldung | G-ERR | no | yes | same |
| B-127 | "Noch einmal" | G-ERR | yes | yes | same |
| B-128 | "Die Verbindung ist unterbrochen worden. …" | G-ERR | yes | yes; raw message in Details | same |
| B-129 | "Ich habe aufgeladen – neu prüfen" | P-MONEY | yes | yes | same |
| B-130 | "In deinem Paket liegen noch {h} Stunden. …" | P-MONEY, G-ALERT | plain: "Im Paket sind noch {h} Stunden." | yes; who pays the VM | reworded |
| B-131 | "Aus dem Paket starten ({h} h)" | P-MONEY, G-ALERT | yes | yes | same |
| B-132 | "Stunden aus Le Space Credits kaufen" 5/10/30 h | P-MONEY | plain: "Stunden dazukaufen" | yes | reworded |
| B-133 | "Kaufen und starten" / "Preis wird abgefragt …" | P-MONEY | yes | yes | same |
| B-134 | HourQuote (Kauf bestätigen) | P-MONEY | yes | yes | same (see 2.8) |
| B-135 | Fehler vom Credits-Dienst | G-ERR | plain; with "Noch einmal" | yes; raw message in Details | same; gets retry |
| B-136 | "Für heute ist keine Sicherung bezahlt. …" | G-DIALOG | yes | yes | dialog (already a designed question) |
| B-137 | "Erst die Sicherung buchen (im Paket)" | G-DIALOG, P-BACKUP | yes | yes | fixed dead end: after booking, "Jetzt starten" resumes the start (DE 12) |
| B-138 | "Ohne Sicherung starten" | G-DIALOG | yes | yes | same |
| B-139 | "Doch nicht starten" | G-DIALOG | yes | yes | same |
| B-140 | "Die Sicherung … trägt nicht das Siegel deines Tresors" | S-RESTORE, G-DIALOG | plain: date only, "nicht sicher von dir" | yes; CID tail | reworded |
| B-141 | "Sie ist meine: trotzdem einspielen" | S-RESTORE, G-DIALOG | yes | yes | same |
| B-142 | "Die letzte Sicherung … steht nicht in der Liste" | S-RESTORE, G-DIALOG | plain: date only; with "Noch einmal prüfen" | yes; CID tail | reworded; gets retry button |
| B-143 | "Die gewählte Sicherung ist älter als die letzte …" | S-RESTORE, G-DIALOG | plain: dates only | yes; CID tail | reworded |
| B-144 | "Trotzdem so starten" | S-RESTORE, G-DIALOG | yes | yes | same |
| B-145 | "Gesichert, aber nur {have} von {want} Kopien …" | G-DIALOG | plain: "ein Speicherort hat abgelehnt" | yes; provider wording | dialog; merged copies |
| B-146 | "Die angekommenen Kopien reichen zum Wiederherstellen. …" | G-DIALOG | yes | yes | same |
| B-147 | "VM trotzdem löschen" | G-DIALOG | plain: "Maschine trotzdem löschen" | yes | fixed dead end: a failure shows inside the dialog, above the buttons (DE 10) |
| B-148 | "VM behalten, Paperless-ngx weiter" | G-DIALOG | plain: "Maschine behalten, weiterarbeiten" | yes | fixed dead end: same dialog, error above the buttons (DE 10) |

### 2.4 StartPanel.svelte (used for start, stop and discard)

| ID | Today | v0.2 place | Einfach | Technisch | Change |
|---|---|---|---|---|---|
| B-149 | Panel-Titel (nur aria) "Start der VM: …" | S-PROGRESS.T | no; plain steps carry their own label | yes | same |
| B-150 | Zeile "{n} {Name}" + "{12 s} (üblich ca. 10 s)" | S-PROGRESS.T | no; time left only | yes | same |
| B-151 | Lichterleiste je Zeile | S-PROGRESS.T | plain: one check mark per plain step | yes | same |
| B-152 | Zeile "Messwerte" (2 Lichter) | S-PROGRESS.T | no; part of step "Vorbereiten" | yes | same |
| B-153 | Zeile "Instanz" (2 Lichter) | S-PROGRESS.T | no; part of step "Vorbereiten" | yes | same |
| B-154 | Zeile "Netz" (2 Lichter) | S-PROGRESS.T | no; part of step "Vorbereiten" | yes | same |
| B-155 | Zeile "Attestierung" (2 Lichter) | S-PROGRESS.T | plain: step "Sicherheit prüfen" | yes | same |
| B-156 | Zeile "Entsperren" (2 Lichter) | S-PROGRESS.T | no; part of step "Sicherheit prüfen" | yes | same |
| B-157 | Zeile "Wiederherstellen": "Sicherung eingespielt" | S-PROGRESS.T | plain: "Sicherung wird eingespielt" inside step 3 | yes | same |
| B-158 | Zeile "Bereit" (4 Lichter) | S-PROGRESS.T | plain: step "Paperless starten" | yes | same |
| B-159 | Stopp-Zeile "Auftrag" (2 Lichter) | S-PROGRESS.T | no; part of step "Sichern" | yes | same |
| B-160 | Stopp-Zeile "Export" (2 Lichter) | S-PROGRESS.T | plain: step "Sichern" | yes; file count | same |
| B-161 | Stopp-Zeile "Archiv" (age, Kopf der Sicherung) | S-PROGRESS.T | plain: "verschlüsselt" inside step "Sichern" | yes | same |
| B-162 | Stopp-Zeile "Hochladen" (Kopien bei Anbietern) | S-PROGRESS.T | plain: "{n} Kopien" inside step "Kopien bestätigen" | yes; provider ids, data sets | same |
| B-163 | Stopp-Zeile "Bestätigt" (Piece-CID) | S-PROGRESS.T | no; part of step "Kopien bestätigen" | yes | same |
| B-164 | Zeile "Löschen" (Knoten, FORGET, Widerruf) | S-PROGRESS.T | plain: step "Maschine ausschalten, kostet nichts mehr" | yes | same |
| B-165 | Stopp-Zeile "Liste" | S-PROGRESS.T | no; result shows in B-LAST | yes | same |
| B-166 | Live-Region "{Zeile}: {Zustand}" (sr-only) | S-PROGRESS | yes; announces the plain steps | yes; announces panel rows | same (a11y kept in both) |
| B-167 | "Gesamt: {123 s} · üblich ca. {10 min}" | S-PROGRESS.T | no | yes | same |
| B-168 | Legende "Grün: … Blau: …" + Verweis | S-PROGRESS.T | no | yes; reference becomes a link to S-PROOF.T | reworded: named place becomes a link |

### 2.5 Evidence.svelte ("Nachweis dieser VM", "Nachweis: Sicherung und Löschen")

| ID | Today | v0.2 place | Einfach | Technisch | Change |
|---|---|---|---|---|---|
| B-169 | "Nachweis dieser VM" / "Nachweis: Sicherung und Löschen" | S-PROOF | plain: one line + "Was wurde geprüft?" | yes; S-PROOF.T folded rows | reworded for Einfach |
| B-170 | "Beispiel, keine echte VM" | S-PROOF.T | no; not rendered in the app | no in the app; landing page prop kept | same (see Unplaced) |
| B-171 | "{n} von der App geprüft · {n} gemeldet · …" | S-PROOF.T | no | yes | same |
| B-172 | Legende ✓ • – ○ | S-PROOF.T | no | yes | same |
| B-173 | Zeile "Laufzeit" | S-PROOF.T | no | yes | same |
| B-174 | Zeile "Messwert" | S-PROOF.T | no | yes | same |
| B-175 | Zeile "Instanz" | S-PROOF.T | no | yes | same |
| B-176 | Zeile "Knoten" | S-PROOF.T | no | yes | same |
| B-177 | Zeile "Attestierung" | S-PROOF.T | plain: "Echtheitsprüfung bestanden am {Zeit}" in "Was wurde geprüft?" | yes | same |
| B-178 | "Jetzt erneut prüfen" / "Prüfe die VM (AMD) …" | S-PROOF | yes; inside "Was wurde geprüft?" | yes; in the attestation row | same |
| B-179 | "Frisch geprüft." / "Die Prüfung ist fehlgeschlagen: …" | S-PROOF | plain; failure offers "Noch einmal" | yes; reason | same; failure gets retry |
| B-180 | Zeile "Relay" | S-PROOF.T | no | yes; link to T-RELAY | same |
| B-181 | Zeile "Image" | S-PROOF.T | no | yes; link to T-IMAGE | same |
| B-182 | Zeile "Datenbereich" | S-PROOF.T | no; plain warning only via B-075 | yes | same |
| B-183 | Zeile "Sicherungen" | S-PROOF.T | plain: shown as B-LAST | yes | same; duplicate of B-022 kept as proof row |
| B-184 | Stopp-Zeile "Letzte Sicherung" (Piece-CID) | S-PROOF.T | no | yes | same |
| B-185 | Stopp-Zeile "Verschlüsselung" | S-PROOF.T | no | yes | same |
| B-186 | Stopp-Zeilen "Kopie" | S-PROOF.T | no | yes | same |
| B-187 | Stopp-Zeile "VM gelöscht" (FORGET) | S-PROOF.T | plain: "Maschine gelöscht" in the one line | yes | same |
| B-188 | "Kopieren" → "Kopiert" | S-PROOF.T | no | yes | same |
| B-189 | Externe Links je Zeile | S-PROOF.T | no | yes | same |

### 2.6 TrialRestore.svelte ("Sicherung prüfen")

| ID | Today | v0.2 place | Einfach | Technisch | Change |
|---|---|---|---|---|---|
| B-190 | "Sicherung prüfen" | B-TRIAL | plain: "Sicherung ausprobieren" | yes | reworded; moved to Sicherung |
| B-191 | "Startet eine zweite Paperless-ngx-Instanz …" | B-TRIAL | plain: "zweites Paperless zum Ansehen, kostet Stunden" | yes; full wording | reworded |
| B-192 | "Probe aus der neuesten Sicherung starten" | B-TRIAL | yes | yes | same |
| B-193 | Confirm "Eine zweite Paperless-ngx-Instanz … starten?" | G-DIALOG | plain; names the cost | yes | dialog |
| B-194 | "Die Probe-VM wurde angefordert, aber nicht fertig …" | B-TRIAL, G-ALERT | plain: "Die Probe ist nicht fertig gestartet und kostet." | yes | fixed dead end: adds "Probe fortsetzen" beside "Probe beenden" (DE 9) |
| B-195 | "Probe beenden" | B-TRIAL, G-ALERT | yes | yes | same; also the alert button |
| B-196 | "Probe läuft, aus Sicherung …{CID}: wiederhergestellt …" | B-TRIAL | plain: date instead of CID, document count | yes; CID tail, failure reason | reworded |
| B-197 | "Probe öffnen" | B-TRIAL | yes | yes | same |
| B-198 | "Anmeldung wie bei deiner … Passwort [anzeigen]" | B-TRIAL | yes | yes | reworded: same show/hide/copy control as S-ACCESS |
| B-199 | "Probe beenden (ohne Sicherung)" | B-TRIAL | yes | yes | same |
| B-200 | Confirm "Die Probe beenden? …" | G-DIALOG | plain: "Maschine" statt VM | yes | dialog |
| B-201 | "{Schritt} …" (Sicherungen lesen, Probe-VM löschen) | B-TRIAL | plain: "Probe startet …" / "Probe wird beendet …" | yes; raw step text | reworded |
| B-202 | Fehler der Probe ("… noch keine Sicherung …") | G-ERR | plain; Knopf "Noch einmal" or "Jetzt sichern" | yes; Details | fixed dead end: error carries retry / "Jetzt sichern" button |

### 2.7 ImageCertificate.svelte ("Urkunde", mounted by FirstStart.svelte:118) and VmList.svelte, ProviderHealth.svelte

| ID | Today | v0.2 place | Einfach | Technisch | Change |
|---|---|---|---|---|---|
| B-203 | "Urkunde · Paperless anywhere" | S-PROOF, T-IMAGE | yes | yes | same; opener now in both views (DE 16) |
| B-204 | "Dein eigenes Paperless-Image" | S-PROOF, T-IMAGE | plain: "Deine eigene, versiegelte Maschine" | yes; today's wording | reworded for Einfach |
| B-205 | Siegel (Schloss-Symbol) | S-PROOF, T-IMAGE | yes | yes | same |
| B-206 | "Dieses Image wurde nur für deinen Tresor versiegelt. …" | S-PROOF, T-IMAGE | plain | yes | reworded for Einfach |
| B-207 | "Gebaut am — {Datum}" | S-PROOF, T-IMAGE | yes | yes | same |
| B-208 | "Passphrase — nur in deinem Tresor" | S-PROOF, T-IMAGE | plain: "Schlüssel — nur in deinem Tresor" | yes | reworded for Einfach |
| B-209 | "Ausgangs-Image (SHA-256) — {hash}" | T-IMAGE, S-FIRST.T | no | yes | same |
| B-210 | "Build-Dienst (von AMD bestätigt) — {Messwert}" | T-IMAGE, S-FIRST.T | no | yes | same |
| B-211 | "Dein Image bei Aleph (STORE) — {hash}" | T-IMAGE, S-FIRST.T | no | yes | same |
| B-212 | "Gebaut aus dem Quelltext-Stand — {commit}" | T-IMAGE, S-FIRST.T | no | yes | same |
| B-213 | "Als PDF speichern" | S-PROOF, T-IMAGE | yes | yes; print includes the hash rows | same |
| B-214 | "Zurück" | S-PROOF, T-IMAGE | yes | yes | same |
| B-215 | "Meine VMs" | T-VMS | no; stray machines come through G-ALERT | yes | moved to System, unfolded |
| B-216 | "Aktualisieren" | T-VMS | no; alert check runs on unlock | yes | moved |
| B-217 | "lese …" | T-VMS | no | yes | moved |
| B-218 | "Keine VM läuft." | T-VMS | no; no alert means nothing costs | yes | moved |
| B-219 | "Es laufen VMs, die nicht als gestartet bekannt …" | G-ALERT, T-VMS | plain: "Eine weitere Maschine läuft und kostet." + Knopf | yes; list in T-VMS | fixed dead end: alert with button in both views (DE 4) |
| B-220 | VM-Name | T-VMS | no | yes | moved |
| B-221 | "(gestartet)" / "(startet gerade)" / "(Start unterbrochen)" | T-VMS | no; interrupted start is the alert B-015 | yes | moved |
| B-222 | "seit {Datum} · kostet ca. {n} Credits/h · {Phase}" | T-VMS, G-ALERT | plain: "seit {Datum}" in the alert | yes; credits per hour, phase | moved |
| B-223 | Host-Link je VM | T-VMS | no | yes | moved |
| B-224 | 12 Zeichen itemHash | T-VMS | no | yes | moved |
| B-225 | "Übernehmen" | T-VMS, G-ALERT | plain: "Wieder verbinden" in the alert, if it answers as Paperless | yes | moved; offered before delete to avoid data loss |
| B-226 | Confirm "{Name} als laufende Instanz übernehmen? …" | G-DIALOG | plain | yes; VM name | dialog |
| B-227 | "Löschen" | T-VMS, G-ALERT | plain: alert button "Maschine löschen" | yes; per row | fixed dead end: reachable from the alert (DE 3, DE 4) |
| B-228 | Confirm "{Name} löschen, ohne letzte Sicherung? …" | G-DIALOG | plain; "Sichern und beenden" offered as a button | yes; VM name | dialog; named place becomes a button |
| B-229 | "VM gelöscht; den Schlüssel … nimmt die App zurück" | T-VMS | plain: "Maschine gelöscht. Kostet nichts mehr." | yes; revoke reason | reworded for Einfach |
| B-230 | Fehler der VM-Liste (9 Texte) | G-ERR | plain: one sentence + "Noch einmal" | yes; specific text in Details | same; gets retry |
| B-231 | "Speicheranbieter jetzt" [neu prüfen] | B-COPIES.T, G-ERR | no; B-HEALTH lights cover it | yes | moved; also inside error Details |
| B-232 | "Die Anbieterliste ließ sich gerade nicht lesen." | B-COPIES.T | no | yes; with "neu prüfen" | moved |
| B-233 | "Anbieter werden gefragt …" | B-COPIES.T | no | yes | moved |
| B-234 | Punkt je Anbieter (grün/grau) | B-COPIES.T | plain: summed up in the B-HEALTH lights | yes | moved |
| B-235 | "Anbieter {id} · {Name} ({Ort}): antwortet ({ms} ms)" | B-COPIES.T | no | yes | moved |
| B-236 | "im Explorer" | B-COPIES.T | no | yes | moved |
| B-237 | "„Antwortet“ heißt erreichbar; …" | B-COPIES.T | no | yes | moved |

### 2.8 HourQuote.svelte (purchase confirmation inside the fund offer)

| ID | Today | v0.2 place | Einfach | Technisch | Change |
|---|---|---|---|---|---|
| B-238 | "Das Guthaben reicht nicht für {n} Stunden." | P-MONEY | yes | yes | same |
| B-239 | "Erst Guthaben aufladen, unter „Aufladen, …“" | P-MONEY | plain: Knopf "Guthaben aufladen" | yes | fixed dead end: named section becomes a button |
| B-240 | "Schließen" | P-MONEY | yes | yes | same |
| B-241 | "{n} Stunden kaufen?" | P-MONEY | yes | yes | same |
| B-242 | "Bezahlt aus — deinem Le-Space-Credits-Guthaben" | P-MONEY | plain: "aus deinem Guthaben" | yes | reworded for Einfach |
| B-243 | "Kosten — {n} Credits (≈ {x} €)" | P-MONEY | plain: euros only | yes; credits | reworded for Einfach |
| B-244 | "Guthaben — {x} € → {y} €" | P-MONEY | yes | yes | same |
| B-245 | "VM-Stunden — {a} h → {b} h, nutzbar bis {Tag}" | P-MONEY | plain: "Stunden" | yes | reworded for Einfach |
| B-246 | "Nutzbar bis — {Tag}" | P-MONEY | yes | yes | same |
| B-247 | "Kaufen und starten" | P-MONEY | yes | yes | same |
| B-248 | "Abbrechen" | P-MONEY | yes | yes | same |

### 2.9 Raw progress texts

| ID | Today | v0.2 place | Einfach | Technisch | Change |
|---|---|---|---|---|---|
| B-249 | "Le Space bezahlt die VM jetzt aus deinem Paket" | S-PROGRESS.T | plain: "Bezahlt aus deinem Paket" under step 1 | yes; raw line | same |
| B-250 | "Le Space Credits: Freigabe für die VM holen" | S-PROGRESS.T | no; part of step "Vorbereiten" | yes | same |
| B-251 | "Le Space Credits: Stunden kaufen" | S-PROGRESS.T | plain: "Stunden werden gekauft …" | yes | same |
| B-252 | "Warte, bis Aleph die Gutschrift zeigt" | S-PROGRESS.T | plain: "Warte auf die Gutschrift …" | yes | same |
| B-253 | "Sicherungen nachsehen" | S-PROGRESS.T | no; part of step "Vorbereiten" | yes | same |
| B-254 | "Paperless-ngx wieder starten" | S-PROGRESS.T | plain: step "Paperless starten" | yes | same |
| B-255 | "Freien / Anderen vertraulichen Knoten suchen" | S-PROGRESS.T | no; part of step "Vorbereiten" | yes | same |
| B-256 | "Eigenes Image bauen (etwa 15 Minuten …): {Schritt}" | S-FIRST | plain: one sentence and percent | yes; S-FIRST.T sub-steps | same |
| B-257 | "Neue Sicherungsorte gehen an die VM" | S-PROGRESS.T, B-PLACES.T | plain: "Speicherorte werden übernommen …" | yes | same |
| B-258 | "Letzte Sicherung vor dem Ende auf der Chain prüfen" | S-PROGRESS.T | plain: step "Kopien bestätigen" | yes | same |
| B-259 | Start-Schritte (12 Texte, "Messwerte … berechnen" …) | S-PROGRESS.T | no; mapped onto the three plain steps | yes | same |
| B-260 | "Öffentliches Image: ohne feste Adresse / ohne Sicherungen" | S-NOTE, S-PROGRESS.T | plain: lasting note "Läuft ohne Sicherung" + Knopf | yes; raw line and lasting note | fixed: consequence no longer just flashes by (see B-021) |
| B-261 | Stopp-Schritte ("Stopp anfordern", "VM löschen" …) | S-PROGRESS.T | no; mapped onto the three plain stop steps | yes | same |
| B-262 | "Knotenliste lesen", "Guthaben abfragen", "VM-Liste lesen" | S-PROGRESS.T, T-VMS | no | yes | same |

### 2.10 Error texts that land in the error box (B-125) — one row each

| ID | Today | v0.2 place | Einfach | Technisch | Change |
|---|---|---|---|---|---|
| B-263 | "Die letzte Sicherung ist fehlgeschlagen; die VM bleibt." | G-ERR, S-STOP | plain; Knöpfe "Noch einmal sichern", "Ohne Sicherung löschen" | yes; reason, log, provider health in Details | fixed dead end: explicit delete button via G-DIALOG (DE 7) |
| B-264 | "Für den Start fehlt: {…}" | G-ERR | plain; Knopf "Einrichtung öffnen" | yes; items as links | fixed dead end: button to the setup (DE 6) |
| B-265 | "Es ist noch kein Konto bekannt, das die VM bezahlt." | G-ERR, P-PLANS | plain: "Noch kein Paket gewählt" + Knopf "Paket wählen" | yes; link to P-PAYER.T | fixed dead end: button to Paket |
| B-266 | "Für einen Start fehlen noch {n} Aleph-Credits …" | G-ALERT, P-MONEY | plain: "Das Guthaben reicht nicht" + "Stunden kaufen" | yes; credits, payer account, reserve rule | moved to the alert slot; button even without fund offer |
| B-267 | "Es gibt keinen unterbrochenen Start." | G-ERR | plain; Knopf "Neu starten" | yes | same; gets a button |
| B-268 | "Die VM {hash} gibt es bei Aleph nicht mehr." | G-ERR | plain: "Die Maschine gibt es nicht mehr" + "Neu starten" | yes; hash and status | same; gets a button |
| B-269 | "Für diese VM sind keine Sicherungen eingerichtet." | G-ERR, P-BACKUP | plain; Knopf "Sicherung buchen" | yes; link to B-SETUP.T | same; gets a button |
| B-270 | "Sicherungsorte gehen nur an eine VM mit … eigenem Image." | G-ERR | plain: "Geht nur mit eigener Maschine" + Knopf "Einrichten" | yes; link to T-IMAGE | same; gets a button |
| B-271 | "Gerade liefert keine der {n} Kopien … aus" | G-ALERT, G-ERR | plain; Knöpfe "Noch einmal", "Andere Sicherung wählen" | yes; provider detail in B-COPIES.T | moved to the alert slot (no copy reachable) |
| B-272 | "Eine Sicherung wird nur in dein eigenes Image …" | G-ERR | plain; Knöpfe "Eigene Maschine einrichten", "Ohne Sicherung starten" | yes | fixed dead end: both ways out are buttons (DE 6) |
| B-273 | "Die VM konnte ihre … Datenplatte nicht anlegen …" | G-ERR | plain; Knopf "Maschine löschen und neu starten" | yes; reason in Details | fixed dead end: button replaces "unter Meine VMs löschen" (DE 6) |
| B-274 | "Es läuft keine VM." | G-ERR | plain: "Paperless ist aus" + Knopf "Starten" | yes | same; gets a button |
| B-275 | "Die Prüfung hat kein Ergebnis geliefert." | G-ERR, S-PROOF | plain; Knopf "Erneut prüfen" | yes | same |
| B-276 | "Diese VM kennt „Jetzt sichern“ noch nicht (älteres Image)." | G-ERR, B-LAST | plain: "Braucht ein Update" + Knopf "Sichern und beenden" | yes; names the older image | same; gets a button |
| B-277 | Modus-Wörter "unterbrochen", "wird gerade gesichert und beendet" | G-ERR, B-LAST | plain | yes | same |
| B-278 | "Die VM wartet auf keine Antwort mehr; bitte … neu laden." | G-ERR | plain; Knopf "Seite neu laden" | yes | same; gets a button |
| B-279 | "Die Sicherung … ist auf der Blockchain nicht … zu finden." | G-ERR, S-STOP | plain; Knöpfe "Noch einmal prüfen", "Trotzdem löschen" | yes; Details | fixed dead end: retry plus guarded delete via G-DIALOG (DE 7) |
| B-280 | "Ohne den Schlüssel der Sicherungen lässt sich …" | G-ERR | plain; Knopf "Fehlerbericht kopieren" (M-HELP) | yes; link to B-SETUP.T | same; gets a button |
| B-281 | "Aleph zeigt die Freigabe von Le Space noch nicht. …" | G-ERR | plain: "Noch nicht bereit" + Knopf "Noch einmal" | yes | same; retry button |
| B-282 | "Gerade hat kein vertraulicher Knoten Platz …" | G-ERR | plain: "Gerade ist kein Platz frei" + "Noch einmal" | yes | same; retry button |
| B-283 | "Der im Setup festgelegte Knoten hat die VM abgelehnt. …" | G-ERR, T-IMAGE | plain; Knopf "Anderen Platz suchen" | yes; button clears the fixed node in T-IMAGE | fixed dead end: button does the manual fix (DE 6) |
| B-284 | "Der Start wartet auf deine Bestätigung: … nicht eingespielt." | S-RESTORE, G-DIALOG | plain | yes | merged into the gap question B-142…B-144 |
| B-285 | "Der Start wartet auf deine Bestätigung: … Siegel …" | S-RESTORE, G-DIALOG | plain | yes | merged into the question B-140/B-141 |
| B-286 | "Die Gutschrift ist bei Aleph noch nicht zu sehen. …" | G-ERR, P-MONEY | plain; Knopf "Noch einmal starten" | yes | fixed dead end: buy control hidden, retry button checks the credit (DE 8) |
| B-287 | "Ein Image lässt sich bauen, wenn Paperless gestoppt ist." | G-ERR | plain; Knopf "Sichern und beenden" | yes | fixed dead end: button to S-STOP (DE 19) |
| B-288 | "Gerade läuft schon etwas in der Paperless-Karte. …" | G-ERR | plain: "Bitte kurz warten" + "Noch einmal" | yes | reworded; retry button |
| B-289 | "Die VM hat sich am Ende der Laufzeit angehalten …" | G-ALERT, G-ERR | plain; Knopf "Maschine löschen" | yes; link to T-VMS | fixed dead end: button replaces "VM-Liste unter Technisch" (DE 6) |
| B-290 | "Die Sicherungen ließen sich gerade nicht lesen." | G-ERR | plain; Knopf "Noch einmal" | yes | same |
| B-291 | Bau-Fehler (ownImage.error.*, 21 Texte) | G-ERR, S-FIRST | plain: one sentence + "Noch einmal" | yes; the specific text in Details | same; retry also when not retryable today |

## Count check

- Inventory IDs in `B-lifecycle.md`: 291 (B-001 … B-291, no gaps).
- Rows in this table: 291.

Unplaced:
- B-170 ("Beispiel, keine echte VM"): the `sample` badge of Evidence is not used by Lifecycle, only by the landing page, which has no place code in `places.md`. Row kept, parked at S-PROOF.T as a component prop; needs a place once the landing page is mapped.

Not rows, listed so the decision is visible (DEAD, not carried over): catalogue keys `card.simple.stopNoProvider`, `card.simple.stopAnyway`, `ownImage.overview.buildsAtStart`, and `life.missing.node` (the unused tenth item of B-098). No TEST-only row exists in this slice; B-166 (sr-only live region) is real a11y output and is kept in both views.

## Open questions for Nico

1. B-047 / B-095: in Einfach "Verwerfen" becomes "Abbrechen und Maschine löschen" (deletes the VM). Should Technisch keep the old "nur vergessen, VM läuft weiter" at all?
2. B-225: should the stray-machine alert in Einfach offer "Wieder verbinden" (adopt) before "Löschen", or only delete? Delete alone could lose unsaved documents.
3. B-021 / B-260: can an Einfach user be on the public image at all? If yes, is the lasting note "Läuft ohne Sicherung" with a button the right weight, or should it be a G-ALERT?
4. B-075 (data on the shared image disk, no own key): I gave Einfach a plain warning with an update button. Or is this Technisch-only?
5. B-088: may Einfach restore a backup without the vault mark (under "Weitere anzeigen"), or is that Technisch-only?
6. B-263 / B-279: a failed or unconfirmed stop backup gets an explicit "Trotzdem löschen" in both views behind a G-DIALOG. Is that wanted, or should the delete stay hidden from Einfach?
7. B-147 / B-148 (partial): keep exactly two consequential buttons with the error shown inside the dialog, or add a neutral third "Später entscheiden" although the machine keeps costing?
8. B-022 / B-037 / B-044: last backup, "Jetzt sichern" and storage leave the Start page entirely. Should S-STATUS keep one short line "Letzte Sicherung: …" as a link to Sicherung?
9. B-203…B-214: the certificate in Einfach hides the four hash rows. Should "Als PDF speichern" print them anyway, so the PDF is the same in both views?
10. B-170: where does the Evidence sample of the landing page belong in v0.2 (no place code yet)?
