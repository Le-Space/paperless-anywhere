// The landing page's texts in German and English (same keys). The product is
// "Paperless anywhere"; "Paperless-ngx" names only the software it runs, spelled
// exactly so; "Paperless" alone or lowercase is neither. The app itself
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

// Legal text: how Paperless anywhere stands to the Paperless-ngx project. Worded
// by Le Space (the English one translated from it); never rephrase it here.
// Footer, FAQ and the line under the start button use it as it is.
export const DISCLAIMER = {
	de: 'Paperless-ngx ist ein unabhängiges Open-Source-Projekt (GPL-3.0). Paperless anywhere ist ein Angebot von Le Space, nicht mit dem Projekt verbunden und wird von ihm weder unterstützt noch gesponsert.',
	en: 'Paperless-ngx is an independent open source project (GPL-3.0). Paperless anywhere is offered by Le Space, is not affiliated with the project and is neither endorsed nor sponsored by it.'
};

export const texts = {
	de: {
		title: 'Paperless anywhere – Paperless-ngx auf Abruf, vertraulich',
		description: 'Paperless-ngx auf Abruf in einer vertraulichen VM. Kostet nur, solange es läuft; danach verschlüsselt gesichert und aus.',
		ogImageAlt: 'Paperless anywhere, Paperless-ngx auf Abruf, betrieben von Le Space: Deine Dokumente. Nur wach, wenn du sie brauchst.',
		nav: { how: 'So geht’s', tee: 'Vertraulich', nodes: 'Knoten', storage: 'Backups', trust: 'Nachprüfbar', prices: 'Preise', faq: 'FAQ' },
		tagline: 'Paperless-ngx auf Abruf, betrieben von Le Space',
		disclaimer: DISCLAIMER.de,
		open: 'Paperless anywhere starten',
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
				{ t: 'Der Betreiber liest nicht mit', d: 'Wer den Knoten betreibt, kann den Speicher und die Platte der VM nicht lesen. Was deine VM schreibt, liegt zusätzlich in einem Bereich, den sie bei jedem Start mit einem eigenen Schlüssel versiegelt. Diesen Schlüssel gibt es nur im Speicher der VM.' },
				{ t: 'Erst prüfen, dann entsperren', d: 'Bevor die App einen Schlüssel herausgibt, lässt sie sich von der Hardware bestätigen, was gestartet wurde: Firmware, Kernel und Initrd. Passt der Nachweis nicht, bleibt die Platte zu.' }
			]
		},
		ownImage: {
			title: 'Ein Image nur für dich',
			lead: 'Deine VM startet von einem verschlüsselten Image. Die Passphrase dafür kommt aus deinem Tresor, und sonst hat sie niemand: nicht Le Space, nicht der Knoten, nicht GitHub.',
			steps: [
				{ t: 'Öffentliches Image', d: 'Das System, in dem Paperless-ngx läuft, ist für alle gleich und enthält kein Geheimnis. Sein Hash steht in der App; jeder kann ihn nachrechnen.' },
				{ t: 'Geprüfter Build-Dienst', d: 'Ein kleiner Dienst in einer vertraulichen VM. Die App lässt sich von der Hardware bestätigen, dass dort genau der veröffentlichte Code läuft.' },
				{ t: 'Dein Image', d: 'Erst dann schickt die App die Passphrase aus deinem Tresor. Der Dienst versiegelt das Image damit und vergisst sie wieder.' },
				{ t: 'Deine VM', d: 'Beim Start öffnet die VM die Platte mit deiner Passphrase. Eine Platte, die nicht damit versiegelt wurde, geht nicht auf, und es startet nichts.' }
			],
			knowsTitle: 'Wer kennt die Passphrase?',
			answers: { yes: 'ja', brief: 'nur kurz', no: 'nein' },
			knows: [
				{ who: 'Dein Tresor', v: 'yes', d: 'leitet sie ab' },
				{ who: 'Der Build-Dienst', v: 'brief', d: 'während des Baus, nur im Speicher' },
				{ who: 'Deine VM', v: 'brief', d: 'beim Start, nur im Speicher' },
				{ who: 'Le Space', v: 'no' },
				{ who: 'Der Betreiber des Knotens', v: 'no' },
				{ who: 'GitHub', v: 'no' }
			],
			compare: 'Öffentlich vergleichen lassen sich der Hash des Images und der Messwert des Build-Dienstes. Dein verschlüsseltes Image sieht bei jeder Person anders aus.'
		},
		nodes: {
			title: 'Vertrauliche Rechenknoten, jetzt gerade',
			lead: 'Auf diesen Knoten kann dein Paperless anywhere gerade starten. Die Liste ist live.',
			loading: 'Knotenliste wird geladen …',
			error: 'Die Knotenliste ist gerade nicht erreichbar.',
			count: (n, fit) => `${n} TEE-Knoten, ${fit} davon mit Platz für eine Paperless-anywhere-VM (2 vCPU, 4 GiB, 40 GiB)`,
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
		trust: {
			title: 'Nachprüfbar: wer welchen Schlüssel hat',
			lead: 'Wo das Image entsteht, wie seine Platte verschlüsselt ist, wer welches Geheimnis kennt und was die Hardware bestätigt. Mit den Punkten, die noch offen sind, und wo du jede Aussage selbst prüfen kannst.',
			diagramLabel: 'Schaubild: Ein GitHub-Runner baut das Image und verschlüsselt es mit LUKS; es liegt bei Aleph. Es läuft in einer vertraulichen VM (AMD SEV-SNP): gemessen werden Firmware, Kernel, Initrd und Besitzer, nicht das Image; was die VM schreibt, liegt in einem Datenbereich mit einem Zufallsschlüssel, den nur sie hat. Sicherungen werden in der VM mit age verschlüsselt und bei Filecoin abgelegt. Dein Browser prüft den Nachweis der VM und schickt erst dann Passphrase und Geheimnisse.',
			diagram: {
				build: { kicker: '1 · Gebaut', title: 'GitHub-Runner', lines: ['rootfs.yml baut Debian,', 'Docker, Caddy, Skripte', 'und verschlüsselt (LUKS)'] },
				store: { kicker: '2 · Abgelegt', title: 'Aleph-Speicher', lines: ['das Image, verschlüsselt,', 'benannt durch seinen', 'STORE-Hash'] },
				vm: { kicker: '3 · Läuft', title: 'Vertrauliche VM', sub: 'AMD SEV-SNP, auf einem Aleph-Knoten' },
				measured: { title: 'Gemessen ✓', lines: ['Firmware · Kernel · Initrd · Besitzer'] },
				image: { title: 'Image (LUKS): nicht gemessen', lines: ['öffnet sich nur mit', 'der Image-Passphrase'] },
				data: { title: 'Datenbereich (dm-crypt)', lines: ['Zufallsschlüssel bei jedem Start,', 'nur im Speicher der VM'] },
				backup: { kicker: '4 · Gesichert', title: 'Filecoin', lines: ['in der VM mit age', 'verschlüsselt, an', 'deinen Schlüssel'] },
				you: { kicker: 'Du', title: 'Dein Browser, dein Tresor', lines: ['① prüft den AMD-Nachweis der VM', '② erst dann: Passphrase, Geheimnisse', 'über einen Relay, der nur weiterleitet'] },
				legend: 'Schlüssel',
				keys: { image: 'Image-Passphrase: eine je Image', data: 'Datenbereich: je Start, nur in der VM', vault: 'Tresor: nur bei dir' }
			},
			secretsTitle: 'Wer welches Geheimnis kennt',
			cols: { what: 'Geheimnis', has: 'Wer es kennt', not: 'Wer nicht' },
			secrets: [
				{ key: 'image', what: 'Image-Passphrase', d: 'öffnet die LUKS-Platte des Images. Für alle VMs eines Images gleich; das Image enthält nichts Persönliches.', has: 'Le Space: Ein Release-Image bekommt beim Bau auf einem GitHub-gehosteten Runner eine zufällige Passphrase, die der Lauf nur verschlüsselt (age) an Le Space ausgibt. Dazu deine App (versiegelt in deinem Profil) und die VM beim Start.', not: 'der Betreiber des Knotens' },
				{ key: 'data', what: 'Schlüssel des Datenbereichs', d: 'versiegelt alles, was die VM schreibt: Dokumente, Datenbank, Zertifikat.', has: 'nur die VM, nur im Speicher, bei jedem Start neu und zufällig. Nach dem Stopp gibt es ihn nicht mehr.', not: 'du, die App, Le Space, der Knoten' },
				{ key: 'vault', what: 'Hauptgeheimnis des Tresors', d: '32 zufällige Bytes; alle Schlüssel darunter werden daraus abgeleitet.', has: 'du: versiegelt mit deinem Passkey (PRF) und mit den 24 Wörtern, offen nur im Speicher deines Browsers.', not: 'Le Space, Aleph (dort liegt es nur versiegelt), die VM' },
				{ key: 'vault', what: 'Paperless-Passwörter, Sitzungsschlüssel', d: 'aus dem Tresor abgeleitet.', has: 'dein Browser; die VM bekommt sie nach der Prüfung, für diesen Start.', not: 'Le Space, der Knoten' },
				{ key: 'vault', what: 'Sicherungsschlüssel (age)', d: 'öffnet deine Sicherungen; aus dem Tresor abgeleitet oder selbst eingefügt.', has: 'dein Browser. Die VM verschlüsselt nur an den öffentlichen Teil; den Schlüssel selbst bekommt sie nur für eine Wiederherstellung und löscht ihn danach.', not: 'Le Space, die Speicheranbieter: Sie haben nur Chiffrat.' }
			],
			attestTitle: 'Was die Hardware bestätigt',
			proves: [
				'Deine App prüft im Browser einen Bericht des AMD-Prozessors: von AMD signiert (mit Zertifikaten aus AMDs Schlüsseldienst), nicht widerrufen, mit ausreichendem Firmware-Stand.',
				'Der Messwert im Bericht passt zu Firmware, Kernel und Initrd der Laufzeit, die in der App fest eingetragen ist, und zu einer Startzeile, die deinen App-Schlüssel als Besitzer nennt. Die App rechnet ihn selbst aus.',
				'Im Bericht stehen ein frischer Zufallswert und der TLS-Schlüssel der VM: Die Verbindung endet in genau dieser VM. Erst dann gehen Passphrase und Geheimnisse hinaus, signiert von deinem App-Schlüssel; die VM nimmt sie nur mit dieser Unterschrift an.',
				'Der Relay dazwischen trägt nur verschlüsselte Bytes. Geprüft wird in deinem Browser, nicht dort.'
			],
			gapsTitle: 'Noch nicht bestätigt',
			gaps: [
				'Der Inhalt des Images wird nicht mitgemessen. Dass in der VM das veröffentlichte Image läuft, stützt sich bisher darauf, dass sich seine Platte nur mit der Image-Passphrase öffnet, nicht auf einen Messwert der Hardware.',
				'Die Image-Passphrase ist für alle VMs eines Images gleich, und Le Space kennt sie. Darum liegt alles, was deine VM schreibt, im eigenen Datenbereich. Ein Image, dessen Passphrase nur dein Tresor kennt, ist in Vorbereitung.',
				'Der Bau ist nicht Bit für Bit wiederholbar, weil Debian-Pakete beim Bau geladen werden. Nachlesen lässt sich, was hineinkommt.',
				'Weitere Punkte aus dem laufenden Sicherheits-Audit sind noch offen.'
			],
			verifyTitle: 'Selbst nachprüfen',
			verify: {
				runtime: { t: 'Die Laufzeit der VM', d: 'Firmware, Kernel und Initrd: die Aleph-Nachricht, deren Hash in der App steht. Liefert Aleph etwas anderes, startet die App nichts.', links: ['Aleph-Nachricht'] },
				vm: { t: 'Deine VM und ihre Messwerte', d: 'Die INSTANCE-Nachricht deiner App-Adresse nennt die Messwerte, die die App eingetragen hat; die App zeigt Instanz und Knoten.', links: ['Aleph-Explorer'] },
				amd: { t: 'AMD SEV-SNP', d: 'Wie der Bericht aufgebaut ist und gegen welche Zertifikate er geprüft wird.', links: ['AMD SEV'] },
				image: { t: 'Das Image', d: 'Den STORE-Hash zeigt die App in der Einrichtung. Gebaut wird es vom Workflow rootfs.yml aus rootfs/build-image.sh; die Zusammenfassung jedes Laufs nennt den Hash und den Quelltext-Stand.', links: ['build-image.sh', 'rootfs.yml', 'Läufe'] },
				data: { t: 'Der Datenbereich', d: 'Die App zeigt, ob eine laufende VM ihren Datenbereich versiegelt hat. Gelingt das nicht, startet Paperless-ngx nicht.', links: ['paperless-data-disk'] },
				backups: { t: 'Die Sicherungen', d: 'Datensätze und Stücke sind bei Filecoin öffentlich einsehbar, ihr Inhalt verschlüsselt. Beim Wiederherstellen prüft die VM jedes Stück gegen seine Inhaltsadresse (Piece-CID).', links: ['Filfox'] },
				app: { t: 'Diese Web-App', d: 'Sie liegt auf IPFS. Welche Version die Domain ausliefert, zeigt ihr DNSLink-Eintrag (dig TXT _dnslink.paperless.le-space.de); jedes Release nennt seine CID.', links: ['Releases'] },
				docs: { t: 'Im Detail', d: 'Die Beschreibung, nach der diese Seite geschrieben ist.', links: ['Sicherheitsmodell', 'Schlüssel und Wiederherstellung', 'Eigenes Image', 'Ablauf'] }
			},
			repoNote: 'Der Quelltext liegt bei GitHub. Das Repository ist noch nicht öffentlich; bis dahin öffnen die GitHub-Links nur für Berechtigte.'
		},
		prices: {
			title: 'Preise',
			lead: 'Monatspakete mit Rechenstunden. Du zahlst nur Stunden, in denen Paperless-ngx läuft.',
			perMonth: 'pro Monat',
			hours: (h) => (h >= 720 ? 'Dauerbetrieb, rund um die Uhr' : `${h} Stunden`),
			example: 'Beispiel: zwei Stunden pro Woche sind rund 8,7 Stunden im Monat und passen in das kleinste Paket.',
			included: 'In jedem Paket enthalten: bis 8 GB Dokumente und ihre verschlüsselten Sicherungen in drei Kopien.',
		},
		faq: {
			title: 'Häufige Fragen',
			items: [
				{ q: 'Gehört Paperless anywhere zum Projekt Paperless-ngx?', a: DISCLAIMER.de },
				{ q: 'Was ist Paperless-ngx?', a: 'Paperless-ngx ist die Open-Source-Software, die in deiner VM läuft: Sie liest Dokumente ein, erkennt den Text und macht sie durchsuchbar. Paperless anywhere startet sie für dich auf Abruf in einer vertraulichen VM und sichert sie danach.' },
				{ q: 'Bekommen alle dieselbe Software?', a: 'Ja. Das System ist für alle gleich, und sein Hash ist öffentlich. Versiegelt wird es für jede Person einzeln, mit einer Passphrase aus ihrem Tresor, von einem Build-Dienst, den die App vorher prüft. Welches Image und welcher Dienst das sind, zeigt die App mit Hash und Quelltext-Stand; die Dokumentation beschreibt, wie man beides nachprüft.' },
				{ q: 'Brauche ich ein Konto?', a: 'Nein. Ein Passkey auf deinem Gerät öffnet deinen Tresor; die 24 Wörter sind der Weg zurück, falls das Gerät fehlt. Le Space kann den Tresor weder öffnen noch wiederherstellen.' },
				{ q: 'Was kostet es, wenn Paperless anywhere nicht läuft?', a: 'Keine Rechenzeit. Die Sicherungen liegen verschlüsselt bei den Speicheranbietern; sie sind im Paket enthalten.' }
			]
		},
		licences: {
			link: 'Lizenzen',
			title: 'Lizenzen – Paperless anywhere',
			description: 'Welche Open-Source-Software Paperless anywhere einsetzt, in welcher Version, unter welcher Lizenz und wo ihr Quellcode liegt.',
			h1: 'Lizenzen',
			lead: 'Paperless anywhere ist ein Angebot von Le Space. Es setzt freie Software ein; hier steht welche, in welcher Version, unter welcher Lizenz und wo ihr Quellcode liegt. Die Angaben stammen aus dem Build dieser Seite.',
			ngx: {
				title: 'Paperless-ngx',
				intro: 'In der VM läuft Paperless-ngx, ein unabhängiges Open-Source-Projekt unter der GNU General Public License, Version 3 (GPL-3.0).',
				version: 'Version',
				upstream: 'Offizielles Image',
				copy: 'Unsere Kopie',
				source: 'Quellcode dieser Version',
				licence: 'Lizenz',
				changes: 'Eigene Änderungen',
				changesText: 'Keine am Inhalt. Le Space kopiert das offizielle Image unverändert in eine einzige Schicht, weil Docker in der vertraulichen VM jede Schicht als volle Kopie ablegt. Dabei gehen nur die Gesundheitsprüfung und das Stoppsignal des Images verloren. Eingestellt wird Paperless-ngx über Umgebungsvariablen beim Start.',
				changesHow: 'So wird kopiert',
				changesConfig: 'So wird es gestartet'
			},
			vm: { title: 'Weitere Software in der VM', lead: 'Ebenfalls unverändert eingesetzt; die Container-Images als einschichtige Kopien wie oben.', name: 'Software', version: 'Version', licence: 'Lizenz', source: 'Quellcode' },
			app: {
				title: 'Diese Web-App',
				own: 'Der Code von Paperless anywhere (Web-App und VM-Image) steht unter der MIT-Lizenz.',
				ownLink: 'Quellcode und Lizenz',
				third: 'Die Web-App enthält Bibliotheken und Schriften anderer; ihre Namen, Versionen, Lizenzen und Lizenztexte stehen in einer eigenen Datei.',
				thirdLink: 'Lizenzen der Bibliotheken und Schriften'
			},
			gpl: { title: 'Text der GPL-3.0', show: 'Lizenztext anzeigen (Englisch, wie veröffentlicht)' },
			back: 'Zur Startseite'
		},
		cta: { title: 'Bereit?', lead: 'Tresor anlegen dauert eine Minute. Kein Konto, kein Passwort.' },
		footer: { by: 'Ein Projekt von Le Space', belege: 'Le Space Belege', imprint: 'Impressum', imprintUrl: 'https://le-space.de/#impressum', privacy: 'Datenschutz', privacyUrl: 'https://le-space.de/#datenschutz', built: 'Paperless anywhere rechnet auf vertraulichen Knoten von Aleph Cloud und sichert auf Filecoin.', ngxLink: 'Paperless-ngx auf GitHub' }
	},
	en: {
		title: 'Paperless anywhere – Paperless-ngx on demand, confidential',
		description: 'Paperless-ngx on demand in a confidential VM. Costs only while it runs; then backed up, encrypted, and shut down.',
		ogImageAlt: 'Paperless anywhere, Paperless-ngx on demand, run by Le Space: Your documents. Awake only when you need them.',
		nav: { how: 'How it works', tee: 'Confidential', nodes: 'Nodes', storage: 'Backups', trust: 'Verify', prices: 'Prices', faq: 'FAQ' },
		tagline: 'Paperless-ngx on demand, run by Le Space',
		disclaimer: DISCLAIMER.en,
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
				{ t: 'The operator cannot read along', d: 'Whoever runs the node cannot read the VM’s memory or disk. What your VM writes also goes into an area it seals at every start with a key of its own. That key exists only in the VM’s memory.' },
				{ t: 'Check first, then unlock', d: 'Before the app hands over a key, it has the hardware confirm what was started: firmware, kernel and initrd. If the attestation does not match, the disk stays locked.' }
			]
		},
		ownImage: {
			title: 'An image of your own',
			lead: 'Your VM boots from an encrypted image. Its passphrase comes from your vault, and nobody else has it: not Le Space, not the node, not GitHub.',
			steps: [
				{ t: 'Public image', d: 'The system Paperless-ngx runs in is the same for everyone and holds no secret. Its hash is in the app; anyone can recompute it.' },
				{ t: 'Attested builder', d: 'A small service in a confidential VM. The app has the hardware confirm that exactly the published code runs there.' },
				{ t: 'Your image', d: 'Only then the app sends the passphrase from your vault. The service seals the image with it and forgets it again.' },
				{ t: 'Your VM', d: 'At the start the VM opens the disk with your passphrase. A disk that was not sealed with it does not open, and nothing starts.' }
			],
			knowsTitle: 'Who knows the passphrase?',
			answers: { yes: 'yes', brief: 'briefly', no: 'no' },
			knows: [
				{ who: 'Your vault', v: 'yes', d: 'derives it' },
				{ who: 'The builder', v: 'brief', d: 'during the build, in memory only' },
				{ who: 'Your VM', v: 'brief', d: 'at the start, in memory only' },
				{ who: 'Le Space', v: 'no' },
				{ who: 'The node’s operator', v: 'no' },
				{ who: 'GitHub', v: 'no' }
			],
			compare: 'What can be compared in public: the image’s hash and the builder’s measurement. Your encrypted image looks different for every person.'
		},
		nodes: {
			title: 'Confidential compute nodes, right now',
			lead: 'Your Paperless anywhere can start on these nodes right now. The list is live.',
			loading: 'Loading the node list …',
			error: 'The node list cannot be reached right now.',
			count: (n, fit) => `${n} TEE nodes, ${fit} of them with room for a Paperless anywhere VM (2 vCPU, 4 GiB, 40 GiB)`,
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
		trust: {
			title: 'Checkable: who holds which key',
			lead: 'Where the image is built, how its disk is encrypted, who knows which secret and what the hardware confirms. With the points that are still open, and where you can check each claim yourself.',
			diagramLabel: 'Diagram: a GitHub runner builds the image and encrypts it with LUKS; it is stored on Aleph. It runs in a confidential VM (AMD SEV-SNP): firmware, kernel, initrd and owner are measured, the image is not; what the VM writes goes into a data area with a random key only the VM has. Backups are encrypted with age inside the VM and stored on Filecoin. Your browser checks the VM’s attestation and only then sends the passphrase and secrets.',
			diagram: {
				build: { kicker: '1 · Built', title: 'GitHub runner', lines: ['rootfs.yml builds Debian,', 'Docker, Caddy, scripts', 'and encrypts (LUKS)'] },
				store: { kicker: '2 · Stored', title: 'Aleph storage', lines: ['the image, encrypted,', 'named by its', 'STORE hash'] },
				vm: { kicker: '3 · Runs', title: 'Confidential VM', sub: 'AMD SEV-SNP, on an Aleph node' },
				measured: { title: 'Measured ✓', lines: ['firmware · kernel · initrd · owner'] },
				image: { title: 'Image (LUKS): not measured', lines: ['opens only with', 'the image passphrase'] },
				data: { title: 'Data area (dm-crypt)', lines: ['random key at every start,', 'in the VM’s memory only'] },
				backup: { kicker: '4 · Backed up', title: 'Filecoin', lines: ['encrypted with age', 'inside the VM,', 'to your key'] },
				you: { kicker: 'You', title: 'Your browser, your vault', lines: ['① checks the VM’s AMD attestation', '② only then: passphrase, secrets', 'via a relay that only forwards'] },
				legend: 'Keys',
				keys: { image: 'Image passphrase: one per image', data: 'Data area: per start, in the VM only', vault: 'Vault: with you only' }
			},
			secretsTitle: 'Who knows which secret',
			cols: { what: 'Secret', has: 'Who knows it', not: 'Who does not' },
			secrets: [
				{ key: 'image', what: 'Image passphrase', d: 'opens the image’s LUKS disk. The same for every VM of an image; the image holds nothing personal.', has: 'Le Space: a release image gets a random passphrase while it is built on a GitHub-hosted runner, and the run puts it out only encrypted (age) to Le Space. Also your app (sealed in your profile) and the VM at its start.', not: 'the node’s operator' },
				{ key: 'data', what: 'Data area key', d: 'seals everything the VM writes: documents, database, certificate.', has: 'the VM only, in memory only, new and random at every start. After the stop it no longer exists.', not: 'you, the app, Le Space, the node' },
				{ key: 'vault', what: 'Vault master secret', d: '32 random bytes; every key below is derived from it.', has: 'you: sealed by your passkey (PRF) and by the 24 words, open only in your browser’s memory.', not: 'Le Space, Aleph (it holds it sealed only), the VM' },
				{ key: 'vault', what: 'Paperless passwords, session keys', d: 'derived from the vault.', has: 'your browser; the VM gets them after the check, for this start.', not: 'Le Space, the node' },
				{ key: 'vault', what: 'Backup key (age)', d: 'opens your backups; derived from the vault, or pasted in by you.', has: 'your browser. The VM encrypts to its public part only; it gets the key itself only for a restore and deletes it afterwards.', not: 'Le Space, the storage providers: they hold ciphertext only.' }
			],
			attestTitle: 'What the hardware confirms',
			proves: [
				'Your app checks a report from the AMD processor in the browser: signed by AMD (with certificates from AMD’s key service), not revoked, with a firmware level high enough.',
				'The measurement in the report matches the firmware, kernel and initrd of the runtime fixed in the app, and a boot line naming your app key as the owner. The app computes it itself.',
				'The report carries a fresh random value and the VM’s TLS key: the connection ends in exactly this VM. Only then do the passphrase and secrets go out, signed by your app key; the VM accepts them only with that signature.',
				'The relay in between carries encrypted bytes only. The checking happens in your browser, not there.'
			],
			gapsTitle: 'Not confirmed yet',
			gaps: [
				'The image’s content is not measured. That the VM runs the published image rests, for now, on its disk opening only with the image passphrase, not on a measurement by the hardware.',
				'The image passphrase is the same for every VM of an image, and Le Space knows it. That is why everything your VM writes goes into its own data area. An image whose passphrase only your vault knows is in preparation.',
				'The build cannot be repeated bit for bit, because Debian packages are fetched while it runs. What goes in can be read.',
				'Further points from the ongoing security audit are still open.'
			],
			verifyTitle: 'Check it yourself',
			verify: {
				runtime: { t: 'The VM’s runtime', d: 'Firmware, kernel and initrd: the Aleph message whose hash is fixed in the app. If Aleph delivers anything else, the app starts nothing.', links: ['Aleph message'] },
				vm: { t: 'Your VM and its measurements', d: 'The INSTANCE message of your app address names the measurements the app put in; the app shows instance and node.', links: ['Aleph explorer'] },
				amd: { t: 'AMD SEV-SNP', d: 'How the report is built and which certificates it is checked against.', links: ['AMD SEV'] },
				image: { t: 'The image', d: 'The app shows the STORE hash in the setup. The workflow rootfs.yml builds it from rootfs/build-image.sh; every run’s summary names the hash and the source commit.', links: ['build-image.sh', 'rootfs.yml', 'Runs'] },
				data: { t: 'The data area', d: 'The app shows whether a running VM sealed its data area. If that fails, Paperless-ngx does not start.', links: ['paperless-data-disk'] },
				backups: { t: 'The backups', d: 'Data sets and pieces are public on Filecoin, their content encrypted. At a restore the VM checks every piece against its content address (piece CID).', links: ['Filfox'] },
				app: { t: 'This web app', d: 'It is served from IPFS. Which version the domain serves, its DNSLink record shows (dig TXT _dnslink.paperless.le-space.de); every release names its CID.', links: ['Releases'] },
				docs: { t: 'In detail', d: 'The description this page is written from.', links: ['Security model', 'Keys and recovery', 'Your own image', 'Workflow'] }
			},
			repoNote: 'The source code is on GitHub. The repository is not public yet; until then the GitHub links open for authorised people only.'
		},
		prices: {
			title: 'Prices',
			lead: 'Monthly packages of compute hours. You only use hours while Paperless-ngx runs.',
			perMonth: 'per month',
			hours: (h) => (h >= 720 ? 'Always on, around the clock' : `${h} hours`),
			example: 'Example: two hours a week are about 8.7 hours a month and fit in the smallest package.',
			included: 'Included in every package: up to 8 GB of documents and their encrypted backups in three copies.',
		},
		faq: {
			title: 'Frequently asked questions',
			items: [
				{ q: 'Is Paperless anywhere part of the Paperless-ngx project?', a: DISCLAIMER.en },
				{ q: 'What is Paperless-ngx?', a: 'Paperless-ngx is the open source software that runs in your VM: it takes in documents, recognises their text and makes them searchable. Paperless anywhere starts it for you on demand in a confidential VM and backs it up afterwards.' },
				{ q: 'Does everyone get the same software?', a: 'Yes. The system is the same for everyone, and its hash is public. It is sealed for each person separately, with a passphrase from their vault, by a builder the app checks first. Which image and which builder these are, the app shows with hash and source commit; the documentation says how to check both.' },
				{ q: 'Do I need an account?', a: 'No. A passkey on your device opens your vault; the 24 words are the way back in if the device is missing. Le Space can neither open nor recover the vault.' },
				{ q: 'What does it cost while Paperless anywhere is not running?', a: 'No compute time. The backups are stored encrypted with the storage providers; they are included in the package.' }
			]
		},
		licences: {
			link: 'Licences',
			title: 'Licences – Paperless anywhere',
			description: 'Which open source software Paperless anywhere uses, in which version, under which licence, and where its source code is.',
			h1: 'Licences',
			lead: 'Paperless anywhere is offered by Le Space. It uses free software; this page says which, in which version, under which licence and where its source code is. The details come from the build of this page.',
			ngx: {
				title: 'Paperless-ngx',
				intro: 'The VM runs Paperless-ngx, an independent open source project under the GNU General Public License, version 3 (GPL-3.0).',
				version: 'Version',
				upstream: 'Official image',
				copy: 'Our copy',
				source: 'Source code of this version',
				licence: 'Licence',
				changes: 'Our changes',
				changesText: 'None to its content. Le Space copies the official image unchanged into a single layer, because Docker in the confidential VM stores every layer as a full copy. Only the image’s health check and stop signal are lost on the way. Paperless-ngx is configured through environment variables at start.',
				changesHow: 'How it is copied',
				changesConfig: 'How it is started'
			},
			vm: { title: 'Other software in the VM', lead: 'Also used unchanged; the container images as one-layer copies as above.', name: 'Software', version: 'Version', licence: 'Licence', source: 'Source code' },
			app: {
				title: 'This web app',
				own: 'The code of Paperless anywhere (web app and VM image) is under the MIT licence.',
				ownLink: 'Source code and licence',
				third: 'The web app contains libraries and fonts by others; their names, versions, licences and licence texts are in a file of their own.',
				thirdLink: 'Licences of the libraries and fonts'
			},
			gpl: { title: 'Text of the GPL-3.0', show: 'Show the licence text (English, as published)' },
			back: 'Back to the start page'
		},
		cta: { title: 'Ready?', lead: 'Creating a vault takes a minute. No account, no password.' },
		footer: { by: 'A Le Space project', belege: 'Le Space Belege', imprint: 'Imprint', imprintUrl: 'https://le-space.de/#imprint', privacy: 'Privacy', privacyUrl: 'https://le-space.de/#privacy', built: 'Paperless anywhere computes on confidential nodes of Aleph Cloud and backs up to Filecoin.', ngxLink: 'Paperless-ngx on GitHub' }
	}
};
