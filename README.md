# paperless-anywhere

**Your own [Paperless-ngx](https://github.com/paperless-ngx/paperless-ngx), started from any computer or phone, in a confidential VM: around the clock or when you need it. Opened with a passkey, no account.**

Live at **[paperless.le-space.de](https://paperless.le-space.de)** (German and English). Paperless-ngx is an independent open source project; Paperless anywhere runs it and is neither affiliated with nor endorsed by it.

Paperless-ngx usually lives on one machine at home. Paperless anywhere runs it on rented, decentralised compute instead, without giving the operator a look inside:

- **Around the clock or on demand.** Keep it running, or start it when you need it: the app requests a VM, restores your newest backup, and you work. "Back up and stop" makes a last backup and deletes the VM; in between no compute time is used.
- **Your data stays yours.** Backups are encrypted in the VM and kept at several independent storage providers on [Filecoin Onchain Cloud](https://docs.filecoin.cloud), which prove on the chain, again and again, that they still hold them. The VM is disposable.
- **Confidential.** The VM runs on AMD SEV-SNP: memory and disk are encrypted by the processor, and secrets reach it only after the app has checked the processor's report in your browser.
- **Your own image.** For real use, an attested builder seals the system with a passphrase from your vault. Neither Le Space nor Aleph Cloud holds a key that opens your disk.
- **No fixed computer, no password file.** A passkey (WebAuthn PRF), or the 24 words written down at the start, opens a vault in the browser. Every key the app needs is derived from it.

## How it fits together

```
 Browser (any device)                       Aleph confidential VM (AMD SEV-SNP)
 ────────────────────                       ───────────────────────────────────
 passkey / 24 words ──► vault (in memory)    your own image (LUKS2), opens only with
   ├─ app key (signs for Aleph)                your passphrase: Debian · Docker · Caddy,
   ├─ image passphrase                         Paperless-ngx · Postgres · Valkey · Tika · Gotenberg
   ├─ Paperless passwords                    data area: a new random key at every start
   └─ backup key (age)                       restore ◄── Filecoin Onchain Cloud ──► backups
                                                          (several independent providers)
 [Start] ─► request VM ─► check AMD report ─► send secrets ─► https://…/ ─► [Back up and stop] ─► erase
```

1. **Your image (once, and for each new version):** an attested builder in its own confidential VM seals the public base image with a passphrase from your vault. Your browser checks the builder's AMD report first, then stores the sealed image on Aleph. Included with a package or a voucher.
2. **Start:** the app signs an INSTANCE message, asks for a confidential node, and checks the processor's report: the measurement of firmware, kernel, initrd and an owner line naming your app key, a fresh value, and the VM's TLS key. Only then does it send the image passphrase and the secrets, over a relay that forwards encrypted bytes only.
3. **Restore:** the VM fetches your newest backup from the providers, checks every piece against its content address, decrypts it and imports it into an empty Paperless-ngx. A restoring start asks for no VM while no copy of the backup answers.
4. **Run:** Paperless-ngx as you know it, on HTTPS. The VM checks every two hours whether something changed and backs it up; "Back up now" does it at once.
5. **Stop:** "Back up and stop" makes a last backup; once it is confirmed on the chain, the app deletes the VM.

Every step as a sequence diagram, the attestation and unlock included: [docs/workflow.md](docs/workflow.md).

## Paying for it

Two ways, chosen in the app's setup:

- **Through Le Space Credits** ([credits.le-space.de](https://credits.le-space.de), Le Space's credits service): a monthly package, paid by card through Stripe, or a voucher. Compute hours or continuous operation, backups included, building your own image included. The app talks to the service directly: it shows the package, buys, cancels, redeems vouchers, and warns before a package ends. You need no wallet and no crypto.
- **Directly in crypto, from your own wallet** (for example MetaMask): Aleph credits for the VM, USDFC and a little FIL for the backups on Filecoin. Your wallet authorizes the app once to start and delete VMs and to back up on its behalf; it keeps the money and can withdraw the permission at any time. Le Space is not in the payment path; the app, the image and the relay still come from Le Space.

Prices and terms: [paperless.le-space.de](https://paperless.le-space.de/#prices).

## Keys

A random **master secret** is sealed by each passkey (WebAuthn PRF) and by the 24-word recovery phrase; either opens it, and more passkeys can be added (one per address or device). Nothing secret is stored unsealed, and the master secret lives only in the browser's memory.

From the master secret, by HKDF with distinct labels: the **app key** (Aleph), the **Filecoin session key**, the **backup key** (age), the **image passphrase**, the **Paperless passwords**. The app key and the session key hold no money.

What lives where, and what to do when a passkey, a device or the words are lost: [docs/keys-and-recovery.md](docs/keys-and-recovery.md). Fetching and decrypting a backup without a VM, without the app and without Le Space: [docs/restore-yourself.md](docs/restore-yourself.md) (Deutsch: [docs/restore-yourself.de.md](docs/restore-yourself.de.md)).

## Images

- **The base image** is built from this repository by `rootfs.yml` on a GitHub-hosted runner, without encryption and without any secret. Its SHA-256 is fixed in the app and public; GitHub's build provenance ties it to the commit.
- **Your own image** is that base image, sealed by the attested builder with a passphrase only your vault knows. Real use always runs on it: [docs/own-image.md](docs/own-image.md).
- **The public image**, for trying out only, has one passphrase per version, shared by everyone using it. A VM on it gets no backup keys and no fixed address, and starts empty.

## Further reading

- [docs/security-model.md](docs/security-model.md): what a VM gets and from whom, what the image contains, and why one vault's VM, balance and backups stay separate from another's
- [docs/backup-proofs.md](docs/backup-proofs.md): how the storage providers prove they still hold a backup, and what that does not prove
- [docs/confidential-vm-variants.md](docs/confidential-vm-variants.md): the variants of confidential VMs we know, what each measures and who holds which key
- [docs/testing.md](docs/testing.md): which tests run on every pull request, and which live tests on Aleph and Filecoin are started by hand

## What this does not protect against

- A bug in the processor's SEV-SNP or in the hypervisor that breaks confidentiality.
- The image's content is not measured by the hardware; that your VM runs your image rests on its disk opening only with your passphrase.
- Losing every passkey and the 24 words: the backups made with the vault's key are lost.
- Someone with your unlocked device while the vault is open.
- The relay sees which VM is reached from which IP address, and when; it cannot read or change the traffic unnoticed.

## Status

Running, in daily use. Open: [hardening](https://github.com/Le-Space/paperless-anywhere/issues/4) (two-factor login in Paperless), [Akash as a second target](https://github.com/Le-Space/paperless-anywhere/issues/5), [several customers per package](https://github.com/Le-Space/paperless-anywhere/issues/7), and the [security audit](https://github.com/Le-Space/paperless-anywhere/issues/9), which is still going on.

## Help and security reports

Help and support: paperless@le-space.de; payment, invoices, vouchers and credits: support@le-space.de; legal matters (withdrawal, cancellation, provider): contact@le-space.de, as in the imprint. Le Space never asks for your 24 words, a passphrase, your passkey, a recovery code or a DNS token.

A security issue: please report it privately, never as a public issue: [SECURITY.md](SECURITY.md).

## Related

- [paperless-backup-filecoin](https://github.com/Le-Space/paperless-backup-filecoin): the encrypted backup the VM makes and restores from
- [relay-button](https://github.com/NiKrause/relay-button): the relay, and the action that makes the image confidential
- [Paperless-ngx](https://github.com/paperless-ngx/paperless-ngx): the document management system that runs in the VM

## License

Copyright © 2026 [Le Space](https://github.com/Le-Space).

Paperless anywhere (the web app, the image builder and the VM image's own files) is free software under the **GNU Affero General Public License, version 3 or later** (`AGPL-3.0-or-later`), see [LICENSE](LICENSE). The app at paperless.le-space.de is built from this repository; its source is here. What the VM runs beside it (Paperless-ngx and the rest of the stack) keeps its own licences, listed in the app under *Lizenzen*.

## For developers: the rootfs

`rootfs/build-image.sh` builds the image: Debian 12 with systemd, Docker and the compose plugin, Caddy, age, and the stack in `/opt/paperless/compose.yml` (Paperless-ngx, Postgres, Valkey, Tika, Gotenberg). The workflow *Paperless rootfs* (`rootfs.yml`) hands it to relay-button's `aleph-confidential-rootfs` action, which makes it confidential, and publishes it as an Aleph STORE; with `plain` it also publishes the unencrypted base image the builder seals.

- The containers are pulled after the unlock, so the image stays small. They are pinned by digest and flattened to one layer each (`rootfs/images.txt`, `flat-images.yml`): Docker uses vfs and the host network, because the confidential guest kernel has no overlayfs or bridge.
- Secrets, a restored backup, certificates and keys are written only to the data area the VM seals at every start with a key that never leaves it (`paperless-data-disk`, `paperless-require-sealed`); without it, Paperless-ngx does not start.
- Every service binds to 127.0.0.1. The guest has no firewall and a public IPv6 address. Only Caddy faces the network, and sshd when a test sent a key with the unlock (the app never does); `paperless-anywhere-check` fails if anything else does.
- `paperless-https <hostname>` writes the Caddyfile for `https://<hostname>`, restarts Caddy and recreates the Paperless container with `PAPERLESS_URL`. Without it, Django refuses logins from that origin (CSRF).
- `paperless-manage <args>` runs a Paperless management command (`document_importer`, `document_thumbnails`, `shell`, …) in a one-off container. `docker exec` does not work in the confidential guest, because Docker runs inside the measured init's chroot. For the same reason the image's healthcheck is turned off.

Every image has a passphrase of its own, and the app keeps it together with the image's hash: another image is saved only with its passphrase, and a start refuses a passphrase entered for another image.

- **A release image** (purpose `release`, the public image for trying out) is built on a GitHub-hosted runner. The job makes a random passphrase and prints it in the run's summary, encrypted with [age](https://age-encryption.org) to the recipient in the repository variable `IMAGE_KEY_RECIPIENT`. Make the key pair once with `age-keygen -o image-key.txt`, set the variable to its public key (`age1…`), and read a passphrase with `age -d -i image-key.txt`. It is no GitHub secret, and no test gets it.
- **A test image** (purpose `test`, the default) uses the secret `PAPERLESS_LUKS_PASSPHRASE`, as the live tests do. It is for tests only.
- **An own image** is made in the app, by the builder (`builder/`), from the base image: [docs/own-image.md](docs/own-image.md).

The workflow needs the `ALEPH_PRIVATE_KEY` secret, and `PAPERLESS_LUKS_PASSPHRASE` for test images. The image carries no SSH key: a test that needs SSH sends its own public key with the unlock, as the secret `authorized_keys`, which the confidential init adds for root. The app never sends one. `pwa/scripts/live-debug-start.mjs` starts a VM the way the app does, with such a key, for diagnosis.
