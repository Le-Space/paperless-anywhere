// The parts of buying beside the package card: the backup line, topping up,
// the confirmation before hours are bought, and the notice on new terms.
// German is the original; English beside it, key for key.
//
// The terms themselves exist in German only. What a person declares about
// them, and what follows from not agreeing, is legal wording: it stays German
// in both languages until approved English texts exist. An English reader is
// told so in one sentence (terms.germanNote).
const TERMS_LEGAL = {
	dueHint: 'Bis zur Zustimmung sind keine Käufe möglich; ein laufendes Paket endet zum Monatsende, statt sich zu verlängern.',
	announcedHint: 'Dein Paket läuft bis dahin zu den bisherigen Bedingungen. Stimmst du nicht zu, endet es zum Ende des Zeitraums; du kannst auch vorher kostenlos kündigen.',
	consent: (/** @type {string} */ version) => `Ich habe die Fassung ${version} gelesen und stimme ihr zu.`
};

export const buy = {
	de: {
		line: {
			own: 'Sicherung: bezahlst du aus deiner eigenen Wallet. Wie lange der Speicher bezahlt ist, steht unter „Deine Wallet bei Aleph und Filecoin“.',
			added: 'Die Sicherung ist jetzt Teil deines Abos. Die Rechnung über den Rest des Monats kommt von Stripe per E-Mail.',
			yearNotBought: 'Das Jahr wurde nicht gekauft.',
			payPageFailed: 'Die Bezahlseite ließ sich nicht laden. Bitte später noch einmal.',
			yearBooking: 'Bezahlt – das Jahr wird gebucht …',
			yearBooked: (/** @type {string} */ until) => `Gebucht: Die Sicherungen sind bis zum ${until} bezahlt.`,
			yearSoon: 'Bezahlt; das Jahr erscheint in Kürze.',
			retention: (/** @type {string} */ until) => `Nach dem Ende bleiben die Sicherungen noch bis zum ${until} abrufbar.`,
			addFold: (/** @type {string} */ price) => `Sicherung zum Abo hinzubuchen (${price} im Monat)`,
			addHint: (/** @type {string} */ nextCharge, /** @type {number} */ days) => `Stripe berechnet den Rest des laufenden Monats sofort anteilig. Danach verlängert sich die Sicherung mit dem Paket, nächste Abbuchung am ${nextCharge}. Herausnehmen kannst du sie in der Abo-Verwaltung bei Stripe; der bezahlte Zeitraum läuft dann noch aus, und die Sicherungen bleiben danach ${days} Tage abrufbar.`,
			addButton: (/** @type {string} */ price) => `Sicherung für ${price} im Monat hinzubuchen`,
			remove: { before: 'Herausnehmen kannst du die Sicherung in der ', link: 'Abo-Verwaltung bei Stripe', after: (/** @type {number} */ days) => `. Der bezahlte Zeitraum läuft dann noch aus, und die Sicherungen bleiben danach ${days} Tage abrufbar.` },
			yearFold: (/** @type {string} */ price) => `1 Jahr Aufbewahrung buchen (${price}, einmalig)`,
			keepStrong: 'Aufbewahren heißt nicht öffnen:',
			keep: 'Zum Wiederherstellen braucht es Rechenzeit, also ein laufendes Paket oder Zusatzstunden.',
			yearHint: (/** @type {number} */ days) => `${days} Tage, gerechnet ab heute oder, wenn schon länger bezahlt ist, ab dem bezahlten Ende. Zusätzlich zum Paket, keine Verlängerung, eigene Rechnung von Stripe.`,
			yearButton: (/** @type {string} */ price) => `1 Jahr für ${price} bezahlen`,
			mailNote: 'Eine Erinnerung kommt auch per E-Mail, an die Adresse aus deiner Kartenzahlung bei Stripe. Ohne Kartenzahlung steht der Hinweis nur hier.',
			yearCheckout: '1 Jahr Aufbewahrung bezahlen',
			yearSummary: (/** @type {string} */ price) => `1 Jahr Aufbewahrung der Sicherungen: ${price}, einmalig, keine Verlängerung.`
		},
		topup: {
			preparing: 'Bezahlung wird vorbereitet …',
			booking: 'Bezahlt – das Guthaben wird gebucht …',
			booked: (/** @type {string} */ balance) => `Gebucht: jetzt ${balance}.`,
			notBooked: 'Bezahlt, aber noch nicht gebucht. Das Guthaben erscheint in Kürze – „Aktualisieren“.',
			payPageFailed: 'Die Bezahlseite ließ sich nicht laden. Bitte später noch einmal.',
			dialog: 'Guthaben aufladen',
			close: 'Schließen',
			frame: 'Bezahlen mit Stripe',
			button: (/** @type {number} */ euros) => `${euros} € aufladen`
		},
		quote: {
			short: (/** @type {number | string} */ hours) => `Das Guthaben reicht nicht für ${hours} Stunden.`,
			close: 'Schließen',
			label: 'Kauf bestätigen',
			title: (/** @type {number} */ hours) => `${hours} Stunden kaufen?`,
			paidFrom: 'Bezahlt aus',
			fromBalance: 'deinem Le-Space-Credits-Guthaben',
			cost: 'Kosten',
			credits: (/** @type {string} */ n) => `${n} Credits`,
			balance: 'Guthaben',
			vmHours: 'VM-Stunden',
			usableUntil: (/** @type {string} */ day) => `, nutzbar bis ${day}`,
			usableUntilLabel: 'Nutzbar bis',
			cancel: 'Abbrechen'
		},
		terms: {
			legal: TERMS_LEGAL,
			germanNote: 'Die Bedingungen liegen auf Deutsch vor.',
			label: 'Bedingungen',
			due: 'Neue Bedingungen (AGB): bitte zustimmen',
			announced: (/** @type {string} */ day) => `Neue Bedingungen (AGB) ab ${day}`,
			read: (/** @type {string} */ version, /** @type {string} */ day) => `Fassung ${version} vom ${day} lesen und herunterladen`,
			agree: 'Zustimmen',
			accepted: (/** @type {string} */ version, /** @type {string} */ day) => `Bedingungen: Fassung ${version}, zugestimmt am ${day}`,
			readLink: 'lesen'
		}
	},
	en: {
		line: {
			own: 'Backup: you pay for it from your own wallet. How long the storage is paid is under “Your wallet on Aleph and Filecoin”.',
			added: 'The backup is now part of your subscription. The invoice for the rest of the month comes from Stripe by e-mail.',
			yearNotBought: 'The year was not bought.',
			payPageFailed: 'The payment page could not be loaded. Please try again later.',
			yearBooking: 'Paid – the year is being booked …',
			yearBooked: (/** @type {string} */ until) => `Booked: the backups are paid until ${until}.`,
			yearSoon: 'Paid; the year appears shortly.',
			retention: (/** @type {string} */ until) => `After the end the backups can still be fetched until ${until}.`,
			addFold: (/** @type {string} */ price) => `Add the backup to the subscription (${price} a month)`,
			addHint: (/** @type {string} */ nextCharge, /** @type {number} */ days) => `Stripe charges the rest of the running month at once, pro rata. After that the backup renews with the package, next charge on ${nextCharge}. You can take it out in the subscription management at Stripe; the paid period then still runs out, and the backups can be fetched for ${days} days after it.`,
			addButton: (/** @type {string} */ price) => `Add the backup for ${price} a month`,
			remove: { before: 'You can take the backup out in the ', link: 'subscription management at Stripe', after: (/** @type {number} */ days) => `. The paid period then still runs out, and the backups can be fetched for ${days} days after it.` },
			yearFold: (/** @type {string} */ price) => `Book 1 year of keeping (${price}, once)`,
			keepStrong: 'Keeping is not opening:',
			keep: 'Restoring needs compute time, that is a running package or extra hours.',
			yearHint: (/** @type {number} */ days) => `${days} days, counted from today or, if more is already paid, from the paid end. On top of the package, no renewal, an invoice of its own from Stripe.`,
			yearButton: (/** @type {string} */ price) => `Pay ${price} for 1 year`,
			mailNote: 'A reminder also comes by e-mail, to the address from your card payment at Stripe. Without a card payment the notice is only here.',
			yearCheckout: 'Pay for 1 year of keeping',
			yearSummary: (/** @type {string} */ price) => `1 year of keeping the backups: ${price}, once, no renewal.`
		},
		topup: {
			preparing: 'Preparing the payment …',
			booking: 'Paid – the balance is being booked …',
			booked: (/** @type {string} */ balance) => `Booked: now ${balance}.`,
			notBooked: 'Paid, but not booked yet. The balance appears shortly – “Refresh”.',
			payPageFailed: 'The payment page could not be loaded. Please try again later.',
			dialog: 'Top up the balance',
			close: 'Close',
			frame: 'Pay with Stripe',
			button: (/** @type {number} */ euros) => `Top up €${euros}`
		},
		quote: {
			short: (/** @type {number | string} */ hours) => `The balance does not cover ${hours} hours.`,
			close: 'Close',
			label: 'Confirm the purchase',
			title: (/** @type {number} */ hours) => `Buy ${hours} hours?`,
			paidFrom: 'Paid from',
			fromBalance: 'your Le Space Credits balance',
			cost: 'Cost',
			credits: (/** @type {string} */ n) => `${n} credits`,
			balance: 'Balance',
			vmHours: 'VM hours',
			usableUntil: (/** @type {string} */ day) => `, usable until ${day}`,
			usableUntilLabel: 'Usable until',
			cancel: 'Cancel'
		},
		terms: {
			legal: TERMS_LEGAL,
			germanNote: 'The terms are in German, and so are the two sentences below about them; the German text is the one that counts.',
			label: 'Terms',
			due: 'New terms (AGB): please agree',
			announced: (/** @type {string} */ day) => `New terms (AGB) from ${day}`,
			read: (/** @type {string} */ version, /** @type {string} */ day) => `Read and download version ${version} of ${day}`,
			agree: 'Agree',
			accepted: (/** @type {string} */ version, /** @type {string} */ day) => `Terms: version ${version}, agreed on ${day}`,
			readLink: 'read'
		}
	}
};
