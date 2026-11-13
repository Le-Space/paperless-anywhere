// The app's own page (routes/app/+page.svelte) and its footer (BuildInfo):
// creating and opening the vault, the two views, "Auf einen Blick" and
// "Technisch". German is the original; English beside it, key for key.
export const app = {
	de: {
		langLabel: 'Sprache',
		home: 'Zur Startseite',
		homeLocks: 'Zur Startseite (die App wird dabei gesperrt)',
		lock: 'Sperren',
		leaveBusy: 'Die App wird beim Wechsel zur Startseite gesperrt. Gerade läuft noch etwas (Start, Sicherung oder Stopp); die VM macht weiter, die App verfolgt es aber erst wieder, wenn du sie neu entsperrst. Trotzdem wechseln?',
		forgetConfirm: 'Diesen Tresor in diesem Browser vergessen? Mit der Wiederherstellungsphrase lässt er sich neu öffnen.',
		shared: { before: 'Diese Adresse teilen sich alle Seiten dieses IPFS-Gateways, auch ihr Speicher und ihre Passkeys. Den Tresor öffnet die App hier nicht. Bitte unter ', after: ' öffnen.' },
		create: {
			title: 'Neu hier? Tresor anlegen',
			lede: 'Deine Dokumente in Paperless-ngx, auf einer eigenen, verschlüsselten Maschine. Ein Passkey auf diesem Gerät öffnet deinen Tresor; dazu bekommst du 24 Wörter zum Aufschreiben.',
			riskStrong: 'Nur du hast den Schlüssel.',
			risk: 'Le Space kann deinen Tresor weder öffnen noch wiederherstellen. Sind Passkey und die 24 Wörter weg, sind deine Dokumente und alle Sicherungen verloren.',
			understood: 'Verstanden: Ich bewahre die 24 Wörter sicher auf, auf Papier und nicht auf diesem Gerät.',
			button: 'Passkey anlegen',
			renameFold: 'Name des Passkeys ändern',
			renameLabel: 'Name des Passkeys'
		},
		open: {
			title: 'Schon einen Tresor?',
			passkey: 'Auf diesem Gerät mit Passkey öffnen',
			waitingNone: (/** @type {string} */ host) => `Warte auf den Passkey … Gibt es für ${host} noch keinen, mit den 24 Wörtern öffnen.`,
			phraseFold: 'Auf diesem Gerät mit Wiederherstellungsphrase öffnen',
			button: 'Öffnen'
		},
		locked: {
			title: 'Willkommen zurück',
			lede: 'Entsperre mit deinem Passkey, dann siehst du, ob Paperless-ngx läuft.',
			passkey: 'Mit Passkey entsperren',
			waiting: 'Warte auf den Passkey …',
			phraseFold: 'Mit Wiederherstellungsphrase entsperren',
			button: 'Entsperren',
			forget: 'Diesen Browser vergessen'
		},
		phrase: {
			title: 'Wiederherstellungsphrase',
			lede: 'Schreib sie auf Papier und bewahre sie sicher auf, nicht auf diesem Gerät. Sie wird nur jetzt angezeigt. Mit ihr öffnest du den Tresor auf jedem Gerät, auch wenn der Passkey verloren ist; ohne sie und ohne Passkey hilft dir niemand, auch Le Space nicht.',
			written: 'Aufgeschrieben',
			check: 'Zur Probe, von deinem Zettel:',
			word: (/** @type {number} */ n) => `Wort ${n}`,
			right: 'Stimmt',
			again: 'Wörter noch einmal zeigen'
		},
		tabs: { label: 'Ansicht', simple: 'Übersicht', advanced: 'Erweitert' },
		glance: {
			title: 'Auf einen Blick',
			package: 'Paket',
			noPackage: 'kein Paket',
			notInUse: 'nicht in Gebrauch',
			hoursLeft: (/** @type {number} */ h) => `${h} h übrig`,
			active: 'aktiv',
			phases: { off: 'aus', running: 'läuft', starting: 'startet', stopping: 'wird beendet', interrupted: 'Start unterbrochen', loading: '…' },
			backups: 'Sicherungen',
			backupsOff: 'aus',
			copies: (/** @type {number} */ n) => `${n} Kopien`,
			noneYet: 'noch keine',
			address: 'Adresse',
			fixedAddress: 'feste Adresse',
			newAddress: 'neu bei jedem Start',
			payWay: 'Zahlweg',
			pays: { lespace: 'Le Space, aus dem Paket', app: 'Adresse der App', wallet: 'Meine Wallet' },
			notChosen: 'noch nicht gewählt'
		},
		tech: {
			title: 'Technisch',
			purpose: 'Für Fortgeschrittene. Für den Alltag ist nichts davon nötig.',
			keys: 'Schlüssel und Passkeys',
			unlocked: 'Entsperrt. Schlüssel dieser App für Aleph:',
			keyHint: 'Dein Browser leitet diesen Schlüssel aus deinem Passkey (oder den 24 Wörtern) ab; Le Space hat ihn nicht. Aleph-Credits liegen hier nur, wenn du deine VMs selbst über diese Adresse bezahlst (Einrichtung, Schritt 1).',
			addFold: 'Weiteren Passkey hinzufügen',
			addHint: (/** @type {string} */ host) => `Ein Passkey gehört zu einer Adresse (${host}). Für die gehostete App oder ein zweites Gerät: dort mit den 24 Wörtern öffnen und hier einen Passkey anlegen. Jeder Passkey öffnet denselben Tresor.`,
			addButton: (/** @type {string} */ host) => `Passkey für ${host} anlegen`,
			added: (/** @type {string} */ host) => `Neuer Passkey für ${host} angelegt; dieser Browser nutzt ihn ab jetzt.`,
			wallet: 'Deine Wallet bei Aleph und Filecoin',
			vms: 'Meine VMs',
			setup: 'Einrichtung',
			missing: 'es fehlt etwas',
			complete: 'vollständig'
		},
		simple: {
			balance: 'Guthaben',
			lasts: (/** @type {string} */ time) => `reicht ca. ${time}`,
			startShortCredits: 'Für einen Start reicht es gerade nicht: ein Paket wählen oder Stunden dazukaufen.',
			startShort: 'Für einen Start reicht das Guthaben gerade nicht. Details unter „Erweitert“.',
			backupsShort: 'Das Guthaben für die Sicherungen geht bald zu Ende. Details unter „Erweitert“.'
		},
		footer: {
			legal: 'Rechtliches',
			about: 'Über Paperless anywhere',
			imprint: 'Impressum',
			privacy: 'Datenschutz',
			licences: 'Lizenzen',
			commit: 'Commit',
			cid: 'IPFS-CID dieser Version',
			// The cancel button (§ 312k BGB). Legal wording: the English entry stays
			// German until Le Space has an approved English one.
			cancel: 'Verträge hier kündigen',
			cancelHint: 'Auch ohne geöffneten Tresor: per E-Mail an Le Space. Mit geöffnetem Tresor geht es direkt bei „Dein Paket“.'
		}
	},
	en: {
		langLabel: 'Language',
		home: 'To the start page',
		homeLocks: 'To the start page (this locks the app)',
		lock: 'Lock',
		leaveBusy: 'Going to the start page locks the app. Something is still under way (a start, a backup or a stop); the VM carries on, but the app follows it again only once you unlock it. Leave anyway?',
		forgetConfirm: 'Forget this vault in this browser? The recovery phrase opens it again.',
		shared: { before: 'This address is shared by every page of this IPFS gateway, and so are its storage and its passkeys. The app does not open the vault here. Please open it at ', after: '.' },
		create: {
			title: 'New here? Create your vault',
			lede: 'Your documents in Paperless-ngx, on an encrypted machine of your own. A passkey on this device opens your vault; you also get 24 words to write down.',
			riskStrong: 'Only you hold the key.',
			risk: 'Le Space can neither open nor restore your vault. If the passkey and the 24 words are gone, your documents and all backups are lost.',
			understood: 'Understood: I keep the 24 words safe, on paper and not on this device.',
			button: 'Create passkey',
			renameFold: 'Change the passkey’s name',
			renameLabel: 'Name of the passkey'
		},
		open: {
			title: 'Already have a vault?',
			passkey: 'Open with a passkey on this device',
			waitingNone: (/** @type {string} */ host) => `Waiting for the passkey … If there is none for ${host} yet, open with the 24 words.`,
			phraseFold: 'Open with the recovery phrase on this device',
			button: 'Open'
		},
		locked: {
			title: 'Welcome back',
			lede: 'Unlock with your passkey, then you see whether Paperless-ngx is running.',
			passkey: 'Unlock with passkey',
			waiting: 'Waiting for the passkey …',
			phraseFold: 'Unlock with the recovery phrase',
			button: 'Unlock',
			forget: 'Forget this browser'
		},
		phrase: {
			title: 'Recovery phrase',
			lede: 'Write it on paper and keep it safe, not on this device. It is shown only now. It opens the vault on any device, even when the passkey is lost; without it and without a passkey nobody can help you, not Le Space either.',
			written: 'Written down',
			check: 'A check, from your paper:',
			word: (/** @type {number} */ n) => `Word ${n}`,
			right: 'Correct',
			again: 'Show the words again'
		},
		tabs: { label: 'View', simple: 'Overview', advanced: 'Advanced' },
		glance: {
			title: 'At a glance',
			package: 'Package',
			noPackage: 'no package',
			notInUse: 'not in use',
			hoursLeft: (/** @type {number} */ h) => `${h} h left`,
			active: 'active',
			phases: { off: 'off', running: 'running', starting: 'starting', stopping: 'stopping', interrupted: 'start interrupted', loading: '…' },
			backups: 'Backups',
			backupsOff: 'off',
			copies: (/** @type {number} */ n) => `${n} ${n === 1 ? 'copy' : 'copies'}`,
			noneYet: 'none yet',
			address: 'Address',
			fixedAddress: 'fixed address',
			newAddress: 'new at every start',
			payWay: 'Paid by',
			pays: { lespace: 'Le Space, from the package', app: 'The app’s address', wallet: 'My wallet' },
			notChosen: 'not chosen yet'
		},
		tech: {
			title: 'Technical',
			purpose: 'For advanced users. None of it is needed for everyday use.',
			keys: 'Keys and passkeys',
			unlocked: 'Unlocked. This app’s key for Aleph:',
			keyHint: 'Your browser derives this key from your passkey (or the 24 words); Le Space does not have it. Aleph credits are held here only if you pay your VMs yourself through this address (setup, step 1).',
			addFold: 'Add another passkey',
			addHint: (/** @type {string} */ host) => `A passkey belongs to one address (${host}). For the hosted app or a second device: open there with the 24 words and create a passkey here. Every passkey opens the same vault.`,
			addButton: (/** @type {string} */ host) => `Create a passkey for ${host}`,
			added: (/** @type {string} */ host) => `New passkey created for ${host}; this browser uses it from now on.`,
			wallet: 'Your wallet on Aleph and Filecoin',
			vms: 'My VMs',
			setup: 'Setup',
			missing: 'something is missing',
			complete: 'complete'
		},
		simple: {
			balance: 'Balance',
			lasts: (/** @type {string} */ time) => `lasts about ${time}`,
			startShortCredits: 'It is not enough for a start right now: choose a package or buy extra hours.',
			startShort: 'The balance is not enough for a start right now. Details under “Advanced”.',
			backupsShort: 'The balance for the backups is running out soon. Details under “Advanced”.'
		},
		footer: {
			legal: 'Legal',
			about: 'About Paperless anywhere',
			imprint: 'Imprint',
			privacy: 'Privacy',
			licences: 'Licences',
			commit: 'Commit',
			cid: 'IPFS CID of this version',
			// Not translated yet, see the German entry.
			cancel: 'Verträge hier kündigen',
			cancelHint: 'Auch ohne geöffneten Tresor: per E-Mail an Le Space. Mit geöffnetem Tresor geht es direkt bei „Dein Paket“.'
		}
	}
};
