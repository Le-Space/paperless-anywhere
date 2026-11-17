// The backups the VM may restore, read from the chain: the backup wallet's
// data sets with the backup tool's label, their active pieces, the providers
// that hold each. No ledger and no key needed; the VM checks the piece it
// downloads against its piece CID (the content address).
import { createPublicClient, http } from 'viem';
import { getAllDataSetMetadata, getClientDataSets, getPdpDataSets } from '@filoz/synapse-core/warm-storage';
import { dataSetLive, getActivePiecesByCursor } from '@filoz/synapse-core/pdp-verifier';
import { getPDPProvidersByIds } from '@filoz/synapse-core/sp-registry';
import { tryFrom as pieceFrom } from '@filoz/synapse-core/piece';
import { filecoinChain } from './permissions.js';
import { markSnapshots, snapshotRestoreEntry, snapshotsFromPieces } from './snapshots.js';
import { format, tr } from './i18n/index.js';

/** The data-set label paperless-backup-filecoin writes, per network. */
export const BACKUP_LABEL = { mainnet: 'paperless-backup', calibration: 'paperless-backup-test' };

/**
 * paperless-backup-filecoin uploads a sealed export above this many bytes in
 * parts (its parts.mjs): every part but the last is exactly this long, and
 * all parts go into one data set in one AddPieces, in order.
 */
export const PART_BYTES = 1_000_000_000;

/** A piece's payload size, which its CID (v2) carries; null when it does not. @param {any} cid */
export function pieceSize(cid) {
	try {
		const size = pieceFrom(cid)?.size;
		return Number.isSafeInteger(size) ? size : null;
	} catch {
		return null;
	}
}

const cidText = (cid) => (typeof cid === 'string' ? cid : (cid?.toString?.() ?? cid?.['/'] ?? ''));

/**
 * The data sets that hold this vault's backups: live, with the backup tool's
 * label, and, when Le Space's one payer owns them for every customer, with
 * this account's tag as `customer` (backups paid through Le Space Credits).
 * @param {any[]} items the owner's data sets
 * @param {{ label: string, customer?: string | null }} want
 */
export function backupDataSets(items, { label, customer = null }) {
	return items.filter((ds) => {
		let meta;
		try {
			meta = typeof ds.metadata === 'string' ? JSON.parse(ds.metadata || '{}') : (ds.metadata ?? {});
		} catch {
			return false;
		}
		return ds.live !== false && meta?.app === label && (customer == null || meta?.customer === customer);
	});
}

/** Pages of an owner's data sets read at most, 100 each, while looking for this account's ids. */
export const MAX_DATA_SET_PAGES = 50;

/**
 * The owner's data sets whose client data set id is one of `ids` (the ids
 * Le Space Credits signed for this account), read page by page until all are
 * found. Le Space's payer owns every customer's data sets: reading only
 * their ids is cheap, and only this account's are read in full afterwards.
 * @param {(cursor: bigint | undefined) => Promise<{ items: any[], nextCursor?: bigint }>} readPage
 * @param {string[]} ids decimal client data set ids
 * @param {{ maxPages?: number }} [options]
 */
export async function dataSetsByClientIds(readPage, ids, { maxPages = MAX_DATA_SET_PAGES } = {}) {
	const want = new Set(ids.map(String));
	const found = [];
	let cursor;
	for (let page = 0; want.size && page < maxPages; page++) {
		const { items, nextCursor } = await readPage(cursor);
		for (const ds of items) {
			const id = String(ds.clientDataSetId);
			if (want.delete(id)) found.push(ds);
		}
		if (nextCursor == null) break;
		cursor = nextCursor;
	}
	return found;
}

/**
 * One data set's pieces as backups: in piece-id order, a run of full parts
 * (exactly PART_BYTES each) and the piece that ends it are one backup in
 * parts; any other piece is a backup of its own.
 * @param {Array<{ cid: any, id: any }>} pieces
 * @param {(cid: string) => number | null} [sizeOf] a piece's payload size (from its CID)
 * @returns {Array<{ parts: Array<{ pieceCid: string, size: number | null }>, order: number, pieceIds: string[] }>}
 */
export function groupPieces(pieces, sizeOf = pieceSize) {
	const sorted = [...pieces].sort((a, b) => (BigInt(a.id) < BigInt(b.id) ? -1 : BigInt(a.id) > BigInt(b.id) ? 1 : 0));
	const groups = [];
	let run = [];
	let ids = [];
	let order = 0;
	for (const p of sorted) {
		const pieceCid = cidText(p.cid);
		const size = sizeOf(pieceCid);
		run.push({ pieceCid, size });
		ids.push(String(p.id));
		order = Number(p.id);
		if (size !== PART_BYTES) {
			groups.push({ parts: run, order, pieceIds: ids });
			run = [];
			ids = [];
		}
	}
	if (run.length) groups.push({ parts: run, order, pieceIds: ids });
	return groups;
}

/**
 * An order of `keys`, oldest first, that follows every sequence (each one
 * oldest first); where no sequence decides, the lower `fallback` comes first.
 * Returns each key's place (0 = oldest). A cycle cannot arise from piece ids;
 * should one, the rest go by `fallback`.
 * @param {string[]} keys @param {string[][]} sequences @param {(key: string) => number} fallback
 * @returns {Map<string, number>}
 */
export function chainOrder(keys, sequences, fallback) {
	const after = new Map(keys.map((k) => [k, new Set()]));
	const before = new Map(keys.map((k) => [k, 0]));
	for (const seq of sequences)
		for (let i = 1; i < seq.length; i++) {
			const a = seq[i - 1], b = seq[i];
			if (a === b || after.get(a).has(b)) continue;
			after.get(a).add(b);
			before.set(b, before.get(b) + 1);
		}
	const ready = keys.filter((k) => before.get(k) === 0);
	const out = new Map();
	while (out.size < keys.length) {
		if (!ready.length) ready.push(...keys.filter((k) => !out.has(k) && !ready.includes(k)));
		ready.sort((a, b) => fallback(a) - fallback(b));
		const k = ready.shift();
		if (out.has(k)) continue;
		out.set(k, out.size);
		for (const n of after.get(k)) {
			before.set(n, before.get(n) - 1);
			if (before.get(n) === 0 && !out.has(n)) ready.push(n);
		}
	}
	return out;
}

/** Room for the piece ids of one data set in a backup's order (data set id × span + piece id). */
export const ORDER_SPAN = 1_000_000;

/**
 * The backups on chain, from each data set's pieces: a backup in parts is
 * one backup, whose size is the sum of its parts, and a data set holds a copy
 * of it only with every part. A data set that holds just some of a backup's
 * parts (one an older tool pruned, or a provider lost) holds no copy of it.
 * Newest first; complete when every data set holds it. A copy names its
 * data set and the ids of its pieces there when the set says which it is
 * (what backup-chain.js reads the proofs of).
 * @param {Array<{ providerId: any, dataSetId?: any, pieces: Array<{ cid: any, id: any }> }>} sets
 * @param {{ urlOf: (providerId: any) => string | undefined, placeOf?: (providerId: any) => string, sizeOf?: (cid: string) => number | null }} where
 */
export function backupsFromPieces(sets, { urlOf, placeOf = () => '', sizeOf = pieceSize }) {
	const byKey = new Map();
	// Snapshots (incremental backups, pieces with `snapshot` metadata): grouped
	// by generation and number (snapshots.js), never by size.
	const { snapshots } = snapshotsFromPieces(sets, { urlOf, placeOf, sizeOf, cidText });
	const snapOrder = new Map();
	/** @type {string[][]} */
	const sequences = [];
	for (const ds of sets) {
		// The fallback for backups no shared data set orders: newer data sets
		// first (a move to other providers starts new ones), then the piece id.
		const setRank = Number.isFinite(Number(ds.dataSetId)) ? Number(ds.dataSetId) : 0;
		/** @type {Array<[number, string]>} piece id, key */
		const inSet = [];
		for (const g of groupPieces(ds.pieces.filter((p) => !p.snapshot), sizeOf)) {
			const key = g.parts.map((p) => p.pieceCid).join(' ');
			const entry = byKey.get(key) ?? { parts: g.parts, order: 0, holders: [] };
			entry.order = Math.max(entry.order, setRank * ORDER_SPAN + g.order);
			inSet.push([g.order, key]);
			entry.holders.push({ providerId: ds.providerId, dataSetId: ds.dataSetId, pieceIds: g.pieceIds });
			byKey.set(key, entry);
		}
		const last = new Map();
		for (const p of ds.pieces) if (p.snapshot) {
			const key = `snap:${p.snapshot.gen}/${p.snapshot.seq}`;
			last.set(key, Math.max(last.get(key) ?? 0, Number(p.id)));
		}
		for (const [key, id] of last) {
			inSet.push([id, key]);
			snapOrder.set(key, Math.max(snapOrder.get(key) ?? 0, setRank * ORDER_SPAN + id));
		}
		sequences.push(inSet.sort((a, b) => a[0] - b[0]).map(([, key]) => key));
	}
	const snapByKey = new Map(snapshots.map((b) => [b.key, b]));
	for (const k of snapOrder.keys()) if (!snapByKey.has(k)) snapOrder.delete(k);
	// Newest by time: within one data set the piece ids follow time, so each
	// set orders its backups; sets that share a backup chain those orders
	// together (a backup added to an old set after the old ones, and to new
	// sets at piece 0, is still the newest). Only what no shared set decides
	// falls back to the data set's id.
	const known = (k) => byKey.has(k) || snapOrder.has(k);
	const ranked = chainOrder([...byKey.keys(), ...snapOrder.keys()], sequences.map((q) => q.filter(known)), (k) => byKey.get(k)?.order ?? snapOrder.get(k));
	for (const [k, i] of ranked) {
		if (byKey.has(k)) byKey.get(k).order = i;
		else snapByKey.get(k).order = i;
	}
	const all = [...byKey.values()];
	const cids = all.map((b) => new Set(b.parts.map((p) => p.pieceCid)));
	// A fragment: some parts of a longer backup, never a backup of its own
	// (a lone piece below PART_BYTES is one, also when another set glued it on).
	const fragment = (i) =>
		(all[i].parts.length > 1 || all[i].parts[0].size === PART_BYTES) &&
		cids.some((other, j) => j !== i && other.size > cids[i].size && [...cids[i]].every((c) => other.has(c)));
	return all
		.filter((_, i) => !fragment(i))
		.map((b) => {
			const copies = b.holders.flatMap(({ providerId, dataSetId, pieceIds }) => {
				const base = urlOf(providerId);
				if (!base) return [];
				const urls = b.parts.map((p) => `${base}/piece/${p.pieceCid}`);
				return [
					{
						providerId: String(providerId),
						retrievalUrl: urls[0],
						...(b.parts.length > 1 ? { retrievalUrls: urls } : {}),
						place: placeOf(providerId),
						...(dataSetId != null ? { dataSetId: String(dataSetId), pieceIds } : {})
					}
				];
			});
			const sizes = b.parts.map((p) => p.size);
			return {
				pieceCid: b.parts[0].pieceCid,
				...(b.parts.length > 1 ? { parts: b.parts } : {}),
				size: sizes.every((n) => n != null) ? sizes.reduce((a, n) => a + n, 0) : null,
				copies,
				complete: copies.length >= sets.length,
				order: b.order
			};
		})
		.concat([...snapByKey.values()].filter((b) => snapOrder.has(b.key)).map(({ key: _, ...b }) => b))
		.sort((a, b) => b.order - a.order);
}

/**
 * Newest first. A backup is complete when every labelled data set holds it
 * (all its parts, for a backup in parts).
 * `customer`: only data sets with this tag (the owner is Le Space's payer).
 * `dataSetIds`: the client data set ids Le Space Credits list for this
 * account; the data sets are picked by them, then checked by label and tag.
 * @param {{ network: string, owner: string, label?: string, customer?: string | null, dataSetIds?: string[] | null }} a
 * @returns {Promise<Array<{ pieceCid: string, parts?: Array<{ pieceCid: string, size: number | null }>, size: number | null, copies: Array<{ providerId: string, retrievalUrl: string, retrievalUrls?: string[], place: string, dataSetId?: string, pieceIds?: string[] }>, complete: boolean, order: number }>>}
 */
export async function listBackups({ network, owner, label, customer = null, dataSetIds = null }) {
	const want = label ?? BACKUP_LABEL[network === 'mainnet' ? 'mainnet' : 'calibration'];
	const client = createPublicClient({ chain: filecoinChain(network), transport: http(undefined, { retryCount: 1, timeout: 20_000 }) });
	const address = /** @type {`0x${string}`} */ (owner);
	let items;
	if (dataSetIds) {
		const picked = await dataSetsByClientIds((cursor) => getClientDataSets(client, { address, ...(cursor == null ? {} : { cursor }) }), dataSetIds);
		items = await Promise.all(
			picked.map(async (ds) => ({
				...ds,
				live: await dataSetLive(client, { dataSetId: ds.dataSetId }),
				metadata: await getAllDataSetMetadata(client, { dataSetId: ds.dataSetId })
			}))
		);
	} else {
		({ items } = await getPdpDataSets(client, { address }));
	}
	const sets = backupDataSets(items, { label: want, customer });
	if (!sets.length) return [];
	const providers = await getPDPProvidersByIds(client, { providerIds: [...new Set(sets.map((ds) => BigInt(ds.providerId)))] });
	const byId = (id) => providers.find((p) => String(p.id) === String(id));
	const withPieces = [];
	for (const ds of sets) {
		const dataSetId = BigInt(ds.dataSetId ?? ds.id);
		const { items: pieces } = await getActivePiecesByCursor(client, { dataSetId });
		withPieces.push({ providerId: ds.providerId, dataSetId, pieces: pieces.map((p) => ({ ...p, snapshot: null })) });
	}
	// Which backups are snapshot packs (incremental backups): their first bytes, from a provider.
	await markSnapshots(withPieces, { baseOf: (id) => byId(id)?.pdp?.serviceURL?.replace(/\/+$/, ''), groups: (pieces) => groupPieces(pieces), cidText });
	return backupsFromPieces(withPieces, {
		urlOf: (id) => byId(id)?.pdp?.serviceURL?.replace(/\/+$/, ''),
		placeOf: (id) => place(byId(id)?.pdp?.location)
	});
}

/**
 * What paperless-restore takes for a chain-listed backup: no SHA-256, the
 * piece CID is the check. A backup in parts adds, as the backup tool's ledger
 * does, `parts` (piece CID and size, in order) and per copy `retrievalUrls`,
 * one per part; images before parts read only `pieceCid`, the first part, and
 * fail on it ("age could not decrypt the piece").
 */
export function restoreEntry(backup) {
	if (backup?.kind === 'snapshot') return snapshotRestoreEntry(backup);
	const entry = { name: `backup-${backup.pieceCid.slice(-12)}`, pieceCid: backup.pieceCid, copies: backup.copies.map((c) => ({ retrievalUrl: c.retrievalUrl })) };
	if (!(backup.parts?.length > 1)) return entry;
	return {
		...entry,
		...(backup.size != null ? { size: backup.size } : {}),
		parts: backup.parts.map((p) => ({ pieceCid: p.pieceCid, ...(p.size != null ? { size: p.size } : {}) })),
		copies: backup.copies.map((c) => ({ retrievalUrl: c.retrievalUrl, retrievalUrls: c.retrievalUrls ?? backup.parts.map((p) => c.retrievalUrl.replace(/[^/]+$/, p.pieceCid)) }))
	};
}

/**
 * The newest restorable backup that came after the one `entry` names, or null:
 * what a start carried on later must restore instead, so that it does not go
 * back behind backups the VM made in between. `backups` is newest first, as
 * listBackups() returns it; an entry the list does not know stays as it is.
 * @param {Array<{ pieceCid: string, copies: any[], order: number }>} backups
 * @param {{ pieceCid?: string } | null | undefined} entry
 * @param {(b: any) => boolean} [eligible] which backups may take its place (those with the vault's mark)
 */
export function newerBackup(backups, entry, eligible = () => true) {
	const chosen = entry?.pieceCid ? backups.find((b) => b.pieceCid === entry.pieceCid) : null;
	if (!chosen) return null;
	return backups.find((b) => b.order > chosen.order && b.copies.length > 0 && eligible(b)) ?? null;
}

/**
 * The piece CID of the last backup the sealed profile knows (the one the last
 * stop made), or null: what a start must not silently go back behind. Null
 * when that backup was made in another network than the profile's now.
 * @param {Record<string, any>} profile
 */
export function knownBackup(profile) {
	const network = profile?.network ?? 'calibration';
	if (profile?.lastBackup?.network && profile.lastBackup.network !== network) return null;
	return profile?.lastGoodBackup?.pieceCid ?? profile?.lastBackup?.pieceCid ?? null;
}

/**
 * How a start with `chosen` (or with nothing) falls short of the backup the
 * profile knows: 'missing' when the list read from the chain does not hold
 * that backup at all, 'older' when `chosen` came before it, null when all is
 * well (also without a known backup, and for a start chosen to be empty while
 * the known backup is listed).
 * @param {Array<{ pieceCid: string, order: number }>} backups as listBackups() returns them
 * @param {{ pieceCid: string, order: number } | null | undefined} chosen
 * @param {string | null | undefined} known
 * @returns {'missing' | 'older' | null}
 */
export function restoreGap(backups, chosen, known) {
	if (!known) return null;
	const last = backups.find((b) => b.pieceCid === known);
	if (!last) return 'missing';
	return chosen && chosen.order < last.order ? 'older' : null;
}

/** "2,1 GB" for a backup's size, or "" when the chain did not tell it. @param {number | null | undefined} bytes */
export const backupSize = (bytes) => (typeof bytes === 'number' ? gb(bytes) : '');

/**
 * Where backups go until the person chooses: the two Calibration providers
 * approved on 2026-10-31 (4 was approved before and no longer is; a backup
 * that names it fails with "provider 4 is not (or no longer) approved").
 */
export const DEFAULT_PLACES = Object.freeze({ copies: 2, providerIds: [9, 2], regions: [] });

/**
 * On mainnet three operators: 43 (ProbeLab, Helsinki), 1 (ezpdpz, Cheltenham)
 * and 38 (Brown Storage, Southampton). Not 36 and 37: both FIDL, both down on
 * 2026-11-16, and blocked since (blocked-providers.js).
 */
export const DEFAULT_PLACES_MAINNET = Object.freeze({ copies: 3, providerIds: [43, 1, 38], regions: [] });

/** @param {string} network */
export const defaultPlaces = (network) => (network === 'mainnet' ? DEFAULT_PLACES_MAINNET : DEFAULT_PLACES);

/**
 * The backup configuration the VM gets with its unlock (paperless-backup's
 * config.json without the payer, which the start adds). On mainnet it writes
 * to the data sets of the Mac's backups (label `paperless-backup`), so both
 * show up in one list; the guest backs up to mainnet only as a primary.
 * @param {string} network @param {string} recipient age1… of the profile's identity
 * @param {{ copies?: number, providerIds?: number[], regions?: string[] } | null} [places] copies and where, e.g. the current backupConfig
 */
export function backupConfigFor(network, recipient, places = defaultPlaces(network)) {
	if (network !== 'calibration' && network !== 'mainnet') throw new Error(tr().backup.config.unknownNetwork(network));
	if (!/^age1[0-9a-z]{58}$/.test(recipient)) throw new Error(tr().backup.config.noAgeKey);
	const { copies, providerIds, regions } = { ...defaultPlaces(network), ...(places ?? {}) };
	const ids = [...(providerIds ?? [])].map(Number);
	if (!ids.length && !(copies >= 1 && copies <= 3)) throw new Error(tr().backup.config.copiesRange);
	if (ids.length > 3) throw new Error(tr().backup.config.maxProviders);
	const retention = retentionFor(network, places?.retention);
	// Incremental backups (snapshots): off unless the places say so.
	const incremental = places?.incremental?.enabled === true ? { incremental: { enabled: true } } : {};
	return { copies: ids.length || copies, providerIds: ids, regions: [...(regions ?? [])], datasetMetadata: { app: BACKUP_LABEL[network] }, keepWeeks: network === 'mainnet' ? 12 : 1, retention, ageRecipient: recipient, ...incremental };
}

/**
 * What the backup tool keeps (its `retain`, after each complete backup; it
 * removes when Le Space Credits sign, and with a wallet's session key it only
 * plans): the last `keepLast` backups and the newest of each day, ISO week and month of the
 * last `keepDays` days, `keepWeeks` weeks and `keepMonths` months. Never the
 * newest complete backup, never the one the VM was restored from, never the
 * newest of a data set, never one whose date is unknown.
 */
export const DEFAULT_RETENTION = Object.freeze({
	mainnet: Object.freeze({ keepLast: 3, keepDays: 7, keepWeeks: 4, keepMonths: 6 }),
	calibration: Object.freeze({ keepLast: 2, keepDays: 2, keepWeeks: 1, keepMonths: 0 })
});

/** Le Space Credits' backup quota per data set (products.js, quotaBytes). */
export const CREDITS_QUOTA_BYTES = 32 * 2 ** 30;

/**
 * The retention of a backup config: the network's defaults, with what the
 * person set (whole numbers, keepLast at least 1). Throws on a bad value.
 * @param {string} network @param {Record<string, any> | null | undefined} set
 */
export function retentionFor(network, set) {
	const r = { ...DEFAULT_RETENTION[network === 'mainnet' ? 'mainnet' : 'calibration'] };
	for (const k of /** @type {const} */ (['keepLast', 'keepDays', 'keepWeeks', 'keepMonths'])) {
		if (set?.[k] == null) continue;
		const n = Number(set[k]);
		if (!Number.isInteger(n) || n < (k === 'keepLast' ? 1 : 0) || n > 1000) throw new Error(tr().backup.config.retentionRange(k));
		r[k] = n;
	}
	return r;
}

/**
 * The plain images (SHA-256, as BUILDER.plain.sha256 and a profile's
 * ownImage.plainSha256 name them) whose backup tool makes incremental backups
 * the way the app and the chain read them: paperless-backup-filecoin from
 * f4df5d7 (#17, packs with the public PA-SNAP/1 prefix) on. Older images
 * ignore the switch (before #16) or make packs without that prefix (#16
 * alone), which `retain` and this app cannot tell from full backups. Add an
 * image here once it is built with such a tool; until then the switch stays
 * off and greyed out.
 * @type {readonly string[]}
 */
export const INCREMENTAL_IMAGES = Object.freeze([
	// Plain image of main edb44b4, backup tool f4df5d7 (2026-11-17).
	'1657c6a5ad6480f59c66e1e03841905e6ed0627b6c16da3d0c8c8d24c4bbd0ac'
]);

/**
 * Can the image the VM starts from make incremental backups? Its own image
 * (built from a plain image) must be one of INCREMENTAL_IMAGES.
 * @param {Record<string, any> | null | undefined} profile @param {readonly string[]} [images]
 */
export const supportsIncremental = (profile, images = INCREMENTAL_IMAGES) => {
	const plain = profile?.ownImage?.plainSha256;
	return typeof plain === 'string' && images.includes(plain);
};

/** What an image before 2026-11-16 downloads at most of one part (paperless-restore, curl --max-filesize). */
export const OLD_PART_LIMIT = 1_000_000_000;
/**
 * The plain images whose restore takes a full part of the backup tool
 * (1,000,000,000 bytes before encryption, a little more as stored): rootfs
 * from 9d2da9b on. Older ones stop at OLD_PART_LIMIT, so a backup with such
 * a part never arrives there (2026-11-17: a start sat silent while the VM
 * tried in vain).
 * @type {readonly string[]}
 */
export const FULL_PART_IMAGES = Object.freeze([
	// Plain image of main edb44b4 (2026-11-17).
	'1657c6a5ad6480f59c66e1e03841905e6ed0627b6c16da3d0c8c8d24c4bbd0ac'
]);

/**
 * Whether the VM's image can restore `entry`: always, unless one of its parts
 * is larger than OLD_PART_LIMIT and the image is not one of FULL_PART_IMAGES.
 * @param {Record<string, any> | null | undefined} profile @param {any} entry the restore entry (restoreEntry())
 * @param {readonly string[]} [images]
 */
export function restoreFitsImage(profile, entry, images = FULL_PART_IMAGES) {
	const sizes = [...(entry?.parts ?? []).map((/** @type {any} */ p) => p?.size), ...(entry?.parts?.length ? [] : [entry?.size])];
	if (!sizes.some((n) => typeof n === 'number' && n > OLD_PART_LIMIT)) return true;
	const plain = profile?.ownImage?.plainSha256;
	return typeof plain === 'string' && images.includes(plain);
}

/**
 * The piece CIDs of every part of the backup a VM is restored from: the tool
 * never removes it (retention.protect).
 * @param {any} entry the restore entry (restoreEntry())
 * @returns {string[]}
 */
export function protectedPieces(entry) {
	if (!entry?.pieceCid) return [];
	// A snapshot: every pack it builds on.
	const packs = Array.isArray(entry.packs) ? entry.packs.flatMap((p) => (Array.isArray(p?.parts) ? p.parts.map((x) => String(x?.pieceCid ?? '')) : [])) : [];
	return [...new Set([String(entry.pieceCid), ...(Array.isArray(entry.parts) ? entry.parts.map((p) => String(p?.pieceCid ?? '')) : []), ...packs])].filter((c) => /^(baga|bafk)[a-z2-7]{20,}$/.test(c));
}

/**
 * What the VM gets for its backups with the unlock: `backup_config`
 * (paperless-backup-filecoin's config.json) and the key it signs with.
 * - Wallet path: the wallet is the payer, the VM gets the session key the
 *   wallet authorized (`backup_session_key`, SESSION_KEY_FILE on the VM).
 * - Le Space Credits: Le Space's one payer pays, its session key (`signer`)
 *   signs each step after the service's checks; the VM asks for it with its
 *   own backup key (`backup_key`, BACKUP_KEY_FILE on the VM), and its config
 *   names the service in `remoteSigner`.
 * Empty without a backup configuration. Throws when the credits path lacks
 * the service's answer or it is for another network.
 * @param {Record<string, any>} profile
 * @param {{ sessionKey?: string, backupKey?: string, signer?: { payer: string, signer: string, tag: string, label: string, network: string } | null, creditsUrl?: string, product?: string, account?: string, incrementalImages?: readonly string[] }} k
 * @returns {Record<string, string>}
 */
export function vmBackupSecrets(profile, { sessionKey, backupKey, signer, creditsUrl, product, account, incrementalImages = INCREMENTAL_IMAGES }) {
	if (!profile.backupConfig) return {};
	// Incremental backups only reach a VM whose image brings a tool that can
	// make them (supportsIncremental); any other keeps making full backups.
	if (profile.backupConfig.incremental && !supportsIncremental(profile, incrementalImages)) {
		const { incremental: _, ...full } = profile.backupConfig;
		profile = { ...profile, backupConfig: full };
	}
	const network = profile.network === 'mainnet' ? 'mainnet' : 'calibration';
	if (!profile.backupsByCredits) {
		// The tool plans retention here and reports it; only the wallet removes.
		const retention = { ...retentionFor(network, profile.backupConfig.retention), protect: protectedPieces(profile.restoreEntry) };
		return {
			backup_config: JSON.stringify({ ...profile.backupConfig, retention, payer: profile.payer, network }),
			backup_session_key: String(sessionKey)
		};
	}
	if (!signer) throw new Error(tr().backup.config.signerNotReleased);
	if (signer.network !== network) throw new Error(tr().backup.config.signerNetwork(signer.network, network));
	if (!creditsUrl || !account || !product || !backupKey) throw new Error(tr().backup.config.signerIncomplete);
	const { payer, tag, label } = signer;
	// Retention runs on the VM only here (the service signs removals): within
	// the quota, never the backup this VM is restored from.
	const retention = {
		...retentionFor(network, profile.backupConfig.retention),
		maxBytes: CREDITS_QUOTA_BYTES,
		protect: protectedPieces(profile.restoreEntry)
	};
	return {
		backup_config: JSON.stringify({
			...profile.backupConfig,
			retention,
			datasetMetadata: { ...(profile.backupConfig.datasetMetadata ?? {}), app: label, customer: tag },
			payer,
			network,
			remoteSigner: { creditsUrl, product, account, payer, signer: signer.signer, tag, label }
		}),
		backup_key: String(backupKey)
	};
}

/**
 * The piece CID of the backup a stop made, from the VM's status page
 * (stop.backup is backup.json: { status, backup: { pieceCid, … } }).
 * @param {any} status
 */
export function pieceCidOfStop(status) {
	const b = status?.stop?.backup ?? status?.backup;
	return b?.backup?.pieceCid ?? b?.pieceCid ?? null;
}

/**
 * The piece CIDs a VM's status page reports with a vault mark: its list of
 * every backup it made (backupMarks), and the mark on the backup a stop, a
 * "Back up now" or the last check made. Unchecked: vaultBound() checks them.
 * @param {any} status
 * @returns {Array<{ pieceCid: string, mark: string }>}
 */
export function reportedMarks(status) {
	const out = [];
	const add = (/** @type {any} */ pieceCid, /** @type {any} */ mark) => {
		if (typeof pieceCid === 'string' && typeof mark === 'string') out.push({ pieceCid, mark });
	};
	for (const m of Array.isArray(status?.backupMarks) ? status.backupMarks : []) add(m?.pieceCid, m?.mark);
	for (const b of [status?.stop?.backup, status?.backup, status?.lastBackup, status?.backupRequest?.backup]) add(b?.backup?.pieceCid, b?.backup?.vaultMark);
	return out;
}

/**
 * Of what a VM reports, the piece CIDs whose mark is this vault's: only a VM
 * this vault unlocked holds the key (`markOf`, pieceMark with the master).
 * @param {Array<{ pieceCid: string, mark: string }>} reported
 * @param {(pieceCid: string) => string} markOf
 */
export const vaultBound = (reported, markOf) => [...new Set(reported.filter((r) => r.mark.toLowerCase() === markOf(r.pieceCid)).map((r) => r.pieceCid))];

/**
 * The profile's list of this vault's backups with `found` added in front,
 * newest first, at most `max`; the same list (===) when nothing is new.
 * @param {string[] | undefined} known @param {string[]} found
 */
export function withVaultBackups(known = [], found, max = 200) {
	const fresh = found.filter((c) => !known.includes(c));
	return fresh.length ? [...fresh, ...known].slice(0, max) : known;
}

/** Backups split into this vault's own (newest first) and the rest. @param {any[]} backups @param {string[]} own */
export function splitOwn(backups, own = []) {
	const mine = new Set(own);
	return { own: backups.filter((b) => mine.has(b.pieceCid)), other: backups.filter((b) => !mine.has(b.pieceCid)) };
}

/** "C=GB;ST=Gloucestershire;L=Cheltenham" (a provider's declared location) as "GB, Cheltenham". @param {string} [location] */
export function place(location) {
	const parts = Object.fromEntries(String(location ?? '').split(';').map((p) => p.split('=')).filter((p) => p.length === 2).map(([k, v]) => [k.trim(), v.trim()]));
	return [parts.C, parts.L ?? parts.ST].filter(Boolean).join(', ') || String(location ?? '');
}

const gb = (/** @type {number} */ bytes) => `${format.number(bytes / 1e9, { maximumFractionDigits: 1 })} GB`;

/**
 * What the VM reported about a failed backup besides its log (paperless-backup:
 * exit code, memory, free space), as lines a person can read. Images before
 * these fields report none, so the list may be empty.
 * @param {any} backup the status page's `backup` object
 * @returns {string[]}
 */
export function backupFacts(backup) {
	if (!backup) return [];
	const facts = [];
	const say = tr().backup.facts;
	if (backup.oomKills > 0) facts.push(say.oom(backup.oomKills));
	if (typeof backup.memAvailableBytes === 'number') facts.push(say.memory(gb(backup.memAvailableBytes), backup.swapBytes ? gb(backup.swapBytes) : null));
	if (typeof backup.srvFreeBytes === 'number') facts.push(say.disk(gb(backup.srvFreeBytes)));
	if (typeof backup.exit === 'number') facts.push(say.exit(backup.exit));
	return facts;
}

// --- Fetching a backup without a VM -----------------------------------------
//
// A backup is public where it lies and readable only with the backup key. So
// a person can fetch it from a provider and decrypt it on their own machine,
// with curl and age, or with paperless-backup-filecoin's `restore`. The app
// gives them what that needs: where the pieces lie, and, when they ask for it
// in so many words, the key.

// What a piece's address must look like before it is shown as a command to
// paste into a shell: the addresses come from the providers' own registry
// entries, which the app does not control.
const PIECE_URL = /^https:\/\/[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?(?::\d{1,5})?\/piece\/[a-z0-9]+$/i;

/**
 * Where the parts of `backup` can be fetched, in order: per part its piece
 * CID and the address at each provider that holds a copy. Addresses that do
 * not look like a piece address are left out.
 * @param {{ pieceCid: string, parts?: Array<{ pieceCid: string }>, copies: Array<{ retrievalUrl: string, retrievalUrls?: string[] }> }} backup
 * @returns {Array<{ pieceCid: string, urls: string[] }>}
 */
export function pieceSources(backup) {
	const parts = backup.parts?.length > 1 ? backup.parts : [{ pieceCid: backup.pieceCid }];
	return parts.map((part, i) => ({
		pieceCid: part.pieceCid,
		urls: backup.copies
			.map((c) => c.retrievalUrls?.[i] ?? (i === 0 ? c.retrievalUrl : String(c.retrievalUrl ?? '').replace(/[^/]+$/, part.pieceCid)))
			.filter((url) => typeof url === 'string' && PIECE_URL.test(url) && url.endsWith(`/${part.pieceCid}`))
	}));
}

/**
 * The instructions a person keeps with a backup they want to fetch
 * themselves: the commands for curl and age, and the same for the backup
 * tool. Plain text, in the app's language.
 * @param {Parameters<typeof pieceSources>[0]} backup
 * @returns {{ filename: string, text: string, complete: boolean }}
 */
export function selfRestoreGuide(backup) {
	const sources = pieceSources(backup);
	const complete = sources.every((s) => s.urls.length > 0);
	const short = backup.pieceCid.slice(-12);
	const many = sources.length > 1;
	const g = tr().backup.guide;
	const file = (i) => (many ? g.partFile(String(i + 1).padStart(2, '0')) : g.sealedFile);
	const lines = [g.title, '', g.which(backup.pieceCid), g.parts(sources.length), '', ...g.need(g.keyFile), '', g.download, ''];
	sources.forEach((s, i) => {
		if (many) lines.push(g.part(i + 1, s.pieceCid));
		if (!s.urls.length) lines.push(g.noAddress);
		s.urls.forEach((url, n) => lines.push(`   ${n === 0 ? '' : g.or}curl -fL -o ${file(i)} '${url}'`));
		lines.push('');
	});
	if (many) lines.push(g.join, '', `   cat ${sources.map((_, i) => file(i)).join(' ')} > ${g.sealedFile}`, '');
	lines.push(
		g.decrypt(many ? 3 : 2),
		'',
		`   age -d -i ${g.keyFile} ${g.sealedFile} > paperless-export.zip`,
		'',
		...g.result,
		'',
		...g.tool(g.keyFile),
		'',
		`   node backup.mjs restore ${backup.pieceCid}`,
		'',
		...g.keep(g.keyFile),
		''
	);
	return { filename: g.filename(short), text: lines.join('\n'), complete };
}

/** A backup key as age writes it, or null. @param {unknown} identity */
export const ageSecretKey = (identity) => (typeof identity === 'string' && /^AGE-SECRET-KEY-1[0-9A-Z]{58}$/.test(identity.trim()) ? identity.trim() : null);
