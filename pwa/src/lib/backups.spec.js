import { describe, expect, it } from 'vitest';
import { newerBackup, restoreEntry, backupConfigFor, backupDataSets, backupFacts, dataSetsByClientIds, vmBackupSecrets } from './backups.js';

describe('restoreEntry', () => {
	it('names the piece and its copies, without a SHA-256 (the piece CID is the check)', () => {
		const entry = restoreEntry({ pieceCid: 'bafkzcibexampleexampleexample', copies: [{ providerId: '9', retrievalUrl: 'https://sp.example/piece/bafkzcibexampleexampleexample' }], complete: true, order: 4 });
		expect(entry).toEqual({ name: 'backup-ampleexample', pieceCid: 'bafkzcibexampleexampleexample', copies: [{ retrievalUrl: 'https://sp.example/piece/bafkzcibexampleexampleexample' }] });
		expect('sealedSha256' in entry).toBe(false);
	});
});

describe('backupConfigFor', () => {
	const recipient = 'age1' + 'q'.repeat(58);
	it('backs up to the test data sets on Calibration', () => {
		expect(backupConfigFor('calibration', recipient)).toEqual({
			copies: 2, providerIds: [9, 2], regions: [], datasetMetadata: { app: 'paperless-backup-test' }, keepWeeks: 1, ageRecipient: recipient
		});
	});
	it('writes mainnet backups to the data sets of the Mac', () => {
		expect(backupConfigFor('mainnet', recipient, { copies: 3, providerIds: [36, 37, 1], regions: [] })).toMatchObject({ copies: 3, providerIds: [36, 37, 1], datasetMetadata: { app: 'paperless-backup' }, keepWeeks: 12 });
		expect(backupConfigFor('mainnet', recipient)).toMatchObject({ copies: 3, providerIds: [36, 37, 1] });
		expect(backupConfigFor('calibration', recipient)).toMatchObject({ providerIds: [9, 2] });
		expect(() => backupConfigFor('other', recipient)).toThrow(/Unbekanntes Netz/);
	});
	it('checks places and a missing recipient', () => {
		expect(backupConfigFor('calibration', recipient, { copies: 3, providerIds: [], regions: ['EUROPE'] })).toMatchObject({ copies: 3, providerIds: [], regions: ['EUROPE'] });
		expect(backupConfigFor('calibration', recipient, { copies: 1, providerIds: [7, 2], regions: [] })).toMatchObject({ copies: 2, providerIds: [7, 2] });
		expect(() => backupConfigFor('calibration', recipient, { copies: 4, providerIds: [], regions: [] })).toThrow(/1 bis 3/);
		expect(() => backupConfigFor('calibration', '')).toThrow(/age/);
	});
});

describe('own backups', () => {
	it('reads the piece CID a stop made, in either shape', async () => {
		const { pieceCidOfStop } = await import('./backups.js');
		expect(pieceCidOfStop({ stop: { backup: { status: 'done', backup: { pieceCid: 'bafkA' } } } })).toBe('bafkA');
		expect(pieceCidOfStop({ backup: { pieceCid: 'bafkB' } })).toBe('bafkB');
		expect(pieceCidOfStop({ stop: { backup: { status: 'skipped' } } })).toBeNull();
	});
	it('keeps this vault\'s own backups apart from the rest', async () => {
		const { splitOwn } = await import('./backups.js');
		const list = [{ pieceCid: 'a' }, { pieceCid: 'b' }, { pieceCid: 'c' }];
		expect(splitOwn(list, ['b'])).toEqual({ own: [{ pieceCid: 'b' }], other: [{ pieceCid: 'a' }, { pieceCid: 'c' }] });
	});
});

describe('place', () => {
	it('shortens a provider location to country and city', async () => {
		const { place } = await import('./backups.js');
		expect(place('C=GB;ST=Gloucestershire;L=Cheltenham')).toBe('GB, Cheltenham');
		expect(place('C=US;ST=Texas')).toBe('US, Texas');
		expect(place('somewhere')).toBe('somewhere');
	});
});

describe('backupFacts', () => {
	it('says what the VM saw when a backup failed: memory, free space, exit code', () => {
		expect(backupFacts({ status: 'failed', exit: 1, oomKills: 2, memAvailableBytes: 812_000_000, swapBytes: 0, srvFreeBytes: 17_520_000_000 })).toEqual([
			'Speicher reichte nicht: das System hat 2 Prozesse beendet.',
			'Freier Arbeitsspeicher danach: 0,8 GB, keine Auslagerung',
			'Freier Platz auf der Datenplatte: 17,5 GB',
			'Exit-Code 1'
		]);
	});
	it('stays empty for an image that reports none of it', () => {
		expect(backupFacts({ status: 'failed', reason: 'the backup did not complete', log: [] })).toEqual([]);
		expect(backupFacts(null)).toEqual([]);
	});
});

describe('backupDataSets', () => {
	const sets = [
		{ id: 1, live: true, metadata: { app: 'paperless-backup-test', customer: 'aa'.repeat(16) } },
		{ id: 2, live: true, metadata: JSON.stringify({ app: 'paperless-backup-test', customer: 'bb'.repeat(16) }) },
		{ id: 3, live: false, metadata: { app: 'paperless-backup-test', customer: 'aa'.repeat(16) } },
		{ id: 4, live: true, metadata: { app: 'paperless-backup', customer: 'aa'.repeat(16) } },
		{ id: 5, live: true, metadata: { app: 'paperless-backup-test' } },
		{ id: 6, live: true, metadata: '{not json' }
	];
	it('keeps only this account\'s live data sets when Le Space\'s payer owns them all', () => {
		expect(backupDataSets(sets, { label: 'paperless-backup-test', customer: 'aa'.repeat(16) }).map((d) => d.id)).toEqual([1]);
		expect(backupDataSets(sets, { label: 'paperless-backup-test', customer: 'bb'.repeat(16) }).map((d) => d.id)).toEqual([2]);
	});
	it('keeps every labelled live data set of a wallet', () => {
		expect(backupDataSets(sets, { label: 'paperless-backup-test' }).map((d) => d.id)).toEqual([1, 2, 5]);
	});
});

describe('vmBackupSecrets', () => {
	const recipient = 'age1' + 'q'.repeat(58);
	const backupConfig = backupConfigFor('calibration', recipient);
	const wallet = '0x' + '0'.repeat(39) + 'b';
	const signer = { payer: '0x' + '0'.repeat(39) + '1', signer: '0x' + '0'.repeat(39) + '2', tag: 'ab'.repeat(16), label: 'paperless-backup-test', network: 'calibration' };
	const account = '0x' + '0'.repeat(39) + 'a';
	const keys = { sessionKey: '0x' + '1'.repeat(64), backupKey: '0x' + '2'.repeat(64), creditsUrl: 'https://credits.example.com', product: 'paperless-anywhere', account };

	it('is empty without backups', () => {
		expect(vmBackupSecrets({ payer: wallet }, keys)).toEqual({});
	});

	it('gives the wallet path the wallet as payer and the session key', () => {
		const s = vmBackupSecrets({ payer: wallet, network: 'calibration', backupConfig }, keys);
		expect(Object.keys(s).sort()).toEqual(['backup_config', 'backup_session_key']);
		expect(s.backup_session_key).toBe(keys.sessionKey);
		const c = JSON.parse(s.backup_config);
		expect(c).toMatchObject({ payer: wallet, network: 'calibration', ageRecipient: recipient });
		expect(c).not.toHaveProperty('remoteSigner');
	});

	it('gives the credits path remoteSigner and the backup key, never the session key', () => {
		const s = vmBackupSecrets({ network: 'calibration', backupConfig, backupsByCredits: true }, { ...keys, signer });
		expect(Object.keys(s).sort()).toEqual(['backup_config', 'backup_key']);
		expect(s.backup_key).toBe(keys.backupKey);
		const c = JSON.parse(s.backup_config);
		expect(c.remoteSigner).toEqual({ creditsUrl: 'https://credits.example.com', product: 'paperless-anywhere', account, payer: signer.payer, signer: signer.signer, tag: signer.tag, label: signer.label });
		expect(c).toMatchObject({ payer: signer.payer, network: 'calibration', ageRecipient: recipient, datasetMetadata: { app: 'paperless-backup-test', customer: signer.tag } });
		expect(s.backup_config).not.toContain(keys.backupKey.slice(2));
		expect(s.backup_config).not.toContain(keys.sessionKey.slice(2));
	});

	it('refuses the credits path without the service\'s answer, for another network, or without the service', () => {
		const profile = { network: 'calibration', backupConfig, backupsByCredits: true };
		expect(() => vmBackupSecrets(profile, keys)).toThrow(/noch nicht freigegeben/);
		expect(() => vmBackupSecrets(profile, { ...keys, signer: { ...signer, network: 'mainnet' } })).toThrow(/Netz mainnet/);
		expect(() => vmBackupSecrets(profile, { ...keys, signer, creditsUrl: '' })).toThrow(/Adresse des Dienstes/);
	});
});

describe('dataSetsByClientIds', () => {
	// Le Space's payer's data sets, 2 a page; ids as the chain gives them (bigint).
	const all = [1n, 2n, 3n, 4n, 5n].map((id) => ({ clientDataSetId: id, dataSetId: id + 100n }));
	const pages = (seen) => async (cursor) => {
		seen.push(cursor);
		const at = Number(cursor ?? 0n);
		return { items: all.slice(at, at + 2), ...(at + 2 < all.length ? { nextCursor: BigInt(at + 2) } : {}) };
	};
	it('picks the account\'s data sets by client id and stops once all are found', async () => {
		const seen = [];
		expect((await dataSetsByClientIds(pages(seen), ['2', '3'])).map((d) => d.dataSetId)).toEqual([102n, 103n]);
		expect(seen).toEqual([undefined, 2n]);
	});
	it('reads to the end for an id that is not on chain yet, and not at all without ids', async () => {
		const seen = [];
		expect((await dataSetsByClientIds(pages(seen), ['5', '99'])).map((d) => d.dataSetId)).toEqual([105n]);
		expect(seen).toEqual([undefined, 2n, 4n]);
		const none = [];
		expect(await dataSetsByClientIds(pages(none), [])).toEqual([]);
		expect(none).toEqual([]);
	});
	it('reads at most maxPages', async () => {
		const seen = [];
		expect(await dataSetsByClientIds(pages(seen), ['5'], { maxPages: 1 })).toEqual([]);
		expect(seen).toEqual([undefined]);
	});
	it('then checks label and tag as a second filter', async () => {
		const picked = [
			{ clientDataSetId: 1n, live: true, metadata: { app: 'paperless-backup-test', customer: 'aa'.repeat(16) } },
			{ clientDataSetId: 2n, live: true, metadata: { app: 'paperless-backup-test', customer: 'bb'.repeat(16) } }
		];
		expect(backupDataSets(picked, { label: 'paperless-backup-test', customer: 'aa'.repeat(16) }).map((d) => d.clientDataSetId)).toEqual([1n]);
	});
});

describe('backups in parts (above 1 GB)', async () => {
	const { PART_BYTES, backupSize, backupsFromPieces, groupPieces, pieceSize } = await import('./backups.js');
	const { calculate } = await import('@filoz/synapse-core/piece');
	// Made-up pieces: full parts (F…), last parts and whole small backups (s…).
	const sizes = { F1: PART_BYTES, F2: PART_BYTES, s3: 65_000_000, s4: 300_000_000, F5: PART_BYTES, s6: 12, s7: 40_000_000 };
	const sizeOf = (cid) => sizes[cid] ?? null;
	const piece = (cid, id) => ({ cid, id: BigInt(id) });
	const urlOf = (id) => `https://sp${id}.example.com`;
	const placeOf = (id) => `Land ${id}`;

	it('reads a piece\'s payload size from its CID: a full part is exactly PART_BYTES', async () => {
		expect(PART_BYTES).toBe(1_000_000_000);
		// The piece CID of 1,000,000,000 bytes of 0x05 (computed once; too slow for every run).
		expect(pieceSize('bafkzcibfqdwjihyz242msui7yy6cdap4trmogluxbhyy6rtsiqirm3hwamjxs3y4g4oa')).toBe(PART_BYTES);
		for (const n of [127, 4096, 99_999]) expect(pieceSize((await calculate(new Uint8Array(n).fill(7))).toString())).toBe(n);
		expect(pieceSize('not a cid')).toBeNull();
	});

	it('groups a data set\'s pieces: full parts and the piece that ends them are one backup', () => {
		const groups = groupPieces([piece('s7', 9), piece('F1', 3), piece('s3', 5), piece('F2', 4), piece('s4', 6), piece('s6', 2)], sizeOf);
		expect(groups.map((g) => g.parts.map((p) => p.pieceCid))).toEqual([['s6'], ['F1', 'F2', 's3'], ['s4'], ['s7']]);
		expect(groups.map((g) => g.order)).toEqual([2, 5, 6, 9]);
	});

	it('lists a backup in parts as ONE backup with its total size, complete only where every part is', () => {
		const sets = [
			{ providerId: 1, pieces: [piece('s4', 1), piece('F1', 2), piece('F2', 3), piece('s3', 4)] },
			{ providerId: 2, pieces: [piece('s4', 7), piece('F1', 8), piece('F2', 9), piece('s3', 10)] }
		];
		const list = backupsFromPieces(sets, { urlOf, placeOf, sizeOf });
		expect(list).toHaveLength(2);
		const [big, small] = list;
		expect(big).toEqual({
			pieceCid: 'F1',
			parts: [{ pieceCid: 'F1', size: PART_BYTES }, { pieceCid: 'F2', size: PART_BYTES }, { pieceCid: 's3', size: 65_000_000 }],
			size: 2_065_000_000,
			copies: [1, 2].map((id) => ({
				providerId: String(id),
				retrievalUrl: `https://sp${id}.example.com/piece/F1`,
				retrievalUrls: ['F1', 'F2', 's3'].map((c) => `https://sp${id}.example.com/piece/${c}`),
				place: `Land ${id}`
			})),
			complete: true,
			order: 10
		});
		expect(backupSize(big.size)).toBe('2,1 GB');
		// A single-piece backup keeps its old shape (no parts, no retrievalUrls).
		expect(small).toEqual({ pieceCid: 's4', size: 300_000_000, copies: [1, 2].map((id) => ({ providerId: String(id), retrievalUrl: `https://sp${id}.example.com/piece/s4`, place: `Land ${id}` })), complete: true, order: 7 });
	});

	it('a data set that lacks a part holds no copy of it, and its rest is no backup of its own', () => {
		const sets = [
			{ providerId: 1, pieces: [piece('F1', 2), piece('F2', 3), piece('s3', 4)] },
			{ providerId: 2, pieces: [piece('F1', 8), piece('s3', 10)] }, // part 2 gone
			{ providerId: 3, pieces: [piece('F2', 9), piece('s3', 10)] } // part 1 gone (an older tool pruned only the first)
		];
		const list = backupsFromPieces(sets, { urlOf, sizeOf });
		expect(list).toHaveLength(1);
		expect(list[0].copies.map((c) => c.providerId)).toEqual(['1']);
		expect(list[0].complete).toBe(false);
	});

	it('a set whose last part is gone keeps the next backup as a backup of its own', () => {
		const sets = [
			{ providerId: 1, pieces: [piece('F1', 2), piece('F5', 3), piece('s3', 4), piece('s6', 5)] },
			{ providerId: 2, pieces: [piece('F1', 2), piece('F5', 3), piece('s6', 5)] }
		];
		const list = backupsFromPieces(sets, { urlOf, sizeOf });
		const byFirst = Object.fromEntries(list.map((b) => [b.parts?.map((p) => p.pieceCid).join('+') ?? b.pieceCid, b.copies.map((c) => c.providerId)]));
		expect(byFirst['F1+F5+s3']).toEqual(['1']);
		expect(byFirst.s6).toEqual(['1']);
	});

	it('the restore entry carries the parts and each copy\'s URL per part; a single piece stays as before', async () => {
		const { restoreEntry } = await import('./backups.js');
		const [big, small] = backupsFromPieces([{ providerId: 1, pieces: [piece('s4', 1), piece('F1', 2), piece('F2', 3), piece('s3', 4)] }], { urlOf, sizeOf });
		expect(restoreEntry(big)).toEqual({
			name: 'backup-F1',
			pieceCid: 'F1',
			size: 2_065_000_000,
			parts: [{ pieceCid: 'F1', size: PART_BYTES }, { pieceCid: 'F2', size: PART_BYTES }, { pieceCid: 's3', size: 65_000_000 }],
			copies: [{ retrievalUrl: 'https://sp1.example.com/piece/F1', retrievalUrls: ['F1', 'F2', 's3'].map((c) => `https://sp1.example.com/piece/${c}`) }]
		});
		expect(restoreEntry(small)).toEqual({ name: 'backup-s4', pieceCid: 's4', copies: [{ retrievalUrl: 'https://sp1.example.com/piece/s4' }] });
	});

	it('newerBackup: a start carried on later restores what came after the chosen backup', () => {
		const copy = [{ retrievalUrl: 'https://sp.example/piece/x' }];
		const list = [
			{ pieceCid: 'c9', copies: [], order: 9 },
			{ pieceCid: 'c7', copies: copy, order: 7 },
			{ pieceCid: 'c5', copies: copy, order: 5 },
			{ pieceCid: 'c2', copies: copy, order: 2 }
		];
		// The newest one a provider can deliver; one without a copy is skipped.
		expect(newerBackup(list, { pieceCid: 'c2' })?.pieceCid).toBe('c7');
		expect(newerBackup(list, { pieceCid: 'c7' })).toBe(null);
		// Nothing chosen, or a backup the list does not know: it stays as it is.
		expect(newerBackup(list, null)).toBe(null);
		expect(newerBackup(list, { pieceCid: 'elsewhere' })).toBe(null);
	});
});
