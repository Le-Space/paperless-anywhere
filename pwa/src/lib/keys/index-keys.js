// Where a vault's sealed box lives: under an Aleph address derived from the
// passkey's PRF answer, or from the seed phrase. Any device with the passkey
// (or the phrase) finds it; nobody else can open what is there.
import { hkdf } from '@noble/hashes/hkdf.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { mnemonicToSeedSync } from '@scure/bip39';
import { privateKeyToAccount } from 'viem/accounts';
import { alephPrivateKey } from './derive.js';

const encoder = new TextEncoder();
export const VAULT_KEY = 'paperless-anywhere-vault';

/** @param {Uint8Array} material @param {string} label */
function accountFrom(material, label) {
	// alephPrivateKey expects 32 bytes and keeps the result inside secp256k1's order.
	return privateKeyToAccount(alephPrivateKey(hkdf(sha256, material, undefined, encoder.encode(label), 32)));
}

/** @param {Uint8Array} prf */
export const passkeyIndexAccount = (prf) => accountFrom(prf, 'paperless-anywhere/vault-index/passkey/v1');

/** @param {string} phrase */
export const seedIndexAccount = (phrase) =>
	accountFrom(mnemonicToSeedSync(phrase.trim().toLowerCase().split(/\s+/).join(' ')), 'paperless-anywhere/vault-index/seed/v1');
