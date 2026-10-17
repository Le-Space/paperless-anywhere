// What this browser keeps: the passkey's id and the master secret sealed twice
// (by the passkey, by the seed phrase). Nothing in it opens anything without
// the passkey or the phrase. The master secret itself lives in memory only.
import { createPasskey, readPrf } from './passkey.js';
import { newMasterSecret } from './derive.js';
import { newSeedPhrase, seal, sealingKeyFromPrf, sealingKeyFromSeedPhrase, unseal } from './seal.js';

const STORAGE_KEY = 'paperless-anywhere.vault';

export function loadVault() {
	try {
		const v = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
		return v?.v === 1 ? v : null;
	} catch {
		return null;
	}
}

function storeVault(vault) {
	localStorage.setItem(STORAGE_KEY, JSON.stringify(vault));
}

export function forgetVault() {
	localStorage.removeItem(STORAGE_KEY);
}

/**
 * A new vault: a passkey, a master secret, a seed phrase. Returns the phrase
 * (shown once, to be written down) and the master secret (kept in memory).
 * @param {string} name
 */
export async function createVault(name) {
	const credentialId = await createPasskey(name);
	const prf = await readPrf(credentialId);
	const master = newMasterSecret();
	const phrase = newSeedPhrase();
	const vault = {
		v: 1,
		credentialId,
		byPasskey: await seal(master, sealingKeyFromPrf(prf), 'master/passkey'),
		bySeed: await seal(master, sealingKeyFromSeedPhrase(phrase), 'master/seed'),
		createdAt: new Date().toISOString()
	};
	storeVault(vault);
	prf.fill(0);
	return { master, phrase };
}

/** Open with the passkey. */
export async function unlockWithPasskey(vault) {
	const prf = await readPrf(vault.credentialId);
	try {
		return await unseal(vault.byPasskey, sealingKeyFromPrf(prf));
	} finally {
		prf.fill(0);
	}
}

/** Open with the seed phrase. @param {string} phrase */
export async function unlockWithSeedPhrase(vault, phrase) {
	return unseal(vault.bySeed, sealingKeyFromSeedPhrase(phrase));
}
