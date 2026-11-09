import { describe, expect, it } from 'vitest';
import { restoreEntry, backupConfigFor, backupDataSets, backupFacts, dataSetsByClientIds, vmBackupSecrets } from './backups.js';

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
