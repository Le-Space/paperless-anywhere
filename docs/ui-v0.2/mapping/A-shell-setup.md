# Map A: app shell, setup, first start, help, footer, legal boxes, licences → v0.2 places

Source: `A-shell-setup.md` (rows A-001 … A-231). Place codes: `places.md`.
"DE n" in the Change column = dead end n of section 3.3 of the source; "Dup n" = duplicate n of section 3.1.
Technisch is a superset: "yes" alone means "same as Standard, nothing added".

### 2.1 Header (P:258-273)

| ID | Today | v0.2 place | Standard | Technisch | Change |
|---|---|---|---|---|---|
| A-001 | Logo "LE SPACE Paperless anywhere", "Zur Startseite" | G-HEAD | yes | yes | same; leaving while unlocked always asks via G-DIALOG (DE 1, DE 18) |
| A-002 | "Paperless-ngx in vertraulichen VMs · ein Angebot …" | G-HEAD | plain: "Deine Dokumente, sicher verwahrt · ein Angebot von Le Space" | yes; today's wording with Paperless-ngx link as technical line | reworded |
| A-003 | "Die App wird beim Wechsel … gesperrt." | G-DIALOG | plain: "Maschine" statt "VM"; Buttons "Hier bleiben" / "Trotzdem gehen" | yes; adds what is running (Start, Sicherung, Stopp) | dialog; also guards FAQ/"Über" links and the 24-words screen (DE 1, DE 18) |
| A-004 | GitHub-Zeichen "Quelltext … auf GitHub" | MERGED→M-BUILD.T | no | no (duplicate; survives at M-BUILD.T) | merged with A-205 (Dup 5) |
| A-005 | "DE" / "EN", Gruppe "Sprache" | G-HEAD, M-SET | yes; in Mehr with the visible word "Sprache" | yes | moved: header only on wide screens, always in M-SET |
| A-006 | "Sperren" | G-HEAD | yes | yes | fixed dead end: on the 24-words screen a dialog asks first (DE 1) |
| A-007 | Lichter "Sicherungen erreichbar" / "Kopien unabhängig" | B-HEALTH, G-NAV | plain: one sentence + two lights; dot on "Sicherung" | yes; per-copy detail at B-COPIES.T | moved out of the header; no pointer to "Erweitert → Einrichtung" by name |
| A-008 | Seitentitel "Paperless anywhere" | G-HEAD | yes | yes | same |
| A-009 | versteckter Text "framed" / "new" / "locked" … | TEST | no | no (test hook) | kept as hook `state`, hidden from screen readers |

### 2.2 Framed / shared origin (P:278-285)

| ID | Today | v0.2 place | Standard | Technisch | Change |
|---|---|---|---|---|---|
| A-010 | "Die App ist hier … eingebettet." | G-STOP | plain: "Hier ist die App nicht sicher." + button "Direkt öffnen" | yes; adds the reason (iframe) as technical line | fixed dead end: button, shows the right address to compare (DE 5) |
| A-011 | "Diese Adresse teilen sich alle Seiten …" | G-STOP | plain: without "IPFS-Gateway"; button "Sichere Adresse öffnen" | yes; adds gateway/shared-storage explanation | reworded; fixed dead end: button + address to compare (DE 5) |

### 2.3 No vault: create and open (P:286-311)

| ID | Today | v0.2 place | Standard | Technisch | Change |
|---|---|---|---|---|---|
| A-012 | "Neu hier? Tresor anlegen" | U-NEW | yes | yes | same; becomes title of the three-step first visit |
| A-013 | "Deine Dokumente in Paperless-ngx, auf einer eigenen …" | U-NEW | plain: Passkey explained as "Fingerabdruck, Gesicht oder Geräte-PIN" | yes; technical line names Passkey and Paperless-ngx | reworded (step 1 "what you get") |
| A-014 | "Nur du hast den Schlüssel. …" | U-NEW | yes | yes | same |
| A-015 | "Verstanden: Ich bewahre die 24 Wörter …" | U-NEW | yes | yes | same |
| A-016 | "Passkey anlegen" | U-NEW | plain: "Tresor anlegen" (same word as the heading) | yes; technical line "legt einen Passkey auf diesem Gerät an" | reworded |
| A-017 | Aufklapper "Name des Passkeys ändern" | U-NEW | no (default name is used) | yes | same, technical view only |
| A-018 | Feld "Name des Passkeys" | U-NEW | no | yes | same, technical view only |
| A-019 | "Schon einen Tresor?" | U-OPEN | yes: "Ich habe schon einen Tresor" as equal choice | yes | reworded; fixed dead end: equal-rank choice on the first screen (DE 4) |
| A-020 | "Auf diesem Gerät mit Passkey öffnen" | U-OPEN | yes: "Mit Passkey entsperren" | yes | reworded: one verb "entsperren" as in U-LOCKED (Dup 6) |
| A-021 | "Warte auf den Passkey … Gibt es für {host} …" | U-OPEN | plain: no host name; buttons "Abbrechen" / "Mit den 24 Wörtern" | yes; adds the host | fixed dead end: cancel + direct button, passkey button re-enabled (DE 3) |
| A-022 | Aufklapper "… mit Wiederherstellungsphrase öffnen" | U-OPEN | yes: "Mit den 24 Wörtern entsperren", open field, no fold | yes; technical line "Wiederherstellungsphrase" | reworded; fixed dead end: visible, not folded (DE 4) |
| A-023 | Textfeld ohne Beschriftung (24 Wörter) | U-OPEN | yes; label "Deine 24 Wörter" | yes | fixed dead end: labelled field (DE 4) |
| A-024 | "Öffnen" | U-OPEN | yes: "Entsperren" | yes | reworded (Dup 6) |

### 2.4 Locked (P:312-324)

| ID | Today | v0.2 place | Standard | Technisch | Change |
|---|---|---|---|---|---|
| A-025 | "Willkommen zurück" | U-LOCKED | yes | yes | same |
| A-026 | "Entsperre mit deinem Passkey, dann siehst du …" | U-LOCKED | yes | yes | same |
| A-027 | "Mit Passkey entsperren" | U-LOCKED | yes | yes | same |
| A-028 | "Warte auf den Passkey …" | U-LOCKED | plain: plus buttons "Abbrechen" / "Mit den 24 Wörtern" | yes | fixed dead end: cancel + direct button (DE 3) |
| A-029 | Aufklapper "Mit Wiederherstellungsphrase entsperren" | U-LOCKED | yes: "Mit den 24 Wörtern entsperren", visible | yes; technical line "Wiederherstellungsphrase" | reworded; shown as labelled field, not a closed fold |
| A-030 | Textfeld ohne Beschriftung | U-LOCKED | yes; label "Deine 24 Wörter" | yes | fixed: labelled field |
| A-031 | "Entsperren" | U-LOCKED | yes | yes | same |
| A-032 | "Diesen Browser vergessen" | M-KEYS, U-LOCKED | plain: behind "Probleme beim Entsperren?", says what is removed | yes | moved to Mehr → Schlüssel & Geräte, still reachable when locked (DE 6) |
| A-033 | "Diesen Tresor in diesem Browser vergessen? …" | G-DIALOG | plain: "die 24 Wörter"; tick "Ich habe meine 24 Wörter" | yes | dialog; fixed dead end: tick required before forgetting (DE 6) |

### 2.5 Recovery phrase shown / confirmed (P:326-341)

| ID | Today | v0.2 place | Standard | Technisch | Change |
|---|---|---|---|---|---|
| A-034 | "Wiederherstellungsphrase" | U-PHRASE | plain: "Deine 24 Wörter" | yes; technical line "Wiederherstellungsphrase" | reworded |
| A-035 | "Schreib sie auf Papier … nur jetzt angezeigt." | U-PHRASE | yes | yes | fixed dead end: lock, home link and reload ask first (DE 1) |
| A-036 | Liste der 24 Wörter | U-PHRASE | yes | yes | same; guarded against leaving/locking (DE 1) |
| A-037 | "Aufgeschrieben" | U-PHRASE | yes | yes | same |
| A-038 | "Zur Probe, von deinem Zettel:" | U-PHRASE | yes | yes | same |
| A-039 | drei Felder "Wort {n}" | U-PHRASE | yes; each field shows right/wrong | yes | fixed dead end: per-word feedback (DE 2) |
| A-040 | "Stimmt" | U-PHRASE | yes; always clickable, names the wrong word | yes | fixed dead end: feedback instead of a silent disabled button (DE 2) |
| A-041 | "Wörter noch einmal zeigen" | U-PHRASE | yes | yes | same |

### 2.6 Unlocked: tabs, banner, glance, cards (P:343-423)

| ID | Today | v0.2 place | Standard | Technisch | Change |
|---|---|---|---|---|---|
| A-042 | Reiter "Übersicht" / "Erweitert" | G-HEAD, M-SET | yes: switch "Standard / Technisch" | yes | reworded; additive switch instead of two tabs with different layout |
| A-043 | "Deine bezahlte Laufzeit endet am {Datum}. …" | G-ALERT, P-STATE | yes | yes; exact end time as technical line | same text; alert carries its own button (Dup 7: detail only at P-STATE) |
| A-044 | "Zum Paket" | G-ALERT | yes; as the alert's button | yes | merged into the alert A-043 as its button |
| A-045 | "Auf einen Blick" | T-GLANCE | no (status is at S-STATUS) | yes; one overview table in System | moved; merged with the setup overview A-077 (Dup 1) |
| A-046 | Zeile "Paket" → "{h} h übrig" / "endet …" | T-GLANCE, P-STATE | plain: sentence "Dein Paket reicht noch …" at P-STATE | yes; row with link to P-STATE | moved; chip "endet" only links, no third period-end text (Dup 7) |
| A-047 | Zeile "Paperless-ngx" → "läuft" / "aus" … | T-GLANCE, S-STATUS | plain: headline of the status card | yes; row with phase word | moved |
| A-048 | Zeile "Sicherungen" → "{Datum} · {n} Kopien" | T-GLANCE, B-LAST | plain: "Letzte Sicherung: … , {n} Kopien" at B-LAST | yes; row links to Sicherung | merged with A-082 (Dup 1); link lands in Sicherung |
| A-049 | Zeile "Adresse" → Host / "feste Adresse" | T-GLANCE, S-ACCESS | plain: "Adresse deines Paperless" at S-ACCESS while running | yes; row with host, links to T-ADDR | merged with A-084 (Dup 1); fixed dead end: link opens T-ADDR (DE 8) |
| A-050 | Zeile "Zahlweg" → "Le Space, aus dem Paket" … | T-GLANCE, P-STATE | plain: "Bezahlt wird aus deinem Paket" at P-STATE | yes; row links to P-PAYER.T | merged with A-078, one wording (Dup 1); fixed dead end: exact link (DE 8) |
| A-051 | Einbindung `Lifecycle` (Karte Paperless) | S-STATUS | yes | yes; .T panels below the same card | same component; additive panels instead of the `simple` layout switch |
| A-052 | Einbindung `Package` (Karte Paket) | P-STATE | yes | yes | moved into its own area "Paket" |
| A-053 | "Technisch" · "Für Fortgeschrittene. …" | G-NAV, T-GLANCE | no | yes; becomes the area "System" with the purpose line | moved; card becomes a navigation area |
| A-054 | Aufklapper "Schlüssel und Passkeys" | M-KEYS | yes: "Schlüssel & Geräte" | yes; M-KEYS.T adds address and derivation | moved; fixed dead end: reachable in Standard (DE 9) |
| A-055 | "Entsperrt. Schlüssel dieser App für Aleph:" 0x… | M-KEYS.T | no | yes; with copy button, the one place for this address | moved; name "Adresse der App"; survivor of Dup 3 |
| A-056 | "Dein Browser leitet diesen Schlüssel … ab" | M-KEYS.T | no (plain form is A-014 "Nur du hast den Schlüssel") | yes | same; survivor of Dup 4 |
| A-057 | Aufklapper "Weiteren Passkey hinzufügen" | M-KEYS | yes: "Weiteres Gerät hinzufügen", visible card | yes | reworded; fixed dead end: no fold-in-fold, in Standard (DE 9) |
| A-058 | "Ein Passkey gehört zu einer Adresse ({host}). …" | M-KEYS | plain: "Am neuen Gerät mit den 24 Wörtern öffnen, dann hier" | yes; adds host/address explanation | reworded |
| A-059 | "Passkey für {host} anlegen" | M-KEYS | plain: "Passkey für dieses Gerät anlegen" | yes; host in the technical line | reworded |
| A-060 | "Neuer Passkey für {host} angelegt; …" | M-KEYS | plain: "Neuer Passkey angelegt. Dieser Browser nutzt ihn ab jetzt." | yes; adds host | reworded |
| A-061 | "Deine Wallet bei Aleph und Filecoin" | P-CRYPTO.T | no (its warnings reach Standard via A-064 … A-066) | yes | moved to Paket |
| A-062 | "Meine VMs" | T-VMS, G-ALERT | plain: only the alert "Eine zweite Maschine kostet Geld" + button | yes; full list, adopt, delete | moved; stray machine raises G-ALERT in both views |
| A-063 | "Einrichtung" + "es fehlt etwas" / "vollständig" | T-GLANCE, S-STATUS | plain: missing item as a task with button at S-STATUS | yes; chip on the System table | moved; fold dissolved into System sections (Dup 2) |
| A-064 | "Guthaben {money}" · "reicht ca. {time}" | P-STATE, P-CRYPTO.T | plain: "Dein Guthaben reicht noch ca. {time}" | yes; amounts and unit at P-CRYPTO.T | moved to Paket |
| A-065 | "Für einen Start reicht es gerade nicht …" | G-ALERT, P-MONEY | plain: + button "Paket wählen" / "Stunden kaufen" | yes; adds amount missing | fixed dead end: button instead of "Details unter Erweitert" (DE 7, Dup 14) |
| A-066 | "Das Guthaben für die Sicherungen geht bald …" | G-ALERT, P-BACKUP | plain: + button "Sicherung verlängern" | yes; adds payer and date; link to B-SETUP.T | fixed dead end: button instead of a text pointer (DE 7, Dup 14) |
| A-067 | Fehlerzeile mit roher Meldung | G-ERR | plain: sentence + next-step button | yes; "Details" with the raw message | reworded; error pattern with action |
| A-068 | Einbindung `Help` | M-HELP | yes | yes | moved from the page foot to Mehr → Hilfe |
| A-069 | Einbindung `BuildInfo` | G-FOOT, M-BUILD.T | yes: legal links + version | yes; commit, CID, source | same; build detail moved to M-BUILD.T |

### 2.7 Setup (S), only under Erweitert → Technisch → Einrichtung

| ID | Today | v0.2 place | Standard | Technisch | Change |
|---|---|---|---|---|---|
| A-070 | Überschrift "Einrichtung" | MERGED→T-GLANCE | no | no (duplicate of A-063) | merged (Dup 2) |
| A-071 | "Wo die Einrichtung liegt: verschlüsselt auf Aleph …" | T-PROFILE, M-SET | plain: one line "Deine Einstellungen sind auf jedem Gerät da" | yes; full section | moved; fold becomes a System section |
| A-072 | "Jede Änderung hier wird in diesem Browser verschlüsselt …" | T-PROFILE | no | yes | same |
| A-073 | "Drin sind: zahlendes Konto, Netz, Relays …" | T-PROFILE | no | yes | same |
| A-074 | "Aleph sieht nur einen verschlüsselten Block … Mehr: …" | T-PROFILE | no | yes | same |
| A-075 | "Warte auf MetaMask …" | P-PAYER.T | no (no wallet in Standard) | yes; with "Abbrechen" | fixed dead end: cancel button re-enables the wallet buttons (DE 11) |
| A-076 | "Lade Einstellungen …" | T-GLANCE, G-ERR | plain: on failure "Einstellungen nicht geladen" + "Erneut versuchen" | yes; Details with the raw error | fixed dead end: retry button (DE 10) |
| A-077 | zweites "Auf einen Blick" | MERGED→T-GLANCE | no | no (duplicate of A-045) | merged (Dup 1) |
| A-078 | Zeile "Zahlung" → "Le Space, aus deinem Paket" … | MERGED→T-GLANCE | plain: via A-050 at P-STATE | no (duplicate of A-050) | merged, wording of A-050 (Dup 1) |
| A-079 | Zeile "Aleph-Freigabe" → "freigegeben" … | T-GLANCE | no | yes; row links to P-GRANTS.T | moved |
| A-080 | Zeile "Filecoin-Schlüssel" → "gültig bis {Datum}" | T-GLANCE | no | yes; row links to P-GRANTS.T | moved |
| A-081 | Zeile "Attest-Relay" → "von Le Space ({n} gefunden)" | T-GLANCE | no | yes; state word only, links to T-RELAY | moved; found list only at T-RELAY (Dup 13) |
| A-082 | Zeile "Sicherungen" → "an, bezahlt bis {Datum}" | MERGED→T-GLANCE | plain: via A-048 at B-LAST | no (duplicate of A-048) | merged (Dup 1); "bezahlt bis" only at B-SETUP.T / P-BACKUP (Dup 13) |
| A-083 | Zeile "Image" → "eigenes, gebaut am {Datum}" | T-GLANCE | no | yes; row links to T-IMAGE | moved; the one lasting "gebaut am" statement (Dup 12) |
| A-084 | Zeile "Feste Adresse" → "eingerichtet" / "keine" | MERGED→T-GLANCE | plain: via A-049 at S-ACCESS | no (duplicate of A-049) | merged (Dup 1) |
| A-085 | "Ändern" | T-GLANCE | no | yes; each row opens its exact section | fixed dead end: precise targets, no closed folds (DE 8) |
| A-086 | Auswahl "Netz": Test / Produktiv | T-NET | no (fixed by the package) | yes | moved to System |
| A-087 | "Rolle dieser Instanz": Test / Produktiv | T-NET | no (never asked) | yes | moved to System |
| A-088 | "Diese Instanz produktiv machen? …" | G-DIALOG | no | yes; dialog offers "Netz auf Mainnet umstellen" | dialog; fixed dead end: offers the network switch (DE 13) |
| A-089 | "Nur eine Instanz darf produktiv sein. …" | T-NET | no | yes; with button "Auf Mainnet umstellen" | fixed dead end: warning carries a button (DE 13) |
| A-090 | "Gespeichert ✓" oder rohe Fehlermeldung | G-ERR | plain: "Gespeichert ✓" beside the action; errors with button | yes; "Details" with the raw message | same pattern, error part reworded |
| A-091 | "{n}. Wer zahlt die VM?" | P-PAYER.T | no (preset, shown as sentence, see A-092) | yes | moved to Paket; step fold becomes a section |
| A-092 | "Le Space, aus meinem Paket: keine Wallet …" | P-PAYER.T, P-STATE | plain: read-only "Bezahlt wird aus deinem Paket" | yes; as a choice | moved |
| A-093 | "Meine Wallet (MetaMask), mit einer Freigabe …" | P-PAYER.T | no | yes | moved |
| A-094 | "Diese App selbst: Aleph-Credits liegen …" | P-PAYER.T | no | yes | moved |
| A-095 | "Aleph selbst bezahlen, ohne Paket (für Fortgeschrittene)" | P-PAYER.T | no | yes; visible text, no fold | moved |
| A-096 | "Die VM läuft auf Aleph. Statt über ein Paket …" | P-PAYER.T | no | yes; key sentence replaced by a link to M-KEYS.T | moved; repeated sentence merged (Dup 4) |
| A-097 | "Le Space bezahlt deine VM …" + "Konto für deine VM" | P-PAYER.T, P-STATE | plain: first sentence only, no address | yes; with the account address and copy | moved |
| A-098 | "Adresse der App:" 0x… + "Hier liegen deine Aleph-Credits …" | P-PAYER.T | no | yes; note stays, address is a link to M-KEYS.T | moved; address and key sentence merged (Dup 3, Dup 4) |
| A-099 | "Eine Wallet brauchst du so nur für Sicherungen …" | P-PAYER.T | no | yes; "Schritt n" becomes a link to B-SETUP.T | moved; pointer becomes a link |
| A-100 | "Verbunden:" 0x… + "Hier liegen deine Mittel …" | P-PAYER.T | no | yes | moved |
| A-101 | "Wallet verbinden" / "Anderes Wallet verbinden" | P-PAYER.T | no | yes | moved; stays usable after cancel (DE 11) |
| A-102 | "{n}. Aleph: diese App darf VMs starten …" | P-GRANTS.T | no | yes | moved |
| A-103 | "App-Schlüssel:" 0x… + "Hält keine Mittel …" | P-GRANTS.T | no | yes; note stays, address named "Adresse der App", links to M-KEYS.T | moved; address merged (Dup 3) |
| A-104 | "freigegeben (INSTANCE, FORGET, Port-Freigaben)" | P-GRANTS.T | no | yes | moved |
| A-105 | "Freigabe zurücknehmen" / "In der Wallet freigeben" | P-GRANTS.T | no | yes | moved |
| A-106 | "{n}. Filecoin: Sicherungen hinzufügen" | P-GRANTS.T | no | yes | moved |
| A-107 | "Sitzungsschlüssel:" 0x… + "Hält keine Mittel …" | P-GRANTS.T | no | yes | moved |
| A-108 | "gültig bis {Datum}" / "nicht freigegeben" | P-GRANTS.T, B-SETUP.T | no | yes; state also shown at B-SETUP.T | moved |
| A-109 | "Für 30 Tage freigeben" / "Um 30 Tage verlängern" | P-GRANTS.T | no | yes | moved |
| A-110 | "Zurücknehmen" | P-GRANTS.T | no | yes | moved |
| A-111 | "{n}. Attest-Relay" | T-RELAY | no | yes | moved to System |
| A-112 | "Mehr dazu": "Die App findet die Relays …" | T-RELAY | no | yes; visible text, no fold | moved; "Mehr dazu" fold removed (Dup 15) |
| A-113 | "Gefunden:" Liste der Relays / "keins …" | T-RELAY | no | yes | moved; the one place for the found list (Dup 13) |
| A-114 | Feld "Eigene Relays (optional), eins pro Zeile …" | T-RELAY | no | yes | moved |
| A-115 | "Relays speichern" / "Eigene Relays entfernen" | T-RELAY | no | yes | moved |
| A-116 | "{n}. Sicherungen" | B-SETUP.T, B-LAST | plain: state "Sicherungen: an" in the B-LAST sentence | yes; full section | moved to Sicherung |
| A-117 | "Bezahlt aus meinem Wallet" / "… über Le Space Credits" | B-SETUP.T | no | yes | moved |
| A-118 | "Schlüssel der VM für die Sicherungen:" 0x… | B-SETUP.T | no | yes | moved |
| A-119 | "Bezahlt bis {Datum}" · "{n} Datensätze" · VM-Schlüssel | B-SETUP.T, P-BACKUP | plain: "Sicherung bezahlt bis {Datum}" at P-BACKUP | yes; data sets and key state | moved; the one place for "bezahlt bis" (Dup 13) |
| A-120 | "Einen Monat Sicherungen bezahlen" | B-SETUP.T, G-DIALOG | plain: via the booking line at P-BACKUP, price shown | yes; button with price | dialog; fixed dead end: price + confirm before spending (DE 16) |
| A-121 | "Nur ohne Paket nötig: In jedem Paket …" | B-SETUP.T | no | yes | moved |
| A-122 | "VM-Schlüssel freigeben" | B-SETUP.T, B-HEALTH | plain: task "Sicherung fertig einrichten" + button at B-HEALTH | yes; named button | moved; Standard gets a plain task so backups cannot stay off |
| A-123 | Feld "Wallet, dem die Sicherungen gehören (0x…)" | B-SETUP.T | no | yes | moved |
| A-124 | "Wallet der Sicherungen speichern" | B-SETUP.T | no | yes | moved |
| A-125 | "Mehr dazu": "Schlüssel der Sicherungen (age): …" | B-SETUP.T | no | yes; visible text, no fold | moved; "Mehr dazu" fold removed (Dup 15) |
| A-126 | "der Schlüssel des Tresors (die 24 Wörter genügen …)" | B-SETUP.T, B-HEALTH | plain: "Die 24 Wörter genügen"; pasted key: warning + button | yes; three states | moved; pasted-key case gets a plain warning (data-loss risk) |
| A-127 | "Empfänger:" age1… | B-SETUP.T | no | yes | moved |
| A-128 | "Schlüssel des Tresors verwenden (empfohlen)" | B-SETUP.T, G-DIALOG | plain: as the button of the pasted-key warning (A-126) | yes | dialog replaces the native confirm |
| A-129 | "Einen vorhandenen Schlüssel einfügen" · "Versiegelt hinterlegen" | B-SETUP.T | no | yes | moved |
| A-130 | "Sichern, alle zwei Stunden bei Änderungen …" | B-SETUP.T, B-LAST | plain: schedule sentence; if off: warning + "Sicherung einschalten" | yes; switch with network and data-set label | fixed dead end: reason beside the disabled switch + link to T-NET (DE 12) |
| A-131 | Baustein `BackupPlaces` (Sicherungsorte) | B-PLACES.T | no | yes | moved |
| A-132 | "Paperless läuft: Geänderte Sicherungsorte …" + Knopf | B-PLACES.T | no | yes | moved |
| A-133 | "Auf Mainnet sichert nur eine produktive Instanz …" | B-SETUP.T | no | yes; placed beside the switch, "Rolle" is a link to T-NET | fixed dead end: reason moved next to the switch (DE 12) |
| A-134 | "Dafür braucht es eine bezahlte Sicherung …" | B-SETUP.T, B-HEALTH | plain: same task as A-122, with button | yes; both actions as buttons in the hint | reworded; quoted button name becomes a real button |
| A-135 | "Dafür braucht die VM den Sitzungsschlüssel …" | B-SETUP.T | no | yes; "Schritt n" becomes a button to P-GRANTS.T | pointer becomes a link |
| A-136 | "Le Space Credits sichern gerade im {Netz} …" | G-ERR | plain: "Es wurde nichts abgebucht." + "Erneut versuchen" | yes; Details with both networks | reworded; error pattern with action |
| A-137 | "{n}. Paperless-anywhere-Image und Knoten" | T-IMAGE | no | yes | moved to System |
| A-138 | "Welches Image?" eigenes / öffentliches | T-IMAGE | no (always the own image) | yes | moved |
| A-139 | "Mehr dazu": "Warum: Eine Passphrase gilt für alle …" | T-IMAGE | no | yes; visible text, no fold | moved; "Mehr dazu" fold removed (Dup 15) |
| A-140 | "Tipp: Mit einem eigenen Image kennt niemand …" | T-IMAGE | no | yes | moved |
| A-141 | "Im Echtbetrieb ist das eigene Image Pflicht …" | T-IMAGE | no | yes | moved |
| A-142 | Feld "Image (STORE-Hash, 64 Zeichen)" | T-IMAGE | no | yes | moved |
| A-143 | Feld "SEV-SNP-Knoten (Hash, 64 Zeichen)" | T-IMAGE | no | yes | moved |
| A-144 | Feld "Passphrase des Images" (leer = behalten) | T-IMAGE | no | yes; explicit "Behalten" / "Ändern" | fixed dead end: empty field no longer carries a meaning (DE 14) |
| A-145 | "Image und Knoten speichern" / "Knoten speichern" | T-IMAGE | no | yes | moved |
| A-146 | "Wird beim ersten Start gebaut (etwa 15 Minuten …)" | T-IMAGE, S-STATUS | plain: once before the first start: duration, keep window open | yes; plus "jetzt schon bauen" | moved; Standard hears it at S-STATUS |
| A-147 | "Noch nicht gebaut: Bau es hier mit …" | T-IMAGE | no | yes; warning carries the build button | reworded; quoted button name becomes a real button |
| A-148 | "Mehr dazu": "Ein Image nur für diesen Tresor: …" | T-IMAGE | no | yes; visible text; address is a link to M-KEYS.T | moved; address merged (Dup 3), fold removed (Dup 15) |
| A-149 | "Woraus und womit wird gebaut?" (fünf Werte) | T-IMAGE | no | yes | moved |
| A-150 | "Geschafft: Dein Image ist nur für deinen Tresor …" | MERGED→S-FIRST | plain: via the finale A-186 | no (duplicate of A-186; date stays in A-083) | merged (Dup 12) |
| A-151 | "Ein altes eigenes Image ist noch nicht entfernt …" | T-IMAGE | no; removing an image is never offered in Standard (a sealed profile may still point at it) | yes; count, hashes, guarded "Jetzt entfernen" | moved; stays a deliberate, technical action |
| A-152 | "Guthaben der App-Adresse wird geprüft …" | T-IMAGE | no | yes | moved |
| A-153 | "Ein Bau kostet {Preis} … Es fehlen {Betrag}." | G-ALERT, T-IMAGE | plain: "Guthaben reicht nicht" + "Aufladen" / "Neu prüfen" | yes; price, shortfall, raw reason | moved; "start not affordable" alert with buttons |
| A-154 | "Ein eigenes Image braucht derzeit Aleph-Guthaben …" | G-ALERT, T-IMAGE | plain: "Guthaben fehlt" + "So lade ich auf" / "Neu prüfen" | yes; need/have, link to M-KEYS.T and P-CRYPTO.T | fixed dead end: button to where to top up (DE 15) |
| A-155 | "Dieser Bau ist enthalten …" / "Ein Bau kostet {Preis} …" | T-IMAGE, S-STATUS | plain: cost sentence before the first start | yes; attempts and build-service detail | moved; money sentence kept in Standard |
| A-156 | "Mein Image bauen" / "Mein Image neu bauen" | T-IMAGE, G-DIALOG | plain: built at the first start; price question as dialog | yes; build and rebuild button | dialog replaces the native confirm |
| A-157 | "Erst möglich, wenn Paperless gestoppt ist. …" | T-IMAGE | no | yes; with button "Sichern und beenden" (S-STOP) | reworded; quoted action becomes a button |
| A-158 | Statuszeile "{Schritt} …" beim Bau | MERGED→S-FIRST.T | plain: via the stations A-173 | no (duplicate of A-178) | merged: one progress display for a build (Dup 12) |
| A-159 | Fehlerbox `ownImage.error.*` (22 Meldungen) | G-ERR, S-FIRST | plain: sentence + "Erneut versuchen" | yes; "Details" with the raw message | reworded; error pattern with retry |
| A-160 | "{n}. Feste Adresse (optional)" | T-ADDR | no | yes | moved to System |
| A-161 | "Mit einem Cloudflare-API-Token (Zone 2n6.me …)" | T-ADDR | no | yes | moved |
| A-162 | Feld "Cloudflare-API-Token" | T-ADDR | no | yes | moved |
| A-163 | "Token speichern" / "Token entfernen" | T-ADDR, G-DIALOG | no | yes; separate button "Token entfernen" with dialog | fixed dead end: own remove button, not "save empty" (DE 14) |
| A-164 | "Für Entwickler: Netz (…), Rolle, Relay, Sicherungs-Details" | MERGED→T-NET | no | no (fold dissolved; network shown once at T-NET) | merged: the view switch replaces this fold (Dup 13) |
| A-165 | rohe Fehlermeldung beim Laden | G-ERR | plain: "Einstellungen nicht geladen" + "Erneut versuchen" | yes; "Details" with the raw message | fixed dead end: retry button (DE 10) |
| A-166 | gekürzter Wert + "Kopieren" → "Kopiert ✓" | M-KEYS.T, P-PAYER.T | no (raw addresses never show; same feedback at S-ACCESS) | yes; on every address and hash | same pattern in all .T places |

### 2.8 FirstStart overlay (F), mounted from Lifecycle, both tabs

| ID | Today | v0.2 place | Standard | Technisch | Change |
|---|---|---|---|---|---|
| A-167 | Leiste "Dein Build-Dienst wacht auf" · "{pct} % · noch ca. …" | S-FIRST | plain: station texts without "Build-Dienst" / "Image" | yes; today's station texts | reworded; bar stays on failure with "Erneut versuchen" (DE 17) |
| A-168 | "Ansehen" | S-FIRST | yes | yes | same |
| A-169 | Vollbild-Dialog (dunkel) | S-FIRST | yes | yes | same |
| A-170 | "Dein erster Start · ca. 25 Minuten insgesamt" + "Dein eigenes Image entsteht" | S-FIRST | plain: same full-screen journey; title without "Image" | yes; today's heading | kept as the full-screen journey in both views; reworded in Standard |
| A-171 | "Verkleinern" | S-FIRST | yes | yes | same |
| A-172 | "Schließen" (bei Fehler) | S-FIRST | yes; next to "Erneut versuchen" | yes | fixed dead end: no longer the only button (DE 17) |
| A-173 | Stationen "Build-Dienst" / "Echtheit" / "Siegel" / "Abholen" … | S-FIRST | yes; the six stations with circles, check marks and durations; plain labels | yes; today's labels | same stations and animation; plain labels in Standard |
| A-174 | Lichterreihe (Zierde) | S-FIRST | yes; the row of lights as today | yes | same |
| A-175 | "Schritt {n} von {m} · {Dauer}" | S-FIRST | yes | yes | same |
| A-176 | "Kurz innegehalten" · "Den Grund siehst du in der Karte …" | S-FIRST, G-ERR | plain: reason as a sentence + "Erneut versuchen" | yes; "Details" with the raw message/log | fixed dead end: reason and retry in the overlay (DE 17) |
| A-177 | "Dein persönlicher Build-Dienst wacht auf" + Text | S-FIRST | plain: today's warm texts, jargon words replaced | yes; today's texts | reworded in Standard only |
| A-178 | 19 Unterschritte ("… V-PROGRAM …", "Mit LUKS versiegelt …") | S-FIRST.T | no | yes | same, technical view only |
| A-179 | "{n} Verbindungen bestätigt" · "{x} von {y} MiB" … | S-FIRST.T | no (percent stays, A-181) | yes | same, technical view only |
| A-180 | "Die Verbindung ist abgerissen – kein Problem: …" | S-FIRST | plain: without "Image" | yes; adds attempt count | reworded |
| A-181 | "{pct} % abgeholt" | S-FIRST | yes | yes | same |
| A-182 | Schaubild "Was gerade wohin fließt: …" | S-FIRST | yes; the animated diagram with plain place names | yes; today's names, share in percent | kept in both views; plain names in Standard |
| A-183 | "Belege – zum Nachprüfen" (bis 11 Zeilen) | S-FIRST.T, S-PROOF | plain: one line "Geprüft: echte, verschlüsselte Maschine" | yes; all rows with links | same rows; Standard gets the one-line proof |
| A-184 | "Die Hardware dahinter": zwei AMD-Links | S-FIRST.T | no | yes | same, technical view only |
| A-185 | "{pct} % geschafft" · "noch ca. {n} Min. …" · "Dein Bildschirm bleibt an. …" | S-FIRST | yes | yes | same |
| A-186 | "Geschafft – deine Paperless läuft!" + Text | S-FIRST | plain: without "Passphrase": "Nur dein Tresor kann sie öffnen" | yes; today's text | reworded; the one success message (Dup 12) |
| A-187 | "Paperless öffnen" | S-FIRST, S-ACCESS | yes | yes | same |
| A-188 | "Deine Urkunde ansehen" | S-FIRST, S-PROOF | yes | yes; also a lasting link at S-PROOF.T / T-IMAGE | same; stays reachable after the finale |
| A-189 | "Schließen" (am Ende) | S-FIRST | yes | yes | same |
| A-190 | "Dein Image entsteht gerade. Wenn du … verlässt …" | S-FIRST | plain: "Dein Paperless wird gerade eingerichtet. …" | yes | reworded (browser's own dialog stays) |
| A-191 | Tab-Titel "{pct} % · Dein Image entsteht" | S-FIRST | plain: "{pct} % · Paperless wird eingerichtet" | yes | reworded |
| A-192 | Bildschirm bleibt an (Wake Lock) | S-FIRST | yes | yes | same |
| A-193 | "Ein Image lässt sich bauen, wenn Paperless gestoppt ist." u. a. | G-ERR, S-PROOF | plain: sentence + button ("Seite neu laden", "Sichern und beenden") | yes; "Hardware-Prüfung bestanden" at S-PROOF.T | reworded; each message gets its button |

### 2.9 Help (H), at the foot of the app, all states

| ID | Today | v0.2 place | Standard | Technisch | Change |
|---|---|---|---|---|---|
| A-194 | "Hilfe & Support" | M-HELP | yes | yes | moved to Mehr; before unlock reachable from G-FOOT |
| A-195 | "Fragen, ein Problem, etwas klemmt? Schreib uns:" | M-HELP | yes | yes | same |
| A-196 | "Zu Zahlung, Rechnung, Gutschein und Credits:" | M-HELP | plain: "Guthaben" statt "Credits" | yes | reworded |
| A-197 | "Rechtliches (Widerruf, Kündigung, Anbieter) …" | M-HELP, M-LEGAL | yes | yes | same |
| A-198 | "Le Space fragt nie nach deinen Geheimnissen" | M-HELP | plain: short list (24 Wörter, Passwörter, Codes) | yes; full list (Seed-Phrase, Passphrase, DNS-Token) | reworded for Standard, full text in Technisch |
| A-199 | "Was du mitschickst" · "… Dazu die Diagnose der App" | M-HELP | plain: "Fehlerbericht" statt "Diagnose" | yes | reworded |
| A-200 | "Diagnose kopieren" | M-HELP | yes: "Fehlerbericht kopieren" | yes | reworded |
| A-201 | "Kopiert. Füg sie in deine Mail ein." / "Kopieren ging nicht …" | M-HELP | yes | yes | same; failure shows the text to mark |
| A-202 | "Was die Diagnose enthält" + Diagnosetext | M-HELP | plain: one sentence; raw text only if copying fails | yes; text always viewable | reworded; raw text hidden in Standard except as fallback |
| A-203 | "Selbst nachlesen": "Häufige Fragen" · "Eine Sicherung selbst holen …" | M-HELP, B-EXPORT | plain: FAQ here; restore guide at "Dokumente herunterladen" | yes; both links | fixed dead end: FAQ opens in a new tab, vault stays open (DE 18) |
| A-204 | "Sicherheitslücken melden" + drei Links | M-HELP | no | yes | same, technical view only |

### 2.10 Footer BuildInfo (B), all states

| ID | Today | v0.2 place | Standard | Technisch | Change |
|---|---|---|---|---|---|
| A-205 | "Quelltext von Paperless anywhere auf GitHub" | M-BUILD.T | no | yes | moved; the one source link (Dup 5) |
| A-206 | "Über Paperless anywhere" | M-LEGAL | yes | yes | fixed dead end: opens in a new tab, vault stays open (DE 18) |
| A-207 | "Impressum" | G-FOOT, M-LEGAL | yes | yes | same |
| A-208 | "Datenschutz" | G-FOOT, M-LEGAL | yes | yes | same |
| A-209 | "Lizenzen" | G-FOOT, M-LEGAL | yes | yes | same |
| A-210 | "Hilfe & Support" (Sprungmarke) | G-FOOT, M-HELP | yes | yes | same; opens Mehr → Hilfe, before unlock the help page itself |
| A-211 | "Verträge hier kündigen" | G-FOOT, P-LEGAL | yes (verbatim, German in both languages) | yes | same; stays reachable when locked (Dup 8 kept on purpose) |
| A-212 | "{version} · {Datum, Uhrzeit} · {commit}" | G-FOOT, M-BUILD.T | plain: version only | yes; date, time, commit | same; commit only in Technisch |
| A-213 | "IPFS: {cid}" | G-FOOT, M-BUILD.T | no | yes | same; one CID lookup shared with the error report (Dup 9) |

### 2.11 Terms (T) and Waiver (W), inside the Package card (both tabs)

| ID | Today | v0.2 place | Standard | Technisch | Change |
|---|---|---|---|---|---|
| A-214 | "Neue Bedingungen (AGB): bitte zustimmen" | P-LEGAL | yes (verbatim) | yes | fixed dead end: if loading fails, sentence + "Erneut laden" (DE 19) |
| A-215 | "Die Bedingungen liegen auf Deutsch vor." | P-LEGAL | yes | yes | same |
| A-216 | Rechtssatz zu "fällig" / "angekündigt" | P-LEGAL | yes (verbatim) | yes | same |
| A-217 | Liste der Änderungen (vom Dienst) | P-LEGAL | yes (verbatim) | yes | same |
| A-218 | "Fassung {version} vom {Datum} lesen und herunterladen" | P-LEGAL | yes | yes | same |
| A-219 | Ankreuzfeld mit Zustimmungssatz | P-LEGAL | yes (verbatim) | yes | same |
| A-220 | "Zustimmen" | P-LEGAL | yes | yes | same |
| A-221 | rohe Fehlermeldung (Bedingungen) | P-LEGAL, G-ERR | plain: sentence + "Erneut versuchen" | yes; "Details" with the raw message | fixed dead end: load failure is shown with retry (DE 19) |
| A-222 | "Bedingungen: Fassung {version}, zugestimmt am {Datum} · lesen" | P-LEGAL | yes | yes | same |
| A-223 | Ankreuzfeld mit Widerrufserklärung (§ 356 BGB) | P-LEGAL, P-MONEY | yes (verbatim) | yes | same; shown at each purchase as today |

### 2.12 Licences page (L), `/lizenzen/`, standalone

| ID | Today | v0.2 place | Standard | Technisch | Change |
|---|---|---|---|---|---|
| A-224 | Logo "LE SPACE Paperless anywhere" | M-LEGAL | yes | yes | same |
| A-225 | "DE" / "EN" (Gruppe "Language") | M-LEGAL, M-SET | yes; group label translated ("Sprache") | yes | merged: one shared language switch (Dup 10) |
| A-226 | "Lizenzen" · "Paperless anywhere ist ein Angebot …" | M-LEGAL | yes | yes | same |
| A-227 | "Paperless-ngx" · Version, Quellcode, Lizenz … | M-LEGAL | yes (legal text, verbatim) | yes | same |
| A-228 | "Weitere Software in der VM" (Tabelle) | M-LEGAL | yes (legal text, verbatim) | yes | same |
| A-229 | "Diese Web-App" + zwei Links | M-LEGAL | yes (legal text, verbatim) | yes | same |
| A-230 | "Text der GPL-3.0" · "Lizenztext anzeigen …" | M-LEGAL | yes (verbatim) | yes | same |
| A-231 | "Zur Startseite" · "Impressum" · "Datenschutz" · Stand | M-LEGAL | yes | yes | fixed dead end: adds a link "Zurück zur App" (DE 20) |

---

## Count check

- Inventory IDs in the source (`A-shell-setup.md`, sections 2.1 … 2.12): **231** (A-001 … A-231)
- Rows in this table: **231**, same order, same twelve sub-headings
- Special codes used: MERGED 9 (A-004, A-070, A-077, A-078, A-082, A-084, A-150, A-158, A-164), TEST 1 (A-009), DEAD 0

### Unplaced

None. Three rows have no natural place code and were put at the nearest one; they are named here so the choice is visible:

- A-008 (browser tab title) → G-HEAD, as places.md has no code for the document title.
- A-166 (copy helper `Addr`) → M-KEYS.T / P-PAYER.T as examples; it is a pattern used in every `.T` place.
- A-224 … A-231 (standalone `/lizenzen/` page) → M-LEGAL, because that is where the link to it lives; the page itself has no view switch.

### Dead ends of section 3.3 and the rows that close them

| DE | Closed in row(s) | DE | Closed in row(s) |
|---|---|---|---|
| 1 | A-001, A-003, A-006, A-035, A-036 | 11 | A-075, A-101 |
| 2 | A-039, A-040 | 12 | A-130, A-133 |
| 3 | A-021, A-028 | 13 | A-088, A-089 |
| 4 | A-019, A-022, A-023 | 14 | A-144, A-163 |
| 5 | A-010, A-011 | 15 | A-154 |
| 6 | A-032, A-033 | 16 | A-120 |
| 7 | A-065, A-066 | 17 | A-167, A-172, A-176 |
| 8 | A-049, A-050, A-085 | 18 | A-003, A-203, A-206 |
| 9 | A-054, A-057 | 19 | A-214, A-221 |
| 10 | A-076, A-165 | 20 | A-231 |

## Open questions for Nico

1. **Showing the 24 words again later (DE 1).** The table only guards the screen against leaving. Can the app show the words again after unlock (M-KEYS "about the 24 words"), or is "only now" a hard property of the vault? If it is hard, should a vault whose words were never confirmed raise a lasting G-ALERT?
2. **People who pay with crypto, in Standard.** A-064, A-066, A-098, A-154 concern self-payers whose details live only in `.T` places (P-CRYPTO.T, P-PAYER.T). Should their Standard buttons switch the view to Technisch at the right place, or does a self-payer always start in Technisch?
3. **App address "shown once" (Dup 3).** I made M-KEYS.T the only place and turned A-098, A-103, A-148 into links. For "Diese App selbst zahlt" the person must send credits to exactly this address; is a link enough there, or should P-PAYER.T keep the address with a copy button?
4. **Overview rows versus their detail (Dup 1, 12, 13).** I treated T-GLANCE rows as an index (state word + link) and merged only the truly doubled rows (A-078, A-082, A-084) and A-150 / A-158 / A-164. Is that reading right, or should rows such as A-081 and A-083 also disappear in favour of T-RELAY / T-IMAGE?
5. **Backup lights before unlock (A-007).** Today they show on the locked screen from remembered provider ids. places.md moves them to B-HEALTH and a dot on G-NAV, and neither exists before unlock. Drop them while locked, or one sentence on U-LOCKED?
6. **Help before unlock (A-068, A-194, A-210).** Mehr → Hilfe exists only with the navigation. I assumed the footer link opens help directly while locked, and "Probleme beim Entsperren?" leads there too. Agreed?
7. **Old own image that costs storage (A-151).** I gave Standard a plain note with "Jetzt entfernen" because it costs storage. Does it cost a package customer anything at all? If not, it could be Technisch only. I did not propose automatic removal.
8. **Tagline in the header (A-002).** places.md lists logo, view switch and "Sperren" for G-HEAD, no tagline. Keep a plain tagline in Standard as mapped, or move it to M-LEGAL ("Über") on phones?
9. **Security reports (A-204) and vault-wide warnings in Standard.** I set "Sicherheitslücken melden" to Technisch only. places.md lists it under M-HELP without a `.T`; should Standard show a one-line version?
10. **Leaving the app by FAQ / "Über" (DE 18).** I chose "open in a new tab, vault stays open" for A-203 and A-206 and the dialog for the logo. Would you rather have the same dialog everywhere and stay in one tab (installed PWA on phones)?
