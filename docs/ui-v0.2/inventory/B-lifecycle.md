# B — Lifecycle slice: inventory of the current UI

Scope: `pwa/src/lib/Lifecycle.svelte` (L), `StartPanel.svelte` (SP), `TrialRestore.svelte` (TR), `ImageCertificate.svelte` (IC), `Evidence.svelte` (EV), `VmList.svelte` (VL), `HourQuote.svelte` (HQ), `ProviderHealth.svelte` (PH); catalogues `i18n/card.js` (`card.*`), `i18n/lifecycle.js` (`life.*`), `i18n/own-image.js` (`ownImage.*`), `evidence-i18n.js` (`evidenceTexts.*`, `panelTexts.*`), plus borrowed keys from `i18n/first-start.js` (`first.*`), `i18n/net.js` (`net.*`), `i18n/funds.js`, `i18n/purchase.js` (`buy.quote.*`), `i18n/backup.js` (`backup.health.*`, `backup.places.blockedWhy`).
All line numbers are real lines of the worktree `quizzical-newton-49ee83`. Read-only; nothing in the repo was changed.

Tab names today: `Übersicht` (= prop `simple=true`) and `Erweitert` (= `simple=false`), `app.tabs` in `i18n/app.js:49`. Inside "Erweitert" there is a card titled "Technisch" (`#technisch`, `+page.svelte:377`) with folded parts; `VmList` lives there.

Note: there is no `lifecycle-start*.js` logic module, only `lifecycle-start.spec.js` (a test). The full-screen own-image build ("ceremony") is drawn by `FirstStart.svelte` (324 lines, not in this slice) which mounts `ImageCertificate`; Lifecycle only feeds it.

---

## 1. State machine

**Mounting** (`routes/app/+page.svelte:370`): one `<Lifecycle>` instance inside `<div class="life" id="paperless">`, rendered in BOTH tabs; the prop `simple` switches between two completely separate templates (L1154-1252 "Übersicht", L1254-1368 "Erweitert"). State (busy, timers, panels) survives a tab switch because it is the same instance. `VmList` is mounted at `+page.svelte:400` inside `<details data-testid="tech-vms">` in the card `#technisch`, which is `hidden` in "Übersicht" → VmList is Erweitert-only and folded.

**Phase** (L1018-1025, one derived string, also sent up via `onglance`): `loading` → `off` → `starting` → `running` → `stopping` → `off`; side branches `interrupted` (profile.starting exists, no run in this tab) and `discarding` (erase without backup). Orthogonal flags modify what renders: `missing[]` (setup incomplete), `buildFirst`/`image` (own image), `backupsPending`/`backupsError`, `gap`/`unmarked` (restore confirmations), `unpaidBackup`, `short` (Aleph credits short → buy hours), `placesAsk` (provider down/blocked), `partial` (backup reached fewer providers), `periodEnded`, `restoreFailed`, `backingUp`, `stopChecking`, `error`/`errorRaw`/`again`, `goneNote`, `nodeNote`, `profile.trial`, `profile.backupRevokePending`, `ceremony` (full-screen build).

1. **loading**: Übersicht shows only title "Einen Moment …" (+ image line / last-backup line once profile arrives). Erweitert shows chip "…" and, because `profile.running` is falsy, already the start block.
2. **off, setup incomplete** (`missing.length`): Übersicht: hint + "Einrichtung öffnen" (jumps to Erweitert and opens the setup). Erweitert: Start button disabled + "Es fehlt noch: …".
3. **off, no own image yet** (`buildsImageFirst`): Übersicht image line "Beim ersten Start wird zuerst dein eigenes Image gebaut …". Pressing Start → native `window.confirm` with price/included (L541) → full-screen `FirstStart` with stations wake → check → seal → fetch (percent) → store → paperless; can be minimized; ends in a "done" screen with link to the certificate (`ImageCertificate`), or a "paused" screen on failure. Rebuild for a newer image version (`image.newer`): link "Jetzt neu bauen" (Übersicht only, phase off) or via the setup's "Mein Image bauen" (`onImageBuild`).
4. **off, ready**: Übersicht: big CTA "Paperless anywhere starten", one line saying which backup it starts with (CID tail + date) or "Startet ohne Daten", the gap/unmarked confirmation checkboxes, Storage, BackupChain. Erweitert: radio group "Beim Start" (newest / newest own with vault mark / newest without mark / empty; incremental backups show "Grundsicherung x"/"Ergänzung n zu x"), BackupExport, BackupChain, role line, Start, certificate button, last-backup card.
5. **Start gate questions**: unpaid backup (alertdialog, 3 buttons), gap (checkbox), unmarked backup (checkbox), Aleph credits short → error + fund offer (package hours or buy 5/10/30 h → HourQuote confirm).
6. **starting** (5 steps measure 10 s, instance 90 s, network 25 s, unlock 180 s, ready 300/600 s): Übersicht: title, "Fenster offen lassen", meter bar, "step · noch etwa N min", and the full `StartPanel` (7 rows: Messwerte, Instanz, Netz, Attestierung, Entsperren, [Wiederherstellen], Bereit; 15 lights). Erweitert: StartPanel + raw `progress …` line. Node refusals add `nodeNote` and retry on another node (up to 3). Attestation is not a separate phase: it is step `unlock` (panel rows "Attestierung" + "Entsperren").
7. **interrupted** (reload/closed tab during a start): Übersicht: "Start unterbrochen", "Start fortsetzen", "Verwerfen (…)". Erweitert: box with instance hash and time + the same two buttons. `goneNote` if Aleph no longer has it.
8. **running**: Übersicht: title + host, CTA open, login box (admin + derived password show/copy), BackupNow, Evidence (folded, "Jetzt erneut prüfen" re-attests), "Sichern und beenden", Storage, TrialRestore. Erweitert: CTA + host link, data-disk note, Evidence, login line, stop. BackupNow, Storage, TrialRestore, image line and the "Letzte erfolgreiche Sicherung" line are NOT in Erweitert.
9. **backup in progress** (`backingUp` from BackupNow): only effect here is that the Übersicht stop button is disabled (the Erweitert one is not, BackupNow is not rendered there).
10. **pre-stop check** (`stopChecking` → `placesAsk`): hint "Prüfe, ob die Speicheranbieter antworten …", then possibly the places box (replace provider / go on / cancel).
11. **stopping** (2 steps: stop 10 s or 540 s with backup, forget 60 s): meter + StartPanel in stop mode (7 rows Auftrag, Export, Archiv, Hochladen, Bestätigt, Löschen, Liste). Ends in **stopped/off** with the stop panel kept + Evidence "Nachweis: Sicherung und Löschen" until the next action. Erweitert additionally shows the "Letzte Sicherung" details card.
12. **partial** (fewer copies than asked): alert with "VM trotzdem löschen" / "VM behalten, Paperless-ngx weiter"; also re-raised after reload from the VM's `stop-partial` status.
13. **restore failed while running**: error text; stop button replaced by "Löschen ohne Sicherung" (native confirm with MB) → phase **discarding** (1 step).
14. **period end**: VM stopped itself at end of paid time → automatic erase run once, note `periodEnd.stopped`; error if no backups.
15. **trial restore** (`TrialRestore`): not started → requested (no host) → running (open link, login, restore result) → ended; native confirms on start and end. Shown in Übersicht only (while running: L1209; while not running only if a trial exists: L1232).
16. **errors**: `errorBox` (text, optional "Details" with raw browser words, optional "Noch einmal"), `errorLog` details with VM lines + ProviderHealth, "Mit dem vorherigen Image starten" if a previous own image exists.

**Übersicht vs Erweitert in one sentence**: Übersicht = status headline + one CTA + panels/evidence + backup tools (BackupNow, Storage, TrialRestore, image line, last-good line); Erweitert = compact card with chip, restore radio choice, BackupExport, role line, raw progress text, data-disk note, certificate button, last-backup detail card, and (elsewhere on the tab) VmList. Shared in both: Evidence, StartPanel, stop Evidence, places box, error box, partial box, fund offer, unpaid question, gap/unmarked warnings, notes.

---

## 2. Inventory table

Legend "Shown": Ü = Übersicht only, E = Erweitert only, both. Audience: S = simple, T = technical, both.

### 2.1 Lifecycle.svelte — overlay and "Übersicht" template

| ID | file:line | State / condition | Type | German text | i18n key | What it does | Shown | Audience |
|---|---|---|---|---|---|---|---|---|
| B-001 | L:1139-1152 | `ceremony` set (own-image build running, done, failed, or certificate opened) | full-screen overlay (FirstStart) | (texts in first-start catalogue: stations, "Geschafft – deine Paperless läuft!", "Kurz innegehalten") | `first.*` | props view/startTypical/host/ownImage/imageHash/plain; events onminimize/onexpand/oncertificate/onclose mutate `ceremony` | both | both; keep a calm version for S, facts for T |
| B-002 | L:541 | Start or rebuild when a build is needed | native `window.confirm` | "Eigenes Image bauen? {Preis} werden von deinem Le-Space-Guthaben abgebucht. …" / "Eigenes Image bauen? Dieser Bau ist enthalten, es wird nichts abgebucht." | `ownImage.choice.confirmPrice` / `confirmIncluded` | declining aborts the start silently (`buildWithJourney` returns false, no message) | both | both; replace native dialog |
| B-003 | L:1155-1156 | always (Übersicht) | status dot (LED) | – (grey off/loading/discarding; green+halo running; accent+halo, pulsing starting/stopping; accent interrupted) | – | CSS class `is-{phase}` | Ü | both |
| B-004 | L:1158 | phase loading | h1 | "Einen Moment …" | `card.titles.loading` | – | Ü | both |
| B-005 | L:1158 | phase off | h1 | "Paperless-ngx ist aus" | `card.titles.off` | – | Ü | both |
| B-006 | L:1158 | phase starting | h1 | "Paperless-ngx startet" | `card.titles.starting` | – | Ü | both |
| B-007 | L:1158 | phase stopping | h1 | "Paperless-ngx wird gesichert und beendet" | `card.titles.stopping` | – | Ü | both |
| B-008 | L:1158 | phase discarding | h1 | "Paperless-ngx wird ohne Sicherung gelöscht" | `card.titles.discarding` | – | Ü | both |
| B-009 | L:1158 | phase running | h1 | "Paperless-ngx läuft" | `card.titles.running` | – | Ü | both |
| B-010 | L:1158 | phase interrupted | h1 | "Start unterbrochen" | `card.titles.interrupted` | – | Ü | both |
| B-011 | L:1159 | off | sub line | "Der Start dauert etwa {10 min / 15 min}." | `card.simple.startTakes` | sum of STEPS typical (longer with restore) | Ü | S |
| B-012 | L:1160 | starting | sub line | "Lass dieses Fenster offen, bis Paperless-ngx bereit ist." | `card.simple.keepOpenStart` | – | Ü | both |
| B-013 | L:1161 | stopping / discarding | sub line | "Erst die Sicherung, dann geht die Maschine aus. Lass dieses Fenster offen." | `card.simple.keepOpenStop` | (also shown for discarding, where no backup is made: wrong text) | Ü | both |
| B-014 | L:1162 | running | sub line, mono | `{profile.running.host}` (e.g. 2n6 host name or fixed host:port) | – | plain text, not a link | Ü | T (S needs only "Öffnen") |
| B-015 | L:1163 | interrupted | sub line | "Die Maschine läuft schon und kostet, bis sie fertig gestartet ist." | `card.simple.interruptedCosts` | – | Ü | both |
| B-016 | L:1167 | BUILDER and own image | image line | "Eigenes Image, gebaut am {Datum}." | `ownImage.overview.built` | – | Ü | T (S: "geschützt"-badge at most) |
| B-017 | L:1168 | own image and `image.newer` | notice span | "Eine neuere Image-Version ist da." | `ownImage.overview.newer` | – | Ü | both (S: "Update verfügbar") |
| B-018 | L:1169 | newer and phase off | link-button | "Jetzt neu bauen" | `ownImage.overview.rebuild` | `rebuildImage()` → `run(rebuildFlow)` → confirm + FirstStart (rebuild, no start after) | Ü | both |
| B-019 | L:1170 | newer and phase ≠ off | hint | "Neu bauen geht, wenn Paperless gestoppt ist." | `ownImage.overview.rebuildStopped` | – | Ü | both |
| B-020 | L:1172 | `image.buildsAtStart` | image line | "Beim ersten Start wird zuerst dein eigenes Image gebaut: etwa 15 Minuten länger, …" | `card.simple.firstBuild` | – | Ü | both |
| B-021 | L:1173 | public image | image line | "Öffentliches Image, zum Ausprobieren." | `ownImage.overview.publicImage` | – | Ü | T |
| B-022 | L:1178 | `profile.backupConfig` and lastGood | status line (turns warn colour when >4 h old while running) | "Letzte erfolgreiche Sicherung: **{Zeit} (vor N Minuten/Stunden/Tagen)** · {n} Kopien" | `card.simple.lastGood`, `card.ago.*`, `card.simple.copies` | derived from profile.lastGoodBackup | Ü | both (key reassurance for S) |
| B-023 | L:1178 | old profile with only lastBackup | status line variant | "Letzte Sicherung beim Beenden: …" | `card.simple.lastAtStop` | – | Ü | both |
| B-024 | L:1178 | `newerOnChain` | notice | "Auf Filecoin liegt eine neuere ({n} Kopien); ihre Uhrzeit meldet erst das neue Image." | `card.simple.newerOnChain` | – | Ü | T |
| B-025 | L:1178 | backups on, none known | status line | "Noch keine erfolgreiche Sicherung bekannt" | `card.simple.noneKnown` | – | Ü | both |
| B-026 | L:1184 | starting / stopping / discarding | progress bar (role=progressbar) | aria-label = title | – | width = elapsed / typical total, capped 95 % | Ü | S |
| B-027 | L:1185 | same | progress text | "{Schritt} · noch etwa {N} min" with step labels "Messwerte berechnen", "VM anfordern und platzieren", "Port 443 und Adresse", "VM prüfen (AMD) und entsperren", "Paperless-ngx startet (Container, Zertifikat)", "Stopp anfordern (letzte Sicherung)", "VM löschen", "Vorbereiten" | `card.simple.left`, `card.steps.*` | – | Ü | S (labels need plain words) |
| B-028 | L:1186 | starting/stopping and panel has data | StartPanel (see 2.4) | – | `panelTexts` | lights from `startPanel()` / `stopPanel()` | Ü | T (S: at most 3-4 plain steps) |
| B-029 | L:1188 | running | CTA link | "Paperless-ngx öffnen" | `card.simple.open` | opens `https://{host}/` in new tab | Ü | both |
| B-030 | L:1114 (1189) | running and restore brought extra superusers | warning | "Mit der Sicherung kam ein weiterer Administrator außer „admin“. Wenn du ihn nicht kennst, …" | `card.superusers` | – | both (also L1262) | both |
| B-031 | L:1190 | running and restore failed | error text | "Die Sicherung ließ sich nicht wiederherstellen; Paperless-ngx läuft leer. Diese VM legt …" | `card.simple.restoreFailed` | points to „Erweitert“ for details | Ü | both |
| B-032 | L:1192 | running | box heading | "Anmeldung in Paperless-ngx" | `card.simple.login` | – | Ü | both |
| B-033 | L:1193 | running | text | "Benutzer `admin`" | `card.simple.user` | – | Ü | both |
| B-034 | L:1194 | running | text / secret | "Passwort ••••••••" or the derived password | `card.simple.password` | `paperlessSecrets(master).adminPassword` | Ü | both |
| B-035 | L:1196 | running | button (toggle) | "Passwort anzeigen" / "Verbergen" | `card.simple.show` / `hide` | toggles `showPassword` | Ü | both |
| B-036 | L:1197 | running | button | "Kopieren" | `card.simple.copy` | clipboard write, no feedback | Ü | both |
| B-037 | L:1200 | running, backups on, restore not failed | component BackupNow (other slice) | ("Jetzt sichern") | – | props master/profile/known/disabled/guard=`checkPlacesThen`; events onbusy→`backingUp`, ongood→`rememberGood` | Ü | both |
| B-038 | L:1201 | running | Evidence (see 2.5) "Nachweis dieser VM" | – | `evidenceTexts` | `onagain=checkAgain` → `attestRunning` | Ü (also E L1266) | T; S gets a one-line "geprüft" |
| B-039 | L:1202 | running and restore failed | button (amber) | "Löschen ohne Sicherung" | `card.simple.discard` | `discardFailed()` → native confirm (B-040) → `eraseStopped` | Ü (also E L1272) | both |
| B-040 | L:891 | after B-039 | native `confirm` | "Diese VM ohne Sicherung löschen? Das lässt sich nicht rückgängig machen. Alles, was seit …" (with "jetzt {n} MB Dokumente") | `card.simple.discardConfirm` | cancel aborts | both | both |
| B-041 | L:1204 | running and `reach === 'bad'` | warning | "Gerade antwortet keine Kopie der neuesten Sicherung (siehe Licht „Sicherungen erreichbar“ oben). …" | `card.simple.stopReachBad` | refers to the header LEDs | Ü (also E L1274) | both |
| B-042 | L:1205 | running | button (amber) | "Sichern und beenden" | `card.simple.stop` | `stop()` → `checkPlacesThen(stopNow)` → `stopPaperless`; disabled while busy, backingUp, stopChecking | Ü (also E L1275) | both |
| B-043 | L:1206 | `stopChecking` | status hint | "Prüfe, ob die Speicheranbieter antworten …" | `card.simple.stopChecking` | – | Ü (also E L1276) | both |
| B-044 | L:1208 | running | component Storage (other slice) | – | – | props master/profile | Ü | both |
| B-045 | L:1209 | running and backups listable | TrialRestore (see 2.6) | – | `life.trial` | – | Ü | T (S: maybe "Sicherung testen" later) |
| B-046 | L:1211 | interrupted | CTA button | "Start fortsetzen" | `card.simple.resume` | `resume()` → `resumeStart` | Ü (also E L1310) | both |
| B-047 | L:1212 | interrupted | quiet link-button | "Verwerfen (die VM dann unten unter „Meine VMs“ löschen)" | `card.advanced.discard` | `discard()` removes `profile.starting` only; the VM keeps running | Ü (also E L1311) | T; S needs one "Abbrechen und löschen" |
| B-048 | L:1215 | off and missing | hint | "Paperless anywhere ist hier noch nicht fertig eingerichtet." | `card.simple.notSetUp` | – | Ü | both |
| B-049 | L:1216 | off and missing | button | "Einrichtung öffnen" | `card.simple.openSetup` | `onadvanced()` → page switches to Erweitert and opens setup | Ü | both |
| B-050 | L:1218 | off, nothing missing | CTA button | "Paperless anywhere starten" | `card.simple.start` | `start()`; disabled while busy, backupsPending, backupsError, gapOpen, unmarkedOpen | Ü (also E L1315) | both |
| B-051 | L:1220 | backups being read | hint | "Sicherungen werden gelesen …" | `card.simple.readingBackups` | – | Ü | both |
| B-052 | L:1221 | `backupsError` | warning | "Die Sicherungen ließen sich gerade nicht lesen. Bitte gleich noch einmal versuchen." | `card.backupsUnreadable` + `card.simple.tryAgain` | no retry control; Start stays disabled | Ü | both |
| B-053 | L:1222 | backups read, one chosen | hint | "Startet mit der neuesten Sicherung ({…12 Zeichen CID}, vom {Datum})." | `card.simple.startsWith`, `card.dated` | – | Ü | both (S without CID) |
| B-054 | L:1222 | backups read, none | hint | "Startet ohne Daten: es gibt noch keine eigene Sicherung." | `card.simple.startsEmpty` | – | Ü | both |
| B-055 | L:1225 | off, nothing missing | component Storage | – | – | – | Ü | both |
| B-056 | L:1229 | stop/erase over, not busy | StartPanel (stop mode) kept | – | `panelTexts.stop` | stays until next `track()` | Ü (E L1323) | T |
| B-057 | L:1230 | after a stop | Evidence "Nachweis: Sicherung und Löschen" | – | `evidenceTexts.stopTitle` | `stopEvidenceRows` | Ü (E L1324) | T |
| B-058 | L:1231 | `chainBackup` (any phase) | component BackupChain (other slice) | – | – | props network/backup | Ü (E L1305 only when not running) | T |
| B-059 | L:1232 | not running and `profile.trial` | TrialRestore | – | – | lets a leftover trial be ended | Ü | both (costs money) |
| B-060 | L:1233 | `backupRevokePending` and not running | hint | "Der Schlüssel der gelöschten VM für die Sicherungen ist bei Le Space Credits noch freigegeben; …" | `card.revokePending` | – | both (E L1326) | T |
| B-061 | L:1234 | `goneNote` | status hint | "Der unterbrochene Start ist bei Aleph abgelehnt worden / nicht mehr da (…). Er ist verworfen; du kannst neu starten." | `life.errors.startGone` | – | both (E L1327) | both |
| B-062 | L:1235 | `nodeNote` | status hint | "Dieser Knoten kann trotz Angabe keine vertraulichen VMs. Die App versucht einen anderen." / "Dieser Knoten hat die VM abgelehnt. Die App versucht einen anderen." | `card.nodeRefused.noSevSnp` / `refused` | – | both (E L1328) | T |
| B-063 | L:1236 | `periodEnded` | status hint | "Die bezahlte Laufzeit ist zu Ende. Paperless-ngx hat vorher eine letzte Sicherung gemacht …" | `card.periodEnd.stopped` | – | both (E L1329) | both |
| B-064 | L:1239 | error, not busy, not running, previous own image kept | button + hint | "Mit dem vorherigen Image starten" — "Dein voriges eigenes Image ist noch da, bis das neue einmal gut gestartet ist." | `ownImage.previousStart`, `previousHint` | `startPrevious()` → `fallbackPatch` + `startNow` | both (E L1332) | both |
| B-065 | L:1250 | `errorLog.length` | details (closed) | summary "Details aus der VM" + `<pre>` log lines + ProviderHealth | `card.simple.vmDetails` | – | Ü | T |
| B-066 | L:1251 | `short` and CREDITS_URL and (appPays or leSpacePays) | fund offer (see 2.3) | – | – | note: Erweitert condition is narrower (appPays only, L1343) | Ü | both |
| B-067 | L:1252 | after a purchase | status hint | "{n} Stunden gekauft für {x} €. Guthaben jetzt {y} €. VM-Stunden: {z} h." | `card.bought` | – | both (E L1344) | both |

### 2.2 Lifecycle.svelte — "Erweitert" template

| ID | file:line | State / condition | Type | German text | i18n key | What it does | Shown | Audience |
|---|---|---|---|---|---|---|---|---|
| B-068 | L:1255 | always | card heading h2 | "Paperless-ngx" (hard-coded) | – | – | E | both |
| B-069 | L:1256 | always | chip (green when running) | "…", "aus", "startet", "wird beendet", "wird gelöscht", "läuft", "Start unterbrochen" | `card.chips.*` | – | E | both |
| B-070 | L:1258 | always | purpose text | "Deine Paperless-ngx-Maschine: starten, öffnen, sichern und beenden." | `card.advanced.purpose` | – | E | both |
| B-071 | L:1260 | running | CTA link | "Paperless-ngx öffnen" | `card.simple.open` | new tab | E | both |
| B-072 | L:1261 | running | text + link | "Paperless-ngx läuft: {host}" | `card.advanced.runs` | link to `https://{host}/` (duplicate of B-071) | E | T |
| B-073 | L:1263 | running, restore failed | error | "Wiederherstellung fehlgeschlagen ({Grund}: {Fehler}). Paperless-ngx läuft leer. Diese VM legt …" | `card.advanced.restoreFailed`, `noReason` ("ohne Grund") | – | E | T (reason detail) |
| B-074 | L:1264 | running, dataDisk encrypted | hint | "Was diese VM schreibt, liegt auf einer eigenen Platte, verschlüsselt mit einem Schlüssel, …" | `card.advanced.diskEncrypted` | – | E | T |
| B-075 | L:1265 | running, dataDisk plain | warning | "Diese VM schreibt auf die gemeinsame Image-Platte, ohne eigenen Schlüssel. Die eigene Datenplatte …" | `card.advanced.diskPlain` | – | E | T |
| B-076 | L:1266 | running | Evidence | – | – | same as B-038 | E | T |
| B-077 | L:1267-1268 | running | text | "Anmeldung: `admin`, ••••••••" / password | `card.advanced.login` | – | E | both |
| B-078 | L:1269 | running | button | "Passwort anzeigen" / "Verbergen" | `card.simple.show`/`hide` | toggle | E | both |
| B-079 | L:1270 | running | button | "Kopieren" | `card.simple.copy` | clipboard | E | both |
| B-080 | L:1272 | running, restore failed | button | "Löschen ohne Sicherung" | `card.simple.discard` | `discardFailed` | E | both |
| B-081 | L:1274 | running, reach bad | warning | (= B-041) | `card.simple.stopReachBad` | – | E | both |
| B-082 | L:1275 | running | button | "Sichern und beenden" | `card.simple.stop` | `stop`; disabled busy or stopChecking (NOT backingUp) | E | both |
| B-083 | L:1276 | stopChecking | hint | (= B-043) | `card.simple.stopChecking` | – | E | both |
| B-084 | L:1280-1281 | not running, `profile.ageIdentity` | fieldset legend | "Beim Start" | `card.advanced.atStart` | restore choice | E | T (S: automatic newest) |
| B-085 | L:1283-1285 | production (primary+mainnet) and own backups | radio `latest` + small | "Neueste Sicherung wiederherstellen ({…CID}, vom {Datum}, [Grundsicherung x / Ergänzung n zu x,] {Größe} [in n Teilen], {n} Kopien: {Orte})" | `card.advanced.restoreLatest`, `copiesAt`, `card.snapshotOf`, `card.inParts`, `card.provider`, `card.and` | `choice='latest'` | E | T |
| B-086 | L:1288-1290 | always in fieldset; disabled without own backups | radio `own` + small | "Neueste eigene Sicherung (mit Siegel des Tresors) wiederherstellen (…)" | `card.advanced.restoreOwn` | `choice='own'` | E | T |
| B-087 | L:1291 | no own backups | small | "(noch keine mit dem Siegel dieses Tresors)" / "(lese …)" | `card.advanced.noneOwn` / `reading` | – | E | T |
| B-088 | L:1294-1296 | `split.other.length` | radio `any` + small | "Neueste Sicherung ohne Siegel deines Tresors ({…CID}, {Größe}, {Orte}) – {n} ohne Siegel: ältere Sicherungen oder solche, die nicht …" | `card.advanced.restoreOther`, `otherHint` | `choice='any'` → unmarked warning | E | T |
| B-089 | L:1299 | always in fieldset | radio `empty` | "Leeres Paperless-ngx" | `card.advanced.empty` | `choice='empty'` | E | T |
| B-090 | L:1300 | backupsError | small hint | "Die Sicherungen ließen sich gerade nicht lesen." | `card.backupsUnreadable` | Start stays ENABLED here (unlike Übersicht) | E | both |
| B-091 | L:1304 | a backup chosen | component BackupExport (other slice) | ("Sicherung selbst holen") | – | props backup/identity | E | T |
| B-092 | L:1305 | chainBackup | component BackupChain | – | – | – | E | T |
| B-093 | L:1308-1309 | `profile.starting` and not busy | warn box text | "Ein Start wurde unterbrochen: VM `{12 Zeichen Hash}`, angefordert {Datum}. Sie läuft auf Aleph und kostet, bis …" | `card.advanced.interrupted.before` / `.requested` | – | E | both |
| B-094 | L:1310 | same | CTA button | "Start fortsetzen" | `card.simple.resume` | `resume` | E | both |
| B-095 | L:1311 | same | quiet button | "Verwerfen (die VM dann unten unter „Meine VMs“ löschen)" | `card.advanced.discard` | `discard` | E | T |
| B-096 | L:1314 | not running, no interrupted start | role line | "Startet produktiv: Mail-Regeln an, Sicherungen auf Mainnet." / "Startet als Test: Mail-Regeln aus, Sicherungen ins Testnetz." | `card.advanced.rolePrimary` / `roleTest` | – | E | T |
| B-097 | L:1315 | same | CTA button | "Paperless anywhere starten" | `card.simple.start` | `start`; disabled busy, missing, gapOpen, unmarkedOpen (not on backupsPending) | E | both |
| B-098 | L:1317 | missing | hint | "Es fehlt noch: zahlendes Konto, Wallet für die Sicherungen, Sicherungen über Le Space Credits freigeben, Paperless-Image, Image-Passphrase, Passphrase für dieses Image (…), Netz Mainnet für die Rolle „Produktiv“, Rolle „Produktiv“ für Sicherungen auf Mainnet (…)" | `card.advanced.stillMissing`, `life.missing.*` (9 items; `node` unused) | list from `startRequirements` | E | T (S: "Einrichtung fehlt" + guided fix) |
| B-099 | L:1319 | not running and own image | quiet button | "Deine Urkunde" | `first.cert.open` | `showCertificate()` → FirstStart in certificate-only mode → ImageCertificate | E | both (S likes the certificate) |
| B-100 | L:1321 | start shown | StartPanel | – | – | – | E | T |
| B-101 | L:1323 | stop shown | StartPanel (stop) | – | – | – | E | T |
| B-102 | L:1324 | after stop | Evidence (stop) | – | – | – | E | T |
| B-103 | L:1325 | `progress` non-empty | raw progress line | "{Text} …" — any of the texts in 2.9 | see 2.9 | set by `track()`/`run()` | E | T |
| B-104 | L:1343 | short and CREDITS_URL and appPays | fund offer | – | – | see 2.3 | E | both |
| B-105 | L:1345-1346 | errorLog | details (OPEN) | summary "Was die VM zur Sicherung meldet" + pre + ProviderHealth | `card.advanced.vmSays` | – | E | T |
| B-106 | L:1350-1351 | not running and `profile.lastBackup` | details summary | "Letzte Sicherung: {Datum} · {have}/{want} Kopien (unvollständig)" | `card.last.title` | folded card | E | both (S: date + ok only) |
| B-107 | L:1353 | inside | dt/dd | "Netz — Filecoin Mainnet / Filecoin Calibration (Testnetz)" | `card.last.network`, `testnet` | – | E | T |
| B-108 | L:1354 | inside | dt/dd | "Bezahlt von — `{0x…}`" | `card.last.paidBy` | – | E | T |
| B-109 | L:1355 | inside | dt/dd | "Piece CID — `{cid}`" (label hard-coded) | – | – | E | T |
| B-110 | L:1356 | size known | dt/dd | "Größe — {x} MiB (verschlüsselt), in n Teilen" | `card.last.size`, `encrypted`, `inParts` | – | E | T |
| B-111 | L:1357 | seconds known | dt/dd | "Dauer — {n} s" | `card.last.duration` | – | E | T |
| B-112 | L:1361 | per copy | list item | "Anbieter {id} ({Ort}) · Datensatz {n}, Piece {n} (neuer Datensatz)" | `card.last.copy` | – | E | T |
| B-113 | L:1362 | copy has https URL | link + small | "abrufen" "(verschlüsselt; nur dein Schlüssel öffnet sie)" | `card.last.fetch`, `fetchHint` | opens retrieval URL (downloads ciphertext) | E | T |
| B-114 | L:1365 | failedAttempts | hint | "{n} Fehlversuch(e) bei Anbietern, ersetzt." | `card.last.failed` | – | E | T |

### 2.3 Lifecycle.svelte — snippets used in both templates

| ID | file:line | State / condition | Type | German text | i18n key | What it does | Shown | Audience |
|---|---|---|---|---|---|---|---|---|
| B-115 | L:1050-1051 | `placesAsk.blocked` | alert box paragraph | "Deine Sicherungsorte nennen gesperrte Anbieter: {Namen} ({Grund}). Neue Kopien sollen dort …" (Grund e.g. "FIDL (Cello, Bass): am 16.11.2026 beide zugleich nicht erreichbar, …") | `card.places.blocked`, `backup.places.blockedWhy.fidl` | raised once per visit on load (L845-859) or before a backup/stop | both | T (S: "Ein Speicherort wurde ersetzt" auto) |
| B-116 | L:1052 | providers down | paragraph | "Diese Speicheranbieter antworten gerade nicht: {id Name}. Eine Sicherung dorthin würde scheitern; …" | `card.places.down` | – | both | both |
| B-117 | L:1054 | plan exists | list | "statt {id Name}: {id Name, Ort} (anderer Betreiber, antwortet)" / "für {…} gibt es gerade keinen Ersatz bei einem anderen Betreiber; diese Kopie entfällt" | `card.places.instead` / `none` | – | both | T |
| B-118 | L:1055 | plan exists | hint | "Übernommen gehen die neuen Orte gleich an die laufende VM, dann startet die Sicherung. …" / "Übernommen gelten die neuen Orte für die nächsten Sicherungen; …" | `card.places.hint` / `blockedHint` | – | both | T |
| B-119 | L:1057 | no plan | hint | "Einen Ersatz bei einem anderen Betreiber, der gerade antwortet, gibt es nicht." | `card.places.noReplacement` | – | both | both |
| B-120 | L:1061 | blocked only, plan | button | "Ersatz übernehmen" | `card.places.acceptOnly` | `acceptPlaces()` → updateProfile + `pushBackupPlaces` | both | both |
| B-121 | L:1062 | blocked only | quiet button | "Später" | `card.places.later` | closes box | both | both |
| B-122 | L:1064 | down, plan | button | "Übernehmen und sichern" | `card.places.accept` | `acceptPlaces()` then continues the pending backup/stop | both | both |
| B-123 | L:1065 | down | secondary button | "Ohne Änderung weiter" / "Trotzdem versuchen" (all down) | `card.places.goOn` / `tryAnyway` | `placesAnyway()` continues | both | both |
| B-124 | L:1066 | down | quiet button | "Abbrechen" | `card.places.cancel` | closes box, nothing happens | both | both |
| B-125 | L:1074-1075 | `error` | alert | error text (see 2.10) | various | – | both | both (S: plain sentence + one action) |
| B-126 | L:1076 | `errorRaw` (network error) | details | "Details" + raw browser message | `net.details` | – | both | T |
| B-127 | L:1077 | `again` set | button | "Noch einmal" | `net.again` | re-runs start/resume/stop/period-end erase | both | both |
| B-128 | L:1075 | network error | error text | "Die Verbindung ist unterbrochen worden. Bitte prüfe dein Netz (VPN- oder WLAN-Wechsel) und versuche …" | `net.broken` | – | both | both |
| B-129 | L:1083 | fund offer | component RefreshBalances (other slice) | "Ich habe aufgeladen – neu prüfen" | `funds.toppedUp` | bumps `balancesRound` | both | both |
| B-130 | L:1086 | package holds hours | hint | "In deinem Paket liegen noch {h} Stunden. Le Space bezahlt die VM dann daraus; die Zahlweise …" | `card.fund.inPackage` | – | both | both |
| B-131 | L:1087 | same | button | "Aus dem Paket starten ({h} h)" | `card.fund.startFromPackage` | `startFromPackage()` switches payer to leSpacePays and starts | both | both |
| B-132 | L:1091-1092 | otherwise | label + select | "Stunden aus Le Space Credits kaufen" — options "5 h", "10 h", "30 h" | `card.fund.buyLabel` | binds `fundHours` (default 10) | both | both |
| B-133 | L:1093 | same | button | "Kaufen und starten" / "Preis wird abgefragt …" | `card.fund.buyAndStart` / `quoting` | `askToBuy()` → `purchase.ask` → `quoteVm` | both | both |
| B-134 | L:1095 | quote open / short | HourQuote (see 2.8) | – | – | confirm → `fundAndStart` | both | both |
| B-135 | L:1096 | `buying.error` | alert | (error from credits service) | – | – | both | both |
| B-136 | L:1102-1103 | `unpaidBackup` | alertdialog (aria-label "Start ohne Sicherung") | "**Für heute ist keine Sicherung bezahlt.** Paperless anywhere würde ohne Sicherung laufen: Was du in …" | `card.unpaid.label`, `strong`, `text` | raised by `start()` via `backupUnpaid()` | both | both |
| B-137 | L:1105 | same | secondary button | "Erst die Sicherung buchen (im Paket)" | `card.unpaid.book` | `toPackage()` scrolls to `#paket` | both | both |
| B-138 | L:1106 | same | quiet button | "Ohne Sicherung starten" | `card.unpaid.without` | `startWithoutBackup()` | both | both |
| B-139 | L:1107 | same | quiet button | "Doch nicht starten" | `card.unpaid.cancel` | closes | both | both |
| B-140 | L:1119-1120 | `choice==='any'` and backup chosen | warn box | "Die Sicherung {…CID}, vom {Datum} trägt nicht das Siegel deines Tresors. Entweder ist sie …" | `card.unmarked.text` | – | both | both (S: plain) |
| B-141 | L:1121 | same | checkbox | "Sie ist meine: trotzdem einspielen" | `card.unmarked.accept` | sets `unmarkedAccepted` → enables Start | both | both |
| B-142 | L:1128-1132 | `gap === 'missing'` | warn box | "Die letzte Sicherung, die diese App kennt ({…CID}, vom …), steht gerade nicht in der Liste …" + "Wenn du das nicht erwartest, versuche es später noch einmal." | `card.gap.missing`, `card.gap.later` | – | both | both |
| B-143 | L:1131 | `gap === 'older'` | warn box | "Die gewählte Sicherung ist älter als die letzte, die diese App kennt ({…CID}). Was danach …" | `card.gap.older` | – | both | both |
| B-144 | L:1134 | gap | checkbox | "Trotzdem so starten" | `card.gap.accept` | sets `gapAccepted` → enables Start | both | both |
| B-145 | L:1241-1242 (1334-1335) | `partial` | alert text | "Gesichert, aber nur {have} von {want} Kopien sind angekommen: ein Anbieter hat die Sicherung abgelehnt. Paperless ist angehalten." | `life.errors.backupPartial` | from `BackupPartialError` | both | both |
| B-146 | L:1243 (1336) | partial | hint | "Die angekommenen Kopien reichen zum Wiederherstellen. Wird die VM jetzt gelöscht, fehlt diese …" | `card.partial.hint` | – | both | both |
| B-147 | L:1245 (1338) | partial | button | "VM trotzdem löschen" | `card.partial.erase` | `eraseAnyway()` → `confirmStopBackup` + `eraseStopped` | both | both |
| B-148 | L:1246 (1339) | partial | secondary button | "VM behalten, Paperless-ngx weiter" | `card.partial.keep` | `keepVm()` → `resumeAfterPartial` | both | both |

### 2.4 StartPanel.svelte (used for start, stop and discard)

Each light carries a state word in brackets: "offen", "läuft", "von der App geprüft", "gemeldet", "in dieser Sitzung nicht geprüft", "fehlgeschlagen", "später" (`panelTexts.states`); sign glyphs `· ▶ ✓ • – ✗` (SP:17). Row states (screen reader): "offen", "läuft", "fertig", "nicht geprüft", "fehlgeschlagen".

| ID | file:line | State / condition | Type | German text | i18n key | What it does | Shown | Audience |
|---|---|---|---|---|---|---|---|---|
| B-149 | SP:21 | panel shown | section (aria-label) | "Start der VM: was gerade geschieht und was geprüft ist" / "Sichern und beenden: was gerade geschieht und wohin die Sicherung geht" / "Löschen ohne Sicherung: was gerade geschieht" | `panelTexts.title`, `.stop.title`, `.stop.titleDiscard` | title is not visible, aria only | both | T |
| B-150 | SP:25 | per row | row name + number + time | "{n} {Zeile}" + "{12 s} (üblich ca. 10 s)" | `panelTexts.rows.*`, `card.advanced.usual` | times from `panelTimes` | both | T |
| B-151 | SP:26 | per row | LED strip (decorative, aria-hidden) | – | – | colour per light state | both | T (S: simple check marks) |
| B-152 | SP:29 | start row 1 "Messwerte" | 2 lights | "Laufzeit von Aleph ist die in der App eingetragene"; "Messwert berechnet, mit deinem App-Schlüssel als Besitzer" | `panelTexts.lights.runtime`, `measurement` | – | both | T |
| B-153 | SP:29 | start row 2 "Instanz" | 2 lights | "INSTANCE-Nachricht signiert und von Aleph angenommen"; "Knoten benachrichtigt" | `lights.signed`, `notified` | – | both | T |
| B-154 | SP:29 | start row 3 "Netz" | 2 lights | "Port 443 zugeordnet"; "Adresse der VM bekannt" | `lights.port`, `address` | – | both | T |
| B-155 | SP:29 | start row 4 "Attestierung" | 2 lights | "Bericht von AMD signiert, Messwert und Policy wie berechnet"; "frischer Zufallswert und TLS-Schlüssel der VM im Bericht" | `lights.report`, `binding` | "skipped" when resumed already unlocked | both | T (S: "Sicherheit geprüft") |
| B-156 | SP:29 | start row 5 "Entsperren" | 2 lights | "Passphrase und Geheimnisse signiert übergeben"; "VM nennt, was sie angenommen hat" | `lights.handed`, `stored` | – | both | T |
| B-157 | SP:29 | start row 6 "Wiederherstellen" (only when restoring) | 1 light | "Sicherung eingespielt" | `lights.restored` | – | both | both |
| B-158 | SP:29 | start row 7 "Bereit" | 4 lights | "eigener Datenbereich versiegelt"; "Container laufen"; "Zertifikat ausgestellt"; "Paperless-ngx antwortet" | `lights.dataDisk`, `containers`, `cert`, `paperless` | – | both | T (last one for S) |
| B-159 | SP:29 | stop row "Auftrag" | 2 lights | "Stopp-Auftrag von der App signiert an die VM geschickt"; "VM hat den Auftrag angenommen" | `panelTexts.stop.lights.sent`, `taken` | – | both | T |
| B-160 | SP:29 | stop row "Export" | 2 lights | "Paperless pausiert, damit nichts mehr hinzukommt"; "Datenbank und Dokumente exportiert ({n} Dateien)" | `stop.lights.paused`, `exported`, `exportedFiles` | – | both | both |
| B-161 | SP:29 | stop row "Archiv" | 1-2 lights | "Archiv gepackt und in der VM mit age (X25519, ChaCha20-Poly1305) für deinen Sicherungsschlüssel verschlüsselt[: {x} MB in {n} Teilen]"; "Kopf der Sicherung beim Anbieter öffnet sich mit deinem Schlüssel" / "… öffnet sich nicht …" / "… nicht erreichbar" | `stop.lights.sealed`, `sealedSize`, `sealedParts`, `header`, `headerRefused`, `headerUnreachable` | header light appears after the stop (app check) | both | T (S: "verschlüsselt") |
| B-162 | SP:29 | stop row "Hochladen" | n lights | "Kopien bei den Speicheranbietern" / "Kopie bei Anbieter {id}" / "Kopie bei Anbieter {id} ({Ort}), Datensatz {n}" | `stop.lights.copies`, `copyTo`, `copyAt` | – | both | both |
| B-163 | SP:29 | stop row "Bestätigt" | 2 lights | "Piece-CID des Archivs" / "Piece-CID {cid}"; "Anbieter bestätigen das Stück in ihrem Datensatz" / "{have} von {want} Anbietern bestätigen …" | `stop.lights.pieceCid`, `pieceCidIs`, `confirmed`, `confirmedOf` | – | both | T |
| B-164 | SP:29 | stop/discard row "Löschen" | 2-3 lights | "Knoten hat die VM angehalten und gelöscht" / "Knoten führt die VM nicht mehr" / "Knoten hat nicht sofort geantwortet; das FORGET beendet die VM in einigen Minuten"; "FORGET von der App signiert und von Aleph angenommen"; "Sicherungsschlüssel der VM bei Le Space widerrufen" / "… noch nicht widerrufen; …" | `stop.lights.node`, `nodeGone`, `nodeLater`, `forgot`, `revoke`, `revokeLater` | – | both | T (S: "Maschine aus, kostet nichts mehr") |
| B-165 | SP:29 | stop row "Liste" | 1 light | "Sicherung in deiner Liste der Sicherungen vermerkt" / "keine neue Sicherung: nichts geändert seit der letzten, oder Sicherungen aus" | `stop.lights.listed`, `nothingNew` | – | both | both |
| B-166 | SP:35 | panel shown | sr-only live region | "{Zeile}: {Zustand}" | `panelTexts.live` | polite announcements | both | both (a11y, keep) |
| B-167 | SP:36 | total set | total line | "Gesamt: {123 s} · üblich ca. {10 min}" | `card.advanced.total` | – | both | T |
| B-168 | SP:37 | panel shown | legend | "Grün: von der App selbst geprüft. Blau: von der VM oder von Aleph gemeldet, nicht von der Hardware bestätigt." + "Werte und Links stehen danach unter „Nachweis dieser VM“." / "Anbieter, Datensätze, Piece-CID und die FORGET-Nachricht stehen danach unter „Nachweis: Sicherung und Löschen“." / "Die FORGET-Nachricht steht danach unter …" | `panelTexts.legend`, `after`, `stop.after`, `stop.afterDiscard` | – | both | T |

### 2.5 Evidence.svelte ("Nachweis dieser VM", "Nachweis: Sicherung und Löschen")

| ID | file:line | State / condition | Type | German text | i18n key | What it does | Shown | Audience |
|---|---|---|---|---|---|---|---|---|
| B-169 | EV:33-35 | running (or after a stop) | details summary (folded by default) | "Nachweis dieser VM" / "Nachweis: Sicherung und Löschen" | `evidenceTexts.title` / `stopTitle` | – | both | T; S: one green sentence |
| B-170 | EV:36 | prop `sample` | badge | "Beispiel, keine echte VM" | `evidenceTexts.sample` | not used by Lifecycle (landing page use) | – | – |
| B-171 | EV:37 | always | tally in summary | "{n} von der App geprüft · {n} gemeldet · {n} außerhalb der Hardware-Prüfung · {n} nicht bestätigt" | `evidenceTexts.summary` | `tally(rows)` | both | T |
| B-172 | EV:39-41 | open | legend (4 marks ✓ • – ○) | "von der App geprüft"; "gemeldet, nicht von der Hardware bestätigt"; "außerhalb der Hardware-Prüfung, anders geschützt"; "nicht bestätigt" | `evidenceTexts.marks.*` | – | both | T |
| B-173 | EV:45-46 | row runtime | row head + description | "Laufzeit" — "Firmware, Kernel und Initrd. Fest in der App eingetragen; liefert Aleph etwas anderes, …" | `rows.runtime` | values Name, Aleph-Nachricht, Paket (SHA-256), Startzeile | both | T |
| B-174 | EV:45-46 | row measurement | row | "Messwert" — "Von der App aus der Laufzeit und einer Startzeile berechnet, die deinen App-Schlüssel …" | `rows.measurement` | value "berechnet"; note "Für diese VM sind keine Messwerte vermerkt." (`notes.none`) | both | T |
| B-175 | EV:45-46 | row instance | row | "Instanz" — "Die INSTANCE-Nachricht bei Aleph, von deiner App signiert." | `rows.instance` | values Nachricht, bezahlt von; link "Aleph-Nachricht" | both | T |
| B-176 | EV:45-46 | row node | row | "Knoten" — "Der Aleph-Knoten, auf dem die VM läuft, und ihre Adresse." | `rows.node` | values Knoten, Adresse | both | T |
| B-177 | EV:45-46 | row attestation | row | "Attestierung" — "Der Bericht des AMD-Prozessors, in deinem Browser geprüft: von AMD signiert, sein Messwert …" | `rows.attestation` | values Messwert im Bericht, Policy, Firmware-Stände, Zeitpunkt; links "AMD SEV", "Ablauf der Prüfung"; notes `notKept` ("Für diese VM ist kein Ergebnis vermerkt: …"), `mismatch` ("Der vermerkte Messwert gehört nicht zu den berechneten. Bitte erneut prüfen.") | both | T (S: "Von AMD-Hardware bestätigt am …") |
| B-178 | EV:56 | attestation row and `onagain` | button | "Jetzt erneut prüfen" / "Prüfe die VM (AMD) …" | `evidenceTexts.again` / `checking` | `again()` → Lifecycle `checkAgain` → `attestRunning` + `loadProfile`; null while busy | both | both |
| B-179 | EV:57 | after re-check | status text | "Frisch geprüft." / "Die Prüfung ist fehlgeschlagen: {Grund}" | `evidenceTexts.checked` / `failed` | – | both | both |
| B-180 | EV:45-47 | row relay | row + note | "Relay" — "Der Server, über den dein Browser die VM für die Prüfung erreicht hat." + notes "Ein Relay von Le Space, nicht attestiert: …" / "Ein Relay, den du selbst eingetragen hast, …" / "Für diese VM ist nicht vermerkt, welcher Relay …" | `rows.relay`, `notes.relayLeSpace` / `relayOwn` / `relayUnknown` | value Relay; links "Quelltext des Relays (WebSocket)" / "(libp2p)" | both | T |
| B-181 | EV:45-47 | row image | row + note | "Image" — "Die verschlüsselte Platte, von der die VM startet, benannt durch ihren STORE-Hash." + "Der Inhalt des Images wird nicht mitgemessen. …" | `rows.image`, `notes.notMeasured` | values STORE-Hash, Verschlüsselung der Platte ("LUKS2 · aes-xts-plain64 · 512-Bit-Schlüssel, …"); links "build-image.sh", "encrypt-image.sh", "Sicherheitsmodell" | both | T |
| B-182 | EV:45-47 | row data | row + note | "Datenbereich" — "Wohin die VM schreibt." + "Die VM meldet: eigener Datenbereich, verschlüsselt …" / "Die VM meldet: Sie schreibt auf die Image-Platte, …" / "Die VM hat dazu nichts gemeldet." | `rows.data`, `notes.sealed` / `plain` / `unknown` | link "paperless-data-disk" | both | T |
| B-183 | EV:45-47 | row backups | row + note | "Sicherungen" — "Die letzte Sicherung, die bei Speicheranbietern angekommen ist." + "In der VM mit age für deinen Schlüssel verschlüsselt; bei den Anbietern liegt nur Chiffrat." / "Sicherungen sind nicht eingerichtet." / "Noch keine Sicherung vermerkt." | `rows.backups`, `notes.encrypted` / `off` / `noneYet` | values Zeitpunkt, Kopien | both | both |
| B-184 | EV:45-47 | stop row stopPiece | row | "Letzte Sicherung" — "Das verschlüsselte Archiv dieses Stopps, benannt durch seine Piece-CID, wie die VM …" | `rows.stopPiece` | values Stück (Piece-CID), Größe (verschlüsselt), weiterer Teil | both | T |
| B-185 | EV:45-47 | stop row stopSealed | row + note | "Verschlüsselung" — "Wie die VM die Sicherung verschlüsselt hat, bevor sie sie hochlud: mit age, …" + notes "Von der App geprüft: Der Kopf der Sicherung …" / "Der Kopf der Sicherung beim Anbieter öffnet sich nicht …" / "So meldet es die VM. Die App konnte den Kopf …" | `rows.stopSealed`, `notes.headerOpens` / `headerRefused` / `headerUnchecked` | values Verfahren, Empfänger (öffentlich) [copy], Schlüssel ("aus deinem Tresor abgeleitet; …" / "in deinem Tresor gespeichert (…)"); links "Spezifikation age v1", "Selbst prüfen: mit dem Schlüssel und age entschlüsseln" | both | T |
| B-186 | EV:45-47 | stop rows stopCopy (one per copy) | row | "Kopie" — "Eine Kopie bei einem Speicheranbieter in dessen Datensatz (Filecoin Warm Storage, PDP), …" | `rows.stopCopy` | values Anbieter, Standort, Datensatz, Stück im Datensatz; link "Beim Anbieter abrufen (nur Chiffrat)" | both | T |
| B-187 | EV:45-47 | stop row stopForget | row | "VM gelöscht" — "Die FORGET-Nachricht, von deiner App signiert und von Aleph angenommen: Die VM wird …" | `rows.stopForget` | value FORGET-Nachricht; link "FORGET-Nachricht" | both | T (S: "Maschine gelöscht") |
| B-188 | EV:50 | value with `copy` flag | button | "Kopieren" → "Kopiert" | `evidenceTexts.copy` / `copied` | clipboard; full value in `title` tooltip, shortened 12…8 | both | T |
| B-189 | EV:53 | row has links | external links | (labels listed per row above) | `evidenceTexts.links.*` | new tab, noopener | both | T |

### 2.6 TrialRestore.svelte ("Sicherung prüfen")

| ID | file:line | State / condition | Type | German text | i18n key | What it does | Shown | Audience |
|---|---|---|---|---|---|---|---|---|
| B-190 | TR:73 | always | section label | "Sicherung prüfen" | `life.trial.label` | – | Ü | both |
| B-191 | TR:75 | no trial | hint | "Startet eine zweite Paperless-ngx-Instanz aus der neuesten Sicherung, neben der laufenden: ohne Mail-Abruf, …" | `life.trial.hint` | – | Ü | both |
| B-192 | TR:76 | no trial | button | "Probe aus der neuesten Sicherung starten" | `life.trial.start` | `start()` → confirm → `listBackups` → `startTrial` → `updateProfile(trial)` | Ü | T (S optional, costs money) |
| B-193 | TR:23 | on start | native `confirm` | "Eine zweite Paperless-ngx-Instanz mit der neuesten Sicherung starten? Sie läuft neben der jetzigen, …" | `life.trial.startConfirm` | – | Ü | both |
| B-194 | TR:78 | trial requested, no host | hint | "Die Probe-VM wurde angefordert, ist aber nicht fertig gestartet (Start unterbrochen)." | `life.trial.requested`, `requestedInterrupted` | no resume, only end | Ü | both |
| B-195 | TR:79 | same, not busy | button | "Probe beenden" | `life.trial.end` | `end()` | Ü | both |
| B-196 | TR:81 | trial running | status text | "Probe läuft, aus Sicherung `…{12 Zeichen}`: **wiederhergestellt, {n} Dokumente**" / "**Wiederherstellung fehlgeschlagen ({Grund})**" | `life.trial.running`, `restored`, `documents`, `restoreFailed` | – | Ü | both |
| B-197 | TR:82 | trial running | link | "Probe öffnen" | `life.trial.open` | `https://{trial.host}/` new tab | Ü | both |
| B-198 | TR:83 | trial running | hint + link-button | "Anmeldung wie bei deiner Paperless-ngx-Instanz: `admin`, Passwort [anzeigen]" | `life.trial.login`, `password`, `show` | reveals password (no hide, no copy) | Ü | both |
| B-199 | TR:84 | trial running | button | "Probe beenden (ohne Sicherung)" | `life.trial.endNoBackup` | `end()` → confirm → `endTrial` → profile.trial removed | Ü | both |
| B-200 | TR:53 | on end | native `confirm` | "Die Probe beenden? Die zweite VM wird ohne Sicherung gelöscht; was du dort geändert …" | `life.trial.endConfirm` | – | Ü | both |
| B-201 | TR:86 | busy | status hint | "{Schritt} …" ("Sicherungen lesen", start step texts from `life.progress.*`, "Probe-VM löschen") | `life.trial.readingBackups`, `removing` | – | Ü | both |
| B-202 | TR:87 | error | alert | e.g. "Es ist nicht eingerichtet, wo die Sicherungen liegen." / "Es gibt noch keine Sicherung mit dem Siegel deines Tresors zum Prüfen. …" / any start error | `life.trial.noListing`, `noBackup` | no retry button other than start again | Ü | both |

### 2.7 ImageCertificate.svelte ("Urkunde", mounted by FirstStart.svelte:118) and VmList.svelte, ProviderHealth.svelte

| ID | file:line | State / condition | Type | German text | i18n key | What it does | Shown | Audience |
|---|---|---|---|---|---|---|---|---|
| B-203 | IC:22 | certificate open | kicker | "Urkunde · Paperless anywhere" | `first.cert.kicker` | – | both (via FirstStart; opener button only in E, B-099) | both |
| B-204 | IC:23 | – | heading h2 | "Dein eigenes Paperless-Image" | `first.cert.title` | – | both | both |
| B-205 | IC:25-27 | – | decorative seal (lock icon SVG) | – | – | – | both | both |
| B-206 | IC:29 | – | lead text | "Dieses Image wurde nur für deinen Tresor versiegelt. Jeder Schritt ist öffentlich nachprüfbar – …" | `first.cert.lead` | – | both | both |
| B-207 | IC:31 | – | dt/dd | "Gebaut am — {1. November 2026}" | `first.cert.builtAt` | – | both | both |
| B-208 | IC:32 | – | dt/dd (green) | "Passphrase — nur in deinem Tresor" | `first.cert.passphrase`, `onlyVault` | – | both | both |
| B-209 | IC:33 | – | dt/dd, link if store known | "Ausgangs-Image (SHA-256) — `abcd1234 … 89abcdef`" | `first.cert.plain` | link to `ALEPH_MESSAGE/{plain.store}` | both | T |
| B-210 | IC:34 | builder measurement known | dt/dd, link | "Build-Dienst (von AMD bestätigt) — `{Messwert kurz}`" | `first.cert.builder` | link to the builder's V-PROGRAM message | both | T |
| B-211 | IC:35 | – | dt/dd link | "Dein Image bei Aleph (STORE) — `{hash kurz}`" | `first.cert.store` | link to STORE message | both | T |
| B-212 | IC:36 | commit known | dt/dd link | "Gebaut aus dem Quelltext-Stand — `{7 Zeichen}`" | `first.cert.commit` | GitHub commit link | both | T |
| B-213 | IC:40 | – | CTA button | "Als PDF speichern" | `first.cert.print` | `window.print()` (print CSS shows only the card) | both | both |
| B-214 | IC:41 | `onback` | link-button | "Zurück" | `first.cert.back` | `onback()` → FirstStart `oncertificate(false)` | both | both |
| B-215 | VL:127 | always (inside folded "tech-vms") | heading h2 | "Meine VMs" | `life.vms.title` | – | E | T |
| B-216 | VL:127 | always | button | "Aktualisieren" | `life.vms.refresh` | `load()` → `listVms`, then per VM `hostname`, `vmStatus`, `crnAddress`, `nodeState` | E | T |
| B-217 | VL:129 | list not read yet | hint | "lese …" | `life.vms.reading` | – | E | T |
| B-218 | VL:131 | empty list | hint | "Keine VM läuft." | `life.vms.none` | – | E | both |
| B-219 | VL:134 | VMs not known as started | warning | "Es laufen VMs, die nicht als gestartet bekannt sind (z. B. ein abgebrochener Start oder …" | `life.vms.stray` | this cost warning is invisible in Übersicht | E | both (S must see "etwas läuft und kostet") |
| B-220 | VL:139 | per VM | name (bold) | `{vm.name}` | – | – | E | T |
| B-221 | VL:140 | per VM | state tag | "(gestartet)" / "(startet gerade)" / "(Start unterbrochen)" | `life.vms.started`, `startingNow`, `interrupted` | – | E | T |
| B-222 | VL:141 | per VM | detail line | "seit {Datum} · kostet ca. {n} Credits/h · {Phase}" where phase = VM status phase (raw English token) or "wird gestoppt", "auf dem Knoten: {state}", "nicht erreichbar", "ohne Adresse", "prüfe …" | `life.vms.since`, `costs`, `phases.*`, `checking` | – | E | T |
| B-223 | VL:142 | VM answers as Paperless | link | `{vm.host}` | – | opens `https://{host}/` | E | T |
| B-224 | VL:143 | per VM | code | `{12 Zeichen itemHash}` | – | – | E | T |
| B-225 | VL:145 | no running VM known and not the one starting in this tab | button | "Übernehmen" | `life.vms.adopt` | `adopt(vm)` → confirm → `ownInstance`, `pinsOf`, `publicAddress`/`hostname`, `vmStatus` → profile.running set | E | T |
| B-226 | VL:94 | on adopt | native `confirm` | "{Name} als laufende Instanz übernehmen? Danach geht „Sichern und beenden“ wieder." | `life.vms.adoptConfirm` | – | E | T |
| B-227 | VL:147 | per VM | button | "Löschen" | `life.vms.remove` | `remove(vm)` → confirm → `eraseOnNode`, `forgetInstance`, `revokeBackupKey`, profile cleanup | E | T (S needs a safe equivalent for leftovers) |
| B-228 | VL:57-60 | on remove | native `confirm` | "{Name} löschen, ohne letzte Sicherung? (Zum Sichern oben „Sichern und beenden“.)" / "{Name} löschen? Die VM wird gestoppt und kostet danach nichts mehr." | `life.vms.removeRunning` / `removeOther` | – | E | both |
| B-229 | VL:152 | notice | hint | e.g. "VM gelöscht; den Schlüssel der VM für die Sicherungen nimmt die App beim nächsten Öffnen zurück ({Grund})" | `life.progress.revokeLater` | – | E | T |
| B-230 | VL:153 | error | alert | "Die VM nennt keinen Knoten." / "Die VM hat noch keine Adresse (2n6)." / "Die VM antwortet nicht als Paperless-ngx (noch kein Zertifikat oder nicht entsperrt)." / "Es ist schon eine Instanz als laufend bekannt." / "Aleph: VM-Liste nicht lesbar ({status})" / "Aleph: VM {hash} nicht lesbar ({status})" / "Keine INSTANCE mit diesem Hash." / "Der Inhalt der INSTANCE passt nicht zu ihrem Hash." / "Diese VM hat nicht der Schlüssel dieser App gestartet." | `life.vms.noNode`, `noAddressYet`, `notPaperless`, `alreadyRunning`, `life.vm.listUnreadable`, `vmUnreadable`, `noInstance`, `contentMismatch`, `notOurs` | – | E | T |
| B-231 | PH:30 | ids given (inside the error-log details) | title + link-button | "Speicheranbieter jetzt" [neu prüfen] | `backup.health.title`, `again` | `check()` → `providerHealth(network, ids)` | both (inside B-065 / B-105) | T |
| B-232 | PH:31 | list failed | hint | "Die Anbieterliste ließ sich gerade nicht lesen." | `backup.health.listUnreadable` | – | both | T |
| B-233 | PH:32 | loading | hint | "Anbieter werden gefragt …" | `backup.health.asking` | – | both | T |
| B-234 | PH:37 | per provider | status dot (green ok / grey) | – | – | – | both | both |
| B-235 | PH:38-39 | per provider | text | "Anbieter {id} · {Name} ({Ort}): antwortet ({ms} ms)" / "antwortet mit Fehler {status}" / "antwortet nicht" | `backup.health.provider`, `answers`, `answersError`, `silent` | – | both | T |
| B-236 | PH:40 | per provider | external link | "im Explorer" | `backup.health.explorer` | new tab | both | T |
| B-237 | PH:44 | list shown | hint | "„Antwortet“ heißt erreichbar; ob ein Anbieter Daten annimmt, zeigt erst die nächste Sicherung." | `backup.health.hint` | – | both | T |

### 2.8 HourQuote.svelte (purchase confirmation inside the fund offer)

| ID | file:line | State / condition | Type | German text | i18n key | What it does | Shown | Audience |
|---|---|---|---|---|---|---|---|---|
| B-238 | HQ:18-19 | `short` (balance too low) | alert title | "Das Guthaben reicht nicht für {n} Stunden." | `buy.quote.short` | – | both | both |
| B-239 | HQ:20 | short | hint | "Erst Guthaben aufladen, unter „Aufladen, Stunden dazukaufen, Paket ändern“, dann noch einmal kaufen." | `card.fund.topUpHint` (prop) | names a section of the Package card | both | both |
| B-240 | HQ:21 | short | secondary button | "Schließen" | `buy.quote.close` | `oncancel` → `purchase.cancel()` | both | both |
| B-241 | HQ:24-25 | quote open | group (aria-label "Kauf bestätigen") + title | "{n} Stunden kaufen?" | `buy.quote.label`, `title` | – | both | both |
| B-242 | HQ:27 | quote | dt/dd | "Bezahlt aus — deinem Le-Space-Credits-Guthaben" | `buy.quote.paidFrom`, `fromBalance` | – | both | both |
| B-243 | HQ:28 | quote | dt/dd | "Kosten — {n} Credits (≈ {x} €)" | `buy.quote.cost`, `credits` | – | both | both (S: euros only) |
| B-244 | HQ:30 | before/after known | dt/dd | "Guthaben — {x} € → {y} €" | `buy.quote.balance` | – | both | both |
| B-245 | HQ:33 | hours known | dt/dd | "VM-Stunden — {a} h → {b} h, nutzbar bis {Tag}" | `buy.quote.vmHours`, `usableUntil` | – | both | both |
| B-246 | HQ:35 | only expiry known | dt/dd | "Nutzbar bis — {Tag}" | `buy.quote.usableUntilLabel` | – | both | both |
| B-247 | HQ:39 | quote | button | "Kaufen und starten" (prop `confirmLabel`) | `card.fund.buyAndStart` | `onconfirm` → `purchase.confirm()` → `fundAndStart` (the only thing that buys) | both | both |
| B-248 | HQ:40 | quote | secondary button | "Abbrechen" | `buy.quote.cancel` | `oncancel` | both | both |

### 2.9 Raw progress texts (Erweitert line B-103 "{text} …"; the first-start overlay receives the build ones; TrialRestore shows the start ones)

| ID | source | When | German text | i18n key | Audience |
|---|---|---|---|---|---|
| B-249 | L:399, 680 | switching payer | "Le Space bezahlt die VM jetzt aus deinem Paket" | `card.progress.packagePays` | both |
| B-250 | L:493 | before start with package | "Le Space Credits: Freigabe für die VM holen" | `card.progress.authorize` | T |
| B-251 | L:654 | purchase | "Le Space Credits: Stunden kaufen" | `card.progress.buyHours` | both |
| B-252 | L:663 | after purchase | "Warte, bis Aleph die Gutschrift zeigt" | `card.progress.waitCredit` | T |
| B-253 | L:719 | resume | "Sicherungen nachsehen" | `card.progress.lookBackups` | both |
| B-254 | L:938 | keep VM after partial | "Paperless-ngx wieder starten" | `card.progress.restart` | both |
| B-255 | L:610 | node choice | "Freien vertraulichen Knoten suchen" / "Anderen vertraulichen Knoten suchen" | `card.progress.pickNode` / `otherNode` | T |
| B-256 | L:530, 544 | own-image build | "Eigenes Image bauen (etwa 15 Minuten, Fenster offen lassen): {Schritt}" with steps "Build-Dienst starten (einige Minuten)", "Build-Dienst prüfen (AMD)", "Image wird versiegelt", "Versiegeltes Image holen ({n} %)", "Speicher-Nachricht signieren", "Image zu Aleph hochladen ({n} MiB)", "Auf Aleph warten" | `card.progress.buildImage`, `ownImage.step.*` | both (S: one sentence + percent) |
| B-257 | L:865 | accepting places | "Neue Sicherungsorte gehen an die VM" | `card.places.pushing` | T |
| B-258 | L:931 | period end | "Letzte Sicherung vor dem Ende auf der Chain prüfen" | `card.periodEnd.confirming` | T |
| B-259 | lifecycle.js (via `track`) | start steps | "Prüfe, ob die Kopien deiner Sicherung ausliefern"; "Messwerte für diesen Start berechnen"; "VM anfordern"; "VM bei Aleph nachsehen"; "Port 443 und Adresse"; "VM prüfen (AMD) und entsperren"; "schon entsperrt"; "entsperrt"; "Paperless startet"; "Paperless startet ({phase})"; "Noch keine Antwort der VM: Passphrase erneut übergeben"; "Erneute Übergabe fehlgeschlagen: {Grund}" | `life.progress.checkCopies`, `measure`, `request`, `lookUp`, `network`, `unlock`, `alreadyUnlocked`, `unlocked`, `starting`, `startingPhase`, `passphraseAgain`, `passphraseAgainFailed` | T |
| B-260 | lifecycle.js | start on public image | "Öffentliches Image: ohne feste Adresse (das DNS-Token geht nur an dein eigenes Image)"; "Öffentliches Image: ohne Sicherungen (deren Schlüssel gehen nur an dein eigenes Image)"; "Ohne Sicherungen: {Grund}" | `life.progress.publicNoFixed`, `publicNoBackups`, `withoutBackups` | T; flashes by, an important consequence a user can miss |
| B-261 | lifecycle.js | stop steps | "Stopp anfordern (letzte Sicherung)"; "Neue Sicherung auf der Blockchain prüfen"; "VM löschen"; "VM gelöscht; den Schlüssel der VM für die Sicherungen nimmt die App beim nächsten Öffnen zurück ({Grund})" | `life.progress.stop`, `confirmBackup`, `forget`, `revokeLater` | T |
| B-262 | vm.js | helper steps | "Knotenliste lesen"; "Guthaben abfragen"; "VM-Liste lesen"; "VM nachsehen" | `life.vm.readNodes`, `readBalance`, `readList`, `lookUp` | T |

### 2.10 Error texts that land in the error box (B-125) — one row each

| ID | source | German text | i18n key | Next action offered today | Audience |
|---|---|---|---|---|---|
| B-263 | lifecycle.js | "Die letzte Sicherung ist fehlgeschlagen; die VM bleibt. Grund: {…}" | `life.errors.backupFailed` | log details + ProviderHealth; stop again | both |
| B-264 | lifecycle.js | "Für den Start fehlt: {…}" | `life.errors.startMissing` | none (setup) | both |
| B-265 | lifecycle.js | "Es ist noch kein Konto bekannt, das die VM bezahlt." | `life.errors.noPayer` | none | both |
| B-266 | lifecycle.js (AlephShortError) | "Für einen Start fehlen noch {n} Aleph-Credits auf {dem Konto, mit dem Le Space deine VM bezahlt / der Adresse der App / deiner Wallet}. Aleph nimmt die VM erst mit einem Tag Reserve an: …" | `life.errors.alephShort`, `alephShortRunning`, `payerAccount.*` | fund offer (B-129…B-134) if Credits service configured, else none | both (S: "Guthaben reicht nicht") |
| B-267 | lifecycle.js | "Es gibt keinen unterbrochenen Start." | `life.errors.noInterruptedStart` | none | T |
| B-268 | lifecycle.js | "Die VM {hash} gibt es bei Aleph nicht mehr ({status})." | `life.errors.vmGone` | none | T |
| B-269 | lifecycle.js | "Für diese VM sind keine Sicherungen eingerichtet." | `life.errors.noBackupConfig` | none | both |
| B-270 | lifecycle.js | "Sicherungsorte gehen nur an eine VM mit deinem eigenen Image." | `life.errors.placesNeedOwnImage` | none | T |
| B-271 | lifecycle.js | "Gerade liefert keine der {n} Kopien deiner Sicherung aus (ihre Anbieter antworten nicht). Darum wird keine VM angefordert: …" | `life.errors.copiesUnreachable` | "Noch einmal" if retryable | both |
| B-272 | lifecycle.js | "Eine Sicherung wird nur in dein eigenes Image wiederhergestellt. Baue zuerst dein eigenes Image (Einrichtung, Schritt Image) oder starte ohne Sicherung." | `life.errors.restoreNeedsOwnImage` | none in Übersicht (no choice control there) | both |
| B-273 | lifecycle.js | "Die VM konnte ihre verschlüsselte Datenplatte nicht anlegen ({Grund}); Paperless startet darauf nicht. Die VM unter „Meine VMs“ löschen und neu starten." | `life.errors.dataDiskFailed`, `noReason` ("ohne Angabe") | manual: VmList in Erweitert | both |
| B-274 | lifecycle.js | "Es läuft keine VM." | `life.errors.noVm` | none | T |
| B-275 | lifecycle.js | "Die Prüfung hat kein Ergebnis geliefert." | `life.errors.noAttestation` | re-check | T |
| B-276 | lifecycle.js | "Diese VM kennt „Jetzt sichern“ noch nicht (älteres Image)." | `life.errors.noBackupNow` | none | both |
| B-277 | lifecycle.js | backup mode words "unterbrochen", "Paperless wird gerade gesichert und beendet" | `life.errors.backupModes.*` | – | both |
| B-278 | lifecycle.js | "Die VM wartet auf keine Antwort mehr; bitte die Seite neu laden." | `life.errors.noPendingAnswer` | reload page | both |
| B-279 | lifecycle.js | "Die Sicherung, die die VM meldet, ist auf der Blockchain nicht als neue Sicherung zu finden. Die VM wird deshalb nicht gelöscht. Später noch einmal versuchen." | `life.errors.backupUnconfirmed` | stop again later (VM keeps costing) | both |
| B-280 | lifecycle.js | "Ohne den Schlüssel der Sicherungen lässt sich keine Sicherung prüfen." | `life.errors.noBackupKey` | none | T |
| B-281 | L:501 | "Aleph zeigt die Freigabe von Le Space noch nicht. In ein paar Minuten noch einmal starten." | `card.errors.noDelegation` | start again | both |
| B-282 | lifecycle.js pickNode | "Gerade hat kein vertraulicher Knoten Platz für deine VM. In ein paar Minuten noch einmal starten." | `card.errors.noNode` | start again | both |
| B-283 | L:637 | "Der im Setup festgelegte Knoten hat die VM abgelehnt. Leere im Setup das Feld „SEV-SNP-Knoten“, dann wählt die App einen anderen." | `card.errors.fixedNodeRefused` | manual in setup | T |
| B-284 | L:511 | "Der Start wartet auf deine Bestätigung: die letzte bekannte Sicherung würde nicht eingespielt." | `card.errors.gapOpen` | checkbox B-144 | both |
| B-285 | L:512 | "Der Start wartet auf deine Bestätigung: die gewählte Sicherung trägt nicht das Siegel deines Tresors." | `card.errors.unmarkedOpen` | checkbox B-141 | both |
| B-286 | L:675 | "Die Gutschrift ist bei Aleph noch nicht zu sehen. In ein paar Minuten noch einmal starten – nicht noch einmal kaufen, sonst werden die Stunden doppelt gekauft." | `card.errors.creditNotSeen` | start again (the buy button is still offered next to it) | both |
| B-287 | L:567 | "Ein Image lässt sich bauen, wenn Paperless gestoppt ist." | `first.whileRunning` | stop first | both |
| B-288 | L:583 | "Gerade läuft schon etwas in der Paperless-Karte. Bitte kurz warten und dann noch einmal." | `first.busy` | wait | both |
| B-289 | L:933 | "Die VM hat sich am Ende der Laufzeit angehalten, aber ohne Sicherungen kann die App nichts prüfen. Lösche sie selbst in der VM-Liste unter „Technisch“." | `card.periodEnd.noBackups` | manual: VmList | both |
| B-290 | L:792 | "Die Sicherungen ließen sich gerade nicht lesen." | `card.backupsUnreadable` | "Noch einmal" on stop | both |
| B-291 | own-image.js | build errors (22): "Der Build-Dienst ist in dieser App nicht festgelegt."; "Aleph hat den Build-Dienst nicht angenommen ({status}). Reicht das Guthaben der App-Adresse?"; "Das Ausgangs-Image ist in dieser App nicht festgelegt."; "Der Build-Dienst hat keine gültige Adresse für das Image genannt."; "… nennt keine gültige Größe …"; "Der Build-Dienst baut gerade ein anderes Image. …"; "Der gestartete Build-Dienst war schon vergeben. …"; "… hat den Auftrag nicht angenommen (…)"; "… kennt den Auftrag nicht mehr (…)"; "Der Bau ist fehlgeschlagen: …"; "Der Bau hat zu lange gedauert."; "Die Verbindung zum Build-Dienst ist abgebrochen. …"; "Der Build-Dienst hat das Image nicht mehr ({status}). Bitte noch einmal bauen."; "… hat ein Stück des Images nicht geliefert (…)"; "Das Hochladen zu Aleph ist dreimal abgebrochen (…). Das versiegelte Image bleibt in diesem Fenster erhalten: … Bitte die Seite nicht neu laden."; "Aleph hat das Image nicht angenommen ({status}). …"; "Aleph hat ein anderes Image gespeichert als das versiegelte."; "Aleph hat das Image nicht angenommen. Reicht das Guthaben …"; "Aleph hat das Image noch nicht bestätigt. …"; "Es ist kein Relay bekannt, der den Build-Dienst erreicht."; "Der Build-Dienst ist gerade nicht erreichbar. … ({Grund})" | `ownImage.error.*` (`noBuilder`, `builderRefused`, `noPlain`, `badCid`, `badSize`, `busy`, `claimed`, `notAccepted`, `jobUnknown`, `buildFailed`, `buildSlow`, `dropped`, `imageGone`, `pieceMissing`, `uploadBroken`, `uploadRefused`, `otherImage`, `storeRejected`, `storePending`, `noRelay`, `unreachable`) | start again (FirstStart shows "Kurz innegehalten"); "Noch einmal" only when `retryable` | both (S: one sentence + "Noch einmal") |

(Own-image catalogue keys `intro`, `sourcesFold`, `sourcesHint`, `sources.*`, `have`, `oldPending`, `oldRemove`, `tip`, `build`, `rebuild`, `whileRunning`, `choice.*`, `checkStore`, `fields.*` belong to the Setup block "Mein Image bauen", not to this slice's components; only `overview.*`, `previousStart`, `previousHint`, `step.*`, `error.*`, `choice.confirmPrice`/`confirmIncluded` surface here. `card.simple.stopNoProvider` and `card.simple.stopAnyway` exist in the catalogue but are not referenced by Lifecycle.svelte any more: dead keys. `ownImage.overview.buildsAtStart` is also unused here: Übersicht uses `card.simple.firstBuild` instead.)

---

## 3. Lists

### 3.1 Duplicates / overlaps

- **Whole card twice**: Lifecycle has two full templates (L1154-1252, L1254-1368); notes, error box, partial box, places box, fund offer, previous-image, unpaid/gap/unmarked warnings are copy-pasted in both, with small divergences (below).
- **Open Paperless**: CTA (B-071) and host link (B-072) directly under each other in Erweitert; host again in Evidence "Knoten → Adresse", in "Auf einen Blick" (page), and in VmList row link (B-223).
- **Login/password**: Übersicht box (B-032…036), Erweitert line (B-077…079), TrialRestore line (B-198) — three renderings of the same derived admin password, each with different controls (TR has no hide/copy).
- **Last backup**: "Letzte erfolgreiche Sicherung" line (B-022, Ü), Evidence row "Sicherungen" (B-183), "Letzte Sicherung" details card (B-106, E), stop panel rows + stop Evidence "Letzte Sicherung"/"Kopie" (B-184, B-186), page-level "Auf einen Blick → Sicherungen", header LEDs, BackupChain. At least six places.
- **Start progress**: meter + "noch etwa N min" (B-026/027), StartPanel rows (B-150…), raw progress line (B-103), FirstStart overlay stations (during a first start all at once), StartPanel total (B-167). Step naming differs in each: `card.steps` (5), `panelTexts.rows` (7), `life.progress` (12), FirstStart stations (6).
- **Attestation facts**: StartPanel row "Attestierung" during start, Evidence row "Attestierung" afterwards, certificate "Build-Dienst (von AMD bestätigt)".
- **Stop facts**: stop panel and "Nachweis: Sicherung und Löschen" show the same Piece-CID, providers, data sets, FORGET; Erweitert adds the "Letzte Sicherung" card with the same again.
- **Provider reachability**: `stopReachBad` warning (B-041) refers to header LEDs; pre-stop check + places box (B-116); ProviderHealth list (B-231…); BackupChain.
- **Interrupted start**: Lifecycle box (B-093…095) and VmList row "(Start unterbrochen)" with "Übernehmen"/"Löschen" (B-221, B-225, B-227) — two ways to deal with the same VM, with different consequences.
- **Delete a VM**: "Sichern und beenden", "Löschen ohne Sicherung" (restore failed), "VM trotzdem löschen" (partial), VmList "Löschen", TrialRestore "Probe beenden" — five delete paths.
- **Image info**: Übersicht image line (B-016…021), Evidence row "Image", certificate, Setup "Mein Image bauen" block (other slice); rebuild trigger in the image line and in the setup.
- **Restore choice**: Übersicht sentence "Startet mit der neuesten Sicherung …" (B-053) vs Erweitert radio group (B-084…089); the choice made in Erweitert silently drives the Übersicht start (shared `choice` state) but Übersicht cannot change it.
- **Missing setup**: Übersicht hint + button (B-048/049), Erweitert "Es fehlt noch" (B-098), page chip on the Setup fold ("fehlt"), `life.errors.startMissing`.
- **Divergences between the two copies** (bugs to settle in the redesign): fund offer condition (Ü: appPays or leSpacePays; E: appPays only); Start disabled on `backupsPending`/`backupsError` only in Ü; stop disabled on `backingUp` only in Ü; error log `<details>` closed in Ü, open in E, with different summaries; BackupNow/Storage/TrialRestore/image line/last-good line only in Ü; certificate button, role line, BackupExport, data-disk note, last-backup card only in E.

### 3.2 Jargon visible to a lay person in the default view ("Übersicht")

Always or in normal flows: **Paperless-ngx**, **Image** / "eigenes Image" / "öffentliches Image" / "Image-Version", **VM**, **Maschine**, host name string (`….2n6.me`/port), **Kopien**, **Filecoin**, **Speicheranbieter / Anbieter {id}**, **Sicherung {…12 Zeichen CID}**, **Siegel deines Tresors**, **Tresor**, **Le Space Credits**, **Paket**, **Aleph / Aleph-Credits**, **Credits/h**, **Reserve**.
During every start (StartPanel is shown in Übersicht): **Messwerte**, **Instanz**, **INSTANCE-Nachricht**, **Knoten**, **Port 443**, **Attestierung**, **AMD**, **Policy**, **TLS-Schlüssel**, **Zufallswert**, **Passphrase**, **Geheimnisse**, **Container**, **Zertifikat**, **Datenbereich versiegelt**, **Laufzeit von Aleph**, "von der Hardware bestätigt", "(üblich ca. …)". Progress sentence: "Messwerte berechnen", "VM anfordern und platzieren", "VM prüfen (AMD) und entsperren".
During every stop: **Stopp-Auftrag signiert**, **Export**, **Archiv**, **age (X25519, ChaCha20-Poly1305)**, **Sicherungsschlüssel**, **Kopf der Sicherung**, **Datensatz**, **Piece-CID**, **Stück**, **FORGET**, **widerrufen**.
Evidence summary line (folded but visible): "Nachweis dieser VM", "von der App geprüft · gemeldet · außerhalb der Hardware-Prüfung"; opened: **Firmware, Kernel, Initrd, Startzeile, SHA-256, Relay, STORE-Hash, LUKS2, aes-xts-plain64, Chiffrat, PDP, Filecoin Warm Storage, MAC**.
In notes and errors: **vertraulicher Knoten**, **SEV-SNP-Knoten**, **Chain / Blockchain**, **Freigabe**, **Gutschrift**, **Build-Dienst**, **V-PROGRAM**, **STORE**, **Betreiber**, **FIDL (Cello, Bass)**, **Mainnet / Testnetz / Calibration**, **Mail-Regeln**, **Administrator / Superuser**, **Probe-VM**, **Rechenzeit**, **MiB**, **DNS-Token**.
Cross-references a lay person cannot follow: "unten unter „Meine VMs“" (not on this tab), "Details unter „Erweitert“", "VM-Liste unter „Technisch“", "siehe Licht „Sicherungen erreichbar“ oben", "unter „Aufladen, Stunden dazukaufen, Paket ändern“", "Einrichtung, Schritt Image", "Feld „SEV-SNP-Knoten“ im Setup".

### 3.3 Dead ends / unclear next step

1. **loading** in Übersicht: only "Einen Moment …"; if `reload()` throws (L376) an error appears with no retry (the only re-trigger is a `version` change or page reload).
2. **Backups unreadable** in Übersicht (B-052): Start disabled, text says "Bitte gleich noch einmal versuchen" but there is no button; `listBackups` is only re-run by `reload()` (version change / start / stop). In Erweitert the Start stays enabled and would start with `choice='empty'`… guarded only by the gap check.
3. **Interrupted start → "Verwerfen"** in Übersicht (B-047): the VM keeps running and costing; the label sends the user to "Meine VMs unten", which exists only in Erweitert → Technisch → folded "VMs". After discarding, Übersicht shows a normal "aus" with no hint that something still costs money.
4. **Stray VMs** (B-219): the cost warning lives only inside the folded VmList in Erweitert; nothing in Übersicht signals it.
5. **Declined price confirm** (B-002): the start just ends silently, no message.
6. **`restoreNeedsOwnImage`, `fixedNodeRefused`, `dataDiskFailed`, `periodEnd.noBackups`, `startMissing`**: the error text describes a manual fix in another tab/section, no button to get there.
7. **`backupUnconfirmed` / `backupFailed` on stop**: VM stays and costs; only option is pressing "Sichern und beenden" again (or VmList delete in Erweitert); no explicit "trotzdem löschen" except in the `partial` case.
8. **`creditNotSeen`**: says "nicht noch einmal kaufen" while the "Kaufen und starten" control stays visible (since `short` is cleared by `run()`, the offer normally disappears; the Start button reappears without telling when to press it).
9. **Trial requested but not finished** (B-194): no "fortsetzen", only "Probe beenden"; a leftover trial while Paperless is off is visible only in Übersicht (L1232), not in Erweitert.
10. **Partial question**: both buttons are consequential with no neutral option; if the chosen action fails, the question returns (intended), but the error text sits below it.
11. **Places box "Abbrechen"/"Später"**: closes and nothing else happens; the blocked-provider prompt is offered only once per visit (`blockedOffered`), so "Später" hides it until reload.
12. **`unpaidBackup` → "Erst die Sicherung buchen"**: only scrolls to `#paket`; the start is not resumed afterwards.
13. **Running + restore failed**: stop button is replaced by "Löschen ohne Sicherung"; BackupNow hidden; the Übersicht text refers to "Erweitert" for the reason.
14. **Discarding** uses the stopping subtitle "Erst die Sicherung, dann geht die Maschine aus" (B-013) although no backup happens.
15. **Copy buttons** (password) give no feedback; clipboard failures are silent.
16. **Certificate**: after the first-start "done" screen is closed, it can be reopened only from Erweitert while Paperless is off (B-099); not at all while running or from Übersicht.
17. **Erweitert while running**: no "Jetzt sichern", no storage, no trial restore — a technical user must switch back to Übersicht for these.
18. **`periodEnded` note** stays after the erase succeeded (never cleared within the session), and equally after it failed.
19. **Rebuild not possible while running** (B-019): tells the user to stop first; the full procedure text (`ownImage.whileRunning`) is only in the Setup.

### 3.4 Persistence from the UI layer

Browser storage (none of the slice's components write browser storage directly):
- `localStorage['paperless-anywhere.tab']` = `'simple' | 'advanced'` — `routes/app/+page.svelte:194-208`; decides which Lifecycle template shows. Written only when a tab is clicked.
- `localStorage['paperless-anywhere.backup-copies']` = `{ network, providerIds[], at }` — `lib/backup-status.js:21-41`, fed by Lifecycle's `oncopies` event → page `newestCopies` (provider ids of the newest backup, for the header LEDs before unlock).
- `localStorage['paperless-lang']` = `'de' | 'en'` — `lib/i18n/index.js:27`; all texts in this slice follow it.
- `localStorage['paperless-anywhere.vault']` — `lib/keys/vault.js:12` (the sealed vault; other slice).
- No `sessionStorage` and no IndexedDB use anywhere in this slice.

In-memory only (lost on reload): `ceremony` (first-start screen), `times`/panel lights, `stopDone` (stop evidence), `choice`, `gapAccepted`, `unmarkedAccepted`, `showPassword`, `fundHours`, `bought`, `placesAsk`, `blockedOffered`, `periodEnded`; the store `startingInstance` (`lib/starting.js`, shared between Lifecycle and VmList); the sealed image kept "in diesem Fenster" during a failed upload (own-image build).

Sealed profile (remote, an Aleph aggregate via `profile.js` `loadProfile`/`updateProfile`; survives devices) — fields this UI layer writes: `running` (incl. `rootfsItemHash`, `attestation`, `restore`, `dataDisk`), `starting` (`instanceHash`, `crnHash`, `payer`, `restoreEntry`, `at`), `trial` (`…starting`, `backup`, `host`, `restore`, `readyAt`), `lastGoodBackup {at, copies, requested, pieceCid}`, `lastBackup`, `ownBackups[]` (max 50), `vaultBackups` (via `noteVaultBackups`), `appPays`/`leSpacePays`/`vmOwner`, `backupConfig.providerIds`/`copies`, `ownImage`/`ownBuilder`/`rootfsItemHash`/`luksPassphrase` (build patches), `oldOwnImages`, `unsuitableNodes`/proven nodes (`noteUnsuitable`, `noteProven`), `backupRevokePending` (read). Also `diagnosis.js` `noteState`/`noteError` (in-memory notes for "Diagnose kopieren").

### 3.5 Components: props, events, logic-module calls

**Lifecycle.svelte**
- Props: `master: Uint8Array`, `simple?: boolean`, `version?: number` (bump → reload), `reach?: 'unknown'|'ok'|'bad'…` (header LED level).
- Events (callback props): `onchange()` (profile saved → page bumps `profileVersion`), `onadvanced()` (open setup in Erweitert), `onmissing(string[])`, `onglance({ phase, host, lastGood, backupsOn, pays, fixedHost })`, `onbusy(boolean)` (page asks before unload), `oncopies({ network, copies[] })`.
- Exported type: `Glance`.
- Child components: FirstStart, StartPanel, Evidence, TrialRestore, ProviderHealth, HourQuote, BackupNow, BackupExport, BackupChain, Storage, RefreshBalances.
- Logic calls:
  - `lifecycle.js`: `startPaperless`, `resumeStart`, `startElsewhere`, `pickNode`, `startRequirements`, `buildsImageFirst`, `stopPaperless`, `eraseStopped`, `confirmStopBackup`, `confirmPeriodEndBackup`, `resumeAfterPartial`, `pushBackupPlaces`, `attestRunning`, `syncPeriodEnd`, `noteVaultBackups`, `retryBackupRevoke`; error classes `AlephShortError`, `BackupPartialError`, `StartGoneError` (`NodeRefusedError` imported, unused).
  - `own-image.js`: `BUILDER`, `hasOwnImage`, `imageStatus`; `own-image-build.js`: `buildImageForVault`, `forgetOldImage`; `own-image-check.js`: `ownImagePatch`; `old-image.js`: `fallbackPatch`, `forgetQueued`, `forgettable`, `releasePrevious`, `startWentWell`; `image-build-request.js`: `onImageBuild`; `first-start.js`: `fetchPercent`, `stationOfBuildStep`.
  - `vm.js`: `vmStatus`, `forgetInstance`; `period-end.js`: `stoppedAtPeriodEnd`; `starting.js`: `startingInstance`.
  - `backups.js`: `listBackups`, `splitOwn`, `knownBackup`, `restoreGap`, `restoreEntry`, `newerBackup`, `pieceCidOfStop`, `backupSize`, `place` (snapshots/incremental backups come through `listBackups` → `snapshots.js`; UI reads `b.kind === 'snapshot'`, `b.gen`, `b.seq`).
  - `evidence.js`: `evidenceRows`, `stopEvidenceRows`, `httpsUrl`; `start-panel.js`: `startPanel`, `panelTimes`; `stop-panel.js`: `stopPanel`; `backup-header.js`: `checkBackupHeader`.
  - `profile.js`: `loadProfile`, `updateProfile`, `backupListing`; `credits.js`: `CREDITS_URL`, `creditsBalance`, `fundVm`, `quoteVm`, `vmAuthorize`; `purchase.js`: `hourPurchase`, `purchaseLocked`; `balances.js`: `amount`, `alephBalance`; `balance-refresh.js`: `balancesRound`, `onceThisRound`; `permissions.js`: `isAuthorized`, `readAuthorizations`.
  - `backup-status.js`: `checkCopies`; `providers.js`: `listProviders`, `providerIdsIn`; `places-replace.js`: `replacementPlan`; `blocked-providers.js`: `blockedAmong`, `blockedReason`; `blocked-nodes.js`: `avoidedNodes`, `nodeBlockedReason`, `noteProven`, `noteUnsuitable`, `provenNodes`.
  - `keys/derive.js`: `statusToken`, `alephPrivateKey`, `paperlessSecrets`; `keys/age.js`: `ageIdentityFromMaster`, `ageRecipient`; `runtime-pin.js`: `RUNTIME`; `aleph.js`: `ALEPH_API`; `attest-wasm-load.js`: `isNetworkError`, `preloadAttestWasm`; `diagnosis.js`: `noteError`, `noteState`.
  - Browser APIs: `window.confirm` (2×), `navigator.clipboard.writeText`, `document.getElementById('paket').scrollIntoView`.
- Timing constants worth keeping: `STEPS` (L71-88), `STALE_HOURS = 4` (L181).

**StartPanel.svelte** — props `rows` (from `startPanel()`/`stopPanel()`), `t` (panelTexts, merged with `.stop`), `times?: Record<rowId,string>`, `total?: string`, `testid?`. No events. Calls `start-panel.js: currentRow`.

**Evidence.svelte** — props `rows` (`evidence.js` Row[]), `t` (evidenceTexts[lang]), `sample?`, `open?`, `onagain?: () => Promise` (null hides the re-check button). Calls `evidence.js: tally`; clipboard.

**TrialRestore.svelte** — props `master`, `profile`, `listing ({owner, customer?, label?} | null)`, `onchange?()`. Calls `lifecycle.js: startTrial, endTrial`; `backups.js: listBackups, restoreEntry`; `credits.js: creditsBalance`; `profile.js: updateProfile`; `keys/derive.js: paperlessSecrets`; `confirm` (2×).

**ImageCertificate.svelte** — props `ownImage {builtAt, plainSha256, builder?{vprogram, measurement}}`, `imageHash`, `plain? {sha256, store?, commit?}`, `onDark?`, `onback?()`. Uses constants `own-image.js: ALEPH_MESSAGE, REPOSITORY`; `window.print()`. Mounted only by `FirstStart.svelte:118`.

**VmList.svelte** — props `master`, `version?`, `onchange?()`. Calls `vm.js: listVms, hostname, vmStatus, crnAddress, nodeState, eraseOnNode, forgetInstance, ownInstance, publicAddress, PAPERLESS_VM, FIXED_HOST_DOMAIN`; `lifecycle.js: revokeBackupKey`; `balances.js: confidentialCreditsPerHour`; `profile.js: loadProfile, updateProfile`; `starting.js: startingInstance`; `keys/derive.js: alephPrivateKey, fixedHostLabel, statusToken`; `@le-space/attest-wasm/instance: pinsOf`; `confirm` (2×).

**HourQuote.svelte** — props `quote` (result of `credits.js quoteVm` or null), `hoursAsked?`, `short?`, `topUpHint`, `confirmLabel`, `disabled?`, `onconfirm()`, `oncancel()`. No logic calls (formatting only).

**ProviderHealth.svelte** — props `network`, `ids: number[]`. Calls `providers.js: providerHealth`. Re-checks when `network`/`ids` change.
