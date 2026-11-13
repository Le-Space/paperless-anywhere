// "Mein Image bauen" (own-image.js and its block in the setup): what the
// step says, what it shows of the builder, and what it reports when
// something fails. German is the original; English beside it, key for key.
const mib = (/** @type {number} */ bytes) => Math.round(bytes / 1048576);
const because = (/** @type {string | undefined} */ reason) => (reason ? `: ${reason}` : '');

export const ownImage = {
	de: {
		intro: {
			before: 'Oder ein Image nur für diesen Tresor: Ein geprüfter Build-Dienst versiegelt das öffentliche Image mit einer Passphrase, die aus deinem Tresor abgeleitet wird. Die App prüft den Hardware-Nachweis des Dienstes, bevor sie die Passphrase schickt, holt das versiegelte Image in Stücken über ebenso geprüfte Verbindungen zurück und lädt es selbst zu Aleph hoch (knapp 900 MiB; das dauert und braucht eine stabile Verbindung). Das Image liegt danach bei Aleph auf der Adresse dieser App (',
			after: '), die auch den Speicher bezahlt.'
		},
		sourcesFold: 'Woraus und womit wird gebaut?',
		sourcesHint: 'Diese Werte sind in der App festgelegt und für alle gleich. Das öffentliche Image kann jeder laden und den Hash vergleichen; den Messwert bestätigt die Hardware, bevor die App die Passphrase schickt.',
		sources: {
			plainSha256: 'Öffentliches Image, SHA-256',
			plainStore: 'Öffentliches Image bei Aleph',
			commit: 'Gebaut aus dem Quelltext-Stand',
			vprogram: 'Build-Dienst bei Aleph',
			measurement: 'Messwert des Build-Dienstes'
		},
		have: (/** @type {string} */ date) => `Du nutzt dein eigenes Image, gebaut am ${date}.`,
		build: 'Mein Image bauen',
		rebuild: 'Mein Image neu bauen',
		whileRunning: 'Erst wieder möglich, wenn Paperless gestoppt ist.',
		step: {
			attest: 'Build-Dienst prüfen (AMD)',
			build: 'Image wird versiegelt',
			fetch: (/** @type {number} */ percent) => `Versiegeltes Image holen (${percent} %)`,
			sign: 'Speicher-Nachricht signieren',
			upload: (/** @type {number} */ bytes) => `Image zu Aleph hochladen (${mib(bytes)} MiB)`,
			confirm: 'Auf Aleph warten'
		},
		checkStore: 'Image bei Aleph prüfen',
		error: {
			noBuilder: 'Der Build-Dienst ist in dieser App nicht festgelegt.',
			noPlain: 'Das öffentliche Image ist in dieser App nicht festgelegt.',
			badCid: 'Der Build-Dienst hat keine gültige Adresse für das Image genannt.',
			badSize: 'Der Build-Dienst nennt keine gültige Größe für das Image.',
			busy: 'Der Build-Dienst baut gerade ein anderes Image. Bitte in ein paar Minuten noch einmal versuchen.',
			notAccepted: (/** @type {number} */ status, /** @type {string} */ reason) => `Der Build-Dienst hat den Auftrag nicht angenommen (${status}${because(reason)}).`,
			jobUnknown: (/** @type {number} */ status, /** @type {string} */ reason) => `Der Build-Dienst kennt den Auftrag nicht mehr (${status}${because(reason)}).`,
			buildFailed: (/** @type {string} */ reason) => `Der Bau ist fehlgeschlagen${because(reason)}.`,
			buildSlow: 'Der Bau hat zu lange gedauert.',
			dropped: 'Die Verbindung zum Build-Dienst ist abgebrochen. Bitte später noch einmal versuchen.',
			imageGone: (/** @type {number} */ status) => `Der Build-Dienst hat das Image nicht mehr (${status}). Bitte noch einmal bauen.`,
			pieceMissing: (/** @type {string} */ reason) => `Der Build-Dienst hat ein Stück des Images nicht geliefert (${reason}).`,
			uploadRefused: (/** @type {number} */ status) => `Aleph hat das Image nicht angenommen (${status}). Reicht das Guthaben der App-Adresse für den Speicher? Das versiegelte Image bleibt in diesem Fenster erhalten; ein zweiter Versuch lädt es nur noch einmal hoch.`,
			otherImage: 'Aleph hat ein anderes Image gespeichert als das versiegelte.',
			storeRejected: 'Aleph hat das Image nicht angenommen. Reicht das Guthaben der App-Adresse für den Speicher?',
			storePending: 'Aleph hat das Image noch nicht bestätigt. Es ist hochgeladen; bitte später erneut bauen oder den Hash prüfen.',
			noRelay: 'Es ist kein Relay bekannt, der den Build-Dienst erreicht.',
			unreachable: (/** @type {string} */ reason) => `Der Build-Dienst ist gerade nicht erreichbar. Bitte später noch einmal versuchen. (${reason})`
		}
	},
	en: {
		intro: {
			before: 'Or an image for this vault only: a verified build service seals the public image with a passphrase derived from your vault. The app checks the service\'s hardware attestation before it sends the passphrase, fetches the sealed image back in pieces over connections verified the same way, and uploads it to Aleph itself (just under 900 MiB; this takes a while and needs a stable connection). The image then lies on Aleph under this app\'s address (',
			after: '), which also pays for the storage.'
		},
		sourcesFold: 'What is it built from, and by what?',
		sourcesHint: 'These values are fixed in the app and the same for everyone. Anyone can download the public image and compare the hash; the hardware confirms the measurement before the app sends the passphrase.',
		sources: {
			plainSha256: 'Public image, SHA-256',
			plainStore: 'Public image on Aleph',
			commit: 'Built from this state of the source',
			vprogram: 'Build service on Aleph',
			measurement: 'Measurement of the build service'
		},
		have: (/** @type {string} */ date) => `You are using your own image, built on ${date}.`,
		build: 'Build my image',
		rebuild: 'Build my image again',
		whileRunning: 'Possible again once Paperless is stopped.',
		step: {
			attest: 'Checking the build service (AMD)',
			build: 'Sealing the image',
			fetch: (/** @type {number} */ percent) => `Fetching the sealed image (${percent} %)`,
			sign: 'Signing the storage message',
			upload: (/** @type {number} */ bytes) => `Uploading the image to Aleph (${mib(bytes)} MiB)`,
			confirm: 'Waiting for Aleph'
		},
		checkStore: 'Check the image on Aleph',
		error: {
			noBuilder: 'No build service is fixed in this app.',
			noPlain: 'No public image is fixed in this app.',
			badCid: 'The build service named no valid address for the image.',
			badSize: 'The build service names no valid size for the image.',
			busy: 'The build service is building another image right now. Please try again in a few minutes.',
			notAccepted: (/** @type {number} */ status, /** @type {string} */ reason) => `The build service did not accept the job (${status}${because(reason)}).`,
			jobUnknown: (/** @type {number} */ status, /** @type {string} */ reason) => `The build service no longer knows the job (${status}${because(reason)}).`,
			buildFailed: (/** @type {string} */ reason) => `The build failed${because(reason)}.`,
			buildSlow: 'The build took too long.',
			dropped: 'The connection to the build service broke off. Please try again later.',
			imageGone: (/** @type {number} */ status) => `The build service no longer has the image (${status}). Please build again.`,
			pieceMissing: (/** @type {string} */ reason) => `The build service did not deliver a piece of the image (${reason}).`,
			uploadRefused: (/** @type {number} */ status) => `Aleph did not take the image (${status}). Does the app address hold enough credit for the storage? The sealed image stays in this window; a second try only uploads it again.`,
			otherImage: 'Aleph stored another image than the sealed one.',
			storeRejected: 'Aleph did not take the image. Does the app address hold enough credit for the storage?',
			storePending: 'Aleph has not confirmed the image yet. It is uploaded; please build again later or check the hash.',
			noRelay: 'No relay is known that reaches the build service.',
			unreachable: (/** @type {string} */ reason) => `The build service cannot be reached right now. Please try again later. (${reason})`
		}
	}
};
