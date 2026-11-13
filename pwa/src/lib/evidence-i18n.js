// The texts of the evidence view (Evidence.svelte) and of the start panel,
// in German and English with the same keys (evidence.spec.js checks that).
// The ids are those of evidence.js.

/** The language chosen on the landing page, else German. @returns {'de' | 'en'} */
export function appLang() {
	try {
		return localStorage.getItem('paperless-lang') === 'en' ? 'en' : 'de';
	} catch {
		return 'de';
	}
}

export const evidenceTexts = {
	de: {
		title: 'Nachweis dieser VM',
		summary: (app, reported, open) => `${app} von der App geprüft · ${reported} gemeldet · ${open} nicht bestätigt`,
		sample: 'Beispiel, keine echte VM',
		marks: { app: 'von der App geprüft', reported: 'gemeldet, nicht von der Hardware bestätigt', open: 'nicht bestätigt' },
		rows: {
			runtime: { t: 'Laufzeit', d: 'Firmware, Kernel und Initrd. Fest in der App eingetragen; liefert Aleph etwas anderes, startet die App nichts.' },
			measurement: { t: 'Messwert', d: 'Von der App aus der Laufzeit und einer Startzeile berechnet, die deinen App-Schlüssel als Besitzer nennt, und in die INSTANCE-Nachricht geschrieben.' },
			instance: { t: 'Instanz', d: 'Die INSTANCE-Nachricht bei Aleph, von deiner App signiert.' },
			node: { t: 'Knoten', d: 'Der Aleph-Knoten, auf dem die VM läuft, und ihre Adresse.' },
			attestation: { t: 'Attestierung', d: 'Der Bericht des AMD-Prozessors, in deinem Browser geprüft: von AMD signiert, sein Messwert einer der berechneten, mit frischem Zufallswert an den TLS-Schlüssel der VM gebunden.' },
			image: { t: 'Image', d: 'Die verschlüsselte Platte, von der die VM startet, benannt durch ihren STORE-Hash.' },
			data: { t: 'Datenbereich', d: 'Wohin die VM schreibt.' },
			backups: { t: 'Sicherungen', d: 'Die letzte Sicherung, die bei Speicheranbietern angekommen ist.' }
		},
		values: {
			name: 'Name', itemHash: 'Aleph-Nachricht', bundle: 'Paket (SHA-256)', cmdline: 'Startzeile', launch: 'berechnet', instanceHash: 'Nachricht', payer: 'bezahlt von',
			crnHash: 'Knoten', host: 'Adresse', reportMeasurement: 'Messwert im Bericht', policy: 'Policy', tcb: 'Firmware-Stände', at: 'Zeitpunkt', store: 'STORE-Hash', copies: 'Kopien', piece: 'Stück (Piece-CID)'
		},
		notes: {
			none: 'Für diese VM sind keine Messwerte vermerkt.',
			notKept: 'Für diese VM ist kein Ergebnis vermerkt: Sie wurde vor dieser App-Version gestartet oder war beim Fortsetzen schon entsperrt. Mit „Jetzt erneut prüfen“ holst du einen frischen Bericht.',
			mismatch: 'Der vermerkte Messwert gehört nicht zu den berechneten. Bitte erneut prüfen.',
			notMeasured: 'Der Inhalt des Images wird nicht mitgemessen. Dass die VM das veröffentlichte Image startet, stützt sich darauf, dass sich die Platte nur mit der Image-Passphrase öffnet.',
			sealed: 'Die VM meldet: eigener Datenbereich, verschlüsselt mit einem Schlüssel dieses Starts, den nur sie hat.',
			plain: 'Die VM meldet: Sie schreibt auf die Image-Platte, ohne eigenen Schlüssel.',
			unknown: 'Die VM hat dazu nichts gemeldet.',
			off: 'Sicherungen sind nicht eingerichtet.',
			encrypted: 'In der VM mit age für deinen Schlüssel verschlüsselt; bei den Anbietern liegt nur Chiffrat.',
			noneYet: 'Noch keine Sicherung vermerkt.'
		},
		links: { message: 'Aleph-Nachricht', amd: 'AMD SEV', how: 'Ablauf der Prüfung', build: 'build-image.sh', source: 'paperless-data-disk', model: 'Sicherheitsmodell' },
		again: 'Jetzt erneut prüfen',
		checking: 'Prüfe die VM (AMD) …',
		checked: 'Frisch geprüft.',
		failed: (reason) => `Die Prüfung ist fehlgeschlagen: ${reason}`
	},
	en: {
		title: 'Evidence of this VM',
		summary: (app, reported, open) => `${app} checked by the app · ${reported} reported · ${open} not confirmed`,
		sample: 'Sample, not a real VM',
		marks: { app: 'checked by the app', reported: 'reported, not confirmed by the hardware', open: 'not confirmed' },
		rows: {
			runtime: { t: 'Runtime', d: 'Firmware, kernel and initrd. Fixed in the app; if Aleph delivers anything else, the app starts nothing.' },
			measurement: { t: 'Measurement', d: 'Computed by the app from the runtime and a boot line naming your app key as the owner, and written into the INSTANCE message.' },
			instance: { t: 'Instance', d: 'The INSTANCE message on Aleph, signed by your app.' },
			node: { t: 'Node', d: 'The Aleph node the VM runs on, and its address.' },
			attestation: { t: 'Attestation', d: 'The AMD processor’s report, checked in your browser: signed by AMD, its measurement one of those computed, bound by a fresh random value to the VM’s TLS key.' },
			image: { t: 'Image', d: 'The encrypted disk the VM boots from, named by its STORE hash.' },
			data: { t: 'Data area', d: 'Where the VM writes.' },
			backups: { t: 'Backups', d: 'The last backup that reached storage providers.' }
		},
		values: {
			name: 'Name', itemHash: 'Aleph message', bundle: 'Bundle (SHA-256)', cmdline: 'Boot line', launch: 'computed', instanceHash: 'Message', payer: 'paid by',
			crnHash: 'Node', host: 'Address', reportMeasurement: 'Measurement in the report', policy: 'Policy', tcb: 'Firmware levels', at: 'Time', store: 'STORE hash', copies: 'Copies', piece: 'Piece (piece CID)'
		},
		notes: {
			none: 'No measurements are recorded for this VM.',
			notKept: 'No result is recorded for this VM: it was started before this version of the app, or was already unlocked when the start was resumed. “Check again now” fetches a fresh report.',
			mismatch: 'The recorded measurement is not among those computed. Please check again.',
			notMeasured: 'The image’s content is not measured. That the VM boots the published image rests on its disk opening only with the image passphrase.',
			sealed: 'The VM reports: a data area of its own, encrypted with a key of this start that only it has.',
			plain: 'The VM reports: it writes to the image’s disk, without a key of its own.',
			unknown: 'The VM reported nothing about it.',
			off: 'Backups are not set up.',
			encrypted: 'Encrypted with age inside the VM, to your key; the providers hold ciphertext only.',
			noneYet: 'No backup recorded yet.'
		},
		links: { message: 'Aleph message', amd: 'AMD SEV', how: 'How the check works', build: 'build-image.sh', source: 'paperless-data-disk', model: 'Security model' },
		again: 'Check again now',
		checking: 'Checking the VM (AMD) …',
		checked: 'Freshly checked.',
		failed: (reason) => `The check failed: ${reason}`
	}
};

export const panelTexts = {
	de: {
		title: 'Start der VM: was gerade geschieht und was geprüft ist',
		rows: { measure: 'Messwerte', instance: 'Instanz', network: 'Netz', attestation: 'Attestierung', unlock: 'Entsperren', restore: 'Wiederherstellen', ready: 'Bereit' },
		lights: {
			runtime: 'Laufzeit von Aleph ist die in der App eingetragene',
			measurement: 'Messwert berechnet, mit deinem App-Schlüssel als Besitzer',
			signed: 'INSTANCE-Nachricht signiert und von Aleph angenommen',
			notified: 'Knoten benachrichtigt',
			port: 'Port 443 zugeordnet',
			address: 'Adresse der VM bekannt',
			report: 'Bericht von AMD signiert, Messwert und Policy wie berechnet',
			binding: 'frischer Zufallswert und TLS-Schlüssel der VM im Bericht',
			handed: 'Passphrase und Geheimnisse signiert übergeben',
			stored: 'VM nennt, was sie angenommen hat',
			restored: 'Sicherung eingespielt',
			dataDisk: 'eigener Datenbereich versiegelt',
			containers: 'Container laufen',
			cert: 'Zertifikat ausgestellt',
			paperless: 'Paperless-ngx antwortet'
		},
		states: { off: 'offen', run: 'läuft', app: 'von der App geprüft', reported: 'gemeldet', skipped: 'in dieser Sitzung nicht geprüft', failed: 'fehlgeschlagen' },
		rowStates: { off: 'offen', run: 'läuft', done: 'fertig', skipped: 'nicht geprüft', failed: 'fehlgeschlagen' },
		live: (row, state) => `${row}: ${state}`,
		legend: 'Grün: von der App selbst geprüft. Blau: von der VM oder von Aleph gemeldet, nicht von der Hardware bestätigt.',
		after: 'Werte und Links stehen danach unter „Nachweis dieser VM“.'
	},
	en: {
		title: 'Start of the VM: what is happening and what has been checked',
		rows: { measure: 'Measurements', instance: 'Instance', network: 'Network', attestation: 'Attestation', unlock: 'Unlock', restore: 'Restore', ready: 'Ready' },
		lights: {
			runtime: 'runtime from Aleph is the one fixed in the app',
			measurement: 'measurement computed, with your app key as the owner',
			signed: 'INSTANCE message signed and accepted by Aleph',
			notified: 'node notified',
			port: 'port 443 mapped',
			address: 'address of the VM known',
			report: 'report signed by AMD, measurement and policy as computed',
			binding: 'fresh random value and the VM’s TLS key in the report',
			handed: 'passphrase and secrets handed over, signed',
			stored: 'VM names what it accepted',
			restored: 'backup restored',
			dataDisk: 'data area of its own sealed',
			containers: 'containers running',
			cert: 'certificate issued',
			paperless: 'Paperless-ngx answers'
		},
		states: { off: 'open', run: 'under way', app: 'checked by the app', reported: 'reported', skipped: 'not checked in this session', failed: 'failed' },
		rowStates: { off: 'open', run: 'under way', done: 'done', skipped: 'not checked', failed: 'failed' },
		live: (row, state) => `${row}: ${state}`,
		legend: 'Green: checked by the app itself. Blue: reported by the VM or by Aleph, not confirmed by the hardware.',
		after: 'Values and links are under “Evidence of this VM” afterwards.'
	}
};
