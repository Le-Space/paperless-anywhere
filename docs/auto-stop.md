# Auto-stop: the VM stops itself when nobody uses it

Status: concept (2026-11-28), phase 1 (guest side) in the first PR. Roadmap:
#430; origin: #163 (idle shutdown).

A Paperless VM runs, and costs credits, until someone presses "Back up and
stop". If the tab is closed and nobody comes back, it keeps running. With
auto-stop the person chooses, in the app:

- **after a quiet time**: 30 min, 1 h, 2 h, or another value (15 min to 24 h);
- **daily at an hour**: e.g. 18:00 in their own time zone;
- or both (whichever comes first), or neither (the default: off).

The stop is the one that exists: Paperless pauses, the last backup goes up,
and only then may the VM be erased.

## The central question: what saves money

**A stop alone saves nothing.** Paperless paused with its backup up is still
an INSTANCE on Aleph, and Aleph charges every processed INSTANCE message by
the hour. What ends the charge is the **FORGET** of that message: pyaleph
deletes the costs of forgotten and removed messages
(`delete_costs_for_forgotten_and_deleted_messages` in
`src/aleph/db/accessors/cost.py`, main ee62fc9, 2026-11-10). So an auto-stop
that waits for the app to come back saves money only from the moment the app
is opened again.

### Options

**a) The VM pauses and backs up; the app erases and FORGETs at the next
opening.** This is what the end of the paid time does today
(`paperless-period-end`, docs/workflow.md "The end of the paid time").
Safe and already built, but while the app stays closed the paused VM is
billed exactly as a running one. Its value is only that the data is backed
up and nothing new arrives that a later erase would lose.

**b) A FORGET pre-signed by the app key, handed to the VM as a sealed secret;
the VM broadcasts it after a successful backup.** The app signs a FORGET of
this VM's INSTANCE (address = the payer, sender = the app key as its
delegate, exactly as `forgetInstance` in `pwa/src/lib/vm.js` does today) at
the start, as soon as the INSTANCE hash is known, and hands it over with the
other secrets. After a stop whose backup is ready and confirmed, the VM sends
it to an Aleph API node itself. The VM gets no key: it holds one signed
message that can do exactly one thing.

Checked against pyaleph (main ee62fc9, read 2026-11-28, no message sent):

- *An older `time` is accepted.* `BasePendingMessage.check_time` only parses
  the field (`timestamp_to_datetime`); its docstring speaks of refusing
  times "too far in the future", but there is no bound either way, and
  nodes must accept old messages anyway to sync history. A FORGET signed
  hours or days before it is sent is processed like a fresh one.
- *The authorization is checked when it is processed, not when signed.*
  `ForgetMessageHandler.check_permissions` asks `is_sender_authorized_for_owner`
  against the owner's **current** `security` aggregate. If the payer revoked
  the app key's delegation in between, the FORGET is rejected; the VM then
  stays paused and the app falls back to (a).
- *It is idempotent.* The item hash is fixed by the signed content; sending it
  twice is the same message. A target that is already forgotten is skipped.
- *It only forgets what it names.* `hashes` holds this one INSTANCE hash; it
  cannot forget other VMs, the profile, backups, nor spend anything.
- The CRN stops the VM once its INSTANCE is forgotten; the VM must therefore
  send the FORGET last, after everything it has to say is outside (backup on
  chain, a note for the app, see below).

To be confirmed with a real message before the app relies on it (needs
Nico's go: a VM start costs): a FORGET signed at a VM's start and sent by
that VM an hour later is processed on the API node the app uses, and the
VM is gone from its CRN within minutes.

*What a leaked pre-signed FORGET could do.* Anyone holding it can forget this
VM at any time, so it would lose what came in since its last backup; nothing
else. It lives only in the VM's memory (`/tmp/secrets`, handed over on the
attested channel like the LUKS passphrase) and in the browser for the moment
of the hand-over; the vault does not keep it. The order backup-before-forget
must hold inside the VM: the FORGET is sent only by `paperless-stop` after a
stop whose `stop.json` says `ready` **and** whose backup the VM has seen on
chain, never at `partial`, `failed` or during a restore. A VM-side bug that
sends it early is the real risk, not a leak; it is covered by unit tests and
one paid round trip.

**c) Le Space Credits forgets on the VM's signed request.** The VM asks Le
Space Credits (signed with a key it already holds for backups) to forget it;
Le Space Credits checks the request and the backup and sends the FORGET with
its own delegation. Needs a change of Le Space's terms (they say Le Space does
not stop a VM itself), a key and an endpoint on their side, and
moves trust to Le Space. It belongs to the "Le Space Credits" session; this
concept does not design their side. Only worth it if (b) fails.

**d) Erasing on the CRN (`eraseInstanceOnCrn`) instead of a FORGET.** It stops
the execution on that node, but the INSTANCE message stays `processed`, so
Aleph keeps billing it, and the scheduler may place it again (it then waits
for an unlock that never comes). Erasing on the CRN is a courtesy that frees
the node at once; it never replaces the FORGET. The app does both today.

### Recommendation

**(b), on top of (a).** Phase 1 and 2 build the stop itself (a): it is useful
on its own as "back up and pause", and it is the prerequisite for any erase.
Phase 3 adds the pre-signed FORGET, so the VM ends its own bill after the
backup. (c) stays a fallback if (b) does not hold in the real test. The same
FORGET then also ends the period-end stop's time on the start reserve.

Until phase 3 the app must say honestly what the setting does: "backs up and
pauses; the VM is deleted, and stops costing, when you open the app again".

## How "quiet" is measured

Quiet means: nobody used Paperless through the web.

- **Counted:** HTTP requests through Caddy to Paperless (the `reverse_proxy`
  route), i.e. a person in the Paperless UI, the mobile apps, the API.
- **Not counted:** the status pages (`/anywhere/...`, read every few seconds
  by the app), Paperless's websocket (`/ws/`), and the polls the Paperless UI
  makes by itself in an open tab (`/api/tasks/`, `/api/remote_version/`,
  `/api/status/`). Whether an open but untouched Paperless tab makes other
  periodic requests has to be checked on a real VM (open question 1).
- **Not counted, but blocks the stop:** work Paperless does on its own. As
  long as the consumption folder holds files, or Paperless's task queue
  (Celery in Valkey: the `celery` list and the `unacked` hash) is not empty,
  no quiet stop starts; it starts when the work is done.
- **Mail fetching does not count.** Paperless fetches mail on its own schedule
  (every 10 minutes); that is no person using it. A mail it imported becomes a
  consumption task and so only delays the stop until it is consumed (#163
  proposed to count imports as activity; the queue check covers that case
  without keeping the VM up for every newsletter).
- **The clock starts** at the latest of: the last counted request, the
  moment the auto-stop setting arrived (a new setting starts the count anew),
  a finished restore, and a stop the person chose to resume.

Caddy writes a minimal access log for the Paperless site only, to memory
(`/run`, rolled at 1 MiB, one old file): time, method, path. No client
addresses, no headers. `paperless-auto-stop` reads the end of it.

## The daily hour

The app stores the hour as `HH:MM` and the person's IANA time zone
(`Intl.DateTimeFormat().resolvedOptions().timeZone`, e.g. `Europe/Berlin`),
plus the zone's current UTC offset as a fallback. The guest computes the
hour with Python's `zoneinfo` (the image adds `tzdata`), so 18:00 stays
18:00 local across daylight saving time; a time that does not exist on the
day of the switch (02:30 in spring) falls an hour later, one that exists
twice (autumn) takes the first. Without the zone in the image, the fixed
offset is used.

The scheduled stop is due at the most recent occurrence of the hour if the
VM already had the setting then (a VM started at 19:00 with "18:00" runs
until 18:00 the next day). It waits until Paperless has been quiet for 10
minutes and its queue is empty, so it does not cut someone off mid-click.

## Interplay

- **End of the paid time** (`period_end`) comes first; the app's own "Back up
  and stop" comes before both. All three are the same stop in
  `paperless-stop`, told apart by `reason`.
- **Backup now / a scheduled backup**: `paperless-stop` already waits for a
  running backup (up to 30 minutes) and then uploads only what changed.
- **A restore runs** (or the unlock named one that has not begun): never.
- **A failed backup**: Paperless starts again, the VM stays; tried again
  after 15 minutes, as at the period end.
- **A partial backup**: Paperless stays paused and the VM waits for the
  person, as today. If they keep the VM ("resumed"), the quiet time counts
  anew from then; the daily stop is not repeated for the same day.
- **Postpone**: the setting carries `postponeUntil` (Unix seconds); nothing
  is due before it. The app sends the setting again with it.
- **Secrets limit**: the guest's agent takes at most 16 secrets per hand-over
  (`MAX_GUEST_SECRETS`). `auto_stop` is one more, so it joins
  `OPTIONAL_SECRETS`; when it has to be left out, the app says that auto-stop
  is off for this start. The secrets bundling planned for the next image round
  makes room.

## What the person sees

- The status pages say `stopReason` `idle` or `schedule` (besides `app` and
  `period-end`). The private page adds `autoStop`: the setting the VM holds,
  the last counted request, and when the next quiet or daily stop is due if
  nothing happens; the app shows "stops itself at about …".
- In the app, while it is open: a notice some minutes before (10 by default)
  with "Postpone 1 h" and "Keep running today" (off until tomorrow's hour).
- At the next opening after an auto-stop: "Your Paperless backed up and
  stopped at 18:00" (phase 1–2: and the app erases it now; phase 3: "and
  stopped costing then").
- Inside Paperless itself there is no warning: the VM cannot show one there.

## Where the setting lives

Nico suggested localStorage, as the app keeps the view and the theme there.
The app's rule is that settings belong in the sealed profile (the vault's
AGGREGATE), so they follow the person to other devices, and the VM needs the
setting as a secret, handed over at the start like `period_end`.

**Recommendation: the sealed profile.** The start reads the profile anyway
and hands the setting over from it; with localStorage a start from another
device (or after the browser's data was cleared) would silently start
without auto-stop, or with a different one, and the VM would stop at a time
the person did not set on that device. Writing the profile is an AGGREGATE
message, as every profile change already is. localStorage may cache the
last choice for the form. Nico decides.

## Cost view

- **Per hour saved**: one package hour (about 0.16 € in the 100-hour package,
  0.43 € in the 15-hour one; Le Space's prices at the time of writing). A
  Paperless used for 20 minutes on a weekday runs about an hour a day with a
  1-hour quiet stop, instead of 24.
- **Paid back at the next start**: the start itself (image, attestation,
  certificate from the backup, #413, so no new Let's Encrypt order) and the
  restore, which depends on the size of the backup: minutes for a few
  hundred documents, longer for many GiB (to be measured on the round trips,
  open question 4). That time is paid too, and the person waits for it.
- **Backups**: incremental (PA-SNAP/1), so a stop's backup uploads only what
  changed; each upload still costs the AddPieces fee, so a stop after a
  quiet hour in which nothing changed uploads nothing.
- **Mail**: while the VM is off, mail waits in the mailbox; Paperless imports
  it at the next start (mail rules act only after the import).
- **Certificates**: the fixed address keeps its certificate in the backup, so
  frequent restarts stay well inside Let's Encrypt's 5 per name per week.

So a quiet time shorter than about 30 minutes rarely pays off; the form
offers 30 min, 1 h (preselected) and 2 h, and a custom value from 15 minutes.

## The secret `auto_stop`

JSON, at most 4 KiB, handed over at the start, with every hand-over of the
backup places, and alone when the person changes it or postpones:

```json
{ "v": 1, "idleMinutes": 60, "dailyAt": "18:00", "tz": "Europe/Berlin",
  "utcOffsetMinutes": 60, "postponeUntil": 0 }
```

`idleMinutes` (15–1440) or `dailyAt` may be null; both null or the secret
missing: off. Phase 3 adds `"forget"`: the signed FORGET message.

## Phases

1. **Guest: the stop** (first PR). `paperless-auto-stop` decides when a quiet
   or daily stop is due and writes `auto-stop.json`; `paperless-stop` runs it
   like the period end, with the reasons `idle` and `schedule`; Caddy's
   minimal access log; the status pages; `tzdata` in the image; the
   capability `autoStop: 1`. Unit tests in vitest. Needs a new image round
   (paid build, Nico's go); nothing changes for existing images.
2. **App: the setting.** In the sealed profile, the form (Standard and
   Technisch), hand-over at the start, with the backup places and on change
   (only to images with `autoStop`), `OPTIONAL_SECRETS`, the notice before,
   postpone, "stops itself at about …", and the next opening erases a VM
   stopped with `idle`/`schedule` as after a period-end stop.
3. **The VM ends its bill.** The app pre-signs the FORGET at the start and
   hands it over in `auto_stop.forget`; `paperless-stop` sends it after a
   ready, confirmed backup, and leaves a note for the app first. The app,
   finding its VM forgotten, reads the note and the chain and marks the
   profile stopped. One paid round trip with Nico's go. The period-end stop
   uses it too.
4. **If (b) fails:** (c) with Le Space Credits, in their session.

## Open questions

1. Does an untouched open Paperless tab make periodic requests other than
   those excluded? (Watch the access log on a test VM.)
2. Does the API node accept a FORGET signed an hour before it is sent (phase 3
   test), and how fast does the CRN stop the VM?
3. Where does the VM leave its note for the app before it forgets itself (a
   POST from the app key's delegation is not possible without a key; the
   backup ledger entry, which the VM writes anyway, may be enough)?
4. How long does a restore take per GiB, so the app can show the cost of a
   restart next to the hours saved?
5. localStorage or the sealed profile (above): Nico decides.
