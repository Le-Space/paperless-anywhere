// The settings this app needs on every device (the paying account, the
// network, the attest relay, the age identity for restores), sealed under the
// master secret and kept in Aleph under the app's own key. Aleph sees a box.
import { getAddress } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { alephPrivateKey, deriveBytes, LABELS } from './keys/derive.js';
import { seal, unseal } from './keys/seal.js';
import { readAggregate, writeAggregate } from './aleph.js';

export const PROFILE_KEY = 'paperless-anywhere-profile';

/** @param {Uint8Array} master */
const account = (master) => privateKeyToAccount(alephPrivateKey(master));
const boxKey = (master) => deriveBytes(master, LABELS.profileKey);

/** The profile, or an empty one. @param {Uint8Array} master */
export async function loadProfile(master) {
	const entry = await readAggregate(account(master).address, PROFILE_KEY);
	if (!entry?.box) return {};
	const profile = JSON.parse(new TextDecoder().decode(await unseal(entry.box, boxKey(master), 'profile')));
	// Profiles saved before addresses were normalized hold MetaMask's lowercase.
	for (const field of ['payer', 'backupOwner']) {
		if (typeof profile[field] === 'string' && /^0x[0-9a-fA-F]{40}$/.test(profile[field])) profile[field] = getAddress(profile[field]);
	}
	return profile;
}

/** @param {Uint8Array} master @param {Record<string, unknown>} profile */
export async function saveProfile(master, profile) {
	const box = await seal(new TextEncoder().encode(JSON.stringify(profile)), boxKey(master), 'profile');
	await writeAggregate(account(master), PROFILE_KEY, { v: 1, box });
}

/**
 * Who pays the VM on Aleph: the app's own address when the profile says so
 * (`appPays`, its credits come from Le Space Credits or a transfer), else the
 * connected wallet. The wallet stays the Filecoin payer of the backups.
 * @param {Record<string, any>} profile @param {string} appAddress
 */
export function vmPayer(profile, appAddress) {
	return profile.appPays ? appAddress : profile.payer;
}

/**
 * Who pays the backups on Filecoin: with `backupsByCredits` the vault's own
 * Filecoin payer, funded through Le Space Credits; otherwise the wallet.
 * @param {Record<string, any>} profile @param {string} creditsPayerAddress
 */
export function backupPayer(profile, creditsPayerAddress) {
	return profile.backupsByCredits ? creditsPayerAddress : profile.payer;
}

/**
 * Change the profile as it is on Aleph now, not as a component loaded it:
 * the setup, the start and stop and the VM list each write it, and a copy
 * loaded earlier would undo what another wrote meanwhile (2026-11-04: saving
 * the image in the setup dropped the running VM a start had recorded).
 * @param {Uint8Array} master @param {(profile: Record<string, any>) => Record<string, any>} change
 */
export async function updateProfile(master, change) {
	const next = change(await loadProfile(master));
	await saveProfile(master, next);
	return next;
}
