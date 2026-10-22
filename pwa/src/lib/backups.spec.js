import { describe, expect, it } from 'vitest';
import { restoreEntry, backupConfigFor } from './backups.js';

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
			copies: 2, providerIds: [9, 4], regions: [], datasetMetadata: { app: 'paperless-backup-test' }, keepWeeks: 1, ageRecipient: recipient
		});
	});
	it('refuses mainnet and a missing recipient', () => {
		expect(() => backupConfigFor('mainnet', recipient)).toThrow(/Testnetz/);
		expect(() => backupConfigFor('calibration', '')).toThrow(/age/);
	});
});
