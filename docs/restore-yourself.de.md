# Sicherung selbst holen

*English: [Fetching a backup yourself](restore-yourself.md)*

Eine Sicherung lässt sich ohne VM, ohne diese App und ohne Le Space lesen. Zwei Dinge genügen: die **Adressen**, an denen die Stücke der Sicherung liegen, und der **Sicherungsschlüssel** (age), der sie öffnet. Beides gibt dir die App unter **Sicherung selbst holen (ohne laufende Instanz)**: unter **Erweitert**, in der Paperless-Karte, unterhalb der Wahl der Sicherung für den Start.

Nutze das, wenn du deine Dokumente auf deinem eigenen Rechner haben willst, wenn du gehst, oder um dich zu überzeugen, dass die Sicherung wirklich dir gehört.

## Was dir die App gibt

| Knopf | Datei | Was es ist |
|---|---|---|
| Anleitung mit den Adressen speichern | `sicherung-selbst-holen-….txt` | die Befehle unten, ausgefüllt mit den Adressen dieser Sicherung |
| Eintrag für das Werkzeug (ledger.json) | `ledger.json` | der Eintrag dieser Sicherung (Piece-CIDs, Kopien, Größe) im Format von [paperless-backup-filecoin](https://github.com/Le-Space/paperless-backup-filecoin) |
| Holen und entschlüsseln | `paperless-export-….zip` | die entschlüsselte Sicherung, vom Browser geholt ([unten](#im-browser)) |
| Schlüssel anzeigen | auf dem Bildschirm, dann kopiert oder als `schluessel.txt` gespeichert | der Sicherungsschlüssel, eine Zeile, beginnt mit `AGE-SECRET-KEY-1` |

Weder die Anleitung noch der Eintrag enthält etwas Geheimes: Die Adresse eines Stücks ist öffentlich, und was dort liegt, ist verschlüsselt.

**Beim Schlüssel ist das anders.** Er öffnet jede Sicherung, die mit ihm gemacht wurde, frühere und künftige. Die App zeigt ihn erst, wenn du ankreuzt, dass du ihn sehen willst, verbirgt ihn wieder, wenn du den Bereich schließt, und schreibt ihn von sich aus nirgendwohin. Behandle `schluessel.txt` wie die 24 Wörter und lösche die Datei, wenn du fertig bist. Nutzt dein Tresor seinen eigenen Schlüssel (die Voreinstellung), leiten ihn die 24 Wörter jederzeit wieder ab; einen selbst eingefügten Schlüssel gibt es nur dort, wo du ihn aufbewahrst ([der Sicherungsschlüssel](keys-and-recovery.md#the-backup-key), englisch).

Die Dateinamen folgen der Sprache der App: Auf Englisch heißen sie `fetch-backup-yourself-….txt`, `key.txt`, `backup.age` und `part-01.age`; die Befehle sind dieselben.

## Im Browser

**Holen und entschlüsseln** erledigt alles in einem Schritt, in der App: Der Browser lädt die Stücke bei den Speicheranbietern, setzt sie zusammen, entschlüsselt sie auf deinem Gerät und schreibt das Zip. Es läuft keine VM, und der Schlüssel verlässt den Browser nicht: Er steht in keiner Adresse, keinem Header und keinem Speicher.

- Chrome und Edge schreiben direkt in eine Datei, die du auswählst; die Größe der Sicherung spielt dann keine Rolle.
- Safari und Firefox können das nicht. Dort wird das Ergebnis erst im Arbeitsspeicher gehalten, bis 512 MB gespeicherte Sicherung; für eine größere nimm Chrome oder Edge oder die Befehle unten.
- Antwortet ein Anbieter nicht, wird die nächste Kopie gefragt; bricht ein Download ab, macht eine andere Kopie an derselben Stelle weiter, wo das geht.
- age prüft jeden Block. Eine Sicherung, die beschädigt oder unvollständig ankommt, wird abgelehnt, und es bleibt keine halbe Datei zurück.

Lass das Fenster offen, bis „Fertig“ dasteht.

## Von Hand: curl und age

Du brauchst `curl` und [age](https://age-encryption.org).

```bash
# 1. herunterladen (eine beliebige Kopie; alle enthalten dasselbe)
curl -fL -o sicherung.age 'https://sp-a.example.com/piece/bafkzcib…'

# 2. entschlüsseln
age -d -i schluessel.txt sicherung.age > paperless-export.zip
```

Eine große Sicherung liegt in mehreren Teilen. Die Anleitung nennt dann einen Download je Teil und vor dem Entschlüsseln einen weiteren Schritt, der die Teile in der richtigen Reihenfolge zusammensetzt:

```bash
cat teil-01.age teil-02.age teil-03.age > sicherung.age
```

Heraus kommt ein Zip mit deinen Dokumenten (Originale und Archiv-PDFs) und `manifest.json`, so wie der `document_exporter` von Paperless-ngx es schreibt. Es lässt sich ohne Paperless-ngx öffnen; ein leeres Paperless-ngx nimmt es mit `document_importer` auf.

## Mit dem Werkzeug

[paperless-backup-filecoin](https://github.com/Le-Space/paperless-backup-filecoin) lädt, prüft, setzt zusammen und entschlüsselt in einem Schritt. Lege die gespeicherte `ledger.json` daneben, setze `AGE_IDENTITY_FILE` auf `schluessel.txt` und führe aus:

```bash
node backup.mjs restore <pieceCid> paperless-export.zip
```

Bei einer Sicherung in Teilen ist `<pieceCid>` die des ersten Teils.

## Inkrementelle Sicherungen

Alles oben gilt für eine vollständige Sicherung, wie sie die VM macht, solange „Nur Änderungen sichern (inkrementell)“ in den Sicherungseinstellungen nicht eingeschaltet ist. Eine inkrementelle Sicherung ist ein *Paket*: Sein Stück beginnt vor dem age-Strom mit einem öffentlichen Vorspann von 64 Bytes (`PA-SNAP/1 <Generation> <Nummer>`) und enthält nur, was sich seit dem Paket davor geändert hat. Wiederherstellen lässt sie sich nur mit jedem Paket ihrer Generation bis zu ihr. Die VM macht das mit `restore-snapshot` des Sicherungswerkzeugs; die Anleitung, der Eintrag und **Holen und entschlüsseln** in der App können Pakete noch nicht.

## Wenn eine Adresse nicht antwortet

Jede Sicherung liegt bei mehr als einem Anbieter; die Anleitung nennt jede Kopie, die die App kennt. Kennt die App für ein Stück keine Adresse, steht das in der Datei; öffne die App später noch einmal, sie liest die Adressen jedes Mal von der Chain. Eine Sicherung, deren Speicher abgelaufen ist und die die Anbieter gelöscht haben, kann niemand mehr holen.

Wie ein Anbieter beweist, dass er eine Kopie noch hat: [Woher weiß ich, dass meine Sicherung noch da ist?](backup-proofs.md) (englisch)
