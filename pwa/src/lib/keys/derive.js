// Everything the PWA needs comes from one random master secret, by HKDF with
// a distinct label per purpose: the same secret always gives the same keys,
// and one key reveals nothing about another.
import { hkdf } from '@noble/hashes/hkdf.js';
import { sha256 } from '@noble/hashes/sha2.js';

const encoder = new TextEncoder();

export const LABELS = Object.freeze({
	alephAccount: 'paperless-anywhere/aleph-account/v1',
	paperlessAdminPassword: 'paperless-anywhere/paperless-admin-password/v1',
	paperlessDbPassword: 'paperless-anywhere/paperless-db-password/v1',
	paperlessSecretKey: 'paperless-anywhere/paperless-secret-key/v1',
	vaultKey: 'paperless-anywhere/vault-key/v1',
	filecoinSession: 'paperless-anywhere/filecoin-session-key/v1',
	profileKey: 'paperless-anywhere/profile-key/v1',
	// The backups' age identity: derived, so the 24 words alone decrypt every
	// backup, even when the sealed profile is gone.
	ageIdentity: 'paperless-anywhere/age-identity/v1',
	// The fixed address's first label: the same on every device and every start,
	// and it says nothing about who owns it.
	fixedHost: 'paperless-anywhere/fixed-host/v1',
	// The path of the VM's detailed status page: only the app that started it
	// knows it; the public page says no more than the phase.
	statusToken: 'paperless-anywhere/status-token/v1'
});

// The order of secp256k1: a private key must be in [1, n).
const SECP256K1_N = 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n;

/** @param {Uint8Array} master @param {string} label @param {number} [length] */
export function deriveBytes(master, label, length = 32) {
	if (!(master instanceof Uint8Array) || master.length !== 32) throw new Error('the master secret must be 32 bytes');
	return hkdf(sha256, master, undefined, encoder.encode(label), length);
}

const hex = (bytes) => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
const base64url = (bytes) => btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');

/**
 * The PWA's own Aleph key: the paying account authorizes it for INSTANCE and
 * FORGET only. A derived value outside [1, n) is practically impossible; the
 * counter keeps the function total anyway.
 * @param {Uint8Array} master
 * @returns {`0x${string}`}
 */
export function alephPrivateKey(master, label = LABELS.alephAccount) {
	for (let i = 0; i < 16; i++) {
		const bytes = deriveBytes(master, i === 0 ? label : `${label}#${i}`);
		const k = BigInt(`0x${hex(bytes)}`);
		if (k > 0n && k < SECP256K1_N) return `0x${hex(bytes)}`;
	}
	throw new Error('could not derive a secp256k1 key');
}

/**
 * The Filecoin session key the paying account authorizes (add pieces, create
 * data sets) for some days. The VMs back up with it; it cannot delete pieces
 * or move funds.
 * @param {Uint8Array} master
 */
export const filecoinSessionPrivateKey = (master) => alephPrivateKey(master, LABELS.filecoinSession);

/**
 * The first label of this vault's fixed address: 16 base32 characters (80
 * bits), lowercase, a valid DNS label.
 * @param {Uint8Array} master
 */
export function fixedHostLabel(master) {
	const alphabet = 'abcdefghijklmnopqrstuvwxyz234567';
	let bits = 0n;
	for (const b of deriveBytes(master, LABELS.fixedHost, 10)) bits = (bits << 8n) | BigInt(b);
	let label = '';
	for (let i = 0; i < 16; i++) label = alphabet[Number((bits >> BigInt(5 * i)) & 31n)] + label;
	return label;
}

/** Paperless's secrets, as URL-safe text. @param {Uint8Array} master */
export function paperlessSecrets(master) {
	return {
		adminPassword: base64url(deriveBytes(master, LABELS.paperlessAdminPassword, 24)),
		dbPassword: base64url(deriveBytes(master, LABELS.paperlessDbPassword, 24)),
		secretKey: base64url(deriveBytes(master, LABELS.paperlessSecretKey, 48))
	};
}

/** A fresh master secret. */
export function newMasterSecret() {
	return crypto.getRandomValues(new Uint8Array(32));
}

/** The secret path segment of the VM's detailed status page (32 hex). @param {Uint8Array} master */
export const statusToken = (master) => hex(deriveBytes(master, LABELS.statusToken)).slice(0, 32);
