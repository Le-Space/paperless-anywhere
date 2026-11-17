# Inventory D: what main gained after the inventory

The inventories A, B and C describe `main` at 30f34f4. This file lists what the app's
interface gained from there to 91f682a (PRs #325, #350 to #354), with its place in v0.2.
Line numbers in A, B and C are those of 30f34f4; the files touched since are
`BackupLeds.svelte`, `BackupNow.svelte`, `Lifecycle.svelte` (one line), `routes/app/+page.svelte`
(the lights' record) and the catalogues `app.js`, `backup.js`, `lifecycle.js`.

| ID | file:line (91f682a) | State | Element | German text | i18n key | What it does | v0.2 place | Standard | Technisch | Change |
|---|---|---|---|---|---|---|---|---|---|---|
| D-001 | BackupLeds.svelte:97, i18n/app.js:65 | light "Kopien unabhängig" yellow because fewer operators than copies wanted | sentence | "Nur {n} unabhängige Betreiber verfügbar ({wanted} Kopien gewünscht). Die Kopien liegen bei verschiedenen Betreibern; eine weitere kommt dazu, sobald …" | app.leds.independentSays.few | third reason for a yellow light (#325): `independenceLevel(usable, wanted)` | B-HEALTH | yes; plain: "Zwei von drei gewünschten Kopien. Eine dritte kommt dazu, sobald ein weiterer Betreiber zugelassen ist." No button: nothing to do | yes; operator count, wanted count, provider list in B-COPIES.T | reworded |
| D-002 | BackupNow.svelte:100, i18n/backup.js:23 | running, the VM reports the next backup time | status text | "nächste Sicherung frühestens {Zeit}" | backup.now.nextBackup | from `view.next.kind === 'backup'` (#351) | B-LAST | yes | yes | same |
| D-003 | BackupNow.svelte:101, i18n/backup.js:24 | running, nothing changed since the last backup | status text | "nächste Sicherung, sobald sich etwas ändert" | backup.now.nextOnChange | from `view.next.kind === 'onChange'` | B-LAST | yes | yes | same |
| D-004 | BackupNow.svelte:104, i18n/backup.js:25 | running, the VM reports `minHours` | hint | "Gesichert wird, wenn sich etwas geändert hat und danach 30 Minuten nichts mehr, höchstens alle {h} Stunden. „Jetzt sichern“ und „Sichern und beenden“ sichern sofort." | backup.now.nextHintQuiet | replaces the "alle zwei Stunden" hint on images with the new schedule (#350) | B-LAST | yes | yes | same; the prototype's sentence follows it |
| D-005 | lifecycle.js:484, i18n/lifecycle.js:17 | start, more values than the guest takes | error | "Die App würde der VM {n} Werte übergeben, sie nimmt höchstens {max}. Es wurde nichts übergeben; bitte melde das Le Space." | life.errors.tooManySecrets | start stops before anything is handed over (#354) | G-ERR | plain: "Der Start wurde abgebrochen. Es wurde nichts übergeben." + button "Fehlerbericht kopieren" | yes; today's text with the numbers | fixed dead end: the report button is next to the message |
| D-006 | i18n/backup.js:152; customer-defaults.js | places form; customer default | label; default | "Europa (EU/EWR, Großbritannien, Schweiz)"; a customer's backups go to three independent operators in Europe, EU first (was: EU only) | backup.places.regions.EUROPE | `CUSTOMER_PLACES.regions = ['EUROPE']`; an old EU-only customer profile is moved once (`customerPlacesPatch`) | B-PLACES.T, B-HEALTH | yes; the health sentence says "bei drei verschiedenen Betreibern in Europa" | yes; region label and providers | reworded |
| D-007 | backup-status.js:23-38, routes/app/+page.svelte:102-108 | always | persistence | (none) | (none) | `localStorage['paperless-anywhere.backup-copies']` now also holds `wanted` (copies asked for), so the lights can say D-001 while locked | U-LOCKED, B-HEALTH | yes (feeds the sentence) | yes | same record; v0.2 reads and writes it unchanged |

Nothing else in `pwa/src` that draws interface changed: the other commits touch
`snapshots.js`, `providers.js`, `places-replace.js`, `backup-overview.js` (logic and specs)
and the guest scripts.
