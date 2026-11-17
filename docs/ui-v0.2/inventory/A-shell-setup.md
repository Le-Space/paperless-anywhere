# Inventory A: app shell, setup, first start, help, footer, legal boxes, licences

Source: worktree `quizzical-newton-49ee83`, `pwa/src`. Read-only inventory, nothing changed in the repo.

File abbreviations used in the `file:line` column:

| Abbr. | File |
|---|---|
| P | `routes/app/+page.svelte` |
| S | `lib/Setup.svelte` |
| F | `lib/FirstStart.svelte` (logic: `lib/first-start.js`) |
| H | `lib/Help.svelte` |
| B | `lib/BuildInfo.svelte` |
| T | `lib/Terms.svelte` |
| W | `lib/Waiver.svelte` |
| Lo | `lib/Logo.svelte` |
| A | `lib/Addr.svelte` (helper used by Setup; copy button) |
| L | `routes/lizenzen/+page.svelte` |

i18n: keys are written as `area.key`, read in components as `$t.area.key` (catalogue `lib/i18n/<file>.js`). `first.*` = `i18n/first-start.js`, `ownImage.*` = `i18n/own-image.js`, `pkg.*` = `i18n/package.js`, `buy.*` = `i18n/purchase.js`, `backup.*` = `i18n/backup.js`. `landing:` = `lib/landing/i18n.js` (a separate catalogue, `texts[lang]`).

---

## 1. Structure and state machine

**Routing / shell.** `routes/+layout.svelte` only loads fonts (Sora, IBM Plex Mono) and `theme.css` and renders children; no UI. `/app/` is client-only (`ssr=false`, prerendered shell). `/lizenzen/` is server-rendered, standalone, with its own header/footer and the *landing* catalogue.

**How i18n works (`i18n/index.js`).** One writable store `lang` ('de'|'en'), initial value from `localStorage['paperless-lang']` (default German). `setLang()` writes it and switches at once, no reload (vault stays open). `t` = derived store with all areas for the current language (`$t.app.lock`); `tr()` = same for plain modules and `confirm()` texts; `format.date/dateTime/number/euro` take the language as last argument; `localeOf` gives `de-DE` / `en-GB`. 13 areas: app, backup, buy, card, credits, first, funds, help, life, net, ownImage, pkg, setup.

**Page states of `/app/` (P:276 writes it to a hidden `data-testid="state"`):**

1. `framed` (inside an iframe): one card with a text and a link to HOME. Nothing else works.
2. `shared origin` (path gateway `/ipfs/…`, `/ipns/…`): one card with text and link to HOME.
3. `new` (no vault in this browser): hero card "Neu hier? Tresor anlegen" (risk box, checkbox, primary button, fold to rename the passkey) plus second card "Schon einen Tresor?" (passkey button, fold with the 24 words).
4. `locked` (vault record present, no master secret): hero card "Willkommen zurück" (passkey button, fold with the 24 words, "Diesen Browser vergessen"). Backup lights (BackupLeds) are already shown in the header from remembered provider ids.
5. `unlocked` + `shownPhrase` (right after creating): card "Wiederherstellungsphrase", sub-state A = the 24 words + "Aufgeschrieben", sub-state B (`confirming`) = three word inputs + "Stimmt" / "Wörter noch einmal zeigen". Tabs, Lifecycle and Package are not rendered; the "Technisch" card is rendered but hidden.
6. `unlocked`, tab **Übersicht** (`simple`, default): period-end banner (if due) → `Lifecycle simple` → `Package` (only when `CREDITS_URL`) → balance line (only without `CREDITS_URL`) → warning lines "start"/"backups". The "Technisch" card (Balances, VmList, Setup) is mounted but `hidden`; its components still run and feed the overview (summary, warnings).
7. `unlocked`, tab **Erweitert** (`advanced`): period-end banner → "Auf einen Blick" (glance rows with anchors) → `Package` (CSS order puts it first) → `Lifecycle` (full) → card "Technisch" with four folds: "Schlüssel und Passkeys" (address, add passkey), "Deine Wallet bei Aleph und Filecoin" (`Balances`, fold hidden unless Balances says `onshown(true)`), "Meine VMs" (`VmList`), "Einrichtung" (`Setup`, opens by itself when Lifecycle reports missing items or via `onadvanced`).

Always present: header (Logo with tagline, GitHub mark, DE/EN, "Sperren" when unlocked, `BackupLeds` when a vault exists and not shared/framed), page error line, `Help` (fold, closed by default, opened by `#hilfe`/`#help`), `BuildInfo` footer.

**Setup (S), inside "Technisch → Einrichtung".** Title, fold "Wo die Einrichtung liegt", wallet-waiting banner, then (after load) an overview list "Auf einen Blick" (one row per step with ✓/• and "Ändern"), then steps as `<details>`: 1 "Wer zahlt die VM?" · [Aleph approval, only wallet pays the VM] · [Filecoin session key, only wallet pays backups] · Attest-Relay · Sicherungen · Image und Knoten · Feste Adresse. Numbering is dynamic. Network select + role radios sit above the steps. When `profile.leSpacePays` ("customer mode", `devSteps`): only pays / image / address are numbered; network, role, relay and backups move into one fold "Für Entwickler: …" at the end. A step is open initially when it is not done.

**FirstStart (F)** is mounted by `Lifecycle.svelte:1139` (`{#if ceremony}`), so it appears in **both tabs**: a full-screen dark overlay (role=dialog) during the first start with an own image or an image rebuild. Sub-states: journey (six stations wake/check/seal/fetch/store/paperless; five on rebuild), minimized bar (only while running), failed ("Kurz innegehalten"), done ("Geschafft"), certificate (`ImageCertificate`). Side effects: Wake Lock, `beforeunload` question, tab title with percent.

**Terms (T)** is mounted in `Package.svelte:288`; **Waiver (W)** in `Package.svelte:383`, `TopUp.svelte:87`, `BackupLine.svelte:114/125`. Both therefore show in both tabs wherever the Package card shows.

---

## 2. Inventory table

"Shown under": **pre** = before unlock, **Ü** = Übersicht, **E** = Erweitert, **both** = both tabs, **all** = every state.

### 2.1 Header (P:258-273)

| ID | file:line | State / condition | Type | German label / text | i18n key | What it does | Shown under | Audience |
|---|---|---|---|---|---|---|---|---|
| A-001 | P:260, Lo:34-40 | always | link (logo + name) | "LE SPACE Paperless anywhere"; title "Zur Startseite" / unlocked: "Zur Startseite (die App wird dabei gesperrt)" | app.home, app.homeLocks | Goes to landing `/` or `/en/`; `leave()` asks first when something is under way | all | both; the way home, but the lock side effect needs plain words |
| A-002 | P:260 (NgxText) | always | text + link | "Paperless-ngx in vertraulichen VMs · ein Angebot von Le Space" ("Paperless-ngx" linked to GitHub project) | landing: tagline | External link to paperless-ngx repo | all | both; "vertrauliche VMs" is jargon for simple |
| A-003 | P:174 | unlocked and `acting` on logo click | confirm dialog | "Die App wird beim Wechsel zur Startseite gesperrt. Gerade läuft noch etwas (Start, Sicherung oder Stopp); die VM macht …" | app.leaveBusy | `confirm()`; cancel prevents navigation | both | both; reword without "VM" for simple |
| A-004 | P:262 | always | icon link | GitHub mark, aria/title "Quelltext von Paperless anywhere auf GitHub" | app.footer.source | Opens repo in new tab | all | technical; duplicate of footer link |
| A-005 | P:264-268 | always | button group (2 toggles) | "DE" / "EN", group label "Sprache" | app.langLabel | `setLang(l)`; stored in localStorage, no reload | all | both |
| A-006 | P:269 | unlocked | button | "Sperren" | app.lock | `lock()`: zeroes master, clears shown phrase, LEDs back to memory | both (also during phrase!) | both |
| A-007 | P:272 | vault exists, not shared/framed | status lights (component BackupLeds, other slice) | lights "Sicherungen erreichbar" / "Kopien unabhängig" etc. | app.leds.* | Props `copies`, `remembered`; reports `onreach` level to Lifecycle | pre (locked) + both | both; simple needs one plain sentence, technical the per-provider detail |
| A-008 | P:254-256 | always | page title | "Paperless anywhere" | (literal) | browser tab title | all | both |
| A-009 | P:276 | always | hidden status text | "framed" / "shared origin" / "new" / "locked" / "unlocked" | (literal, sr-only) | test hook; read by screen readers in English | all | technical (should not be read aloud as is) |

### 2.2 Framed / shared origin (P:278-285)

| ID | file:line | State | Type | German text | i18n key | What it does | Shown under | Audience |
|---|---|---|---|---|---|---|---|---|
| A-010 | P:279-281 | framed | card with text + link | "Die App ist hier in eine andere Seite eingebettet. So öffnet sie den Tresor nicht … Bitte direkt unter https://paperless.le-space.de/app/ öffnen." | app.framed.before/after | Link to HOME in new tab | pre | both; safety stop |
| A-011 | P:283-285 | shared origin | card with text + link | "Diese Adresse teilen sich alle Seiten dieses IPFS-Gateways, auch ihr Speicher und ihre Passkeys. Den Tresor öffnet die App hier nicht. Bitte unter … öffnen." | app.shared.before/after | Link to HOME (same tab) | pre | both; "IPFS-Gateway" needs plain wording for simple |

### 2.3 No vault: create and open (P:286-311)

| ID | file:line | State | Type | German text | i18n key | What it does | Shown under | Audience |
|---|---|---|---|---|---|---|---|---|
| A-012 | P:290 | new | heading h1 | "Neu hier? Tresor anlegen" | app.create.title | | pre | both |
| A-013 | P:291 | new | text | "Deine Dokumente in Paperless-ngx, auf einer eigenen, verschlüsselten Maschine. Ein Passkey auf diesem Gerät öffnet deinen Tresor; …" | app.create.lede | | pre | both; simplify "Passkey", "Maschine" |
| A-014 | P:292-293 | new | warning box | "**Nur du hast den Schlüssel.** Le Space kann deinen Tresor weder öffnen noch wiederherstellen. Sind Passkey und die 24 Wörter weg, …" | app.create.riskStrong, app.create.risk | | pre | both; must stay (key-loss notice) |
| A-015 | P:294 | new | checkbox | "Verstanden: Ich bewahre die 24 Wörter sicher auf, auf Papier und nicht auf diesem Gerät." | app.create.understood | binds `understood`; enables the create button | pre | both; mandatory |
| A-016 | P:296 | new | primary button | "Passkey anlegen" | app.create.button | `create()` → `createVault(name)`, sets master and `shownPhrase`; disabled while busy or unticked | pre | both; label says "Passkey" while the heading says "Tresor" |
| A-017 | P:297-298 | new | fold (details) | "Name des Passkeys ändern" | app.create.renameFold | opens the name field | pre | technical |
| A-018 | P:299 | new, fold open | text input | label "Name des Passkeys", default "Paperless anywhere" | app.create.renameLabel | binds `name` (passkey display name; also used by "add passkey") | pre | technical |
| A-019 | P:303 | new | heading h2 | "Schon einen Tresor?" | app.open.title | | pre | both |
| A-020 | P:304 | new | button | "Auf diesem Gerät mit Passkey öffnen" | app.open.passkey | `unlockPasskey()` → `unlockWithPasskey(null)`; disabled while waiting | pre | both |
| A-021 | P:305 | new, passkey prompt pending | hint | "Warte auf den Passkey … Gibt es für {host} noch keinen, mit den 24 Wörtern öffnen." | app.open.waitingNone | | pre | both; host name is jargon |
| A-022 | P:306-307 | new | fold | "Auf diesem Gerät mit Wiederherstellungsphrase öffnen" | app.open.phraseFold | reveals textarea + button | pre | both; this is the only path on a new device, must not be hidden for simple |
| A-023 | P:308 | new, fold open | textarea (3 rows, no label) | (no label, no placeholder) | - | binds `phrase` | pre | both; needs a label |
| A-024 | P:309 | new, fold open | button | "Öffnen" | app.open.button | `unlockPhrase()` → `unlockWithSeedPhrase(null, phrase)`; disabled when empty | pre | both |

### 2.4 Locked (P:312-324)

| ID | file:line | State | Type | German text | i18n key | What it does | Shown under | Audience |
|---|---|---|---|---|---|---|---|---|
| A-025 | P:314 | locked | heading h1 | "Willkommen zurück" | app.locked.title | | pre | both |
| A-026 | P:315 | locked | text | "Entsperre mit deinem Passkey, dann siehst du, ob Paperless-ngx läuft." | app.locked.lede | | pre | both |
| A-027 | P:316 | locked | primary button | "Mit Passkey entsperren" | app.locked.passkey | `unlockPasskey()` → `unlockWithPasskey(vault)` | pre | both |
| A-028 | P:317 | locked, prompt pending | hint | "Warte auf den Passkey …" | app.locked.waiting | | pre | both |
| A-029 | P:318-319 | locked | fold | "Mit Wiederherstellungsphrase entsperren" | app.locked.phraseFold | reveals textarea + button | pre | both |
| A-030 | P:320 | locked, fold open | textarea (no label) | - | - | binds `phrase` | pre | both |
| A-031 | P:321 | locked, fold open | button | "Entsperren" | app.locked.button | `unlockPhrase()` | pre | both |
| A-032 | P:323 | locked | quiet link-button | "Diesen Browser vergessen" | app.locked.forget | `reset()`: confirm, then `forgetVault()`, `forgetCopies()`, state → new | pre | technical (or simple behind a clear "another person's vault?" wording) |
| A-033 | P:183 | on A-032 | confirm dialog | "Diesen Tresor in diesem Browser vergessen? Mit der Wiederherstellungsphrase lässt er sich neu öffnen." | app.forgetConfirm | `confirm()` | pre | both |

### 2.5 Recovery phrase shown / confirmed (P:326-341)

| ID | file:line | State | Type | German text | i18n key | What it does | Shown under | Audience |
|---|---|---|---|---|---|---|---|---|
| A-034 | P:328 | unlocked + shownPhrase | heading h2 | "Wiederherstellungsphrase" | app.phrase.title | | (own screen, no tabs) | both; simple: "Deine 24 Wörter" |
| A-035 | P:329 | same | text | "Schreib sie auf Papier und bewahre sie sicher auf, nicht auf diesem Gerät. Sie wird nur jetzt angezeigt. …" | app.phrase.lede | | own screen | both |
| A-036 | P:331 | not confirming | ordered list (24 items, 2 columns, mono) | the 24 words | - | display only; no copy / print button | own screen | both |
| A-037 | P:332 | not confirming | primary button | "Aufgeschrieben" | app.phrase.written | `startConfirm()`: picks 3 positions (`confirmationPositions()`), clears answers | own screen | both |
| A-038 | P:334 | confirming | text | "Zur Probe, von deinem Zettel:" | app.phrase.check | | own screen | both |
| A-039 | P:335-337 | confirming | 3 text inputs | "Wort {n}" | app.phrase.word(n) | bind `answers[i]`; compared lower-case trimmed | own screen | both |
| A-040 | P:338 | confirming | primary button | "Stimmt" | app.phrase.right | `doneConfirm()`: forgets the shown phrase → tabs appear; disabled until all three match (no per-field feedback) | own screen | both |
| A-041 | P:339 | confirming | quiet button | "Wörter noch einmal zeigen" | app.phrase.again | `confirming = false` → list again; next "Aufgeschrieben" asks new positions | own screen | both |

### 2.6 Unlocked: tabs, banner, glance, cards (P:343-423)

| ID | file:line | State | Type | German text | i18n key | What it does | Shown under | Audience |
|---|---|---|---|---|---|---|---|---|
| A-042 | P:343-346 | unlocked, no phrase | tablist, aria-label "Ansicht" | tabs "Übersicht" / "Erweitert" | app.tabs.label/simple/advanced | `showTab()`; stored in `localStorage['paperless-anywhere.tab']` | both | both; becomes the "Einfach / Technisch" switch |
| A-043 | P:354-358 | `ending` (paid time ends within 72 h, or ended; only CREDITS_URL and package pays) | alert card | **soon:** "Deine bezahlte Laufzeit endet am {Datum}. Sie verlängert sich nicht." / **urgent:** "Deine bezahlte Laufzeit endet bald: {Datum}." / **ended:** "… ist am {Datum} zu Ende gegangen." + "Eine Stunde vor dem Ende macht Paperless-ngx eine letzte Sicherung und hält an. …" | pkg.ending.soon/urgent/ended, pkg.ending.what | computed by `endWarning(pkg.endsAt, clock)` (period-end.js; clock ticks each minute); `urgent` class adds a border | both, above everything | both; important for simple |
| A-044 | P:357 | same | anchor link | "Zum Paket" | pkg.ending.more | jumps to `#paket` | both | both |
| A-045 | P:361-362 | advanced, glance rows exist | card heading | "Auf einen Blick" | app.glance.title | | E | technical (simple gets its status from the Lifecycle card) |
| A-046 | P:235, 365 | advanced, CREDITS_URL and pkg known | row: link + chip | "Paket" → "kein Paket" / "nicht in Gebrauch" / "endet {Datum}" / "{h} h übrig" / "aktiv"; tone warn/ok | app.glance.package, .noPackage, .notInUse, .hoursLeft, .active, pkg.ending.chip | link to `#paket`; data from `Package onglance` | E | both (simple: one sentence "Dein Paket reicht noch …") |
| A-047 | P:237, 365 | advanced, life known | row | "Paperless-ngx" → "aus" / "läuft" / "startet" / "wird beendet" / "wird gelöscht" / "Start unterbrochen" / "…" | app.glance.phases.* | link `#paperless`; data from `Lifecycle onglance` | E | both |
| A-048 | P:238, 365 | same | row | "Sicherungen" → "aus" / "noch keine" / "{dd.mm. hh:mm} · {n} Kopien" | app.glance.backups, .backupsOff, .noneYet, .copies | link `#paperless` | E | both |
| A-049 | P:239, 365 | same | row | "Adresse" → host name / "feste Adresse" / "neu bei jedem Start" | app.glance.address, .fixedAddress, .newAddress | link `#technisch` (does not open the setup fold) | E | technical |
| A-050 | P:240, 365 | same | row | "Zahlweg" → "Le Space, aus dem Paket" / "Adresse der App" / "Meine Wallet" / "noch nicht gewählt" | app.glance.payWay, .pays.*, .notChosen | link `#technisch` | E | technical |
| A-051 | P:370 | unlocked, no phrase | component mount `Lifecycle` (id `paperless`) | (other slice) | life.*, card.* | props `master, simple, version, reach`; events `onchange, onadvanced, onmissing, onglance, onbusy, oncopies` | both (`simple` prop switches its layout) | both |
| A-052 | P:371 | same, `CREDITS_URL` | component mount `Package` (id `paket`) | (other slice) | pkg.*, buy.* | props `master, version`; events `onglance, onprofile`; in Übersicht after Lifecycle, in Erweitert first (CSS order) | both | both |
| A-053 | P:378-380 | advanced, no phrase | card heading + purpose | "Technisch" · "Für Fortgeschrittene. Für den Alltag ist nichts davon nötig." | app.tech.title, app.tech.purpose | section `#technisch`; `hidden` in Übersicht and while phrase shows (but mounted) | E | technical |
| A-054 | P:381-382 | advanced | fold (part) | "Schlüssel und Passkeys" | app.tech.keys | closed by default | E | technical; "add passkey for second device" also matters to simple |
| A-055 | P:383 | fold open | text + code | "Entsperrt. Schlüssel dieser App für Aleph:" `0x…` (full address, no copy button) | app.tech.unlocked | derived from master | E | technical |
| A-056 | P:384 | fold open | hint | "Dein Browser leitet diesen Schlüssel aus deinem Passkey (oder den 24 Wörtern) ab; Le Space hat ihn nicht. Aleph-Credits liegen …" | app.tech.keyHint | | E | technical |
| A-057 | P:385-386 | fold open | nested fold | "Weiteren Passkey hinzufügen" | app.tech.addFold | | E | both (needed for a second device / hosted app) |
| A-058 | P:387 | nested fold open | hint | "Ein Passkey gehört zu einer Adresse ({host}). Für die gehostete App oder ein zweites Gerät: dort mit den 24 Wörtern öffnen …" | app.tech.addHint(host) | | E | both; reword for simple |
| A-059 | P:388 | nested fold open | button | "Passkey für {host} anlegen" | app.tech.addButton(host) | `newPasskey()` → `addPasskey(master, "<name> (<host>)")` | E | both |
| A-060 | P:389 | after success | notice | "Neuer Passkey für {host} angelegt; dieser Browser nutzt ihn ab jetzt." | app.tech.added(host) | | E | both |
| A-061 | P:394-397 | advanced, `balancesShown` (Balances decides: only where the person pays with crypto) | fold + chip + component `Balances` | "Deine Wallet bei Aleph und Filecoin" + chip `{summary.money}` | app.tech.wallet | `Balances` props `master, version`; events `onsummary`, `onshown` | E (component always mounted, feeds Ü) | technical |
| A-062 | P:398-401 | advanced | fold + component `VmList` | "Meine VMs" | app.tech.vms | props `master, version`; event `onchange` | E | technical |
| A-063 | P:402-405 | advanced | fold + chip + component `Setup` | "Einrichtung" + chip "es fehlt etwas" (warn) / "vollständig" | app.tech.setup, .missing, .complete | `bind:open={setupOpen}`; opened by Lifecycle `onmissing` (non-empty) or `onadvanced` (which also switches the tab) | E | technical; "es fehlt etwas" must surface in simple as a plain task |
| A-064 | P:412-415 | Übersicht, no CREDITS_URL, `summary.money` | card line | "Guthaben {money}" + "reicht ca. {time}" | app.simple.balance, app.simple.lasts | from `Balances onsummary` | Ü | both (only self-payers) |
| A-065 | P:417-421 | Übersicht, `summary.warnings` has 'start' | status warning | with credits: "Für einen Start reicht es gerade nicht: ein Paket wählen oder Stunden dazukaufen." / without: "Für einen Start reicht das Guthaben gerade nicht. Details unter „Erweitert“." | app.simple.startShortCredits / startShort | text only, no link | Ü | both; simple needs a button to the package |
| A-066 | P:417-421 | Übersicht, warnings has 'backups' | status warning | "Das Guthaben für die Sicherungen geht bald zu Ende. Details unter „Erweitert“." | app.simple.backupsShort | text only | Ü | both |
| A-067 | P:426 | any state, `error` set | error line (role=alert) | raw error message (from vault.js / passkey / network, e.g. `net.keys.noVaultForPasskey`) | (message texts in `net.*`) | set by `run()` / `unlockPasskey()`; also sent to `noteError` | all | both; simple needs plain-language errors and a next step |
| A-068 | P:428 | always | component mount `Help` | see 2.9 | help.* | props `t, lang, faq, diagnosis` | all | both |
| A-069 | P:429 | always | component mount `BuildInfo` | see 2.10 | app.footer.* | no props | all | both (legal links) / technical (build line) |

### 2.7 Setup (S), only under Erweitert → Technisch → Einrichtung

| ID | file:line | State / condition | Type | German text | i18n key | What it does | Shown under | Audience |
|---|---|---|---|---|---|---|---|---|
| A-070 | S:447 | always | heading h2 | "Einrichtung" | setup.title | duplicates the fold summary A-063 | E | technical |
| A-071 | S:448-449 | always | fold | "Wo die Einrichtung liegt: verschlüsselt auf Aleph, auf jedem Gerät da" | setup.where.summary | | E | technical |
| A-072 | S:450 | fold open | text | "Jede Änderung hier wird **in diesem Browser verschlüsselt** (AES-256-GCM, mit einem Schlüssel aus deinem Tresor) und dann **auf Aleph** gespeichert, …" | setup.where.sealed.* | | E | technical (a one-line version is good for simple: "auf jedem Gerät da") |
| A-073 | S:451 | fold open | text | "Drin sind: zahlendes Konto, Netz, Relays, Image, Knoten und Passphrase des Images, die Sicherungseinstellungen …" | setup.where.holds | | E | technical |
| A-074 | S:452-453 | fold open | text + link | "Aleph sieht nur einen verschlüsselten Block, wann er sich ändert, … Mehr: Schlüssel und Wiederherstellung." | setup.where.sees, .more, .moreLink, .moreEnd | link to `docs/keys-and-recovery.md` on GitHub, new tab | E | technical |
| A-075 | S:455 | `busy === 'wallet'` | waiting banner | "Warte auf MetaMask … (bitte dort bestätigen oder ablehnen)" | setup.walletWaiting | | E | technical |
| A-076 | S:457 | profile not loaded | text | "Lade Einstellungen …" | setup.loading | stays if loading fails (error below, no retry) | E | technical |
| A-077 | S:459-460 | loaded | sub-heading h4 | "Auf einen Blick" | setup.overview.title | second "Auf einen Blick" on the page (see A-045) | E | technical |
| A-078 | S:413, 462-468 | loaded | status row ✓/• | "Zahlung" → "Le Space, aus deinem Paket" / "die Adresse dieser App" / "deine Wallet" / "noch offen" | setup.overview.labels.pays, .pays.* | row; ok when a payer is set | E | both (simple: read-only "Bezahlt wird aus deinem Paket") |
| A-079 | S:414 | wallet pays the VM | status row | "Aleph-Freigabe" → "freigegeben" / "noch nicht freigegeben" | setup.overview.labels.aleph, .aleph.* | | E | technical |
| A-080 | S:415 | wallet pays backups | status row | "Filecoin-Schlüssel" → "gültig bis {Datum}" / "noch nicht erteilt" | setup.overview.labels.filecoin, .filecoin.* | | E | technical |
| A-081 | S:416-417 | loaded | status row | "Attest-Relay" → "eigenes eingetragen" / "wird gesucht …" / "von Le Space ({n} gefunden)" / "keines gefunden" | setup.overview.labels.relay, .relay.* | shown even in customer mode | E | technical |
| A-082 | S:418-420 | loaded | status row | "Sicherungen" → "aus" / "an" / "an, bezahlt bis {Datum}" / "an, aber ohne Schlüssel" | setup.overview.labels.backups, .backups.* | | E | both |
| A-083 | S:421-423 | loaded | status row | "Image" → "eigenes, gebaut am {Datum}" / "eigenes, wird beim ersten Start gebaut" / "eigenes, noch nicht gebaut" / "öffentliches von Le Space" / "noch offen" | setup.overview.labels.image, .image.* | | E | technical |
| A-084 | S:424 | loaded | status row (always ok) | "Feste Adresse" → "eingerichtet" / "keine (optional)" | setup.overview.labels.address, .address.* | | E | technical |
| A-085 | S:467 | each row | link-button | "Ändern" | setup.overview.open | `goTo(key)`: opens the step (and the developer fold if needed), scrolls to `#setup-<key>` | E | technical |
| A-086 | S:668-674 | not customer mode: above the steps; customer mode: inside the developer fold | select | label "Netz"; options "Test (Calibration)" / "Produktiv (Mainnet)" | setup.network.label/test/main | `changeNetwork()`: saves network, drops backup places and backup signer; default `calibration` | E | technical |
| A-087 | S:676-679 | same | radio group (fieldset) | legend "Rolle dieser Instanz"; "Test: Mail-Regeln aus, Sicherungen ins Testnetz" / "Produktiv: ruft die Mails ab und sichert auf Mainnet" | setup.role.legend/test/primary | `setRole()`; "primary" asks a confirm first | E | technical (simple: fixed by the package, never asked) |
| A-088 | S:170 | choosing "Produktiv" | confirm dialog | "Diese Instanz produktiv machen? Sie ruft dann die Mails ab und schreibt die Mainnet-Sicherungen. Nur eine Instanz darf das: …" | setup.role.confirm | cancel puts the radio back | E | technical |
| A-089 | S:680-682 | role = primary | warning | "Nur eine Instanz darf produktiv sein. Läuft Paperless-ngx noch anderswo produktiv (z. B. auf dem Mac), …" + (not mainnet) " Produktiv braucht das Netz „Produktiv (Mainnet)“." | setup.role.warning, .needsMainnet | | E | technical |
| A-090 | S:684, 687-690 | after any action | feedback line per action | "Gespeichert ✓" (4 s) or the raw error in a red framed box | setup.saved | snippet `feedback(key)`; keys: network, role, pays, wallet, image, old-images, own-image, dns, relay, bycredits, owner, age, places-push, backups, places | E | both (pattern to keep: confirmation next to the action) |
| A-091 | S:474-475 | loaded | step fold | "{n}. Wer zahlt die VM?" | setup.pays.title(n) | `bind:open={opened.pays}` | E | technical |
| A-092 | S:477 | CREDITS_URL | radio | "Le Space, aus meinem Paket: keine Wallet, keine Kryptowerte" | setup.pays.lespace | `setPays('lespace')`: saves `leSpacePays`, may default backups to credits | E | both (simple: preset, not a choice) |
| A-093 | S:478 | always | radio | "Meine Wallet (MetaMask), mit einer Freigabe für diese App" | setup.pays.wallet | `setPays('wallet')` | E | technical |
| A-094 | S:479 | always | radio | "Diese App selbst: Aleph-Credits liegen auf ihrer Adresse" | setup.pays.app | `setPays('app')` | E | technical |
| A-095 | S:482-483 | CREDITS_URL | fold | "Aleph selbst bezahlen, ohne Paket (für Fortgeschrittene)" | setup.pays.self.summary | | E | technical |
| A-096 | S:484-489 | fold open | text + 2 bullets + text | "Die VM läuft auf Aleph. Statt über ein Paket kannst du sie dort auch selbst bezahlen:" · "**Meine Wallet:** Die Aleph-Credits liegen in deiner Wallet …" · "**Diese App selbst:** Du schickst Aleph-Credits selbst an die Adresse der App. …" · "Dann rechnet Le Space für die VM nichts ab: …" | setup.pays.self.intro, .walletStrong, .wallet(step), .appStrong, .app, .after(step) | | E | technical |
| A-097 | S:493 | Le Space pays | hint + address | "Le Space bezahlt deine VM aus einem eigenen Konto für dich; diese App startet und beendet sie in dessen Auftrag. …" + "Konto für deine VM: " `0x…` [Kopieren] | setup.pays.lespaceHint, .vmAccount | Addr with copy | E | technical (first sentence fine for simple) |
| A-098 | S:495-496 | app pays | text + address + green note | "Adresse der App: " `0x…` [Kopieren] · "Hier liegen deine Aleph-Credits für die VMs. Den Schlüssel dazu leitet dein Browser …" | setup.pays.appAddress, .appMoney(credits) | | E | technical |
| A-099 | S:497 | app pays | hint | "Eine Wallet brauchst du so nur für Sicherungen (Filecoin), und auch dafür nicht, wenn Le Space Credits sie bezahlen (Schritt n)." | setup.pays.walletOnlyForBackups | | E | technical |
| A-100 | S:500-501 | wallet connected | text + address + green note | "Verbunden: " / "Wallet für die Sicherungen: " `0x…` · "Hier liegen deine Mittel für den Betrieb: Aleph-Credits für die VMs, {FIL und USDFC / im Testnetz tFIL und USDFC} für die Sicherungen." / "… für die Sicherungen: …" + " Den Schlüssel dazu hat nur deine Wallet; …" | setup.pays.connected, .walletForBackups, .fundsAll, .fundsBackups, .coinsMain, .coinsTest, .keyOnlyWallet | | E | technical |
| A-101 | S:504 | always in step | button | "Wallet verbinden" / "Wallet für Sicherungen verbinden" / "Anderes Wallet verbinden" | setup.pays.connect, .connectForBackups, .connectOther | `connect()` → `connectPayer()` (MetaMask), saves `payer` | E | technical |
| A-102 | S:507-509 | wallet pays the VM | step fold | "{n}. Aleph: diese App darf VMs starten und löschen" | setup.aleph.title(n) | | E | technical |
| A-103 | S:510-511 | same | text + address + amber note | "App-Schlüssel: " `0x…` · "Hält keine Mittel – nichts an diese Adresse schicken. Er darf nur im Auftrag des zahlenden Kontos …" | setup.aleph.appKey, .noFunds | | E | technical |
| A-104 | S:512 | same | status text | "freigegeben (INSTANCE, FORGET, Port-Freigaben)" / "nicht freigegeben" | setup.aleph.granted, .notGranted | | E | technical |
| A-105 | S:514-516 | same | button | "Freigabe zurücknehmen" / "In der Wallet freigeben" | setup.aleph.revoke, .grant | `authorize(revoke)` → `setAlephAuthorization()` | E | technical |
| A-106 | S:521-523 | wallet pays backups | step fold | "{n}. Filecoin: Sicherungen hinzufügen" | setup.filecoin.title(n) | | E | technical |
| A-107 | S:524-525 | same | text + address + amber note | "Sitzungsschlüssel: " `0x…` · "Hält keine Mittel – nichts an diese Adresse schicken. Er darf 30 Tage lang Sicherungen hinzufügen, …" | setup.filecoin.sessionKey, .noFunds | | E | technical |
| A-108 | S:526 | same | status text | "gültig bis {Datum}" / "nicht freigegeben" | setup.filecoin.validUntil, .notGranted | | E | technical |
| A-109 | S:528 | same | button | "Für 30 Tage freigeben" / "Um 30 Tage verlängern" | setup.filecoin.grant, .extend | `session()` → `setFilecoinSessionKey(…, {days: 30})` | E | technical |
| A-110 | S:529 | key valid | button | "Zurücknehmen" | setup.filecoin.revoke | `session(true)` | E | technical |
| A-111 | S:606-607 | not customer mode: numbered step; customer mode: in developer fold | step fold | "{n}. Attest-Relay" (unnumbered in the developer fold) | setup.relay.title(n) | | E | technical |
| A-112 | S:608 | same | fold "Mehr dazu" + hint | "Die App findet die Relays von Le Space bei jedem Start selbst über Aleph: nur solche, die Aleph als laufende VM …" | setup.more, setup.relay.hint | | E | technical |
| A-113 | S:609 | same | status text | "Gefunden: " + `…` / list of relay hosts / "keins (Aleph gerade nicht erreichbar oder kein Relay angemeldet)" | setup.relay.found, .none | from `findAttestRelays()` | E | technical |
| A-114 | S:610-611 | same | textarea with label | "Eigene Relays (optional), eins pro Zeile, werden vor denen von Le Space versucht: `wss://…/attest` oder die Multiaddr eines orbitdb-relay (`/dns4/…/p2p/…`)"; placeholder "leer = nur die Relays von Le Space" | setup.relay.own.before/or/after, .placeholder | binds `relayInput` | E | technical |
| A-115 | S:612 | same | button | "Relays speichern" / "Eigene Relays entfernen" | setup.relay.save, .remove | `saveRelay()` → `attestRelay` | E | technical |
| A-116 | S:615-616 | as A-111 | step fold | "{n}. Sicherungen" | setup.backups.title(n) | | E | technical (on/off state also for simple, read-only) |
| A-117 | S:618-621 | CREDITS_URL | radio group | "Bezahlt aus meinem Wallet (Schritt n)" / "Bezahlt über Le Space Credits, ohne Wallet" | setup.backups.byWallet(step), .byCredits | `setBackupsByCredits(bool)` | E | technical |
| A-118 | S:623-624 | backups by credits | text + address + amber note | "Schlüssel der VM für die Sicherungen: " `0x…` · "Aus deinem Tresor abgeleitet. Hält keine Mittel – nichts an diese Adresse schicken. …" | setup.backups.vmKey, .vmKeyHint | | E | technical |
| A-119 | S:625 | backups by credits | status line | "…" / "Le Space Credits bezahlen gerade keine Sicherungen." / "Bezahlt bis {Datum}" or "Noch nicht bezahlt" · "{n} Datensätze" · "VM-Schlüssel freigegeben / noch nicht freigegeben" | setup.backups.notPaying, .paidUntil, .notPaid, .dataSets, .vmKeyState | from `creditsBalance().backup` | E | technical (paid-until date also for simple) |
| A-120 | S:626 | backups by credits | button | "Einen Monat Sicherungen bezahlen" | setup.backups.payMonth | `payBackups()`: checks network, `fundBackups(master, 1)`, authorizes key. Spends credits without a confirm dialog | E | technical |
| A-121 | S:627 | backups by credits | hint | "Nur ohne Paket nötig: In jedem Paket ist die Sicherung enthalten und verlängert sich mit ihm." | setup.backups.payHint | | E | technical |
| A-122 | S:628 | by credits, key not authorized | button | "VM-Schlüssel freigeben" | setup.backups.authorizeKey | `authorizeBackupKey()` → `backupAuthorize()` | E | technical |
| A-123 | S:632 | always in step | text input | label "Wallet, dem die Sicherungen gehören (0x…, leer = zahlendes Konto)"; placeholder "Wallet der Sicherungen (leer = 0x1234…)" | setup.backups.owner, .ownerPlaceholder | binds `ownerInput` | E | technical |
| A-124 | S:633 | same | button | "Wallet der Sicherungen speichern" | setup.backups.saveOwner | `saveOwner()` → `backupOwner`; error "Eine Adresse (0x…, 40 Zeichen)." (setup.backups.errors.badOwner) | E | technical |
| A-125 | S:635 | same | fold "Mehr dazu" | "Schlüssel der Sicherungen (age): die VM verschlüsselt jede Sicherung für ihn, eine Wiederherstellung braucht ihn." | setup.more, setup.backups.ageIntro | | E | technical |
| A-126 | S:636 | same | status text | "nicht hinterlegt" / "der Schlüssel des Tresors (die 24 Wörter genügen zur Wiederherstellung)" / "eingefügt (nicht aus dem Tresor: getrennt aufbewahren!)" | setup.backups.age.none/vault/pasted | | E | technical (the "24 Wörter genügen" fact is a good simple reassurance) |
| A-127 | S:637 | key set | text + address | "Empfänger: " `age1…` [Kopieren] | setup.backups.recipient | | E | technical |
| A-128 | S:638 | key is not the vault's | button | "Schlüssel des Tresors verwenden (empfohlen)" | setup.backups.useVault | `useVaultAge()`; confirm when replacing a pasted key: "Den eingefügten Schlüssel durch den des Tresors ersetzen? …" (setup.backups.errors.replaceAge) | E | technical |
| A-129 | S:639-643 | same | fold + textarea + button | "Einen vorhandenen Schlüssel einfügen"; placeholder "AGE-SECRET-KEY-1…"; button "Versiegelt hinterlegen" | setup.backups.paste, .seal | `saveAge()`; error "Kein gültiger age-Schlüssel (AGE-SECRET-KEY-1…)." (errors.badAge) | E | technical |
| A-130 | S:645-649 | same | checkbox | "Sichern, alle zwei Stunden bei Änderungen und beim Stoppen ({Mainnet/Testnetz}, Datensatz `<label>`)" | setup.backups.on.before(mainnet)/after | `toggleBackups(bool)`: sets/clears `backupConfig`; disabled on mainnet when role is not primary | E | both (simple: shown as a state "Sicherungen: an", not a switch) |
| A-131 | S:651 | backups on | component `BackupPlaces` (other slice) | (places where backups go) | backup.places.* | props `network, payer, config, busy`; event `onsave` → `savePlaces()` | E | technical |
| A-132 | S:653-656 | backups on and Paperless running | box (highlighted when pending) + button | "Paperless läuft: Geänderte Sicherungsorte gelten für die laufende VM erst, wenn du sie übergibst." / pending: "Orte geändert – jetzt an die laufende VM übergeben? Erst dann sichert sie dorthin." · button "An die laufende VM übergeben" | backup.places.pushHint, .pushPending, .push | `pushPlaces()` → `pushBackupPlaces()`; then `onsaved()` | E | technical |
| A-133 | S:661 | mainnet and not primary | hint | "Auf Mainnet sichert nur eine produktive Instanz (Rolle oben). Als Test bleibt sie ohne Sicherung." | setup.backups.mainnetHint | | E | technical |
| A-134 | S:662 | backups on, by credits, key not authorized or not paid | hint | "Dafür braucht es eine bezahlte Sicherung (in jedem Paket enthalten, sonst „Einen Monat Sicherungen bezahlen“) und den freigegebenen VM-Schlüssel." | setup.backups.creditsHint | | E | technical |
| A-135 | S:663 | backups on, by wallet, no session key | hint | "Dafür braucht die VM den Sitzungsschlüssel aus Schritt {n}." | setup.backups.sessionHint | | E | technical |
| A-136 | S:199-209 | on pay / authorize | error texts | "Le Space Credits sichern gerade im {Netz}; diese Instanz sichert im {Netz}." / "… Nichts abgebucht." / "Le Space Credits zahlen gerade im Netz …" (net names "Produktivnetz" / "Testnetz") | setup.backups.errors.otherNetwork, .payOtherNetwork, .fundNetwork, .netName | thrown, shown through feedback('bycredits') | E | technical |
| A-137 | S:535-536 | loaded | step fold | "{n}. Paperless-anywhere-Image und Knoten" | setup.image.title(n) | | E | technical |
| A-138 | S:538-541 | `BUILDER` fixed in the app | radio group | legend "Welches Image?" · "Mein eigenes, verschlüsseltes Image (empfohlen)" + "Seine Passphrase entsteht in deinem Tresor; Le Space kennt sie nicht. Damit gibt es Sicherungen, …" · "Öffentliches Image, zum Ausprobieren" + "Startet leer, ohne Sicherungen und ohne feste Adresse." | ownImage.choice.legend, .own, .ownHint, .public, .publicHint | sets `imageKind` (view state; saved only with "speichern" or a build); choosing public clears hash/passphrase fields | E | technical (simple always gets the own image) |
| A-139 | S:542 | BUILDER | fold "Mehr dazu" | "Warum: Eine Passphrase gilt für alle, die diese Image-Version nutzen, und der Inhalt der Platte wird beim Start nicht gemessen. …" | setup.more, ownImage.choice.publicWhy | | E | technical |
| A-140 | S:546 | BUILDER and public chosen | tip box | "Tipp: Mit einem eigenen Image kennt niemand außer dir die Passphrase – auch Le Space nicht. Bau in etwa 15 Minuten; …" | ownImage.tip | | E | technical |
| A-141 | S:547 | same | warning line | role primary: "Im Echtbetrieb ist das eigene Image Pflicht: Der nächste Start baut es zuerst." / else "Zum Ausprobieren: Paperless startet leer, ohne Sicherungen und ohne feste Adresse. Für deine Dokumente nimm dein eigenes Image." | ownImage.choice.primaryNeedsOwn, .publicLimits | | E | technical |
| A-142 | S:550 | public image | text input | label "Image (STORE-Hash, 64 Zeichen)"; placeholder "Image (STORE-Hash)" | setup.image.hash, .hashPlaceholder | binds `imageInput` | E | technical |
| A-143 | S:552 | always in step | text input | label "SEV-SNP-Knoten (Hash, 64 Zeichen)"; placeholder "SEV-SNP-Knoten (Hash)" | setup.image.node, .nodePlaceholder | binds `crnInput` | E | technical |
| A-144 | S:554 | public image | password input | label "Passphrase des Images"; placeholder "Passphrase hinterlegt, {n} Zeichen (leer lassen = behalten)" | setup.image.pass, .passKept(n) | binds `passInput` | E | technical |
| A-145 | S:556 | always in step | button | "Image und Knoten speichern" / (own image) "Knoten speichern" | setup.image.saveBoth, .saveNode | `saveImage()` → `imageFields()`; validation errors from `ownImage.fields.*` ("Der Knoten ist ein 64-stelliger Hash." etc.) | E | technical |
| A-146 | S:560 | own chosen, not built, builds at first start | hint | "Wird beim ersten Start gebaut (etwa 15 Minuten, das Fenster so lange offen lassen). Du kannst es auch jetzt schon bauen." | ownImage.choice.builtAtStart | | E | both (simple: said once before the first start) |
| A-147 | S:561 | own chosen, not built, not at first start | warning | "Noch nicht gebaut: Bau es hier mit „Mein Image bauen“. Bis dahin startet eine Test-Instanz vom öffentlichen Image." | ownImage.choice.notBuilt | | E | technical |
| A-148 | S:562 | own chosen | fold "Mehr dazu" | "Ein Image nur für diesen Tresor: Ein geprüfter Build-Dienst versiegelt das Ausgangs-Image (unverschlüsselt, für alle gleich) …" + app address [Kopieren] + "…), die auch den Speicher bezahlt. Mit einem Le-Space-Paket oder Gutschein …" | ownImage.intro.before/after | | E | technical |
| A-149 | S:563-572 | own chosen | fold + definition list | "Woraus und womit wird gebaut?" · "Diese Werte sind in der App festgelegt und für alle gleich. …" · rows "Ausgangs-Image, SHA-256", "Ausgangs-Image bei Aleph", "Gebaut aus dem Quelltext-Stand", "Build-Dienst bei Aleph", "Messwert des Build-Dienstes" (values as code, some linked) | ownImage.sourcesFold, .sourcesHint, .sources.* | rows from `sources(BUILDER, …)` | E | technical |
| A-150 | S:573 | own image built | success line | "Geschafft: Dein Image ist nur für deinen Tresor versiegelt (gebaut am {Datum})." | ownImage.have(date) | | E | both |
| A-151 | S:574 | old own images left | hint + link-button | "Ein altes eigenes Image ist noch nicht entfernt (es kostet Speicher)." / "{n} alte eigene Images sind …" · "Jetzt entfernen" | ownImage.oldPending(n), .oldRemove | `removeOldImages()` → `forgetQueued()`; throws the same text when some remain | E | technical |
| A-152 | S:575 | own chosen, price check running | hint | "Guthaben der App-Adresse wird geprüft …" | ownImage.choice.checking | | E | technical |
| A-153 | S:576 | package cannot pay (reason known) | error box + link + link-button | reason: "Ein Bau kostet {Preis} aus deinem Le-Space-Guthaben. Dein Guthaben reicht dafür nicht: Es fehlen {Betrag}. …" / "Der Preis für den Bau ließ sich beim Credits-Dienst gerade nicht abfragen. …" / raw message · link "Zum Guthaben" (only when short) · "Ich habe aufgeladen – neu prüfen" | ownImage.choice.packageShort, .creditsUnreachable, .toTopUp, .recheck | link to `#paket`; button `refreshBalances()` | E | both (money message) |
| A-154 | S:577 | app address cannot pay | error box + link-button | "Ein eigenes Image braucht derzeit Aleph-Guthaben auf der Adresse dieser App: Aleph startet den Build-Dienst nur, wenn …" · "Ich habe aufgeladen – neu prüfen" | ownImage.choice.needsCredits(need, have), .recheck | `refreshBalances()` | E | technical |
| A-155 | S:578 | affordable | hint | "Dieser Bau ist enthalten, bis einer gelingt (höchstens 3 Versuche); der Speicher des Images auch." / "Ein Bau kostet {Preis} aus deinem Le-Space-Guthaben (Laufzeit des Build-Dienstes); …" | ownImage.choice.included, .price(price) | | E | both |
| A-156 | S:578 | affordable | button | "Mein Image bauen" / "Mein Image neu bauen" | ownImage.build, .rebuild | `buildImage()` → `buildImageForVault({confirm, save, onProgress})`; disabled while Paperless runs. Confirm dialogs: "Eigenes Image bauen? {Preis} werden von deinem Le-Space-Guthaben abgebucht. …" / "Eigenes Image bauen? Dieser Bau ist enthalten, es wird nichts abgebucht." (ownImage.choice.confirmPrice / confirmIncluded) | E | technical (simple: happens at first start) |
| A-157 | S:579 | Paperless running | hint | "Erst möglich, wenn Paperless gestoppt ist. Der Umzug einer laufenden Paperless: „Sichern und beenden“, hier bauen, neu starten; …" | ownImage.whileRunning | | E | technical |
| A-158 | S:580 | build running | status line | "{Schritt} …" (e.g. "Build-Dienst starten (einige Minuten)", "Build-Dienst prüfen (AMD)", "Image wird versiegelt", "Versiegeltes Image holen (42 %)", "Speicher-Nachricht signieren", "Image zu Aleph hochladen (868 MiB)", "Auf Aleph warten") | ownImage.step.* | from `onProgress.detail`; plain text line, not the FirstStart overlay | E | technical |
| A-159 | S:581 | build failed | error box | one of `ownImage.error.*` (22 messages, e.g. "Der Bau hat zu lange gedauert.", "Das Hochladen zu Aleph ist dreimal abgebrochen (…). … Bitte die Seite nicht neu laden.") | ownImage.error.* | feedback('own-image') | E | both (needs plain wording + next step) |
| A-160 | S:586-587 | loaded | step fold | "{n}. Feste Adresse (optional)" | setup.address.title(n) | | E | technical |
| A-161 | S:588 | same | hint with code | "Mit einem Cloudflare-API-Token (Zone 2n6.me, Rechte: DNS bearbeiten, Zone lesen) bekommt deine Instanz bei jedem Start dieselbe Adresse, `<label>.<domain>`: Die VM trägt sich selbst ein … neuen `*.2n6.me`-Namen. Das Token kann alle DNS-Einträge der Zone ändern; …" | setup.address.hint.before(zone)/between/after | shows the derived fixed host name (`fixedHostLabel(master)`) | E | technical |
| A-162 | S:589 | same | password input | label "Cloudflare-API-Token"; placeholder "Token hinterlegt (leer speichern = entfernen)" | setup.address.token, .tokenKept | binds `dnsInput` | E | technical |
| A-163 | S:590 | same | button | "Token speichern" / "Token entfernen" (token kept and field empty) | setup.address.save, .remove | `saveDns()`; error "Ein Cloudflare-API-Token (etwa 40 Zeichen)." (setup.address.badToken) | E | technical |
| A-164 | S:595-599 | Le Space pays (customer mode) | fold | "Für Entwickler: Netz ({Test (Calibration) / Produktiv (Mainnet)}), Rolle, Relay, Sicherungs-Details" | setup.devFold(network) | holds A-086..A-089 and A-111..A-136; `bind:open={devOpen}` | E | technical (this fold is the existing seam between the two audiences) |
| A-165 | S:602 | load error (no action key) | error line | raw message | - | from `loadProfile` failure | E | both |
| A-166 | A:20 | every `Addr` | code + link-button | shortened value (22 ch, full value in title) + "Kopieren" → "Kopiert ✓" | setup.copy, setup.copied | clipboard copy | E | technical |

### 2.8 FirstStart overlay (F), mounted from Lifecycle, both tabs

| ID | file:line | State | Type | German text | i18n key | What it does | Shown under | Audience |
|---|---|---|---|---|---|---|---|---|
| A-167 | F:108-114 | minimized and running | slim status bar | pulsing dot · "{Dein Build-Dienst wacht auf / Echtheit wird bestätigt / Dein Image wird versiegelt / Dein Image kommt zu dir / Dein Image wird abgelegt / Deine Paperless erwacht}" · progress bar · "{pct} % · noch ca. {n} Min." | first.stations.*.mini, first.left | status only | both | both |
| A-168 | F:113 | minimized | button | "Ansehen" | first.expand | `onexpand()` | both | both |
| A-169 | F:116 | not minimized | full-screen dialog (dark, role=dialog aria-modal) | - | - | covers the whole app | both | both |
| A-170 | F:138-139 | journey | kicker + heading | "Dein erster Start · ca. 25 Minuten insgesamt" + "Dein eigenes Image entsteht" / rebuild: "Dein eigenes Image · ca. 15 Minuten" + "Dein neues Image entsteht" | first.kicker, .title, .rebuildKicker, .rebuildTitle | | both | both |
| A-171 | F:141 | running | button | "Verkleinern" | first.minimize | `onminimize()` | both | both |
| A-172 | F:142 | failed | button | "Schließen" | first.close | `onclose()` | both | both |
| A-173 | F:144-156 | journey | stepper (6 stations, 5 on rebuild): number or check mark, label, typical duration | "Build-Dienst · ca. 4 Min." / "Echtheit · wenige Sekunden" / "Siegel · ca. 2 Min." / "Abholen · ca. 9 Min." / "Abgelegt · ca. 1 Min." / "Paperless · ca. 10 Min." | first.stations.*.label / .duration | active station pulses, done ones show a check | both | both (labels to simplify: "Build-Dienst", "Siegel") |
| A-174 | F:157 | journey | row of LEDs (decorative, aria-hidden) | - | - | on = done, blink = active | both | both |
| A-175 | F:161 | journey | step line | "Schritt {n} von {m} · {Dauer}" | first.step(n, of) | | both | both |
| A-176 | F:163-164 | failed | heading + text | "Kurz innegehalten" · "Dein Start ist an dieser Stelle stehen geblieben. Den Grund siehst du in der Karte; ein neuer Versuch geht jederzeit." | first.pausedTitle, .pausedText | no retry button here | both | both |
| A-177 | F:166-167 | running | heading + text per station | e.g. "Dein persönlicher Build-Dienst wacht auf" · "Eine vertrauliche Maschine startet nur für dich. Das dauert ein paar Minuten – genau richtig für einen Kaffee." (6 pairs) | first.stations.*.title / .text | | both | both (the warm tone suits simple) |
| A-178 | F:168-172 | running | sub-step list with LEDs (done / active / next) | 19 lines, e.g. "Build-Dienst angefordert (V-PROGRAM, von deiner App signiert)", "Bericht des AMD-Prozessors empfangen, Zertifikatskette von AMD geprüft", "Mit LUKS versiegelt – …", "Speicher-Nachricht (STORE) von deiner App signiert", "Port 443 und Adresse eingerichtet", "Paperless-ngx startet und spielt deine Sicherung ein" | first.sub.* | from `substeps()` | both | technical |
| A-179 | F:170 | fetch / store | inline facts | "{n} Verbindungen bestätigt" · "{x} von {y} MiB" · "{r} MiB/s" · "Versuch {n} von {m}" · upload host name | first.attestedCount, .mib, .rate, .attempt | | both | technical |
| A-180 | F:173 | store, retry | note | "Die Verbindung ist abgerissen – kein Problem: Dein Image ist schon da, nur das Hochladen läuft noch einmal." | first.retryNote | | both | both |
| A-181 | F:174-177 | fetch | progress bar + text | "{pct} % abgeholt" | first.fetched | | both | both |
| A-182 | F:181-200 | running | animated diagram (SVG) with caption | "Was gerade wohin fließt: {Auftrag für den Build-Dienst / Bericht des Prozessors / Passphrase, verschlüsselt / Stücke deines versiegelten Images / Dein versiegeltes Image / Auftrag für deine VM / Bericht des Prozessors deiner VM / Deine Sicherung}" · nodes "Dein Browser", "Relay", "Vertraulicher Knoten", "Aleph-Speicher", "Filecoin" | first.flowTitle, first.flow.*, first.nodes.* | from `flowNow()`; moving packets along the active path | both | technical (a simpler picture could serve simple) |
| A-183 | F:203-213 | journey | side list "evidence" | "Belege – zum Nachprüfen": up to 11 rows, e.g. "Quelltext-Stand", "Ausgangs-Image (SHA-256)", "Erwarteter Messwert (in der App)", "Build-Dienst (V-PROGRAM)", "Knoten", "Relay", "Gemessen vom AMD-Prozessor · stimmt", "Inhaltsadresse deines Images", "Dein Image bei Aleph (STORE)", "Deine VM (INSTANCE)", "Messwert deiner VM (AMD)"; value shortened, some linked | first.evidenceTitle, first.evidence.*, first.matches | from `evidence()`; links to Aleph message explorer / GitHub commit | both | technical |
| A-184 | F:214-217 | journey | link list | "Die Hardware dahinter": "AMD SEV-SNP: vertrauliche VMs", "AMD-EPYC-Prozessoren" | first.hardwareTitle, first.hardware.* | external links to amd.com | both | technical |
| A-185 | F:220-224 | journey | total progress | "{pct} % geschafft" · "noch ca. {n} Min. · fertig gegen {hh:mm}" · bar · "Dein Bildschirm bleibt an. Lass dieses Fenster einfach offen – du kannst es verkleinern und nebenher weitermachen." | first.share, .left, .endsAt, .keepOpen | from `journey()` | both | both |
| A-186 | F:120-127 | done | finale: animated check, heading, text | "Geschafft – deine Paperless läuft!" · "Versiegelt mit deiner ganz eigenen Passphrase. Die kennt nur dein Tresor – … Ab jetzt startest du in rund 10 Minuten." / rebuild: "Geschafft – dein neues Image ist fertig!" · "Versiegelt mit deiner eigenen Passphrase, …" | first.doneTitle, .doneText, .rebuildDoneTitle, .rebuildDoneText | | both | both |
| A-187 | F:129 | done, host known, not rebuild | CTA link | "Paperless öffnen" | first.open | opens `https://{host}` in new tab | both | both |
| A-188 | F:130 | done, own image known | button | "Deine Urkunde ansehen" | first.showCertificate | `oncertificate(true)` → `ImageCertificate` (texts `first.cert.*`: "Urkunde · Paperless anywhere", "Als PDF speichern", "Zurück" …) | both | both (keepsake for simple, proof for technical) |
| A-189 | F:131 | done | link-button | "Schließen" | first.close | `onclose()` | both | both |
| A-190 | F:88-94 | running | browser leave question (`beforeunload`) | "Dein Image entsteht gerade. Wenn du die Seite jetzt verlässt, bricht der Bau ab." | first.leave | browser's own dialog | both | both |
| A-191 | F:98-101 | running | tab title | "{pct} % · Dein Image entsteht" | first.tab | restored afterwards | both | both |
| A-192 | F:67-84 | running | Wake Lock (no visible element) | - | - | keeps the screen on, re-acquired on return | both | both |
| A-193 | (i18n only) | used by Lifecycle | messages | "Ein Image lässt sich bauen, wenn Paperless gestoppt ist." · "Gerade läuft schon etwas in der Paperless-Karte. …" · "Die Paperless-Karte ist gerade nicht bereit. Bitte die Seite neu laden." · "Hardware-Prüfung bestanden" | first.whileRunning, .busy, .noCard, .measured | not rendered by F itself | - | both |

### 2.9 Help (H), at the foot of the app, all states

| ID | file:line | State | Type | German text | i18n key | What it does | Shown under | Audience |
|---|---|---|---|---|---|---|---|---|
| A-194 | H:40-41 | always | fold (id `hilfe` / `help`) | "Hilfe & Support" | help.title | closed in the app; opens on hash `#hilfe` / `#help` (footer link) | all | both; simple needs it prominent, not at the page foot |
| A-195 | H:42 | open | text + mail link | "Fragen, ein Problem, etwas klemmt? Schreib uns:" paperless@le-space.de | help.lead, help.mail, help.mailSubject | `mailto:` with subject "Paperless anywhere: Hilfe" | all | both |
| A-196 | H:43 | open | hint + mail link | "Zu Zahlung, Rechnung, Gutschein und Credits:" support@le-space.de | help.payment, help.paymentMail | mailto | all | both |
| A-197 | H:44 | open | hint + mail link | "Rechtliches (Widerruf, Kündigung, Anbieter), wie im Impressum:" contact@le-space.de | help.legal, help.legalMail | mailto | all | both |
| A-198 | H:46-49 | open | note box | "**Le Space fragt nie nach deinen Geheimnissen**" · "Nicht nach den 24 Wörtern deines Tresors oder der Seed-Phrase deiner Wallet, nicht nach einer Passphrase, …" | help.neverTitle, help.never | | all | both; very important for simple |
| A-199 | H:51-52 | open | heading + text | "Was du mitschickst" · "Beschreib kurz, was du getan hast und was passiert ist. Dazu die Diagnose der App: …" | help.sendTitle, help.send (landing: help.sendLanding) | | all | both |
| A-200 | H:55 | open, in app | button | "Diagnose kopieren" | help.diagnosis.copy | `copy()`: calls `diagnosis()` (P:48, `diagnosisText`) and writes it to the clipboard | all | both |
| A-201 | H:56 | after click | status | "Kopiert. Füg sie in deine Mail ein." / "Kopieren ging nicht. Markier den Text unten und kopier ihn selbst." | help.diagnosis.copied, .failed | failure opens the fold below | all | both |
| A-202 | H:58-62 | open, in app | fold + hint + pre | "Was die Diagnose enthält" · "Bei gesperrtem Tresor enthält sie nur Version und Browser; entsperrt kommen der Zustand der VM …" · the diagnosis text (English keys: app, ipfs, page, time, language, browser, vault, phase, image, network, pays, payer, vm, node, host, relay, error at/action/step, error) | help.diagnosis.show, .locked | loads the text on first open | all | both (content itself is technical and English) |
| A-203 | H:65-69 | open | heading + 2 links | "Selbst nachlesen" · "Häufige Fragen" · "Eine Sicherung selbst holen und entschlüsseln" | help.readTitle, help.faq, help.restore | FAQ on landing (`/#faq`, leaves the app and locks it without the A-003 question), restore guide on GitHub | all | FAQ: both; restore guide: technical |
| A-204 | H:71-77 | open | heading + text + 3 links | "Sicherheitslücken melden" · "Bitte nur privat melden, nicht als Issue, Kommentar oder Beitrag: …" · security@le-space.de · "Private Meldung bei GitHub" · "SECURITY.md" | help.securityTitle, .security, .securityMail, .securityGithub, .securityPolicy | mailto / GitHub links | all | technical |

### 2.10 Footer BuildInfo (B), all states

| ID | file:line | State | Type | German text | i18n key | What it does | Shown under | Audience |
|---|---|---|---|---|---|---|---|---|
| A-205 | B:23 | always | link with GitHub mark | "Quelltext von Paperless anywhere auf GitHub" | app.footer.source | repo link (same tab) | all | technical |
| A-206 | B:24-25 | always | nav "Rechtliches" + link | "Über Paperless anywhere" | app.footer.legal, .about | landing page (locks the app, no question) | all | both |
| A-207 | B:26 | always | link | "Impressum" | app.footer.imprint | https://le-space.de/#impressum | all | both (legally required) |
| A-208 | B:27 | always | link | "Datenschutz" | app.footer.privacy | https://credits.le-space.de/datenschutz | all | both (required) |
| A-209 | B:28 | always | link | "Lizenzen" | app.footer.licences | `/lizenzen/` | all | both (required by licences) |
| A-210 | B:29 | always | anchor link | "Hilfe & Support" | help.title | `#hilfe` / `#help`, opens the Help fold | all | both |
| A-211 | B:32 | CREDITS_URL | mail link with tooltip | "Verträge hier kündigen"; title "Auch ohne geöffneten Tresor: per E-Mail an Le Space. Mit geöffnetem Tresor geht es direkt bei „Dein Paket“." | app.footer.cancel, .cancelHint | `cancelMailto()`: prefilled mail to contact@le-space.de, subject "Kündigung Paperless anywhere" (legal-texts.js:55). German in both languages on purpose (§ 312k BGB) | all | both (legally required, must stay reachable when locked) |
| A-212 | B:34-36 | always | build line | "{version} · {Datum, Uhrzeit} · `{commit}`" (title "Commit") | app.footer.commit | from `__BUILD__` | all | technical |
| A-213 | B:37 | served from IPFS | line | "IPFS: `{cid}`" (title "IPFS-CID dieser Version") | app.footer.cid | HEAD request to own URL, header `x-ipfs-roots` | all | technical |

### 2.11 Terms (T) and Waiver (W), inside the Package card (both tabs)

| ID | file:line | State | Type | German text | i18n key | What it does | Shown under | Audience |
|---|---|---|---|---|---|---|---|---|
| A-214 | T:39-40 | terms due or announced, published version loaded | region "Bedingungen" + title | "Neue Bedingungen (AGB): bitte zustimmen" / "Neue Bedingungen (AGB) ab {Datum}" | buy.terms.label, .due, .announced(day) | `due` adds emphasis | both | both (legal) |
| A-215 | T:41 | language not German | hint | (en) "The terms are in German, and so are the two sentences below about them; …" (de key: "Die Bedingungen liegen auf Deutsch vor.") | buy.terms.germanNote | | both | both |
| A-216 | T:42 | same as A-214 | hint (always German) | legal sentence for "due" / "announced" (text in `TERMS_LEGAL`, imported by `i18n/purchase.js`; not resolved here) | buy.terms.legal.dueHint / .announcedHint | | both | both |
| A-217 | T:43 | version has changes | bullet list (German) | change notes sent by the service | (from service) | | both | both |
| A-218 | T:44 | version has a URL | link | "Fassung {version} vom {Datum} lesen und herunterladen" | buy.terms.read | opens the terms in a new tab | both | both |
| A-219 | T:45 | same | checkbox (German text) | consent sentence for the version (`TERMS_LEGAL.consent(version)`) | buy.terms.legal.consent | binds `read` | both | both |
| A-220 | T:46 | same | button | "Zustimmen" | buy.terms.agree | `agree()` → `acceptTerms(master, version)` → `onaccepted()`; disabled until ticked | both | both |
| A-221 | T:47 | failure | warning (role=alert) | raw error | - | | both | both |
| A-222 | T:50 | terms already accepted, nothing due | small print + link | "Bedingungen: Fassung {version}, zugestimmt am {Datum} · lesen" | buy.terms.accepted, .readLink | link to the accepted version | both | both |
| A-223 | W:14-17 | service sends a withdrawal declaration | checkbox with long text | the service's own declaration on withdrawal (§ 356 BGB), verbatim, German or English | (from service; `withdrawalText`) | `bind:checked` to the parent (plan purchase, top-up, backup add/year); starts unticked | both | both (legal; must stay verbatim) |

### 2.12 Licences page (L), `/lizenzen/`, standalone

| ID | file:line | State | Type | German text | i18n key (landing catalogue) | What it does | Shown under | Audience |
|---|---|---|---|---|---|---|---|---|
| A-224 | L:59 | always | logo link | "LE SPACE Paperless anywhere", aria "Zur Startseite" | licences.back | to `/` or `/en/` | own page | both |
| A-225 | L:60-64 | always | language buttons | "DE" / "EN" (group label "Language", not translated) | - | local `setLang`, writes `paperless-lang` | own page | both |
| A-226 | L:68-69 | always | h1 + lead | "Lizenzen" · "Paperless anywhere ist ein Angebot von Le Space. Es setzt freie Software ein; hier steht, welche, …" | licences.h1, .lead | | own page | both |
| A-227 | L:71-93 | always | section + definition list | "Paperless-ngx" · "In der VM läuft Paperless-ngx, ein unabhängiges Open-Source-Projekt unter der GNU General Public License, …" · rows "Version", "Quellcode dieser Version", "Lizenz" (GPL-3.0 → #gpl), "Offizielles Image", "Unsere Kopie", "Eigene Änderungen" ("Keine am Inhalt. Le Space kopiert das offizielle Image unverändert …") + links "So wird kopiert", "So wird es gestartet" | licences.ngx.* | values from `__STACK__` (build time) | own page | technical (legal duty) |
| A-228 | L:96-112 | always | section + table | "Weitere Software in der VM" · "Ebenfalls unverändert eingesetzt; …" · columns "Software", "Version", "Lizenz", "Quellcode" | licences.vm.* | rows from `__STACK__.images` / `.tools` | own page | technical |
| A-229 | L:114-118 | always | section + 2 links | "Diese Web-App" · "Der Code von Paperless anywhere (Web-App und VM-Image) steht unter der GNU Affero General Public License, …" → "Quellcode und Lizenz" · "Die Web-App enthält Bibliotheken und Schriften anderer; …" → "Lizenzen der Bibliotheken und Schriften" | licences.app.* | LICENSE on GitHub; `/third-party-licences.txt` | own page | technical |
| A-230 | L:120-126 | always | section + fold + pre | "Text der GPL-3.0" · "Lizenztext anzeigen (Englisch, wie veröffentlicht)" | licences.gpl.* | full GPL text | own page | technical |
| A-231 | L:129-134 | always | footer links + build line | "Zur Startseite" · "Impressum" · "Datenschutz" · BuildLine ("Stand dieser Seite: …") | licences.back, footer.imprint, footer.privacy, footer.build.* | no link back to `/app/` | own page | both |

---

## 3. Lists

### 3.1 Duplicates and overlaps

1. **Two "Auf einen Blick" blocks** in Erweitert: page-level glance (A-045..A-050) and Setup overview (A-077..A-084). Overlapping rows: Zahlweg / Zahlung, Sicherungen / Sicherungen, Adresse / Feste Adresse. Different wording for the same value ("Le Space, aus dem Paket" vs "Le Space, aus deinem Paket"; "Meine Wallet" vs "deine Wallet").
2. **"Einrichtung" twice**: fold summary A-063 and the h2 inside it A-070; completeness shown as chip (A-063), as ✓/• rows (A-078..) and again by the open/closed state of each step.
3. **The app's address shown four times**: Technisch → Schlüssel (A-055, without copy button), Setup pays "Adresse der App" (A-098), Setup Aleph "App-Schlüssel" (A-103), own-image "Mehr dazu" (A-148). Three different names for the same thing: "Schlüssel dieser App für Aleph", "Adresse der App", "App-Schlüssel".
4. **The same explanatory sentence three times** ("Den Schlüssel dazu leitet dein Browser aus deinem Passkey (oder den 24 Wörtern) ab; Le Space hat ihn nicht …"): app.tech.keyHint (A-056), setup.pays.self.app (A-096), setup.pays.appMoney (A-098).
5. **Source link twice**: header mark (A-004) and footer (A-205); plus the Paperless-ngx link in the tagline (A-002).
6. **Unlock UI twice** with different words: state new ("Öffnen", A-020..A-024) and state locked ("Entsperren", A-027..A-031). "Passkey anlegen" exists as create-vault (A-016) and as add-passkey (A-059).
7. **Period end shown three times**: banner (A-043), glance chip "endet …" (A-046), and the Package card itself (other slice).
8. **Cancel**: footer mail link (A-211) and in-place cancel in the Package card; contact@le-space.de also in Help (A-197).
9. **CID lookup done twice** (same HEAD request): `diagnose()` in P:49 and BuildInfo B:16.
10. **Language switch three implementations**: app (i18n/index.js store), licences page (L:25, own state + landing catalogue), landing page; all share `localStorage['paperless-lang']`.
11. **Help in two places**: app footer (closed, with diagnosis) and landing page (open, without).
12. **Own-image success said three ways**: Setup "Geschafft: Dein Image ist nur für deinen Tresor versiegelt" (A-150), FirstStart finale (A-186), overview row "eigenes, gebaut am" (A-083). Build progress exists as plain step line in Setup (A-158) and as the full FirstStart overlay (A-173..) for the same build.
13. **Backup payment state** in Setup overview ("an, bezahlt bis", A-082) and in the step (A-119); relays found in overview (A-081) and in the step (A-113); network in the developer-fold summary (A-164) and in the select (A-086).
14. **Money warnings**: Übersicht warning lines (A-065/A-066) repeat what Balances / Package show in Erweitert; they only say "Details unter Erweitert" without a link.
15. **"Mehr dazu" folds** (setup.more) appear five times in Setup with different content; fold-in-fold-in-fold nesting reaches four levels (Technisch → Einrichtung → step → Mehr dazu).

### 3.2 Jargon a lay person sees in the default view (before unlock and tab Übersicht)

- Create / unlock screens: **Passkey**, **Tresor**, **Wiederherstellungsphrase**, **24 Wörter**, **Paperless-ngx**, "verschlüsselte Maschine", host name in "Gibt es für {host} noch keinen".
- Header: "**vertrauliche VMs**" (tagline), GitHub mark, "DE/EN" without the word "Sprache" visible.
- Gateway stop: "**IPFS-Gateway**", "Speicher und ihre Passkeys".
- Leave question: "**VM**".
- Tabs: "**Erweitert**"; warning lines point to "Erweitert" by name; "Guthaben".
- Help: "Diagnose", "**Zustand der VM**", "**Seed-Phrase** deiner Wallet", "**Wallet**", "**Passphrase**", "Wiederherstellungscode", "**DNS-Token**", "**Credits**", "Issue", "SECURITY.md", "GitHub"; the diagnosis text itself is English key/value lines.
- Footer: "**Commit**" hash, "**IPFS**: bafy…", version string, "Quelltext … auf GitHub".
- Raw error messages (A-067) come straight from the logic modules.
- FirstStart overlay (appears in Übersicht during the first start): **Build-Dienst**, **Image**, **V-PROGRAM**, **Knoten**, **Relay**, **AMD SEV-SNP**, **EPYC**, **LUKS**, **SHA-256**, **STORE**, **INSTANCE**, **Messwert**, **Zertifikatskette**, **MiB / MiB/s**, **Port 443**, **Inhaltsadresse**, "Vertraulicher Knoten", "Aleph-Speicher", "Filecoin", long hex values.
- Backup lights in the header (other slice, but in this shell): "Anbieter {id}", "Betreiber", "Domain", pointers to "Erweitert → Einrichtung → Wohin die Sicherungen gehen".

### 3.3 Dead ends and unclear next steps

1. **The 24 words can be lost before they are written down.** While the phrase is shown, "Sperren" (A-006), the logo link (no question, since `acting` is false) and a reload all discard `shownPhrase`. The text says "Sie wird nur jetzt angezeigt", and there is no control anywhere in this slice to show the words again later. The person is left with a passkey-only vault and no warning.
2. **Confirming the words gives no feedback**: "Stimmt" simply stays disabled until all three match; no hint which word is wrong (A-040).
3. **Passkey prompt that never answers**: only a hint line (A-021/A-028), no cancel, button stays disabled; the 24-word path is inside a closed fold.
4. **New device, existing vault**: the person lands on "Neu hier? Tresor anlegen" first; the working path (24 words) is a fold in the second card (A-022) with an unlabelled textarea.
5. **Framed / shared origin**: only a link; framed opens a new tab, shared replaces the page. No explanation of what to do if the link target looks the same.
6. **"Diesen Browser vergessen"** (A-032) is offered on the locked screen with a single confirm; a person without the 24 words locks themselves out of this browser's passkey record.
7. **Übersicht warnings without action**: A-065/A-066 say "Details unter „Erweitert“" as plain text; no link, no button.
8. **Glance anchors land imprecisely**: "Adresse" and "Zahlweg" jump to `#technisch` but do not open "Einrichtung" or the step.
9. **"Technisch" in Übersicht is unreachable**: add-passkey for a second device (A-057..A-060) exists only under Erweitert → Technisch → Schlüssel und Passkeys → fold.
10. **Setup load failure**: "Lade Einstellungen …" stays, the error shows below, no retry button (A-076, A-165).
11. **Wallet waiting** (A-075): banner only; all wallet buttons disabled until MetaMask answers.
12. **Backups checkbox disabled without a visible reason next to it** (mainnet + role test); the reason is a hint at the end of the step (A-133).
13. **Role "Produktiv" on the test network**: only a warning sentence (A-089), nothing blocks or offers to switch the network.
14. **"Token entfernen"** works only by saving an empty field (label changes, A-163); "Passphrase … leer lassen = behalten" has the opposite meaning for an empty field (A-144).
15. **Own image not affordable** (A-154): explains Aleph credits, offers only "neu prüfen"; no link to where to top up when the app address pays.
16. **"Einen Monat Sicherungen bezahlen"** (A-120) spends credits with no confirm dialog and no price shown.
17. **FirstStart failed** (A-176): "Den Grund siehst du in der Karte" and a Close button only; no retry and no error text in the overlay. A minimized bar disappears when not running, so a failure while minimized pops the overlay open again.
18. **Help → "Häufige Fragen"** and footer "Über Paperless anywhere" leave `/app/` and thereby lock the vault, without the question the logo link asks (A-003 only guards the logo).
19. **Terms box shows nothing** when terms are due but `creditsTerms()` fails (T:17 swallows the error): no message why buying is blocked.
20. **Licences page** has no link back to the app, only to the landing page.

### 3.4 Persistence from the UI layer

No `sessionStorage` and no IndexedDB are used anywhere in `pwa/src`. `localStorage` keys:

| Key | Written by | Content |
|---|---|---|
| `paperless-anywhere.vault` | `keys/vault.js` (`storeVault`, `forgetVault`; triggered by create / unlock / add passkey / "Diesen Browser vergessen") | The vault record (`v: 1`): the master secret sealed twice (passkey box, seed-phrase box); nothing that opens without passkey or phrase |
| `paperless-anywhere.tab` | P:194-209 | `'simple'` or `'advanced'`; only after a tab was clicked |
| `paperless-lang` | `i18n/index.js:50`, L:28, `landing/Landing.svelte:52` | `'de'` or `'en'` |
| `paperless-anywhere.backup-copies` | `backup-status.js` via P:108 (`rememberCopies`), cleared by `forgetCopies` on "vergessen" | `{ network, providerIds[], at }` of the newest backup's copies, for the header lights while locked |
| `paperless-credit-unit` | `Balances.svelte:49-60` (other slice) | chosen unit for credit display |

Memory only (lost on reload / lock): the master secret, `shownPhrase`, the typed phrase, `name`, `understood`, `setupOpen`, Setup's `opened` map (which steps are open), `devOpen`, `imageKind` until saved, the diagnosis notes (`diagnosis.js` `kept.state`, `kept.error`), the FirstStart `view`.

Remote (not browser storage): everything Setup saves goes through `updateProfile(master, …)` into the encrypted profile on Aleph. Fields written from this slice: `payer`, `network`, `appPays`, `leSpacePays`, `backupsByCredits`, `role`, `backupSigner`, `attestRelay`, `ageIdentity`, `backupConfig`, `backupOwner`, `rootfsItemHash` / `crnHash` / `luksPassphrase` (via `imageFields`), `ownImage` and friends (via `buildImageForVault`), `ownBuilder`, `oldOwnImages`, `dnsToken`. Read but not written here: `running`, `vmOwner`.

Other browser side effects: `document.documentElement.lang`, `document.title` (FirstStart), Screen Wake Lock, `beforeunload` handler, clipboard writes (Addr, Help), `visibilitychange` / `focus` listeners that call `refreshBalancesSoon()` (P:5-15), a one-minute clock for the period-end warning.

### 3.5 Component interfaces (props / events / logic modules)

**`routes/app/+page.svelte`** (no props). Logic used:
- `keys/vault.js`: `loadVault()`, `createVault(name) → { master, phrase }`, `unlockWithPasskey(vault) → master`, `unlockWithSeedPhrase(vault, phrase) → master`, `addPasskey(master, name)`, `forgetVault()`, `confirmationPositions()`.
- `keys/derive.js`: `alephPrivateKey(master)`; `viem` `privateKeyToAccount` for the address.
- `shared-origin.js`: `HOME`, `sharedOrigin()`, `framed()`.
- `backup-status.js`: `knownCopies()`, `rememberCopies(network, ids)`, `forgetCopies()`.
- `period-end.js`: `endWarning(endsAt, now) → null | 'soon' | 'urgent' | 'ended'` (72 h / 24 h thresholds).
- `diagnosis.js`: `diagnosisText({ build, cid, unlocked, lang })`, `noteError({ action, message })`.
- `balance-refresh.js`: `refreshBalancesSoon()`. `credits.js`: `CREDITS_URL` (feature switch for Package and wording).
- `i18n/index.js`: `LANGS, format, lang, setLang, t, tr`; `landing/i18n.js`: `texts[lang].tagline`.
- Shared state the page holds and passes down: `master`, `profileVersion` (bumped by any child's change event; children reload the profile on change), `tab`/`simple`, `setupOpen`, `missing`, `life`, `pkg`, `summary`, `balancesShown`, `acting`, `ledCopies`, `ledRemembered`, `reachLed`.

Child mounts and their contracts:

| Component | Props in | Events out |
|---|---|---|
| `Logo` | `size=36`, `name='Paperless anywhere'`, `sub` (snippet), `href`, `label`, `onnavigate(event)` | - |
| `NgxText` | `text`, `link=false`; module export `NGX_URL` | - |
| `GitHubMark` | `size=16` | - |
| `BackupLeds` | `copies`, `remembered` | `onreach(level)` |
| `Lifecycle` | `master`, `simple`, `version`, `reach` | `onchange()`, `onadvanced()`, `onmissing(string[])`, `onglance({ phase, backupsOn, lastGood: { at, copies }, host, fixedHost, pays })`, `onbusy(bool)`, `oncopies({ network, copies[] })` |
| `Package` | `master`, `version` | `onglance({ plan, hoursLeft, pays, low, endsAt })`, `onprofile()` |
| `Balances` | `master`, `version` | `onsummary({ money, lasts, warnings: ('start' | 'backups')[] })`, `onshown(bool)` |
| `VmList` | `master`, `version` | `onchange()` |
| `Setup` | `master`, `version=0` | `onsaved()` |
| `Help` | `t` (help texts), `lang`, `faq` (URL), `diagnosis?: () => Promise<string>`, `open` (bindable, default false) | - |
| `BuildInfo` | none (reads `__BUILD__`, `CREDITS_URL`, `cancelMailto()`) | - |

**`Setup.svelte`**: props `{ master, version, onsaved }`. Logic modules: `profile.js` (`loadProfile`, `updateProfile`), `permissions.js` (`connectPayer`, `readAuthorizations`, `isAuthorized`, `setAlephAuthorization`, `sessionKeyAddress`, `sessionKeyExpiry`, `setFilecoinSessionKey`), `credits.js` (`CREDITS_URL`, `creditsBalance`, `creditsCatalog`, `fundBackups`, `backupAuthorize`, `backupKeyAddress`, `imageBuild`, `imageBuildDone`, `CreditsShortError`), `keys/age.js` (`ageIdentityFromMaster`, `ageRecipient`), `backups.js` (`BACKUP_LABEL`, `backupConfigFor`), `relays.js` (`findAttestRelays`), `attest-p2p.js` (`relayList`), `lifecycle.js` (`buildsImageFirst`, `pushBackupPlaces`), `own-image.js` (`BUILDER`, `buildAffordable`, `settleLeftBuild`, `hasOwnImage`, `imageFields`, `imageKindOf`, `sources`), `own-image-build.js` (`buildImageForVault({ master, profile, packagePays, confirm, save, onProgress })`, `forgetOldImage`), `old-image.js` (`forgetQueued`), `balance-refresh.js` (`balancesRound`, `refreshBalances`), `keys/derive.js` (`fixedHostLabel`), `vm.js` (`FIXED_HOST_DOMAIN`). Child components: `Addr { value, testid }`, `BackupPlaces { network, payer, config, busy, onsave(places) }`. Uses native `confirm()` three times (role, replace age key, build price via callback).

**`FirstStart.svelte`**: props `{ view: { station, since, fetchPct, done, failed, minimized, certificate, rebuild?, facts? }, startTypical, host, ownImage, imageHash, plain, onminimize(), onexpand(), oncertificate(show), onclose() }`. Purely presentational; all state lives in Lifecycle's `ceremony`. Logic: `first-start.js` (`STATIONS`, `journey()`, `substeps()`, `flowNow()`, `fetchRate()`, `evidence()`, `HARDWARE`; also `stationOfBuildStep`, `fetchPercent`, `START_STEPS` used by Lifecycle), `own-image.js` (`ALEPH_MESSAGE`, `BUILDER`, `REPOSITORY`, `UPLOAD_HOSTS`). Child: `ImageCertificate { ownImage, imageHash, plain, onDark, onback }`.

**`Terms.svelte`**: props `{ master, terms: termsOf(...) | null, onaccepted() }`; logic `credits.js` `creditsTerms()`, `acceptTerms(master, version)`.

**`Waiver.svelte`**: props `{ withdrawal: { version, de, en } | null, checked (bindable), testid='waiver' }`; logic `credits.js` `withdrawalText(w, lang)`; the parent turns the tick into `waiverOf(withdrawal, ticked)`.

**`routes/lizenzen/+page.svelte`**: no props; build-time globals `__STACK__` (images, tools) and `__BUILD__`; landing catalogue `texts[lang].licences`; `Logo`, `landing/BuildLine { lang, t }`; raw GPL text import.

**`routes/+layout.svelte`**: `children` only; imports fonts and `theme.css` (design tokens `--surface`, `--line`, `--text`, `--text-2`, `--warn`, `--ok`, `--danger`, `--cta-bg`, `--radius`, `--gutter`, `--mono` used by every component in this slice).

**Test hooks worth keeping** (`data-testid`): `state`, `framed`, `shared-origin`, `key-loss`, `key-loss-ok`, `create-vault`, `open-with-phrase`, `open-phrase`, `passkey-waiting`, `phrase`, `confirm-{n}`, `tab-simple`, `tab-advanced`, `period-ending`, `glance`, `glance-{key}`, `tech`, `tech-keys`, `address`, `add-passkey`, `passkey-added`, `tech-balances`, `tech-vms`, `tech-setup`, `simple-balance`, `simple-warning-{start|backups}`, `lock`, `app-lang-{de|en}`, `header-source`, `logo-home`, all `setup-*`, `step-*`, `overview-*`, `first-*`, `station-*`, `help-*`, `build-info`, `footer-*`, `cancel-by-mail`, `terms*`, `waiver*`.
