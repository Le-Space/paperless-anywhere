// "Hilfe & Support": how to reach Le Space, what to send, what Le Space never
// asks for, and where to read on. Shown in the app (Help.svelte at the foot
// of /app/) and on the landing page, which takes the same texts. No promise
// of a response time: Le Space has not set one.

export const help = {
	de: {
		title: 'Hilfe & Support',
		lead: 'Fragen, ein Problem, etwas klemmt? Schreib uns:',
		mail: 'paperless@le-space.de',
		mailLabel: 'E-Mail an Le Space',
		mailSubject: 'Paperless anywhere: Hilfe',
		payment: 'Zu Zahlung, Rechnung, Gutschein und Widerruf auch:',
		paymentMail: 'support@le-space.de',
		sendTitle: 'Was du mitschickst',
		send: 'Beschreib kurz, was du getan hast und was passiert ist. Dazu die Diagnose der App: Sie nennt Version, Zustand der VM und die letzte Fehlermeldung, ohne Geheimnisse und ohne Namen deiner Dokumente.',
		sendLanding: 'Beschreib kurz, was du getan hast und was passiert ist. Dazu die Diagnose: In der App unter „Hilfe & Support“ der Knopf „Diagnose kopieren“. Sie nennt Version, Zustand der VM und die letzte Fehlermeldung, ohne Geheimnisse und ohne Namen deiner Dokumente.',
		neverTitle: 'Le Space fragt nie nach deinen Geheimnissen',
		never: 'Nicht nach den 24 Wörtern deines Tresors oder der Seed-Phrase deiner Wallet, nicht nach einer Passphrase, deinem Passkey, einem Wiederherstellungscode oder einem DNS-Token. Wer danach fragt, ist nicht Le Space. Schick nichts davon, auch nicht an uns.',
		readTitle: 'Selbst nachlesen',
		faq: 'Häufige Fragen',
		restore: 'Eine Sicherung selbst holen und entschlüsseln',
		securityTitle: 'Sicherheitslücken melden',
		security: 'Bitte nur privat melden, nicht als Issue, Kommentar oder Beitrag: an security@le-space.de oder über GitHubs private Meldung. Wie wir damit umgehen, steht in SECURITY.md.',
		securityMail: 'security@le-space.de',
		securityGithub: 'Private Meldung bei GitHub',
		securityPolicy: 'SECURITY.md',
		diagnosis: {
			copy: 'Diagnose kopieren',
			copied: 'Kopiert. Füg sie in deine Mail ein.',
			failed: 'Kopieren ging nicht. Markier den Text unten und kopier ihn selbst.',
			show: 'Was die Diagnose enthält',
			locked: 'Bei gesperrtem Tresor enthält sie nur Version und Browser; entsperrt kommen der Zustand der VM und die letzte Fehlermeldung dazu.'
		}
	},
	en: {
		title: 'Help & support',
		lead: 'Questions, a problem, something stuck? Write to us:',
		mail: 'paperless@le-space.de',
		mailLabel: 'E-mail to Le Space',
		mailSubject: 'Paperless anywhere: help',
		payment: 'About payment, invoices, vouchers and withdrawal, also:',
		paymentMail: 'support@le-space.de',
		sendTitle: 'What to send',
		send: 'Say briefly what you did and what happened. Add the app’s diagnosis: it names the version, the state of the VM and the last error message, without secrets and without the names of your documents.',
		sendLanding: 'Say briefly what you did and what happened. Add the diagnosis: in the app under “Help & support”, the button “Copy diagnosis”. It names the version, the state of the VM and the last error message, without secrets and without the names of your documents.',
		neverTitle: 'Le Space never asks for your secrets',
		never: 'Not for your vault’s 24 words or your wallet’s seed phrase, not for a passphrase, your passkey, a recovery code or a DNS token. Whoever asks for them is not Le Space. Send none of them, not to us either.',
		readTitle: 'Read up yourself',
		faq: 'Frequently asked questions',
		restore: 'Fetch and decrypt a backup yourself',
		securityTitle: 'Reporting a security issue',
		security: 'Please report it privately, not as an issue, comment or post: to security@le-space.de or through GitHub’s private reporting. How we handle it is in SECURITY.md.',
		securityMail: 'security@le-space.de',
		securityGithub: 'Private report on GitHub',
		securityPolicy: 'SECURITY.md',
		diagnosis: {
			copy: 'Copy diagnosis',
			copied: 'Copied. Paste it into your mail.',
			failed: 'Copying did not work. Select the text below and copy it yourself.',
			show: 'What the diagnosis holds',
			locked: 'With the vault locked it holds only the version and the browser; unlocked, the state of the VM and the last error message are added.'
		}
	}
};
