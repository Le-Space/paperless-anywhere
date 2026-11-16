// Storage providers Le Space takes out of the backup places, with the reason.
// The automatic choice (pickProviders), a region at the start (placedConfig),
// the replacement for a provider that is down (places-replace.js) and the
// offer of one more copy never take them; the places form does not offer them
// to be chosen by hand either, and a profile that still names one is told so
// and offered a replacement (Lifecycle.svelte). Existing backups there stay
// where they are; nothing is deleted.
//
// Provider ids are per network: the same number is another provider on
// Calibration.

/** @typedef {'fidl'} BlockReason the key of the reason's text (backup.places.blocked) */

/** @type {Readonly<Record<string, Readonly<Record<number, BlockReason>>>>} */
export const BLOCKED_PROVIDERS = Object.freeze({
	// 36 "Cello" and 37 "Bass", both FIDL (fidl.tech): refused connections at
	// the same time on 2026-11-16, and hold every copy of some backups between
	// them. Taken out on Nico's word.
	mainnet: Object.freeze({ 36: 'fidl', 37: 'fidl' })
});

/** Why a provider is blocked on a network, or null. @param {string | null | undefined} network @param {number} id @returns {BlockReason | null} */
export const blockedReason = (network, id) => BLOCKED_PROVIDERS[network === 'mainnet' ? 'mainnet' : String(network ?? '')]?.[Number(id)] ?? null;

/** The blocked ones among `ids`. @param {string | null | undefined} network @param {number[]} ids */
export const blockedAmong = (network, ids) => ids.map(Number).filter((id) => blockedReason(network, id));
