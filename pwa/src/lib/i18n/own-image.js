// "Mein Image bauen" (own-image.js and its block in the setup): what the
// step says, what it shows of the builder, and what it reports when
// something fails. German is the original; English beside it, key for key.
const mib = (/** @type {number} */ bytes) => Math.round(bytes / 1048576);
const because = (/** @type {string | undefined} */ reason) => (reason ? `: ${reason}` : '');

export const ownImage = {
	de: {
		intro: {
			before: 'Ein Image nur für diesen Tresor: Ein geprüfter Build-Dienst versiegelt das öffentliche Image mit einer Passphrase, die aus deinem Tresor abgeleitet wird. Die App prüft den Hardware-Nachweis des Dienstes, bevor sie die Passphrase schickt, holt das versiegelte Image in Stücken über ebenso geprüfte Verbindungen zurück und lädt es selbst zu Aleph hoch (knapp 900 MiB; das dauert und braucht eine stabile Verbindung). Das Image liegt danach bei Aleph auf der Adresse dieser App (',
			after: '), die auch den Speicher bezahlt. Mit einem Le-Space-Paket liegt es stattdessen auf deinem Aleph-Konto bei Le Space: Jeder Bau wird von deinem Le-Space-Guthaben abgebucht, den Preis siehst du vorher (mit einem Gutschein ist er enthalten, bis ein Bau gelingt, bis zu 3 Versuche); der Speicher des Images ist im Paket enthalten.'
		},
		overview: {
			buildsAtStart: 'Eigenes Image: wird beim ersten Start gebaut (etwa 15 Minuten).',
			built: (/** @type {string} */ date) => `Eigenes Image, gebaut am ${date}.`,
			newer: 'Eine neuere Image-Version ist da.',
			rebuild: 'Jetzt neu bauen',
			rebuildStopped: 'Neu bauen geht, wenn Paperless gestoppt ist.',
			publicImage: 'Öffentliches Image von Le Space.'
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
		whileRunning: 'Erst möglich, wenn Paperless gestoppt ist. Der Umzug einer laufenden Paperless: „Sichern und beenden“, hier bauen, neu starten; der Start stellt die neueste Sicherung wieder her. Scheitert das, legt die neue VM keine Sicherung an: Lösche sie ohne Sicherung, die letzte Sicherung bleibt die neueste.',
		choice: {
			legend: 'Welches Image?',
			public: 'Das öffentliche Image von Le Space',
			publicHint: 'Eine Passphrase je Image-Version: Le Space kennt sie, und alle, die diese Version nutzen.',
			own: 'Mein eigenes Image',
			ownHint: 'Eine Passphrase nur für diesen Tresor: Niemand sonst kennt sie, auch Le Space nicht.',
			notBuilt: 'Noch nicht gebaut: Bis dahin startet die VM vom öffentlichen Image.',
			toTopUp: 'Zum Guthaben',
			creditsUnreachable: 'Der Preis für den Bau ließ sich beim Credits-Dienst gerade nicht abfragen. Bitte später noch einmal versuchen.',
			builtAtStart: 'Wird beim ersten Start gebaut (etwa 15 Minuten, das Fenster so lange offen lassen). Du kannst es auch jetzt schon bauen.',
			checking: 'Guthaben der App-Adresse wird geprüft …',
			price: (/** @type {string} */ price) => `Ein Bau kostet ${price} aus deinem Le-Space-Guthaben (Laufzeit des Build-Dienstes); die Ablage des Images ist enthalten.`,
			confirmPrice: (/** @type {string} */ price) => `Eigenes Image bauen? ${price} werden von deinem Le-Space-Guthaben abgebucht. Nimmt Aleph den Build-Dienst gar nicht an, kommt der Betrag zurück; scheitert der Bau danach, bleibt er abgebucht.`,
			included: 'Dieser Bau ist im Gutschein enthalten; der Speicher des Images auch.',
			confirmIncluded: 'Eigenes Image bauen? Dieser Bau ist im Gutschein enthalten, es wird nichts abgebucht.',
			serviceOld: 'Der Credits-Dienst erlaubt der App das noch nicht (V-PROGRAM und STORE). Bitte später noch einmal versuchen.',
			needsCredits: (/** @type {string} */ need, /** @type {string} */ have) => `Ein eigenes Image braucht derzeit Aleph-Guthaben auf der Adresse dieser App: Aleph startet den Build-Dienst nur, wenn es für einen Tag seiner Laufzeit, den Speicher des Images und alles, was die Adresse schon bezahlt, reicht (etwa ${need} Credits; vorhanden: ${have}). Mit einem Le-Space-Paket nutzt du vorerst das öffentliche Image.`
		},
		step: {
			start: 'Build-Dienst starten (einige Minuten)',
			attest: 'Build-Dienst prüfen (AMD)',
			build: 'Image wird versiegelt',
			fetch: (/** @type {number} */ percent) => `Versiegeltes Image holen (${percent} %)`,
			sign: 'Speicher-Nachricht signieren',
			upload: (/** @type {number} */ bytes) => `Image zu Aleph hochladen (${mib(bytes)} MiB)`,
			confirm: 'Auf Aleph warten'
		},
		checkStore: 'Image bei Aleph prüfen',
		fields: {
			node: 'Der Knoten ist ein 64-stelliger Hash.',
			image: 'Das Image ist ein 64-stelliger Hash.',
			otherPassphrase: 'Ein anderes Image hat eine eigene Passphrase. Bitte die Passphrase dieses Images mit eingeben.'
		},
		error: {
			noBuilder: 'Der Build-Dienst ist in dieser App nicht festgelegt.',
			builderRefused: (/** @type {number} */ status) => `Aleph hat den Build-Dienst nicht angenommen (${status}). Reicht das Guthaben der App-Adresse?`,
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
			before: 'An image for this vault only: a verified build service seals the public image with a passphrase derived from your vault. The app checks the service\'s hardware attestation before it sends the passphrase, fetches the sealed image back in pieces over connections verified the same way, and uploads it to Aleph itself (just under 900 MiB; this takes a while and needs a stable connection). The image then lies on Aleph under this app\'s address (',
			after: '), which also pays for the storage. With a Le Space package it lies on your Aleph account at Le Space instead: each build is charged to your Le Space balance, and you see the price first (with a voucher it is included until a build succeeds, up to 3 tries); storing the image is included in your package.'
		},
		overview: {
			buildsAtStart: 'Image of your own: built at the first start (about 15 minutes).',
			built: (/** @type {string} */ date) => `Image of your own, built on ${date}.`,
			newer: 'A newer image version is available.',
			rebuild: 'Build it again now',
			rebuildStopped: 'Building again works once Paperless is stopped.',
			publicImage: 'Public image from Le Space.'
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
		whileRunning: 'Possible once Paperless is stopped. To move a running Paperless: “Back up and stop”, build here, start again; the start restores the newest backup. If that fails, the new VM makes no backup: delete it without a backup, and the last backup stays the newest.',
		choice: {
			legend: 'Which image?',
			public: 'The public image from Le Space',
			publicHint: 'One passphrase per image version: Le Space knows it, and everyone using that version.',
			own: 'My own image',
			ownHint: 'A passphrase for this vault only: nobody else knows it, Le Space neither.',
			notBuilt: 'Not built yet: until then the VM starts from the public image.',
			toTopUp: 'To the balance',
			creditsUnreachable: 'The price of a build could not be asked from the credits service just now. Please try again later.',
			builtAtStart: 'Built at the first start (about 15 minutes; keep the window open meanwhile). You can also build it now.',
			checking: 'Checking the app address\'s credits …',
			price: (/** @type {string} */ price) => `A build costs ${price} from your Le Space balance (the build service's runtime); storing the image is included.`,
			confirmPrice: (/** @type {string} */ price) => `Build an image of your own? ${price} will be taken from your Le Space balance. If Aleph does not accept the build service at all, the amount comes back; if the build fails after that, it stays charged.`,
			included: 'This build is included in your voucher; so is storing the image.',
			confirmIncluded: 'Build an image of your own? This build is included in your voucher; nothing is charged.',
			serviceOld: 'The credits service does not allow the app this yet (V-PROGRAM and STORE). Please try again later.',
			needsCredits: (/** @type {string} */ need, /** @type {string} */ have) => `An image of your own needs Aleph credits on this app\'s address for now: Aleph starts the build service only when they cover a day of its runtime, the image\'s storage and everything the address already pays for (about ${need} credits; there are ${have}). With a Le Space package, use the public image for now.`
		},
		step: {
			start: 'Starting the build service (a few minutes)',
			attest: 'Checking the build service (AMD)',
			build: 'Sealing the image',
			fetch: (/** @type {number} */ percent) => `Fetching the sealed image (${percent} %)`,
			sign: 'Signing the storage message',
			upload: (/** @type {number} */ bytes) => `Uploading the image to Aleph (${mib(bytes)} MiB)`,
			confirm: 'Waiting for Aleph'
		},
		checkStore: 'Check the image on Aleph',
		fields: {
			node: 'The node is a 64-character hash.',
			image: 'The image is a 64-character hash.',
			otherPassphrase: 'Another image has a passphrase of its own. Please enter that image\'s passphrase with it.'
		},
		error: {
			noBuilder: 'No build service is fixed in this app.',
			builderRefused: (/** @type {number} */ status) => `Aleph did not accept the build service (${status}). Does the app address have enough credits?`,
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
