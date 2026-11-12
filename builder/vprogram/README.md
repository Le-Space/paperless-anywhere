# The image builder as an Aleph V-PROGRAM

How the builder ([docs/own-image.md](../../docs/own-image.md)) gets onto
Aleph as a measured, confidential VM that anyone can attest.

> **Status: published once, not verified yet.** The compose file and the image
> archive are checked locally (the container starts under exactly these
> settings and runs a whole job). The steps below follow `aleph vprogram`
> of the Aleph CLI 0.22.0 and Aleph's runtime `compose-1.4`. Of them, only
> the start of a dry run was tried (the CLI accepts the compose file and
> the options and resolves the runtime). Through the workflow below, a dry
> run and a publication have run; an attested call has not verified yet
> (see "Choosing the node"), so no job has run on Aleph.

## What runs

| | |
|---|---|
| Runtime | `compose-1.4` (aleph-snp-compose 2.2.0): firmware, kernel, initrd and a read-only root with podman, all from Aleph's published bundle |
| Workload | one volume with `docker-compose.yml` and the builder's image archive; its dm-verity root hash is on the measured boot line |
| Way in | Aleph's attestation agent, TLS on 8443, forwarding to `127.0.0.1:8080` |
| Way out | the builder fetches the plain image from Aleph's API and uploads the encrypted one there |
| Scratch | none on disk: the image being built lies in memory (`/work`, a tmpfs of 1.2 GiB) |

A V-PROGRAM has no owner and takes no secret at start: what the builder
knows is what is in this repository. The passphrase of a build arrives over
the attested channel and is gone when the build ends.

**Memory:** 6144 MiB. The loaded container image (about 250 MiB), one image
of up to 1 GiB in `/work`, and up to 1 GiB while `cryptsetup` derives the
disk key all live in memory.

## With the workflow

The workflow **Image builder on Aleph** (`.github/workflows/builder-publish.yml`,
started by hand under *Actions*) runs the steps below on a GitHub runner, with
the pinned CLI and the secret `ALEPH_PRIVATE_KEY` as the account that signs
and pays. Its summary holds what each action found.

| Action | Does | Costs |
|---|---|---|
| `dry-run` | builds the archive and the workload, computes the launch measurements; uploads and publishes nothing | nothing |
| `publish` | a dry run first, then uploads the workload and publishes the V-PROGRAM, waits until it is reachable and makes an attested call to it; if that call does not verify, the builder is deleted again | credits of the account, from then on **until it is deleted** |
| `check` | shows the V-PROGRAM with the given hash and makes one attested call to `/`; fails unless the builder answers | nothing |
| `delete` | forgets the V-PROGRAM with the given hash; the scheduler then stops the VM | nothing; ends the cost |

The usual order:

1. `dry-run`. If it fails while it fetches Aleph's runtime bundle, start it
   again; it tries three times by itself.
2. `publish`, with a node in `crn` (see below). Note the item hash from the
   summary. A green run means the attested call verified.
3. `check` with that hash, whenever you want to know whether it still
   answers.
4. Enter the values in the app ([below](#what-goes-into-the-app-afterwards)).
5. `delete` with that hash when the builder is no longer wanted. A builder
   that was published and forgotten keeps costing.

### Choosing the node

An attested call verifies only on a node whose SEV-SNP firmware (its TCB:
bootloader, microcode and so on) is at or above the floor Aleph's network
sets. A node does not say how current its firmware is; only an attestation
shows it. So:

- Name a node in `crn` (its hash or a unique start of it): one of Aleph's
  compute nodes that reports `sev_snp` among its CPU features. Without it
  the scheduler chooses, and it does not look at the firmware.
- If the attested call fails, `publish` deletes the builder again and the
  summary says why. Try the next node.
- `keep` leaves a builder that failed the call running, to look at it with
  `aleph vprogram logs`. It keeps costing; delete it afterwards.

The first publication (2026-11-11, node chosen by the scheduler) ended this
way: the VM ran, and the attestation was refused because that node's
bootloader and microcode were below the floor.
The second, on a named node, verified (bootloader 10, microcode 88), but
the builder did not answer yet at the first call and the workflow of that
day deleted it too early; it now waits for the builder to come up.

`memory`, `vcpus` and `runtime` have the defaults this page explains; change
them only with a reason, since each changes the measurement.

A publication is not repeated automatically: if `publish` fails after the
upload began, look at the account's V-PROGRAMs (`aleph vprogram list`)
before starting it again, so that two builders do not run side by side.

Updating the CLI: set `ALEPH_CLI_VERSION` and `ALEPH_CLI_SHA256` at the top
of the workflow to a release of `aleph-im/aleph-rs` and the SHA-256 GitHub
lists for `aleph-cli-linux-x86_64`.

## By hand

The same on a Linux machine with the Aleph CLI, `veritysetup`
(`cryptsetup-bin`), `mkfs.ext4` (`e2fsprogs`) and docker. It does not work
on macOS: the CLI needs `veritysetup` and `mkfs.ext4` to build the workload.


All in this directory. `IMAGE` is the name in `docker-compose.yml`. With a
key instead of a stored account, set `ALEPH_PRIVATE_KEY` and add `--chain eth`.

```sh
IMAGE=localhost/paperless-anywhere-image-builder:1
```

1. **The archive.** Built for linux/amd64; the script prints its SHA-256.
   The workflow *Image builder* builds the same on a GitHub runner and
   keeps it as an artifact.

   ```sh
   ./build-archive.sh
   ```

2. **A local boot, nothing uploaded.** On a Linux machine with
   `qemu-system-x86_64`, `/dev/kvm` and `veritysetup`: boots Aleph's
   runtime with this workload in plain QEMU and asks the builder for `/`.
   It shows that the volume is built as the runtime wants it, that podman
   loads the archive and that the builder answers through the agent. It
   shows nothing about SEV-SNP, attestation or the node's network.

   ```sh
   aleph vprogram run --compose docker-compose.yml --image-archive "$IMAGE=image-builder.tar" \
     --runtime compose-1.4 --vcpus 2 --memory 6144 --check
   ```

3. **What would be published.** Builds and measures, signs and uploads
   nothing; the output names the launch measurements.

   ```sh
   aleph vprogram create paperless-image-builder --compose docker-compose.yml \
     --image-archive "$IMAGE=image-builder.tar" --runtime compose-1.4 \
     --vcpus 2 --memory 6144 --dry-run --json
   ```

4. **Publish.** The same without `--dry-run`, with `--wait`. From here on
   the builder costs credits of the signing account until it is deleted.

   ```sh
   aleph vprogram create paperless-image-builder --compose docker-compose.yml \
     --image-archive "$IMAGE=image-builder.tar" --runtime compose-1.4 \
     --vcpus 2 --memory 6144 --wait 600
   ```

5. **An attested call.** Answers only if the AMD chain, the key binding,
   the pinned measurement, the policy and a fresh nonce all check out.
   Expected: `{"service":"paperless-anywhere image builder"}`.

   ```sh
   aleph vprogram call <hash> / --verbose
   ```

6. **Stop it.**

   ```sh
   aleph vprogram delete <hash>
   ```

## What the first run has to show

- The builder reaches Aleph's API from inside the guest (the fetch of the
  plain image is the first thing a job does; `aleph vprogram logs <hash>`
  shows the builder's line and any failure).
- A whole job with a real plain image fits into the memory above.
- `cryptsetup` encrypts inside the runtime's container. Locally it does so
  without device-mapper and without the kernel's crypto socket, which the
  guest kernel does not have.
- An upload of several hundred MiB from the guest to Aleph goes through.

## What the runs showed so far

- 2026-11-11, node chosen by the scheduler: the attestation was refused,
  that node's firmware is below the network's floor.
- 2026-11-11 and 12, on a named node: the attestation verifies, the builder
  comes up after about four minutes and answers `/`.
- 2026-11-12, a first build request with a real plain image: accepted over
  the attested channel, and failed at its first step with "fetch failed".
  The builder did not reach Aleph's API from inside the guest. Why is not
  known yet: the builder of that day did not say what lay behind the error.
  It does now, and `GET /health` reports the name servers the guest was
  given, what the API's name resolves to, and whether the API answers; the
  workflow prints it after `publish` and `check`.

## What goes into the app afterwards

`BUILDER` in `pwa/src/lib/own-image.js`:

- `measurements`, `policy`: from the V-PROGRAM message (`aleph vprogram show <hash>`);
- `route`: how the attest relay reaches the builder's attested endpoint;
- `plain`: the STORE hash and SHA-256 the image workflow prints with the option *plain*.

All of these are public values.

## Checking it from outside

The V-PROGRAM message names the runtime, the workload volume, its hash
tree and root hash, and the measurements. Anyone can download the volume,
verify it against the root hash (`veritysetup verify`), read the compose
file in it and load the image archive, and recompute the measurement from
Aleph's runtime bundle and the boot line.

Two limits, said plainly:

- The hash tree gets a random salt at each `create`, so a new publication
  of the same files has another root hash and another measurement. The
  measurement fixed in the app belongs to one publication.
- The container image is not built reproducibly yet (Debian packages are
  installed at build time). What can be compared is its content, not its
  hash against a rebuild.
