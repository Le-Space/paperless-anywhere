import { describe, expect, it } from 'vitest';
import { restoreEntry, backupConfigFor, backupFacts } from './backups.js';

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
