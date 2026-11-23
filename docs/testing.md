# Tests

Two kinds: checks that run on every pull request without secrets or paid
services, and live tests on Aleph and Filecoin that someone starts by hand.

## On every pull request and every push to main

Workflow **CI** (`.github/workflows/ci.yml`), on GitHub-hosted runners, with a
read-only token and no secrets, so pull requests from forks run it too.

| Job | What | Run it locally (in `pwa/`) |
|---|---|---|
| Check and unit tests | `svelte-check` (errors only) | `pnpm check` |
| | Unit tests with vitest: the app, and the image's scripts in `rootfs/files` (`src/lib/rootfs-*.spec.js`) | `pnpm test` |
| | The image builder's tests | `node --test` in `builder/` |
| Build and browser tests | The build | `pnpm build` |
| | Playwright with Aleph mocked in the page (`e2e/`) | `pnpm e2e` (after `pnpm build`) |
| | Playwright against a local mock of Le Space Credits (`e2e-credits/`) | `pnpm e2e:credits` |

Dependencies are installed with `pnpm install --frozen-lockfile --ignore-scripts`.

**Image builder** (`builder.yml`) also runs on pull requests that touch
`builder/`: the builder's container image and one whole job in it, without
network.

## Before a release

**PWA deploy** runs the unit tests, the build and the browser tests again, then
publishes to Aleph IPFS.

## By hand: live tests (they cost)

These need repository secrets and spend credits, VM hours or storage. They
are started from the Actions tab, never by a pull request.

| Workflow | What it tests |
|---|---|
| Paperless rootfs | Builds and publishes the image |
| Paperless on a confidential node (`try.yml`) | Start, attestation, unlock, HTTPS, stop on a real SEV-SNP node |
| PWA start and stop (`pwa-e2e.yml`) | The PWA starts and stops a real VM (`e2e-live/`): in the v0.2 interface or in `/app/`, as chosen; with the test image, no backups |
| Paperless backup and restore round trip | Backup on the Calibration testnet, restore in a second VM |
| Paperless backup round trip through Le Space Credits | The same, paid through Le Space Credits (`stage=address` spends nothing) |
| Own image: fetch through a relay / upload from a browser | The image of its own: sealed by the builder, fetched, uploaded (`e2e-upload/`) |
| Image builder on Aleph | Publishes the builder and calls it attested |
| Measure who pays for a delegated INSTANCE | Aleph's billing and authorizations for a delegate key |

## Maintenance workflows (no tests)

Also started from the Actions tab, except the daily provider watch:

| Workflow | What it does |
|---|---|
| Provider watch (`provider-watch.yml`) | Once a day: whether the storage providers are up and proving; opens an issue labelled `provider-watch` per event. Public data only |
| Flat images (`flat-images.yml`) | Pushes a one-layer copy of each image in `rootfs/images.txt` to ghcr.io, for `rootfs/files/compose.yml` |
| Image retention (`image-retention.yml`) | Which STOREs of older builder versions may be forgotten; a dry run first, then exactly that list |
| Forget leftovers (`forget-leftovers.yml`) | Forgets the STOREs a refused builder publication left, guarded the same way |
