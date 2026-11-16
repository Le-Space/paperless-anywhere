// The texts of the evidence view (Evidence.svelte) and of the start panel,
// in German and English with the same keys (evidence.spec.js checks that).
// The ids are those of evidence.js.

import { currentLang } from './i18n/index.js';

/** The app's language (i18n/index.js): the one chosen last, else German. @returns {'de' | 'en'} */
export const appLang = () => currentLang();

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
			relay: { t: 'Relay', d: 'Der Server, über den dein Browser die VM für die Prüfung erreicht hat.' },
			image: { t: 'Image', d: 'Die verschlüsselte Platte, von der die VM startet, benannt durch ihren STORE-Hash.' },
			data: { t: 'Datenbereich', d: 'Wohin die VM schreibt.' },
			backups: { t: 'Sicherungen', d: 'Die letzte Sicherung, die bei Speicheranbietern angekommen ist.' },
			stopPiece: { t: 'Letzte Sicherung', d: 'Das verschlüsselte Archiv dieses Stopps, benannt durch seine Piece-CID, wie die VM es gemeldet hat.' },
			stopSealed: { t: 'Verschlüsselung', d: 'Wie die VM die Sicherung verschlüsselt hat, bevor sie sie hochlud: mit age, für einen einzigen Empfänger, deinen öffentlichen Sicherungsschlüssel. Öffnen kann sie nur, wer den passenden geheimen Schlüssel hat; er bleibt in deinem Tresor.' },
			stopCopy: { t: 'Kopie', d: 'Eine Kopie bei einem Speicheranbieter in dessen Datensatz (Filecoin Warm Storage, PDP), wie die VM sie gemeldet hat.' },
			stopForget: { t: 'VM gelöscht', d: 'Die FORGET-Nachricht, von deiner App signiert und von Aleph angenommen: Die VM wird nicht weiter betrieben.' }
		},
		values: {
			name: 'Name', itemHash: 'Aleph-Nachricht', bundle: 'Paket (SHA-256)', cmdline: 'Startzeile', launch: 'berechnet', instanceHash: 'Nachricht', payer: 'bezahlt von',
			crnHash: 'Knoten', host: 'Adresse', reportMeasurement: 'Messwert im Bericht', relayHost: 'Relay', policy: 'Policy', tcb: 'Firmware-Stände', at: 'Zeitpunkt', store: 'STORE-Hash', copies: 'Kopien', piece: 'Stück (Piece-CID)',
			size: 'Größe (verschlüsselt)', part: 'weiterer Teil', provider: 'Anbieter', place: 'Standort', dataSet: 'Datensatz', pieceId: 'Stück im Datensatz', forget: 'FORGET-Nachricht',
			method: 'Verfahren', recipient: 'Empfänger (öffentlich)', keyFrom: 'Schlüssel', luks: 'Verschlüsselung der Platte'
		},
		says: {
			vault: 'aus deinem Tresor abgeleitet; der geheime Teil verlässt ihn nicht',
			profile: 'in deinem Tresor gespeichert (eingetragen, nicht abgeleitet); der geheime Teil verlässt ihn nicht',
			luks: 'LUKS2 · aes-xts-plain64 · 512-Bit-Schlüssel, wie im Build gesetzt; ohne die Passphrase'
		},
		copy: 'Kopieren',
		copied: 'Kopiert',
		notes: {
			none: 'Für diese VM sind keine Messwerte vermerkt.',
			notKept: 'Für diese VM ist kein Ergebnis vermerkt: Sie wurde vor dieser App-Version gestartet oder war beim Fortsetzen schon entsperrt. Mit „Jetzt erneut prüfen“ holst du einen frischen Bericht.',
			mismatch: 'Der vermerkte Messwert gehört nicht zu den berechneten. Bitte erneut prüfen.',
			relayLeSpace: 'Ein Relay von Le Space, nicht attestiert: ein gewöhnlicher Server bei Aleph. Die App nimmt ihn nur an, wenn Aleph ihn als laufende Instanz eines Le-Space-Kontos führt. Er leitet nur verschlüsselte Bytes weiter; lesen oder unbemerkt ändern kann er sie nicht, geprüft wird in deinem Browser. Er kann Verbindungen abbrechen und sieht Verbindungsdaten: deine IP-Adresse, welche VM auf welchem Knoten, wann und wie viel.',
			relayOwn: 'Ein Relay, den du selbst eingetragen hast, nicht attestiert; die App prüft nicht, wer ihn betreibt. Er leitet nur verschlüsselte Bytes weiter; lesen oder unbemerkt ändern kann er sie nicht, geprüft wird in deinem Browser. Er kann Verbindungen abbrechen und sieht Verbindungsdaten: deine IP-Adresse, welche VM auf welchem Knoten, wann und wie viel.',
			relayUnknown: 'Für diese VM ist nicht vermerkt, welcher Relay die Prüfung getragen hat. Ein Relay ist nie attestiert; er leitet nur verschlüsselte Bytes weiter, geprüft wird in deinem Browser.',
			notMeasured: 'Der Inhalt des Images wird nicht mitgemessen. Dass die VM das veröffentlichte Image startet, stützt sich darauf, dass sich die Platte nur mit der Image-Passphrase öffnet.',
			sealed: 'Die VM meldet: eigener Datenbereich, verschlüsselt mit einem Schlüssel dieses Starts, den nur sie hat.',
			plain: 'Die VM meldet: Sie schreibt auf die Image-Platte, ohne eigenen Schlüssel.',
			unknown: 'Die VM hat dazu nichts gemeldet.',
			off: 'Sicherungen sind nicht eingerichtet.',
			encrypted: 'In der VM mit age für deinen Schlüssel verschlüsselt; bei den Anbietern liegt nur Chiffrat.',
			noneYet: 'Noch keine Sicherung vermerkt.',
			headerOpens: 'Von der App geprüft: Der Kopf der Sicherung beim Anbieter öffnet sich mit deinem Sicherungsschlüssel, und sein MAC stimmt. Gelesen wurden nur die ersten Bytes, nicht der Inhalt.',
			headerRefused: 'Der Kopf der Sicherung beim Anbieter öffnet sich nicht mit deinem Sicherungsschlüssel. Bitte die Sicherung mit „Sicherung selbst holen“ prüfen.',
			headerUnchecked: 'So meldet es die VM. Die App konnte den Kopf der Sicherung beim Anbieter nicht lesen und hat ihn nicht selbst geprüft.'
		},
		links: { relayWs: 'Quelltext des Relays (WebSocket)', relayP2p: 'Quelltext des Relays (libp2p)', message: 'Aleph-Nachricht', amd: 'AMD SEV', how: 'Ablauf der Prüfung', build: 'build-image.sh', source: 'paperless-data-disk', model: 'Sicherheitsmodell', retrieval: 'Beim Anbieter abrufen (nur Chiffrat)', forgetMessage: 'FORGET-Nachricht', ageSpec: 'Spezifikation age v1', selfCheck: 'Selbst prüfen: mit dem Schlüssel und age entschlüsseln', encryptImage: 'encrypt-image.sh' },
		stopTitle: 'Nachweis: Sicherung und Löschen',
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
			relay: { t: 'Relay', d: 'The server through which your browser reached the VM for the check.' },
			image: { t: 'Image', d: 'The encrypted disk the VM boots from, named by its STORE hash.' },
			data: { t: 'Data area', d: 'Where the VM writes.' },
			backups: { t: 'Backups', d: 'The last backup that reached storage providers.' },
			stopPiece: { t: 'Last backup', d: 'The encrypted archive of this stop, named by its piece CID, as the VM reported it.' },
			stopSealed: { t: 'Encryption', d: 'How the VM encrypted the backup before uploading it: with age, to a single recipient, your public backup key. Only the holder of the matching secret key can open it; that key stays in your vault.' },
			stopCopy: { t: 'Copy', d: 'A copy with a storage provider, in its data set (Filecoin Warm Storage, PDP), as the VM reported it.' },
			stopForget: { t: 'VM deleted', d: 'The FORGET message, signed by your app and accepted by Aleph: the VM is not run any longer.' }
		},
		values: {
			name: 'Name', itemHash: 'Aleph message', bundle: 'Bundle (SHA-256)', cmdline: 'Boot line', launch: 'computed', instanceHash: 'Message', payer: 'paid by',
			crnHash: 'Node', host: 'Address', reportMeasurement: 'Measurement in the report', relayHost: 'Relay', policy: 'Policy', tcb: 'Firmware levels', at: 'Time', store: 'STORE hash', copies: 'Copies', piece: 'Piece (piece CID)',
			size: 'Size (encrypted)', part: 'further part', provider: 'Provider', place: 'Location', dataSet: 'Data set', pieceId: 'Piece in the data set', forget: 'FORGET message',
			method: 'Method', recipient: 'Recipient (public)', keyFrom: 'Key', luks: 'Disk encryption'
		},
		says: {
			vault: 'derived from your vault; its secret part never leaves it',
			profile: 'kept in your vault (entered, not derived); its secret part never leaves it',
			luks: 'LUKS2 · aes-xts-plain64 · 512-bit key, as set in the build; without the passphrase'
		},
		copy: 'Copy',
		copied: 'Copied',
		notes: {
			none: 'No measurements are recorded for this VM.',
			notKept: 'No result is recorded for this VM: it was started before this version of the app, or was already unlocked when the start was resumed. “Check again now” fetches a fresh report.',
			mismatch: 'The recorded measurement is not among those computed. Please check again.',
			relayLeSpace: 'One of Le Space’s relays, not attested: an ordinary server on Aleph. The app accepts it only if Aleph holds it as a running instance of a Le Space account. It forwards encrypted bytes only; it cannot read them or change them unnoticed, the checking happens in your browser. It can drop connections, and it sees connection data: your IP address, which VM on which node, when and how much.',
			relayOwn: 'A relay you entered yourself, not attested; the app does not check who runs it. It forwards encrypted bytes only; it cannot read them or change them unnoticed, the checking happens in your browser. It can drop connections, and it sees connection data: your IP address, which VM on which node, when and how much.',
			relayUnknown: 'It is not recorded for this VM which relay carried the check. A relay is never attested; it forwards encrypted bytes only, the checking happens in your browser.',
			notMeasured: 'The image’s content is not measured. That the VM boots the published image rests on its disk opening only with the image passphrase.',
			sealed: 'The VM reports: a data area of its own, encrypted with a key of this start that only it has.',
			plain: 'The VM reports: it writes to the image’s disk, without a key of its own.',
			unknown: 'The VM reported nothing about it.',
			off: 'Backups are not set up.',
			encrypted: 'Encrypted with age inside the VM, to your key; the providers hold ciphertext only.',
			noneYet: 'No backup recorded yet.',
			headerOpens: 'Checked by the app: the backup’s header at the provider opens with your backup key, and its MAC holds. Only the first bytes were read, not the content.',
			headerRefused: 'The backup’s header at the provider does not open with your backup key. Please check the backup with “Fetch a backup yourself”.',
			headerUnchecked: 'As the VM reports it. The app could not read the backup’s header at the provider and did not check it itself.'
		},
		links: { relayWs: 'The relay’s source (WebSocket)', relayP2p: 'The relay’s source (libp2p)', message: 'Aleph message', amd: 'AMD SEV', how: 'How the check works', build: 'build-image.sh', source: 'paperless-data-disk', model: 'Security model', retrieval: 'Fetch from the provider (ciphertext only)', forgetMessage: 'FORGET message', ageSpec: 'age v1 specification', selfCheck: 'Check it yourself: decrypt with the key and age', encryptImage: 'encrypt-image.sh' },
		stopTitle: 'Evidence: backup and deletion',
		again: 'Check again now',
		checking: 'Checking the VM (AMD) …',
		checked: 'Freshly checked.',
		failed: (reason) => `The check failed: ${reason}`
	}
};

/** Bytes as MB, in the language shown. @param {number} bytes @param {'de' | 'en'} lang */
const mb = (bytes, lang) => `${(bytes / 1e6).toLocaleString(lang, { maximumFractionDigits: 1 })} MB`;

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
		states: { off: 'offen', run: 'läuft', app: 'von der App geprüft', reported: 'gemeldet', skipped: 'in dieser Sitzung nicht geprüft', failed: 'fehlgeschlagen', later: 'später' },
		rowStates: { off: 'offen', run: 'läuft', done: 'fertig', skipped: 'nicht geprüft', failed: 'fehlgeschlagen' },
		live: (row, state) => `${row}: ${state}`,
		legend: 'Grün: von der App selbst geprüft. Blau: von der VM oder von Aleph gemeldet, nicht von der Hardware bestätigt.',
		after: 'Werte und Links stehen danach unter „Nachweis dieser VM“.',
		stop: {
			title: 'Sichern und beenden: was gerade geschieht und wohin die Sicherung geht',
			titleDiscard: 'Löschen ohne Sicherung: was gerade geschieht',
			rows: { request: 'Auftrag', export: 'Export', sealed: 'Archiv', upload: 'Hochladen', piece: 'Bestätigt', forget: 'Löschen', listed: 'Liste' },
			lights: {
				sent: 'Stopp-Auftrag von der App signiert an die VM geschickt',
				taken: 'VM hat den Auftrag angenommen',
				paused: 'Paperless pausiert, damit nichts mehr hinzukommt',
				exported: 'Datenbank und Dokumente exportiert',
				exportedFiles: (/** @type {number} */ n) => `Datenbank und Dokumente exportiert (${n} Dateien)`,
				sealed: 'Archiv gepackt und in der VM mit age (X25519, ChaCha20-Poly1305) für deinen Sicherungsschlüssel verschlüsselt',
				sealedSize: (/** @type {number} */ bytes) => `Archiv gepackt und mit age (X25519, ChaCha20-Poly1305) für deinen Sicherungsschlüssel verschlüsselt: ${mb(bytes, 'de')}`,
				sealedParts: (/** @type {number} */ bytes, /** @type {number} */ parts) => `Archiv gepackt und mit age (X25519, ChaCha20-Poly1305) für deinen Sicherungsschlüssel verschlüsselt: ${mb(bytes, 'de')} in ${parts} Teilen`,
				header: 'Kopf der Sicherung beim Anbieter öffnet sich mit deinem Schlüssel',
				headerRefused: 'Kopf der Sicherung beim Anbieter öffnet sich nicht mit deinem Schlüssel',
				headerUnreachable: 'Kopf der Sicherung beim Anbieter nicht erreichbar',
				copies: 'Kopien bei den Speicheranbietern',
				copyTo: (/** @type {number} */ id) => `Kopie bei Anbieter ${id}`,
				copyAt: (/** @type {number} */ id, /** @type {string} */ dataSet, /** @type {string} */ place) => `Kopie bei Anbieter ${id}${place ? ` (${place})` : ''}, Datensatz ${dataSet}`,
				pieceCid: 'Piece-CID des Archivs',
				pieceCidIs: (/** @type {string} */ cid) => `Piece-CID ${cid}`,
				confirmed: 'Anbieter bestätigen das Stück in ihrem Datensatz',
				confirmedOf: (/** @type {number} */ have, /** @type {number} */ want) => `${have} von ${want} Anbietern bestätigen das Stück in ihrem Datensatz`,
				node: 'Knoten hat die VM angehalten und gelöscht',
				nodeGone: 'Knoten führt die VM nicht mehr',
				nodeLater: 'Knoten hat nicht sofort geantwortet; das FORGET beendet die VM in einigen Minuten',
				forgot: 'FORGET von der App signiert und von Aleph angenommen',
				revoke: 'Sicherungsschlüssel der VM bei Le Space widerrufen',
				revokeLater: 'Sicherungsschlüssel noch nicht widerrufen; die App versucht es beim nächsten Öffnen erneut',
				listed: 'Sicherung in deiner Liste der Sicherungen vermerkt',
				nothingNew: 'keine neue Sicherung: nichts geändert seit der letzten, oder Sicherungen aus'
			},
			after: 'Anbieter, Datensätze, Piece-CID und die FORGET-Nachricht stehen danach unter „Nachweis: Sicherung und Löschen“.',
			afterDiscard: 'Die FORGET-Nachricht steht danach unter „Nachweis: Sicherung und Löschen“.'
		}
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
		states: { off: 'open', run: 'under way', app: 'checked by the app', reported: 'reported', skipped: 'not checked in this session', failed: 'failed', later: 'later' },
		rowStates: { off: 'open', run: 'under way', done: 'done', skipped: 'not checked', failed: 'failed' },
		live: (row, state) => `${row}: ${state}`,
		legend: 'Green: checked by the app itself. Blue: reported by the VM or by Aleph, not confirmed by the hardware.',
		after: 'Values and links are under “Evidence of this VM” afterwards.',
		stop: {
			title: 'Back up and stop: what is happening and where the backup goes',
			titleDiscard: 'Delete without backup: what is happening',
			rows: { request: 'Request', export: 'Export', sealed: 'Archive', upload: 'Upload', piece: 'Confirmed', forget: 'Deletion', listed: 'List' },
			lights: {
				sent: 'stop request signed by the app and sent to the VM',
				taken: 'VM took the request',
				paused: 'Paperless paused, so nothing more arrives',
				exported: 'database and documents exported',
				exportedFiles: (/** @type {number} */ n) => `database and documents exported (${n} files)`,
				sealed: 'archive packed and encrypted inside the VM with age (X25519, ChaCha20-Poly1305) to your backup key',
				sealedSize: (/** @type {number} */ bytes) => `archive packed and encrypted with age (X25519, ChaCha20-Poly1305) to your backup key: ${mb(bytes, 'en')}`,
				sealedParts: (/** @type {number} */ bytes, /** @type {number} */ parts) => `archive packed and encrypted with age (X25519, ChaCha20-Poly1305) to your backup key: ${mb(bytes, 'en')} in ${parts} parts`,
				header: 'the backup’s header at the provider opens with your key',
				headerRefused: 'the backup’s header at the provider does not open with your key',
				headerUnreachable: 'the backup’s header at the provider could not be reached',
				copies: 'copies with the storage providers',
				copyTo: (/** @type {number} */ id) => `copy with provider ${id}`,
				copyAt: (/** @type {number} */ id, /** @type {string} */ dataSet, /** @type {string} */ place) => `copy with provider ${id}${place ? ` (${place})` : ''}, data set ${dataSet}`,
				pieceCid: 'piece CID of the archive',
				pieceCidIs: (/** @type {string} */ cid) => `piece CID ${cid}`,
				confirmed: 'providers confirm the piece in their data set',
				confirmedOf: (/** @type {number} */ have, /** @type {number} */ want) => `${have} of ${want} providers confirm the piece in their data set`,
				node: 'node stopped and erased the VM',
				nodeGone: 'node no longer runs the VM',
				nodeLater: 'node did not answer at once; the FORGET ends the VM within minutes',
				forgot: 'FORGET signed by the app and accepted by Aleph',
				revoke: 'the VM’s backup key revoked at Le Space',
				revokeLater: 'backup key not revoked yet; the app tries again when opened next',
				listed: 'backup recorded in your list of backups',
				nothingNew: 'no new backup: nothing changed since the last one, or backups are off'
			},
			after: 'Providers, data sets, the piece CID and the FORGET message are under “Evidence: backup and deletion” afterwards.',
			afterDiscard: 'The FORGET message is under “Evidence: backup and deletion” afterwards.'
		}
	}
};
