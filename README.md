# paperless-anywhere

**Start your own Paperless-ngx from any computer or phone, when you need it — on a confidential VM, unlocked with a YubiKey or a seed phrase.**

Paperless-ngx usually lives on one machine at home. This project moves it to rented, decentralised compute instead, without giving the operator a look inside:

- **On demand.** Press a button in a PWA: a VM starts, restores your archive, and you work. When you are done, it backs up and deletes itself. Nothing runs (and nothing is billed) in between.
- **Your data stays yours.** The archive lives encrypted on [Filecoin Onchain Cloud](https://docs.filecoin.cloud), with several independent providers at once (see [paperless-backup-filecoin](https://github.com/Le-Space/paperless-backup-filecoin)). The VM is disposable.
- **Confidential.** The VM runs on AMD SEV-SNP: memory and disk are encrypted by the CPU, and the keys reach it only after the PWA has checked what was booted.
- **No fixed computer, no password file.** A YubiKey (WebAuthn PRF) or a seed phrase unlocks a master secret in the browser. From it come the account that pays for the VM and the passwords of your Paperless; the backup key travels sealed with it.

> Status: planning (October 2026). Nothing here runs yet. The pieces it builds on are in use: the Filecoin backup runs daily, and [relay-button](https://github.com/NiKrause/relay-button) deploys Aleph VMs from a browser.

## How it fits together

```
 PWA (any device)                      Aleph confidential VM (SEV-SNP)
 ─────────────────                     ───────────────────────────────
 YubiKey / seed ──► master secret      encrypted rootfs (LUKS2):
   ├─ Aleph account (pays credits)       Debian · Docker · Caddy
   ├─ Paperless admin/DB/secret key      Paperless · Postgres · Valkey · Tika · Gotenberg
   └─ age key + Filecoin wallet (sealed) bootstrap: restore ◄── Filecoin Onchain Cloud
                                          daily backup ──► (3 providers, Europe)
 [Start] ─► deploy ─► measure ─► inject secrets ─► https://…/  ─► [Stop] ─► backup ─► erase
```

1. **Start:** the PWA signs an INSTANCE message with the derived Aleph account, asks for a confidential node, checks the launch measurement against the image's manifest, and only then injects the disk key and the secrets.
2. **Restore:** the guest fetches the newest encrypted export from Filecoin, decrypts it, and imports it into an empty Paperless. Then the web UI comes up behind Caddy on HTTPS.
3. **Run:** Paperless as you know it, including its mail rules; the backup runs as on the Mac today.
4. **Stop:** a last backup, then the VM is erased. An idle timer does the same if you forget.

Every step as a sequence diagram, the attestation and unlock included: [docs/workflow.md](docs/workflow.md).

## Plan

| Step | What | Where |
|---|---|---|
| 1 | **Confidential VMs in relay-button:** choose an SEV-SNP node, encrypted rootfs, measure before the secret goes in; release | [NiKrause/relay-button#154](https://github.com/NiKrause/relay-button/issues/154) |
| 2 | **Paperless rootfs:** Docker, the compose stack, Caddy, the backup script; deployed through relay-button's Actions path on a confidential node, archive restored by hand — proves image, performance and restore | here (#1) |
| 3 | **Guest bootstrap:** take the launch secret, restore from Filecoin, backup before erase, idle shutdown | here (#2) |
| 3b | **Security audit:** attestation and unlock, secrets in the guest, network exposure (IPv4 and IPv6), supply chain, backup and restore, erase. Before real documents and before the PWA | here (#9) |
| 4 | **PWA:** unlock with YubiKey or seed, derive keys, start and stop with one button, from any device | here, on `@le-space/core` / `@le-space/browser` (#3) |
| 5 | **Hardening:** own domain, Paperless two-factor login | here (#4) |
| 6 | **Akash** as a second target: the same compose stack as a multi-service SDL | here, after [akash-deploy-pwa](https://github.com/Le-Space/akash-deploy-pwa) (#5) |

## If this becomes a product

Customers buy packages from Le Space with fiat (card, SEPA, …) or crypto; Le Space buys the Aleph credits and USDFC the packages consume and keeps a margin (#6). Each customer's usage is paid from a prepaid account derived from *their* master secret and topped up by Le Space, so a package cannot be overspent and Le Space never holds a customer key or sees an archive (#7).

## Keys

A random **master secret** is sealed by each passkey (WebAuthn PRF, e.g. a YubiKey) and by the 24-word recovery phrase; either opens it, and more passkeys can be added (one per address or device). Nothing secret is stored unsealed, and the master secret lives only in the browser's memory.

From the master secret, by HKDF with distinct labels: the **app key** (Aleph), the **Filecoin session key**, the **backup key** (age), the **Paperless passwords**. The app key and the session key are delegates: they act for your own wallet, which keeps the money and can revoke them. They hold nothing.

What lives where, what holds money, and what to do when a passkey, a device or the words are lost: [docs/keys-and-recovery.md](docs/keys-and-recovery.md). Fetching a backup without a VM: [docs/restore-yourself.md](docs/restore-yourself.md).

What a VM gets and from whom, what the image contains, and why one vault's VM, balance and backups stay separate from another's: [docs/security-model.md](docs/security-model.md).

In preparation, an image sealed with a passphrase only your vault knows, made by a measured builder: [docs/own-image.md](docs/own-image.md).

The variants of confidential VMs we know, what each measures and who holds which key: [docs/confidential-vm-variants.md](docs/confidential-vm-variants.md).

## What this does not protect against

- A bug in the CPU's SEV-SNP or in the hypervisor that breaks confidentiality.
- Losing every passkey and the 24 words: the backups made with the vault's key are lost (your money is not; it stays in your wallet).
- Someone with your unlocked device while a session is open.

## Related

- [paperless-backup-filecoin](https://github.com/Le-Space/paperless-backup-filecoin) — the encrypted backup this restores from
- [relay-button](https://github.com/NiKrause/relay-button) — Aleph VM deployment from the browser
- [akash-deploy-pwa](https://github.com/Le-Space/akash-deploy-pwa) — Akash deployment from the browser
- [aleph-rs](https://github.com/aleph-im/aleph-rs) — Aleph SDK with SEV / SEV-SNP attestation

## License

MIT — by [Le Space](https://github.com/Le-Space).

## The rootfs (step 2, #1)

`rootfs/build-image.sh` builds the image: Debian 12 with systemd, Docker and the compose plugin, Caddy, age, and the stack in `/opt/paperless/compose.yml` (Paperless, Postgres, Valkey, Tika, Gotenberg). The workflow *Paperless rootfs* hands it to relay-button's `aleph-confidential-rootfs` action, which makes it confidential and encrypts it, then publishes it as an Aleph STORE.

- The containers are pulled after the unlock, so the image stays small. Docker uses vfs and the host network, because the confidential guest kernel has no overlayfs, bridge or nftables.
- Every service binds to 127.0.0.1. The guest has no firewall and a public IPv6 address. Only Caddy faces the network, and sshd when a test sent a key with the unlock (on a productive instance only if the unlock asks for it explicitly, which the app never does); `paperless-anywhere-check` fails if anything else does.
- `paperless-secrets` takes the database password, `PAPERLESS_SECRET_KEY` and the admin password from `/tmp/secrets` when they came with the unlock. Otherwise it makes them once on the encrypted disk.
- `paperless-https <hostname>` writes the Caddyfile for `https://<hostname>`, restarts Caddy and recreates the Paperless container with `PAPERLESS_URL`. Without it, Django refuses logins from that origin (CSRF).
- `paperless-manage <args>` runs a Paperless management command (`document_importer`, `document_thumbnails`, `shell`, …) in a one-off container. `docker exec` does not work in the confidential guest, because Docker runs inside the measured init's chroot. For the same reason the image's healthcheck is turned off.

Every image has a passphrase of its own, and the app keeps it together with the image's hash: another image is saved only with its passphrase, and a start refuses a passphrase entered for another image.

- **A release image** (purpose `release`) is built on a GitHub-hosted runner. The job makes a random passphrase and prints it in the run's summary, encrypted with [age](https://age-encryption.org) to the recipient in the repository variable `IMAGE_KEY_RECIPIENT`. Make the key pair once with `age-keygen -o image-key.txt`, set the variable to its public key (`age1…`), and read a passphrase with `age -d -i image-key.txt`. It is no GitHub secret, and no test gets it.
- **A test image** (purpose `test`, the default) uses the secret `PAPERLESS_LUKS_PASSPHRASE`, as the live tests do. It is for tests only.

The workflow needs the `ALEPH_PRIVATE_KEY` secret, and `PAPERLESS_LUKS_PASSPHRASE` for test images. The image carries no SSH key: a test that needs SSH sends its own public key with the unlock, as the secret `authorized_keys`, which the confidential init adds for root. The app never sends one. `pwa/scripts/live-debug-start.mjs` starts a VM the way the app does, with such a key, for diagnosis.
