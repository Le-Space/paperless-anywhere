// Installing the web app: the manifest's texts (web-manifest.js writes one
// manifest per language from these at build time), the labels of the install
// dialog's screenshots, and the install button with its hints for browsers
// that offer no prompt (Install.svelte). German is the original; English
// beside it, key for key.
export const install = {
	de: {
		manifest: {
			description: 'Paperless-ngx in einer vertraulichen VM, ausfallsicher und nach deinem Takt. Deine Dokumente verschlüsselt, die Schlüssel nur bei dir. Ein Angebot von Le Space.',
			shortcuts: { prices: 'Preise', faq: 'Fragen und Antworten' }
		},
		screens: {
			landing: 'Paperless-ngx vertraulich gehostet: ausfallsicher, vertraulich und nach deinem Takt',
			running: 'Paperless-ngx läuft in deiner vertraulichen VM; oben die Lichter deiner Sicherungen',
			evidence: 'Der Nachweis der VM: was die App selbst geprüft hat und was nur gemeldet ist',
			backups: 'Jede Kopie deiner Sicherung, von der App selbst auf der Filecoin-Chain geprüft'
		},
		button: 'App installieren',
		buttonHint: 'Als eigene App auf diesem Gerät, mit Symbol auf dem Startbildschirm oder im Dock.',
		hint: {
			ios: { before: 'Als App installieren: auf ', share: 'Teilen', after: ' tippen, dann „Zum Home-Bildschirm“.' },
			mac: { before: 'Als App installieren: in Safari ', menu: 'Ablage → Zum Dock hinzufügen', after: ' wählen.' },
			firefox: 'Als eigene App installieren lässt sich Paperless anywhere in Chrome, Edge oder Safari. In Firefox läuft es genauso im Tab.',
			dismiss: 'Hinweis ausblenden'
		}
	},
	en: {
		manifest: {
			description: 'Paperless-ngx in a confidential VM, resilient and on your schedule. Your documents encrypted, the keys only with you. Offered by Le Space.',
			shortcuts: { prices: 'Prices', faq: 'Questions and answers' }
		},
		screens: {
			landing: 'Paperless-ngx, confidentially hosted: resilient, confidential and on your schedule',
			running: 'Paperless-ngx runs in your confidential VM; at the top, the lights of your backups',
			evidence: 'The evidence of the VM: what the app checked itself and what is only reported',
			backups: 'Every copy of your backup, checked on the Filecoin chain by the app itself'
		},
		button: 'Install app',
		buttonHint: 'As an app of its own on this device, with an icon on the home screen or in the dock.',
		hint: {
			ios: { before: 'To install it as an app: tap ', share: 'Share', after: ', then “Add to Home Screen”.' },
			mac: { before: 'To install it as an app: in Safari choose ', menu: 'File → Add to Dock', after: '.' },
			firefox: 'Chrome, Edge or Safari can install Paperless anywhere as an app of its own. In Firefox it works just the same in a tab.',
			dismiss: 'Hide this hint'
		}
	}
};
