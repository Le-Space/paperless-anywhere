// Whether a profile starts from this vault's own image. Only then does a VM
// get what lets it reach beyond itself: the backups' keys, the age identity
// that opens the backups, and the DNS token. A VM on the public image shares
// its disk key with everyone who has that image version's passphrase, so it
// gets none of them.
import { imagePassphrase } from './keys/derive.js';

/**
 * From the profile alone (for the setup and the start's requirements): the
 * image it starts from is the one this vault built, with its passphrase.
 * @param {Record<string, any> | null | undefined} profile
 */
export const runsOwnImage = (profile) =>
	Boolean(profile?.ownImage?.rootfsItemHash) && profile?.ownImage?.rootfsItemHash === profile?.rootfsItemHash && profile?.luksFor === profile?.rootfsItemHash;

/**
 * The same, checked against the vault: the passphrase is the one derived
 * from this vault for that image version, which nobody else has. Used before
 * secrets are handed over.
 * @param {Uint8Array} master @param {Record<string, any> | null | undefined} profile
 */
export function ownImageVerified(master, profile) {
	const plain = profile?.ownImage?.plainSha256;
	if (!plain || !profile?.rootfsItemHash || profile.luksFor !== profile.rootfsItemHash) return false;
	return profile.luksPassphrase === imagePassphrase(master, plain);
}

/**
 * A profile built before the own image recorded its STORE: the record is
 * completed when the passphrase proves it (else nothing changes).
 * @param {Uint8Array} master @param {Record<string, any>} profile
 * @returns {Record<string, any> | null} the patch, or null
 */
export function ownImagePatch(master, profile) {
	if (!profile?.ownImage || profile.ownImage.rootfsItemHash === profile.rootfsItemHash) return null;
	if (!ownImageVerified(master, profile)) return null;
	return { ownImage: { ...profile.ownImage, rootfsItemHash: profile.rootfsItemHash } };
}
