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
 * @returns {Promise<Array<{ pieceCid: string, copies: Array<{ providerId: string, retrievalUrl: string }>, complete: boolean, order: number }>>}
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
	const urlOf = (id) => providers.find((p) => String(p.id) === String(id))?.pdp?.serviceURL?.replace(/\/+$/, '');
	const byCid = new Map();
	for (const ds of sets) {
		const { items: pieces } = await getActivePiecesByCursor(client, { dataSetId: BigInt(ds.dataSetId ?? ds.id) });
		for (const p of pieces) {
			const cid = cidText(p.cid);
			const entry = byCid.get(cid) ?? { pieceCid: cid, copies: [], order: 0 };
			const base = urlOf(ds.providerId);
			if (base) entry.copies.push({ providerId: String(ds.providerId), retrievalUrl: `${base}/piece/${cid}` });
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
 * The backup configuration the VM gets with its unlock (paperless-backup's
 * config.json without the payer, which the start adds). Calibration only: the
 * Mac stays the only writer of the mainnet backups until the PWA has been
 * tested with real ones.
 * @param {string} network @param {string} recipient age1… of the profile's identity
 */
export function backupConfigFor(network, recipient) {
	if (network !== 'calibration') throw new Error('Sicherungen aus der App vorerst nur im Testnetz (Calibration).');
	if (!/^age1[0-9a-z]{58}$/.test(recipient)) throw new Error('Ohne age-Schlüssel keine Sicherung.');
	return { copies: 2, providerIds: [9, 4], regions: [], datasetMetadata: { app: 'paperless-backup-test' }, keepWeeks: 1, ageRecipient: recipient };
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
