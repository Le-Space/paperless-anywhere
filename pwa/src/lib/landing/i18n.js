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

// The terms of the paid service (Le Space Credits). The instruction on
// withdrawal is their § 9; the page is in German.
export const TERMS_URL = 'https://credits.le-space.de/agb';

export const texts = {
	de: {
		title: 'Paperless anywhere – ausfallsicher, vertraulich, nach deinem Takt',
		description: 'Paperless anywhere läuft ausfallsicher, vertraulich und nach deinem Takt: Paperless-ngx in einer vertraulichen VM, auf Knoten mehrerer Betreiber, im Monatspaket rund um die Uhr oder auf Abruf.',
		ogImageAlt: 'Paperless anywhere, Paperless-ngx auf Abruf, betrieben von Le Space: Deine Dokumente. Nur wach, wenn du sie brauchst.',
		nav: { how: 'So geht’s', tee: 'Vertraulich', nodes: 'Ausfallsicher', storage: 'Sicherungen', trust: 'Nachprüfbar', prices: 'Preise', faq: 'FAQ' },
		tagline: 'Paperless-ngx auf Abruf, betrieben von Le Space',
		disclaimer: DISCLAIMER.de,
		open: 'Paperless anywhere starten',
		openHint: 'Mit Passkey, ohne Konto.',
		hero: {
			kicker: 'Dezentral · vertraulich · auf Abruf',
			// The headline: a fixed sentence in which one word changes. `full` is what
			// a screen reader says and what the page's title holds: all three.
			before: 'Paperless anywhere läuft',
			words: ['ausfallsicher.', 'vertraulich.', 'nach deinem Takt.'],
			full: 'Paperless anywhere läuft ausfallsicher, vertraulich und nach deinem Takt.',
			lead: 'Darin läuft Paperless-ngx, auf vertraulichen Knoten mehrerer Betreiber und mit Sicherungen bei mehreren unabhängigen Speicheranbietern: kein einzelnes Rechenzentrum. Die VM ist vertraulich (AMD SEV-SNP); bei jedem Start bestätigt der Prozessor Firmware, Kernel und Initrd, und die App prüft das, bevor sie einen Schlüssel herausgibt. Du wählst, wie es läuft: im Dauerbetrieb rund um die Uhr oder auf Abruf, wenn du es brauchst, etwa für die Buchhaltung.'
		},
		points: [
			{ t: 'Ausfallsicher', d: 'Kein einzelnes Rechenzentrum: Gerechnet wird auf Knoten mehrerer Betreiber, gesichert bei mehreren unabhängigen Speicheranbietern. Fällt ein Knoten aus, startest du auf einem anderen.' },
			{ t: 'Vertraulich und nachprüfbar', d: 'Speicher und Platte der VM sind verschlüsselt; der Betreiber des Knotens kann sie nicht lesen. Was der Prozessor bestätigt und was noch offen ist, steht unter „Nachprüfbar“.' },
			{ t: 'Rund um die Uhr oder auf Abruf', d: 'Ein Monatspaket, das zu deinem Betrieb passt: Dauerbetrieb rund um die Uhr, oder ein Stundenpaket zum Starten, Arbeiten und Stoppen.' }
		],
		trustHint: 'Nachprüfbar: wer welchen Schlüssel hat, was die Hardware bestätigt und was noch offen ist',
		audience: {
			title: 'Für wen?',
			lead: 'Für Unternehmen, die ihr Dokumentenarchiv rund um die Uhr brauchen: Paperless anywhere läuft im Dauerbetrieb, vertraulich und an keinen einzelnen Betreiber gebunden. Und für Selbstständige und kleine Firmen, die es nur ab und zu brauchen: Deine eigene VM ist in etwa einer Viertelstunde bereit, zum Beispiel einmal in der Woche oder zum Monatsabschluss für die Buchhaltung, und kostet dazwischen keine Rechenzeit.'
		},
		how: {
			title: 'So geht’s',
			steps: [
				{ t: 'Tresor anlegen', d: 'Ein Passkey auf deinem Gerät öffnet deinen Tresor. Dazu bekommst du 24 Wörter zum Aufschreiben: Damit kommst du auch ohne das Gerät wieder hinein. Für den Tresor brauchst du kein Konto und keine E-Mail-Adresse. Erst beim Kauf eines Pakets fragt der Zahlungsdienst Stripe nach einer E-Mail-Adresse, für Beleg und Abo.' },
				{ t: 'Starten', d: 'Die App sucht einen freien TEE-Knoten, prüft dessen Hardware-Nachweis und gibt erst dann den Schlüssel für die Platte heraus. Die Sicherung wird eingespielt.' },
				{ t: 'Arbeiten', d: 'Paperless-ngx wie gewohnt im Browser: hochladen, verschlagworten, suchen.' },
				{ t: 'Sichern und beenden', d: 'Ein Klick: Die VM verschlüsselt eine Sicherung, legt sie dezentral ab und fährt herunter. Von da an fällt keine Rechenzeit mehr an.' }
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
			status: 'In Vorbereitung',
			title: 'Als Nächstes: ein Image nur für dich',
			lead: 'Noch nicht in Betrieb. Heute teilen alle VMs eines Images dessen Passphrase, und Le Space kennt sie (siehe „Nachprüfbar“). So soll es werden: Die Passphrase kommt aus deinem Tresor, und sonst hat sie niemand: nicht Le Space, nicht der Knoten, nicht GitHub.',
			steps: [
				{ t: 'Öffentliches Image', d: 'Das System, in dem Paperless-ngx läuft, ist für alle gleich und enthält kein Geheimnis. Der Image-Workflow veröffentlicht es auf Wunsch schon unverschlüsselt, mit seinem Hash; jeder kann ihn nachrechnen.' },
				{ t: 'Geprüfter Build-Dienst', d: 'Ein kleiner Dienst in einer vertraulichen VM, vollständig gemessen, samt dem Image, das er versiegelt. Die App wird sich von der Hardware bestätigen lassen, dass dort genau der veröffentlichte Code mit genau diesem Image läuft.' },
				{ t: 'Dein Image', d: 'Erst dann schickt die App die Passphrase aus deinem Tresor. Der Dienst versiegelt das Image damit und vergisst sie wieder. Die App holt das versiegelte Image über denselben geprüften Kanal und legt es selbst bei Aleph ab.' },
				{ t: 'Deine VM', d: 'Beim Start öffnet die VM die Platte mit deiner Passphrase. Eine Platte, die nicht damit versiegelt wurde, geht nicht auf, und es startet nichts.' }
			],
			knowsTitle: 'Wer die Passphrase dann kennt',
			answers: { yes: 'ja', brief: 'nur kurz', no: 'nein' },
			knows: [
				{ who: 'Dein Tresor', v: 'yes', d: 'leitet sie ab' },
				{ who: 'Der Build-Dienst', v: 'brief', d: 'während des Baus, nur im Speicher' },
				{ who: 'Deine VM', v: 'brief', d: 'beim Start, nur im Speicher' },
				{ who: 'Le Space', v: 'no' },
				{ who: 'Der Betreiber des Knotens', v: 'no' },
				{ who: 'GitHub', v: 'no' }
			],
			compare: 'Öffentlich vergleichen lassen sich dann der Hash des Images und der Messwert des Build-Dienstes. Das verschlüsselte Image sieht bei jeder Person anders aus. Stand: Der Build-Dienst ist gebaut. Zur Probe lief er bei Aleph als gemessene VM, bestand dort die Prüfung durch die Hardware und versiegelte das echte Image. In Betrieb ist er nicht: Es läuft kein Dienst auf Dauer, und die App nennt keinen; erst dann erscheint „Mein Image bauen“ in der Einrichtung.'
		},
		nodes: {
			title: 'Ausfallsicher: kein einzelnes Rechenzentrum',
			lead: 'Dein Paperless anywhere hängt an keinem bestimmten Rechner: Es kann auf jedem dieser vertraulichen Knoten starten. Fällt einer aus, startest du auf einem anderen und spielst deine Sicherung ein. Die Liste ist live.',
			resilience: (n, o, c) => `${n} ${n === 1 ? 'vertraulicher Knoten' : 'vertrauliche Knoten'} von ${o} ${o === 1 ? 'Betreiber' : 'Betreibern'}${c ? ` in ${c} ${c === 1 ? 'Land' : 'Ländern'}` : ''}`,
			storageNote: 'Die Sicherungen liegen dazu bei mehreren unabhängigen Speicheranbietern, in den Ländern, die du wählst.',
			dependsNote: 'Was noch an Le Space hängt: Guthaben und Abrechnung, der Relay, über den die App den Nachweis der VM prüft, und die Auslieferung der App.',
			loading: 'Knotenliste wird geladen …',
			error: 'Die Knotenliste ist gerade nicht erreichbar.',
			count: (n, fit) => `${n} TEE-Knoten, ${fit} davon mit Platz für eine Paperless-anywhere-VM (2 vCPU, 4 GiB, 40 GiB)`,
			fits: 'hat Platz',
			full: 'gerade voll',
			free: (n) => `${n.freeVcpus} vCPU · ${n.freeMemoryGiB} GiB RAM frei`,
			you: 'deine VM',
			list: 'Alle Knoten anzeigen',
			countries: 'Länder der Knoten',
			placesNote: 'Standorte ungefähr, aus den IP-Adressen der Knoten ermittelt.',
		},
		storage: {
			title: 'Sicherungen, wo du willst',
			lead: 'Die Sicherung wird in der VM verschlüsselt, bevor sie die VM verlässt, und bei unabhängigen Speicheranbietern abgelegt. Sie weisen regelmäßig nach, dass sie die Daten noch haben.',
			choose: 'Du wählst selbst: Regionen oder Länder (zum Beispiel nur EU) und 1 bis 3 Kopien bei verschiedenen Anbietern.',
			loading: 'Anbieter werden geladen …',
			error: 'Die Anbieterliste ist gerade nicht erreichbar.',
			count: (n, c) => `${n} ${n === 1 ? 'zugelassener Anbieter' : 'zugelassene Anbieter'} in ${c} ${c === 1 ? 'Land' : 'Ländern'}`,
			endorsed: 'empfohlen',
		},
		trust: {
			title: 'Nachprüfbar: wer welchen Schlüssel hat',
			lead: 'Wo das Image entsteht, wie seine Platte verschlüsselt ist, wer welches Geheimnis kennt und was die Hardware bestätigt. Dazu steht hier, was noch offen ist und wo du jede Aussage selbst prüfen kannst.',
			diagramLabel: 'Schaubild: Ein GitHub-Runner baut das Image und verschlüsselt es mit LUKS; es liegt bei Aleph. Es läuft in einer vertraulichen VM (AMD SEV-SNP): Gemessen werden Firmware, Kernel, Initrd und Besitzer, nicht das Image; was die VM schreibt, liegt in einem Datenbereich mit einem Zufallsschlüssel, den nur sie hat. Sicherungen werden in der VM mit age verschlüsselt und bei Filecoin abgelegt. Dein Browser prüft den Nachweis der VM und schickt erst dann Passphrase und Geheimnisse.',
			diagram: {
				build: { kicker: '1 · Gebaut', title: 'GitHub-Runner', lines: ['rootfs.yml baut Debian,', 'Docker, Caddy, Skripte', 'und verschlüsselt (LUKS)'] },
				store: { kicker: '2 · Abgelegt', title: 'Aleph-Speicher', lines: ['das Image, verschlüsselt,', 'benannt durch seinen', 'STORE-Hash'] },
				vm: { kicker: '3 · Läuft', title: 'Vertrauliche VM', sub: 'AMD SEV-SNP, auf einem Aleph-Knoten' },
				measured: { title: 'Gemessen ✓', lines: ['Firmware · Kernel · Initrd · Besitzer'] },
				image: { title: 'Image (LUKS): nicht gemessen', lines: ['öffnet sich nur mit', 'der Image-Passphrase'] },
				data: { title: 'Datenbereich (dm-crypt)', lines: ['Zufallsschlüssel bei jedem Start,', 'nur im Speicher der VM'] },
				backup: { kicker: '4 · Gesichert', title: 'Filecoin', lines: ['in der VM mit age', 'verschlüsselt, für', 'deinen Schlüssel'] },
				you: { kicker: 'Du', title: 'Dein Browser, dein Tresor', lines: ['① prüft den AMD-Nachweis der VM', '② erst dann: Passphrase, Geheimnisse', 'über einen Relay, der nur weiterleitet'] },
				legend: 'Schlüssel',
				keys: { image: 'Image-Passphrase: eine je Image', data: 'Datenbereich: je Start, nur in der VM', vault: 'Tresor: nur bei dir' }
			},
			fold: { secrets: (n) => `${n} Geheimnisse`, verify: (n) => `${n} Stellen mit Links` },
			sampleTitle: 'So sieht der Nachweis in der App aus',
			sampleLead: 'Läuft deine VM, zeigt die App zu jeder Aussage den Wert, woher sie ihn hat und wo du ihn prüfen kannst. Hier mit erfundenen Werten, denn ohne gebuchte VM gibt es keine echten; nur die Laufzeit ist die echte, sie ist für alle gleich. In der App führen die Links zu deinen eigenen Nachrichten bei Aleph.',
			secretsTitle: 'Wer welches Geheimnis kennt',
			cols: { what: 'Geheimnis', has: 'Wer es kennt', not: 'Wer nicht' },
			secrets: [
				{ key: 'image', what: 'Image-Passphrase', d: 'öffnet die LUKS-Platte des Images. Für alle VMs eines Images gleich; das Image enthält nichts Persönliches.', has: 'Le Space: Ein Release-Image bekommt beim Bau auf einem von GitHub gehosteten Runner eine zufällige Passphrase, die der Lauf nur verschlüsselt (age) an Le Space ausgibt. Dazu deine App (versiegelt in deinem Profil) und die VM beim Start.', not: 'der Betreiber des Knotens' },
				{ key: 'data', what: 'Schlüssel des Datenbereichs', d: 'versiegelt alles, was die VM schreibt: Dokumente, Datenbank, Zertifikat.', has: 'nur die VM, nur im Speicher, bei jedem Start neu und zufällig. Nach dem Stopp gibt es ihn nicht mehr.', not: 'du, die App, Le Space, der Knoten' },
				{ key: 'vault', what: 'Hauptgeheimnis des Tresors', d: '32 zufällige Bytes; alle Schlüssel darunter werden daraus abgeleitet.', has: 'du: versiegelt mit deinem Passkey (PRF) und mit den 24 Wörtern, offen nur im Speicher deines Browsers.', not: 'Le Space, Aleph (dort liegt es nur versiegelt), die VM' },
				{ key: 'vault', what: 'Paperless-Passwörter, Sitzungsschlüssel', d: 'aus dem Tresor abgeleitet.', has: 'dein Browser; die VM bekommt sie nach der Prüfung, für diesen Start.', not: 'Le Space, der Knoten' },
				{ key: 'vault', what: 'Sicherungsschlüssel (age)', d: 'öffnet deine Sicherungen; aus dem Tresor abgeleitet oder selbst eingefügt.', has: 'dein Browser. Die VM verschlüsselt nur mit dem öffentlichen Teil des Schlüssels; den Schlüssel selbst bekommt sie nur für eine Wiederherstellung und löscht ihn danach.', not: 'Le Space, die Speicheranbieter: Sie haben nur Chiffrat.' }
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
				vm: { t: 'Deine VM und ihre Messwerte', d: 'Die INSTANCE-Nachricht deiner App-Adresse nennt die Messwerte, die die App eingetragen hat. Die App zeigt zu einer laufenden VM Instanz, Knoten, Messwerte und das Ergebnis der Prüfung unter „Nachweis dieser VM“, mit Links zu genau deinen Nachrichten.', links: ['Aleph-Explorer'] },
				amd: { t: 'AMD SEV-SNP', d: 'Wie der Bericht aufgebaut ist und gegen welche Zertifikate er geprüft wird.', links: ['AMD SEV'] },
				image: { t: 'Das Image', d: 'Den STORE-Hash zeigt die App in der Einrichtung. Gebaut wird es vom Workflow rootfs.yml aus rootfs/build-image.sh; die Zusammenfassung jedes Laufs nennt den Hash und den Quelltext-Stand.', links: ['build-image.sh', 'rootfs.yml', 'Läufe'] },
				data: { t: 'Der Datenbereich', d: 'Die App zeigt, ob eine laufende VM ihren Datenbereich versiegelt hat. Gelingt das nicht, startet Paperless-ngx nicht.', links: ['paperless-data-disk'] },
				backups: { t: 'Die Sicherungen', d: 'Datensätze und Stücke sind bei Filecoin öffentlich einsehbar, ihr Inhalt verschlüsselt. Beim Wiederherstellen prüft die VM jedes Stück gegen seine Inhaltsadresse (Piece-CID).', links: ['Filfox'] },
				app: { t: 'Diese Web-App', d: 'Sie liegt auf IPFS. Welche Version die Domain ausliefert, zeigt ihr DNSLink-Eintrag (dig TXT _dnslink.paperless.le-space.de); jedes Release nennt seine CID.', links: ['Releases'] },
				docs: { t: 'Im Detail', d: 'Die Beschreibung, nach der diese Seite geschrieben ist.', links: ['Sicherheitsmodell', 'Schlüssel und Wiederherstellung', 'Eigenes Image', 'Ablauf', 'Varianten vertraulicher VMs im Vergleich'] }
			},
			repoNote: 'Der Quelltext liegt offen bei GitHub: github.com/Le-Space/paperless-anywhere.'
		},
		prices: {
			title: 'Preise',
			lead: 'Wähle ein Monatspaket: Dauerbetrieb rund um die Uhr, oder die Stunden, die du im Monat brauchst.',
			perMonth: 'pro Monat',
			vat: 'Alle Preise inkl. 19 % USt.',
			legal: { before: 'Es gelten die ', terms: 'AGB', between: '; dort steht auch die ', withdrawal: 'Widerrufsbelehrung', after: ' (§ 9).' },
			hours: (h) => (h >= 720 ? 'Dauerbetrieb, rund um die Uhr' : `${h} Stunden`),
			example: 'Beispiel: zwei Stunden pro Woche sind rund 8,7 Stunden im Monat und passen in das kleinste Paket.',
			included: 'In jedem Paket enthalten: bis 8 GB Dokumente.',
			backup: (price) => `Die verschlüsselte Sicherung in drei Kopien ist nicht im Paket enthalten: Sie kostet ${price} im Monat dazu. Du buchst sie beim Paket mit, als weitere Zeile deines Monatsabos.`,
			backupYear: (price) => `Oder einmalig ${price} für ein Jahr Aufbewahrung, mit oder ohne Paket. Aufbewahren heißt nicht öffnen: Zum Wiederherstellen braucht es Rechenzeit, also ein Paket oder Zusatzstunden.`,
			backupNeed: 'Du brauchst sie, damit deine Dokumente nach einem Stopp zurückkommen: Beim Stoppen wird die VM gelöscht, beim nächsten Start kommt alles aus der Sicherung.',
			backupTotal: (hours, plan, backup, total) => `${hours} mit Sicherung: ${plan} + ${backup} = ${total} im Monat.`,
			backupAfter: 'Nach dem Ende des bezahlten Zeitraums entstehen keine neuen Sicherungen; die vorhandenen bleiben noch mindestens 30 Tage abrufbar.',
		},
		faq: {
			title: 'Häufige Fragen',
			items: [
				{ q: 'Gehört Paperless anywhere zum Projekt Paperless-ngx?', a: DISCLAIMER.de },
				{ q: 'Was ist Paperless-ngx?', a: 'Paperless-ngx ist die Open-Source-Software, die in deiner VM läuft: Sie liest Dokumente ein, erkennt den Text und macht sie durchsuchbar. Paperless anywhere startet sie für dich auf Abruf in einer vertraulichen VM und sichert sie danach.' },
				{ q: 'Bekommen alle dieselbe Software?', a: 'Ja. Das System ist für alle gleich. Heute öffnet eine Passphrase je Image die Platte; alle VMs dieses Images teilen sie, und Le Space kennt sie. Was deine VM schreibt, liegt deshalb in einem Datenbereich mit einem Schlüssel, den nur sie hat. In Vorbereitung ist, dass ein geprüfter Build-Dienst das Image für jede Person einzeln versiegelt, mit einer Passphrase aus ihrem Tresor. Wie man Image und Dienst dann nachprüft, beschreibt die Dokumentation.' },
				{ q: 'Brauche ich ein Konto?', a: 'Für den Tresor nicht. Ein Passkey auf deinem Gerät öffnet ihn; die 24 Wörter sind der Weg zurück, falls das Gerät fehlt. Le Space kann den Tresor weder öffnen noch wiederherstellen. Beim Kauf eines Pakets fragt der Zahlungsdienst Stripe nach einer E-Mail-Adresse, für Beleg und Abo.' },
				{
					q: 'Wie sicher ist mein eigenes Gerät dabei?',
					a: 'Deine Dokumente liegen verschlüsselt in der VM und in den Sicherungen, und die Schlüssel dazu entstehen nur bei dir, wenn du den Tresor öffnest. Die Grenze ist der Browser auf deinem Gerät, wie bei jeder Web-App und jedem Passwortmanager im Browser: Was dort offen liegt, kann eine Browser-Erweiterung mit Zugriff auf die Seite oder Schadsoftware mitlesen. An den Passkey selbst kommt sie nicht, und ohne deine Freigabe per Fingerabdruck oder PIN öffnet er nichts. Mit wenig Aufwand bist du auf der sicheren Seite:',
					tips: [
						'Nutze für Paperless anywhere ein eigenes Browser-Profil ohne Erweiterungen und installiere die App dort.',
						'Oder nimm ein privates Fenster, ein Telefon oder ein Tablet.',
						'Gib die 24 Wörter nur in der App auf paperless.le-space.de ein und bewahre sie auf Papier auf. Der Passkey gilt nur für diese Adresse; nach den Wörtern kann auch eine gefälschte Seite fragen.',
						'Sperre den Tresor nach der Arbeit mit „Sperren“.'
					],
					more: { text: 'Die Einzelheiten stehen im Sicherheitsmodell.', href: 'https://github.com/Le-Space/paperless-anywhere/blob/main/docs/security-model.md#your-own-device' }
				},
				{ q: 'Was kostet es, wenn Paperless anywhere nicht läuft?', a: 'Stunden verbraucht nur eine laufende Instanz. Dein Monatspaket läuft aber weiter und wird jeden Monat berechnet, bis du kündigst. Die Sicherung ist nicht im Paket enthalten: Sie kostet extra, monatlich zum Paket dazu oder einmalig für ein Jahr (siehe Preise). Nach dem Ende des bezahlten Zeitraums entstehen keine neuen Sicherungen; die vorhandenen bleiben noch mindestens 30 Tage abrufbar.' }
			]
		},
		licences: {
			link: 'Lizenzen',
			title: 'Lizenzen – Paperless anywhere',
			description: 'Welche Open-Source-Software Paperless anywhere einsetzt, in welcher Version, unter welcher Lizenz und wo ihr Quellcode liegt.',
			h1: 'Lizenzen',
			lead: 'Paperless anywhere ist ein Angebot von Le Space. Es setzt freie Software ein; hier steht, welche, in welcher Version, unter welcher Lizenz und wo ihr Quellcode liegt. Die Angaben stammen aus dem Build dieser Seite.',
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
				own: 'Der Code von Paperless anywhere (Web-App und VM-Image) steht unter der GNU Affero General Public License, Version 3 oder später (AGPL-3.0-or-later). Der Quelltext des Dienstes, der hier läuft, liegt im öffentlichen Repository.',
				ownLink: 'Quellcode und Lizenz',
				third: 'Die Web-App enthält Bibliotheken und Schriften anderer; ihre Namen, Versionen, Lizenzen und Lizenztexte stehen in einer eigenen Datei.',
				thirdLink: 'Lizenzen der Bibliotheken und Schriften'
			},
			gpl: { title: 'Text der GPL-3.0', show: 'Lizenztext anzeigen (Englisch, wie veröffentlicht)' },
			back: 'Zur Startseite'
		},
		cta: { title: 'Bereit?', lead: 'Den Tresor anzulegen dauert eine Minute. Kein Konto, kein Passwort.' },
		footer: { by: 'Ein Projekt von Le Space', belege: 'Le Space Belege', imprint: 'Impressum', imprintUrl: 'https://le-space.de/#impressum', privacy: 'Datenschutz', privacyUrl: 'https://le-space.de/#datenschutz', built: 'Paperless anywhere rechnet auf vertraulichen Knoten von Aleph Cloud und sichert auf Filecoin.', ngxLink: 'Paperless-ngx auf GitHub', terms: 'AGB', withdrawal: 'Widerrufsbelehrung' }
	},
	en: {
		title: 'Paperless anywhere – resilient, confidential, on your schedule',
		description: 'Paperless anywhere runs resilient, confidential and on your schedule: Paperless-ngx in a confidential VM, on nodes of several operators, in a monthly package around the clock or on demand.',
		ogImageAlt: 'Paperless anywhere, Paperless-ngx on demand, run by Le Space: Your documents. Awake only when you need them.',
		nav: { how: 'How it works', tee: 'Confidential', nodes: 'Resilient', storage: 'Backups', trust: 'Verify', prices: 'Prices', faq: 'FAQ' },
		tagline: 'Paperless-ngx on demand, run by Le Space',
		disclaimer: DISCLAIMER.en,
		open: 'Open the app',
		openHint: 'With a passkey, no account. The app itself is in German for now.',
		hero: {
			kicker: 'Decentralised · confidential · on demand',
			before: 'Paperless anywhere runs',
			words: ['resilient.', 'confidential.', 'on your schedule.'],
			full: 'Paperless anywhere runs resilient, confidential and on your schedule.',
			lead: 'Inside it runs Paperless-ngx, on confidential nodes of several operators and with backups at several independent storage providers: no single data centre. The VM is confidential (AMD SEV-SNP); at every start the processor confirms firmware, kernel and initrd, and the app checks that before it hands over a key. You choose how it runs: always on, around the clock, or on demand when you need it, for the bookkeeping, say.'
		},
		points: [
			{ t: 'Resilient', d: 'No single data centre: it computes on nodes of several operators and backs up to several independent storage providers. If a node fails, you start on another.' },
			{ t: 'Confidential and checkable', d: 'The VM’s memory and disk are encrypted; the node’s operator cannot read them. What the processor confirms and what is still open is under “Verify”.' },
			{ t: 'Around the clock or on demand', d: 'A monthly package that fits how you work: always on, around the clock, or a package of hours to start, work and stop.' }
		],
		trustHint: 'Checkable: who holds which key, what the hardware confirms and what is still open',
		audience: {
			title: 'Who is it for?',
			lead: 'For companies that need their document archive around the clock: Paperless anywhere runs always on, confidential and tied to no single operator. And for freelancers and small businesses that need it only now and then: your own VM is ready in about a quarter of an hour, say once a week or at the month’s end for the bookkeeping, and uses no compute time in between.'
		},
		how: {
			title: 'How it works',
			steps: [
				{ t: 'Create your vault', d: 'A passkey on your device opens your vault. You also get 24 words to write down: they get you back in without the device. The vault needs no account and no e-mail address. Only when you buy a package does the payment service Stripe ask for an e-mail address, for the receipt and the subscription.' },
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
			status: 'In preparation',
			title: 'Next: an image of your own',
			lead: 'Not in operation yet. Today every VM of an image shares its passphrase, and Le Space knows it (see “Checkable”). This is where it is going: the passphrase comes from your vault, and nobody else has it: not Le Space, not the node, not GitHub.',
			steps: [
				{ t: 'Public image', d: 'The system Paperless-ngx runs in is the same for everyone and holds no secret. The image workflow can already publish it unencrypted, with its hash; anyone can recompute it.' },
				{ t: 'Attested builder', d: 'A small service in a confidential VM, measured as a whole, together with the image it seals. The app will have the hardware confirm that exactly the published code runs there with exactly that image.' },
				{ t: 'Your image', d: 'Only then the app sends the passphrase from your vault. The service seals the image with it and forgets it again. The app fetches the sealed image over the same attested channel and stores it on Aleph itself.' },
				{ t: 'Your VM', d: 'At the start the VM opens the disk with your passphrase. A disk that was not sealed with it does not open, and nothing starts.' }
			],
			knowsTitle: 'Who will know the passphrase',
			answers: { yes: 'yes', brief: 'briefly', no: 'no' },
			knows: [
				{ who: 'Your vault', v: 'yes', d: 'derives it' },
				{ who: 'The builder', v: 'brief', d: 'during the build, in memory only' },
				{ who: 'Your VM', v: 'brief', d: 'at the start, in memory only' },
				{ who: 'Le Space', v: 'no' },
				{ who: 'The node’s operator', v: 'no' },
				{ who: 'GitHub', v: 'no' }
			],
			compare: 'What can then be compared in public: the image’s hash and the builder’s measurement. Your encrypted image looks different for every person. Where it stands: the builder is built. In a trial it ran on Aleph as a measured VM, passed the hardware’s check there and sealed the real image. It is not in operation: no builder runs permanently and the app names none; only then does “Mein Image bauen” appear in the setup.'
		},
		nodes: {
			title: 'Resilient: no single data centre',
			lead: 'Your Paperless anywhere depends on no particular machine: it can start on any of these confidential nodes. If one fails, you start on another and restore your backup. The list is live.',
			resilience: (n, o, c) => `${n} confidential ${n === 1 ? 'node' : 'nodes'} of ${o} ${o === 1 ? 'operator' : 'operators'}${c ? ` in ${c} ${c === 1 ? 'country' : 'countries'}` : ''}`,
			storageNote: 'The backups, in turn, lie with several independent storage providers, in the countries you choose.',
			dependsNote: 'What still depends on Le Space: balance and billing, the relay through which the app checks the VM’s attestation, and the delivery of the app.',
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
			count: (n, c) => `${n} approved ${n === 1 ? 'provider' : 'providers'} in ${c} ${c === 1 ? 'country' : 'countries'}`,
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
			fold: { secrets: (n) => `${n} secrets`, verify: (n) => `${n} places with links` },
			sampleTitle: 'What the evidence looks like in the app',
			sampleLead: 'While your VM runs, the app shows for every claim its value, how it knows it and where you can check it. Here with made-up values, since there are no real ones without a booked VM; only the runtime is the real one, it is the same for everyone. In the app, the links lead to your own messages on Aleph.',
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
				vm: { t: 'Your VM and its measurements', d: 'The INSTANCE message of your app address names the measurements the app put in. For a running VM the app shows instance, node, measurements and the result of the check under “Evidence of this VM”, with links to exactly your messages.', links: ['Aleph explorer'] },
				amd: { t: 'AMD SEV-SNP', d: 'How the report is built and which certificates it is checked against.', links: ['AMD SEV'] },
				image: { t: 'The image', d: 'The app shows the STORE hash in the setup. The workflow rootfs.yml builds it from rootfs/build-image.sh; every run’s summary names the hash and the source commit.', links: ['build-image.sh', 'rootfs.yml', 'Runs'] },
				data: { t: 'The data area', d: 'The app shows whether a running VM sealed its data area. If that fails, Paperless-ngx does not start.', links: ['paperless-data-disk'] },
				backups: { t: 'The backups', d: 'Data sets and pieces are public on Filecoin, their content encrypted. At a restore the VM checks every piece against its content address (piece CID).', links: ['Filfox'] },
				app: { t: 'This web app', d: 'It is served from IPFS. Which version the domain serves, its DNSLink record shows (dig TXT _dnslink.paperless.le-space.de); every release names its CID.', links: ['Releases'] },
				docs: { t: 'In detail', d: 'The description this page is written from.', links: ['Security model', 'Keys and recovery', 'Your own image', 'Workflow', 'Variants of confidential VMs compared'] }
			},
			repoNote: 'The source code is public on GitHub: github.com/Le-Space/paperless-anywhere.'
		},
		prices: {
			title: 'Prices',
			lead: 'Choose a monthly package: always on, around the clock, or the hours you need in a month.',
			perMonth: 'per month',
			vat: 'All prices include 19% VAT.',
			legal: { before: 'The ', terms: 'terms', between: ' apply (in German); they also hold the ', withdrawal: 'instruction on withdrawal', after: ' (§ 9).' },
			hours: (h) => (h >= 720 ? 'Always on, around the clock' : `${h} hours`),
			example: 'Example: two hours a week are about 8.7 hours a month and fit in the smallest package.',
			included: 'Included in every package: up to 8 GB of documents.',
			backup: (price) => `The encrypted backup in three copies is not included in the package: it costs ${price} a month on top. You book it with the package, as a further line of your monthly subscription.`,
			backupYear: (price) => `Or ${price} once for a year of keeping, with or without a package. Keeping is not opening: restoring needs compute time, that is a package or extra hours.`,
			backupNeed: 'You need it for your documents to come back after a stop: stopping erases the VM, and the next start restores everything from the backup.',
			backupTotal: (hours, plan, backup, total) => `${hours} with backup: ${plan} + ${backup} = ${total} a month.`,
			backupAfter: 'After the end of the paid period no new backups are made; the existing ones stay retrievable for at least 30 more days.',
		},
		faq: {
			title: 'Frequently asked questions',
			items: [
				{ q: 'Is Paperless anywhere part of the Paperless-ngx project?', a: DISCLAIMER.en },
				{ q: 'What is Paperless-ngx?', a: 'Paperless-ngx is the open source software that runs in your VM: it takes in documents, recognises their text and makes them searchable. Paperless anywhere starts it for you on demand in a confidential VM and backs it up afterwards.' },
				{ q: 'Does everyone get the same software?', a: 'Yes. The system is the same for everyone. Today one passphrase per image opens the disk; every VM of that image shares it, and Le Space knows it. That is why what your VM writes goes into a data area with a key only the VM has. In preparation: an attested builder seals the image for each person separately, with a passphrase from their vault. The documentation says how image and builder can then be checked.' },
				{ q: 'Do I need an account?', a: 'Not for the vault. A passkey on your device opens it; the 24 words are the way back in if the device is missing. Le Space can neither open nor recover the vault. When you buy a package, the payment service Stripe asks for an e-mail address, for the receipt and the subscription.' },
				{
					q: 'How safe is my own device in this?',
					a: 'Your documents are encrypted in the VM and in the backups, and the keys to them come into being only with you, when you open the vault. The limit is the browser on your device, as with every web app and every password manager in a browser: what lies open there can be read by a browser extension with access to the page, or by malware. It cannot get at the passkey itself, and without your approval by fingerprint or PIN the passkey opens nothing. A little care puts you on the safe side:',
					tips: [
						'Use a browser profile of its own, without extensions, for Paperless anywhere, and install the app there.',
						'Or take a private window, a phone or a tablet.',
						'Enter the 24 words only in the app at paperless.le-space.de and keep them on paper. The passkey works for this address only; a fake page can still ask for the words.',
						'Lock the vault when you are done, with the “Sperren” (lock) button; the app itself is in German.'
					],
					more: { text: 'The details are in the security model.', href: 'https://github.com/Le-Space/paperless-anywhere/blob/main/docs/security-model.md#your-own-device' }
				},
				{ q: 'What does it cost while Paperless anywhere is not running?', a: 'Only a running instance uses hours. Your monthly package runs on, though, and is billed every month until you cancel. The backup is not included in the package: it costs extra, monthly on top of the package or once for a year (see Prices). After the end of the paid period no new backups are made; the existing ones stay retrievable for at least 30 more days.' }
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
				own: 'The code of Paperless anywhere (web app and VM image) is under the GNU Affero General Public License, version 3 or later (AGPL-3.0-or-later). The source of the service running here is in the public repository.',
				ownLink: 'Source code and licence',
				third: 'The web app contains libraries and fonts by others; their names, versions, licences and licence texts are in a file of their own.',
				thirdLink: 'Licences of the libraries and fonts'
			},
			gpl: { title: 'Text of the GPL-3.0', show: 'Show the licence text (English, as published)' },
			back: 'Back to the start page'
		},
		cta: { title: 'Ready?', lead: 'Creating a vault takes a minute. No account, no password.' },
		footer: { by: 'A Le Space project', belege: 'Le Space Belege', imprint: 'Imprint', imprintUrl: 'https://le-space.de/#imprint', privacy: 'Privacy', privacyUrl: 'https://le-space.de/#privacy', built: 'Paperless anywhere computes on confidential nodes of Aleph Cloud and backs up to Filecoin.', ngxLink: 'Paperless-ngx on GitHub', terms: 'Terms', withdrawal: 'Withdrawal' }
	}
};
