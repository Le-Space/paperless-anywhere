# Keys, money and recovery

What the app keeps, where the money is, and what you need to get back in, or to lose nothing, when a passkey or a device is gone.

## The short version

- **Your money stays in your own wallet** (MetaMask or a hardware wallet): Aleph credits for the VMs and, on Filecoin, tFIL or FIL for gas and USDFC for storage. The app never sees that wallet's key.
- **The app's own addresses hold no money.** Never send anything to them. They act for your wallet, with rights you can take back.
- **The 24 words are the vault.** With them you open it on any device and any address, and they decrypt every backup the app made. Keep them on paper, away from your devices.
- **A passkey is a convenience.** It belongs to one address (`localhost` today, the hosted app later) and one authenticator. Losing it costs nothing as long as you have the 24 words.

## What exists, and where

| What | Where it lives | Holds money? | If it is lost |
|---|---|---|---|
| **Paying account** (your wallet) | MetaMask / hardware wallet, with its own seed | **yes**: credits, tFIL/FIL, USDFC | the wallet's own seed restores it; the app plays no part |
| **Master secret** | sealed twice, in this browser and on Aleph: by each passkey and by the 24 words | no | open it with the 24 words |
| **Passkey(s)** | your YubiKey or another authenticator, one per address | no | open with the 24 words, add a new passkey |
| **24 words** | on paper, with you | no | open with a passkey and create a new vault, or keep using the passkey; see below |
| **App key** (Aleph) | derived from the master secret | **no** | gone with the master secret; revoke it in step 2 |
| **Filecoin session key** | derived from the master secret | **no** | revoke it in step 3, or let it expire (30 days) |
| **Backup key** (age) | derived from the master secret | no | the 24 words derive it again |
| **Paperless passwords** | derived from the master secret | no | the 24 words derive them again |

## Where the setup is kept

Everything the app needs on every device is in a **profile**, saved with every change in the setup (and after a start or a stop). It lives **on Aleph**, not in the browser, so any device that opens the vault (passkey or 24 words) finds the same setup.

**Encrypted in the browser before it leaves:** AES-256-GCM, with a key derived from the master secret (HKDF-SHA256, label `paperless-anywhere/profile-key/v1`) and the purpose `profile` bound in as additional data (`pwa/src/lib/profile.js`, `keys/seal.js`). Without the master secret, nobody can open it: not Aleph, not a node, not this website.

**What is inside:**
- the paying account and the network;
- the attest relays;
- the image, the node, and the image's passphrase;
- the backup settings and copies, the backup wallet, and the backup key (age);
- the running VM (instance, node, address, measurements);
- the last backup and this vault's own backups.

**What Aleph sees, publicly:**
- an aggregate `paperless-anywhere-profile` under the app key's address (channel `paperless-anywhere`), holding a box of a certain size;
- when it changed, since every save is a new message;
- that the paying account authorized the app key. That is in the wallet's own `security` aggregate, so the link between the paying account and the app key is public. The content is not.

**In the browser:** only the master secret, sealed by the passkey and by the 24 words, under `localStorage`. The profile itself is not stored there. Opened keys are kept in memory only, until the app is locked or closed.

## Why the app's addresses hold no money

The **app key** and the **session key** are delegates:

- **Aleph:** your wallet authorizes the app key once (setup, step 2) to start and delete VMs and to set their port forwards **on behalf of your wallet**. The VMs are paid from your wallet's credits. Measured: the owner pays, the delegate holds nothing.
- **Filecoin:** your wallet authorizes the session key for 30 days (step 3) to create data sets and add backups. Storage is paid from your wallet.

Both rights can be taken back from your wallet at any time: "Freigabe zurücknehmen" (step 2) and "Zurücknehmen" (step 3). After that the keys can do nothing, whoever has them.

## Passkeys and addresses

A passkey is bound to the address of the app that created it: one made on `http://localhost:5180` does not open the app on `https://paperless.example`. One vault can have several passkeys:

1. Open the app on the new address (or the second device) with the **24 words**.
2. "Weiteren Passkey hinzufügen" → "Passkey für … anlegen".
3. From then on that browser opens with the new passkey. The old ones keep working where they were made.

Each passkey's sealed copy of the master secret lives on Aleph under an address that only that passkey leads to, so any of them finds the vault on a new device.

## The 24 words

They are shown once, when the vault is made, and the app asks three of them back before it continues, so they cannot be clicked past. They:

- open the vault on any device and any address, without a passkey;
- derive the **backup key**, so every backup the app made can be decrypted from the words alone, even if the profile on Aleph were gone;
- derive the app key and the Paperless passwords.

They do **not** give access to your money: that is your wallet's own seed.

## The backup key

Backups are encrypted with age before they leave the VM. By default the app uses **the vault's own key**, derived from the master secret: the setup shows "der Schlüssel des Tresors".

An existing key can be pasted instead, for example the one the Mac's backups were made with. The app then says "eingefügt": that key is **not** in the 24 words and must be kept separately, or the backups made with it are lost with it.

## What to do when …

| Situation | What to do | What is lost |
|---|---|---|
| A passkey is lost or broken | open with the 24 words, add a new passkey; optionally forget this browser on old devices | nothing |
| You move to another address (hosted app) | open there with the 24 words, add a passkey | nothing |
| A device is lost (locked) | nothing urgent: the vault needs a passkey or the words. To be sure, revoke and re-grant steps 2 and 3 | nothing |
| The 24 words are lost, the passkey still works | open with the passkey, make a new vault, move the settings, revoke the old app key; back up again under the new key | nothing, if done while the passkey works |
| Passkey **and** 24 words are lost | revoke steps 2 and 3 from your wallet | **the backups made with the vault's key**; your money is untouched |
| Your wallet's seed is lost | that is the wallet's own recovery | the money in it; the app cannot help |

## Limits, for now

- The image's disk passphrase is shared by every VM made from the same image. A passphrase per person, derived from the master secret, is planned before real documents move (security audit, #9).
- Backups from the app go to Filecoin **Calibration** only. On mainnet the Mac stays the only writer until the app has been tested with real backups.
