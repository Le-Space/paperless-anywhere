// age X25519 identities in the browser, for the backups: the VM encrypts each
// backup to the recipient, and a restore needs the identity, which the PWA
// keeps sealed in the profile. Same encoding as age-keygen.
import { x25519 } from '@noble/curves/ed25519';
import { bech32 } from '@scure/base';
import { deriveBytes, LABELS } from './derive.js';

const SECRET_HRP = 'age-secret-key-';

/** A fresh identity: AGE-SECRET-KEY-1… */
export function newAgeIdentity() {
	const secret = crypto.getRandomValues(new Uint8Array(32));
	return bech32.encode(SECRET_HRP, bech32.toWords(secret), false).toUpperCase();
}

/** The recipient (age1…) of an identity. @param {string} identity */
export function ageRecipient(identity) {
	const { prefix, words } = bech32.decode(identity.trim().toLowerCase(), false);
	if (prefix !== SECRET_HRP) throw new Error('Kein age-Schlüssel (AGE-SECRET-KEY-1…).');
	const secret = Uint8Array.from(bech32.fromWords(words));
	if (secret.length !== 32) throw new Error('Kein age-Schlüssel (falsche Länge).');
	return bech32.encode('age', bech32.toWords(x25519.getPublicKey(secret)), false);
}

/** The vault's own backup identity, from the master secret. @param {Uint8Array} master */
export function ageIdentityFromMaster(master) {
	return bech32.encode(SECRET_HRP, bech32.toWords(deriveBytes(master, LABELS.ageIdentity, 32)), false).toUpperCase();
}
