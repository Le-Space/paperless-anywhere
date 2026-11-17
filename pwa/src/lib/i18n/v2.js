// The v0.2 interface (routes/v0.2, lib/v2): its two views, the areas, and
// the way into the vault in plain words. German is the original; English
// beside it, key for key. Texts of the cards themselves stay in their own files.
export const v2 = {
	de: {
		view: { label: 'Ansicht', standard: 'Standard', technical: 'Technisch' },
		areas: { label: 'Bereiche', start: 'Start', backup: 'Sicherung', plan: 'Paket', system: 'System', more: 'Mehr' },
		preview: 'Vorschau der neuen Oberfläche (v0.2). Die bisherige App bleibt unter /app/ erreichbar.',
		toOld: 'Zur bisherigen App',
		step: (/** @type {number} */ n, /** @type {number} */ of) => `Schritt ${n} von ${of}`,
		welcome: {
			title: 'Deine Dokumente in deinem eigenen Tresor',
			lede: 'Paperless anywhere startet für dich ein eigenes Paperless auf einer verschlüsselten Maschine. Hineinsehen kannst nur du, auch Le Space nicht.',
			points: ['Nur du hast den Schlüssel.', 'Es kostet nur, solange es läuft.', 'Sicherungen liegen an mehreren unabhängigen Orten.'],
			riskStrong: 'Le Space kann deinen Tresor nicht wiederherstellen.',
			risk: 'Sind Passkey und die 24 Wörter weg, sind deine Dokumente und alle Sicherungen verloren.',
			understood: 'Verstanden: Ich bewahre die 24 Wörter auf Papier auf, nicht auf diesem Gerät.',
			create: 'Tresor anlegen',
			createHint: 'Dein Gerät fragt gleich nach Fingerabdruck, Gesicht oder PIN. Das ist dein Passkey.',
			have: 'Ich habe schon einen Tresor',
			back: 'Zurück',
			techTitle: 'Tresor',
			tech: {
				passkey: ['Passkey', 'WebAuthn mit PRF, gebunden an diese Adresse'],
				master: ['Hauptgeheimnis', 'zufällig, zweimal versiegelt: mit der PRF-Antwort und mit den 24 Wörtern'],
				derived: ['Abgeleitet', 'App-Schlüssel (Aleph), Sitzungsschlüssel (Filecoin), age-Identität, Paperless-Geheimnisse'],
				stored: ['Im Browser', 'nur der versiegelte Datensatz']
			},
			nameLabel: 'Name des Passkeys'
		},
		open: {
			title: 'Vorhandenen Tresor öffnen',
			lede: 'Auf diesem Gerät gibt es noch keinen Zugang. Öffne deinen Tresor mit einem Passkey, den dieses Gerät kennt, oder mit den 24 Wörtern.',
			passkey: 'Mit Passkey öffnen',
			waiting: (/** @type {string} */ host) => `Warte auf den Passkey … Gibt es für ${host} noch keinen, nimm die 24 Wörter.`,
			wordsLabel: 'Die 24 Wörter, mit Leerzeichen getrennt',
			words: 'Mit den 24 Wörtern öffnen'
		},
		locked: {
			title: 'Willkommen zurück',
			lede: 'Entsperre deinen Tresor, dann siehst du, ob Paperless läuft.',
			passkey: 'Mit Passkey entsperren',
			waiting: 'Warte auf den Passkey …',
			withWords: 'Mit den 24 Wörtern entsperren',
			wordsLabel: 'Die 24 Wörter, mit Leerzeichen getrennt',
			words: 'Entsperren',
			trouble: 'Probleme beim Entsperren?',
			troubleText: 'Kennt dieses Gerät deinen Passkey nicht mehr, öffnen die 24 Wörter den Tresor. Hilft beides nicht, kann niemand den Tresor öffnen, auch Le Space nicht.',
			forget: 'Diesen Browser vergessen',
			forgetTitle: 'Diesen Browser vergessen?',
			forgetText: 'Der Zugang auf diesem Gerät wird entfernt. Dein Tresor bleibt bestehen: Mit den 24 Wörtern öffnest du ihn wieder, hier oder auf einem anderen Gerät. Ohne die 24 Wörter kommst du auf diesem Gerät nicht mehr hinein.',
			forgetYes: 'Ja, vergessen',
			forgetNo: 'Abbrechen'
		},
		phrase: {
			title: 'Schreib die 24 Wörter auf Papier',
			lede: 'Mit ihnen öffnest du den Tresor auf jedem Gerät, auch wenn der Passkey verloren ist. Sie werden nur jetzt angezeigt.',
			written: 'Ich habe sie aufgeschrieben',
			next: 'Als Nächstes fragt die App drei der Wörter ab und sagt dir, welches nicht stimmt.',
			guard: 'Solange die Wörter zu sehen sind, sperrt die App nicht und fragt nach, bevor du die Seite verlässt.',
			leave: 'Die 24 Wörter werden nur jetzt angezeigt. Wenn du die Seite verlässt, bevor du sie aufgeschrieben hast, sind sie weg.',
			checkTitle: 'Zur Probe, von deinem Zettel',
			word: (/** @type {number} */ n) => `Wort ${n}`,
			wrong: 'Dieses Wort stimmt nicht mit deinem Zettel überein.',
			right: 'Stimmt',
			done: 'Stimmt, weiter',
			again: 'Wörter noch einmal zeigen',
			techTitle: 'Phrase',
			tech: {
				format: ['Format', 'BIP-39, 24 Wörter'],
				effect: ['Wirkung', 'öffnet den Tresor auf jeder Adresse, unabhängig vom Passkey'],
				stored: ['Gespeichert', 'nirgends; die App kann sie später nicht mehr zeigen']
			}
		},
		lock: 'Sperren',
		lockBusy: 'Gerade läuft noch etwas (Start, Sicherung oder Stopp). Die Maschine macht weiter; die App verfolgt es erst wieder, wenn du neu entsperrst.',
		leaveTitle: 'App sperren und verlassen?',
		leaveYes: 'Sperren und verlassen',
		leaveNo: 'Hier bleiben',
		system: {
			title: 'System',
			lede: 'Alles, was der Alltag nicht braucht.',
			onlyTechnical: 'Diesen Bereich gibt es nur in der Ansicht „Technisch“.'
		},
		more: {
			keys: 'Schlüssel und Geräte',
			keysText: 'Dieses Gerät öffnet den Tresor mit einem Passkey. Die 24 Wörter stehen auf deinem Zettel; die App kann sie nicht noch einmal zeigen.',
			addDevice: 'Weiteres Gerät hinzufügen',
			addDeviceText: (/** @type {string} */ host) => `Öffne ${host} auf dem anderen Gerät, wähle „Ich habe schon einen Tresor“ und gib die 24 Wörter ein. Lege dort dann unter „Mehr“ einen Passkey für das Gerät an.`,
			addPasskey: 'Passkey für dieses Gerät anlegen',
			added: 'Neuer Passkey angelegt; dieses Gerät nutzt ihn ab jetzt.',
			appKey: 'App-Schlüssel (Aleph)',
			settings: 'Einstellungen',
			language: 'Sprache',
			legal: 'Rechtliches und Version'
		}
	},
	en: {
		view: { label: 'View', standard: 'Standard', technical: 'Technical' },
		areas: { label: 'Areas', start: 'Start', backup: 'Backup', plan: 'Plan', system: 'System', more: 'More' },
		preview: 'Preview of the new interface (v0.2). The current app stays at /app/.',
		toOld: 'To the current app',
		step: (/** @type {number} */ n, /** @type {number} */ of) => `Step ${n} of ${of}`,
		welcome: {
			title: 'Your documents in a vault of your own',
			lede: 'Paperless anywhere starts a Paperless of your own on an encrypted machine. Only you can look inside, not even Le Space.',
			points: ['Only you hold the key.', 'It costs only while it runs.', 'Backups are kept in several independent places.'],
			riskStrong: 'Le Space cannot restore your vault.',
			risk: 'If the passkey and the 24 words are gone, your documents and all backups are lost.',
			understood: 'Understood: I keep the 24 words on paper, not on this device.',
			create: 'Create vault',
			createHint: 'Your device will ask for a fingerprint, your face or a PIN. That is your passkey.',
			have: 'I already have a vault',
			back: 'Back',
			techTitle: 'Vault',
			tech: {
				passkey: ['Passkey', 'WebAuthn with PRF, bound to this address'],
				master: ['Master secret', 'random, sealed twice: with the PRF answer and with the 24 words'],
				derived: ['Derived', 'app key (Aleph), session key (Filecoin), age identity, Paperless secrets'],
				stored: ['In the browser', 'only the sealed record']
			},
			nameLabel: 'Name of the passkey'
		},
		open: {
			title: 'Open an existing vault',
			lede: 'This device has no way in yet. Open your vault with a passkey this device knows, or with the 24 words.',
			passkey: 'Open with passkey',
			waiting: (/** @type {string} */ host) => `Waiting for the passkey … If there is none for ${host} yet, use the 24 words.`,
			wordsLabel: 'The 24 words, separated by spaces',
			words: 'Open with the 24 words'
		},
		locked: {
			title: 'Welcome back',
			lede: 'Unlock your vault to see whether Paperless is running.',
			passkey: 'Unlock with passkey',
			waiting: 'Waiting for the passkey …',
			withWords: 'Unlock with the 24 words',
			wordsLabel: 'The 24 words, separated by spaces',
			words: 'Unlock',
			trouble: 'Trouble unlocking?',
			troubleText: 'If this device no longer knows your passkey, the 24 words open the vault. If neither works, nobody can open the vault, not even Le Space.',
			forget: 'Forget this browser',
			forgetTitle: 'Forget this browser?',
			forgetText: 'The way in on this device is removed. Your vault stays: the 24 words open it again, here or on another device. Without the 24 words you cannot get in on this device any more.',
			forgetYes: 'Yes, forget',
			forgetNo: 'Cancel'
		},
		phrase: {
			title: 'Write the 24 words on paper',
			lede: 'They open the vault on any device, even if the passkey is lost. They are shown only now.',
			written: 'I have written them down',
			next: 'Next the app asks for three of the words and tells you which one is wrong.',
			guard: 'While the words are on screen the app does not lock, and it asks before you leave the page.',
			leave: 'The 24 words are shown only now. If you leave the page before writing them down, they are gone.',
			checkTitle: 'A check, from your sheet of paper',
			word: (/** @type {number} */ n) => `Word ${n}`,
			wrong: 'This word does not match your sheet of paper.',
			right: 'Correct',
			done: 'Correct, continue',
			again: 'Show the words again',
			techTitle: 'Phrase',
			tech: {
				format: ['Format', 'BIP-39, 24 words'],
				effect: ['Effect', 'opens the vault at any address, independent of the passkey'],
				stored: ['Stored', 'nowhere; the app cannot show it again later']
			}
		},
		lock: 'Lock',
		lockBusy: 'Something is still under way (a start, a backup or a stop). The machine carries on; the app follows it again only after you unlock anew.',
		leaveTitle: 'Lock the app and leave?',
		leaveYes: 'Lock and leave',
		leaveNo: 'Stay here',
		system: {
			title: 'System',
			lede: 'Everything that everyday use does not need.',
			onlyTechnical: 'This area exists only in the “Technical” view.'
		},
		more: {
			keys: 'Keys and devices',
			keysText: 'This device opens the vault with a passkey. The 24 words are on your sheet of paper; the app cannot show them again.',
			addDevice: 'Add another device',
			addDeviceText: (/** @type {string} */ host) => `Open ${host} on the other device, choose “I already have a vault” and enter the 24 words. Then create a passkey for that device there, under “More”.`,
			addPasskey: 'Create a passkey for this device',
			added: 'New passkey created; this device uses it from now on.',
			appKey: 'App key (Aleph)',
			settings: 'Settings',
			language: 'Language',
			legal: 'Legal and version'
		}
	}
};
