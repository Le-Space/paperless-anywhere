// The master secret, sealed twice (passkey, seed phrase), kept in this browser
// and in Aleph: each box under an address only its passkey or phrase leads
// to, so another device can open the vault too. Nothing stored opens anything
// without the passkey or the phrase; the master secret lives in memory only.
import { createPasskey, readPrf } from './passkey.js';
import { newMasterSecret } from './derive.js';
import { newSeedPhrase, seal, sealingKeyFromPrf, sealingKeyFromSeedPhrase, unseal } from './seal.js';
import { passkeyIndexAccount, seedIndexAccount, VAULT_KEY } from './index-keys.js';
import { readAggregate, writeAggregate } from '../aleph.js';

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
 * A new vault: a passkey, a master secret, a seed phrase; both boxes go to
 * Aleph. Returns the phrase (shown once) and the master secret (in memory).
 * @param {string} name
 */
export async function createVault(name) {
	const created = await createPasskey(name);
	const { prf, credentialId } = await readPrf(created);
	const master = newMasterSecret();
	const phrase = newSeedPhrase();
	try {
		const vault = {
			v: 1,
			credentialId,
			byPasskey: await seal(master, sealingKeyFromPrf(prf), 'master/passkey'),
			bySeed: await seal(master, sealingKeyFromSeedPhrase(phrase), 'master/seed'),
			createdAt: new Date().toISOString()
		};
		await writeAggregate(passkeyIndexAccount(prf), VAULT_KEY, { v: 1, credentialId, box: vault.byPasskey });
		await writeAggregate(seedIndexAccount(phrase), VAULT_KEY, { v: 1, box: vault.bySeed });
		storeVault(vault);
		return { master, phrase };
	} finally {
		prf.fill(0);
	}
}

/** Open with the passkey: this browser's vault, or (on a new device) the one in Aleph. */
export async function unlockWithPasskey(vault) {
	const { prf, credentialId } = await readPrf(vault?.credentialId);
	try {
		let box = vault?.byPasskey;
		if (!box) {
			const remote = await readAggregate(passkeyIndexAccount(prf).address, VAULT_KEY);
			if (!remote?.box) throw new Error('Zu diesem Passkey gibt es keinen Tresor.');
			box = remote.box;
		}
		const master = await unseal(box, sealingKeyFromPrf(prf));
		if (!vault) storeVault({ v: 1, credentialId, byPasskey: box, bySeed: null, createdAt: new Date().toISOString() });
		return master;
	} finally {
		prf.fill(0);
	}
}

/** Open with the seed phrase: this browser's vault, or the one in Aleph. @param {string} phrase */
export async function unlockWithSeedPhrase(vault, phrase) {
	const key = sealingKeyFromSeedPhrase(phrase);
	let box = vault?.bySeed;
	if (!box) {
		const remote = await readAggregate(seedIndexAccount(phrase).address, VAULT_KEY);
		if (!remote?.box) throw new Error('Zu dieser Wiederherstellungsphrase gibt es keinen Tresor.');
		box = remote.box;
	}
	const master = await unseal(box, key);
	if (!vault) storeVault({ v: 1, credentialId: null, byPasskey: null, bySeed: box, createdAt: new Date().toISOString() });
	return master;
}
