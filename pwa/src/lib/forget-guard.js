// What may be forgotten when a builder is deleted (builder-publish.yml,
// action "delete" with "forget_volumes"): only the STOREs that builder's
// V-PROGRAM names as its volumes, and never an image.
//
// On 14 Nov 2026 a hand-written list of "builder volumes" forgot older
// Paperless images too, among them one a vault still started from. So a
// STORE is forgotten only when all of this holds; one refusal stops all of it.
// - The V-PROGRAM being deleted names it (workload, volume or a hash tree).
// - The account that sent the V-PROGRAM sent it, and Aleph has it processed.
// - It is smaller than any image: a builder's volumes are about 300 MB at
//   most, an encrypted Paperless image is about 940 MB.
// - Neither own-image.js nor any release names it.

/** Bigger than any builder volume, smaller than any Paperless image. */
export const BUILDER_VOLUME_MAX_BYTES = 600 * 1024 * 1024;

/**
 * The refs a V-PROGRAM's content names as its volumes.
 * @param {any} content the V-PROGRAM's content
 * @returns {string[]}
 */
export function volumeRefs(content) {
	const refs = [content?.workload?.ref, content?.workload?.hash_tree, ...(content?.volumes ?? []).flatMap((v) => [v?.ref, v?.hash_tree])];
	return [...new Set(refs.filter((r) => typeof r === 'string' && r.length > 0))];
}

/**
 * Why `store` must not be forgotten, or null when it may.
 * @param {{ hash: string, status?: string, type?: string, sender?: string, size?: number | null }} store
 * @param {{ account: string, named: Set<string>, kept: Set<string> }} o `named`: the STOREs the V-PROGRAM names; `kept`: hashes in own-image.js and in releases
 */
export function forgetRefusal(store, { account, named, kept }) {
	const h = store.hash;
	if (!/^[0-9a-f]{64}$/.test(h)) return `${h}: no item hash`;
	if (!named.has(h)) return `${h}: not a volume of the builder being deleted`;
	if (kept.has(h)) return `${h}: named in own-image.js or in a release`;
	if (store.type !== 'STORE' || store.status !== 'processed') return `${h}: not a processed STORE (${store.status} ${store.type})`;
	if (String(store.sender).toLowerCase() !== String(account).toLowerCase()) return `${h}: sent by ${store.sender}, not by ${account}`;
	if (typeof store.size !== 'number' || !(store.size > 0)) return `${h}: size unknown, so it might be an image`;
	if (store.size > BUILDER_VOLUME_MAX_BYTES) return `${h}: ${Math.round(store.size / 1e6)} MB, an image rather than a builder volume`;
	return null;
}

/**
 * The STOREs to forget, or the reasons not to forget any.
 * @param {Parameters<typeof forgetRefusal>[0][]} stores
 * @param {Parameters<typeof forgetRefusal>[1]} o
 * @returns {{ forget: string[], refused: string[] }}
 */
export function builderVolumesToForget(stores, o) {
	const refused = stores.map((s) => forgetRefusal(s, o)).filter((r) => r !== null);
	return refused.length ? { forget: [], refused } : { forget: stores.map((s) => s.hash), refused: [] };
}

// The STOREs of a retired builder version (image-retention.js): its plain
// image, its workload and volume and their hash trees. A STORE goes only when
// all of this holds; one refusal stops all of it.
// - Its file is one a retired version names, and no kept version names it
//   (through this STORE or another STORE of the same file).
// - Neither own-image.js on main nor a release still in use names the STORE.
// - The account that forgets sent it, and Aleph has it processed.
// - Its size is known and at most RETIRED_STORE_MAX_BYTES (a plain image is
//   about 880 MB). An encrypted Paperless image, the one a vault starts from,
//   is never in a builder version, so it is never on the list.

/** Larger than any plain image or builder volume so far. */
export const RETIRED_STORE_MAX_BYTES = 1024 * 1024 * 1024;

/**
 * Why `store` of a retired version must not be forgotten, or null when it may.
 * @param {{ hash: string, file?: string | null, status?: string, type?: string, sender?: string, size?: number | null }} store
 * @param {{ account: string, retiredFiles: Set<string>, keptFiles: Set<string>, kept: Set<string> }} o
 *   retiredFiles / keptFiles: the files the retired / kept versions' STOREs hold; kept: hashes named in own-image.js on main and in releases in use
 */
export function retiredStoreRefusal(store, { account, retiredFiles, keptFiles, kept }) {
	const h = store.hash;
	if (!/^[0-9a-f]{64}$/.test(h)) return `${h}: no item hash`;
	if (kept.has(h)) return `${h}: named in own-image.js on main or in a release in use`;
	if (store.type !== 'STORE' || store.status !== 'processed') return `${h}: not a processed STORE (${store.status} ${store.type})`;
	if (String(store.sender).toLowerCase() !== String(account).toLowerCase()) return `${h}: sent by ${store.sender}, not by ${account}`;
	if (!store.file) return `${h}: its file is unknown`;
	if (keptFiles.has(store.file) || kept.has(store.file)) return `${h}: its file ${store.file} belongs to a kept version`;
	if (!retiredFiles.has(store.file)) return `${h}: its file ${store.file} is not one of a retired version`;
	if (typeof store.size !== 'number' || !(store.size > 0)) return `${h}: size unknown`;
	if (store.size > RETIRED_STORE_MAX_BYTES) return `${h}: ${Math.round(store.size / 1e6)} MB, larger than any plain image or builder volume`;
	return null;
}

/**
 * The STOREs of retired versions to forget, or the reasons not to forget any.
 * @param {Parameters<typeof retiredStoreRefusal>[0][]} stores
 * @param {Parameters<typeof retiredStoreRefusal>[1]} o
 * @returns {{ forget: string[], refused: string[] }}
 */
export function retiredStoresToForget(stores, o) {
	const refused = stores.map((s) => retiredStoreRefusal(s, o)).filter((r) => r !== null);
	return refused.length ? { forget: [], refused } : { forget: stores.map((s) => s.hash), refused: [] };
}
