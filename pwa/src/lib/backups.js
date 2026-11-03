// The backups the VM may restore, read from the chain: the backup wallet's
// data sets with the backup tool's label, their active pieces, the providers
// that hold each. No ledger and no key needed; the VM checks the piece it
// downloads against its piece CID (the content address).
import { createPublicClient, http } from 'viem';
import { getPdpDataSets } from '@filoz/synapse-core/warm-storage';
import { getActivePiecesByCursor } from '@filoz/synapse-core/pdp-verifier';
import { getPDPProvidersByIds } from '@filoz/synapse-core/sp-registry';
import { filecoinChain } from './permissions.js';

/** The data-set label paperless-backup-filecoin writes, per network. */
export const BACKUP_LABEL = { mainnet: 'paperless-backup', calibration: 'paperless-backup-test' };

const cidText = (cid) => (typeof cid === 'string' ? cid : (cid?.toString?.() ?? cid?.['/'] ?? ''));

/**
 * Newest first. A backup is complete when every labelled data set holds it.
 * @param {{ network: string, owner: string, label?: string }} a
 * @returns {Promise<Array<{ pieceCid: string, copies: Array<{ providerId: string, retrievalUrl: string, place: string }>, complete: boolean, order: number }>>}
 */
export async function listBackups({ network, owner, label }) {
	const want = label ?? BACKUP_LABEL[network === 'mainnet' ? 'mainnet' : 'calibration'];
	const client = createPublicClient({ chain: filecoinChain(network), transport: http(undefined, { retryCount: 1, timeout: 20_000 }) });
	const { items } = await getPdpDataSets(client, { address: owner });
	const sets = items.filter((ds) => {
		const meta = typeof ds.metadata === 'string' ? JSON.parse(ds.metadata || '{}') : (ds.metadata ?? {});
		return ds.live !== false && meta.app === want;
	});
	if (!sets.length) return [];
	const providers = await getPDPProvidersByIds(client, { providerIds: [...new Set(sets.map((ds) => BigInt(ds.providerId)))] });
	const byId = (id) => providers.find((p) => String(p.id) === String(id));
	const urlOf = (id) => byId(id)?.pdp?.serviceURL?.replace(/\/+$/, '');
	const byCid = new Map();
	for (const ds of sets) {
		const { items: pieces } = await getActivePiecesByCursor(client, { dataSetId: BigInt(ds.dataSetId ?? ds.id) });
		for (const p of pieces) {
			const cid = cidText(p.cid);
			const entry = byCid.get(cid) ?? { pieceCid: cid, copies: [], order: 0 };
			const base = urlOf(ds.providerId);
			if (base) entry.copies.push({ providerId: String(ds.providerId), retrievalUrl: `${base}/piece/${cid}`, place: place(byId(ds.providerId)?.pdp?.location) });
			// Piece ids only grow within a data set: the highest is the newest.
			entry.order = Math.max(entry.order, Number(p.id));
			byCid.set(cid, entry);
		}
	}
	return [...byCid.values()]
		.map((b) => ({ ...b, complete: b.copies.length >= sets.length }))
		.sort((a, b) => b.order - a.order);
}

/** What paperless-restore takes for a chain-listed backup: no SHA-256, the piece CID is the check. */
export function restoreEntry(backup) {
	return { name: `backup-${backup.pieceCid.slice(-12)}`, pieceCid: backup.pieceCid, copies: backup.copies.map((c) => ({ retrievalUrl: c.retrievalUrl })) };
}

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
