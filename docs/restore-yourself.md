# Fetching a backup yourself

A backup can be read without a VM, without this app and without Le Space. Two things are enough: the **addresses** the backup's pieces are stored at, and the **backup key** (age) that opens it. The app hands out both under **Sicherung selbst holen**, below the choice of the backup to start from (expert view).

Use it when you want your documents on your own computer, when you leave, or to convince yourself that the backup is really yours.

## What the app gives you

| Button | File | What it is |
|---|---|---|
| Anleitung speichern | `sicherung-selbst-holen-….txt` | the commands below, filled in with this backup's addresses |
| Eintrag speichern | `ledger.json` | this backup's entry (piece CIDs, copies, size) in the format of [paperless-backup-filecoin](https://github.com/Le-Space/paperless-backup-filecoin) |
| Schlüssel anzeigen | shown on screen, then copied or saved as `schluessel.txt` | the backup key, one line starting with `AGE-SECRET-KEY-1` |

Neither the instructions nor the entry contain anything secret: a piece's address is public, and what is stored there is encrypted.

**The key is different.** It opens every backup made with it, past and future. The app shows it only after you tick that you want it, hides it again when you close the panel, and writes it nowhere on its own. Treat `schluessel.txt` like the 24 words, and delete it when you are done. If your vault uses its own key (the default), the 24 words derive it again at any time; a key you pasted in yourself is only where you keep it ([the backup key](keys-and-recovery.md#the-backup-key)).

## By hand: curl and age

You need `curl` and [age](https://age-encryption.org).

```bash
# 1. download (any one copy; all hold the same)
curl -fL -o sicherung.age 'https://sp-a.example.com/piece/bafkzcib…'

# 2. decrypt
age -d -i schluessel.txt sicherung.age > paperless-export.zip
```

A large backup is stored in several parts. The instructions then list one download per part and one more step that puts them together in order, before decrypting:

```bash
cat teil-01.age teil-02.age teil-03.age > sicherung.age
```

The result is a zip with your documents (originals and archive PDFs) and `manifest.json`, as Paperless-ngx's `document_exporter` writes it. It opens without Paperless-ngx; an empty Paperless-ngx takes it in with `document_importer`.

## With the tool

[paperless-backup-filecoin](https://github.com/Le-Space/paperless-backup-filecoin) downloads, joins and decrypts in one step. Put the saved `ledger.json` next to it, point `AGE_IDENTITY_FILE` at `schluessel.txt`, and run:

```bash
node backup.mjs restore <pieceCid> paperless-export.zip
```

## If an address does not answer

Each backup is stored at more than one provider; the instructions list every copy the app knows. If the app knows no address for a piece, it says so in the file; open the app again later, it reads the addresses from the chain each time. A backup whose storage has run out and was removed by the providers cannot be fetched any more, by anyone.
