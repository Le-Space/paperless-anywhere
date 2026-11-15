// The first start with an image of one's own (FirstStart.svelte) and the
// certificate of that image. Said warmly: this is the moment the promise
// "only you know the passphrase" becomes real. German is the original;
// English beside it, key for key.
const min = (/** @type {number} */ s) => Math.max(1, Math.round(s / 60));

export const first = {
	de: {
		kicker: 'Dein erster Start · ca. 25 Minuten insgesamt',
		title: 'Dein eigenes Image entsteht',
		minimize: 'Verkleinern',
		expand: 'Ansehen',
		step: (/** @type {number} */ n, /** @type {number} */ of) => `Schritt ${n} von ${of}`,
		rebuildKicker: 'Neue Image-Version · ca. 15 Minuten',
		rebuildTitle: 'Dein neues Image entsteht',
		rebuildDoneTitle: 'Geschafft – dein neues Image ist fertig!',
		rebuildDoneText: 'Wieder versiegelt mit deiner eigenen Passphrase, die nur dein Tresor kennt. Beim nächsten Start läuft deine Paperless auf der neuen Version.',
		stations: {
			wake: { label: 'Build-Dienst', duration: 'ca. 4 Min.', title: 'Dein persönlicher Build-Dienst wacht auf', text: 'Eine vertrauliche Maschine startet nur für dich. Das dauert ein paar Minuten – genau richtig für einen Kaffee.', mini: 'Dein Build-Dienst wacht auf' },
			check: { label: 'Echtheit', duration: 'wenige Sekunden', title: 'Echtheit bestätigt!', text: 'Der AMD-Prozessor bestätigt: Hier läuft genau der veröffentlichte Code. Erst jetzt geht deine Passphrase auf die Reise.', mini: 'Echtheit wird bestätigt' },
			seal: { label: 'Siegel', duration: 'ca. 2 Min.', title: 'Dein Image wird versiegelt', text: 'Mit einer Passphrase, die nur dein Tresor kennt. Nicht Le Space, nicht der Knoten – nur du.', mini: 'Dein Image wird versiegelt' },
			fetch: { label: 'Abholen', duration: 'ca. 9 Min.', title: 'Dein Image kommt zu dir', text: 'Stück für Stück, über geprüfte Verbindungen. Jedes Stück landet sicher bei dir.', mini: 'Dein Image kommt zu dir' },
			store: { label: 'Abgelegt', duration: 'ca. 1 Min.', title: 'Sicher abgelegt', text: 'Dein versiegeltes Image kommt jetzt zu Aleph – bereit für jeden deiner Starts.', mini: 'Dein Image wird abgelegt' },
			paperless: { label: 'Paperless', duration: 'ca. 10 Min.', title: 'Deine Paperless erwacht', text: 'Deine VM startet, die Hardware wird geprüft, deine Daten werden entsperrt – gleich ist alles bereit.', mini: 'Deine Paperless erwacht' }
		},
		measured: 'Hardware-Prüfung bestanden',
		fetched: (/** @type {number} */ pct) => `${pct} % abgeholt`,
		share: (/** @type {number} */ pct) => `${pct} % geschafft`,
		left: (/** @type {number} */ s) => `noch ca. ${min(s)} Min.`,
		endsAt: (/** @type {string} */ time) => `fertig gegen ${time}`,
		keepOpen: 'Dein Bildschirm bleibt an. Lass dieses Fenster einfach offen – du kannst es verkleinern und nebenher weitermachen.',
		tab: (/** @type {number} */ pct) => `${pct} % · Dein Image entsteht`,
		leave: 'Dein Image entsteht gerade. Wenn du die Seite jetzt verlässt, bricht der Bau ab.',
		doneTitle: 'Geschafft – deine Paperless läuft!',
		doneText: 'Versiegelt mit deiner ganz eigenen Passphrase. Die kennt nur dein Tresor – nicht Le Space, nicht der Knoten, niemand sonst. Ab jetzt startest du in rund 10 Minuten.',
		open: 'Paperless öffnen',
		showCertificate: 'Deine Urkunde ansehen',
		close: 'Schließen',
		pausedTitle: 'Kurz innegehalten',
		pausedText: 'Dein Start ist an dieser Stelle stehen geblieben. Den Grund siehst du in der Karte; ein neuer Versuch geht jederzeit.',
		cert: {
			kicker: 'Urkunde · Paperless anywhere',
			title: 'Dein eigenes Paperless-Image',
			lead: 'Dieses Image wurde nur für deinen Tresor versiegelt. Jeder Schritt ist öffentlich nachprüfbar – die Werte führen direkt zum Beleg.',
			builtAt: 'Gebaut am',
			passphrase: 'Passphrase',
			onlyVault: 'nur in deinem Tresor',
			plain: 'Öffentliches Image (SHA-256)',
			builder: 'Build-Dienst (von AMD bestätigt)',
			store: 'Dein Image bei Aleph (STORE)',
			commit: 'Gebaut aus dem Quelltext-Stand',
			print: 'Als PDF speichern',
			back: 'Zurück',
			open: 'Deine Urkunde'
		}
	},
	en: {
		kicker: 'Your first start · about 25 minutes in all',
		title: 'Your own image is being made',
		minimize: 'Minimise',
		expand: 'Show',
		step: (/** @type {number} */ n, /** @type {number} */ of) => `Step ${n} of ${of}`,
		rebuildKicker: 'New image version · about 15 minutes',
		rebuildTitle: 'Your new image is being made',
		rebuildDoneTitle: 'Done – your new image is ready!',
		rebuildDoneText: 'Sealed again with your own passphrase, which only your vault knows. Your Paperless runs on the new version from its next start.',
		stations: {
			wake: { label: 'Builder', duration: 'about 4 min', title: 'Your personal builder is waking up', text: 'A confidential machine starts just for you. It takes a few minutes – just right for a coffee.', mini: 'Your builder is waking up' },
			check: { label: 'Genuine', duration: 'a few seconds', title: 'Confirmed genuine!', text: 'The AMD processor confirms: exactly the published code runs here. Only now does your passphrase set off.', mini: 'Confirming it is genuine' },
			seal: { label: 'Seal', duration: 'about 2 min', title: 'Your image is being sealed', text: 'With a passphrase only your vault knows. Not Le Space, not the node – only you.', mini: 'Your image is being sealed' },
			fetch: { label: 'Fetch', duration: 'about 9 min', title: 'Your image is on its way to you', text: 'Piece by piece, over checked connections. Every piece arrives safely with you.', mini: 'Your image is on its way' },
			store: { label: 'Stored', duration: 'about 1 min', title: 'Safely stored', text: 'Your sealed image is going to Aleph now – ready for every start you make.', mini: 'Your image is being stored' },
			paperless: { label: 'Paperless', duration: 'about 10 min', title: 'Your Paperless is waking up', text: 'Your VM starts, the hardware is checked, your data is unlocked – everything is nearly ready.', mini: 'Your Paperless is waking up' }
		},
		measured: 'Hardware check passed',
		fetched: (/** @type {number} */ pct) => `${pct} % fetched`,
		share: (/** @type {number} */ pct) => `${pct} % done`,
		left: (/** @type {number} */ s) => `about ${min(s)} min to go`,
		endsAt: (/** @type {string} */ time) => `ready around ${time}`,
		keepOpen: 'Your screen stays on. Just leave this window open – you can minimise it and carry on alongside.',
		tab: (/** @type {number} */ pct) => `${pct} % · Your image is being made`,
		leave: 'Your image is being made right now. Leaving the page now stops the build.',
		doneTitle: 'Done – your Paperless is running!',
		doneText: 'Sealed with your very own passphrase. Only your vault knows it – not Le Space, not the node, nobody else. From now on a start takes about 10 minutes.',
		open: 'Open Paperless',
		showCertificate: 'See your certificate',
		close: 'Close',
		pausedTitle: 'A short pause',
		pausedText: 'Your start stopped at this point. The card says why; you can try again at any time.',
		cert: {
			kicker: 'Certificate · Paperless anywhere',
			title: 'Your own Paperless image',
			lead: 'This image was sealed for your vault alone. Every step can be checked in public – the values lead straight to the evidence.',
			builtAt: 'Built on',
			passphrase: 'Passphrase',
			onlyVault: 'only in your vault',
			plain: 'Public image (SHA-256)',
			builder: 'Builder (confirmed by AMD)',
			store: 'Your image on Aleph (STORE)',
			commit: 'Built from the source at',
			print: 'Save as PDF',
			back: 'Back',
			open: 'Your certificate'
		}
	}
};
