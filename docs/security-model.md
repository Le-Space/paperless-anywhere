# Security model: what a VM gets, and from whom

Paperless anywhere runs one Paperless per vault, on demand, in a confidential
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
