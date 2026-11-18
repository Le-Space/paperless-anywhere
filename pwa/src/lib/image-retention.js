// Which versions of Le Space's own-image builder keep their STOREs on Aleph
// (scripts/image-retention.mjs, .github/workflows/image-retention.yml).
//
// A version is one BUILDER in own-image.js: the plain image it seals (a STORE
// of Le Space's account) and the builder's workload and volume with their
// dm-verity hash trees (four STOREs). The newest `keep` versions stay, and so
// does every version a release still in use names: an app on an older release
// builds with the BUILDER of that release. A release is in use while it is the
// newest, and for `graceDays` after the next one was published.
//
// A vault's own image is a STORE of its own, sealed from the plain image at the
// build; a start reads that STORE and the passphrase derived from the plain
// image's SHA-256, never the plain STORE or a builder volume. A rebuild uses
// the BUILDER of the release the app runs. So once no release in use names a
// version, forgetting its STOREs changes no start and no build. What goes is
// the download of that version's plain image (docs/own-image.md, "Checking
// what your image is made from"); /own-image.json keeps listing the version.

const HEX64 = /^[0-9a-f]{64}$/;

/**
 * The BUILDER of an own-image.js source, or null when it fixes no builder
 * content (the builders before 2026-11-14).
 * @param {string} source the text of pwa/src/lib/own-image.js
 * @returns {{ roothash: string, plainSha256: string, plainStore: string | null, stores: string[] } | null}
 */
export function builderOf(source) {
	const start = source.indexOf('export const BUILDER = {');
	if (start < 0) return null;
	const end = source.indexOf('\n};', start);
	const block = source.slice(start, end < 0 ? undefined : end);
	const workload = /workload: \{\s*hash_tree: '([0-9a-f]{64})',\s*ref: '([0-9a-f]{64})',\s*roothash: '([0-9a-f]{64})'/.exec(block);
	const plain = /plain: \{\s*sha256: '([0-9a-f]{64})'(?:,\s*store: '([0-9a-f]{64})')?/.exec(block);
	if (!workload || !plain) return null;
	const volumes = [...block.slice(block.indexOf('volumes: [')).matchAll(/hash_tree: '([0-9a-f]{64})',\s*ref: '([0-9a-f]{64})',\s*roothash: '[0-9a-f]{64}'/g)]
		.filter((m) => m[2] !== workload[2])
		.flatMap((m) => [m[2], m[1]]);
	const stores = [...new Set([workload[2], workload[1], ...volumes, ...(plain[2] ? [plain[2]] : [])])];
	return { roothash: workload[3], plainSha256: plain[1], plainStore: plain[2] ?? null, stores };
}

/**
 * The versions in the history of own-image.js, oldest first, one per builder.
 * @param {Array<{ commit: string, at: string, source: string }>} history oldest first
 * @returns {Array<{ roothash: string, plainSha256: string, plainStore: string | null, stores: string[], since: string, commit: string }>}
 */
export function versionsFromHistory(history) {
	/** @type {Map<string, any>} */
	const byRoot = new Map();
	for (const { commit, at, source } of history) {
		const b = builderOf(source);
		if (!b) continue;
		const known = byRoot.get(b.roothash);
		if (known) known.stores = [...new Set([...known.stores, ...b.stores])];
		else byRoot.set(b.roothash, { ...b, since: at, commit });
	}
	return [...byRoot.values()].sort((a, b) => Date.parse(a.since) - Date.parse(b.since));
}

/**
 * The releases still in use: the newest, and each one whose successor came
 * out less than `graceDays` ago. `until` is when it stops being in use.
 * @template {{ tag: string, publishedAt: string }} R
 * @param {R[]} releases @param {{ now: number, graceDays: number }} o
 * @returns {Array<R & { until: string | null }>}
 */
export function releasesInUse(releases, { now, graceDays }) {
	const sorted = [...releases].sort((a, b) => Date.parse(a.publishedAt) - Date.parse(b.publishedAt));
	const grace = graceDays * 24 * 3600 * 1000;
	return sorted
		.map((r, i) => {
			const next = sorted[i + 1];
			return { ...r, until: next ? new Date(Date.parse(next.publishedAt) + grace).toISOString() : null };
		})
		.filter((r) => r.until === null || Date.parse(r.until) > now);
}

/**
 * Which versions stay and which may go.
 * @param {{
 *   versions: ReturnType<typeof versionsFromHistory>,
 *   current: string,
 *   releases: Array<{ tag: string, publishedAt: string, roothash: string | null }>,
 *   keep: number, graceDays: number, now: number
 * }} o current: the builder roothash on main; releases: each with the builder its own-image.js fixes
 * @returns {{ kept: Array<{ roothash: string, why: string[] }>, retired: Array<{ roothash: string, plainSha256: string, stores: string[], since: string }>, keptStores: Set<string> }}
 */
export function retentionPlan({ versions, current, releases, keep, graceDays, now }) {
	if (!Number.isInteger(keep) || keep < 1) throw new Error('keep: a whole number of at least 1');
	if (!(graceDays >= 0)) throw new Error('graceDays: zero or more');
	if (!HEX64.test(current) || !versions.some((v) => v.roothash === current)) throw new Error('the builder on main is not in the history');
	/** @type {Map<string, string[]>} */
	const why = new Map();
	const add = (/** @type {string} */ root, /** @type {string} */ reason) => why.set(root, [...(why.get(root) ?? []), reason]);
	add(current, 'the builder on main');
	const newest = [...versions].reverse().slice(0, keep);
	for (const v of newest) add(v.roothash, `one of the newest ${keep}`);
	/** @type {Map<string, Array<ReturnType<typeof releasesInUse<typeof releases[number]>>[number]>>} */
	const byRoot = new Map();
	for (const r of releasesInUse(releases, { now, graceDays })) if (r.roothash) byRoot.set(r.roothash, [...(byRoot.get(r.roothash) ?? []), r]);
	for (const [root, rs] of byRoot) {
		const tags = rs.length > 1 ? `releases ${rs[0].tag} to ${rs[rs.length - 1].tag}` : `release ${rs[0].tag}`;
		const last = rs[rs.length - 1].until;
		add(root, last ? `${tags} in use until ${last.slice(0, 10)}` : `${tags}, the newest, in use`);
	}
	// A release whose own-image.js names a builder the history does not know
	// is still protected: nothing of an unknown version is forgotten anyway.
	const kept = versions.filter((v) => why.has(v.roothash)).map((v) => ({ roothash: v.roothash, why: /** @type {string[]} */ (why.get(v.roothash)) }));
	const keptStores = new Set(versions.filter((v) => why.has(v.roothash)).flatMap((v) => v.stores));
	const retired = versions
		.filter((v) => !why.has(v.roothash))
		.map((v) => ({ roothash: v.roothash, plainSha256: v.plainSha256, since: v.since, stores: v.stores.filter((s) => !keptStores.has(s)) }));
	return { kept, retired, keptStores };
}

/**
 * The id of a list of STOREs to forget: the dry run prints it, and the
 * forgetting run must be given the same id, so it forgets exactly that list.
 * @param {string[]} hashes
 */
export async function listId(hashes) {
	const text = [...hashes].sort().join('\n');
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
	return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
}
