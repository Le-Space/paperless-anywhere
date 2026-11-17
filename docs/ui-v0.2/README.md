# UI v0.2: "Standard" and "Technisch"

Working papers for the relaunch of the PWA's interface. Status: **concept, waiting for
approval**. Nothing in `pwa/` has changed yet.

The brief: one app for two audiences. "Standard" must be usable by someone who knows
little about document management and nothing about confidential VMs; "Technisch" gives
developers full detail and control. Nothing of today's interface may be dropped. v0.2 is
deployed beside v0.1 for testing before any switch.

## What is here

| File | What it is |
|---|---|
| [`prototype.html`](prototype.html) | The concept page (German): a clickable prototype of eleven screens, each in both views side by side, then the architecture, the switch, the wording, the mapping summary and the open questions. Its source is written for the Artifact publisher, which adds the document skeleton. |
| [`places.md`](places.md) | The information architecture of v0.2 as place codes (`S-STATUS`, `B-HEALTH`, `P-PAYER.T` ...). `.T` marks what only the technical view shows. |
| [`inventory/`](inventory/) | Every control, label, light, dialog and text block of the app on `main` at 30f34f4, with file and line, state, audience and behaviour: 791 rows in three slices, plus duplicates, jargon, dead ends, persistence and component interfaces. `D-delta-since-30f34f4.md` adds the ten items main gained since (up to #357, the switch for incremental backups), with their places. `E-brand-and-switch.md` holds the brand tokens and the simple/technical switch of simple-todo. |
| [`mapping/`](mapping/) | One row per inventory row: its place in v0.2, how "Standard" and "Technisch" show it, and what changes. |

## The architecture in short

- Areas: **Start, Sicherung, Paket, Mehr**; the technical view adds **System**.
- The technical view only adds: a mono line under a plain sentence, a "Technik" panel
  under a card, and the System area. Nothing moves or disappears when the switch flips.
- What works stays: the panel of lights for start and stop and the full-screen first-start
  journey (stations, lights, the "what flows where" diagram) are in both views, in German and
  English; Standard names rows and stations in plain words, Technisch writes every fact out.
- Every warning carries its own button; no text points to another place by name.
- One thing, one place, one name. 39 duplicate rows merge into their surviving place.
- The nine native `confirm()` questions become designed dialogs.
- Legal texts stay verbatim; the hard-coded German ones move into the catalogue unchanged.

Counts from the mapping: Start 160 rows (125 also in Standard), Sicherung 150 (69),
Paket 184 (151), System 66 (16, as alerts with a button), Mehr 33 (26), before unlock
28 (26), global 130 (123), merged 39, test hook 1. Total 791.

## The switch

Two segments, "Standard | Technisch", in the header (also before unlock) and under Mehr.
Default "Standard". Remembered per device in `localStorage['paperless-anywhere.view']`;
a v0.1 choice of "Erweitert" (`paperless-anywhere.tab = advanced`) starts in "Technisch".
A small store after simple-todo's `technical-view.js`; components read it and render
additively. Flipping it re-mounts nothing, so a running start or purchase is not torn down.

## Brand

The app follows the "Le Space Belege Brand & Style Guide v1.0" (a PDF that is in no
repository; its code form is `sites/belege/src/styles.css` in Le-Space/landing).
`pwa/src/lib/theme.css` matches it in every shared colour. v0.2 keeps the tokens and adds
what the guide names and the app lacks: a type scale (body 17/27), a secondary button
style, and the light/dark switch.

## Findings that shape the build (phase 3)

- The flow control is not only in the logic modules: about 1000 lines sit in the script
  part of `Lifecycle.svelte`, and similarly in `Setup.svelte` and `Package.svelte`. They
  have to move into modules first, unchanged, so both interfaces share them.
- `Lifecycle.svelte` has two copy-pasted templates that have drifted (listed in
  `inventory/B-lifecycle.md`, section 3.1). v0.2 has one template and settles each
  difference to the safer behaviour.
- `Balances`, `VmList`, `Setup` and `Package` feed warnings even while hidden. Their data
  sources must stay alive in the standard view.

## The parallel deploy (phase 4): a path, not a subdomain

Decided on 2026-11-17: v0.2 lives at `/v0.2/` on `paperless.le-space.de`, as a route of the
same build.

- Same origin: the same passkey opens (`pwa/src/lib/keys/passkey.js` sets no `rp.id`, so a
  passkey belongs to the address), and the vault record in `localStorage` is the same one.
- Both interfaces use the same modules for the vault and the sealed profile, so they read
  and write the same records in the same way. v0.2 adds one key of its own,
  `paperless-anywhere.view`.
- The new interface is in chunks of its own, loaded only under `/v0.2/`. It ships with every
  release, unlinked, until the switch.
- A subdomain was set up first and dropped. What was learned: in Chromium, with a virtual
  authenticator, a passkey made without `rp.id` opens on a subdomain that names the parent
  `rp.id`, with the same PRF output, and not without it. Safari and real authenticators were
  not tested.

## Where the build differs from the concept

- **The setup stays together under System.** `places.md` puts who pays and the grants under
  Paket (`P-PAYER.T`, `P-GRANTS.T`) and the backup settings and places under Sicherung
  (`B-SETUP.T`, `B-PLACES.T`). In the build they are sections of System, as one setup on one
  flow control (`setup-card.svelte.js`); Paket and Sicherung lead there with a button. Splitting
  one setup over three areas would need three instances of its state or a shared one above
  the areas, for no gain a developer would notice.
- **The alert for a VM no card knows leads to the list**, in both views, instead of offering
  "Wieder verbinden" and "Beenden" inside the alert: adopting and deleting stay where the VM is
  shown with its state.
- **Light and dark still follow the system.** The switch the style guide names needs
  `theme.css` to take a chosen theme, which touches every page of the app; not done yet.
- **Shared parts keep v0.1's control sizes** (`TopUp`, `BackupLine`, `Cancel`, `Withdraw`,
  `BackupPlaces`, `Addr`): below the 44 px used elsewhere in v0.2.

## Open questions

They are on the concept page, in German, for the product owner.
