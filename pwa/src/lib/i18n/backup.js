// The backups: where they go (BackupPlaces), whether the providers answer
// (ProviderHealth), the state of a running Paperless's backups (BackupNow,
// backup-overview.js), fetching one without a VM (BackupExport,
// backup-fetch.js, the guide in backups.js) and the documents' storage
// (Storage, storage.js). German is the original; English beside it, key for key.
export const backup = {
	de: {
		overview: {
			title: 'Sicherung',
			last: 'Letzte Sicherung',
			none: 'Seit dem Start noch keine Sicherung',
			beforeStart: 'vor diesem Start',
			copies: (/** @type {number} */ n) => `${n} ${n === 1 ? 'Kopie' : 'Kopien'}`,
			ok: (/** @type {number} */ copies, /** @type {number} */ requested) => (requested === 1 ? 'die Kopie ist angekommen' : `alle ${requested} Kopien angekommen`),
			short: (/** @type {number} */ copies, /** @type {number} */ requested) => `nur ${copies} von ${requested} Kopien`,
			failed: 'fehlgeschlagen',
			reason: 'Grund',
			checked: 'Zuletzt geprüft',
			checkOutcome: (/** @type {string} */ s) => ({ unchanged: 'keine Änderung', skipped: 'Sicherungen sind aus', done: 'gesichert', partial: 'nur teilweise gesichert', failed: 'fehlgeschlagen' })[s] ?? s,
			lastShort: 'letzte Sicherung',
			nextShort: 'nächste Prüfung',
			nextHint: 'Alle zwei Stunden wird geprüft; gesichert wird nur, wenn sich etwas geändert hat.',
			nextBackup: 'nächste Sicherung frühestens',
			nextOnChange: 'nächste Sicherung, sobald sich etwas ändert',
			nextHintQuiet: (/** @type {number} */ h) =>
				`Gesichert wird, wenn sich etwas geändert hat und danach 30 Minuten nichts mehr, höchstens alle ${h.toLocaleString('de')} Stunden. „Jetzt sichern“ und „Sichern und beenden“ sichern sofort.`,
			now: 'Jetzt sichern',
			running: 'Sicherung läuft …',
			sending: 'Sicherung anfordern …',
			doneNow: 'Gesichert',
			donePartial: (/** @type {number} */ copies, /** @type {number} */ requested) => `Gesichert, aber nur ${copies} von ${requested} Kopien: ein Anbieter hat abgelehnt. Die nächste Prüfung versucht es wieder bei allen.`,
			doneUnchanged: 'Schon gesichert: seit der letzten Sicherung hat sich nichts geändert.',
			failedNow: 'Die Sicherung ist fehlgeschlagen; Paperless läuft weiter.',
			oldImage: 'Diese VM läuft mit einem älteren Image: Sicherungsstand und „Jetzt sichern“ gibt es ab dem nächsten Image.',
			unreachable: 'Die VM meldet ihren Sicherungsstand gerade nicht.',
			duration: (/** @type {number} */ s) => `Dauer ${s >= 60 ? `${Math.round(s / 60)} min` : `${s} s`}`,
			retention: {
				title: 'Aufbewahrung',
				summary: (/** @type {number} */ keep, /** @type {number} */ remove) => `${keep} ${keep === 1 ? 'Sicherung bleibt' : 'Sicherungen bleiben'}${remove ? `, ${remove} zum Entfernen vorgemerkt` : ''}`,
				policy: (/** @type {{ keepLast: number, keepDays: number, keepWeeks: number, keepMonths: number }} */ p) => `Es bleiben die letzten ${p.keepLast}, dazu je eine pro Tag (${p.keepDays} Tage), Woche (${p.keepWeeks} Wochen) und Monat (${p.keepMonths} Monate); immer die neueste vollständige, die neueste bei jedem Anbieter und die, aus der diese VM wiederhergestellt wurde.`,
				keep: 'bleibt',
				remove: 'Entfernung geplant',
				toRemove: 'zum Entfernen vorgemerkt',
				reasons: { newest: 'neueste vollständige', restored: 'Ausgangspunkt dieser VM', place: 'neueste bei einem Anbieter', last: 'eine der letzten', undated: 'Datum unbekannt', day: 'Tag', week: 'Woche', month: 'Monat' },
				partial: 'unvollständig',
				undated: 'Datum unbekannt',
				queued: 'Entfernungen sind beim Anbieter angemeldet; der Platz wird mit dem nächsten Nachweis frei (meist innerhalb eines Tages).',
				planned: 'Wird mit der nächsten vollständigen Sicherung entfernt.',
				needsWallet: 'Entfernen kann nur deine Wallet, die die Sicherungen bezahlt (die VM darf nur hinzufügen): mit dem Sicherungswerkzeug und `node backup.mjs retain --yes`.',
				overBudget: 'Was bleiben muss, lässt keinen Platz für eine weitere Sicherung im Kontingent.',
				failed: 'Die Aufbewahrung konnte zuletzt nicht laufen; die Sicherungen bleiben, die nächste versucht es wieder.'
			}
		},
		config: {
			unknownNetwork: (/** @type {string} */ network) => `Unbekanntes Netz: ${network}`,
			noAgeKey: 'Ohne age-Schlüssel keine Sicherung.',
			copiesRange: '1 bis 3 Kopien.',
			maxProviders: 'Höchstens 3 Anbieter.',
			signerNotReleased: 'Le Space Credits haben den Schlüssel der VM für die Sicherungen noch nicht freigegeben.',
			signerNetwork: (/** @type {string} */ theirs, /** @type {string} */ ours) => `Le Space Credits sichern im Netz ${theirs}, diese Paperless in ${ours}.`,
			signerIncomplete: 'Für Sicherungen über Le Space Credits fehlt die Adresse des Dienstes oder ein Schlüssel.',
			retentionRange: (/** @type {string} */ k) => `${k}: eine ganze Zahl von ${k === 'keepLast' ? 1 : 0} bis 1000.`
		},
		facts: {
			oom: (/** @type {number} */ n) => `Speicher reichte nicht: das System hat ${n === 1 ? 'einen Prozess' : `${n} Prozesse`} beendet.`,
			memory: (/** @type {string} */ free, /** @type {string | null} */ swap) => `Freier Arbeitsspeicher danach: ${free}${swap ? `, Auslagerung ${swap}` : ', keine Auslagerung'}`,
			disk: (/** @type {string} */ free) => `Freier Platz auf der Datenplatte: ${free}`,
			exit: (/** @type {number} */ code) => `Exit-Code ${code}`
		},
		guide: {
			filename: (/** @type {string} */ short) => `sicherung-selbst-holen-${short}.txt`,
			keyFile: 'schluessel.txt',
			sealedFile: 'sicherung.age',
			partFile: (/** @type {string} */ nn) => `teil-${nn}.age`,
			title: 'Sicherung selbst holen – Paperless anywhere',
			which: (/** @type {string} */ cid) => `Sicherung: ${cid}`,
			parts: (/** @type {number} */ n) => (n > 1 ? `Sie besteht aus ${n} Teilen, die in dieser Reihenfolge aneinandergehängt werden.` : 'Sie besteht aus einem Stück.'),
			need: (/** @type {string} */ keyFile) => [
				'Du brauchst: curl, age (https://age-encryption.org) und deinen Sicherungsschlüssel',
				`als Datei ${keyFile} (eine Zeile, beginnt mit AGE-SECRET-KEY-1). Den Schlüssel`,
				'zeigt die App unter „Sicherung selbst holen“.'
			],
			download: '1. Herunterladen (von einer der Kopien; jede enthält dasselbe):',
			part: (/** @type {number} */ n, /** @type {string} */ cid) => `   Teil ${n}: ${cid}`,
			noAddress: '   (für dieses Stück kennt die App gerade keine Adresse)',
			or: '# oder: ',
			join: '2. Zusammensetzen:',
			decrypt: (/** @type {number} */ step) => `${step}. Entschlüsseln:`,
			result: [
				'Das Ergebnis ist ein Zip mit deinen Dokumenten (Originale und Archiv-PDFs) und der Datei',
				'manifest.json. Es lässt sich ohne Paperless-ngx öffnen; in ein leeres Paperless-ngx',
				'spielt man es mit dessen document_importer ein.'
			],
			tool: (/** @type {string} */ keyFile) => [
				'Mit dem Werkzeug paperless-backup-filecoin (https://github.com/Le-Space/paperless-backup-filecoin)',
				'geht dasselbe in einem Schritt: die Datei mit dem Eintrag dieser Sicherung als ledger.json',
				`ablegen, AGE_IDENTITY_FILE auf ${keyFile} setzen und`
			],
			keep: (/** @type {string} */ keyFile) => ['Der Schlüssel öffnet alle deine Sicherungen. Bewahre ihn wie die 24 Wörter auf und', `lösche ${keyFile}, wenn du fertig bist.`]
		},
		fetch: {
			errors: {
				'no-address': 'Für mindestens ein Stück dieser Sicherung ist gerade keine Adresse bekannt.',
				unreachable: 'Keiner der Speicheranbieter hat dieses Stück herausgegeben.',
				interrupted: 'Die Verbindung ist abgebrochen, und keine andere Kopie konnte an derselben Stelle fortsetzen.',
				'wrong-key': 'Der Sicherungsschlüssel dieses Tresors öffnet diese Sicherung nicht.',
				damaged: 'Die Sicherung ist unvollständig oder beschädigt angekommen.',
				'too-large': 'Diese Sicherung ist zu groß, um sie in diesem Browser im Arbeitsspeicher zu halten.',
				aborted: 'Abgebrochen.'
			},
			fileFailed: 'Die Datei ließ sich nicht anlegen.',
			savedToFile: 'Gespeichert in der gewählten Datei.',
			handedOver: 'Als Download übergeben.',
			failed: 'Das Holen ist fehlgeschlagen.'
		},
		export: {
			summary: 'Sicherung selbst holen (ohne laufende Instanz)',
			intro: {
				before: 'Die gewählte Sicherung (',
				afterId: ') liegt verschlüsselt bei den Speicheranbietern und lässt sich dort ohne Paperless anywhere abrufen. Entschlüsseln kannst du sie auf deinem eigenen Rechner, mit ',
				and: ' und ',
				after: '. Heraus kommt ein Zip mit deinen Dokumenten.'
			},
			saveGuide: 'Anleitung mit den Adressen speichern',
			saveEntry: 'Eintrag für das Werkzeug (ledger.json)',
			incomplete: 'Für mindestens ein Stück kennt die App gerade keine Adresse; die Anleitung nennt es.',
			hereStrong: 'Gleich hier holen:',
			here: (/** @type {boolean} */ canPickFile) => `Dieser Browser lädt die Sicherung von den Speicheranbietern, entschlüsselt sie auf diesem Gerät und speichert das Zip${canPickFile ? ' in eine Datei deiner Wahl' : ''}. Der Schlüssel bleibt dabei im Browser.`,
			size: (/** @type {string} */ size) => `Größe: etwa ${size}.`,
			missingAddress: 'Dafür fehlt gerade die Adresse eines Stücks.',
			tooLarge: (/** @type {string} */ limit) => `Dieser Browser kann nicht direkt in eine Datei schreiben, und die Sicherung ist zu groß für den Arbeitsspeicher (Grenze ${limit}). Nimm Chrome oder Edge, oder die Anleitung oben.`,
			progress: (/** @type {string} */ fetched, /** @type {string | null} */ total, /** @type {string} */ written) => `Geholt: ${fetched}${total ? ` von ${total}` : ''} · entschlüsselt: ${written}`,
			stop: 'Abbrechen',
			keepOpen: 'Lass dieses Fenster so lange offen.',
			start: 'Holen und entschlüsseln',
			done: (/** @type {string} */ written, /** @type {string} */ where) => `Fertig: ${written} entschlüsselt. ${where}`,
			keyStrong: 'Der Sicherungsschlüssel',
			key: ' öffnet alle deine Sicherungen. Wer ihn hat, kann sie lesen. Die App zeigt ihn nur hier und nur, wenn du es verlangst; sie schickt ihn nirgendwohin.',
			keyWanted: 'Ich will den Schlüssel sehen und passe selbst auf ihn auf.',
			keyShow: 'Schlüssel anzeigen',
			copy: 'Kopieren',
			copied: 'Kopiert',
			saveKey: (/** @type {string} */ keyFile) => `Als ${keyFile} speichern`,
			hide: 'Wieder verbergen',
			cleanUp: 'Lösche die Datei, wenn du fertig bist, und leere die Zwischenablage.',
			noKey: 'Der Sicherungsschlüssel dieses Tresors ist hier nicht hinterlegt.'
		},
		places: {
			push: 'An die laufende VM übergeben',
			pushPending: 'Orte geändert – jetzt an die laufende VM übergeben? Erst dann sichert sie dorthin.',
			pushHint: 'Paperless läuft: Geänderte Sicherungsorte gelten für die laufende VM erst, wenn du sie übergibst.',
			regions: { EUROPE: 'Europa (EWR, Großbritannien, Schweiz)', EU: 'EU', EEA: 'EWR', US: 'USA', anywhere: 'überall' },
			listUnreadable: 'Die Anbieterliste ließ sich gerade nicht lesen.',
			legend: 'Wohin die Sicherungen gehen',
			byRegion: 'Region und Anzahl der Kopien',
			byProvider: 'Anbieter selbst wählen',
			copies: 'Kopien',
			region: 'Region',
			countries: 'Länder (Kürzel)',
			countryCodes: 'Länderkürzel, z. B. DE, NL',
			noPlace: 'ohne Ort',
			endorsed: 'empfohlen',
			approved: 'zugelassen',
			inactive: ', nicht aktiv',
			number: (/** @type {number} */ id) => `Nr. ${id}`,
			max: 'Höchstens 3 Anbieter.',
			reading: 'Lese die Anbieter …',
			copiesAt: 'Kopien bei:',
			notIndependent: (/** @type {string} */ why) => `Nicht unabhängig: ${why}`,
			outsideEu: (/** @type {string} */ countries) =>
				`Kopien außerhalb der EU (${countries}). Elektronische Bücher und Aufzeichnungen erlaubt die Abgabenordnung ohne Antrag nur in EU-Mitgliedstaaten (§ 146 Abs. 2a AO); außerhalb braucht es eine Bewilligung des Finanzamts (§ 146 Abs. 2b AO). Für steuerlich relevante Belege mit dem Steuerberater klären.`,
			cost: (/** @type {string} */ usdfc, /** @type {string | null} */ gbPerCopy) => `Kosten ca. ${usdfc} USDFC im Monat${gbPerCopy ? ` bei ${gbPerCopy} GB je Kopie` : ' (Grundgebühr, noch keine Daten)'}.`,
			save: 'Sicherungsorte speichern',
			problems: {
				notApproved: (/** @type {number} */ id) => `Anbieter ${id} ist nicht (mehr) zugelassen.`,
				notActive: (/** @type {number} */ id, /** @type {string} */ name) => `Anbieter ${id} (${name}) ist nicht aktiv.`,
				outsideRegion: (/** @type {number} */ id, /** @type {string} */ name) => `Anbieter ${id} (${name}) liegt außerhalb der Region.`,
				blocked: (/** @type {number} */ id, /** @type {string} */ name, /** @type {string} */ why) => `Anbieter ${id} (${name}) ist gesperrt: ${why}. Bitte einen anderen wählen.`,
				tooFew: (/** @type {number} */ copies, /** @type {number} */ found) => `${copies} Kopien gewünscht, in der Region gibt es ${found ? `nur ${found}` : 'keinen'} zugelassene${found ? '' : 'n'} Anbieter.`,
				sameOperator: (/** @type {number} */ id, /** @type {string} */ name, /** @type {string} */ twin, /** @type {string} */ why) =>
					`Anbieter ${id} (${name}) gehört zum selben Betreiber wie ${twin} (${why}). Zwei Kopien dort fallen zusammen aus: einen Anbieter eines anderen Betreibers wählen.`
			},
			signs: {
				address: (/** @type {string} */ a) => `gleiche Adresse ${a.slice(0, 6)}…${a.slice(-4)}`,
				domain: (/** @type {string} */ d) => `Domain ${d}`,
				name: (/** @type {string} */ n) => `Name „${n}…“`
			},
			sameOperatorAs: (/** @type {string} */ name) => `gleicher Betreiber wie ${name}`,
			fewOperators: (/** @type {number} */ copies, /** @type {number} */ found) =>
				`Nur ${found} unabhängige${found === 1 ? 'r' : ''} Betreiber verfügbar: ${found === 1 ? 'eine Kopie' : `${found} Kopien`} statt ${copies}. Zwei Kopien beim selben Betreiber legt die App nicht an, sie fielen zusammen aus.`,
			blockedWhy: { fidl: 'FIDL (Cello, Bass): am 16.11.2026 beide zugleich nicht erreichbar, ein Betreiber; von Le Space aus den Sicherungsorten genommen' },
			blockedTag: 'gesperrt',
			third: {
				offer: (/** @type {string} */ name, /** @type {string} */ place) => `Eine weitere Kopie bei einem unabhängigen Betreiber: ${name}${place ? ` (${place})` : ''}.`,
				outside: 'Er liegt außerhalb der gewählten Region.',
				add: 'Diese Kopie hinzufügen'
			},
			shared: {
				operator: (/** @type {string} */ a, /** @type {string} */ b, /** @type {string} */ operator) => `${a} und ${b} gehören demselben Betreiber (${operator}).`,
				place: (/** @type {string} */ a, /** @type {string} */ b, /** @type {string} */ place) => `${a} und ${b} stehen am selben Ort (${place}).`
			}
		},
		chain: {
			title: 'Was die Chain sagt',
			intro: 'Für jede Kopie liest die App selbst aus den Filecoin-Verträgen (PDPVerifier, Filecoin Warm Storage, Filecoin Pay), ob sie noch da ist. Den Anbieter fragt sie dafür nicht. Sie liest über einen öffentlichen Filecoin-Knoten (Glif) und vertraut dessen Antworten; die Beweise selbst rechnet sie nicht nach.',
			check: 'Jetzt prüfen',
			checking: 'Lese die Chain …',
			checkedAt: (/** @type {string} */ when, /** @type {string} */ epoch) => `Gelesen ${when}, bei Epoche ${epoch}.`,
			unreadable: (/** @type {string} */ reason) => `Die Chain ließ sich für diese Kopie nicht lesen: ${reason}`,
			copy: (provider, place, dataSet) => `Kopie bei Anbieter ${provider}${place ? ` (${place})` : ''} · Datensatz ${dataSet}`,
			copyState: { app: 'alles in Ordnung', failed: 'Problem', off: 'nicht vollständig gelesen' },
			noDataSets: 'Für diese Sicherung nennt die Liste keinen Datensatz; die App kann ihre Kopien nicht auf der Chain prüfen.',
			states: { app: 'von der App geprüft', reported: 'vom Anbieter gemeldet', failed: 'Problem', off: 'keine Angabe', run: 'wird gelesen' },
			lights: { dataSet: 'Datensatz aktiv', lastProof: 'Letzter Beweis', nextChallenge: 'Nächste Stichprobe', faults: 'Verpasste Beweise', paid: 'Bezahlt bis', sample: 'Probeabruf beim Anbieter' },
			notes: {
				dataSet: {
					live: (/** @type {number} */ n) => (n === 1 ? 'ja, mit dem Stück dieser Sicherung' : `ja, mit den ${n} Stücken dieser Sicherung`),
					liveSet: 'ja',
					notLive: 'nein: Der PDPVerifier führt den Datensatz nicht mehr.',
					piecesGone: (/** @type {number} */ n, /** @type {number} */ of) => `${n} von ${of} Stücken dieser Sicherung sind nicht mehr im Datensatz.`,
					ending: (/** @type {string} */ when) => `Der Dienst für diesen Datensatz ist gekündigt; er endet ${when}.`,
					unread: 'nicht gelesen'
				},
				lastProof: {
					recent: (/** @type {string} */ when, /** @type {string} */ epoch) => `${when} (Epoche ${epoch})`,
					old: (/** @type {string} */ when, /** @type {string} */ epoch) => `${when} (Epoche ${epoch}), länger als zwei Beweisperioden her`,
					none: 'noch keiner',
					unread: 'nicht gelesen'
				},
				nextChallenge: {
					scheduled: (/** @type {string} */ when, /** @type {string} */ epoch) => `${when} (Epoche ${epoch})`,
					due: (/** @type {string} */ when, /** @type {string} */ epoch) => `fällig seit ${when} (Epoche ${epoch}); der Beweis läuft`,
					overdue: (/** @type {string} */ when, /** @type {string} */ epoch) => `Frist ${when} (Epoche ${epoch}) ohne Beweis verstrichen`,
					none: 'keine geplant',
					unread: 'nicht gelesen'
				},
				faults: {
					none: (/** @type {number} */ n) => `keine in den letzten ${n} Beweisperioden`,
					missed: (/** @type {number} */ n, /** @type {number} */ of) => `${n} von ${of} Beweisperioden ohne Beweis (Fehler)`,
					noneEnded: 'noch keine Beweisperiode abgelaufen',
					notStarted: 'Beweise haben noch nicht begonnen',
					unread: 'nicht gelesen'
				},
				paid: {
					until: (/** @type {string} */ when, /** @type {number} */ days) => `${when}; danach hält die Rücklage die Zahlung noch ${days} Tage`,
					runOut: 'Das zahlende Konto deckt die Speicherung nicht mehr.',
					railEnded: (/** @type {string} */ when) => `Die Zahlung ist beendet; sie endet ${when}.`,
					noRate: 'gedeckt, ohne absehbares Ende',
					noRail: 'Kein Zahlungsweg für diesen Datensatz.',
					unread: 'nicht gelesen'
				},
				sample: {
					answers: (/** @type {number} */ bytes) => `Der Anbieter liefert die ersten ${bytes} Bytes aus. Gegen die Piece-CID prüfen lässt sich nur das ganze Stück, darum nur gemeldet.`,
					status: (/** @type {number} */ status) => `Der Anbieter antwortet mit Fehler ${status}.`,
					silent: 'Der Anbieter war aus dem Browser nicht abzufragen.'
				}
			},
			more: 'Wie ein Anbieter beweist, dass er die Sicherung noch hat',
			explorer: 'im PDP Explorer',
			pieces: (/** @type {number} */ n) => (n === 1 ? 'Stück dieser Sicherung im PDP Explorer:' : `Die ${n} Stücke dieser Sicherung im PDP Explorer:`),
			legend: 'Grün: von der App selbst auf der Chain gelesen. Blau: nur vom Anbieter gemeldet. Rot: ein Problem. Grau: keine Angabe.'
		},
		health: {
			title: 'Speicheranbieter jetzt',
			again: 'neu prüfen',
			listUnreadable: 'Die Anbieterliste ließ sich gerade nicht lesen.',
			asking: 'Anbieter werden gefragt …',
			provider: (/** @type {number} */ id) => `Anbieter ${id}`,
			answers: (/** @type {number | null} */ ms) => `antwortet (${ms} ms)`,
			answersError: (/** @type {number} */ status) => `antwortet mit Fehler ${status}`,
			silent: 'antwortet nicht',
			explorer: 'im Explorer',
			hint: '„Antwortet“ heißt erreichbar; ob ein Anbieter Daten annimmt, zeigt erst die nächste Sicherung.'
		},
		storage: {
			label: 'Speicher',
			meter: 'Belegter Speicher',
			used: (/** @type {string} */ used, /** @type {string} */ included) => `${used} GB von ${included} GB`,
			over: 'Mehr als im Paket enthalten. Bitte alte Dokumente löschen oder uns schreiben; Sicherungen könnten sonst scheitern.',
			near: (/** @type {string} */ free) => `Noch ${free} GB frei. Wird es knapp, scheitern zuerst die Sicherungen.`,
			asOfBackup: 'Stand der letzten Sicherung.',
			free: (/** @type {string} */ free) => `Noch ${free} GB frei.`
		}
	},
	en: {
		overview: {
			title: 'Backup',
			last: 'Last backup',
			none: 'No backup since the start yet',
			beforeStart: 'before this start',
			copies: (/** @type {number} */ n) => `${n} ${n === 1 ? 'copy' : 'copies'}`,
			ok: (/** @type {number} */ copies, /** @type {number} */ requested) => (requested === 1 ? 'the copy arrived' : `all ${requested} copies arrived`),
			short: (/** @type {number} */ copies, /** @type {number} */ requested) => `only ${copies} of ${requested} copies`,
			failed: 'failed',
			reason: 'Reason',
			checked: 'Last checked',
			checkOutcome: (/** @type {string} */ s) => ({ unchanged: 'no change', skipped: 'backups are off', done: 'backed up', partial: 'partly backed up', failed: 'failed' })[s] ?? s,
			lastShort: 'last backup',
			nextShort: 'next check',
			nextHint: 'Checked every two hours; a backup is made only if something changed.',
			nextBackup: 'next backup at the earliest',
			nextOnChange: 'next backup once something changes',
			nextHintQuiet: (/** @type {number} */ h) =>
				`A backup is made when something changed and then nothing for 30 minutes, at most every ${h.toLocaleString('en')} hours. “Back up now” and “Back up and stop” back up at once.`,
			now: 'Back up now',
			running: 'Backing up …',
			sending: 'Requesting a backup …',
			doneNow: 'Backed up',
			donePartial: (/** @type {number} */ copies, /** @type {number} */ requested) => `Backed up, but only ${copies} of ${requested} copies: a provider refused. The next check tries all of them again.`,
			doneUnchanged: 'Already backed up: nothing changed since the last backup.',
			failedNow: 'The backup failed; Paperless keeps running.',
			oldImage: 'This VM runs an older image: backup details and “Back up now” come with the next image.',
			unreachable: 'The VM does not report its backups right now.',
			duration: (/** @type {number} */ s) => `took ${s >= 60 ? `${Math.round(s / 60)} min` : `${s} s`}`,
			retention: {
				title: 'Retention',
				summary: (/** @type {number} */ keep, /** @type {number} */ remove) => `${keep} ${keep === 1 ? 'backup stays' : 'backups stay'}${remove ? `, ${remove} marked for removal` : ''}`,
				policy: (/** @type {{ keepLast: number, keepDays: number, keepWeeks: number, keepMonths: number }} */ p) => `The last ${p.keepLast} stay, plus one per day (${p.keepDays} days), week (${p.keepWeeks} weeks) and month (${p.keepMonths} months); always the newest complete one, the newest at each provider and the one this VM was restored from.`,
				keep: 'stays',
				remove: 'removal scheduled',
				toRemove: 'marked for removal',
				reasons: { newest: 'newest complete', restored: 'this VM’s starting point', place: 'newest at a provider', last: 'one of the last', undated: 'date unknown', day: 'day', week: 'week', month: 'month' },
				partial: 'incomplete',
				undated: 'date unknown',
				queued: 'The removals are registered with the providers; the space is freed with the next proof (usually within a day).',
				planned: 'Removed with the next complete backup.',
				needsWallet: 'Only your wallet, which pays the backups, can remove them (the VM may only add): with the backup tool and `node backup.mjs retain --yes`.',
				overBudget: 'What must stay leaves no room for another backup within the quota.',
				failed: 'Retention could not run last time; the backups stay, the next one tries again.'
			}
		},
		config: {
			unknownNetwork: (/** @type {string} */ network) => `Unknown network: ${network}`,
			noAgeKey: 'No backup without an age key.',
			copiesRange: '1 to 3 copies.',
			maxProviders: 'At most 3 providers.',
			signerNotReleased: 'Le Space Credits has not released the VM’s key for the backups yet.',
			signerNetwork: (/** @type {string} */ theirs, /** @type {string} */ ours) => `Le Space Credits backs up on the network ${theirs}, this Paperless on ${ours}.`,
			signerIncomplete: 'Backups through Le Space Credits lack the address of the service or a key.',
			retentionRange: (/** @type {string} */ k) => `${k}: a whole number from ${k === 'keepLast' ? 1 : 0} to 1000.`
		},
		facts: {
			oom: (/** @type {number} */ n) => `Memory ran out: the system ended ${n === 1 ? 'one process' : `${n} processes`}.`,
			memory: (/** @type {string} */ free, /** @type {string | null} */ swap) => `Free memory afterwards: ${free}${swap ? `, swap ${swap}` : ', no swap'}`,
			disk: (/** @type {string} */ free) => `Free space on the data disk: ${free}`,
			exit: (/** @type {number} */ code) => `Exit code ${code}`
		},
		guide: {
			filename: (/** @type {string} */ short) => `fetch-backup-yourself-${short}.txt`,
			keyFile: 'key.txt',
			sealedFile: 'backup.age',
			partFile: (/** @type {string} */ nn) => `part-${nn}.age`,
			title: 'Fetch a backup yourself – Paperless anywhere',
			which: (/** @type {string} */ cid) => `Backup: ${cid}`,
			parts: (/** @type {number} */ n) => (n > 1 ? `It consists of ${n} parts, which are joined in this order.` : 'It consists of one piece.'),
			need: (/** @type {string} */ keyFile) => [
				'You need: curl, age (https://age-encryption.org) and your backup key',
				`as the file ${keyFile} (one line, starting with AGE-SECRET-KEY-1). The app shows`,
				'the key under “Fetch a backup yourself”.'
			],
			download: '1. Download (from one of the copies; each holds the same):',
			part: (/** @type {number} */ n, /** @type {string} */ cid) => `   Part ${n}: ${cid}`,
			noAddress: '   (the app knows no address for this piece right now)',
			or: '# or: ',
			join: '2. Join:',
			decrypt: (/** @type {number} */ step) => `${step}. Decrypt:`,
			result: [
				'The result is a zip with your documents (originals and archive PDFs) and the file',
				'manifest.json. It opens without Paperless-ngx; into an empty Paperless-ngx',
				'it is loaded with its document_importer.'
			],
			tool: (/** @type {string} */ keyFile) => [
				'The tool paperless-backup-filecoin (https://github.com/Le-Space/paperless-backup-filecoin)',
				'does the same in one step: save the file with this backup’s entry as ledger.json,',
				`set AGE_IDENTITY_FILE to ${keyFile} and run`
			],
			keep: (/** @type {string} */ keyFile) => ['The key opens all your backups. Keep it as you keep the 24 words, and', `delete ${keyFile} when you are done.`]
		},
		fetch: {
			errors: {
				'no-address': 'For at least one piece of this backup no address is known right now.',
				unreachable: 'None of the storage providers handed out this piece.',
				interrupted: 'The connection broke off, and no other copy could continue at the same place.',
				'wrong-key': 'This vault’s backup key does not open this backup.',
				damaged: 'The backup arrived incomplete or damaged.',
				'too-large': 'This backup is too large to hold in memory in this browser.',
				aborted: 'Cancelled.'
			},
			fileFailed: 'The file could not be created.',
			savedToFile: 'Saved to the file you chose.',
			handedOver: 'Handed over as a download.',
			failed: 'Fetching failed.'
		},
		export: {
			summary: 'Fetch a backup yourself (without a running instance)',
			intro: {
				before: 'The chosen backup (',
				afterId: ') lies encrypted with the storage providers and can be fetched there without Paperless anywhere. You can decrypt it on your own computer, with ',
				and: ' and ',
				after: '. The result is a zip with your documents.'
			},
			saveGuide: 'Save the guide with the addresses',
			saveEntry: 'Entry for the tool (ledger.json)',
			incomplete: 'For at least one piece the app knows no address right now; the guide names it.',
			hereStrong: 'Fetch it right here:',
			here: (/** @type {boolean} */ canPickFile) => `This browser loads the backup from the storage providers, decrypts it on this device and saves the zip${canPickFile ? ' to a file of your choice' : ''}. The key stays in the browser.`,
			size: (/** @type {string} */ size) => `Size: about ${size}.`,
			missingAddress: 'The address of one piece is missing for that right now.',
			tooLarge: (/** @type {string} */ limit) => `This browser cannot write straight into a file, and the backup is too large for its memory (limit ${limit}). Use Chrome or Edge, or the guide above.`,
			progress: (/** @type {string} */ fetched, /** @type {string | null} */ total, /** @type {string} */ written) => `Fetched: ${fetched}${total ? ` of ${total}` : ''} · decrypted: ${written}`,
			stop: 'Cancel',
			keepOpen: 'Leave this window open until it is done.',
			start: 'Fetch and decrypt',
			done: (/** @type {string} */ written, /** @type {string} */ where) => `Done: ${written} decrypted. ${where}`,
			keyStrong: 'The backup key',
			key: ' opens all your backups. Whoever has it can read them. The app shows it only here and only when you ask for it; it sends it nowhere.',
			keyWanted: 'I want to see the key and will look after it myself.',
			keyShow: 'Show the key',
			copy: 'Copy',
			copied: 'Copied',
			saveKey: (/** @type {string} */ keyFile) => `Save as ${keyFile}`,
			hide: 'Hide it again',
			cleanUp: 'Delete the file when you are done, and clear the clipboard.',
			noKey: 'This vault’s backup key is not stored here.'
		},
		places: {
			push: 'Hand over to the running VM',
			pushPending: 'Places changed – hand them to the running VM now? Only then does it back up there.',
			pushHint: 'Paperless is running: changed backup places apply to the running VM only once you hand them over.',
			regions: { EUROPE: 'Europe (EEA, United Kingdom, Switzerland)', EU: 'EU', EEA: 'EEA', US: 'USA', anywhere: 'anywhere' },
			listUnreadable: 'The list of providers could not be read right now.',
			legend: 'Where the backups go',
			byRegion: 'Region and number of copies',
			byProvider: 'Choose the providers yourself',
			copies: 'Copies',
			region: 'Region',
			countries: 'Countries (codes)',
			countryCodes: 'Country codes, e.g. DE, NL',
			noPlace: 'no place given',
			endorsed: 'endorsed',
			approved: 'approved',
			inactive: ', not active',
			number: (/** @type {number} */ id) => `no. ${id}`,
			max: 'At most 3 providers.',
			reading: 'Reading the providers …',
			copiesAt: 'Copies at:',
			notIndependent: (/** @type {string} */ why) => `Not independent: ${why}`,
			outsideEu: (/** @type {string} */ countries) =>
				`Copies outside the EU (${countries}). The German Fiscal Code (Abgabenordnung) allows electronic books and records without an application only in EU member states (§ 146 (2a) AO); outside, it takes an approval from the tax office (§ 146 (2b) AO). For documents that matter for tax, clarify this with your tax adviser.`,
			cost: (/** @type {string} */ usdfc, /** @type {string | null} */ gbPerCopy) => `Costs about ${usdfc} USDFC a month${gbPerCopy ? ` at ${gbPerCopy} GB per copy` : ' (base fee, no data yet)'}.`,
			save: 'Save the backup places',
			problems: {
				notApproved: (/** @type {number} */ id) => `Provider ${id} is not approved (any more).`,
				notActive: (/** @type {number} */ id, /** @type {string} */ name) => `Provider ${id} (${name}) is not active.`,
				outsideRegion: (/** @type {number} */ id, /** @type {string} */ name) => `Provider ${id} (${name}) lies outside the region.`,
				blocked: (/** @type {number} */ id, /** @type {string} */ name, /** @type {string} */ why) => `Provider ${id} (${name}) is blocked: ${why}. Please choose another one.`,
				tooFew: (/** @type {number} */ copies, /** @type {number} */ found) => (found ? `${copies} copies wanted, the region has only ${found} approved ${found === 1 ? 'provider' : 'providers'}.` : `${copies} copies wanted, the region has no approved provider.`),
				sameOperator: (/** @type {number} */ id, /** @type {string} */ name, /** @type {string} */ twin, /** @type {string} */ why) =>
					`Provider ${id} (${name}) belongs to the same operator as ${twin} (${why}). Two copies there fail together: choose a provider of another operator.`
			},
			signs: {
				address: (/** @type {string} */ a) => `same address ${a.slice(0, 6)}…${a.slice(-4)}`,
				domain: (/** @type {string} */ d) => `domain ${d}`,
				name: (/** @type {string} */ n) => `name “${n}…”`
			},
			sameOperatorAs: (/** @type {string} */ name) => `same operator as ${name}`,
			fewOperators: (/** @type {number} */ copies, /** @type {number} */ found) =>
				`Only ${found} independent ${found === 1 ? 'operator' : 'operators'} available: ${found === 1 ? 'one copy' : `${found} copies`} instead of ${copies}. The app does not put two copies at one operator; they would fail together.`,
			blockedWhy: { fidl: 'FIDL (Cello, Bass): both unreachable at the same time on 2026-11-16, one operator; taken out of the backup places by Le Space' },
			blockedTag: 'blocked',
			third: {
				offer: (/** @type {string} */ name, /** @type {string} */ place) => `One more copy at an independent operator: ${name}${place ? ` (${place})` : ''}.`,
				outside: 'It lies outside the chosen region.',
				add: 'Add this copy'
			},
			shared: {
				operator: (/** @type {string} */ a, /** @type {string} */ b, /** @type {string} */ operator) => `${a} and ${b} belong to the same operator (${operator}).`,
				place: (/** @type {string} */ a, /** @type {string} */ b, /** @type {string} */ place) => `${a} and ${b} are in the same place (${place}).`
			}
		},
		chain: {
			title: 'What the chain says',
			intro: 'For each copy the app itself reads from the Filecoin contracts (PDPVerifier, Filecoin Warm Storage, Filecoin Pay) whether it is still there. It does not ask the provider for this. It reads through a public Filecoin node (Glif) and trusts its answers; it does not recompute the proofs itself.',
			check: 'Check now',
			checking: 'Reading the chain …',
			checkedAt: (/** @type {string} */ when, /** @type {string} */ epoch) => `Read ${when}, at epoch ${epoch}.`,
			unreadable: (/** @type {string} */ reason) => `The chain could not be read for this copy: ${reason}`,
			copy: (provider, place, dataSet) => `Copy at provider ${provider}${place ? ` (${place})` : ''} · data set ${dataSet}`,
			copyState: { app: 'all well', failed: 'problem', off: 'not fully read' },
			noDataSets: 'The list names no data set for this backup; the app cannot check its copies on the chain.',
			states: { app: 'checked by the app', reported: 'reported by the provider', failed: 'problem', off: 'no answer', run: 'reading' },
			lights: { dataSet: 'Data set active', lastProof: 'Last proof', nextChallenge: 'Next challenge', faults: 'Missed proofs', paid: 'Paid until', sample: 'Test fetch from the provider' },
			notes: {
				dataSet: {
					live: (/** @type {number} */ n) => (n === 1 ? 'yes, with the piece of this backup' : `yes, with the ${n} pieces of this backup`),
					liveSet: 'yes',
					notLive: 'no: the PDPVerifier no longer has the data set.',
					piecesGone: (/** @type {number} */ n, /** @type {number} */ of) => `${n} of ${of} pieces of this backup are no longer in the data set.`,
					ending: (/** @type {string} */ when) => `The service for this data set was terminated; it ends ${when}.`,
					unread: 'not read'
				},
				lastProof: {
					recent: (/** @type {string} */ when, /** @type {string} */ epoch) => `${when} (epoch ${epoch})`,
					old: (/** @type {string} */ when, /** @type {string} */ epoch) => `${when} (epoch ${epoch}), more than two proving periods ago`,
					none: 'none yet',
					unread: 'not read'
				},
				nextChallenge: {
					scheduled: (/** @type {string} */ when, /** @type {string} */ epoch) => `${when} (epoch ${epoch})`,
					due: (/** @type {string} */ when, /** @type {string} */ epoch) => `due since ${when} (epoch ${epoch}); the proof is under way`,
					overdue: (/** @type {string} */ when, /** @type {string} */ epoch) => `deadline ${when} (epoch ${epoch}) passed without a proof`,
					none: 'none scheduled',
					unread: 'not read'
				},
				faults: {
					none: (/** @type {number} */ n) => `none in the last ${n} proving periods`,
					missed: (/** @type {number} */ n, /** @type {number} */ of) => `${n} of ${of} proving periods without a proof (faults)`,
					noneEnded: 'no proving period has ended yet',
					notStarted: 'proving has not started yet',
					unread: 'not read'
				},
				paid: {
					until: (/** @type {string} */ when, /** @type {number} */ days) => `${when}; after that the lockup keeps paying for ${days} more days`,
					runOut: 'The paying account no longer covers the storage.',
					railEnded: (/** @type {string} */ when) => `The payment was terminated; it ends ${when}.`,
					noRate: 'covered, with no end in sight',
					noRail: 'No payment rail for this data set.',
					unread: 'not read'
				},
				sample: {
					answers: (/** @type {number} */ bytes) => `The provider serves the first ${bytes} bytes. Only the whole piece can be checked against the piece CID, so this is only reported.`,
					status: (/** @type {number} */ status) => `The provider answers with error ${status}.`,
					silent: 'The provider could not be asked from the browser.'
				}
			},
			more: 'How a provider proves it still has the backup',
			explorer: 'in the PDP Explorer',
			pieces: (/** @type {number} */ n) => (n === 1 ? 'The piece of this backup in the PDP Explorer:' : `The ${n} pieces of this backup in the PDP Explorer:`),
			legend: 'Green: read from the chain by the app itself. Blue: only reported by the provider. Red: a problem. Grey: no answer.'
		},
		health: {
			title: 'Storage providers now',
			again: 'check again',
			listUnreadable: 'The list of providers could not be read right now.',
			asking: 'Asking the providers …',
			provider: (/** @type {number} */ id) => `Provider ${id}`,
			answers: (/** @type {number | null} */ ms) => `answers (${ms} ms)`,
			answersError: (/** @type {number} */ status) => `answers with error ${status}`,
			silent: 'does not answer',
			explorer: 'in the explorer',
			hint: '“Answers” means reachable; whether a provider takes data shows only with the next backup.'
		},
		storage: {
			label: 'Storage',
			meter: 'Storage in use',
			used: (/** @type {string} */ used, /** @type {string} */ included) => `${used} GB of ${included} GB`,
			over: 'More than the package includes. Please delete old documents or write to us; backups could fail otherwise.',
			near: (/** @type {string} */ free) => `${free} GB still free. When it gets tight, the backups fail first.`,
			asOfBackup: 'As of the last backup.',
			free: (/** @type {string} */ free) => `${free} GB still free.`
		}
	}
};
