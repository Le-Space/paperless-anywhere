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

/**
 * Newest first. A backup is complete when every labelled data set holds it.
 * `customer`: only data sets with this tag (the owner is Le Space's payer).
 * @param {{ network: string, owner: string, label?: string, customer?: string | null }} a
 * @returns {Promise<Array<{ pieceCid: string, copies: Array<{ providerId: string, retrievalUrl: string, place: string }>, complete: boolean, order: number }>>}
 */
export async function listBackups({ network, owner, label, customer = null }) {
	const want = label ?? BACKUP_LABEL[network === 'mainnet' ? 'mainnet' : 'calibration'];
	const client = createPublicClient({ chain: filecoinChain(network), transport: http(undefined, { retryCount: 1, timeout: 20_000 }) });
	const { items } = await getPdpDataSets(client, { address: owner });
	const sets = backupDataSets(items, { label: want, customer });
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
