# Inventory C: package/money and backups (current UI)

Worktree: `main at 30f34f4`, all paths below relative to `pwa/src/`.
Read-only inventory, state of `main` at 30f34f4 (incremental backups merged).

File abbreviations used in the table:

| Abbr | File |
|---|---|
| PG | routes/app/+page.svelte |
| P | lib/Package.svelte |
| TM | lib/Terms.svelte (child of Package, not in the brief but part of the card) |
| WV | lib/Waiver.svelte (child of Package/TopUp/BackupLine) |
| HQ | lib/HourQuote.svelte (child of Package and Lifecycle) |
| TU | lib/TopUp.svelte |
| SC | lib/StripeCheckout.svelte |
| CA | lib/Cancel.svelte |
| WD | lib/Withdraw.svelte |
| BL | lib/BackupLine.svelte |
| BA | lib/Balances.svelte |
| RB | lib/RefreshBalances.svelte |
| AD | lib/Addr.svelte |
| ST | lib/Storage.svelte |
| LED | lib/BackupLeds.svelte |
| BN | lib/BackupNow.svelte |
| BE | lib/BackupExport.svelte |
| BC | lib/BackupChain.svelte |
| BP | lib/BackupPlaces.svelte |
| LC | lib/Lifecycle.svelte (mount context only) |
| SU | lib/Setup.svelte (mount context only) |

i18n: `pkg.*` = i18n/package.js, `credits.*` = i18n/credits.js, `buy.*` = i18n/purchase.js, `funds.*` = i18n/funds.js, `backup.*` = i18n/backup.js, `net.*` = i18n/net.js, `app.*` = i18n/app.js, `card.*` = i18n/card.js (Lifecycle's catalogue, `c.` in the code), `setup.*` = i18n/setup.js. "hard-coded" = German literal in the component, no catalogue key.

---

## 1. States of this slice

**Where things are mounted (two tabs: "Übersicht" = `simple`, "Erweitert" = `advanced`, PG:343-346; choice kept in localStorage).**
- `BackupLeds` sits in the page header (PG:272), outside both tabs, whenever a vault exists in this browser, also while locked. Props `copies`, `remembered`, event `onreach`.
- `Package` (PG:371) is one instance shown in BOTH tabs when `CREDITS_URL` is set and the vault is unlocked and the 24 words are not on screen. Only its position changes by CSS order (Übersicht: below Paperless; Erweitert: above). Everything inside it (Terms, plans, voucher, BackupLine, TopUp, HourQuote, Cancel, Withdraw, StripeCheckout, invoices) is therefore identical in both tabs. Without `CREDITS_URL` (self-hosted build) there is no package card at all.
- `Balances` (PG:396) is inside the "Technisch" card, fold "Deine Wallet bei Aleph und Filecoin", only in Erweitert (`hidden={simple}`); the fold itself is hidden unless the person pays with crypto (`onshown`). It still renders in Übersicht (hidden) because its `onsummary` feeds the Übersicht warnings (PG:411-421).
- `Lifecycle` (PG:370) hosts: `BackupNow` (LC:1200, Übersicht only, phase running, backups configured, restore not failed), `Storage` (LC:1208 running, LC:1225 off; Übersicht only), `BackupChain` (LC:1231 Übersicht in every phase when a backup is known; LC:1305 Erweitert only when NOT running and an age key exists), `BackupExport` (LC:1304, Erweitert only, VM not running, a backup chosen in the restore radio group), `HourQuote` + `RefreshBalances` in the "not enough credits" offer (LC:1083-1096).
- `BackupPlaces` (SU:651) is in Erweitert → Technisch → "Einrichtung" → step "Sicherungen", only when backups are switched on; for Le-Space-paid customers that step sits inside a further "dev" fold (SU:595-599). `Addr` is used only in Setup (8 places).

**Package states (Package.svelte).**
1. Loading: "…" (P:449). Balance unreadable: the raw error text, no retry button (P:447).
2. Self-payer without plan (`pays` is app/wallet and no plan): the card collapses to one line "Du zahlst die Anbieter selbst. Pakete von Le Space ansehen" (P:439-443); opened, it shows state 3.
3. No plan: "Noch kein Paket" + explanation; voucher fold (only if the service offers vouchers); "mit Sicherung" checkbox or "Sicherung inklusive" line; three plan cards (15 h / 100 h / Dauerbetrieb, prices from the service). Picking one opens a step box: "Für diesen Kauf: …", the withdrawal-waiver checkbox (if the service sends one), "Weiter zur Zahlung" (opens the Stripe dialog) and "Abbrechen". There is no trial; the nearest thing is a voucher.
4. Active plan, three billing kinds: `stripe` (card subscription: "Dein Abo … per Karte über Stripe", renews with invoice, always-visible legal button "Verträge hier kündigen", "Abo verwalten" → Stripe portal), `credits` (paid from balance: "Dein Paket …", "Paket wechseln"/"Paket beenden" with `confirm()` dialogs), `voucher` ("Gutschein-Zeitraum bis …", no change/end/cancel). Headline: "N Stunden Laufzeit übrig, bis TT.MM." + meter; if the VM is paid by the app address or wallet instead: "Paperless anywhere läuft über …" + "Das Paket wird dafür nicht verbraucht".
5. Low hours (≤ max(2, 20 %)): warning box + one upgrade button to the next larger plan (Stripe: jumps to the portal).
6. Cancelled: line "Gekündigt, endet am …"; Cancel view shows "schon gekündigt".
7. Period ending (voucher or cancelled plan, VM paid by Le Space): `endWarning` gives soon (≤72 h) / urgent (≤24 h) / ended; shown as alert inside the card (P:305) AND as a banner above everything in both tabs (PG:354-359) AND as chip in "Auf einen Blick" (Erweitert).
8. Expired: plan gone → state 3 again; Lifecycle shows "Die bezahlte Laufzeit ist zu Ende …" (LC:1236).
9. New terms due/announced (Terms): blocking box with checkbox + "Zustimmen"; otherwise a small-print "Bedingungen: Fassung …" line.

**Money.** Balance line "Guthaben 12,00 €" with "davon … vorgemerkt" and "Aktualisieren" (always, P:346). Fold "Aufladen, Stunden dazukaufen, Paket ändern": top-up 20 €/50 € (pick → waiver → "Weiter zur Zahlung" → Stripe iframe dialog → "Bezahlt – das Guthaben wird gebucht …" → "Gebucht: jetzt …"); extra hours +5/+10/+30 (only plan + app pays; quote box HourQuote with cost in Credits and €, balance before→after, confirm "Kaufen"); plan change/end/manage. Fold "Aufladungen und Rechnungen (n)" with Stripe invoice links. Withdraw ("Vertrag widerrufen") button appears only while the service lists something withdrawable (14 days); view lists contracts, one button, then receipt + "Bestätigung speichern" (txt download). Cancel view likewise (contract, kind, account address, provider, "Jetzt kündigen", receipt download, portal link, mailto). Crypto balances (Aleph credits, ALEPH, FIL/tFIL gas, USDFC, Filecoin Pay deposit, runway, unit select) only in Erweitert.

**Backup payment line (BackupLine, inside the package card, both tabs).** One status sentence with tone: none ("nicht gebucht"), ok ("bezahlt bis" / "Teil deines Abos"), soon, warn (≤7 days or expired), over (retention over); own-wallet variant. Below: fold "Sicherung zum Abo hinzubuchen" (Stripe subscription only), or "Herausnehmen … Abo-Verwaltung bei Stripe" link; fold "1 Jahr Aufbewahrung buchen" (own Stripe dialog); e-mail reminder note.

**Backup states.**
- LEDs (header, both tabs, also locked): two lights. "Sicherungen erreichbar": green ≥2 copies answer, yellow exactly 1, red none, grey/dark not checked or no backup known; blinking while checking. "Kopien unabhängig": green every copy at a different operator, yellow two share an operator or only one copy, grey unknown. Click opens a detail panel: sentence, per-provider list (dot green = answers, red = silent, hollow = blocked provider), domain + shortened address, same-operator pairs, "Geprüft um …", "Jetzt prüfen", "Schließen". Auto re-check every 5 min while visible. A red reach light also adds a warning above the stop button (LC:1204).
- No backup yet: LEDs grey with "Noch keine Sicherung bekannt …"; Lifecycle line "Noch keine erfolgreiche Sicherung bekannt"; BackupNow "Seit dem Start noch keine Sicherung" (or the earlier one "vor diesem Start").
- Running VM (Übersicht): BackupNow box "Sicherung": summary line (last check + outcome · last backup · next check), hint "Alle zwei Stunden wird geprüft …", "Letzte Sicherung: … alle N Kopien angekommen / nur x von y / fehlgeschlagen (Grund)", progress "Sicherung anfordern …/läuft …", fold "Aufbewahrung" (retention list: bleibt/Entfernung geplant, policy, notes), button "Jetzt sichern", result line, fold "Grund" with log + ProviderHealth. Old image / VM unreachable variants. In Erweitert a running VM shows none of this.
- Done / stopped: Lifecycle "Letzte Sicherung beim Beenden"; Erweitert fold "Letzte Sicherung: … n/m Kopien" with Piece CID, payer, per-copy "abrufen" links (LC:1350-1366).
- Per place (Filecoin providers): BackupPlaces form (region + copies, or pick up to 3 providers; preview, warnings: not independent, outside EU with tax-law text, few operators; offer of a third independent copy; monthly cost in USDFC; "Sicherungsorte speichern"); with a running VM a push box "An die laufende VM übergeben" (SU:653).
- Export/download (Erweitert, VM off): fold "Sicherung selbst holen (ohne laufende Instanz)": save guide txt, save ledger.json, "Holen und entschlüsseln" in the browser with progress/stop, and the backup key behind a checkbox + "Schlüssel anzeigen" (copy/save/hide).
- Chain view "Was die Chain sagt" (Übersicht always, Erweitert when off): fold with one LED per copy (green all read OK, red problem, amber blinking reading, dark not fully read); per copy six facts (Datensatz aktiv, Letzter Beweis, Nächste Stichprobe, Verpasste Beweise, Bezahlt bis, Probeabruf) each with sign ✓ green app-checked / • blue provider-reported / ✗ red problem / · grey none / ▶ reading; explorer links, "Jetzt prüfen", legend.
- Snapshots/incremental: no component of its own. A snapshot backup is labelled in Lifecycle's restore choice only ("Grundsicherung abc123" / "Ergänzung 3 zu abc123", card.snapshotOf, LC:319); listing/restore entry are built in backups.js/snapshots.js. No UI switch for incremental mode exists in this slice.
- Storage (Übersicht): "Speicher 2,1 GB von 8,0 GB" + meter (accent / warn ≥80 % / danger ≥100 %) + hint; from the VM when running, else "Stand der letzten Sicherung."

---

## 2. Inventory table

Columns: ID · file:line · state/condition · element · German text · i18n key · what it does · shown under · suggested audience.
"both" under "shown under" = identical in Übersicht and Erweitert. "header" = page header, outside the tabs.

### 2.1 Page-level items of this slice (routes/app/+page.svelte)

| ID | file:line | condition | element | German text | i18n key | does | shown under | audience |
|---|---|---|---|---|---|---|---|---|
| C-001 | PG:272 | vault exists, not shared origin, not framed (also locked) | component mount | BackupLeds strip | – | props `copies={ledCopies}` `remembered` `onreach` → `reachLed` passed to Lifecycle | header (both, locked too) | both; simple needs one plain sentence instead of two lights |
| C-002 | PG:355-356 | `ending` (soon/urgent/ended), CREDITS_URL | alert banner | "Deine bezahlte Laufzeit endet am … Sie verlängert sich nicht." / "… endet bald: …" / "… ist am … zu Ende gegangen." + "Eine Stunde vor dem Ende macht Paperless-ngx eine letzte Sicherung …" | pkg.ending.soon/urgent/ended, pkg.ending.what | informs; from `endWarning(pkg.endsAt)` | both | both; must stay prominent for simple |
| C-003 | PG:357 | same | link | "Zum Paket" | pkg.ending.more | anchor `#paket` | both | both |
| C-004 | PG:235 | Erweitert, pkg glance known | status chip row "Paket" | "kein Paket" / "nicht in Gebrauch" / "endet TT.MM. hh:mm" / "N h übrig" / "aktiv" | app.glance.package, noPackage, notInUse, hoursLeft, active; pkg.ending.chip | link `#paket`; tone warn/ok | Erweitert ("Auf einen Blick") | both; simple could get the same one-liner |
| C-005 | PG:238 | Erweitert, lifecycle glance | status chip row "Sicherungen" | "aus" / "TT.MM. hh:mm · N Kopien" / "noch keine" | app.glance.backups, backupsOff, copies, noneYet | link `#paperless` | Erweitert | both |
| C-006 | PG:394-395 | Erweitert, `balancesShown` | fold heading + chip | "Deine Wallet bei Aleph und Filecoin" + euro chip | app.tech.wallet | opens Balances | Erweitert (Technisch) | technical |
| C-007 | PG:413-414 | Übersicht, no CREDITS_URL, summary.money | card line | "Guthaben 12,34 € reicht ca. 3 Tage" | app.simple.balance, app.simple.lasts | info from Balances `onsummary` | Übersicht | simple (self-hosted builds only) |
| C-008 | PG:418-420 | Übersicht, summary.warnings has `start` | warning | "Für einen Start reicht es gerade nicht: ein Paket wählen oder Stunden dazukaufen." / "… Details unter „Erweitert“." | app.simple.startShortCredits / startShort | info only | Übersicht | simple; needs a button, now text only |
| C-009 | PG:418-420 | Übersicht, warnings has `backups` | warning | "Das Guthaben für die Sicherungen geht bald zu Ende. Details unter „Erweitert“." | app.simple.backupsShort | info only | Übersicht | both; simple gets no action |

### 2.2 Package.svelte (card `#paket`, both tabs)

| ID | file:line | condition | element | German text | i18n key | does | shown under | audience |
|---|---|---|---|---|---|---|---|---|
| C-010 | P:437 | CREDITS_URL, unlocked | card section | (no heading; `h2` style exists but no title is rendered) | – | container, `data-testid="package"` | both | both; card has no visible title |
| C-011 | P:449 | balance not yet read | placeholder | "…" | – | – | both | both |
| C-012 | P:447 | balance read failed | error text | raw message, e.g. "Le Space Credits antwortet 500" / "… nicht erreichbar (…)" | credits.answers, net.unreachable | none, no retry | both | both; simple needs plain text + retry |
| C-013 | P:439-440 | self-payer without plan | fold summary | "Du zahlst die Anbieter selbst." "Pakete von Le Space ansehen" | pkg.selfPays, pkg.selfSee | opens the whole card content | both | technical (self-payers are technical users) |
| C-014 | P:441 | same, open | hint | "Die Adresse der App / Deine Wallet bezahlt die VM bei Aleph direkt; ein Paket brauchst du …" | pkg.selfHint | – | both | technical |
| C-015 | P:288 | balance read | component | Terms (rows C-070…) | – | `onaccepted={read}` | both | both |
| C-016 | P:293 | plan, VM paid by app/wallet | headline | "Paperless anywhere läuft über die Adresse der App / deine Wallet" | pkg.runsOver | – | both | technical |
| C-017 | P:294 | same | hint | "Das Paket wird dafür nicht verbraucht (darin N Stunden). Es zählt erst, wenn du beim Start …" | pkg.notUsed, pkg.hours | – | both | technical |
| C-018 | P:296-298 | plan, paid by package | headline | "**12 Stunden** Laufzeit übrig, bis 30.11." or "Paket aktiv" | pkg.hours, pkg.left, pkg.until, pkg.active | – | both | simple (the key answer) |
| C-019 | P:301-303 | plan, hoursLeft ≤ plan hours | meter bar | aria "Verbleibende Stunden" | pkg.meter | – | both | simple |
| C-020 | P:305-308 | `ending` | alert box | same texts as C-002 | pkg.ending.* | – | both | both (duplicate of banner) |
| C-021 | P:311-312 | `low` | warning box | "Nur noch N Stunden in diesem Monat. Reicht das nicht, nimm ein größeres Paket (oder kauf Stunden dazu)." | pkg.low | – | both | simple |
| C-022 | P:313 | low and a bigger plan exists | button | "100 Stunden im Monat für 16,40 €" / "Dauerbetrieb für 90,50 €" | pkg.upgrade | Stripe plan: `portal()` (leaves app); else `plan(id)` with confirm → `choosePlan` | both | simple; Stripe case jumps away without warning |
| C-023 | P:317 | voucher period | text | "Gutschein-Zeitraum bis 24.11.2026. Er verlängert sich nicht. Sichere oder exportiere deine Dokumente vor dem Ende: …" | pkg.voucher.period, pkg.voucher.periodEnds | – | both | simple (shorten) |
| C-024 | P:318 | Stripe subscription | text | "Dein Abo: 15 Stunden für 6,40 € im Monat, per Karte über Stripe." + "Es verlängert sich am …; jede Abbuchung mit Rechnung." or "Gekündigt, endet am …." (+ "Mehr übrig als im Paket, weil du Stunden dazugekauft hast.") | pkg.yourSubscription, renewsInvoice, cancelledEnds, moreThanPackage; credits.planHours | – | both | simple |
| C-025 | P:319 | plan paid from balance | text | "Dein Paket: 15 Stunden für 6,40 € im Monat. Es verlängert sich am … und wird dann aus deinem Guthaben bezahlt, solange es reicht. Beenden kannst du es jederzeit zum Monatsende." | pkg.yourPackage, renewsFromBalance, endAnyMonth | – | both | simple |
| C-026 | P:319 | plan id unknown to app and service | text | "Paket paperless-xyz" | pkg.packageId | – | both | technical (raw id) |
| C-027 | P:323 | Stripe subscription, cancel view closed | button (legal, § 312k BGB) | "Verträge hier kündigen" | pkg.legal.cancel | opens Cancel view | both | both; legally must stay visible without a fold |
| C-028 | P:326 | no plan | headline | "Noch kein Paket" | pkg.none | – | both | simple |
| C-029 | P:327 | no plan | hint | "Ein Paket gibt dir jeden Monat Stunden für dein Paperless anywhere, die Sicherung inklusive. …" | pkg.noneHint | – | both | simple |
| C-030 | P:331 | `cancelling` | component | Cancel (rows C-110…) | – | props plan/current, `onportal` `ondone` `onclose` | both | both |
| C-031 | P:336 | service lists withdrawables, view closed | button (legal, § 356a BGB) | "Vertrag widerrufen" | pkg.legal.withdraw | opens Withdraw view | both | both; legal |
| C-032 | P:339 | `withdrawing` | component | Withdraw (rows C-125…) | – | `ondone={read}`, `onclose` re-reads | both | both |
| C-033 | P:343 | `balance.backup` present | component | BackupLine (rows C-140…) | – | many props, see section 3 | both | both |
| C-034 | P:346 | balance read | value line | "Guthaben **12,00 €**" | pkg.balance | – | both | simple |
| C-035 | P:347 | same | hint | "davon 1,20 € für die laufende Instanz vorgemerkt · daraus werden Paket und Zusatzstunden bezahlt" | pkg.reserved, pkg.balanceUse | – | both | both; "Instanz" is jargon |
| C-036 | P:347 (RB:10) | same | link button | "Aktualisieren" | funds.refresh | `refreshBalances()` → every balance re-read | both | both |
| C-037 | P:352-353 | no plan, vouchers offered | fold summary | "Gutschein einlösen" | pkg.voucher.fold | opens | both | simple |
| C-038 | P:354 | open | hint | "Ein Gutschein gibt dir einen Zeitraum mit Laufzeit und, wenn er sie umfasst, mit Sicherung, …" | pkg.voucher.hint | – | both | simple |
| C-039 | P:356 | open | text input | label "Gutschein-Code", placeholder "PA-XXXX-XXXX-XXXX" | pkg.voucher.label, placeholder | bound to `voucherInput`, uppercase | both | simple |
| C-040 | P:357 | open | submit button | "Einlösen" | pkg.voucher.button | `redeemVoucher` → note "Gutschein eingelöst: …" | both | simple |
| C-041 | P:361 | no plan or `choosing` | hint | "Paket als Monatsabo per Karte wählen (Stripe, jederzeit zum Monatsende kündbar):" / "Neues Paket wählen:" | pkg.chooseFirst / chooseNew | – | both | simple |
| C-042 | P:363 | no plan, all plans include backup | hint | "Sicherung inklusive: 3 verschlüsselte Kopien, bis 32 GiB, nach dem Ende noch 30 Tage abrufbar." | pkg.included | – | both | simple ("GiB" jargon) |
| C-043 | P:365-368 | no plan, backup sold separately | checkbox + text | "**mit Sicherung** (+ 1,50 € im Monat): 3 verschlüsselte Kopien deiner Dokumente" + "Ohne Sicherung sind deine Dokumente nach einem Stopp weg. …" | pkg.withBackup, withBackupPrice, withBackupCopies, withBackupHint | binds `withBackup` (starts unticked, § 312a) | both | simple |
| C-044 | P:373-376 | no plan or choosing | button card ×3 (per plan) | "15 Stunden im Monat" / "100 Stunden im Monat" / "Dauerbetrieb, rund um die Uhr" · price · "≈ 3 h pro Woche · Sicherung inklusive / · mit Sicherung" | pkg.planName, pkg.perWeek, pkg.tagIncluded, pkg.tagWith | no plan: `pickPlan(id)`; with plan: `plan(id)` (confirm → `choosePlan`); disabled for current plan / until terms read | both | simple |
| C-045 | P:374 | plan card is the recommended bigger one | badge | "Empfehlung" | pkg.recommended | – | both | simple |
| C-046 | P:382 | no plan, plan picked | step hint | "Für diesen Kauf: 15 Stunden im Monat, 6,40 €" | buy.step.for | – | both | simple |
| C-047 | P:383 (WV:14-17) | same, service sends a declaration | checkbox + legal text | the service's withdrawal declaration verbatim (not in catalogue) | server text via `withdrawalText` | binds `waivedPlan`; pay stays disabled until ticked | both | both; legal text cannot be simplified |
| C-048 | P:384 | same | button | "Weiter zur Zahlung" | buy.step.pay | `payPlan` → `startSubscription` → StripeCheckout dialog → `waitForSubscription` | both | simple |
| C-049 | P:384 | same | link button | "Abbrechen" | buy.step.cancel | `dropPlan` | both | simple |
| C-050 | P:389-390 | balance read | fold summary | "Aufladen, Stunden dazukaufen, Paket ändern" | pkg.more | opens actions | both | both |
| C-051 | P:392 | fold open | group label | "Guthaben aufladen (per Karte)" | pkg.topUp | – | both | both |
| C-052 | P:393 | fold open | component | TopUp (rows C-090…) | – | props credits, withdrawal, ready; `onbooked={read}` | both | both |
| C-053 | P:397 | plan and app address pays | group label | "Mehr Stunden für diesen Monat, aus dem Guthaben" | pkg.moreHours | – | both | technical (only for app-payer mode) |
| C-054 | P:398 | same | chip buttons ×3 | "+5 Stunden" "+10 Stunden" "+30 Stunden"; while quoting "Preis …" | pkg.plusHours, pkg.quoting | `buyHours(h)` → `purchase.ask` → `quoteVm` | both | technical |
| C-055 | P:399 | quote open / short | component | HourQuote (rows C-082…), confirm label "Kaufen", hint "Erst Guthaben aufladen (oben, per Karte), dann noch einmal kaufen." | pkg.buy, pkg.topUpHint | confirm → `fundVm` | both | technical |
| C-056 | P:400 | quote/buy error | alert | e.g. "Le Space Credits können noch keinen Preis vorab nennen. …" | credits.quoteUnsupported, quoteUnsupportedBought, noPrice, vmFund.TOO_SOON, codes.* | – | both | both |
| C-057 | P:406 | Stripe plan | link button | "Abo verwalten (wechseln, Karte, Rechnungen)" | pkg.manage | `portal()` → `subscriptionPortal`, `location.href` leaves the app | both | both |
| C-058 | P:408 | plan from balance | link button | "Paket wechseln" / "Doch nicht wechseln" | pkg.change / changeBack | toggles `choosing` (plan cards) | both | both |
| C-059 | P:409 | plan from balance | link button | "Paket beenden" | pkg.end | `plan(null)` after confirm | both | both |
| C-060 | P:168 | on C-059 | native `confirm()` | "Paket zum Ende des Zeitraums beenden? Es wird nichts zurückerstattet." | pkg.endConfirm | gate | both | both; replace native dialog |
| C-061 | P:171 | on plan change (C-022, C-044 with plan) | native `confirm()` | "Paket wechseln zu: 100 Stunden im Monat für 16,40 €?" | pkg.changeConfirm, pkg.upgrade | gate | both | both |
| C-062 | P:202 | subscription cannot start (PRICE_TAX, STRIPE_OFF, 404) | native `confirm()` | "Das Abo per Karte geht gerade noch nicht (…). Das Paket stattdessen aus deinem Guthaben bezahlen?" | pkg.fromBalanceConfirm | yes → `choosePlan` from balance | both | both |
| C-063 | P:416-417 | balance read | fold summary | "Aufladungen und Rechnungen (3)" | pkg.purchases | opens list | both | both |
| C-064 | P:418-420 | open | status texts | "Die Aufladungen ließen sich gerade nicht lesen: …" / "…" / "Noch keine Aufladung." | pkg.purchasesError, pkg.noPurchases | – | both | both |
| C-065 | P:424-425 | purchases exist | list row + link | "17.11.2026 · 20,00 € · Rechnung (Stripe)" or "· Rechnung folgt" | pkg.invoice, pkg.invoiceLater | external link `invoiceUrl` (new tab) | both | both |
| C-066 | P:429 | Stripe plan | link button | "Rechnungen des Abos bei Stripe" | pkg.subscriptionInvoices | `portal()` | both | both |
| C-067 | P:431 | after an action | status note | "Paket gewählt, läuft bis …." / "Das Paket endet mit dem Zeitraum." / "Paket gewählt, aus dem Guthaben bezahlt …" / "Abo nicht abgeschlossen." / "Bezahlt – das Abo wird eingerichtet …" / "Abo abgeschlossen. Die Rechnung kommt von Stripe per E-Mail." / "Bezahlt; das Abo erscheint in Kürze." / "Stripe öffnet …" / "N Stunden dazugekauft für … , nutzbar bis …." / "Gutschein eingelöst: … bis …, Sicherung bis …." (+ " Die Stunden erscheinen in Kürze.") | pkg.chosen, endsWithPeriod, chosenFromBalance, notSubscribed, settingUp, subscribed, subscribedSoon, stripeOpens, boughtHours, voucher.redeemed, voucher.always, voucher.pending | – | both | both |
| C-068 | P:432 | just bought hours | hint | "Guthaben jetzt 8,00 €, 17 Stunden im Paket." | pkg.after | – | both | both |
| C-069 | P:433 | action failed | alert | error message: "Die Bezahlseite ließ sich nicht laden. Bitte später noch einmal.", service codes ("Es läuft schon ein Abo. …", "Dafür braucht es ein laufendes Paket …", "Bezahlen ist beim Credits-Dienst gerade abgeschaltet.", voucher errors "Das ist kein Gutschein-Code. …", "Diesen Gutschein-Code gibt es nicht. …" etc.), waiver error "Ohne die Erklärung zum Widerrufsrecht …", terms error "Erst den aktuellen Bedingungen (AGB) zustimmen, …", short balance "Dein Le-Space-Guthaben reicht dafür nicht: Es fehlen …" | pkg.payPageFailed; credits.codes.*, credits.voucher.*, credits.waiver, credits.terms, credits.short, credits.notSetUp, credits.voucherNotConfirmed, credits.noCheckout, credits.noPortal | – | both | both; texts mention "Credits-Dienst", "Aleph-Credits" |

### 2.3 Terms.svelte (inside Package, top of card)

| ID | file:line | condition | element | German text | i18n key | does | shown under | audience |
|---|---|---|---|---|---|---|---|---|
| C-070 | TM:39-40 | terms due or announced | region + title | "Neue Bedingungen (AGB): bitte zustimmen" / "Neue Bedingungen (AGB) ab 01.12.2026" | buy.terms.due / announced, label "Bedingungen" | – | both | both |
| C-071 | TM:41 | language not German | hint | "Die Bedingungen liegen auf Deutsch vor." (EN text in EN) | buy.terms.germanNote | – | both | both |
| C-072 | TM:42 | same | legal hint (German only) | "Bis zur Zustimmung sind keine Käufe möglich; ein laufendes Paket endet zum Monatsende, …" / "Dein Paket läuft bis dahin zu den bisherigen Bedingungen. …" | buy.terms.legal.dueHint / announcedHint | – | both | both |
| C-073 | TM:43 | version has changes | list | change notes from the service | server text | – | both | both |
| C-074 | TM:44 | url present | link | "Fassung 3 vom 01.11.2026 lesen und herunterladen" | buy.terms.read | external, new tab | both | both |
| C-075 | TM:45 | same | checkbox | "Ich habe die Fassung 3 gelesen und stimme ihr zu." | buy.terms.legal.consent | binds `read` | both | both |
| C-076 | TM:46 | same | button | "Zustimmen" | buy.terms.agree | `acceptTerms` → `onaccepted` | both | both |
| C-077 | TM:47 | accept failed | alert | error (e.g. "Diese Fassung der Bedingungen kann gerade nicht angenommen werden. Bitte die Seite neu laden.") | credits.codes.VERSION | – | both | both |
| C-078 | TM:50 | terms accepted, nothing due | small print + link | "Bedingungen: Fassung 3, zugestimmt am 02.11.2026 · lesen" | buy.terms.accepted, readLink | external link | both | both (footer-level detail) |

### 2.4 Waiver.svelte and HourQuote.svelte

| ID | file:line | condition | element | German text | i18n key | does | shown under | audience |
|---|---|---|---|---|---|---|---|---|
| C-080 | WV:14-17 | service sends a withdrawal declaration; used at plan step, top-up step, backup-add fold, backup-year fold | checkbox + legal text | declaration verbatim from the service (de/en) | none (server text, `withdrawalText`) | `bind:checked`; starts unticked for each purchase | both | both; legal |
| C-082 | HQ:18-21 | balance too short for hours | alert box | "Das Guthaben reicht nicht für 10 Stunden." + top-up hint + button "Schließen" | buy.quote.short, buy.quote.close; hint from parent (pkg.topUpHint / card.fund.topUpHint) | `oncancel` | both (Package), and Lifecycle offer | both |
| C-083 | HQ:24-25 | quote open | group title | "10 Stunden kaufen?" (aria "Kauf bestätigen") | buy.quote.title, label | – | both | both |
| C-084 | HQ:27 | same | dl row | "Bezahlt aus: deinem Le-Space-Credits-Guthaben" | buy.quote.paidFrom, fromBalance | – | both | both |
| C-085 | HQ:28 | same | dl row | "Kosten: 400 Credits (≈ 4,00 €)" | buy.quote.cost, credits | – | both | technical for the Credits number; euro for simple |
| C-086 | HQ:30 | before/after known | dl row | "Guthaben: 12,00 € → 8,00 €" | buy.quote.balance | – | both | both |
| C-087 | HQ:33-35 | hours known / expiration | dl row | "VM-Stunden: 2 h → 12 h, nutzbar bis 30.11.2026" / "Nutzbar bis: …" | buy.quote.vmHours, usableUntil, usableUntilLabel | – | both | both ("VM-Stunden" jargon) |
| C-088 | HQ:39 | same | button | "Kaufen" (Package) / "Kaufen und starten" (Lifecycle) | pkg.buy / card.fund.buyAndStart | `onconfirm` → `purchase.confirm()` | both | both |
| C-089 | HQ:40 | same | button | "Abbrechen" | buy.quote.cancel | `oncancel` | both | both |

### 2.5 TopUp.svelte (inside Package fold "Aufladen, …")

| ID | file:line | condition | element | German text | i18n key | does | shown under | audience |
|---|---|---|---|---|---|---|---|---|
| C-090 | TU:82 | fold open | button ×2 (toggle, aria-pressed) | "20 € aufladen" "50 € aufladen" | buy.topup.button | `pick(id)`; disabled until terms read | both | simple |
| C-091 | TU:86 | amount picked | step hint | "Für diesen Kauf: 20 € aufladen" | buy.step.for | – | both | simple |
| C-092 | TU:87 | same | Waiver checkbox | see C-080 | – | binds `waived` | both | both |
| C-093 | TU:88 | same | button | "Weiter zur Zahlung" | buy.step.pay | `buy()` → `startCheckout` → dialog | both | simple |
| C-094 | TU:88 | same | link button | "Abbrechen" | buy.step.cancel | `drop()` | both | simple |
| C-095 | TU:91 | during/after | status line | "Bezahlung wird vorbereitet …" / "Bezahlt – das Guthaben wird gebucht …" / "Gebucht: jetzt 32,00 €." / "Bezahlt, aber noch nicht gebucht. Das Guthaben erscheint in Kürze – „Aktualisieren“." / "Die Bezahlseite ließ sich nicht laden. Bitte später noch einmal." / service error | buy.topup.preparing, booking, booked, notBooked, payPageFailed; credits.* | – | both | simple |
| C-096 | TU:94 | checkout started | modal `<dialog>` | aria "Guthaben aufladen" | buy.topup.dialog | `showModal()`; closing clears the frame | both | both |
| C-097 | TU:95 | dialog | button | "✕" (aria "Schließen") | buy.topup.close | `close()` | both | both |
| C-098 | TU:96 | dialog | iframe | title "Bezahlen mit Stripe" (the service's `/pay` page with Stripe embedded Checkout) | buy.topup.frame | `postMessage` paid/failed → `paid()` / close | both | both |

### 2.6 StripeCheckout.svelte (used by Package for the subscription and by BackupLine for the year)

| ID | file:line | condition | element | German text | i18n key | does | shown under | audience |
|---|---|---|---|---|---|---|---|---|
| C-100 | SC:44 | `pay(secret)` called | modal `<dialog>` | aria "Abo abschließen" (Package) / "1 Jahr Aufbewahrung bezahlen" (BackupLine) / default "Bezahlen mit Stripe" | pkg.checkoutLabel, buy.line.yearCheckout, pkg.payWithStripe | resolves 'paid' / 'failed' / 'closed' | both | both |
| C-101 | SC:45 | dialog | button | "✕" (aria "Schließen") | pkg.close | `done('closed')` | both | both |
| C-102 | SC:46 | summary given | order summary line | "15 Stunden im Monat: 6,40 €, Sicherung inklusive. Monatsabo, verlängert sich jeden Monat, kündbar zum Monatsende." / "1 Jahr Aufbewahrung der Sicherungen: 18,00 €, einmalig, keine Verlängerung." | pkg.order, buy.line.yearSummary | – | both | simple (legally needed order summary) |
| C-103 | SC:47 | dialog | iframe | Stripe embedded Checkout on `${CREDITS_URL}/pay` | – | `postMessage` → paid/failed | both | both |

### 2.7 Cancel.svelte (all texts hard-coded German, legal)

| ID | file:line | condition | element | German text | i18n key | does | shown under | audience |
|---|---|---|---|---|---|---|---|---|
| C-110 | CA:53-54 | cancel view open | region + title | "Vertrag kündigen" | hard-coded | – | both | both |
| C-111 | CA:56 | same | dl row | "Vertrag: Paperless anywhere, 15 Stunden im Monat" (from `contractName`) | hard-coded label; legal-texts.js | – | both | both |
| C-112 | CA:57 | same | dl row | "Art: Ordentliche Kündigung zum Ende des bezahlten Monats, also zum 30.11.2026" | hard-coded; `CANCEL_KIND` | – | both | both |
| C-113 | CA:58 | same | dl row (mono) | "Konto: 0x…" (full 42-char address of the credits account) | hard-coded | – | both | technical; simple could hide or shorten |
| C-114 | CA:59 | same | dl row + link | "Anbieter: Le Space UG (haftungsbeschränkt), contact@le-space.de · Impressum" | hard-coded; `PROVIDER`, `IMPRINT_URL` | external link | both | both |
| C-115 | CA:68 | already cancelled | hint | "Dieses Abo ist schon gekündigt und endet am …." | hard-coded | – | both | both |
| C-116 | CA:70 | not yet done | primary button | "Jetzt kündigen" | hard-coded | `cancelSubscription`; on `CancelUnsupportedError` shows note and opens the portal | both | both |
| C-117 | CA:71 | not yet done | link button | "Abbrechen" | hard-coded | `onclose` | both | both |
| C-118 | CA:62 | done | status | "Kündigung eingegangen am 17.11.2026, 14:03 Uhr, wirksam zum 30.11.2026." | hard-coded | – | both | both |
| C-119 | CA:64 | done | primary button | "Bestätigung speichern" | hard-coded | downloads a .txt (`cancellationRecord`) | both | both |
| C-120 | CA:65 | done | link button | "Schließen" | hard-coded | `onclose` | both | both |
| C-121 | CA:74 | service cannot cancel in-app | note | "Der Credits-Dienst kann das Abo noch nicht hier in der App kündigen. Gekündigt wird deshalb im Kundenportal …" | credits.cancelUnsupported | then `onportal()` | both | both |
| C-122 | CA:75 | failed | alert | "Es läuft kein Abo, das gekündigt werden könnte." / "Le Space Credits haben den Eingang der Kündigung nicht bestätigt. Bitte „Aktualisieren“ …" | credits.cancel.NO_SUBSCRIPTION, credits.cancelNotConfirmed | – | both | both |
| C-123 | CA:76 | always in view | link button | "Zahlungsdaten und Rechnungen" | hard-coded | `onportal` (Stripe portal) | both | both |
| C-124 | CA:77 | always in view | hint + mailto | "Fristlos aus wichtigem Grund: per E-Mail an contact@le-space.de" | hard-coded | `mailto:` | both | both |

### 2.8 Withdraw.svelte (all texts hard-coded German, legal)

| ID | file:line | condition | element | German text | i18n key | does | shown under | audience |
|---|---|---|---|---|---|---|---|---|
| C-125 | WD:47-48 | withdraw view open | region + title | "Vertrag widerrufen" | hard-coded | – | both | both |
| C-126 | WD:49-52 | same | list | "**Paket im Monatsabo**, geschlossen am 10.11.2026, Widerruf möglich bis 24.11.2026, 23:59 Uhr" (also "Guthaben-Kauf", "1 Jahr Aufbewahrung der Sicherungen") | hard-coded; `WITHDRAWAL_SUBJECTS` | – | both | both |
| C-127 | WD:55 | same | dl row (mono) | "Konto: 0x…" | hard-coded | – | both | technical |
| C-128 | WD:56 | same | dl row + link | "Anbieter: Le Space UG … · Impressum" | hard-coded | external link | both | both |
| C-129 | WD:66 | not yet done | explanation | "Mit dem Widerruf endet das Paket sofort, und nicht verbrauchtes Guthaben wird zur Erstattung angemeldet. …" | hard-coded | – | both | both |
| C-130 | WD:68 | not yet done | primary button | "Jetzt widerrufen" | hard-coded | `withdraw(master)` (withdraws everything listed at once) → `ondone` | both | both |
| C-131 | WD:69 | not yet done | link button | "Abbrechen" | hard-coded | `onclose` | both | both |
| C-132 | WD:59 | done | status | "Widerruf eingegangen am 17.11.2026, 14:03 Uhr." | hard-coded | – | both | both |
| C-133 | WD:60 | done | hint | "Das Paket ist damit beendet. Das Geld kommt innerhalb von 14 Tagen zurück, … Erstattung: re_…" | hard-coded | – | both | both |
| C-134 | WD:62 | done | primary button | "Bestätigung speichern" | hard-coded | downloads .txt (`withdrawalRecord`) | both | both |
| C-135 | WD:63 | done | link button | "Schließen" | hard-coded | `onclose` | both | both |
| C-136 | WD:72 | failed | alert | "Es gibt nichts mehr, das sich widerrufen ließe: Die 14 Tage sind vorbei." / "Der Credits-Dienst kann den Widerruf noch nicht hier in der App annehmen." / "… Eingang des Widerrufs nicht bestätigt. Bitte „Aktualisieren“ …" | credits.withdrawal.NOTHING_TO_WITHDRAW, withdrawalUnsupported, withdrawalNotConfirmed | – | both | both |

### 2.9 BackupLine.svelte (backup payment, inside Package)

| ID | file:line | condition | element | German text | i18n key | does | shown under | audience |
|---|---|---|---|---|---|---|---|---|
| C-140 | BL:104 | backups paid from own wallet (`own`) | status line (tone ok) | "Sicherung: bezahlst du aus deiner eigenen Wallet. Wie lange der Speicher bezahlt ist, steht unter „Deine Wallet bei Aleph und Filecoin“." | buy.line.own | – | both | technical |
| C-141 | BL:104 | not booked (tone none) | status line | "Sicherung: nicht gebucht. Ohne Sicherung sind deine Dokumente nach einem Stopp weg." | credits.backup.none | – | both | simple; needs an action next to it |
| C-142 | BL:104 | active, renews with plan (ok) | status line | "Sicherung: Teil deines Abos, verlängert sich mit dem Paket. Bezahlt bis zum 30.11.2026." | credits.backup.renews | – | both | simple |
| C-143 | BL:104 | active, paid period (ok) | status line | "Sicherung: bezahlt bis zum 30.11.2026." | credits.backup.paid | – | both | simple |
| C-144 | BL:104 | notice expires_soon (>7 days: tone soon; ≤7: warn, alert) | status line | "Die Sicherung ist bis zum … bezahlt (noch 5 Tage). Danach entstehen keine neuen Sicherungen mehr." | credits.backup.soon | – | both | simple |
| C-145 | BL:104 | notice expired (warn, alert) | status line | "Seit dem … entstehen keine neuen Sicherungen. Die vorhandenen bleiben bis zum … abrufbar." | credits.backup.expired | – | both | simple |
| C-146 | BL:104 | notice retention_over (tone over, alert) | status line | "Die Sicherungen sind abgelaufen. Der Speicher dafür kann beendet sein; eine neue Sicherung entsteht, …" | credits.backup.over | – | both | simple |
| C-147 | BL:106 | active, not renewing, retention date, tone ok | hint | "Nach dem Ende bleiben die Sicherungen noch bis zum … abrufbar." | buy.line.retention | – | both | both |
| C-148 | BL:111-112 | backup sold, Stripe plan not ending, not included, not yet a line | fold summary | "Sicherung zum Abo hinzubuchen (1,50 € im Monat)" | buy.line.addFold | opens; sets `preparing='backup-add'` (closes other purchase steps) | both | simple |
| C-149 | BL:113 | open | hint | "Stripe berechnet den Rest des laufenden Monats sofort anteilig. Danach verlängert sich die Sicherung …" | buy.line.addHint | – | both | both |
| C-150 | BL:114 | open | Waiver checkbox | see C-080 | – | binds `waivedAdd` | both | both |
| C-151 | BL:115 | open | button | "Sicherung für 1,50 € im Monat hinzubuchen" | buy.line.addButton | `addBackupLine` (no checkout dialog; charged on the existing card) → note "Die Sicherung ist jetzt Teil deines Abos. …" | both | simple |
| C-152 | BL:118 | backup is a subscription line | text + inline link button | "Herausnehmen kannst du die Sicherung in der *Abo-Verwaltung bei Stripe*. Der bezahlte Zeitraum läuft dann noch aus, …" | buy.line.remove.before/link/after | `onportal()` | both | both |
| C-153 | BL:121-122 | backup sold | fold summary | "1 Jahr Aufbewahrung buchen (18,00 €, einmalig)" | buy.line.yearFold | opens; `preparing='backup-year'` | both | both |
| C-154 | BL:123 | open | text | "**Aufbewahren heißt nicht öffnen:** Zum Wiederherstellen braucht es Rechenzeit, also ein laufendes Paket oder Zusatzstunden." | buy.line.keepStrong, keep | – | both | both |
| C-155 | BL:124 | open | hint | "365 Tage, gerechnet ab heute oder, wenn schon länger bezahlt ist, ab dem bezahlten Ende. …" | buy.line.yearHint | – | both | both |
| C-156 | BL:125 | open | Waiver checkbox | see C-080 | – | binds `waivedYear` | both | both |
| C-157 | BL:126 | open | button | "1 Jahr für 18,00 € bezahlen" | buy.line.yearButton | `startBackupYear` → StripeCheckout → `waitForBackup` | both | both |
| C-158 | BL:129 | sold and tone soon/warn | hint | "Eine Erinnerung kommt auch per E-Mail, an die Adresse aus deiner Kartenzahlung bei Stripe. …" | buy.line.mailNote | – | both | both |
| C-159 | BL:132 | after action | status note | "Die Sicherung ist jetzt Teil deines Abos. …" / "Das Jahr wurde nicht gekauft." / "Bezahlt – das Jahr wird gebucht …" / "Gebucht: Die Sicherungen sind bis zum … bezahlt." / "Bezahlt; das Jahr erscheint in Kürze." | buy.line.added, yearNotBought, yearBooking, yearBooked, yearSoon | – | both | both |
| C-160 | BL:133 | failed | alert | "Die Bezahlseite ließ sich nicht laden. …" / service errors ("Die Sicherung ist schon Teil deines Abos.", "Dafür braucht es ein laufendes Abo per Karte.", "Die Sicherung im Abo und das Jahr Aufbewahrung gibt es erst mit den neuen AGB. …") / waiver error | buy.line.payPageFailed; credits.backupPlan.*; credits.waiver; credits.noYearCheckout | on WaiverError also `onwaiver()` | both | both |
| C-161 | BL:135 | – | component | StripeCheckout for the year (C-100…) | buy.line.yearCheckout, yearSummary | – | both | both |

### 2.10 Balances.svelte, RefreshBalances.svelte, Addr.svelte

| ID | file:line | condition | element | German text | i18n key | does | shown under | audience |
|---|---|---|---|---|---|---|---|---|
| C-170 | BA:120-121 | person pays VM or backups with crypto | section + h2 | "Adresse der App und deine Wallet" / "Deine Wallet" | funds.titleBoth / titleWallet | – | Erweitert (Technisch fold) | technical |
| C-171 | BA:122 (RB) | same | link button | "Aktualisieren" | funds.refresh | `refreshBalances()` (global round) | Erweitert | technical |
| C-172 | BA:123 | same | hint | "Den Schlüssel der App-Adresse leitet dein Browser aus deinem Passkey (oder den 24 Wörtern) ab. Den Schlüssel deiner Wallet hat nur deine Wallet. Le Space hat keinen dieser Schlüssel …" | funds.keys.app, keys.wallet, keys.leSpace | – | Erweitert | technical |
| C-173 | BA:126-129 | showAleph | dl row | "Aleph-Credits (Adresse der App): 1.234.567 12,35 €" | funds.alephCredits, funds.appAddress | value from `alephBalance`, money via `money()` | Erweitert | technical |
| C-174 | BA:130-131 | rate known | small text | "· reicht noch ca. 3 Tage 4 h (1.000/h, 0,01 €/h, was gerade läuft)" / "· reicht für ca. … Laufzeit (…/h + …/h, was schon läuft)" | funds.lastsRunning / lastsFor, funds.days | – | Erweitert | technical; the "reicht ca." part is useful for simple |
| C-175 | BA:132 | VM off, credits below start reserve | warning | "Unter der Tagesreserve von 24.000 (0,24 €): Aleph nimmt so keinen Start an." | funds.belowReserve | also raises `warnings: ['start']` for Übersicht (C-008) | Erweitert | technical |
| C-176 | BA:133,144 | read failed / loading | placeholder | "nicht lesbar" / "…" | funds.unreadable | – | Erweitert | technical |
| C-177 | BA:135 | ALEPH tokens held | dl row | "ALEPH: 12,00" | literal "ALEPH" | – | Erweitert | technical |
| C-178 | BA:139-142 | showFilecoin | dl row | "tFIL (Gas): 0,123" / "FIL (Gas)" | funds.gas | – | Erweitert | technical |
| C-179 | BA:143 | gas low | warning | "Wenig Gas: Den Sitzungsschlüssel zu verlängern oder Filecoin Pay aufzufüllen kostet tFIL." | funds.lowGas | raises `warnings: ['backups']` | Erweitert | technical |
| C-180 | BA:147-148 | filecoin read | dl row | "USDFC (Test) in deiner Wallet: 5,00" | funds.usdfcInWallet | – | Erweitert | technical |
| C-181 | BA:149-152 | same | dl row | "Filecoin Pay (für Sicherungen): 4,20 verfügbar von 5,00 hinterlegt" + "Verbrauch ca. 0,30 USDFC im Monat, reicht ca. 420 Tage" | funds.filecoinPay, forBackups, available, deposited, spend | – | Erweitert | technical |
| C-182 | BA:153 | runway < 30 days | warning | "Reicht weniger als einen Monat: aus deiner Wallet auffüllen, sonst schlagen Sicherungen fehl." | funds.lessThanMonth | raises `warnings: ['backups']` (C-009) | Erweitert | technical |
| C-183 | BA:160-163 | showAleph | select | label "Credits auch in"; options "nur Credits", "Euro", "Dollar", "ALEPH" | funds.alsoIn, funds.units.* | `setUnit` → localStorage `paperless-credit-unit` | Erweitert | technical |
| C-184 | BA:164 | showAleph | small hint | "1 $ = 1.000.000 Credits (Aleph) · ALEPH 0,0512 €, 1 $ = 0,921 € (CoinGecko, 14:03)" / " · Kurse gerade nicht abrufbar" | funds.peg, funds.rates, funds.noRates | – | Erweitert | technical |
| C-185 | BA:167 | section shown | quiet button | "Aktualisieren" / "Lese …" | funds.refresh, funds.reading | local `read()` (only this section) | Erweitert | technical; duplicate of C-171 |
| C-186 | RB:10 | wherever mounted (P:347, BA:122, LC:1083) | link button | "Aktualisieren", or custom label "Ich habe aufgeladen – neu prüfen" (LC:1083) | funds.refresh; funds.toppedUp | `refreshBalances()` | both / Erweitert | both |
| C-187 | AD:20 | Setup only (SU:493,495,500,510,524,562,623,637) | code + copy button | shortened address + "Kopieren" / "Kopiert" | setup.copy, setup.copied | `navigator.clipboard.writeText` | Erweitert (Einrichtung) | technical |

### 2.11 Storage.svelte

| ID | file:line | condition | element | German text | i18n key | does | shown under | audience |
|---|---|---|---|---|---|---|---|---|
| C-190 | ST:39 | size known (running: VM status; off: last backup size) | value line | "Speicher **2,1 GB von 8,0 GB**" | backup.storage.label, backup.storage.used | polls `vmStatus` every 60 s while running | Übersicht only (LC:1208, LC:1225) | simple |
| C-191 | ST:40 | same | meter | aria "Belegter Speicher"; colour accent / warn (≥80 %) / danger (≥100 %) | backup.storage.meter | – | Übersicht | simple |
| C-192 | ST:41 | same | hint | "Noch 5,9 GB frei." / "Stand der letzten Sicherung." / "Noch 1,2 GB frei. Wird es knapp, scheitern zuerst die Sicherungen." / "Mehr als im Paket enthalten. Bitte alte Dokumente löschen oder uns schreiben; …" | backup.storage.free, asOfBackup, near, over | – | Übersicht | simple; "over" has no contact link |

### 2.12 BackupLeds.svelte (header strip)

| ID | file:line | condition | element | German text | i18n key | does | shown under | audience |
|---|---|---|---|---|---|---|---|---|
| C-200 | LED:71 | vault exists | group | aria "Zustand der Sicherungen" | app.leds.label | – | header | both |
| C-201 | LED:72-74 | always | LED button | "Sicherungen erreichbar" (+ sr-only ": grün / gelb / rot / nicht geprüft") | app.leds.reach, app.leds.levels.* | toggles detail panel 'reach'. Colours: green (#5fd6a8) ≥2 copies answer; amber (#f5b041) exactly 1; red (#ff8a80) none; dark (#2a3558) not checked/no backup; blinks while checking | header | both; simple: one sentence "Deine Sicherung ist abrufbar" |
| C-202 | LED:75-77 | always | LED button | "Kopien unabhängig" (+ sr-only level) | app.leds.independent | toggles panel 'independent'. Green: each copy at a different operator; amber: two share an operator or only one copy; dark: unknown/provider not in registry. No red state | header | technical; simple only needs a warning if amber |
| C-203 | LED:83 | panel open, no copies known | text | "Noch keine Sicherung bekannt: Die Lichter zeigen etwas, sobald die App die Liste der Sicherungen gelesen hat (nach dem Entsperren)." | app.leds.noBackup | – | header | both |
| C-204 | LED:85 | check failed | text | "Die Anbieterliste ließ sich gerade nicht lesen. Nichts geprüft." | app.leds.unreadable | – | header | both |
| C-205 | LED:87 | checking | text | "Prüfe …" | app.leds.checking | – | header | both |
| C-206 | LED:91 | reach panel, result | sentence | "2 von 3 Kopien der neuesten Sicherung antworten." / "Nur 1 von 3 Kopien … antwortet. Fällt auch dieser Anbieter aus, …" / "Keine der 3 Kopien … antwortet. Gerade lässt sich keine Sicherung holen; …" / "Noch nicht geprüft." / "Alle Kopien der neuesten Sicherung liegen bei gesperrten Anbietern. …" | app.leds.reachSays.ok/warn/bad/unknown, app.leds.allBlocked | – | header | simple (good plain sentences) |
| C-207 | LED:93 | independent panel, result | sentence | "Die 3 Kopien liegen bei verschiedenen Betreibern." / "Kopien liegen beim selben Betreiber. Fällt er aus, sind sie alle weg. Unter „Erweitert“ → Einrichtung → …" / "Es gibt nur eine Kopie. Unter „Erweitert“ → Einrichtung eine zweite …" | app.leds.independentSays.ok/warn/one | – | header | technical; fix path is text only, no link |
| C-208 | LED:97-103 | result | list row per provider | dot (green answers / red silent / hollow blocked) "**Anbieter 9 · ezpdpz** (Frankfurt, DE) — antwortet / antwortet nicht / gesperrt (FIDL …); zählt nicht" + "Domain: example.com · Adresse: 0x1234…abcd" | app.leds.provider, answers, silent, blocked, domain, owner; backup.places.blockedWhy.fidl | – | header | technical |
| C-209 | LED:107 | operators shared | warning line | "9 ezpdpz und 2 foo: selber Betreiber (gleiche Adresse 0x12…, Domain x.y, Name „foo…“)" | app.leds.pair; backup.places.signs.* | – | header | technical |
| C-210 | LED:109 | result | timestamp | "Geprüft um 14:03:22, von diesem Browser aus. Grün ist nur, was die App selbst geprüft hat." | app.leds.checkedAt | – | header | technical |
| C-211 | LED:111 | locked (copies from memory) | note | "Anbieter aus der zuletzt gelesenen Liste (17.11., 09:12); die Liste selbst liest die App erst nach dem Entsperren." | app.leds.fromMemory | – | header | technical |
| C-212 | LED:113 | copies known | link button | "Jetzt prüfen" / "Prüfe …" | app.leds.again, checking | `check(true)` (min 30 s gap) | header | both |
| C-213 | LED:114 | panel open | link button | "Schließen" | app.leds.close | closes panel | header | both |

### 2.13 BackupNow.svelte (Übersicht, running VM)

| ID | file:line | condition | element | German text | i18n key | does | shown under | audience |
|---|---|---|---|---|---|---|---|---|
| C-220 | BN:92 | running, backups on, restore not failed | box label | "Sicherung" | backup.overview.title | – | Übersicht only | simple |
| C-221 | BN:94 | VM image without status v2 | hint | "Diese VM läuft mit einem älteren Image: Sicherungsstand und „Jetzt sichern“ gibt es ab dem nächsten Image." | backup.overview.oldImage | – | Übersicht | both; jargon, no action offered |
| C-222 | BN:98 | status read, a check ran | summary part | "Zuletzt geprüft 14:00, keine Änderung / gesichert / nur teilweise gesichert / fehlgeschlagen / Sicherungen sind aus" | backup.overview.checked, checkOutcome | – | Übersicht | technical (simple needs only "last backup") |
| C-223 | BN:99 | last backup known (this VM or earlier) | summary part | "letzte Sicherung 12:00" | backup.overview.lastShort | – | Übersicht | simple |
| C-224 | BN:100 | next check known | summary part | "nächste Prüfung 16:00" | backup.overview.nextShort | – | Übersicht | both |
| C-225 | BN:102 | status read | hint | "Alle zwei Stunden wird geprüft; gesichert wird nur, wenn sich etwas geändert hat." | backup.overview.nextHint | – | Übersicht | simple |
| C-226 | BN:103-109 | status read | status line | "Letzte Sicherung: **12:00** · alle 3 Kopien angekommen" (green) / "· nur 2 von 3 Kopien" (warn) / "· fehlgeschlagen (Grund)" (red) | backup.overview.last, ok, short, failed | on ok also `ongood(...)` → profile.lastGoodBackup + LEDs | Übersicht | simple |
| C-227 | BN:110 | no backup in this VM, earlier one known | status line | "Letzte Sicherung: **gestern 18:00** · 3 Kopien · vor diesem Start" | backup.overview.copies, beforeStart | – | Übersicht | simple |
| C-228 | BN:111 | none at all | status line | "Letzte Sicherung: Seit dem Start noch keine Sicherung" | backup.overview.none | – | Übersicht | simple |
| C-229 | BN:114 | backup requested or running | progress text | "Sicherung anfordern …" / "Sicherung läuft … <last log line>" | backup.overview.sending, running | – | Übersicht | simple (log line is technical) |
| C-230 | BN:117-118 | VM reports retention | fold summary | "Aufbewahrung: 5 Sicherungen bleiben, 2 zum Entfernen vorgemerkt" | backup.overview.retention.title, summary | opens list | Übersicht | technical |
| C-231 | BN:119 | retention failed | warning | "Die Aufbewahrung konnte zuletzt nicht laufen; die Sicherungen bleiben, die nächste versucht es wieder." | backup.overview.retention.failed | – | Übersicht | technical |
| C-232 | BN:121 | policy known | hint | "Es bleiben die letzten 3, dazu je eine pro Tag (7 Tage), Woche (4 Wochen) und Monat (12 Monate); …" | backup.overview.retention.policy | – | Übersicht | technical |
| C-233 | BN:123-129 | rows | list rows | "17.11. 12:00 · 1,2 GB · unvollständig · bleibt (neueste vollständige, Tag)" / "· Entfernung geplant" / "· zum Entfernen vorgemerkt"; "Datum unbekannt" | backup.overview.retention.keep, remove, toRemove, partial, undated, reasons.* | – | Übersicht | technical |
| C-234 | BN:132 | something to remove | hint | "Entfernungen sind beim Anbieter angemeldet; der Platz wird mit dem nächsten Nachweis frei …" / "Wird mit der nächsten vollständigen Sicherung entfernt." / "Entfernen kann nur deine Wallet, … `node backup.mjs retain --yes`." | backup.overview.retention.queued, planned, needsWallet | – | Übersicht | technical (CLI command in the default view) |
| C-235 | BN:133 | over budget | warning | "Was bleiben muss, lässt keinen Platz für eine weitere Sicherung im Kontingent." | backup.overview.retention.overBudget | – | Übersicht | both; no action offered |
| C-236 | BN:137 | status read | button | "Jetzt sichern" | backup.overview.now | via `guard` (Lifecycle `checkPlacesThen`: checks the providers first, may show the places box) → `requestBackup`; disabled while busy/running | Übersicht | simple |
| C-237 | BN:139 | VM did not answer | hint | "Die VM meldet ihren Sicherungsstand gerade nicht." | backup.overview.unreachable | – | Übersicht | both; no retry |
| C-238 | BN:141 | after "Jetzt sichern" | result line | "Gesichert" / "Schon gesichert: seit der letzten Sicherung hat sich nichts geändert." / "Gesichert, aber nur 2 von 3 Kopien: ein Anbieter hat abgelehnt. …" / "Die Sicherung ist fehlgeschlagen; Paperless läuft weiter. Grund: …" | backup.overview.doneNow, doneUnchanged, donePartial, failedNow, reason | – | Übersicht | simple |
| C-239 | BN:142 | failure details exist | fold | "Grund" + `<pre>` log/facts + ProviderHealth ("Speicheranbieter jetzt", per provider "antwortet (120 ms)" …) | backup.overview.reason; backup.facts.*; backup.health.* | – | Übersicht | technical |

### 2.14 BackupExport.svelte (Erweitert, VM off)

| ID | file:line | condition | element | German text | i18n key | does | shown under | audience |
|---|---|---|---|---|---|---|---|---|
| C-250 | BE:102-103 | Erweitert, not running, age key set, a backup chosen | fold summary | "Sicherung selbst holen (ohne laufende Instanz)" | backup.export.summary | opens; closing hides the key again | Erweitert only | both; simple wants "Dokumente herunterladen" |
| C-251 | BE:104 | open | intro | "Die gewählte Sicherung (…abc123def456) liegt verschlüsselt bei den Speicheranbietern und lässt sich dort ohne Paperless anywhere abrufen. … mit `curl` und `age`. Heraus kommt ein Zip mit deinen Dokumenten." | backup.export.intro.* | – | Erweitert | technical |
| C-252 | BE:106 | open | button | "Anleitung mit den Adressen speichern" | backup.export.saveGuide | downloads `sicherung-selbst-holen-<id>.txt` (`selfRestoreGuide`) | Erweitert | technical |
| C-253 | BE:107 | open | button | "Eintrag für das Werkzeug (ledger.json)" | backup.export.saveEntry | downloads `ledger.json` (`restoreEntry`) | Erweitert | technical |
| C-254 | BE:109 | a piece has no address | warning | "Für mindestens ein Stück kennt die App gerade keine Adresse; die Anleitung nennt es." | backup.export.incomplete | – | Erweitert | technical |
| C-255 | BE:113 | key available | text | "**Gleich hier holen:** Dieser Browser lädt die Sicherung von den Speicheranbietern, entschlüsselt sie auf diesem Gerät und speichert das Zip in eine Datei deiner Wahl. … Größe: etwa 1,20 GB." | backup.export.hereStrong, here, size | – | Erweitert | simple (this is the lay path to "get my documents") |
| C-256 | BE:115 | address missing | hint | "Dafür fehlt gerade die Adresse eines Stücks." | backup.export.missingAddress | – | Erweitert | both; dead end |
| C-257 | BE:117 | no file picker and too large | hint | "Dieser Browser kann nicht direkt in eine Datei schreiben, und die Sicherung ist zu groß für den Arbeitsspeicher (Grenze 512 MB). Nimm Chrome oder Edge, oder die Anleitung oben." | backup.export.tooLarge | – | Erweitert | both |
| C-258 | BE:123 | idle | button | "Holen und entschlüsseln" | backup.export.start | `openSink` (save-file picker) → `fetchBackup` | Erweitert | simple |
| C-259 | BE:119-120 | running | progress text + `<progress>` | "Geholt: 300 MB von 1,20 GB · entschlüsselt: 280 MB" | backup.export.progress | – | Erweitert | simple |
| C-260 | BE:121 | running | button + hint | "Abbrechen" + "Lass dieses Fenster so lange offen." | backup.export.stop, keepOpen | `stop.abort()` | Erweitert | simple |
| C-261 | BE:125 | done | status | "Fertig: 1,18 GB entschlüsselt. Gespeichert in der gewählten Datei. / Als Download übergeben." | backup.export.done; backup.fetch.savedToFile, handedOver | – | Erweitert | simple |
| C-262 | BE:126 | failed | alert | "Keiner der Speicheranbieter hat dieses Stück herausgegeben." / "Die Verbindung ist abgebrochen, …" / "Der Sicherungsschlüssel dieses Tresors öffnet diese Sicherung nicht." / "Die Sicherung ist unvollständig oder beschädigt angekommen." / "… zu groß …" / "Abgebrochen." / "Die Datei ließ sich nicht anlegen." / "Das Holen ist fehlgeschlagen." | backup.fetch.errors.*, fileFailed, failed | – | Erweitert | both |
| C-263 | BE:129 | key available | text | "**Der Sicherungsschlüssel** öffnet alle deine Sicherungen. Wer ihn hat, kann sie lesen. Die App zeigt ihn nur hier …" | backup.export.keyStrong, key | – | Erweitert | technical |
| C-264 | BE:130 | same | checkbox | "Ich will den Schlüssel sehen und passe selbst auf ihn auf." | backup.export.keyWanted | binds `wanted` | Erweitert | technical |
| C-265 | BE:131 | wanted, not shown | button | "Schlüssel anzeigen" | backup.export.keyShow | `shown = true` | Erweitert | technical |
| C-266 | BE:133 | shown | secret code | `AGE-SECRET-KEY-1…` | – | in memory only | Erweitert | technical |
| C-267 | BE:135 | shown | button | "Kopieren" / "Kopiert" | backup.export.copy, copied | clipboard | Erweitert | technical |
| C-268 | BE:136 | shown | button | "Als schluessel.txt speichern" | backup.export.saveKey; backup.guide.keyFile | downloads key file | Erweitert | technical |
| C-269 | BE:137 | shown | link button | "Wieder verbergen" | backup.export.hide | hides + unticks | Erweitert | technical |
| C-270 | BE:139 | shown | hint | "Lösche die Datei, wenn du fertig bist, und leere die Zwischenablage." | backup.export.cleanUp | – | Erweitert | technical |
| C-271 | BE:143 | no valid age key in profile | hint | "Der Sicherungsschlüssel dieses Tresors ist hier nicht hinterlegt." | backup.export.noKey | – | Erweitert | technical; dead end |

### 2.15 BackupChain.svelte ("Was die Chain sagt")

| ID | file:line | condition | element | German text | i18n key | does | shown under | audience |
|---|---|---|---|---|---|---|---|---|
| C-280 | BC:69-73 | a backup is known (`chainBackup`): Übersicht every phase (LC:1231); Erweitert only VM off + age key (LC:1305) | fold summary with LEDs | one LED per copy + "Was die Chain sagt" (+ sr-only ": alles in Ordnung / Problem / nicht vollständig gelesen"). LED colours: green (#5fd6a8) copy fully read and OK; red (#ff8a80) a problem; amber blinking (#f5b041) reading; dark (#2a3558) not read/incomplete | backup.chain.title, copyState.* | reads the chain on mount (`checkBackupOnChain`) | both (Übersicht always, Erweitert when off) | technical; simple: fold into one "Sicherung geprüft" sentence |
| C-281 | BC:74 | open | intro | "Für jede Kopie liest die App selbst aus den Filecoin-Verträgen (PDPVerifier, Filecoin Warm Storage, Filecoin Pay), ob sie noch da ist. …" | backup.chain.intro | – | both | technical |
| C-282 | BC:75 | backup has no data-set ids | note | "Für diese Sicherung nennt die Liste keinen Datensatz; die App kann ihre Kopien nicht auf der Chain prüfen." | backup.chain.noDataSets | – | both | technical; dead end |
| C-283 | BC:79 | per copy | heading + link | "Kopie bei Anbieter 9 (Frankfurt, DE) · Datensatz 1234 (alles in Ordnung / Problem / nicht vollständig gelesen) · im PDP Explorer" | backup.chain.copy, copyState.*, explorer | external link `pdpExplorer.dataSet` | both | technical |
| C-284 | BC:80 | copy read error | error | "Die Chain ließ sich für diese Kopie nicht lesen: …" | backup.chain.unreadable | – | both | technical |
| C-285 | BC:84 | fact `dataSet` | fact row with sign | "✓ **Datensatz aktiv:** ja, mit den 2 Stücken dieser Sicherung (von der App geprüft)"; variants "ja", "nein: Der PDPVerifier führt den Datensatz nicht mehr.", "x von y Stücken … nicht mehr im Datensatz.", "Der Dienst für diesen Datensatz ist gekündigt; er endet …", "nicht gelesen" | backup.chain.lights.dataSet, notes.dataSet.*, states.* | – | both | technical |
| C-286 | BC:84 | fact `lastProof` | fact row | "✓ **Letzter Beweis:** 17.11.2026, 13:40 (Epoche 3456789)"; "…, länger als zwei Beweisperioden her"; "noch keiner"; "nicht gelesen" | backup.chain.lights.lastProof, notes.lastProof.* | – | both | technical |
| C-287 | BC:84 | fact `nextChallenge` | fact row | "✓ **Nächste Stichprobe:** … (Epoche …)"; "fällig seit … ; der Beweis läuft"; "Frist … ohne Beweis verstrichen"; "keine geplant" | backup.chain.lights.nextChallenge, notes.nextChallenge.* | – | both | technical |
| C-288 | BC:84 | fact `faults` | fact row | "✓ **Verpasste Beweise:** keine in den letzten 30 Beweisperioden"; "2 von 30 Beweisperioden ohne Beweis (Fehler)"; "noch keine Beweisperiode abgelaufen"; "Beweise haben noch nicht begonnen" | backup.chain.lights.faults, notes.faults.* | – | both | technical |
| C-289 | BC:84 | fact `paid` | fact row | "✓ **Bezahlt bis:** 12.03.2027; danach hält die Rücklage die Zahlung noch 30 Tage"; "Das zahlende Konto deckt die Speicherung nicht mehr."; "Die Zahlung ist beendet; sie endet …"; "gedeckt, ohne absehbares Ende"; "Kein Zahlungsweg für diesen Datensatz." | backup.chain.lights.paid, notes.paid.* | – | both | both; "bezahlt bis" matters to simple |
| C-290 | BC:84 | fact `sample` (only after "Jetzt prüfen") | fact row, blue | "• **Probeabruf beim Anbieter:** Der Anbieter liefert die ersten 1024 Bytes aus. Gegen die Piece-CID prüfen lässt sich nur das ganze Stück, darum nur gemeldet. (vom Anbieter gemeldet)"; "Der Anbieter antwortet mit Fehler 500."; "Der Anbieter war aus dem Browser nicht abzufragen." | backup.chain.lights.sample, notes.sample.* | from `sampleFetch` | both | technical |
| C-291 | BC:84 | every fact | state label + sign | signs: ✓ green "von der App geprüft"; • blue "vom Anbieter gemeldet"; ✗ red "Problem"; · grey "keine Angabe"; ▶ "wird gelesen" | backup.chain.states.* | – | both | technical |
| C-292 | BC:90-91 | data sets known | links | "Die 2 Stücke dieser Sicherung im PDP Explorer: …abc123def456, …" | backup.chain.pieces | external `pdpExplorer.piece` | both | technical |
| C-293 | BC:94 | same | button | "Jetzt prüfen" | backup.chain.check | `check(true)`: chain read + sample fetch from each provider | both | technical |
| C-294 | BC:95 | same | status | "Lese die Chain …" / "Gelesen 17.11.2026, 14:03, bei Epoche 3456789." | backup.chain.checking, checkedAt | – | both | technical |
| C-295 | BC:98 | open | legend + link | "Grün: von der App selbst auf der Chain gelesen. Blau: nur vom Anbieter gemeldet. Rot: ein Problem. Grau: keine Angabe." + "Wie ein Anbieter beweist, dass er die Sicherung noch hat" | backup.chain.legend, more | external link to docs/backup-proofs.md on GitHub | both | technical |

### 2.16 BackupPlaces.svelte (Erweitert → Technisch → Einrichtung → Sicherungen)

| ID | file:line | condition | element | German text | i18n key | does | shown under | audience |
|---|---|---|---|---|---|---|---|---|
| C-300 | BP:72-73 | backups switched on (SU:650) | fieldset legend | "Wohin die Sicherungen gehen" | backup.places.legend | – | Erweitert (Einrichtung; for Le-Space-paid customers inside the "dev" fold SU:595) | technical; simple gets defaults |
| C-301 | BP:74 | same | radio | "Region und Anzahl der Kopien" | backup.places.byRegion | `mode='region'` | Erweitert | technical |
| C-302 | BP:75 | same | radio | "Anbieter selbst wählen" | backup.places.byProvider | `mode='providers'` | Erweitert | technical |
| C-303 | BP:78-81 | region mode | select | "Kopien": 1 / 2 / 3 | backup.places.copies | binds `copies` | Erweitert | technical |
| C-304 | BP:83-87 | region mode | select | "Region": "Europa (EWR, Großbritannien, Schweiz)", "EU", "EWR", "USA", "überall", "Länder (Kürzel)" | backup.places.region, regions.*, countries | binds `region` | Erweitert | technical |
| C-305 | BP:89 | region = custom | text input | "Länderkürzel, z. B. DE, NL" (placeholder "DE, NL") | backup.places.countryCodes | binds `countries` | Erweitert | technical |
| C-306 | BP:94-98 | provider mode | checkbox per provider | "Frankfurt, DE · ezpdpz (empfohlen / zugelassen, nicht aktiv, Nr. 9, gesperrt: FIDL (Cello, Bass): am 16.11.2026 …)"; "ohne Ort" | backup.places.noPlace, endorsed, approved, inactive, number, blockedTag, blockedWhy.fidl | `toggle(id)`; disabled if inactive, blocked or 3 already chosen | Erweitert | technical |
| C-307 | BP:102 | provider mode | hint | "Höchstens 3 Anbieter." | backup.places.max | – | Erweitert | technical |
| C-308 | BP:105-106 | list state | hint | "Die Anbieterliste ließ sich gerade nicht lesen." / "Lese die Anbieter …" | backup.places.listUnreadable, reading | no retry | Erweitert | technical |
| C-309 | BP:110-111 | preview | list | "Kopien bei:" + "Frankfurt, DE · ezpdpz" … | backup.places.copiesAt | – | Erweitert | technical |
| C-310 | BP:113 | preview problems | error lines | "Anbieter 9 ist nicht (mehr) zugelassen." / "… ist nicht aktiv." / "… liegt außerhalb der Region." / "… ist gesperrt: …. Bitte einen anderen wählen." / "2 Kopien gewünscht, in der Region gibt es nur 1 zugelassene Anbieter." / "… gehört zum selben Betreiber wie … Zwei Kopien dort fallen zusammen aus: …" | backup.places.problems.* | block saving | Erweitert | technical |
| C-311 | BP:114 | shared operator/place | warning | "Nicht unabhängig: A und B gehören demselben Betreiber (…)." / "… stehen am selben Ort (…)." | backup.places.notIndependent, shared.operator, shared.place | – | Erweitert | technical |
| C-312 | BP:116 | copy outside EU | warning | "Kopien außerhalb der EU (US). Elektronische Bücher und Aufzeichnungen erlaubt die Abgabenordnung ohne Antrag nur in EU-Mitgliedstaaten (§ 146 Abs. 2a AO); …" | backup.places.outsideEu | – | Erweitert | both (legal relevance for any user who changes this) |
| C-313 | BP:118 | fewer independent operators than copies | warning | "Nur 1 unabhängiger Betreiber verfügbar: eine Kopie statt 2. Zwei Kopien beim selben Betreiber legt die App nicht an, …" | backup.places.fewOperators | – | Erweitert | technical |
| C-314 | BP:120-122 | an independent third operator exists | offer + button | "Eine weitere Kopie bei einem unabhängigen Betreiber: foo (Nr. 12) (Paris, FR). Er liegt außerhalb der gewählten Region." + "Diese Kopie hinzufügen" | backup.places.third.offer, outside, add | `addThird()` switches to provider mode with the third added | Erweitert | technical |
| C-315 | BP:125 | prices read | small text | "Kosten ca. 0,30 USDFC im Monat bei 1,2 GB je Kopie." / "… (Grundgebühr, noch keine Daten)." | backup.places.cost | – | Erweitert | technical |
| C-316 | BP:128 | always | button | "Sicherungsorte speichern" | backup.places.save | `onsave(places)` → Setup `savePlaces`; disabled if invalid or unchanged | Erweitert | technical |
| C-317 | SU:653-655 | backups on and VM running | box + button | "Paperless läuft: Geänderte Sicherungsorte gelten für die laufende VM erst, wenn du sie übergibst." / "Orte geändert – jetzt an die laufende VM übergeben? Erst dann sichert sie dorthin." + "An die laufende VM übergeben" | backup.places.pushHint, pushPending, push | Setup `pushPlaces` | Erweitert | technical |

### 2.17 Related items in Lifecycle.svelte that show or drive this slice (context; owned by the lifecycle slice)

| ID | file:line | condition | element | German text | i18n key | does | shown under | audience |
|---|---|---|---|---|---|---|---|---|
| C-320 | LC:1178 | Übersicht, backups configured | status line (amber when stale) | "Letzte erfolgreiche Sicherung: **14:03 (vor 2 Stunden)** · 3 Kopien" / "Letzte Sicherung beim Beenden: …" / "Noch keine erfolgreiche Sicherung bekannt" (+ "Auf Filecoin liegt eine neuere (3 Kopien); ihre Uhrzeit meldet erst das neue Image.") | card.simple.lastGood, lastAtStop, noneKnown, copies, newerOnChain | – | Übersicht | simple (the headline backup answer) |
| C-321 | LC:1204, 1274 | running, reach LED red | warning | "Gerade antwortet keine Kopie der neuesten Sicherung (siehe Licht „Sicherungen erreichbar“ oben). Vor „Sichern und beenden“ lieber warten, …" | card.simple.stopReachBad | – | both | both |
| C-322 | LC:1083 | start refused for lack of credits | link button | "Ich habe aufgeladen – neu prüfen" | funds.toppedUp | `refreshBalances()` | both | both |
| C-323 | LC:1085-1087 | short, package has hours | box + button | "In deinem Paket liegen noch N Stunden. Le Space bezahlt die VM dann daraus; …" + "Aus dem Paket starten (N h)" | card.fund.inPackage, startFromPackage | `startFromPackage` | both | both |
| C-324 | LC:1091-1093 | short, app pays | select + button | "Stunden aus Le Space Credits kaufen": 5 h / 10 h / 30 h + "Kaufen und starten" / "Preis wird abgefragt …" | card.fund.buyLabel, buyAndStart, quoting | `askToBuy` → HourQuote (C-082…) | both | both |
| C-325 | LC:1102-1107 | start pressed, backup not paid today | alertdialog | "**Für heute ist keine Sicherung bezahlt.** Paperless anywhere würde ohne Sicherung laufen: …" + buttons "Erst die Sicherung buchen (im Paket)", "Ohne Sicherung starten", "Doch nicht starten" | card.unpaid.strong, text, book, without, cancel | `toPackage` scrolls to `#paket`; `startWithoutBackup` | both | simple |
| C-326 | LC:1236, 1329 | VM stopped itself at period end | status | "Die bezahlte Laufzeit ist zu Ende. Paperless-ngx hat vorher eine letzte Sicherung gemacht und sich angehalten. …" | card.periodEnd.stopped | – | both | simple |
| C-327 | LC:1350-1366 | Erweitert, VM off, a last backup recorded | fold | "Letzte Sicherung: 17.11.2026, 12:00 · 3/3 Kopien (unvollständig)" + dl "Netz: Filecoin Mainnet / Calibration (Testnetz)", "Bezahlt von: 0x…", "Piece CID: baga…", "Größe: 123,4 MiB (verschlüsselt), in 2 Teilen", "Dauer: 42 s" + per copy "Anbieter 9 (Frankfurt, DE) · Datensatz 12, Piece 3 (neuer Datensatz)" + link "abrufen" "(verschlüsselt; nur dein Schlüssel öffnet sie)" + "2 Fehlversuch(e) bei Anbietern, ersetzt." | card.last.* | external retrieval links | Erweitert | technical |
| C-328 | LC:1283-1299 (labels via LC:319) | Erweitert, VM off | restore radio labels | size part "Grundsicherung abc123, 1,2 GB" / "Ergänzung 3 zu abc123, 0,1 GB in 2 Teilen" | card.snapshotOf, card.inParts | the only place a snapshot/incremental backup is named | Erweitert | technical |

Row count: 9 + 60 + 9 + 9 + 9 + 4 + 15 + 12 + 22 + 18 + 3 + 14 + 20 + 22 + 16 + 18 + 9 = 269 rows.

---

## 3. Lists

### 3.1 Duplicates and overlaps

1. **Period-end warning three times**: banner PG:355 (both tabs), alert inside the package card P:305, chip in "Auf einen Blick" PG:235. Same text keys (`pkg.ending.*`). Plus Lifecycle's "Die bezahlte Laufzeit ist zu Ende" (LC:1236) after the stop.
2. **"Last backup" in up to five places in Übersicht while running**: Lifecycle line "Letzte erfolgreiche Sicherung" (LC:1178), BackupNow summary "letzte Sicherung" (BN:99), BackupNow "Letzte Sicherung: …" (BN:103), the LEDs "Sicherungen erreichbar", and the BackupChain fold; Erweitert adds the glance row "Sicherungen" (PG:238) and the fold "Letzte Sicherung: … n/m Kopien" (LC:1350).
3. **Backup health three ways**: header LEDs (HTTP reach + operator independence), BackupChain (on-chain proofs + sample fetch), ProviderHealth (ping per provider, inside BackupNow's "Grund" fold and Lifecycle logs). All three list the same providers with different colours and wording ("antwortet" in LEDs and ProviderHealth, "Probeabruf" in the chain view). LEDs and BackupChain both have a button called "Jetzt prüfen".
4. **Backup "paid until" in four places**: BackupLine status (P:343), Setup step Sicherungen "bezahlt bis …" (SU:625), BackupChain fact "Bezahlt bis" (BC), Balances Filecoin Pay runway (BA:152).
5. **Refresh buttons**: `RefreshBalances` in Package (P:347), in Balances (BA:122) and Lifecycle (LC:1083, other label), plus Balances' own second "Aktualisieren" button (BA:167) that only re-reads that section. Two buttons with the same word 40 lines apart in one section.
6. **Cancel**: button in card (P:323), Stripe portal "Abo verwalten" (P:406) which also cancels, footer link "Verträge hier kündigen" by mail (BuildInfo.svelte:32), mailto inside the Cancel view (CA:77).
7. **Stripe portal reachable from five controls**: upgrade button for Stripe plans (P:313), "Abo verwalten" (P:406), "Rechnungen des Abos bei Stripe" (P:429), "Zahlungsdaten und Rechnungen" (CA:76), "Abo-Verwaltung bei Stripe" (BL:118).
8. **Buying hours twice**: chips +5/+10/+30 in the package fold (P:398) and the select 5/10/30 h + "Kaufen und starten" in Lifecycle's offer (LC:1091); both use HourQuote with different confirm labels and different top-up hints.
9. **Paying for backups in two unrelated places**: BackupLine (subscription line / year) in the package card, and "1 Monat bezahlen" from the balance in Setup → Sicherungen (SU:626). The service error `credits.backupPlan.NOT_YET` sends the user to "(Einrichtung)".
10. **Two Stripe iframe dialogs with duplicated code**: TopUp has its own `<dialog>` + message listener; StripeCheckout is the shared one (Package subscription, BackupLine year). Three dialog instances exist in the DOM at once.
11. **Storage/quota**: Storage component (8 GB documents, Übersicht) versus `pkg.included` "bis 32 GiB" (backup quota) versus retention "Kontingent" (BN:133): two different limits, units GB vs GiB.
12. **Balance in euros**: `pkg.balance` in the card, `app.simple.balance` card for builds without credits (PG:413), chip on the Technisch wallet fold (PG:395).
13. **Withdrawal waiver checkbox** repeated at four purchase points (plan, top-up, backup line, backup year), deliberately one per purchase; the `preparing` store makes sure only one is open.
14. **Plan cards serve two purposes**: first purchase (pick → step → Stripe) and plan change (immediate `confirm()` → `choosePlan`), same buttons, different behaviour.
15. **i18n duplicate key**: `funds.refresh` is defined twice in the German and English object (funds.js:23 "Kontostand neu laden" and :39 "Aktualisieren"); the later one wins, so "Kontostand neu laden" is never shown although comments (RefreshBalances.svelte:2, balance-refresh.js:3) still name it.

### 3.2 Jargon a lay person sees in the default view (Übersicht, vault unlocked or locked)

- Header LEDs and their panel: "Kopien unabhängig", "Anbieter", "Betreiber", "Domain", "Adresse 0x1234…abcd", "gesperrt (FIDL (Cello, Bass) …)", "Liste der Sicherungen", "von diesem Browser aus".
- Package card: "Stripe", "Monatsabo", "Abo", "Instanz" ("für die laufende Instanz vorgemerkt"), "VM" (voucher text "startet die App keine VM mehr"; self-payer hint "bezahlt die VM bei Aleph direkt"), "Aleph", "Wallet", "Kryptowerte", "Adresse der App", "GiB", "Dauerbetrieb", "Credits" / "Le-Space-Credits-Guthaben" / "VM-Stunden" (HourQuote), "Le Space Credits antwortet 500" (raw error), "Credits-Dienst", "Aleph-Credits", "Treasury"-type service errors, "Konto: 0x…" (full address in Cancel/Withdraw), "Erstattung: re_…", "AGB", "Fassung", "Widerruf", "anteilig".
- BackupLine: "Abo-Verwaltung bei Stripe", "Aufbewahrung", "Rechenzeit", "Zusatzstunden", "Deine Wallet bei Aleph und Filecoin".
- BackupNow: "Image", "VM", "Anbieter", "Aufbewahrung", "Nachweis", "Kontingent", "Wallet", "`node backup.mjs retain --yes`", "Sicherungswerkzeug", raw log lines, "Exit-Code", "Auslagerung", "Datenplatte", "Speicheranbieter".
- BackupChain (in Übersicht in every phase): "Chain", "Filecoin-Verträge", "PDPVerifier", "Filecoin Warm Storage", "Filecoin Pay", "Filecoin-Knoten (Glif)", "Epoche", "Datensatz", "Stück", "Beweis", "Beweisperiode", "Stichprobe", "Probeabruf", "Piece-CID", "PDP Explorer", "Rücklage", "Zahlungsweg", "Bytes".
- Lifecycle lines of this slice: "Auf Filecoin liegt eine neuere …; ihre Uhrzeit meldet erst das neue Image", "…auf der Chain steht".
- Storage: "GB" only (fine).

### 3.3 Dead ends and unclear next steps

1. P:447 balance cannot be read: raw error only, no retry button; the whole card (plans, cancel, withdraw) is gone meanwhile. The legal cancel button is then unreachable except via the footer mail link.
2. P:293-294 plan exists but VM is paid by app/wallet: text says the plan counts only "wenn du beim Start „Le Space, aus meinem Paket“ wählst", but there is no control here; the switch is in Erweitert → Einrichtung.
3. PG:418 Übersicht warning "Für einen Start reicht es gerade nicht: ein Paket wählen oder Stunden dazukaufen." and PG:420 "Details unter „Erweitert“": text only, no link or button.
4. Voucher period (P:317): no change, end, cancel or extend; a second voucher cannot be redeemed while one runs (`PERIOD_RUNNING`) and the voucher fold is hidden while a plan exists, so "Mit einem Paket oder einem neuen Gutschein läuft es weiter" has no control until the period is over.
5. Low hours on a Stripe plan (P:313): the upgrade button silently navigates to the Stripe portal (`location.href`), which locks the app (unlock is in memory only).
6. "Abo verwalten" / portal in general: leaves the app; on return the vault must be unlocked again.
7. Plan paid from balance and balance too low at renewal: only "solange es reicht"; no warning state in the card.
8. BackupLine "Sicherung: nicht gebucht" (tone none) with a plan paid from balance or voucher: `canAdd` is false, so only the "1 Jahr Aufbewahrung" fold is offered; the monthly payment lives in Setup (Erweitert). With `!sold` no action at all.
9. BackupLine tone "over" ("Die Sicherungen sind abgelaufen"): no dedicated action.
10. TopUp "Bezahlt, aber noch nicht gebucht … – „Aktualisieren“": points to a button in another place; same for `cancelNotConfirmed`, `withdrawalNotConfirmed`, `voucherNotConfirmed`.
11. HourQuote short: "Erst Guthaben aufladen (oben, per Karte), dann noch einmal kaufen." No button to the top-up; in Lifecycle the hint names the fold title in another card.
12. Terms due (TM): purchases fail with "Erst den aktuellen Bedingungen (AGB) zustimmen" but plan and top-up buttons stay enabled; the box is at the top of the card, possibly out of view.
13. Withdraw done: "Das Paket ist damit beendet." then only "Schließen"; nothing says what happens to the running VM or the documents.
14. Cancel on an older service: note + automatic jump to the Stripe portal.
15. LEDs red ("Keine der Kopien antwortet"): advice is to wait; only "Jetzt prüfen". LEDs amber independence: fix path given as text "Unter „Erweitert“ → Einrichtung → …", no link. LEDs with no backup: "nach dem Entsperren" while possibly already unlocked and backups off.
16. BackupNow "Diese VM läuft mit einem älteren Image" (BN:94) and "Die VM meldet ihren Sicherungsstand gerade nicht." (BN:139): no action, no retry (auto every 60 s, unstated).
17. BackupNow retention "Entfernen kann nur deine Wallet … `node backup.mjs retain --yes`" and "lässt keinen Platz für eine weitere Sicherung im Kontingent": CLI instruction / no action.
18. BackupNow is not shown in Erweitert at all: a running VM in Erweitert has no "Jetzt sichern" and no backup status. BackupExport is not shown in Übersicht, and in Erweitert only while the VM is off: a lay user has no visible way to download their documents; while running nobody has.
19. BackupExport: "Dafür fehlt gerade die Adresse eines Stücks.", "Der Sicherungsschlüssel dieses Tresors ist hier nicht hinterlegt.", "zu groß … Nimm Chrome oder Edge" are end states without a control.
20. BackupChain "nennt die Liste keinen Datensatz" and per-copy "Problem" states: nothing to do offered; red facts such as "Das zahlende Konto deckt die Speicherung nicht mehr." have no link to paying.
21. BackupPlaces "Die Anbieterliste ließ sich gerade nicht lesen.": no retry; Save stays disabled.
22. Storage "Mehr als im Paket enthalten. Bitte alte Dokumente löschen oder uns schreiben": no contact link, no upgrade.
23. Purchases list stuck on "…" while loading and "Rechnung folgt" with no time hint.
24. Package card has no visible heading; the anchors "Zum Paket" and the footer hint "bei „Dein Paket“" refer to a title that is not rendered.

### 3.4 Persistence from the UI layer

localStorage (no sessionStorage, no IndexedDB anywhere in this slice):

| Key | Written by | Content | Notes |
|---|---|---|---|
| `paperless-credit-unit` | Balances.svelte:49-63 | `'credits'`, `'eur'`, `'usd'` or `'aleph'` | display unit for Aleph credits, per browser |
| `paperless-anywhere.backup-copies` | backup-status.js:21-52 (`rememberCopies`, `knownCopies`, `forgetCopies`), called from +page.svelte:100-111, 186 | `{ network, providerIds: number[], at: ISO }` | unsealed on purpose so the LEDs work while locked; removed with "Diesen Browser vergessen" |
| `paperless-anywhere.tab` | +page.svelte:194-209 | `'simple'` or `'advanced'` | chosen tab; the redesign's mode switch will replace or reuse it |
| `paperless-lang` | i18n/index.js:27-50 | `'de'` / `'en'` | context only |
| `paperless-anywhere.vault` | keys/vault.js:12 | the sealed vault | context only |

Not in browser storage but persisted through this UI: the sealed profile in an Aleph aggregate (`profile.js`, key `paperless-anywhere-profile`): `lastGoodBackup` (written by Lifecycle `rememberGood` from BackupNow's `ongood`), `lastBackup`, `backupConfig` (places from BackupPlaces via Setup `savePlaces`), `backupsByCredits`, `leSpacePays`, `appPays`, `payer`. Package's `applyCustomerDefaults` writes profile defaults once a plan runs.

In memory only (lost on reload): the backup key shown in BackupExport, the `preparing` store (which purchase step is open), `balancesRound` counter, the Stripe client secret (passed in the iframe URL fragment `#cs=…&origin=…`, credits.js:891), all ticked waiver boxes, open folds.

Downloads created by the UI: cancellation receipt .txt (Cancel), withdrawal receipt .txt (Withdraw), `sicherung-selbst-holen-<id>.txt`, `ledger.json`, `schluessel.txt`, `paperless-export-<id>.zip` (BackupExport). Clipboard: backup key (BackupExport), addresses (Addr).

### 3.5 Components: props, events, logic calls

**Package.svelte** (mounted PG:371)
- Props: `master: Uint8Array`, `version?: number` (re-read trigger). Events: `onglance({ plan, hoursLeft, pays, low, endsAt } | null)`, `onprofile()`.
- credits.js: `creditsBalance`, `creditsCatalog`, `creditsPurchases`, `creditsTerms`, `choosePlan`, `startSubscription`, `waitForSubscription`, `subscriptionPortal`, `redeemVoucher`, `quoteVm`, `fundVm`, `withdrawalQuote`, `waiverOf`, `WaiverError`, `planOf`, `planHours`, `PLANS`, `biggerPlan`, `fewHoursLeft`, `hoursPerWeek`.
- period-end.js: `paidUntil`, `endWarning`. balance-refresh.js: `balancesRound`, `refreshBalances`. purchase.js: `hourPurchase`, `purchaseLocked`. purchase-step.js: `preparing`. profile.js: `loadProfile`. customer-defaults.js: `applyCustomerDefaults`. i18n: `format`, `lang`, `t`, `tr`.
- Children: Terms, Cancel, Withdraw, BackupLine, RefreshBalances, Waiver, TopUp, HourQuote, StripeCheckout (`bind:this`, calls `checkout.pay(secret)`).
- Native dialogs: three `confirm()` calls (P:168, 171, 202).

**Terms.svelte**: props `master`, `terms` (from `balance.terms`), event `onaccepted()`. Calls `creditsTerms`, `acceptTerms`.

**Waiver.svelte**: props `withdrawal: { version, de, en } | null`, `checked` (bindable), `testid`. Calls `withdrawalText`.

**HourQuote.svelte**: props `quote`, `hoursAsked`, `short`, `topUpHint`, `confirmLabel`, `disabled`; events `onconfirm()`, `oncancel()`. No logic calls (format only).

**TopUp.svelte**: props `master`, `credits`, `withdrawal`, `ready`; events `onbooked()`, `onwaiver()`. Calls `PACKAGES` (hard-coded 20 €/50 €), `startCheckout`, `payUrl`, `payMessage`, `waitForTopUp`, `waiverOf`, `WaiverError`, `CREDITS_URL`; `preparing` store.

**StripeCheckout.svelte**: props `label`, `summary`; exported method `pay(clientSecret): Promise<'paid' | 'failed' | 'closed'>`. Calls `payUrl`, `payMessage`, `CREDITS_URL`.

**Cancel.svelte**: props `master`, `plan { id, renewsAt, periodEnd, cancelAtPeriodEnd }`, `current { hours } | null`; events `onportal()`, `ondone()`, `onclose()`. Calls `cancelSubscription`, `CancelUnsupportedError`, `cancellationRecord`, `contractName`, `creditsAccount`, `germanDate`, `germanDateTime`, `CANCEL_KIND`, `PROVIDER`, `IMPRINT_URL` (credits.js re-exports from legal-texts.js). No i18n.

**Withdraw.svelte**: props `master`, `withdrawable[] { subject, what, concludedAt, until }`; events `ondone()`, `onclose()`. Calls `withdraw`, `withdrawalRecord`, `withdrawableName`, `creditsAccount`, `germanDate`, `germanDateTime`, `PROVIDER`, `IMPRINT_URL`. No i18n.

**BackupLine.svelte**: props `master`, `backup` (from `backupOf`), `own`, `included`, `offer` (from `backupOfferOf`), `plan`, `withdrawal`, `termsRead`, `disabled`; events `onchanged()`, `onportal()`, `onwaiver()`. Calls `backupStatus`, `addBackupLine`, `startBackupYear`, `waitForBackup`, `waiverOf`, `WaiverError`; `preparing` store; own StripeCheckout.

**Balances.svelte** (mounted PG:396): props `master`, `version`; events `onsummary({ money, lasts, warnings: ('start' | 'backups')[] } | null)`, `onshown(boolean)`. Calls balances.js `alephBalance`, `filecoinBalance`, `hoursOf`, `duration`, `amount`, `LOW_GAS`, `RESERVE_HOURS`, `confidentialCreditsPerHour`, `runningCreditsPerHour`; prices.js `marketPrices`, `money`, `UNITS`; profile.js `loadProfile`, `vmPayer`; vm.js `PAPERLESS_VM`; `balancesRound`. Note: it must stay mounted (even hidden) for the Übersicht warnings.

**RefreshBalances.svelte**: props `label`, `testid`. Calls `refreshBalances()`.

**Addr.svelte**: props `value`, `testid`. Clipboard only.

**Storage.svelte**: props `master`, `profile`. Calls vm.js `vmStatus`, keys `statusToken`, storage.js `storageView`.

**BackupLeds.svelte** (mounted PG:272): props `copies: { network, copies: { providerId, url? }[] } | null`, `remembered: string`; event `onreach(level)`. Calls backup-status.js `checkCopies`, `checkDue`, `reachLevel`, `independenceLevel`. Page side: `knownCopies`, `rememberCopies`, `forgetCopies`.

**BackupNow.svelte** (mounted LC:1200): props `master`, `profile`, `known { at, copies } | null`, `disabled`, `guard(then)`; events `onbusy(boolean)`, `ongood({ at, copies, requested, providerIds })`. Calls backup-overview.js `backupOverview`, `retentionView`, `when`, `BACKUP_TEXTS`; lifecycle.js `requestBackup`, `BackupFailedError`; backups.js `backupSize`; providers.js `providerIdsIn`; vm.js `vmStatus`; child ProviderHealth. Uses its own text lookup (`BACKUP_TEXTS[lang]`), not `$t`.

**BackupExport.svelte** (mounted LC:1304): props `backup`, `identity`. Calls backup-fetch.js `fetchBackup`, `openSink`, `storedBytes`, `MEMORY_LIMIT_BYTES`, `BackupFetchError`; backups.js `ageSecretKey`, `restoreEntry`, `selfRestoreGuide`. No events.

**BackupChain.svelte** (mounted LC:1231, LC:1305): props `network`, `backup { pieceCid, parts?, copies[] }`. Calls backup-chain.js `checkBackupOnChain`, `sampleFetch`, `pdpExplorer`. No events.

**BackupPlaces.svelte** (mounted SU:651): props `network`, `payer`, `config { copies, providerIds, regions }`, `busy`; event `onsave(places)`. Calls providers.js `listProviders`, `pickProviders`, `sharedWarnings`, `outsideEu`, `independentCandidate`, `oneOperator`, `storagePrices`, `monthlyCost`, `bytesPerCopy`; balances.js `amount`.

**Not called from any UI component of this slice** (logic used by Lifecycle/Setup or other modules): snapshots.js (via backups.js `listBackups` / `restoreEntry` only), relays.js (Setup's relay step and attestation; nothing in the backup UI), backups.js `listBackups`, `splitOwn`, `restoreGap`, `knownBackup`, `newerBackup` (Lifecycle), i18n/net.js (wallet, relay, key and runtime errors plus `net.again` / `net.details` used by Lifecycle's error box; only `net.unreachable` surfaces in this slice, as the package card's raw error).
