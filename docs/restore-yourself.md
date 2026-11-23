# Fetching a backup yourself

*Deutsch: [Sicherung selbst holen](restore-yourself.de.md)*

A backup can be read without a VM, without this app and without Le Space. Two things are enough: the **addresses** where the backup's pieces are stored, and the **backup key** (age) that opens it. The app hands out both under **Fetch a backup yourself (without a running instance)**: in **Advanced**, in the Paperless card, below the choice of the backup to start from.

Use it when you want your documents on your own computer, when you leave, or to convince yourself that the backup is really yours.

## What the app gives you

| Button | File | What it is |
|---|---|---|
| Save the guide with the addresses | `fetch-backup-yourself-….txt` | the commands below, filled in with this backup's addresses |
| Entry for the tool (ledger.json) | `ledger.json` | this backup's entry (piece CIDs, copies, size) in the format of [paperless-backup-filecoin](https://github.com/Le-Space/paperless-backup-filecoin) |
| Fetch and decrypt | `paperless-export-….zip` | the decrypted backup, fetched by the browser ([below](#in-the-browser)) |
| Show the key | shown on screen, then copied or saved as `key.txt` | the backup key, one line starting with `AGE-SECRET-KEY-1` |

Neither the guide nor the entry contains anything secret: a piece's address is public, and what is stored there is encrypted.

**The key is different.** It opens every backup made with it, past and future. The app shows it only after you tick that you want to see it, hides it again when you close the panel, and writes it nowhere on its own. Treat `key.txt` like the 24 words, and delete it when you are done. If your vault uses its own key (the default), the 24 words derive it again at any time; a key you pasted in yourself exists only where you keep it ([the backup key](keys-and-recovery.md#the-backup-key)).

The file names follow the app's language; with the app in German they are named in German ([German version of this page](restore-yourself.de.md)). The commands are the same.

## In the browser

**Fetch and decrypt** does it in one step, in the app: the browser downloads the pieces from the storage providers, joins them, decrypts them on your device and writes the zip. No VM runs, and the key does not leave the browser: it is in no address, no header and no storage.

- Chrome and Edge write straight into a file you pick, so the size of the backup does not matter.
- Safari and Firefox cannot do that. There the result is held in memory first, up to 512 MB of stored backup; for a larger one use Chrome or Edge, or the commands below.
- If a provider does not answer, the next copy is asked; if a download breaks off, another copy continues at the same byte where it can.
- age checks every block. A backup that arrives damaged or cut short is refused, and no half file is left behind.

Keep the window open until it says "Done".

## By hand: curl and age

You need `curl` and [age](https://age-encryption.org).

```bash
# 1. download (any one copy; all hold the same)
curl -fL -o backup.age 'https://sp-a.example.com/piece/bafkzcib…'

# 2. decrypt
age -d -i key.txt backup.age > paperless-export.zip
```

A large backup is stored in several parts. The guide then lists one download per part and one more step that joins them in order, before decrypting:

```bash
cat part-01.age part-02.age part-03.age > backup.age
```

The result is a zip with your documents (originals and archive PDFs) and `manifest.json`, as Paperless-ngx's `document_exporter` writes it. It opens without Paperless-ngx; an empty Paperless-ngx takes it in with `document_importer`.

## With the tool

[paperless-backup-filecoin](https://github.com/Le-Space/paperless-backup-filecoin) downloads, checks, joins and decrypts in one step. Put the saved `ledger.json` next to it, point `AGE_IDENTITY_FILE` at `key.txt`, and run:

```bash
node backup.mjs restore <pieceCid> paperless-export.zip
```

For a backup in parts, `<pieceCid>` is the first part's.

## Incremental backups

Everything above is for a full backup, the kind the VM makes unless "Back up only changes (incremental)" is switched on in the backup settings. An incremental backup is a *pack*: its piece starts with a public prefix of 64 bytes (`PA-SNAP/1 <generation> <number>`) before the age stream, and it holds only what changed since the pack before it. Restoring one takes every pack of its generation up to it. The VM does that with the backup tool's `restore-snapshot`; the guide, the ledger entry and **Fetch and decrypt** in the app do not handle packs yet.

## If an address does not answer

Each backup is stored with more than one provider; the guide lists every copy the app knows. If the app knows no address for a piece, it says so in the file; open the app again later, it reads the addresses from the chain each time. A backup whose storage has run out and was removed by the providers cannot be fetched any more, by anyone.

How a provider proves that it still holds a copy: [how do I know my backup is still there?](backup-proofs.md)
