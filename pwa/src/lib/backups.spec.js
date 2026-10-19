import { describe, expect, it } from 'vitest';
import { restoreEntry } from './backups.js';

describe('restoreEntry', () => {
	it('names the piece and its copies, without a SHA-256 (the piece CID is the check)', () => {
		const entry = restoreEntry({ pieceCid: 'bafkzcibexampleexampleexample', copies: [{ providerId: '9', retrievalUrl: 'https://sp.example/piece/bafkzcibexampleexampleexample' }], complete: true, order: 4 });
		expect(entry).toEqual({ name: 'backup-ampleexample', pieceCid: 'bafkzcibexampleexampleexample', copies: [{ retrievalUrl: 'https://sp.example/piece/bafkzcibexampleexampleexample' }] });
		expect('sealedSha256' in entry).toBe(false);
	});
});
