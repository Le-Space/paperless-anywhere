// What credits.js says to a person: the service's error codes in words, the
// messages of buying, and where the backup stands. German is the original;
// English beside it, key for key. The legal wording of cancelling and
// withdrawing is not here: it is German only, in legal-texts.js.
export const credits = {
	de: {
		answers: (/** @type {number} */ status) => `Le Space Credits antwortet ${status}`,
		notSetUp: 'Le Space Credits sind hier nicht eingerichtet.',
		waiver: 'Ohne die Erklärung zum Widerrufsrecht kann Le Space den Kauf nicht ausführen. Bitte das Kästchen vor dem Bezahlen ankreuzen. War es angekreuzt, hat sich der Text womöglich geändert: dann die Seite neu laden und noch einmal bestätigen.',
		terms: 'Erst den aktuellen Bedingungen (AGB) zustimmen, dann geht es weiter.',
		short: (/** @type {string | null} */ missing) => `Die Le Space Credits reichen dafür nicht${missing != null ? ` (es fehlen ${missing})` : ''}. Erst aufladen.`,
		planHours: (/** @type {number} */ hours, /** @type {boolean} */ always) => (always ? 'Dauerbetrieb' : `${hours} Stunden`),
		codes: {
			NO_PLAN: 'Dafür braucht es ein laufendes Paket: erst ein Paket wählen.',
			TREASURY_OFF: 'Le Space Credits können gerade keine Aleph-Credits ausgeben. Später noch einmal versuchen.',
			REFUSED: 'Aleph hat die Gutschrift abgelehnt. Später noch einmal versuchen.',
			CAP: 'Le Space hat gerade nicht genug Aleph-Credits vorrätig. Später noch einmal versuchen.',
			HOURS: 'Diese Stundenzahl nimmt der Dienst nicht an.',
			VERSION: 'Diese Fassung der Bedingungen kann gerade nicht angenommen werden. Bitte die Seite neu laden.',
			ADDRESS: 'Le Space Credits nehmen den Schlüssel der VM für die Sicherungen nicht an.',
			TOO_SOON: 'Die Sicherungen wurden gerade erst bezahlt. Bitte in fünf Minuten noch einmal.',
			MONTHS: 'Sicherungen lassen sich für 1 bis 12 Monate bezahlen.',
			SUBS_OFF: 'Le Space Credits bezahlen VMs gerade noch nicht selbst. Später noch einmal versuchen.',
			DELEGATES: 'Zu viele Geräte sind schon für dieses Konto freigegeben.',
			SUBSCRIBED: 'Es läuft schon ein Abo. Ändern geht über „Abo verwalten“, kündigen über „Verträge hier kündigen“.',
			NO_SUBSCRIPTION: 'Es gibt noch kein Abo zum Verwalten.',
			ORIGIN: 'Diese Adresse der App darf das Abo-Portal nicht öffnen.',
			PRICE_TAX: 'Das Abo ist beim Credits-Dienst noch nicht fertig eingerichtet (Preise).',
			STRIPE_OFF: 'Bezahlen ist beim Credits-Dienst gerade abgeschaltet.',
			NO_BACKUP: 'Für dieses Produkt bezahlen Le Space Credits keine Sicherungen.',
			PAUSED: 'Le Space Credits zahlen gerade keine Sicherungen ein (Tageslimit oder noch nicht freigeschaltet). Später noch einmal versuchen.',
			BACKUP_OFF: 'Le Space Credits bezahlen gerade keine Sicherungen (beim Dienst nicht eingerichtet). Später noch einmal versuchen.',
			PRODUCT: 'Le Space Credits kennen dieses Produkt nicht.'
		},
		vmFund: { TOO_SOON: 'Stunden sind schon unterwegs, bitte kurz warten.' },
		backupKey: { DELEGATES: 'Für dieses Konto sind schon 5 VM-Schlüssel für Sicherungen freigegeben, mehr nimmt der Dienst nicht an.' },
		backupPlan: {
			NOT_YET: 'Die Sicherung im Abo und das Jahr Aufbewahrung gibt es erst mit den neuen AGB. Bis dahin: einen Monat Sicherungen aus dem Guthaben bezahlen (Einrichtung).',
			BACKUP_ON: 'Die Sicherung ist schon Teil deines Abos.',
			BACKUP_INCLUDED: 'Die Sicherung ist in deinem Paket schon enthalten.',
			NO_SUBSCRIPTION: 'Dafür braucht es ein laufendes Abo per Karte.',
			NO_BACKUP: 'Für dieses Produkt gibt es keine Sicherung.',
			NO_BACKUP_LINE: 'Die Sicherung ist nicht Teil deines Abos.',
			BACKUP_PRICE: 'Die Sicherung im Abo ist beim Credits-Dienst noch nicht fertig eingerichtet.',
			STRIPE_OFF: 'Bezahlen ist beim Credits-Dienst noch nicht eingerichtet.'
		},
		cancel: {
			NO_SUBSCRIPTION: 'Es läuft kein Abo, das gekündigt werden könnte.'
		},
		cancelUnsupported: 'Der Credits-Dienst kann das Abo noch nicht hier in der App kündigen. Gekündigt wird deshalb im Kundenportal von Stripe, das sich jetzt öffnet.',
		cancelNotConfirmed: 'Le Space Credits haben den Eingang der Kündigung nicht bestätigt. Bitte „Aktualisieren“ und den Stand prüfen.',
		withdrawal: {
			NOTHING_TO_WITHDRAW: 'Es gibt nichts mehr, das sich widerrufen ließe: Die 14 Tage sind vorbei.'
		},
		withdrawalUnsupported: 'Der Credits-Dienst kann den Widerruf noch nicht hier in der App annehmen.',
		withdrawalNotConfirmed: 'Le Space Credits haben den Eingang des Widerrufs nicht bestätigt. Bitte „Aktualisieren“ und den Stand prüfen.',
		quoteUnsupportedBought: (/** @type {number | null} */ charged) => `Le Space Credits können noch keinen Preis vorab nennen und haben die Stunden womöglich schon gekauft${charged != null ? ` (${charged} Credits)` : ''}. Bitte das Guthaben prüfen und nicht noch einmal kaufen: bestätigte Käufe gehen erst, wenn der Dienst sie kann.`,
		quoteUnsupported: 'Le Space Credits können noch keinen Preis vorab nennen. Stunden lassen sich hier erst kaufen, wenn der Dienst bestätigte Käufe kann.',
		noPrice: 'Le Space Credits nennen keinen gültigen Preis. Bitte später noch einmal.',
		backupKeyNoAddress: 'Der Schlüssel der VM für die Sicherungen ist keine Adresse.',
		noBackupAccount: 'Le Space Credits haben kein Konto für die Sicherungen genannt.',
		noBackupTag: 'Le Space Credits haben keine Kennung für die Sicherungen genannt.',
		noBackupLabel: 'Le Space Credits haben keinen Namen für die Datensätze genannt.',
		noBackupNetwork: 'Le Space Credits haben kein Netz für die Sicherungen genannt.',
		payOff: 'Bezahlen ist beim Credits-Dienst noch nicht eingerichtet.',
		noVmAccount: 'Le Space Credits haben kein Konto für die VM genannt.',
		noCheckout: 'Le Space Credits haben keine Bezahlseite für das Abo geliefert.',
		noYearCheckout: 'Le Space Credits haben keine Bezahlseite für das Jahr geliefert.',
		noPortal: 'Le Space Credits haben keine Stripe-Adresse geliefert.',
		backup: {
			over: 'Die Sicherungen sind abgelaufen. Der Speicher dafür kann beendet sein; eine neue Sicherung entsteht, sobald wieder eine bezahlt ist und Paperless anywhere läuft.',
			expired: (/** @type {string} */ since, /** @type {string} */ until) => `Seit dem ${since} entstehen keine neuen Sicherungen. Die vorhandenen bleiben bis zum ${until} abrufbar.`,
			soon: (/** @type {string} */ until, /** @type {number | null} */ daysLeft) => `Die Sicherung ist bis zum ${until} bezahlt${daysLeft != null ? ` (noch ${daysLeft} ${daysLeft === 1 ? 'Tag' : 'Tage'})` : ''}. Danach entstehen keine neuen Sicherungen mehr.`,
			renews: (/** @type {string} */ until) => `Sicherung: Teil deines Abos, verlängert sich mit dem Paket. Bezahlt bis zum ${until}.`,
			paid: (/** @type {string} */ until) => `Sicherung: bezahlt bis zum ${until}.`,
			none: 'Sicherung: nicht gebucht. Ohne Sicherung sind deine Dokumente nach einem Stopp weg.'
		}
	},
	en: {
		answers: (/** @type {number} */ status) => `Le Space Credits answer ${status}`,
		notSetUp: 'Le Space Credits are not set up here.',
		waiver: 'Without the declaration on the right of withdrawal Le Space cannot carry out the purchase. Please tick the box before paying. If it was ticked, the text may have changed: then reload the page and confirm once more.',
		terms: 'Agree to the current terms (AGB) first, then it goes on.',
		short: (/** @type {string | null} */ missing) => `The Le Space Credits do not cover this${missing != null ? ` (${missing} missing)` : ''}. Top up first.`,
		planHours: (/** @type {number} */ hours, /** @type {boolean} */ always) => (always ? 'Always on' : `${hours} hours`),
		codes: {
			NO_PLAN: 'This needs a running package: choose a package first.',
			TREASURY_OFF: 'Le Space Credits cannot hand out Aleph credits right now. Try again later.',
			REFUSED: 'Aleph refused the credit. Try again later.',
			CAP: 'Le Space does not have enough Aleph credits in stock right now. Try again later.',
			HOURS: 'The service does not take this number of hours.',
			VERSION: 'This version of the terms cannot be accepted right now. Please reload the page.',
			ADDRESS: 'Le Space Credits do not accept the VM’s key for the backups.',
			TOO_SOON: 'The backups were paid only just now. Please try again in five minutes.',
			MONTHS: 'Backups can be paid for 1 to 12 months.',
			SUBS_OFF: 'Le Space Credits do not pay for VMs themselves yet. Try again later.',
			DELEGATES: 'Too many devices are already approved for this account.',
			SUBSCRIBED: 'A subscription is already running. Change it under “Manage subscription”, cancel it under “Verträge hier kündigen”.',
			NO_SUBSCRIPTION: 'There is no subscription to manage yet.',
			ORIGIN: 'This address of the app may not open the subscription portal.',
			PRICE_TAX: 'The subscription is not fully set up at the credits service yet (prices).',
			STRIPE_OFF: 'Paying is switched off at the credits service right now.',
			NO_BACKUP: 'Le Space Credits pay for no backups for this product.',
			PAUSED: 'Le Space Credits are not paying in for backups right now (daily limit, or not switched on yet). Try again later.',
			BACKUP_OFF: 'Le Space Credits pay for no backups right now (not set up at the service). Try again later.',
			PRODUCT: 'Le Space Credits do not know this product.'
		},
		vmFund: { TOO_SOON: 'Hours are already on their way, please wait a moment.' },
		backupKey: { DELEGATES: 'Five VM keys for backups are already approved for this account; the service takes no more.' },
		backupPlan: {
			NOT_YET: 'The backup in the subscription and the year of keeping come only with the new terms. Until then: pay a month of backups from the balance (setup).',
			BACKUP_ON: 'The backup is already part of your subscription.',
			BACKUP_INCLUDED: 'The backup is already included in your package.',
			NO_SUBSCRIPTION: 'This needs a running subscription by card.',
			NO_BACKUP: 'There is no backup for this product.',
			NO_BACKUP_LINE: 'The backup is not part of your subscription.',
			BACKUP_PRICE: 'The backup in the subscription is not fully set up at the credits service yet.',
			STRIPE_OFF: 'Paying is not set up at the credits service yet.'
		},
		cancel: {
			NO_SUBSCRIPTION: 'No subscription is running that could be cancelled.'
		},
		cancelUnsupported: 'The credits service cannot cancel the subscription here in the app yet. It is therefore cancelled in Stripe’s customer portal, which opens now.',
		cancelNotConfirmed: 'Le Space Credits did not confirm that the cancellation arrived. Please use “Refresh” and check the state.',
		withdrawal: {
			NOTHING_TO_WITHDRAW: 'There is nothing left that could be withdrawn: the 14 days are over.'
		},
		withdrawalUnsupported: 'The credits service cannot take the withdrawal here in the app yet.',
		withdrawalNotConfirmed: 'Le Space Credits did not confirm that the withdrawal arrived. Please use “Refresh” and check the state.',
		quoteUnsupportedBought: (/** @type {number | null} */ charged) => `Le Space Credits cannot name a price in advance yet and may already have bought the hours${charged != null ? ` (${charged} credits)` : ''}. Please check the balance and do not buy again: confirmed purchases work only once the service can do them.`,
		quoteUnsupported: 'Le Space Credits cannot name a price in advance yet. Hours can be bought here only once the service can do confirmed purchases.',
		noPrice: 'Le Space Credits name no valid price. Please try again later.',
		backupKeyNoAddress: 'The VM’s key for the backups is not an address.',
		noBackupAccount: 'Le Space Credits named no account for the backups.',
		noBackupTag: 'Le Space Credits named no tag for the backups.',
		noBackupLabel: 'Le Space Credits named no name for the data sets.',
		noBackupNetwork: 'Le Space Credits named no network for the backups.',
		payOff: 'Paying is not set up at the credits service yet.',
		noVmAccount: 'Le Space Credits named no account for the VM.',
		noCheckout: 'Le Space Credits delivered no payment page for the subscription.',
		noYearCheckout: 'Le Space Credits delivered no payment page for the year.',
		noPortal: 'Le Space Credits delivered no Stripe address.',
		backup: {
			over: 'The backups have run out. Their storage may have been ended; a new backup is made as soon as one is paid for again and Paperless anywhere runs.',
			expired: (/** @type {string} */ since, /** @type {string} */ until) => `No new backups have been made since ${since}. The existing ones can be fetched until ${until}.`,
			soon: (/** @type {string} */ until, /** @type {number | null} */ daysLeft) => `The backup is paid until ${until}${daysLeft != null ? ` (${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} left)` : ''}. After that no new backups are made.`,
			renews: (/** @type {string} */ until) => `Backup: part of your subscription, renews with the package. Paid until ${until}.`,
			paid: (/** @type {string} */ until) => `Backup: paid until ${until}.`,
			none: 'Backup: not booked. Without a backup your documents are gone after a stop.'
		}
	}
};
