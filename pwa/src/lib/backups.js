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
 * @returns {Array<{ parts: Array<{ pieceCid: string, size: number | null }>, order: number }>}
 */
export function groupPieces(pieces, sizeOf = pieceSize) {
	const sorted = [...pieces].sort((a, b) => (BigInt(a.id) < BigInt(b.id) ? -1 : BigInt(a.id) > BigInt(b.id) ? 1 : 0));
	const groups = [];
	let run = [];
	let order = 0;
	for (const p of sorted) {
		const pieceCid = cidText(p.cid);
		const size = sizeOf(pieceCid);
		run.push({ pieceCid, size });
		order = Number(p.id);
		if (size !== PART_BYTES) {
			groups.push({ parts: run, order });
			run = [];
		}
	}
	if (run.length) groups.push({ parts: run, order });
	return groups;
}

/**
 * The backups on chain, from each data set's pieces: a backup in parts is
 * one backup, whose size is the sum of its parts, and a data set holds a copy
 * of it only with every part. A data set that holds just some of a backup's
 * parts (one an older tool pruned, or a provider lost) holds no copy of it.
 * Newest first; complete when every data set holds it.
 * @param {Array<{ providerId: any, pieces: Array<{ cid: any, id: any }> }>} sets
 * @param {{ urlOf: (providerId: any) => string | undefined, placeOf?: (providerId: any) => string, sizeOf?: (cid: string) => number | null }} where
 */
export function backupsFromPieces(sets, { urlOf, placeOf = () => '', sizeOf = pieceSize }) {
	const byKey = new Map();
	for (const ds of sets) {
		for (const g of groupPieces(ds.pieces, sizeOf)) {
			const key = g.parts.map((p) => p.pieceCid).join(' ');
			const entry = byKey.get(key) ?? { parts: g.parts, order: 0, holders: [] };
			entry.order = Math.max(entry.order, g.order);
			entry.holders.push(ds.providerId);
			byKey.set(key, entry);
		}
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
			const copies = b.holders.flatMap((providerId) => {
				const base = urlOf(providerId);
				if (!base) return [];
				const urls = b.parts.map((p) => `${base}/piece/${p.pieceCid}`);
				return [{ providerId: String(providerId), retrievalUrl: urls[0], ...(b.parts.length > 1 ? { retrievalUrls: urls } : {}), place: placeOf(providerId) }];
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
		.sort((a, b) => b.order - a.order);
}

/**
 * Newest first. A backup is complete when every labelled data set holds it
 * (all its parts, for a backup in parts).
 * `customer`: only data sets with this tag (the owner is Le Space's payer).
 * `dataSetIds`: the client data set ids Le Space Credits list for this
 * account; the data sets are picked by them, then checked by label and tag.
 * @param {{ network: string, owner: string, label?: string, customer?: string | null, dataSetIds?: string[] | null }} a
 * @returns {Promise<Array<{ pieceCid: string, parts?: Array<{ pieceCid: string, size: number | null }>, size: number | null, copies: Array<{ providerId: string, retrievalUrl: string, retrievalUrls?: string[], place: string }>, complete: boolean, order: number }>>}
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
		const { items: pieces } = await getActivePiecesByCursor(client, { dataSetId: BigInt(ds.dataSetId ?? ds.id) });
		withPieces.push({ providerId: ds.providerId, pieces });
	}
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
	const entry = { name: `backup-${backup.pieceCid.slice(-12)}`, pieceCid: backup.pieceCid, copies: backup.copies.map((c) => ({ retrievalUrl: c.retrievalUrl })) };
	if (!(backup.parts?.length > 1)) return entry;
	return {
		...entry,
		...(backup.size != null ? { size: backup.size } : {}),
		parts: backup.parts.map((p) => ({ pieceCid: p.pieceCid, ...(p.size != null ? { size: p.size } : {}) })),
		copies: backup.copies.map((c) => ({ retrievalUrl: c.retrievalUrl, retrievalUrls: c.retrievalUrls ?? backup.parts.map((p) => c.retrievalUrl.replace(/[^/]+$/, p.pieceCid)) }))
	};
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
 * On mainnet the providers of the Mac's backups (36, 37, 1), so a production
 * VM adds to the same data sets and one history continues.
 */
export const DEFAULT_PLACES_MAINNET = Object.freeze({ copies: 3, providerIds: [36, 37, 1], regions: [] });

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
	if (network !== 'calibration' && network !== 'mainnet') throw new Error(`Unbekanntes Netz: ${network}`);
	if (!/^age1[0-9a-z]{58}$/.test(recipient)) throw new Error('Ohne age-Schlüssel keine Sicherung.');
	const { copies, providerIds, regions } = { ...defaultPlaces(network), ...(places ?? {}) };
	const ids = [...(providerIds ?? [])].map(Number);
	if (!ids.length && !(copies >= 1 && copies <= 3)) throw new Error('1 bis 3 Kopien.');
	if (ids.length > 3) throw new Error('Höchstens 3 Anbieter.');
	return { copies: ids.length || copies, providerIds: ids, regions: [...(regions ?? [])], datasetMetadata: { app: BACKUP_LABEL[network] }, keepWeeks: network === 'mainnet' ? 12 : 1, ageRecipient: recipient };
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
 * @param {{ sessionKey?: string, backupKey?: string, signer?: { payer: string, signer: string, tag: string, label: string, network: string } | null, creditsUrl?: string, product?: string, account?: string }} k
 * @returns {Record<string, string>}
 */
export function vmBackupSecrets(profile, { sessionKey, backupKey, signer, creditsUrl, product, account }) {
	if (!profile.backupConfig) return {};
	const network = profile.network === 'mainnet' ? 'mainnet' : 'calibration';
	if (!profile.backupsByCredits) {
		return {
			backup_config: JSON.stringify({ ...profile.backupConfig, payer: profile.payer, network }),
			backup_session_key: String(sessionKey)
		};
	}
	if (!signer) throw new Error('Le Space Credits haben den Schlüssel der VM für die Sicherungen noch nicht freigegeben.');
	if (signer.network !== network) throw new Error(`Le Space Credits sichern im Netz ${signer.network}, diese Paperless in ${network}.`);
	if (!creditsUrl || !account || !product || !backupKey) throw new Error('Für Sicherungen über Le Space Credits fehlt die Adresse des Dienstes oder ein Schlüssel.');
	const { payer, tag, label } = signer;
	return {
		backup_config: JSON.stringify({
			...profile.backupConfig,
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

const gb = (/** @type {number} */ bytes) => `${(bytes / 1e9).toLocaleString('de-DE', { maximumFractionDigits: 1 })} GB`;

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
	if (backup.oomKills > 0) facts.push(`Speicher reichte nicht: das System hat ${backup.oomKills === 1 ? 'einen Prozess' : `${backup.oomKills} Prozesse`} beendet.`);
	if (typeof backup.memAvailableBytes === 'number') facts.push(`Freier Arbeitsspeicher danach: ${gb(backup.memAvailableBytes)}${backup.swapBytes ? `, Auslagerung ${gb(backup.swapBytes)}` : ', keine Auslagerung'}`);
	if (typeof backup.srvFreeBytes === 'number') facts.push(`Freier Platz auf der Datenplatte: ${gb(backup.srvFreeBytes)}`);
	if (typeof backup.exit === 'number') facts.push(`Exit-Code ${backup.exit}`);
	return facts;
}
