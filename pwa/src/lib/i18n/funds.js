// The balances of someone who pays with their own wallet or the app's address
// (Balances.svelte, balances.js) and credits in money (prices.js). German is
// the original; English beside it, key for key.
export const funds = {
	de: {
		readBalance: 'Guthaben abfragen',
		readCosts: 'laufende Kosten abfragen',
		days: (/** @type {number} */ days, /** @type {number} */ hours) => `${days} Tage${hours ? ` ${hours} h` : ''}`,
		units: { credits: 'nur Credits', eur: 'Euro', usd: 'Dollar', aleph: 'ALEPH' },
		titleBoth: 'Adresse der App und deine Wallet',
		titleWallet: 'Deine Wallet',
		keys: {
			app: 'Den Schlüssel der App-Adresse leitet dein Browser aus deinem Passkey (oder den 24 Wörtern) ab. ',
			wallet: 'Den Schlüssel deiner Wallet hat nur deine Wallet. ',
			leSpace: 'Le Space hat keinen dieser Schlüssel und kann nichts davon ausgeben.'
		},
		alephCredits: 'Aleph-Credits',
		appAddress: '(Adresse der App)',
		lastsRunning: (/** @type {string} */ lasts, /** @type {string} */ rate) => `· reicht noch ca. ${lasts} (${rate}, was gerade läuft)`,
		lastsFor: (/** @type {string} */ lasts, /** @type {string} */ rate, /** @type {string | null} */ already) => `· reicht für ca. ${lasts} Laufzeit (${rate}${already ? ` + ${already}/h, was schon läuft` : ''})`,
		belowReserve: (/** @type {string} */ reserve) => `Unter der Tagesreserve von ${reserve}: Aleph nimmt so keinen Start an.`,
		unreadable: 'nicht lesbar',
		gas: '(Gas)',
		lowGas: (/** @type {string} */ gasName) => `Wenig Gas: Den Sitzungsschlüssel zu verlängern oder Filecoin Pay aufzufüllen kostet ${gasName}.`,
		usdfcInWallet: (/** @type {boolean} */ test) => `USDFC${test ? ' (Test)' : ''} in deiner Wallet`,
		filecoinPay: 'Filecoin Pay',
		forBackups: '(für Sicherungen)',
		available: (/** @type {string} */ amount) => `${amount} verfügbar`,
		deposited: (/** @type {string} */ amount) => `von ${amount} hinterlegt`,
		spend: (/** @type {string} */ perMonth, /** @type {number | null} */ days) => `Verbrauch ca. ${perMonth} USDFC im Monat${days !== null ? `, reicht ca. ${days} Tage` : ''}`,
		lessThanMonth: 'Reicht weniger als einen Monat: aus deiner Wallet auffüllen, sonst schlagen Sicherungen fehl.',
		alsoIn: 'Credits auch in',
		peg: (/** @type {string} */ million) => `1 $ = ${million} Credits (Aleph)`,
		rates: (/** @type {string} */ alephEur, /** @type {string} */ usdEur, /** @type {string} */ time) => ` · ALEPH ${alephEur} €, 1 $ = ${usdEur} € (CoinGecko, ${time})`,
		noRates: ' · Kurse gerade nicht abrufbar',
		reading: 'Lese …',
		refresh: 'Aktualisieren'
	},
	en: {
		readBalance: 'asking for the balance',
		readCosts: 'asking for the running costs',
		days: (/** @type {number} */ days, /** @type {number} */ hours) => `${days} days${hours ? ` ${hours} h` : ''}`,
		units: { credits: 'credits only', eur: 'euros', usd: 'dollars', aleph: 'ALEPH' },
		titleBoth: 'The app’s address and your wallet',
		titleWallet: 'Your wallet',
		keys: {
			app: 'Your browser derives the key of the app’s address from your passkey (or the 24 words). ',
			wallet: 'Only your wallet has your wallet’s key. ',
			leSpace: 'Le Space has none of these keys and cannot spend any of it.'
		},
		alephCredits: 'Aleph credits',
		appAddress: '(the app’s address)',
		lastsRunning: (/** @type {string} */ lasts, /** @type {string} */ rate) => `· lasts about ${lasts} more (${rate}, for what is running)`,
		lastsFor: (/** @type {string} */ lasts, /** @type {string} */ rate, /** @type {string | null} */ already) => `· enough for about ${lasts} of running (${rate}${already ? ` + ${already}/h for what already runs` : ''})`,
		belowReserve: (/** @type {string} */ reserve) => `Below the one-day reserve of ${reserve}: Aleph accepts no start like this.`,
		unreadable: 'not readable',
		gas: '(gas)',
		lowGas: (/** @type {string} */ gasName) => `Little gas: extending the session key or topping up Filecoin Pay costs ${gasName}.`,
		usdfcInWallet: (/** @type {boolean} */ test) => `USDFC${test ? ' (test)' : ''} in your wallet`,
		filecoinPay: 'Filecoin Pay',
		forBackups: '(for backups)',
		available: (/** @type {string} */ amount) => `${amount} available`,
		deposited: (/** @type {string} */ amount) => `of ${amount} deposited`,
		spend: (/** @type {string} */ perMonth, /** @type {number | null} */ days) => `Uses about ${perMonth} USDFC a month${days !== null ? `, lasts about ${days} days` : ''}`,
		lessThanMonth: 'Lasts less than a month: top it up from your wallet, or backups will fail.',
		alsoIn: 'Credits also in',
		peg: (/** @type {string} */ million) => `$1 = ${million} credits (Aleph)`,
		rates: (/** @type {string} */ alephEur, /** @type {string} */ usdEur, /** @type {string} */ time) => ` · ALEPH €${alephEur}, $1 = €${usdEur} (CoinGecko, ${time})`,
		noRates: ' · rates not available right now',
		reading: 'Reading …',
		refresh: 'Refresh'
	}
};
