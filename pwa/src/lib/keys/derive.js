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
	// Retired: the vault's own Filecoin payer of backups paid through Le Space
	// Credits, before Le Space's one payer signed for them. Kept so the label is
	// never reused for anything else.
	filecoinPayer: 'paperless-anywhere/filecoin-payer/v1',
	// The VM's backup key when Le Space Credits pay the backups: the service
	// signs each backup step for the VM that proves this key. It holds nothing
	// and has no right on chain. One per VM slot (`/n` after the label).
	backupKey: 'paperless-anywhere/backup-key/v1',
	profileKey: 'paperless-anywhere/profile-key/v1',
	// The backups' age identity: derived, so the 24 words alone decrypt every
	// backup, even when the sealed profile is gone.
	ageIdentity: 'paperless-anywhere/age-identity/v1',
	// The fixed address's first label: the same on every device and every start,
	// and it says nothing about who owns it.
	fixedHost: 'paperless-anywhere/fixed-host/v1',
	// The path of the VM's detailed status page: only the app that started it
	// knows it; the public page says no more than the phase.
	statusToken: 'paperless-anywhere/status-token/v1',
	// The passphrase of this vault's own image (docs/own-image.md), one per
	// plain image (`/<its SHA-256>` after the label): the 24 words alone open
	// every image that was ever built for the vault.
	imagePassphrase: 'paperless-anywhere/image-passphrase/v1'
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
 * The backup key of a VM when Le Space Credits pay the backups (secp256k1,
 * like an Ethereum key): the VM signs its requests to the service with it,
 * and the service only signs for data sets of this vault's account. Slot 0 is
 * the vault's VM; another slot gives another, unrelated key.
 * @param {Uint8Array} master @param {number} [slot]
 */
export function backupPrivateKey(master, slot = 0) {
	if (!Number.isInteger(slot) || slot < 0 || slot > 15) throw new Error('backup key slot must be 0 to 15');
	return alephPrivateKey(master, slot === 0 ? LABELS.backupKey : `${LABELS.backupKey}/${slot}`);
}

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

/**
 * The passphrase that seals this vault's copy of the plain image with
 * `plainSha256`: 43 characters, the same on every device.
 * @param {Uint8Array} master @param {string} plainSha256
 */
export function imagePassphrase(master, plainSha256) {
	if (!/^[0-9a-f]{64}$/.test(plainSha256)) throw new Error('the plain image is named by its SHA-256');
	return base64url(deriveBytes(master, `${LABELS.imagePassphrase}/${plainSha256}`));
}

/** A fresh master secret. */
export function newMasterSecret() {
	return crypto.getRandomValues(new Uint8Array(32));
}

/** The secret path segment of the VM's detailed status page (32 hex). @param {Uint8Array} master */
export const statusToken = (master) => hex(deriveBytes(master, LABELS.statusToken)).slice(0, 32);
