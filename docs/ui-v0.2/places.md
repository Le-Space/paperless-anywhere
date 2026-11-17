# v0.2 places (information architecture)

Two views of one app, chosen by a switch "Einfach | Technisch" (simple | technical).
The technical view is additive: it shows everything the simple view shows, in the same
place and the same order, plus (a) a mono "technical line" under plain sentences,
(b) "Technik" panels below a simple card, (c) extra sections marked `.T` below, and
(d) one extra area, "System". Nothing in the simple flow is hidden or moved when the
switch flips.

Navigation: Einfach has four areas: Start, Sicherung, Paket, Mehr.
Technisch has five: Start, Sicherung, Paket, System, Mehr.

Rules that apply to every item:
- A warning or error in Einfach carries its own button. No text may point to another
  place by name without being a link/button to it.
- Native `confirm()` becomes a designed dialog (G-DIALOG).
- One name per thing (see glossary): Maschine (simple) / VM (technical); "die 24 Wörter"
  (simple) / Wiederherstellungsphrase (technical); Speicherort (simple) / Anbieter,
  Provider-ID (technical); Echtheitsprüfung (simple) / Attestierung (technical);
  Guthaben, Stunden (simple) / Credits (technical); "Adresse deines Paperless" (simple) /
  Host (technical). Raw hashes, CIDs, 0x addresses, provider ids, network names and raw
  logs never show in Einfach.
- Legal texts (terms, waiver, cancel, withdraw) stay verbatim in both views.

## Place codes

Global
- G-HEAD   header: logo + home link, view switch, "Sperren"; on wide screens also language and light/dark
- G-NAV    area navigation (bottom bar on phones, top row on wide screens)
- G-ALERT  one alert slot above the content, highest priority first, each with its own button
           (period end, a second machine that costs money, no copy reachable, start not affordable)
- G-DIALOG designed dialog replacing a native confirm, or a question asked during start/stop
- G-STOP   safety stops (framed, shared origin)
- G-FOOT   footer: Einfach = legal links + version; Technisch adds commit and IPFS CID
- G-ERR    error presentation: plain sentence + next-step button; Technisch adds "Details" with the raw message/log

Before unlock (U)
- U-NEW     first visit: three steps (what you get, create passkey, write down and check the 24 words)
- U-OPEN    "Ich habe schon einen Tresor": passkey, or the 24 words (labelled field, not a closed fold)
- U-LOCKED  welcome back: unlock with passkey / the 24 words; "Diesen Browser vergessen" moves to Mehr → Schlüssel & Geräte, and stays reachable here behind "Probleme beim Entsperren?"
- U-PHRASE  the 24 words: shown, checked (with per-word feedback), guarded against leaving/locking

Start (S)
- S-STATUS   status card: headline, one sentence, one primary action (start / open / resume)
- S-PROGRESS progress while starting/stopping: headline, bar, time left, and the panel of lights in BOTH views
             (one row per step, one light per fact, as today). Einfach names the rows in plain words and shows
             the facts on tap; S-PROGRESS.T writes every fact out and adds timings, total and the raw progress line
- S-ACCESS   running: "Paperless öffnen", login name and password (show/copy with feedback)
- S-PROOF    Einfach: one line "Geprüft: echte, verschlüsselte Maschine" + "Was wurde geprüft?";
             S-PROOF.T = the full evidence rows, re-check, stop evidence, image certificate link
- S-STOP     "Sichern und beenden" and its variants (delete without backup, keep/delete on partial)
- S-RESTORE  what the start begins with: Einfach = one sentence + "Andere Sicherung wählen" (list by date);
             S-RESTORE.T = the full choice (own/unmarked/empty, snapshots, piece ids, sizes, copies)
- S-FIRST    first start / image build: the full-screen journey stays in BOTH views (six stations, row of lights,
             percent, time left, minimise, the animated "what flows where" diagram, the finale, the certificate).
             Einfach uses plain station names and texts; S-FIRST.T adds the sub-steps, the evidence rows and the hardware links
- S-NOTE     notes under the status card (role, data disk, image line, revoke pending, node refused ...): most are `.T`

Sicherung (B)
- B-HEALTH   one sentence + two lights (reachable, independent); the header keeps no lights, G-NAV shows a dot on "Sicherung" when not green
- B-LAST     last backup (when, how many copies), schedule sentence, "Jetzt sichern", result
- B-TRIAL    "Sicherung ausprobieren" (trial restore)
- B-EXPORT   "Dokumente herunterladen" (fetch and decrypt in the browser, guide); B-EXPORT.T = ledger.json, backup key reveal
- B-STORAGE  storage meter
- B-COPIES.T per copy: provider, domain, owner, answers/silent/blocked, same-operator pairs, provider health
- B-CHAIN.T  "Was die Chain sagt"
- B-PLACES.T where backups go (region/copies or providers, cost, push to the running VM)
- B-RETAIN.T retention list and policy
- B-SETUP.T  backups on/off, network, who pays the storage, VM key / session key state, backup key (age), owner wallet, pay one month
- B-DETAIL.T last backup detail card (piece CID, size, duration, payer, per-copy fetch links, logs)

Paket (P)
- P-STATE   package status: hours left, period, meter, low-hours warning, period end
- P-PLANS   choosing/changing a plan, voucher
- P-MONEY   balance in euros, top-up, extra hours, purchase confirmation
- P-BACKUP  the backup booking line (monthly with the plan, one year retention)
- P-BILLS   top-ups and invoices
- P-LEGAL   terms, withdrawal waiver, "Verträge hier kündigen", withdraw
- P-PAYER.T who pays the VM (Le Space / this app's address / my wallet), wallet connect
- P-CRYPTO.T balances at Aleph and Filecoin, unit choice, runway
- P-GRANTS.T Aleph approval for the app key, Filecoin session key

System (T), technical view only
- T-GLANCE  one overview table (merges the page's and the setup's "Auf einen Blick")
- T-VMS     "Meine VMs" (adopt, delete); a stray VM also raises G-ALERT in both views
- T-IMAGE   image and node: own image build/rebuild, public image, hashes, passphrase, previous image, certificate
- T-NET     network (test/main) and role (test/primary)
- T-RELAY   attest relay
- T-ADDR    fixed address (Cloudflare token)
- T-PROFILE where the setup lives (sealed profile on Aleph)

Mehr (M)
- M-KEYS    "Schlüssel & Geräte": passkeys, add a passkey for another device/address, about the 24 words, forget this browser;
            M-KEYS.T = app key address (shown once, with copy), key derivation explanation
- M-HELP    help: FAQ, contact, "Fehlerbericht kopieren" (diagnosis), security reports
- M-SET     language, light/dark, view (same switch as the header)
- M-LEGAL   imprint, privacy, licences, about, cancel link
- M-BUILD.T build info (version, commit, CID, source)

Special
- MERGED→<code>  the item is a duplicate; it survives only at <code>
- TEST      test hook only (data-testid, sr-only state): kept as a hook, not as visible UI
- DEAD      catalogue key that no component renders today; not carried over (listed so the decision is visible)
