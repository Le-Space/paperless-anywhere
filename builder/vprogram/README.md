# The image builder as an Aleph V-PROGRAM

How the builder ([docs/own-image.md](../../docs/own-image.md)) gets onto
Aleph as a measured, confidential VM that anyone can attest.

> **Status: prepared, not tried on Aleph.** The compose file and the image
> archive are checked locally (the container starts under exactly these
> settings and runs a whole job). The steps below follow `aleph vprogram`
> of the Aleph CLI 0.20.0 and Aleph's runtime `compose-1.4`; none of them
> has been run for this builder yet.

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

## Steps

All in this directory. `IMAGE` is the name in `docker-compose.yml`.

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
