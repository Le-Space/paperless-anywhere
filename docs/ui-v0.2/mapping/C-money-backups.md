# Map C: package/money and backups → v0.2 places

Source: `C-money-backups.md` (269 rows, C-001 … C-328). Place codes from `places.md`.
"DE n" in the Change column = closes dead end n of section 3.3; "DUP n" = resolves duplicate n of section 3.1.
Technisch is a superset: "yes" = everything Einfach shows, same place; "+ …" = what is added.

### 2.1 Page-level items of this slice (routes/app/+page.svelte)

| ID | Today | v0.2 place | Einfach | Technisch | Change |
|---|---|---|---|---|---|
| C-001 | BackupLeds strip im Header | B-HEALTH, G-NAV | plain; one sentence + two lights, dot on "Sicherung" | yes; + per-provider detail in B-COPIES.T | moved out of header; locked state: open question 3 |
| C-002 | "Deine bezahlte Laufzeit endet am …" | G-ALERT | yes | yes | same; the one surviving period-end warning (DUP 1) |
| C-003 | "Zum Paket" | G-ALERT | yes; button on the alert | yes | reworded: real button to Paket area, not anchor |
| C-004 | Chip "Paket": "N h übrig" … | T-GLANCE | no; P-STATE and G-ALERT say the same | yes; row in overview table | moved; ending value links to G-ALERT (DUP 1) |
| C-005 | Chip "Sicherungen": "TT.MM. · N Kopien" | T-GLANCE | no; B-HEALTH and B-LAST say the same | yes; row in overview table | moved (DUP 2) |
| C-006 | "Deine Wallet bei Aleph und Filecoin" | P-CRYPTO.T | no | yes; section heading + euro chip | moved from Technisch fold to Paket |
| C-007 | "Guthaben 12,34 € reicht ca. 3 Tage" | P-MONEY | yes; same line, builds without credits service | yes; + source figures in P-CRYPTO.T | merged with balance line C-034 (DUP 12) |
| C-008 | "Für einen Start reicht es gerade nicht" | G-ALERT | yes; with button "Paket wählen" / "Aufladen" | yes; + reserve figure (C-175) | fixed dead end: button, no "Details unter Erweitert" (DE 3) |
| C-009 | "Guthaben für die Sicherungen geht bald zu Ende" | G-ALERT | yes; with button to the fix | yes; + runway and gas (C-179, C-182) | fixed dead end: button (DE 3); target see question 2 |

### 2.2 Package.svelte (card `#paket`, both tabs)

| ID | Today | v0.2 place | Einfach | Technisch | Change |
|---|---|---|---|---|---|
| C-010 | Karte ohne Titel | P-STATE | yes; visible heading "Dein Paket" | yes | fixed dead end: heading rendered, anchors match (DE 24) |
| C-011 | "…" | P-STATE | plain; "Lese dein Paket …" | yes | reworded |
| C-012 | "Le Space Credits antwortet 500" | G-ERR, P-STATE | plain; sentence + "Noch einmal versuchen" | yes; + "Details" with raw message | fixed dead end: retry; P-LEGAL stays visible (DE 1) |
| C-013 | "Du zahlst die Anbieter selbst." | P-STATE | plain; one sentence, plans listed below unfolded | yes; + link to P-PAYER.T | reworded; fold removed |
| C-014 | "Die Adresse der App … bezahlt die VM" | P-STATE | plain; "Du bezahlst die Maschine selbst" | yes; technical line names app address / wallet | reworded (Maschine / VM) |
| C-015 | Terms (Komponente) | P-LEGAL | yes | yes | moved: own section, blocking box stays on top |
| C-016 | "Paperless anywhere läuft über die Adresse der App" | P-STATE | plain; "Das Paket wird gerade nicht benutzt" | yes; + payer named, link P-PAYER.T | reworded |
| C-017 | "Das Paket wird dafür nicht verbraucht" | P-STATE | plain; with button "Aus dem Paket bezahlen" | yes; same button, + P-PAYER.T | fixed dead end: button sets payer via G-DIALOG (DE 2) |
| C-018 | "12 Stunden Laufzeit übrig, bis 30.11." | P-STATE | yes | yes | same |
| C-019 | Balken "Verbleibende Stunden" | P-STATE | yes | yes | same |
| C-020 | Alert in der Karte (wie C-002) | MERGED→G-ALERT | no; alert above shows it | MERGED→G-ALERT | merged (DUP 1); P-STATE keeps only the end date |
| C-021 | "Nur noch N Stunden in diesem Monat." | P-STATE | yes | yes | same |
| C-022 | "100 Stunden im Monat für 16,40 €" | P-STATE, G-DIALOG | yes | yes | dialog before leaving to Stripe; says unlock needed after (DE 5) |
| C-023 | "Gutschein-Zeitraum bis 24.11.2026." | P-STATE | plain; shortened, + buttons "Paket wählen", "Dokumente herunterladen" | yes; full text | fixed dead end: buttons; service limit see question 6 (DE 4) |
| C-024 | "Dein Abo: 15 Stunden für 6,40 €" | P-STATE | yes | yes | same |
| C-025 | "Dein Paket: 15 Stunden für 6,40 €" | P-STATE | yes; + warning with "Aufladen" if balance below renewal | yes | fixed dead end: new low-balance warning + button (DE 7) |
| C-026 | "Paket paperless-xyz" | P-STATE | plain; "Dein Paket" without the id | yes; + raw plan id in technical line | reworded |
| C-027 | "Verträge hier kündigen" | P-LEGAL | yes; always visible, no fold | yes | same; shown even when balance unreadable (DE 1) |
| C-028 | "Noch kein Paket" | P-STATE | yes | yes | same |
| C-029 | "Ein Paket gibt dir jeden Monat Stunden" | P-STATE | yes | yes | same |
| C-030 | Cancel (Komponente) | P-LEGAL | yes | yes | same; texts move to i18n unchanged |
| C-031 | "Vertrag widerrufen" | P-LEGAL | yes | yes | same |
| C-032 | Withdraw (Komponente) | P-LEGAL | yes | yes | same; texts move to i18n unchanged |
| C-033 | BackupLine (Komponente) | P-BACKUP | yes | yes | moved: own block in Paket |
| C-034 | "Guthaben 12,00 €" | P-MONEY | yes | yes | same; the one euro balance (DUP 12) |
| C-035 | "davon 1,20 € für die laufende Instanz vorgemerkt" | P-MONEY | plain; "Instanz" → "Maschine" | yes; "VM" | reworded |
| C-036 | "Aktualisieren" | P-MONEY | yes | yes | same; surviving refresh in Paket (DUP 5) |
| C-037 | "Gutschein einlösen" | P-PLANS | yes | yes | same |
| C-038 | "Ein Gutschein gibt dir einen Zeitraum" | P-PLANS | yes | yes | same |
| C-039 | Feld "Gutschein-Code" | P-PLANS | yes | yes | same |
| C-040 | "Einlösen" | P-PLANS | yes | yes | same |
| C-041 | "Paket als Monatsabo per Karte wählen" | P-PLANS | yes | yes | same |
| C-042 | "Sicherung inklusive: 3 verschlüsselte Kopien, bis 32 GiB" | P-PLANS | plain; "GB" instead of "GiB" | yes | reworded; one unit with B-STORAGE (DUP 11) |
| C-043 | "mit Sicherung (+ 1,50 € im Monat)" | P-PLANS | yes; starts unticked | yes | same |
| C-044 | Paketkarten "15 Stunden im Monat" … | P-PLANS | yes | yes | same; change of plan asks in G-DIALOG (DUP 14) |
| C-045 | "Empfehlung" | P-PLANS | yes | yes | same |
| C-046 | "Für diesen Kauf: 15 Stunden im Monat" | P-PLANS | yes | yes | same |
| C-047 | Widerrufserklärung (Checkbox) | P-PLANS, P-LEGAL | yes; verbatim | yes | same; legal text unchanged |
| C-048 | "Weiter zur Zahlung" | P-PLANS | yes | yes | same; opens the shared payment dialog |
| C-049 | "Abbrechen" | P-PLANS | yes | yes | same |
| C-050 | "Aufladen, Stunden dazukaufen, Paket ändern" | P-MONEY, P-PLANS | yes; as two visible sections, no fold | yes | merged: fold dissolved into P-MONEY and P-PLANS |
| C-051 | "Guthaben aufladen (per Karte)" | P-MONEY | yes | yes | same |
| C-052 | TopUp (Komponente) | P-MONEY | yes | yes | same |
| C-053 | "Mehr Stunden für diesen Monat, aus dem Guthaben" | P-MONEY | yes; when the condition holds (question 4) | yes | same |
| C-054 | "+5 Stunden" "+10 Stunden" "+30 Stunden" | P-MONEY | yes; when the condition holds | yes | same; the one hour-purchase flow (DUP 8) |
| C-055 | HourQuote "Kaufen" + Aufladehinweis | P-MONEY, G-DIALOG | yes; hint becomes button "Guthaben aufladen" | yes | dialog; fixed dead end: top-up button (DE 11) |
| C-056 | "… können noch keinen Preis vorab nennen" | G-ERR | plain; without "Le Space Credits", + retry | yes; + raw code under "Details" | reworded |
| C-057 | "Abo verwalten (wechseln, Karte, Rechnungen)" | P-PLANS, G-DIALOG | yes | yes | dialog before leaving: "danach neu entsperren" (DE 6, DUP 7) |
| C-058 | "Paket wechseln" / "Doch nicht wechseln" | P-PLANS | yes | yes | same |
| C-059 | "Paket beenden" | P-PLANS | yes | yes | same |
| C-060 | confirm "Paket zum Ende des Zeitraums beenden?" | G-DIALOG | yes | yes | dialog replaces native confirm |
| C-061 | confirm "Paket wechseln zu: …?" | G-DIALOG | yes | yes | dialog replaces native confirm |
| C-062 | confirm "… stattdessen aus deinem Guthaben bezahlen?" | G-DIALOG | plain; reason in plain words | yes; + service code (PRICE_TAX …) | dialog replaces native confirm |
| C-063 | "Aufladungen und Rechnungen (3)" | P-BILLS | yes | yes | same |
| C-064 | "Die Aufladungen ließen sich gerade nicht lesen" | P-BILLS | yes; "Lese …" + "Noch einmal versuchen" | yes; + raw message | fixed dead end: loading text and retry (DE 23) |
| C-065 | "17.11.2026 · 20,00 € · Rechnung (Stripe)" | P-BILLS | yes; "Rechnung folgt (meist nach wenigen Minuten)" | yes | reworded: time hint added (DE 23) |
| C-066 | "Rechnungen des Abos bei Stripe" | P-BILLS, G-DIALOG | yes | yes | dialog: same leave-dialog as C-057 (DUP 7) |
| C-067 | Statusnotizen "Paket gewählt, läuft bis …" | P-PLANS, P-MONEY | yes; "erscheint in Kürze" carries "Aktualisieren" button | yes | fixed dead end: inline refresh button (DE 10) |
| C-068 | "Guthaben jetzt 8,00 €, 17 Stunden im Paket." | P-MONEY | yes | yes | same |
| C-069 | Fehler "Die Bezahlseite ließ sich nicht laden" … | G-ERR | plain; no "Credits-Dienst", each with its button | yes; + raw code and message | reworded; terms error links to P-LEGAL box (DE 10, DE 12) |

### 2.3 Terms.svelte (inside Package, top of card)

| ID | Today | v0.2 place | Einfach | Technisch | Change |
|---|---|---|---|---|---|
| C-070 | "Neue Bedingungen (AGB): bitte zustimmen" | P-LEGAL | yes; buy buttons disabled, each links here | yes | fixed dead end: link from blocked purchases (DE 12) |
| C-071 | "Die Bedingungen liegen auf Deutsch vor." | P-LEGAL | yes | yes | same |
| C-072 | "Bis zur Zustimmung sind keine Käufe möglich" | P-LEGAL | yes; verbatim | yes | same; legal text unchanged |
| C-073 | Änderungsliste vom Dienst | P-LEGAL | yes | yes | same |
| C-074 | "Fassung 3 vom 01.11.2026 lesen und herunterladen" | P-LEGAL | yes | yes | same |
| C-075 | "Ich habe die Fassung 3 gelesen und stimme ihr zu." | P-LEGAL | yes; verbatim | yes | same |
| C-076 | "Zustimmen" | P-LEGAL | yes | yes | same |
| C-077 | Fehler "… kann gerade nicht angenommen werden" | G-ERR, P-LEGAL | yes; + button "Seite neu laden" | yes; + raw code | reworded: reload becomes a button |
| C-078 | "Bedingungen: Fassung 3, zugestimmt am … · lesen" | P-LEGAL | yes | yes | same |

### 2.4 Waiver.svelte and HourQuote.svelte

| ID | Today | v0.2 place | Einfach | Technisch | Change |
|---|---|---|---|---|---|
| C-080 | Widerrufserklärung (Checkbox, vier Kaufstellen) | P-LEGAL, P-MONEY | yes; verbatim, one per purchase | yes | same; deliberately repeated per purchase (DUP 13) |
| C-082 | "Das Guthaben reicht nicht für 10 Stunden." | P-MONEY, G-DIALOG | yes; + button "Guthaben aufladen" | yes | fixed dead end: top-up button instead of hint (DE 11) |
| C-083 | "10 Stunden kaufen?" | G-DIALOG | yes | yes | dialog |
| C-084 | "Bezahlt aus: deinem Le-Space-Credits-Guthaben" | G-DIALOG | plain; "deinem Guthaben" | yes; "Le-Space-Credits-Guthaben" | reworded |
| C-085 | "Kosten: 400 Credits (≈ 4,00 €)" | G-DIALOG | plain; euros only | yes; + Credits figure | reworded |
| C-086 | "Guthaben: 12,00 € → 8,00 €" | G-DIALOG | yes | yes | same |
| C-087 | "VM-Stunden: 2 h → 12 h, nutzbar bis …" | G-DIALOG | plain; "Stunden" | yes; "VM-Stunden" | reworded |
| C-088 | "Kaufen" / "Kaufen und starten" | G-DIALOG | yes | yes | same |
| C-089 | "Abbrechen" | G-DIALOG | yes | yes | same |

### 2.5 TopUp.svelte (inside Package fold "Aufladen, …")

| ID | Today | v0.2 place | Einfach | Technisch | Change |
|---|---|---|---|---|---|
| C-090 | "20 € aufladen" "50 € aufladen" | P-MONEY | yes | yes | same |
| C-091 | "Für diesen Kauf: 20 € aufladen" | P-MONEY | yes | yes | same |
| C-092 | Widerrufserklärung (Checkbox) | P-MONEY, P-LEGAL | yes; verbatim | yes | same |
| C-093 | "Weiter zur Zahlung" | P-MONEY | yes | yes | same; opens the shared payment dialog |
| C-094 | "Abbrechen" | P-MONEY | yes | yes | same |
| C-095 | "Bezahlt – das Guthaben wird gebucht …" | P-MONEY | yes; "noch nicht gebucht" carries "Aktualisieren" button | yes; + service error text | fixed dead end: inline refresh button (DE 10) |
| C-096 | Dialog "Guthaben aufladen" | MERGED→G-DIALOG | yes; via shared payment dialog (C-100) | MERGED→G-DIALOG | merged into the one Stripe dialog (DUP 10) |
| C-097 | "✕" (Schließen) | MERGED→G-DIALOG | yes; via C-101 | MERGED→G-DIALOG | merged (DUP 10) |
| C-098 | iframe "Bezahlen mit Stripe" | MERGED→G-DIALOG | yes; via C-103 | MERGED→G-DIALOG | merged (DUP 10) |

### 2.6 StripeCheckout.svelte (used by Package for the subscription and by BackupLine for the year)

| ID | Today | v0.2 place | Einfach | Technisch | Change |
|---|---|---|---|---|---|
| C-100 | Dialog "Abo abschließen" / "Bezahlen mit Stripe" | G-DIALOG | yes | yes | same; now also serves top-up (DUP 10) |
| C-101 | "✕" (Schließen) | G-DIALOG | yes; labelled "Schließen" | yes | reworded: visible word, not only ✕ |
| C-102 | Bestellübersicht "15 Stunden im Monat: 6,40 € …" | G-DIALOG | yes; verbatim | yes | same; top-up gets a summary line too |
| C-103 | iframe Stripe Checkout | G-DIALOG | yes | yes | same |

### 2.7 Cancel.svelte (all texts hard-coded German, legal)

| ID | Today | v0.2 place | Einfach | Technisch | Change |
|---|---|---|---|---|---|
| C-110 | "Vertrag kündigen" | P-LEGAL | yes | yes | moved to i18n unchanged |
| C-111 | "Vertrag: Paperless anywhere, 15 Stunden im Monat" | P-LEGAL | yes | yes | moved to i18n unchanged |
| C-112 | "Art: Ordentliche Kündigung zum Ende des bezahlten Monats" | P-LEGAL | yes; verbatim | yes | moved to i18n unchanged |
| C-113 | "Konto: 0x…" (volle Adresse) | P-LEGAL | no on screen; stays in saved receipt (question 1) | yes; full address on screen | open question 1; otherwise unchanged |
| C-114 | "Anbieter: Le Space UG … · Impressum" | P-LEGAL | yes | yes | moved to i18n unchanged |
| C-115 | "Dieses Abo ist schon gekündigt und endet am …" | P-LEGAL | yes | yes | moved to i18n unchanged |
| C-116 | "Jetzt kündigen" | P-LEGAL | yes | yes | moved to i18n unchanged |
| C-117 | "Abbrechen" | P-LEGAL | yes | yes | moved to i18n unchanged |
| C-118 | "Kündigung eingegangen am …, wirksam zum …" | P-LEGAL | yes; verbatim | yes | moved to i18n unchanged |
| C-119 | "Bestätigung speichern" | P-LEGAL | yes | yes | moved to i18n unchanged |
| C-120 | "Schließen" | P-LEGAL | yes | yes | moved to i18n unchanged |
| C-121 | "Der Credits-Dienst kann das Abo noch nicht hier kündigen" | P-LEGAL, G-DIALOG | plain; sentence + button "Zum Kundenportal" | yes; + service name | fixed dead end: button, no automatic jump (DE 14) |
| C-122 | "Es läuft kein Abo, das gekündigt werden könnte." | G-ERR, P-LEGAL | yes; "nicht bestätigt" carries "Aktualisieren" button | yes; + raw code | fixed dead end: inline refresh button (DE 10) |
| C-123 | "Zahlungsdaten und Rechnungen" | P-LEGAL, G-DIALOG | yes | yes | dialog: same leave-dialog as C-057 (DUP 7, question 5) |
| C-124 | "Fristlos aus wichtigem Grund: per E-Mail an …" | P-LEGAL | yes; verbatim | yes | moved to i18n unchanged (DUP 6: kept, legal) |

### 2.8 Withdraw.svelte (all texts hard-coded German, legal)

| ID | Today | v0.2 place | Einfach | Technisch | Change |
|---|---|---|---|---|---|
| C-125 | "Vertrag widerrufen" | P-LEGAL | yes | yes | moved to i18n unchanged |
| C-126 | "Paket im Monatsabo, geschlossen am …, Widerruf möglich bis …" | P-LEGAL | yes; verbatim | yes | moved to i18n unchanged |
| C-127 | "Konto: 0x…" | P-LEGAL | no on screen; stays in saved receipt (question 1) | yes; full address on screen | open question 1; otherwise unchanged |
| C-128 | "Anbieter: Le Space UG … · Impressum" | P-LEGAL | yes | yes | moved to i18n unchanged |
| C-129 | "Mit dem Widerruf endet das Paket sofort, …" | P-LEGAL | yes; verbatim | yes | moved to i18n unchanged |
| C-130 | "Jetzt widerrufen" | P-LEGAL | yes | yes | moved to i18n unchanged |
| C-131 | "Abbrechen" | P-LEGAL | yes | yes | moved to i18n unchanged |
| C-132 | "Widerruf eingegangen am 17.11.2026, 14:03 Uhr." | P-LEGAL | yes; verbatim | yes | moved to i18n unchanged |
| C-133 | "Das Paket ist damit beendet. Das Geld kommt …" | P-LEGAL | yes; verbatim, + next-step line and "Dokumente herunterladen" | yes | fixed dead end: next step + B-EXPORT button (DE 13, question 7) |
| C-134 | "Bestätigung speichern" | P-LEGAL | yes | yes | moved to i18n unchanged |
| C-135 | "Schließen" | P-LEGAL | yes | yes | moved to i18n unchanged |
| C-136 | "Es gibt nichts mehr, das sich widerrufen ließe" | G-ERR, P-LEGAL | yes; "nicht bestätigt" carries "Aktualisieren" button | yes; + raw code | fixed dead end: inline refresh button (DE 10) |

### 2.9 BackupLine.svelte (backup payment, inside Package)

| ID | Today | v0.2 place | Einfach | Technisch | Change |
|---|---|---|---|---|---|
| C-140 | "Sicherung: bezahlst du aus deiner eigenen Wallet." | P-BACKUP | plain; "Die Sicherung bezahlst du selbst." | yes; + link to P-CRYPTO.T runway | reworded: named place becomes a link (DUP 4) |
| C-141 | "Sicherung: nicht gebucht." | P-BACKUP | yes; + button "Sicherung buchen" | yes | fixed dead end: booking button for every billing kind (DE 8) |
| C-142 | "Sicherung: Teil deines Abos, …" | P-BACKUP | yes | yes | same; the one "bezahlt bis" for Einfach (DUP 4) |
| C-143 | "Sicherung: bezahlt bis zum 30.11.2026." | P-BACKUP | yes | yes | same |
| C-144 | "Die Sicherung ist bis zum … bezahlt (noch 5 Tage)." | P-BACKUP, G-ALERT | yes; with button "Verlängern" | yes | same text; alert at ≤7 days carries the button |
| C-145 | "Seit dem … entstehen keine neuen Sicherungen." | P-BACKUP, G-ALERT | yes; with button "Sicherung wieder buchen" | yes | same text; button added |
| C-146 | "Die Sicherungen sind abgelaufen." | P-BACKUP, G-ALERT | yes; with button "Sicherung wieder buchen" | yes | fixed dead end: button (DE 9) |
| C-147 | "Nach dem Ende bleiben die Sicherungen noch bis …" | P-BACKUP | yes | yes | same |
| C-148 | "Sicherung zum Abo hinzubuchen (1,50 € im Monat)" | P-BACKUP | yes | yes | same |
| C-149 | "Stripe berechnet den Rest des laufenden Monats anteilig" | P-BACKUP | yes | yes | same |
| C-150 | Widerrufserklärung (Checkbox) | P-BACKUP, P-LEGAL | yes; verbatim | yes | same |
| C-151 | "Sicherung für 1,50 € im Monat hinzubuchen" | P-BACKUP | yes | yes | same |
| C-152 | "Herausnehmen … in der Abo-Verwaltung bei Stripe" | P-BACKUP, G-DIALOG | yes | yes | dialog: same leave-dialog as C-057 (DUP 7) |
| C-153 | "1 Jahr Aufbewahrung buchen (18,00 €, einmalig)" | P-BACKUP | yes | yes | same |
| C-154 | "Aufbewahren heißt nicht öffnen: …" | P-BACKUP | yes | yes | same |
| C-155 | "365 Tage, gerechnet ab heute …" | P-BACKUP | yes | yes | same |
| C-156 | Widerrufserklärung (Checkbox) | P-BACKUP, P-LEGAL | yes; verbatim | yes | same |
| C-157 | "1 Jahr für 18,00 € bezahlen" | P-BACKUP | yes | yes | same |
| C-158 | "Eine Erinnerung kommt auch per E-Mail, …" | P-BACKUP | yes | yes | same |
| C-159 | Statusnotizen "Die Sicherung ist jetzt Teil deines Abos." | P-BACKUP | yes; "erscheint in Kürze" carries "Aktualisieren" button | yes | fixed dead end: inline refresh button (DE 10) |
| C-160 | Fehler "Die Bezahlseite ließ sich nicht laden." … | G-ERR, P-BACKUP | plain; "(Einrichtung)" pointer replaced by a button | yes; + raw code | reworded; no pointer to Setup (DUP 9) |
| C-161 | StripeCheckout für das Jahr | G-DIALOG | yes | yes | same; shared dialog (DUP 10) |

### 2.10 Balances.svelte, RefreshBalances.svelte, Addr.svelte

| ID | Today | v0.2 place | Einfach | Technisch | Change |
|---|---|---|---|---|---|
| C-170 | "Adresse der App und deine Wallet" | P-CRYPTO.T | no | yes; section heading | moved from Technisch fold to Paket |
| C-171 | "Aktualisieren" | P-CRYPTO.T | no; P-MONEY refresh covers it | yes; one refresh for the section | same; the one refresh here (DUP 5) |
| C-172 | "Den Schlüssel der App-Adresse leitet dein Browser … ab" | M-KEYS.T, P-CRYPTO.T | no | yes; text in M-KEYS.T, link from P-CRYPTO.T | moved to key explanation |
| C-173 | "Aleph-Credits (Adresse der App): 1.234.567 12,35 €" | P-CRYPTO.T | no | yes | moved |
| C-174 | "reicht noch ca. 3 Tage 4 h (1.000/h …)" | P-CRYPTO.T | plain; "reicht ca. 3 Tage" in P-MONEY (C-007) | yes; + rates per hour | moved; runway sentence shared with P-MONEY |
| C-175 | "Unter der Tagesreserve von 24.000 (0,24 €)" | P-CRYPTO.T, G-ALERT | plain; alert C-008 with button | yes; + reserve figure | moved; Einfach outcome via G-ALERT |
| C-176 | "nicht lesbar" / "…" | P-CRYPTO.T | no | yes; + retry via section refresh | moved |
| C-177 | "ALEPH: 12,00" | P-CRYPTO.T | no | yes | moved |
| C-178 | "tFIL (Gas): 0,123" | P-CRYPTO.T | no | yes | moved |
| C-179 | "Wenig Gas: Den Sitzungsschlüssel zu verlängern …" | P-CRYPTO.T, G-ALERT | plain; alert C-009 with button | yes; + gas figure, link P-GRANTS.T | moved; Einfach outcome via G-ALERT |
| C-180 | "USDFC (Test) in deiner Wallet: 5,00" | P-CRYPTO.T | no | yes | moved |
| C-181 | "Filecoin Pay (für Sicherungen): 4,20 verfügbar" | P-CRYPTO.T | no; P-BACKUP states paid-until | yes | moved (DUP 4: technical source kept) |
| C-182 | "Reicht weniger als einen Monat: … auffüllen" | P-CRYPTO.T, G-ALERT | plain; alert C-009 with button | yes; + runway in days | moved; Einfach outcome via G-ALERT |
| C-183 | Auswahl "Credits auch in" | P-CRYPTO.T | no | yes | moved |
| C-184 | "1 $ = 1.000.000 Credits (Aleph) · ALEPH 0,0512 €" | P-CRYPTO.T | no | yes | moved |
| C-185 | zweites "Aktualisieren" / "Lese …" | MERGED→P-CRYPTO.T | no | MERGED→P-CRYPTO.T | merged into C-171; "Lese …" state kept there (DUP 5) |
| C-186 | RefreshBalances "Aktualisieren" (Komponente) | P-MONEY, P-CRYPTO.T | yes; at P-MONEY and inside "noch nicht gebucht" messages | yes | same; dead duplicate key "Kontostand neu laden" removed (DUP 15) |
| C-187 | gekürzte Adresse + "Kopieren" | M-KEYS.T, B-SETUP.T | no | yes; wherever an address shows, with copy feedback | moved with Setup addresses |

### 2.11 Storage.svelte

| ID | Today | v0.2 place | Einfach | Technisch | Change |
|---|---|---|---|---|---|
| C-190 | "Speicher 2,1 GB von 8,0 GB" | B-STORAGE | yes; running and off (off: state of last backup) | yes | moved from Start to Sicherung; now in both views |
| C-191 | Balken "Belegter Speicher" | B-STORAGE | yes | yes | moved |
| C-192 | "Noch 5,9 GB frei." / "Mehr als im Paket enthalten." | B-STORAGE | yes; "over" with buttons "Uns schreiben", "Größeres Paket" | yes | fixed dead end: contact link M-HELP + P-PLANS (DE 22) |

### 2.12 BackupLeds.svelte (header strip)

| ID | Today | v0.2 place | Einfach | Technisch | Change |
|---|---|---|---|---|---|
| C-200 | Gruppe "Zustand der Sicherungen" | B-HEALTH | yes; card heading | yes | moved from header |
| C-201 | Licht "Sicherungen erreichbar" | B-HEALTH | yes; light + its meaning in the sentence | yes; + opens B-COPIES.T | moved; colours and levels same |
| C-202 | Licht "Kopien unabhängig" | B-HEALTH | yes; light, sentence only when amber | yes; + opens B-COPIES.T | moved |
| C-203 | "Noch keine Sicherung bekannt: …" | B-HEALTH | plain; by state, with "Jetzt sichern" / "Starten" button | yes | fixed dead end: text fits the state, button (DE 15) |
| C-204 | "Die Anbieterliste ließ sich gerade nicht lesen." | B-HEALTH, G-ERR | plain; "Speicherorte" + "Noch einmal prüfen" | yes; "Anbieterliste" + raw error | reworded; retry button |
| C-205 | "Prüfe …" | B-HEALTH | yes | yes | same |
| C-206 | "2 von 3 Kopien der neuesten Sicherung antworten." | B-HEALTH | yes; red: buttons "Jetzt prüfen", "Jetzt sichern" | yes; "Anbieter" wording | fixed dead end: action buttons on red (DE 15) |
| C-207 | "Die 3 Kopien liegen bei verschiedenen Betreibern." | B-HEALTH | plain; amber: sentence + button to fix (question 2) | yes; link to B-PLACES.T | fixed dead end: path text becomes link (DE 15) |
| C-208 | Liste je Anbieter "Anbieter 9 · ezpdpz — antwortet" | B-COPIES.T | no | yes | moved from LED panel |
| C-209 | "9 ezpdpz und 2 foo: selber Betreiber" | B-COPIES.T | no; B-HEALTH amber sentence covers it | yes | moved |
| C-210 | "Geprüft um 14:03:22, von diesem Browser aus." | B-HEALTH, B-COPIES.T | plain; "Geprüft um 14:03" | yes; + full note in technical line | reworded |
| C-211 | "Anbieter aus der zuletzt gelesenen Liste …" | B-COPIES.T, U-LOCKED | plain; locked: "Stand von 17.11., 09:12" (question 3) | yes; full note | moved; locked-state display is open question 3 |
| C-212 | "Jetzt prüfen" / "Prüfe …" | B-HEALTH | yes; also triggers the chain read | yes | same; the one "Jetzt prüfen" in Einfach (DUP 3) |
| C-213 | "Schließen" | B-COPIES.T | no; no panel to close | yes; B-COPIES.T is a fold | merged: panel close becomes fold toggle |

### 2.13 BackupNow.svelte (Übersicht, running VM)

| ID | Today | v0.2 place | Einfach | Technisch | Change |
|---|---|---|---|---|---|
| C-220 | Box "Sicherung" | B-LAST | yes; running and off (off: last known backup) | yes; now also in Technisch | moved from Start to Sicherung; both views (DE 18) |
| C-221 | "Diese VM läuft mit einem älteren Image" | B-LAST | plain; "erscheint nach dem nächsten Start" + button "Sichern und beenden" | yes; + image wording | fixed dead end: plain sentence + button to S-STOP (DE 16) |
| C-222 | "Zuletzt geprüft 14:00, keine Änderung" | B-LAST | no; B-LAST shows last backup only | yes; technical line | moved to technical line |
| C-223 | "letzte Sicherung 12:00" | MERGED→B-LAST | yes; via C-226 | MERGED→B-LAST | merged into the one last-backup line (DUP 2) |
| C-224 | "nächste Prüfung 16:00" | B-LAST | plain; inside the schedule sentence | yes; exact time in technical line | merged into schedule sentence |
| C-225 | "Alle zwei Stunden wird geprüft; …" | B-LAST | yes | yes | same |
| C-226 | "Letzte Sicherung: 12:00 · alle 3 Kopien angekommen" | B-LAST | yes | yes; + link B-DETAIL.T | same; the surviving last-backup line (DUP 2) |
| C-227 | "Letzte Sicherung: gestern 18:00 · vor diesem Start" | B-LAST | yes | yes | same |
| C-228 | "Seit dem Start noch keine Sicherung" | B-LAST | yes | yes | same |
| C-229 | "Sicherung anfordern …" / "Sicherung läuft …" | B-LAST | plain; without the log line | yes; + last log line | reworded |
| C-230 | "Aufbewahrung: 5 Sicherungen bleiben, 2 vorgemerkt" | B-RETAIN.T | no | yes | moved |
| C-231 | "Die Aufbewahrung konnte zuletzt nicht laufen" | B-RETAIN.T | no; heals itself, no action needed | yes | moved |
| C-232 | "Es bleiben die letzten 3, dazu je eine pro Tag" | B-RETAIN.T | no | yes | moved |
| C-233 | Liste "17.11. 12:00 · 1,2 GB · bleibt" | B-RETAIN.T | no | yes | moved |
| C-234 | "Entfernen kann nur deine Wallet … retain --yes" | B-RETAIN.T, B-LAST | plain; sentence + button, no CLI (question 2) | yes; CLI command stays | fixed dead end: Einfach gets sentence + button (DE 17) |
| C-235 | "… lässt keinen Platz für eine weitere Sicherung" | B-RETAIN.T, B-STORAGE | plain; "Speicher für Sicherungen voll" + "Uns schreiben" | yes; "Kontingent" wording | fixed dead end: contact / plan button (DE 17) |
| C-236 | "Jetzt sichern" | B-LAST | yes; off: disabled with "Erst starten" button | yes; now also in Technisch | moved; both views; off not possible, needs running machine (DE 18) |
| C-237 | "Die VM meldet ihren Sicherungsstand gerade nicht." | B-LAST, G-ERR | plain; "Maschine" + "Noch einmal versuchen", auto-retry stated | yes; "VM" + raw error | fixed dead end: retry button (DE 16) |
| C-238 | "Gesichert" / "Schon gesichert: …" | B-LAST | yes; failure with "Noch einmal sichern" | yes; + "Details" | same; failure gets retry |
| C-239 | "Grund" + Log + "Speicheranbieter jetzt" | B-DETAIL.T, B-COPIES.T | no; plain reason sits in C-238 | yes; raw log, provider health in B-COPIES.T | moved; ProviderHealth merged into B-COPIES.T (DUP 3) |

### 2.14 BackupExport.svelte (Erweitert, VM off)

| ID | Today | v0.2 place | Einfach | Technisch | Change |
|---|---|---|---|---|---|
| C-250 | "Sicherung selbst holen (ohne laufende Instanz)" | B-EXPORT | plain; "Dokumente herunterladen", running and off | yes | moved, reworded; both views, running and off (DE 18) |
| C-251 | "Die gewählte Sicherung (…abc123) liegt verschlüsselt …" | B-EXPORT | plain; no id, no curl/age | yes; + piece id, curl/age in technical line | reworded |
| C-252 | "Anleitung mit den Adressen speichern" | B-EXPORT | yes; secondary link "Anleitung speichern" | yes | same |
| C-253 | "Eintrag für das Werkzeug (ledger.json)" | B-EXPORT.T | no | yes | moved |
| C-254 | "Für mindestens ein Stück kennt die App keine Adresse" | B-EXPORT.T | no; C-256 covers the outcome | yes | moved |
| C-255 | "Gleich hier holen: Dieser Browser lädt die Sicherung …" | B-EXPORT | yes; shortened | yes; full text | reworded |
| C-256 | "Dafür fehlt gerade die Adresse eines Stücks." | B-EXPORT, G-ERR | plain; + "Noch einmal versuchen", "Andere Sicherung wählen" | yes; + which piece | fixed dead end: retry and other-backup buttons (DE 19) |
| C-257 | "Dieser Browser kann nicht direkt in eine Datei schreiben" | B-EXPORT, G-ERR | plain; + button "Anleitung speichern" | yes; + 512 MB limit | fixed dead end: guide button on the message (DE 19) |
| C-258 | "Holen und entschlüsseln" | B-EXPORT | yes; label "Dokumente herunterladen" | yes | reworded |
| C-259 | "Geholt: 300 MB von 1,20 GB · entschlüsselt: 280 MB" | B-EXPORT | plain; one progress bar + amount | yes; fetched and decrypted figures | reworded |
| C-260 | "Abbrechen" + "Lass dieses Fenster so lange offen." | B-EXPORT | yes | yes | same |
| C-261 | "Fertig: 1,18 GB entschlüsselt." | B-EXPORT | yes | yes | same |
| C-262 | Fehler "Keiner der Speicheranbieter hat … herausgegeben" | G-ERR, B-EXPORT | plain; each with "Noch einmal versuchen" | yes; + raw error | reworded; retry button |
| C-263 | "Der Sicherungsschlüssel öffnet alle deine Sicherungen." | B-EXPORT.T | no | yes | moved |
| C-264 | "Ich will den Schlüssel sehen und passe selbst auf" | B-EXPORT.T | no | yes | moved |
| C-265 | "Schlüssel anzeigen" | B-EXPORT.T | no | yes | moved |
| C-266 | `AGE-SECRET-KEY-1…` | B-EXPORT.T | no | yes | moved |
| C-267 | "Kopieren" / "Kopiert" | B-EXPORT.T | no | yes | moved |
| C-268 | "Als schluessel.txt speichern" | B-EXPORT.T | no | yes | moved |
| C-269 | "Wieder verbergen" | B-EXPORT.T | no | yes | moved |
| C-270 | "Lösche die Datei, wenn du fertig bist, …" | B-EXPORT.T | no | yes | moved |
| C-271 | "Der Sicherungsschlüssel … ist hier nicht hinterlegt." | B-EXPORT, G-ERR | plain; "Herunterladen geht hier nicht" + "Hilfe" button | yes; + link B-SETUP.T backup key | fixed dead end: buttons to M-HELP / B-SETUP.T (DE 19, question 9) |

### 2.15 BackupChain.svelte ("Was die Chain sagt")

| ID | Today | v0.2 place | Einfach | Technisch | Change |
|---|---|---|---|---|---|
| C-280 | "Was die Chain sagt" + Lichter je Kopie | B-CHAIN.T | plain; outcome folded into the B-HEALTH sentence | yes; running and off | moved out of the default view (DUP 3) |
| C-281 | "Für jede Kopie liest die App selbst aus den Filecoin-Verträgen" | B-CHAIN.T | no | yes | moved |
| C-282 | "Für diese Sicherung nennt die Liste keinen Datensatz" | B-CHAIN.T | no; B-HEALTH says "nicht prüfbar" | yes; + button "Jetzt sichern" for a checkable backup | fixed dead end: button (DE 20) |
| C-283 | "Kopie bei Anbieter 9 · Datensatz 1234 · im PDP Explorer" | B-CHAIN.T | no | yes | moved |
| C-284 | "Die Chain ließ sich für diese Kopie nicht lesen" | B-CHAIN.T, G-ERR | no | yes; + retry button | moved; retry added |
| C-285 | "Datensatz aktiv: ja, mit den 2 Stücken" | B-CHAIN.T | no; problem state raises the B-HEALTH sentence | yes; problem links to "Jetzt sichern" | moved; problem state gets a button (DE 20) |
| C-286 | "Letzter Beweis: 17.11.2026, 13:40 (Epoche …)" | B-CHAIN.T | no | yes | moved |
| C-287 | "Nächste Stichprobe: … (Epoche …)" | B-CHAIN.T | no | yes | moved |
| C-288 | "Verpasste Beweise: keine in den letzten 30" | B-CHAIN.T | no; problem state raises the B-HEALTH sentence | yes | moved |
| C-289 | "Bezahlt bis: 12.03.2027; danach hält die Rücklage" | B-CHAIN.T | no; P-BACKUP states paid-until, problem raises G-ALERT | yes; red fact links to P-BACKUP / P-CRYPTO.T | fixed dead end: link to paying (DE 20, DUP 4) |
| C-290 | "Probeabruf beim Anbieter: … 1024 Bytes" | B-CHAIN.T | no | yes | moved |
| C-291 | Zeichen ✓ • ✗ · ▶ mit Zustandswort | B-CHAIN.T | no | yes | moved |
| C-292 | "Die 2 Stücke dieser Sicherung im PDP Explorer" | B-CHAIN.T | no | yes | moved |
| C-293 | "Jetzt prüfen" | B-CHAIN.T | no; B-HEALTH "Jetzt prüfen" runs it too | yes; label "Chain neu lesen" | reworded: no second "Jetzt prüfen" (DUP 3) |
| C-294 | "Lese die Chain …" / "Gelesen …, bei Epoche …" | B-CHAIN.T | no | yes | moved |
| C-295 | Legende "Grün: von der App selbst … gelesen" + Link | B-CHAIN.T | no | yes | moved |

### 2.16 BackupPlaces.svelte (Erweitert → Technisch → Einrichtung → Sicherungen)

| ID | Today | v0.2 place | Einfach | Technisch | Change |
|---|---|---|---|---|---|
| C-300 | "Wohin die Sicherungen gehen" | B-PLACES.T | no; defaults apply | yes; no extra "dev" fold | moved from Setup to Sicherung |
| C-301 | "Region und Anzahl der Kopien" | B-PLACES.T | no | yes | moved |
| C-302 | "Anbieter selbst wählen" | B-PLACES.T | no | yes | moved |
| C-303 | Auswahl "Kopien": 1 / 2 / 3 | B-PLACES.T | no | yes | moved |
| C-304 | Auswahl "Region": "Europa (EWR, …)" … | B-PLACES.T | no | yes | moved |
| C-305 | "Länderkürzel, z. B. DE, NL" | B-PLACES.T | no | yes | moved |
| C-306 | Checkbox je Anbieter "Frankfurt, DE · ezpdpz" | B-PLACES.T | no | yes | moved |
| C-307 | "Höchstens 3 Anbieter." | B-PLACES.T | no | yes | moved |
| C-308 | "Die Anbieterliste ließ sich gerade nicht lesen." | B-PLACES.T, G-ERR | no | yes; + "Noch einmal lesen" button | fixed dead end: retry button (DE 21) |
| C-309 | "Kopien bei:" + Liste | B-PLACES.T | no | yes | moved |
| C-310 | "Anbieter 9 ist nicht (mehr) zugelassen." … | B-PLACES.T | no | yes | moved |
| C-311 | "Nicht unabhängig: A und B … demselben Betreiber" | B-PLACES.T | no; B-HEALTH amber light says it | yes | moved |
| C-312 | "Kopien außerhalb der EU (US). … § 146 Abs. 2a AO" | B-PLACES.T | no; default places are in the EU | yes; verbatim | moved; legal wording unchanged |
| C-313 | "Nur 1 unabhängiger Betreiber verfügbar" | B-PLACES.T | no | yes | moved |
| C-314 | "Eine weitere Kopie … Diese Kopie hinzufügen" | B-PLACES.T | no | yes | moved |
| C-315 | "Kosten ca. 0,30 USDFC im Monat" | B-PLACES.T | no | yes | moved |
| C-316 | "Sicherungsorte speichern" | B-PLACES.T | no | yes | moved |
| C-317 | "An die laufende VM übergeben" | B-PLACES.T | no | yes | moved |

### 2.17 Related items in Lifecycle.svelte that show or drive this slice (context; owned by the lifecycle slice)

| ID | Today | v0.2 place | Einfach | Technisch | Change |
|---|---|---|---|---|---|
| C-320 | "Letzte erfolgreiche Sicherung: 14:03 · 3 Kopien" | MERGED→B-LAST | yes; via B-LAST (C-226), stale = amber | MERGED→B-LAST | merged (DUP 2); "newerOnChain" note goes to B-CHAIN.T |
| C-321 | "Gerade antwortet keine Kopie … (siehe Licht …)" | S-STOP | plain; no pointer to a light, + button "Jetzt prüfen" | yes | reworded; pointer becomes a button |
| C-322 | "Ich habe aufgeladen – neu prüfen" | G-ALERT | yes | yes | same; button on the "start not affordable" alert (DUP 5) |
| C-323 | "Aus dem Paket starten (N h)" | G-ALERT, S-STATUS | plain; "Maschine" wording | yes; "VM" | reworded |
| C-324 | "Stunden aus Le Space Credits kaufen" + "Kaufen und starten" | MERGED→P-MONEY | yes; alert button opens the P-MONEY hour purchase | MERGED→P-MONEY | merged: one purchase flow, confirm "Kaufen und starten" kept (DUP 8) |
| C-325 | "Für heute ist keine Sicherung bezahlt." | G-DIALOG | yes; "Erst die Sicherung buchen" opens P-BACKUP | yes | dialog; button navigates, not scrolls |
| C-326 | "Die bezahlte Laufzeit ist zu Ende." | S-STATUS | yes; + buttons "Paket wählen", "Dokumente herunterladen" | yes | same text; buttons added (DUP 1: after-stop state kept) |
| C-327 | "Letzte Sicherung: 17.11.2026 · 3/3 Kopien" + Details | B-DETAIL.T | no; B-LAST gives date and copies | yes; running and off | moved from Start to Sicherung (DUP 2) |
| C-328 | "Grundsicherung abc123" / "Ergänzung 3 zu abc123" | S-RESTORE.T | plain; S-RESTORE lists backups by date only | yes | moved; ids only in Technisch |

## Count check

- Inventory IDs in the source (section 2 tables): 269 (9 + 60 + 9 + 9 + 9 + 4 + 15 + 12 + 22 + 18 + 3 + 14 + 20 + 22 + 16 + 18 + 9).
- Rows in this table: 269, same IDs in the same order.
- Unplaced: none.
- TEST: no row of this slice is a test hook only (the `data-testid` on C-010 and the sr-only LED levels on C-201/C-202 stay as hooks on visible items).
- DEAD: no inventory row; one dead catalogue string noted at C-186 (`funds.refresh` first definition "Kontostand neu laden", section 3.1 no. 15) is not carried over.

## Open questions for Nico

1. Cancel/Withdraw "Konto: 0x…" (C-113, C-127) and the refund id "Erstattung: re_…" inside C-133: are they legally part of the on-screen declaration, or is it enough that they stay in the saved receipt file? The map assumes: on screen only in Technisch, receipt file unchanged in both views.
2. Several Einfach warnings can only be fixed in a `.T` place (independence amber → B-PLACES.T; wallet/gas/runway alerts C-009, C-179, C-182 → P-CRYPTO.T; retention removal by wallet C-234 → B-RETAIN.T). Should the Einfach button switch to Technisch at that place, or does Einfach get a small dialog of its own for each?
3. Today the lights work while locked, from remembered providers (C-001, C-211). places.md keeps no lights in the header: should U-LOCKED show the B-HEALTH sentence "Stand von …", or is backup health shown only after unlocking?
4. Extra hours "+5/+10/+30" (C-053 to C-055) and the self-payer lines (C-013 to C-017) only appear in payer modes that are set up in Technisch. The map shows them in Einfach whenever the condition holds (P-* rule, no dead end). Agreed, or Technisch only?
5. Stripe portal has five entry points (section 3.1 no. 7). The map keeps all five as context links (C-022, C-057, C-066, C-123, C-152) behind one shared "Du verlässt die App" dialog instead of marking four as MERGED, because each is the only action in its context and C-123 sits in the verbatim Cancel text. OK, or reduce to "Abo verwalten" only?
6. Voucher period (C-023, dead end 4): buttons "Paket wählen" / new voucher during a running period need the credits service to accept them (`PERIOD_RUNNING` today). Change the service, or should the app say from which date this is possible?
7. Withdraw done (C-133, dead end 13): the map adds one non-legal sentence (what happens to the running machine and the documents) and a "Dokumente herunterladen" button below the verbatim text. May anything be added next to the legal text?
8. "Sicherung buchen" for plans paid from balance or by voucher (C-141, dead end 8) means the monthly payment from the balance, today in Setup (SU:626), moves to P-BACKUP for both views. Does it then also stay in B-SETUP.T ("pay one month"), or is that MERGED→P-BACKUP?
9. "Dokumente herunterladen" in Einfach needs the backup key in the profile and takes the newest backup by default. If the key is missing (C-271), Einfach has only a help button. Is that acceptable, and may the export run while the machine is running (the map assumes yes, it reads from the storage places only)?
10. C-320 (last successful backup line on Start) is marked MERGED→B-LAST. Should S-STATUS still carry a short "Letzte Sicherung: …" line, and is the new low-balance-before-renewal warning (C-025, dead end 7) wanted, with which threshold?
