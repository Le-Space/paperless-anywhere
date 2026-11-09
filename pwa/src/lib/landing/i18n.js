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
		description: 'Paperless-ngx auf Abruf in einer vertraulichen VM. Kostet nur, solange es läuft; danach verschlüsselt gesichert und aus.',
		ogImageAlt: 'Paperless anywhere: Paperless-ngx auf Abruf, in einer vertraulichen VM',
		nav: { how: 'So geht’s', tee: 'Vertraulich', nodes: 'Knoten', storage: 'Backups', prices: 'Preise' },
		open: 'Paperless starten',
		openHint: 'Mit Passkey, ohne Konto.',
		hero: {
			kicker: 'Paperless-ngx · auf Abruf · vertraulich',
			title: 'Deine Dokumente. Nur wach, wenn du sie brauchst.',
			lead: 'Paperless-ngx startet auf Knopfdruck in einer vertraulichen VM (AMD SEV-SNP). Es kostet nur, solange es läuft. Danach wird verschlüsselt gesichert und die VM gestoppt; beim nächsten Start kommt alles aus dem Backup zurück.'
		},
		points: [
			{ t: 'Auf Abruf', d: 'Starten, arbeiten, stoppen. Keine Maschine, die rund um die Uhr läuft und bezahlt werden will.' },
			{ t: 'Vertraulich', d: 'Speicher und Platte der VM sind verschlüsselt. Der Betreiber des Knotens kann sie nicht lesen.' },
			{ t: 'Dezentral gesichert', d: 'Backups werden in der VM verschlüsselt und an mehreren Orten abgelegt, die du wählst.' }
		],
		how: {
			title: 'So geht’s',
			steps: [
				{ t: 'Tresor anlegen', d: 'Ein Passkey auf deinem Gerät öffnet deinen Tresor. Dazu bekommst du 24 Wörter zum Aufschreiben: damit kommst du auch ohne das Gerät wieder hinein. Kein Konto, keine E-Mail.' },
				{ t: 'Starten', d: 'Die App sucht einen freien TEE-Knoten, prüft dessen Hardware-Nachweis und gibt erst dann den Schlüssel für die Platte heraus. Das Backup wird eingespielt.' },
				{ t: 'Arbeiten', d: 'Paperless-ngx wie gewohnt im Browser: hochladen, verschlagworten, suchen.' },
				{ t: 'Sichern und beenden', d: 'Ein Klick: Die VM verschlüsselt ein Backup, legt es dezentral ab und fährt herunter. Ab dann läuft keine Rechenzeit mehr.' }
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
			title: 'Vertrauliche Rechenknoten, jetzt gerade',
			lead: 'Auf diesen Knoten kann dein Paperless gerade starten. Die Liste ist live.',
			loading: 'Knotenliste wird geladen …',
			error: 'Die Knotenliste ist gerade nicht erreichbar.',
			count: (n, fit) => `${n} TEE-Knoten, ${fit} davon mit Platz für eine Paperless-VM (2 vCPU, 4 GiB, 40 GiB)`,
			fits: 'hat Platz',
			full: 'gerade voll',
			free: (n) => `${n.freeVcpus} vCPU · ${n.freeMemoryGiB} GiB RAM frei`,
			you: 'deine VM',
			list: 'Alle Knoten anzeigen',
			countries: 'Länder der Knoten',
			placesNote: 'Standorte ungefähr, aus der IP-Adresse der Knoten ermittelt.',
		},
		storage: {
			title: 'Backups, wo du willst',
			lead: 'Das Backup wird in der VM verschlüsselt, bevor es sie verlässt, und bei unabhängigen Speicheranbietern abgelegt. Sie weisen regelmäßig nach, dass sie die Daten noch haben.',
			choose: 'Du wählst selbst: Regionen oder Länder (zum Beispiel nur EU) und 1 bis 3 Kopien bei verschiedenen Anbietern.',
			loading: 'Anbieter werden geladen …',
			error: 'Die Anbieterliste ist gerade nicht erreichbar.',
			count: (n, c) => `${n} zugelassene Anbieter in ${c} Ländern`,
			endorsed: 'empfohlen',
		},
		prices: {
			title: 'Preise',
			lead: 'Monatspakete mit Rechenstunden. Du zahlst nur Stunden, in denen Paperless läuft.',
			perMonth: 'pro Monat',
			hours: (h) => `${h} Stunden`,
			example: 'Beispiel: zwei Stunden pro Woche sind rund 8,7 Stunden im Monat und passen in das kleinste Paket.',
			included: 'In jedem Paket enthalten: bis 8 GB Dokumente und ihre verschlüsselten Sicherungen in drei Kopien.',
		},
		cta: { title: 'Bereit?', lead: 'Tresor anlegen dauert eine Minute. Kein Konto, kein Passwort.' },
		footer: { by: 'Ein Projekt von Le Space', belege: 'Le Space Belege', imprint: 'Impressum', imprintUrl: 'https://le-space.de/#impressum', privacy: 'Datenschutz', privacyUrl: 'https://le-space.de/#datenschutz', built: 'Paperless anywhere rechnet auf vertraulichen Knoten von Aleph Cloud und sichert auf Filecoin.', ngx: 'Paperless-ngx ist ein unabhängiges Open-Source-Projekt (GPL-3.0). Paperless anywhere ist nicht mit ihm verbunden.', ngxLink: 'Paperless-ngx auf GitHub' }
	},
	en: {
		title: 'Paperless anywhere – Paperless-ngx on demand, confidential',
		description: 'Paperless-ngx on demand in a confidential VM. Costs only while it runs; then backed up, encrypted, and shut down.',
		ogImageAlt: 'Paperless anywhere: Paperless-ngx on demand, in a confidential VM',
		nav: { how: 'How it works', tee: 'Confidential', nodes: 'Nodes', storage: 'Backups', prices: 'Prices' },
		open: 'Open the app',
		openHint: 'With a passkey, no account.',
		hero: {
			kicker: 'Paperless-ngx · on demand · confidential',
			title: 'Your documents. Awake only when you need them.',
			lead: 'Paperless-ngx starts at the press of a button in a confidential VM (AMD SEV-SNP). It costs only while it runs. Afterwards it is backed up, encrypted, and the VM is stopped; the next start restores everything from the backup.'
		},
		points: [
			{ t: 'On demand', d: 'Start, work, stop. No machine running around the clock that wants to be paid for.' },
			{ t: 'Confidential', d: 'The VM’s memory and disk are encrypted. The node’s operator cannot read them.' },
			{ t: 'Decentralised backups', d: 'Backups are encrypted inside the VM and stored in several places you choose.' }
		],
		how: {
			title: 'How it works',
			steps: [
				{ t: 'Create your vault', d: 'A passkey on your device opens your vault. You also get 24 words to write down: they get you back in without the device. No account, no e-mail.' },
				{ t: 'Start', d: 'The app finds a free TEE node, checks its hardware attestation and only then hands over the disk key. The backup is restored.' },
				{ t: 'Work', d: 'Paperless-ngx in your browser as usual: upload, tag, search.' },
				{ t: 'Back up and shut down', d: 'One click: the VM encrypts a backup, stores it decentrally and shuts down. From then on no compute time runs.' }
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
			title: 'Confidential compute nodes, right now',
			lead: 'Your Paperless can start on these nodes right now. The list is live.',
			loading: 'Loading the node list …',
			error: 'The node list cannot be reached right now.',
			count: (n, fit) => `${n} TEE nodes, ${fit} of them with room for a Paperless VM (2 vCPU, 4 GiB, 40 GiB)`,
			fits: 'has room',
			full: 'full right now',
			free: (n) => `${n.freeVcpus} vCPU · ${n.freeMemoryGiB} GiB RAM free`,
			you: 'your VM',
			list: 'Show all nodes',
			countries: 'Countries of the nodes',
			placesNote: 'Locations are approximate, derived from the nodes’ IP addresses.',
		},
		storage: {
			title: 'Backups where you want them',
			lead: 'The backup is encrypted inside the VM before it leaves, and stored with independent storage providers. They regularly prove that they still hold the data.',
			choose: 'You choose: regions or countries (for example EU only) and 1 to 3 copies with different providers.',
			loading: 'Loading providers …',
			error: 'The provider list cannot be reached right now.',
			count: (n, c) => `${n} approved providers in ${c} countries`,
			endorsed: 'endorsed',
		},
		prices: {
			title: 'Prices',
			lead: 'Monthly packages of compute hours. You only use hours while Paperless runs.',
			perMonth: 'per month',
			hours: (h) => `${h} hours`,
			example: 'Example: two hours a week are about 8.7 hours a month and fit in the smallest package.',
			included: 'Included in every package: up to 8 GB of documents and their encrypted backups in three copies.',
		},
		cta: { title: 'Ready?', lead: 'Creating a vault takes a minute. No account, no password.' },
		footer: { by: 'A Le Space project', belege: 'Le Space Belege', imprint: 'Imprint', imprintUrl: 'https://le-space.de/#imprint', privacy: 'Privacy', privacyUrl: 'https://le-space.de/#privacy', built: 'Paperless anywhere computes on confidential nodes of Aleph Cloud and backs up to Filecoin.', ngx: 'Paperless-ngx is an independent open source project (GPL-3.0). Paperless anywhere is not affiliated with it.', ngxLink: 'Paperless-ngx on GitHub' }
	}
};
