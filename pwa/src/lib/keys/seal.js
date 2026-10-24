// The master secret is only ever stored sealed: AES-GCM under a key that
// comes from the passkey's PRF answer or from the seed phrase. Either opens it.
import { hkdf } from '@noble/hashes/hkdf.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { mnemonicToSeedSync, validateMnemonic, generateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';

const encoder = new TextEncoder();
const SEAL_INFO = {
	passkey: 'paperless-anywhere/seal-key/passkey/v1',
	seed: 'paperless-anywhere/seal-key/seed/v1'
};

const b64 = (bytes) => btoa(String.fromCharCode(...bytes));
const unb64 = (text) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));

/** A sealing key from the passkey's 32-byte PRF answer. @param {Uint8Array} prf */
export function sealingKeyFromPrf(prf) {
	if (!(prf instanceof Uint8Array) || prf.length < 32) throw new Error('the PRF answer must be at least 32 bytes');
	return hkdf(sha256, prf, undefined, encoder.encode(SEAL_INFO.passkey), 32);
}

/** 24 words (256 bits). */
export function newSeedPhrase() {
	return generateMnemonic(wordlist, 256);
}

/** A sealing key from a seed phrase; refuses a phrase with a bad checksum. @param {string} phrase */
export function sealingKeyFromSeedPhrase(phrase) {
	const words = phrase.trim().toLowerCase().split(/\s+/).join(' ');
	if (!validateMnemonic(words, wordlist)) throw new Error('the seed phrase is not valid');
	return hkdf(sha256, mnemonicToSeedSync(words), undefined, encoder.encode(SEAL_INFO.seed), 32);
}

/** @param {Uint8Array} key32 */
async function aesKey(key32, usage) {
	return crypto.subtle.importKey('raw', key32, 'AES-GCM', false, [usage]);
}

/**
 * @param {Uint8Array} secret
 * @param {Uint8Array} key32
 * @param {string} purpose bound into the ciphertext (AES-GCM additional data)
 */
export async function seal(secret, key32, purpose) {
	const iv = crypto.getRandomValues(new Uint8Array(12));
	const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: encoder.encode(purpose) }, await aesKey(key32, 'encrypt'), secret);
	return { v: 1, purpose, iv: b64(iv), ct: b64(new Uint8Array(ct)) };
}

/**
 * Throws if the key is wrong, the box was changed, or it was sealed for
 * another purpose: the caller names the purpose it expects, and that (not
 * what the box says) is the additional data the ciphertext must match.
 * @param {any} box @param {Uint8Array} key32 @param {string} purpose
 */
export async function unseal(box, key32, purpose) {
	if (box?.v !== 1) throw new Error('unknown sealed box version');
	if (typeof purpose !== 'string' || !purpose) throw new Error('unseal needs the expected purpose');
	if (box.purpose !== purpose) throw new Error(`the box was sealed for ${String(box.purpose).slice(0, 40)}, not ${purpose}`);
	const pt = await crypto.subtle.decrypt(
		{ name: 'AES-GCM', iv: unb64(box.iv), additionalData: encoder.encode(purpose) },
		await aesKey(key32, 'decrypt'),
		unb64(box.ct)
	);
	return new Uint8Array(pt);
}
