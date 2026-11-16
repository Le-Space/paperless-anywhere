// An own image replaced by a newer build is kept until the newer one has
// started well: attested, unlocked, Paperless answering, and any restore
// done. Until then it is the way back ("mit dem vorherigen Image starten").
// After a good start it is forgotten; a FORGET that fails is kept in the
// profile and tried again at the next opening, or by hand in the setup.
// Nothing here forgets an image a VM or a start uses, or one this vault did
// not store (forgetOldImage in own-image-build.js checks the sender).

/**
 * The image fields a profile starts from, to keep as the way back.
 * @param {Record<string, any>} profile
 */
const imageOf = (profile) => ({
	rootfsItemHash: profile.rootfsItemHash,
	luksPassphrase: profile.luksPassphrase,
	luksFor: profile.luksFor,
	ownImage: profile.ownImage ? { ...profile.ownImage, previous: undefined } : null
});

/**
 * What a new build's profile fields become: the image it replaces is kept as
 * `ownImage.previous`. Built twice before a good start, the older way back
 * stays, and the one in between (never started well) is queued to forget.
 * @param {Record<string, any>} profile before the build
 * @param {Record<string, any>} built the build's fields (rootfsItemHash, luksPassphrase, luksFor, ownImage)
 * @returns {Record<string, any>} the fields to save
 */
export function keepPrevious(profile, built) {
	const old = profile?.ownImage && profile.rootfsItemHash && profile.rootfsItemHash !== built.rootfsItemHash ? profile.rootfsItemHash : null;
	if (!old) return built;
	const earlier = profile.ownImage.previous;
	const previous = earlier ?? imageOf(profile);
	const queue = earlier ? [...(profile.oldOwnImages ?? []), old] : profile.oldOwnImages ?? [];
	return { ...built, ownImage: { ...built.ownImage, previous }, ...(queue.length ? { oldOwnImages: [...new Set(queue)] } : {}) };
}

/**
 * After a start: was it good enough to give up the way back?
 * @param {any} running what the start returned (lifecycle.js bringUp)
 */
export const startWentWell = (running) => Boolean(running?.instanceHash) && running?.restore?.status !== 'failed';

/**
 * Once the new image started well: the way back goes into the queue to forget.
 * @param {Record<string, any>} profile @returns {Record<string, any> | null} the patch, or null
 */
export function releasePrevious(profile) {
	const prev = profile?.ownImage?.previous?.rootfsItemHash;
	if (!prev) return null;
	const { previous, ...ownImage } = profile.ownImage;
	return { ownImage, oldOwnImages: [...new Set([...(profile.oldOwnImages ?? []), prev])] };
}

/**
 * The queued images that may be forgotten now: never the one the profile
 * starts from, the way back, or one a start or a running VM uses.
 * @param {Record<string, any>} profile
 */
export function forgettable(profile) {
	const inUse = new Set([profile?.rootfsItemHash, profile?.ownImage?.previous?.rootfsItemHash, profile?.running?.rootfsItemHash, profile?.starting?.rootfsItemHash].filter(Boolean));
	return (profile?.oldOwnImages ?? []).filter((h) => /^[0-9a-f]{64}$/.test(h) && !inUse.has(h));
}

/**
 * Forget what may be forgotten; resolves to the queue that stays (those
 * that failed, and those still in use).
 * @param {Record<string, any>} profile
 * @param {(store: string) => Promise<boolean>} forget true when forgotten
 * @returns {Promise<string[]>}
 */
export async function forgetQueued(profile, forget) {
	const now = forgettable(profile);
	const done = new Set();
	for (const h of now) if (await forget(h).catch(() => false)) done.add(h);
	return (profile?.oldOwnImages ?? []).filter((h) => !done.has(h));
}

/**
 * Start from the way back: the previous image becomes the one to start, and
 * the newer one is kept as the way back in turn (nothing is lost).
 * @param {Record<string, any>} profile @returns {Record<string, any> | null}
 */
export function fallbackPatch(profile) {
	const prev = profile?.ownImage?.previous;
	if (!prev?.rootfsItemHash) return null;
	return { ...prev, ownImage: { ...(prev.ownImage ?? {}), previous: imageOf(profile) } };
}
