# Security model: what a VM gets, and from whom

Paperless anywhere runs one Paperless per vault, around the clock or on demand, in a confidential
virtual machine (AMD SEV-SNP) on Aleph. Everyone runs the same image. This
page describes where a VM's secrets come from, what the image contains, and
why one person's VM, balance and backups stay separate from another's.

How this design compares with others (a measured root filesystem, a virtual
TPM, Intel TDX, the large clouds), and what each one proves:
[confidential VMs, the variants](confidential-vm-variants.md).

## One vault, one identity

A vault is opened with a passkey or with its 24 words
([keys and recovery](keys-and-recovery.md)). It holds a random master secret,
in the browser's memory only while it is open. Every key below is derived
from that master with HKDF, each under its own label:

| Derived from the master | Used for |
|---|---|
| the app key (an Ethereum address) | signs the VM's INSTANCE and FORGET on Aleph; is the *owner* written into the VM's measured boot command line; with "Diese App selbst" it also holds the Aleph credits that pay the VM; it is the address Le Space Credits are booked to |
| the profile key | seals the setup (image passphrase, backup settings, age identity, DNS token, running VM) before it is stored on Aleph |
| the Paperless secrets | admin password, database password, `PAPERLESS_SECRET_KEY` |
| the Filecoin session key | adds backup pieces to the owner's data sets; the owner's wallet authorizes it for a limited time |
| the VM backup key | with backups paid through Le Space Credits: the VM signs its requests to the service with it, and the service signs each backup step with Le Space's session key, only for this account's own data sets, within the paid time and quota; it holds nothing and has no right on chain |
| the vault's own age identity (optional) | encrypts the backups, if no age identity was pasted in |

A second vault has a different master, so every one of these is different:
another address, another balance, other secrets, other backups.

## Where a VM's secrets come from

The image holds no secrets. A VM gets them once, at unlock, from the app of
the person who starts it:

1. The app computes the VM's launch measurement itself (firmware, kernel,
   initrd and a boot command line naming the vault's app key as owner) and
   writes it into the INSTANCE message.
2. Before it hands over anything, the app checks the VM's SEV-SNP
   attestation report against AMD's keys, against that measurement and
   policy, and against a fresh nonce bound to the TLS key the VM serves.
3. Only then, over that attested TLS channel, it sends the secrets, signed
   by the vault's app key. The VM's agent accepts them only with that
   owner's signature, and only for this boot.

What is sent: the image passphrase (to open the disk), the Paperless secrets,
the Filecoin session key and backup settings, the DNS token for the fixed
address (if one is set), and, for a restore, the chosen backup and the age
identity that opens it. The VM fetches no secret from anywhere else.

## What the image contains, and what it does not

**Contains:** Debian, Docker, Caddy, the compose file with container images
pinned by digest, the scripts that start, restore, back up and stop
Paperless, and the backup tool's code. The image is encrypted (LUKS); its
passphrase opens the disk, but there is nothing personal to find on it.

**Does not contain:** mail credentials or IMAP tokens, any age key, any list
or index of backups, any Le Space account or wallet key, any SSH key (root's
`authorized_keys` holds a comment only).

Mail accounts and their passwords exist only inside a person's Paperless
database, so only inside that person's running VM and their encrypted backups.

## Backups

- A backup is exported, encrypted with age **inside the VM**, to the owner's
  age recipient, and only then uploaded to Filecoin storage providers. The
  plaintext export is removed in the VM afterwards.
- The pieces on Filecoin are public by address, as on any public storage;
  without the owner's age identity they cannot be decrypted.
- A restore downloads a piece, checks it against its piece CID (a hash of its
  content) and decrypts it with the age identity that came with the unlock.
  Another vault's VM receives another identity, so a restore of someone
  else's backup fails at decryption.
- The session key can only add pieces, to the data sets of the wallet that
  authorized it, and expires. It cannot delete pieces.
- With backups paid through Le Space Credits, Le Space's one Filecoin payer
  owns the data sets of every customer; each carries the account's tag in its
  metadata, which does not name the account. The VM's backup key only asks
  the service to sign; the service checks the account, the paid time, the
  quota and that the data set is the account's own before it signs.
- The VM wipes the age identity and the restore entry once the restore is
  done.

## On the VM

- The DNS token for the fixed address is needed for the records and the
  certificate only. The VM zeroes and removes it once the address is ready
  or given up, and again if a later hand-over brings it back.
- What Paperless writes goes onto a disk area encrypted with a key the VM
  makes at boot and keeps in memory only. If that area cannot be made, Paperless
  does not start.
- sshd starts only when a public key came with the unlock, which a test does
  and the app never. A productive instance needs more than a key: the unlock
  must ask for sshd explicitly, which only one live test does. The image
  itself carries no key.
- Postgres, Valkey, Tika, Gotenberg and Paperless listen on the VM's loopback
  only; Caddy serves HTTPS. Caddy's admin interface is off.
- A stop backs up first and erases the VM only when every requested copy has
  arrived.

## The relay

A browser cannot open a plain TCP connection, so the app reaches the guest's
attestation port through a relay: WebSocket on the browser's side, TCP on
the guest's ([workflow](workflow.md), sections 3 and 5).

- **Not attested.** The relay runs in an ordinary VM on Aleph. Nobody checks a
  measurement of it, and nothing in the design needs to.
- **What it cannot do.** Read or change what passes. The TLS connection ends
  inside the guest, the AMD report binds the guest's TLS key, and every check
  runs in the browser (`@le-space/attest-wasm`). A relay that tampered would
  make the attestation fail; it would not get a secret.
- **What it can do.** Refuse or delay connections, and so block a start, an
  unlock or a check.
- **What it sees.** The browser's IP address, which VM on which node is asked
  for and when (both are in the address the app calls), and how much data
  flows.
- **Which relays the app uses.** Only relays that Aleph lists as a running
  instance of one of two accounts Le Space pays its relays from
  (`TRUSTED_RELAY_OWNERS` in `pwa/src/lib/relays.js`), each under its
  instance's own name at Aleph's gateway; or a relay the person enters in the
  setup.
- **What it connects to.** Only addresses it looked up itself in Aleph's node
  list, never a host the caller names, and only public ones: it is no open
  proxy. By default it closes a connection after 4 MiB in one direction or
  120 seconds, and allows 4 connections per caller and 256 in all. These are
  the defaults in its source; the settings of the relay in use were not
  checked for this page.
- **Availability.** It is one of the things that still depend on Le Space. If
  no relay of Le Space's answers, nobody can start or unlock unless they enter
  a relay of their own.
- **Source.** The relay is `packages/attest-relay` in
  [NiKrause/relay-button](https://github.com/NiKrause/relay-button/tree/main/packages/attest-relay)
  (`src/relay.ts`: the lookup of the target and the limits). Reached over
  libp2p, a bridge in
  [NiKrause/orbitdb-relay](https://github.com/NiKrause/orbitdb-relay/blob/main/src/services/attest-bridge-service.ts)
  hands the stream to that same relay on the same machine. The relay VM's
  image is built from
  [`packages/rootfs/reference/orbitdb-relay`](https://github.com/NiKrause/relay-button/tree/main/packages/rootfs/reference/orbitdb-relay)
  in relay-button. Whether the image in use is published with a hash was not
  checked.

## Your own device

Encryption and the confidential VM protect the documents from the node, from
the storage providers and from Le Space. They do not protect a vault that is
open in a browser from that browser. This holds for every web app, and for
every password manager that runs in a browser.

- **What can read along.** While the vault is open, its master secret is in
  the page's memory. A browser extension with access to the page, or malware
  on the device, can read the passkey's answer at the moment of unlocking, or
  the open vault. With the master secret it can do what the app can: start
  and stop the VM, read the setup, derive the Paperless passwords and the
  backup key.
- **What it cannot.** It does not get the passkey itself: the passkey's key
  stays in the authenticator, and every answer needs the person's approval
  (the app asks for user verification: fingerprint, face or PIN). A wallet's
  seed is not in the vault either, so the money in a wallet stays out of
  reach; what the app key itself can spend (the Le Space balance on hours
  and backups, Aleph credits held by the app's address) does not
  ([keys and recovery](keys-and-recovery.md)).
- **Passkeys are bound to the address.** A passkey made on
  `paperless.le-space.de` answers only there; a page on another address gets
  no answer from it. The 24 words have no such binding: whoever is given
  them has the vault. Enter them only in the app at its own address, and keep
  them offline.
- **Backups and a key that was once read.** The backup key is derived from
  the vault (or was pasted in), and the pieces on Filecoin can be fetched by
  anyone who knows their address. Whoever once had the key can therefore
  decrypt the backups made with it, earlier ones included, for as long as
  they are stored. A new passkey does not change that: it opens the same
  vault with the same keys. Only a new vault has new keys.
- **What Le Space cannot do.** Le Space has no copy of the master secret, the
  24 words or the backup key. If the passkeys and the words are lost, nobody
  can open the vault or decrypt its backups.

What the app does on its side: every page carries a content security policy
(`pwa/svelte.config.js`). It runs only the scripts of its own build (no inline
script except the start-up one, by hash; no `eval`), loads no script, style,
font or plugin from elsewhere, connects only over TLS, and frames nothing but
the credits service's payment page. That narrows what an injected script
could do; it does not stop an extension, which runs outside the page's policy.

What helps, in this order:

1. A browser profile of its own, without extensions, for Paperless anywhere;
   install the app (PWA) in that profile. The installed app is not a
   protection by itself: in Chrome the profile's extensions run in it too.
2. Or a private window (extensions are off there unless allowed), a phone or
   a tablet.
3. The 24 words on paper, entered nowhere but in the app at
   `paperless.le-space.de`. Look at the address before you do.
4. Lock the vault when done ("Sperren": the app drops the master secret) and
   lock the device.

## Money

- **Aleph credits** pay the VM. With "Diese App selbst", they sit on the
  vault's app address, so whoever opens the vault can spend them.
- **Le Space Credits** are booked to the same address (1 credit = 1 euro
  cent). Packages and extra hours turn them into Aleph credits on that
  address. One vault's balance never pays another's VM.
- **Filecoin storage** is paid from the backup wallet's deposit in Filecoin
  Pay.

## Reporting

Please report a weakness privately to the maintainer, not in an issue.
