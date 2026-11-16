# How do I know my backup is still there?

Paperless anywhere keeps its backups with storage providers on Filecoin, through
**Filecoin Warm Storage** (Filecoin Onchain Cloud). Every provider that holds a
copy has to prove, again and again, that it still has it: **Proof of Data
Possession (PDP)**. The proofs are checked by a contract on the Filecoin chain,
not by Le Space and not by the provider. A provider that does not prove in time
is recorded as faulted, in public, and is not paid for that time.

This page explains how that works, with the parameters as the contracts hold
them, and what it does not prove.

## In short

- Your backup is encrypted in your VM, with the key from your vault, before it
  leaves the VM. A provider only ever stores ciphertext.
- Each copy is a *piece* in a *data set* at one provider. When the piece is
  added, its fingerprint (the piece commitment) is recorded on the chain.
- At least once a day (on mainnet) the contract draws random places in the data set. The
  provider must show exactly those bytes, with a proof that they belong to the
  recorded fingerprint. Without the data it cannot.
- The warm storage contract pays the provider only for periods with a valid
  proof. A missed proof is a fault on the chain.

## See it yourself in the app

The app reads the state of each copy from the chain itself, without asking
the provider:

- **Overview:** "What the chain says",
  folded under the status card once the list of backups is read; it shows the
  backup chosen for the start, else the vault's newest.
- **Advanced:** the same in "At the start", under the chosen backup.

One line per copy, "Copy at provider N (place) · data set M", with
**Check now**: whether the data set is active and still holds
this backup's pieces, the last proof, the next challenge, missed proofs over
the last 30 completed proving periods (about 30 days on mainnet), and until
when the copy is paid. The proving period is read from the warm storage
service (`getPDPConfig`), not built in.

Green means **read from the chain by the app itself**, through a public node.
The proofs themselves are checked by the contract, not by the app. Blue means
only reported by the provider, red a problem, grey no value.

## How it works, step by step

### 1. Leaves of 32 bytes

The data is cut into **leaves of 32 bytes**. Before that it is padded so that
every leaf fits into the number field of the proof system: 2 zero bits are
inserted after every 254 bits ("FR32"), so a leaf carries 254 bits of data.

### 2. A Merkle tree and its root

The leaves are hashed pairwise, level by level, into a binary **Merkle tree**.
The hash is SHA-256 cut to 254 bits. The root of that tree is the **piece
commitment**; written as a content address it is the **piece CID**, with the
multihash `fr32-sha2-256-trunc254-padded-binary-tree` (0x1011, FRC-0069). The
root is recorded when the piece is added to the data set, and from then on
every proof is checked against it.

A change in any leaf changes the root. So a provider that kept "something else"
cannot answer for the recorded root.

### 3. Challenges no one can foresee

For each proving period the PDP verifier draws a **seed from the chain's
randomness beacon** (drand, through the Filecoin VM's beacon randomness) at an
epoch in the future. From the seed it derives the leaves to show:

```
challengeIdx = keccak256(seed, dataSetId, i) mod leafCount     for i = 0 … k−1
```

`leafCount` is the number of leaves in the whole data set. Nobody knows the
seed before that epoch, the provider included, so it cannot keep only the
parts that will be asked for.

### 4. The proof and its check

The provider answers each challenge with the **leaf** and its **Merkle path**:
the sibling hashes from the leaf up to the root of its piece. The contract
hashes the path itself and compares the result with the recorded root. The
proof is a few kilobytes, however large the data; only a provider that holds
the data can produce it.

### 5. Periods, deadlines and pay

The warm storage service sets how often and how many:

| | Filecoin mainnet | Calibration (test network) |
|---|---|---|
| Proving period (at most) | 2880 epochs = **24 hours** | 240 epochs = 2 hours |
| Window for the proof | 60 epochs = **30 minutes** | 20 epochs = 10 minutes |
| Challenges per proof `k` | **5** | 5 |

An epoch is 30 seconds. Values as read from the contracts on 2026-11-16
(`getPDPConfig()` of the warm storage view contract; mainnet
`0xcf184Ab1FD8D1a563054d30Aa1fFb08136998172`, Calibration
`0x1B68d64f01bAa42014B9774605867BF4eDC0320f`). The 5 challenges are the
constant `CHALLENGES_PER_PROOF` of the service.

When a period ends without a proof, the service emits `FaultRecord` for the
data set. When the provider's payment is settled, the service pays **only for
epochs in proven periods**; a faulted period pays nothing.

## How fast a loss shows

Say a share `f` of the data set is missing or damaged. Each challenge lands on
a missing leaf with probability `f`, independently. With `k` challenges per
period the loss shows in one period with probability

```
P(one period) = 1 − (1 − f)^k
```

and within `n` periods with `1 − (1 − f)^(k·n)`. With `k = 5` and one period a
day on mainnet:

| Share missing `f` | within 1 day | within 7 days | within 30 days |
|---|---|---|---|
| 100 % (the copy is gone) | 100 % | 100 % | 100 % |
| 10 % | 41 % | 97.5 % | > 99.99 % |
| 1 % | 4.9 % | 30 % | 78 % |
| 0.1 % | 0.5 % | 3.4 % | 14 % |

A copy that is gone shows at the next proof. A small damage takes longer to
show, which is one reason for several copies with different providers.

## Words used (English and German)

The landing page, this page and the app use the same words; the German ones
are what the German app and landing page say:

| English | Deutsch | What it is |
|---|---|---|
| proof | Beweis | what a provider submits for a data set in a proving period |
| challenge | Stichprobe | one leaf the contract asks for, drawn at random |
| proving period | Beweisperiode | the time within which a proof is due (mainnet: at most 24 h) |
| challenge window | Beweisfenster | the last part of a period in which the proof must arrive (mainnet: 30 min) |
| data set | Datensatz | what one provider keeps for one owner: the backups' pieces |
| piece | Stück | one backup (or one part of a large one) in a data set |
| piece CID | Piece-CID (Inhaltsadresse des Stücks) | the content address of a piece, the root of its Merkle tree |
| leaf | Blatt | 32 bytes of a piece |
| fault | Fehler (verpasster Beweis) | a period that ended without a valid proof |

## What PDP does not prove

- **That the provider hands the data out.** PDP proves possession, not
  retrieval. That is why Paperless anywhere keeps several copies with different
  providers (with a package or a voucher three by default, with providers in the EU), and why you can fetch
  a backup yourself at any time ([fetching a backup yourself](restore-yourself.md)).
- **Anything in between two proofs.** A loss is found by the challenges that
  follow it, as the table above shows; not at the moment it happens.
- **What is inside.** The providers and the contract see ciphertext and
  hashes. Your documents are encrypted in your VM with the key from your vault
  (age) before they are uploaded; see [keys and recovery](keys-and-recovery.md).

## Sources

- PDP verifier, challenges, beacon randomness and Merkle check:
  [FilOzone/pdp, `src/PDPVerifier.sol`](https://github.com/FilOzone/pdp/blob/main/src/PDPVerifier.sol)
- Proving periods, `FaultRecord` and payment only for proven epochs (`validatePayment`):
  [FilOzone/filecoin-services, `FWSSProvingModule.sol`](https://github.com/FilOzone/filecoin-services/blob/82fb9789289182f9cda934362609953c1c031c31/service_contracts/src/modules/FWSSProvingModule.sol)
- `CHALLENGES_PER_PROOF = 5`:
  [FilOzone/filecoin-services, `FWSSConstants.sol`](https://github.com/FilOzone/filecoin-services/blob/main/service_contracts/src/lib/FWSSConstants.sol)
- Piece CID and FR32: [`@filoz/synapse-core`, `piece`](https://github.com/FilOzone/synapse-sdk/tree/master/packages/synapse-core/src/piece) and [FRC-0069](https://github.com/filecoin-project/FIPs/blob/master/FRCs/frc-0069.md)
- Overview: [Filecoin docs, PDP](https://docs.filecoin.io/provide-storage/pdp/about)
