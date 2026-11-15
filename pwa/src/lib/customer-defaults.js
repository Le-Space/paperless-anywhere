// A Paperless that Le Space pays for (a package or a voucher's period) is set
// up by itself: someone who redeems a voucher or takes a package should see
// "Start", not a setup with empty fields. The defaults go into the sealed
// profile once, and only while nobody has chosen who pays: a profile with a
// wallet, the app's own address or an explicit choice is left as it is.
//
// What is set:
// - Le Space pays the VM from the package or voucher, and the backups
//   through Le Space Credits (no wallet, no crypto);
// - the network the service backs up on (mainnet) and the role that backs up
//   there (primary; a customer has this one instance);
// - backups on, encrypted for the vault's own key (the 24 words restore
//   them), three copies with providers in the EU (§ 146 Abs. 2a AO);
// - the VM's backup key released at the service, as the setup would.
// The image and the node are not set here: the node is chosen at the start,
// and the image is built for this vault at the first start.
import { backupAuthorize, backupKeyAddress } from './credits.js';
import { backupConfigFor } from './backups.js';
import { ageIdentityFromMaster, ageRecipient } from './keys/age.js';
import { loadProfile, updateProfile } from './profile.js';

/** Where a customer's backups go: three copies, providers in the EU. */
export const CUSTOMER_PLACES = Object.freeze({ copies: 3, providerIds: [], regions: ['EU'] });

/** Nobody has chosen who pays yet. @param {Record<string, any>} profile */
export const undecided = (profile) => !profile?.payer && profile?.appPays === undefined && profile?.leSpacePays === undefined;

/**
 * The fields a Le-Space-paid Paperless starts with, for a profile nobody has
 * set up; null when there is nothing to set.
 * @param {Record<string, any>} profile
 * @param {{ network: 'mainnet' | 'calibration', vaultAge: string }} a
 */
export function customerDefaults(profile, { network, vaultAge }) {
	if (!undecided(profile)) return null;
	const identity = profile.ageIdentity || vaultAge;
	return {
		leSpacePays: true,
		appPays: false,
		backupsByCredits: true,
		network,
		role: network === 'mainnet' ? 'primary' : 'test',
		ageIdentity: identity,
		backupConfig: profile.backupConfig ?? backupConfigFor(network, ageRecipient(identity), CUSTOMER_PLACES)
	};
}

/**
 * Sets the defaults when Le Space pays (a plan or a voucher's period runs)
 * and nobody has chosen yet; then releases the VM's backup key at the
 * service. Returns whether the profile changed.
 * @param {Uint8Array} master
 * @param {{ network: string | null }} a the network the service backs up on
 * @param {{ load?: typeof loadProfile, update?: typeof updateProfile, authorize?: typeof backupAuthorize }} [deps]
 */
export async function applyCustomerDefaults(master, { network }, { load = loadProfile, update = updateProfile, authorize = backupAuthorize } = {}) {
	if (network !== 'mainnet' && network !== 'calibration') return false;
	const before = await load(master);
	const patch = customerDefaults(before, { network, vaultAge: ageIdentityFromMaster(master) });
	if (!patch) return false;
	// Written only if still nobody chose in the meantime (another device, the setup).
	await update(master, (now) => (undecided(now) ? { ...now, ...patch } : now));
	try {
		const s = await authorize(master, backupKeyAddress(master));
		if (s.network === network) await update(master, (now) => (now.backupsByCredits && !now.backupSigner?.payer ? { ...now, backupSigner: { payer: s.payer, signer: s.signer, tag: s.tag, label: s.label, network: s.network } } : now));
	} catch {
		// Not released yet (no backup paid, service busy): the start says what is missing, the setup offers it.
	}
	return true;
}
