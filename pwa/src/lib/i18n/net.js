// What the modules below the views say when something cannot be reached or
// does not fit: Aleph (aleph.js), the wallet (permissions.js), the relays
// (attest-p2p.js, relays.js), the keys (keys/) and the pinned runtime
// (runtime-pin.js). German is the original; English beside it, key for key.
export const net = {
	de: {
		unreachable: (/** @type {string} */ host, /** @type {string} */ what, /** @type {number} */ tries, /** @type {string} */ last) => `${host} nicht erreichbar (${what}, ${tries} Versuche: ${last}). Verbindung prüfen und erneut versuchen.`,
		readSettings: 'Einstellungen lesen',
		wallet: {
			none: 'Keine Wallet gefunden (MetaMask oder eine Hardware-Wallet in MetaMask).',
			noAccount: 'Die Wallet hat kein Konto freigegeben.',
			refused: (/** @type {number} */ status, /** @type {string} */ answer) => `Aleph hat die Freigabe abgelehnt (${status}): ${answer}`
		},
		relay: {
			notOne: (/** @type {string} */ entry) => `Kein Relay: ${entry} (erwartet: wss://<host>/attest oder eine Multiaddr mit /p2p/)`,
			none: 'Kein Attest-Relay: keins eingetragen, und Aleph kennt gerade keins von Le Space.'
		},
		keys: {
			notAge: 'Kein age-Schlüssel (AGE-SECRET-KEY-1…).',
			ageLength: 'Kein age-Schlüssel (falsche Länge).',
			noPrf: 'Dieser Passkey kann kein PRF; ohne PRF lässt sich nichts entsperren.',
			noVaultForPasskey: 'Zu diesem Passkey gibt es keinen Tresor.',
			noVaultForPhrase: 'Zu dieser Wiederherstellungsphrase gibt es keinen Tresor.'
		},
		runtime: {
			mismatch: (/** @type {string} */ what) => `Die Laufzeit, die Aleph liefert, ist nicht die, die diese App kennt (${what}). Es wurde nichts gestartet.`,
			otherBundle: 'anderes Paket',
			otherFile: (/** @type {string} */ role) => `andere Datei für ${role}`,
			otherBootLine: 'andere Startzeile'
		}
	},
	en: {
		unreachable: (/** @type {string} */ host, /** @type {string} */ what, /** @type {number} */ tries, /** @type {string} */ last) => `${host} cannot be reached (${what}, ${tries} attempts: ${last}). Check the connection and try again.`,
		readSettings: 'reading the settings',
		wallet: {
			none: 'No wallet found (MetaMask, or a hardware wallet in MetaMask).',
			noAccount: 'The wallet released no account.',
			refused: (/** @type {number} */ status, /** @type {string} */ answer) => `Aleph refused the permission (${status}): ${answer}`
		},
		relay: {
			notOne: (/** @type {string} */ entry) => `Not a relay: ${entry} (expected: wss://<host>/attest or a multiaddr with /p2p/)`,
			none: 'No attest relay: none entered, and Aleph knows none of Le Space’s right now.'
		},
		keys: {
			notAge: 'Not an age key (AGE-SECRET-KEY-1…).',
			ageLength: 'Not an age key (wrong length).',
			noPrf: 'This passkey cannot do PRF; without PRF nothing can be unlocked.',
			noVaultForPasskey: 'There is no vault for this passkey.',
			noVaultForPhrase: 'There is no vault for this recovery phrase.'
		},
		runtime: {
			mismatch: (/** @type {string} */ what) => `The runtime Aleph delivers is not the one this app knows (${what}). Nothing was started.`,
			otherBundle: 'another bundle',
			otherFile: (/** @type {string} */ role) => `another file for ${role}`,
			otherBootLine: 'another boot line'
		}
	}
};
