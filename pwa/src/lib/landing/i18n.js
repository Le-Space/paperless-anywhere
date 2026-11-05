// The landing page's texts in German and English (same keys). The app itself
// stays German for now; this page is the one people find first.

export const LANGS = ['de', 'en'];

/** The language to start with: a saved choice, else the browser's. */
export function initialLang() {
	try {
		const saved = localStorage.getItem('paperless-lang');
		if (LANGS.includes(saved ?? '')) return /** @type {'de' | 'en'} */ (saved);
	} catch {
		/* storage blocked: fall through */
	}
	return /^de\b/i.test(globalThis.navigator?.language ?? 'de') ? 'de' : 'en';
}

export const texts = {
	de: {
		title: 'Paperless anywhere – Paperless-ngx auf Abruf, vertraulich',
		description: 'Paperless-ngx startet, wenn du es brauchst, in einer vertraulichen VM auf Aleph. Kostet nur, solange es läuft; danach Backup auf Filecoin und aus.',
		nav: { how: 'So geht’s', tee: 'TEE', nodes: 'Knoten', storage: 'Speicher', prices: 'Preise' },
		open: 'Paperless starten',
		openHint: 'Mit Passkey, ohne Konto.',
		hero: {
			kicker: 'Paperless-ngx · auf Abruf · vertraulich',
			title: 'Deine Dokumente. Nur wach, wenn du sie brauchst.',
			lead: 'Paperless-ngx startet auf Knopfdruck in einer vertraulichen VM (AMD SEV-SNP) auf Aleph. Es kostet nur, solange es läuft. Danach wird verschlüsselt gesichert und die VM gestoppt; beim nächsten Start kommt alles aus dem Backup zurück.'
		},
		points: [
			{ t: 'Auf Abruf', d: 'Starten, arbeiten, stoppen. Keine Maschine, die rund um die Uhr läuft und bezahlt werden will.' },
			{ t: 'Vertraulich', d: 'Speicher und Platte der VM sind verschlüsselt. Der Betreiber des Knotens kann sie nicht lesen.' },
			{ t: 'Dezentral gesichert', d: 'Backups werden in der VM verschlüsselt und auf Filecoin abgelegt, an Orten, die du wählst.' }
		],
		how: {
			title: 'So geht’s',
			steps: [
				{ t: 'Tresor anlegen', d: 'Ein Passkey auf deinem Gerät öffnet deinen Tresor. Dazu bekommst du 24 Wörter zum Aufschreiben: damit kommst du auch ohne das Gerät wieder hinein. Kein Konto, keine E-Mail.' },
				{ t: 'Starten', d: 'Die App sucht einen freien TEE-Knoten, prüft dessen Hardware-Nachweis und gibt erst dann den Schlüssel für die Platte heraus. Das Backup wird eingespielt.' },
				{ t: 'Arbeiten', d: 'Paperless-ngx wie gewohnt im Browser: hochladen, verschlagworten, suchen.' },
				{ t: 'Sichern und stoppen', d: 'Ein Klick: Die VM verschlüsselt ein Backup, legt es auf Filecoin ab und fährt herunter. Ab dann läuft keine Rechenzeit mehr.' }
			]
		},
		tee: {
			title: 'Was ist ein TEE?',
			lead: 'TEE heißt Trusted Execution Environment: ein abgeschirmter Bereich, den der Prozessor selbst schützt.',
			items: [
				{ t: 'Vom Prozessor verschlüsselt', d: 'Mit AMD SEV-SNP verschlüsselt die CPU den Arbeitsspeicher der VM mit einem Schlüssel, den nur sie kennt. Der Rechner, auf dem die VM läuft, sieht nur verschlüsselte Daten.' },
				{ t: 'Der Betreiber liest nicht mit', d: 'Wer den Knoten betreibt, kann den Speicher und die Platte der VM nicht lesen. Die Platte ist zusätzlich mit LUKS verschlüsselt; den Schlüssel dafür hat nur deine App.' },
				{ t: 'Erst prüfen, dann entsperren', d: 'Bevor die App einen Schlüssel herausgibt, lässt sie sich von der Hardware bestätigen, was gestartet wurde: Firmware, Kernel und Initrd. Passt der Nachweis nicht, bleibt die Platte zu.' }
			]
		},
		nodes: {
			title: 'TEE-Knoten auf Aleph, jetzt gerade',
			lead: 'Diese Rechenknoten im Aleph-Netz melden, dass sie vertrauliche VMs ausführen können. Live aus der öffentlichen Knotenliste.',
			loading: 'Knotenliste wird geladen …',
			error: 'Die Knotenliste ist gerade nicht erreichbar.',
			count: (n, fit) => `${n} TEE-Knoten, ${fit} davon mit Platz für eine Paperless-VM (2 vCPU, 4 GiB, 40 GiB)`,
			fits: 'hat Platz',
			full: 'gerade voll',
			free: (n) => `${n.freeVcpus} vCPU · ${n.freeMemoryGiB} GiB RAM frei`,
			you: 'deine VM',
			list: 'Alle Knoten anzeigen',
			source: 'Quelle: crns-list.aleph.sh'
		},
		storage: {
			title: 'Backups auf Filecoin, wo du willst',
			lead: 'Das Backup wird in der VM mit age verschlüsselt, bevor es sie verlässt, und bei Speicheranbietern auf Filecoin abgelegt (Filecoin Onchain Cloud, PDP). Die Anbieter weisen regelmäßig nach, dass sie die Daten noch haben.',
			choose: 'Du wählst selbst: Regionen oder Länder (zum Beispiel nur EU) und 1 bis 3 Kopien bei verschiedenen Anbietern.',
			loading: 'Anbieter werden geladen …',
			error: 'Die Anbieterliste ist gerade nicht erreichbar.',
			count: (n, c) => `${n} zugelassene Anbieter in ${c} Ländern`,
			endorsed: 'empfohlen',
			source: 'Quelle: Filecoin-Mainnet, Warm-Storage-Vertrag'
		},
		prices: {
			title: 'Preise',
			lead: 'Monatspakete mit Rechenstunden. Du zahlst nur Stunden, in denen Paperless läuft.',
			perMonth: 'pro Monat',
			hours: (h) => `${h} Stunden`,
			example: 'Beispiel: zwei Stunden pro Woche sind rund 8,7 Stunden im Monat und passen in das kleinste Paket.',
			reserve: 'Vor jedem Start hält Aleph den Preis eines Tages der VM als Reserve vor. Sie wird gehalten, nicht verbraucht.',
			source: 'Live von credits.le-space.de'
		},
		cta: { title: 'Bereit?', lead: 'Tresor anlegen dauert eine Minute. Kein Konto, kein Passwort.' },
		footer: { by: 'Ein Projekt von Le Space', belege: 'Le Space Belege' }
	},
	en: {
		title: 'Paperless anywhere – Paperless-ngx on demand, confidential',
		description: 'Paperless-ngx starts when you need it, in a confidential VM on Aleph. It costs only while it runs; afterwards it is backed up to Filecoin and shut down.',
		nav: { how: 'How it works', tee: 'TEE', nodes: 'Nodes', storage: 'Storage', prices: 'Prices' },
		open: 'Open the app',
		openHint: 'With a passkey, no account.',
		hero: {
			kicker: 'Paperless-ngx · on demand · confidential',
			title: 'Your documents. Awake only when you need them.',
			lead: 'Paperless-ngx starts at the press of a button in a confidential VM (AMD SEV-SNP) on Aleph. It costs only while it runs. Afterwards it is backed up, encrypted, and the VM is stopped; the next start restores everything from the backup.'
		},
		points: [
			{ t: 'On demand', d: 'Start, work, stop. No machine running around the clock that wants to be paid for.' },
			{ t: 'Confidential', d: 'The VM’s memory and disk are encrypted. The node’s operator cannot read them.' },
			{ t: 'Decentralised backups', d: 'Backups are encrypted inside the VM and stored on Filecoin, in places you choose.' }
		],
		how: {
			title: 'How it works',
			steps: [
				{ t: 'Create your vault', d: 'A passkey on your device opens your vault. You also get 24 words to write down: they get you back in without the device. No account, no e-mail.' },
				{ t: 'Start', d: 'The app finds a free TEE node, checks its hardware attestation and only then hands over the disk key. The backup is restored.' },
				{ t: 'Work', d: 'Paperless-ngx in your browser as usual: upload, tag, search.' },
				{ t: 'Back up and stop', d: 'One click: the VM encrypts a backup, stores it on Filecoin and shuts down. From then on no compute time runs.' }
			]
		},
		tee: {
			title: 'What is a TEE?',
			lead: 'TEE stands for Trusted Execution Environment: a shielded area that the processor itself protects.',
			items: [
				{ t: 'Encrypted by the processor', d: 'With AMD SEV-SNP the CPU encrypts the VM’s memory with a key only it knows. The machine the VM runs on sees encrypted data only.' },
				{ t: 'The operator cannot read along', d: 'Whoever runs the node cannot read the VM’s memory or disk. The disk is also encrypted with LUKS; only your app has the key.' },
				{ t: 'Check first, then unlock', d: 'Before the app hands over a key, it has the hardware confirm what was started: firmware, kernel and initrd. If the attestation does not match, the disk stays locked.' }
			]
		},
		nodes: {
			title: 'TEE nodes on Aleph, right now',
			lead: 'These compute nodes in the Aleph network report that they can run confidential VMs. Live from the public node list.',
			loading: 'Loading the node list …',
			error: 'The node list cannot be reached right now.',
			count: (n, fit) => `${n} TEE nodes, ${fit} of them with room for a Paperless VM (2 vCPU, 4 GiB, 40 GiB)`,
			fits: 'has room',
			full: 'full right now',
			free: (n) => `${n.freeVcpus} vCPU · ${n.freeMemoryGiB} GiB RAM free`,
			you: 'your VM',
			list: 'Show all nodes',
			source: 'Source: crns-list.aleph.sh'
		},
		storage: {
			title: 'Backups on Filecoin, where you want them',
			lead: 'The backup is encrypted with age inside the VM before it leaves, and stored with storage providers on Filecoin (Filecoin Onchain Cloud, PDP). The providers regularly prove that they still hold the data.',
			choose: 'You choose: regions or countries (for example EU only) and 1 to 3 copies with different providers.',
			loading: 'Loading providers …',
			error: 'The provider list cannot be reached right now.',
			count: (n, c) => `${n} approved providers in ${c} countries`,
			endorsed: 'endorsed',
			source: 'Source: Filecoin mainnet, warm storage contract'
		},
		prices: {
			title: 'Prices',
			lead: 'Monthly packages of compute hours. You only use hours while Paperless runs.',
			perMonth: 'per month',
			hours: (h) => `${h} hours`,
			example: 'Example: two hours a week are about 8.7 hours a month and fit in the smallest package.',
			reserve: 'Before each start Aleph holds one day of the VM’s price as a reserve. It is held, not spent.',
			source: 'Live from credits.le-space.de'
		},
		cta: { title: 'Ready?', lead: 'Creating a vault takes a minute. No account, no password.' },
		footer: { by: 'A Le Space project', belege: 'Le Space Belege' }
	}
};
