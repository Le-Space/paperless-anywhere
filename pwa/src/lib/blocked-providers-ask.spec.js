// The providers Le Space blocked (36 and 37 on mainnet) still hold data sets
// on the chain until those end. Their copies stay listed, but the browser
// does not ask them for a piece's first bytes.
import { describe, expect, it } from 'vitest';
import { PREFIX_BYTES, markSnapshots } from './snapshots.js';
import { askedBase, backupsFromPieces, groupPieces } from './backups.js';

const G = '1111111111111111';
const cid = (s) => `bafkzcib${s.padEnd(24, 'a')}`;
const urlOf = (id) => `https://sp${id}.example`;
const cidText = (c) => String(c);
const prefix = new TextEncoder().encode(`PA-SNAP/1 ${G} 0`.padEnd(PREFIX_BYTES - 1, ' ') + '\n');
const set = (providerId, dataSetId) => ({ providerId, dataSetId, pieces: [{ id: 1n, cid: cid('pa'), snapshot: null }] });
const asking = () => {
	const asked = [];
	const fetchFn = async (url) => (asked.push(url), new Response(prefix, { status: 206 }));
	return { asked, fetchFn };
};

describe('blocked providers are not asked for pieces', () => {
	it('on mainnet, 36 and 37 are skipped; the piece is read from the provider that is not blocked', async () => {
		const sets = [set(36, 1), set(37, 2), set(9, 3)];
		const { asked, fetchFn } = asking();
		await markSnapshots(sets, { baseOf: askedBase('mainnet', urlOf), groups: (p) => groupPieces(p, () => 5), cidText, fetchFn });
		expect(asked).toEqual([`https://sp9.example/piece/${cid('pa')}`]);
		expect(sets.every((s) => s.pieces[0].snapshot?.gen === G)).toBe(true);
	});

	it('a piece only blocked providers hold is not asked at all', async () => {
		const sets = [set(36, 1), set(37, 2)].map((s) => ({ ...s, pieces: [{ id: 1n, cid: cid('pb'), snapshot: null }] }));
		const { asked, fetchFn } = asking();
		await markSnapshots(sets, { baseOf: askedBase('mainnet', urlOf), groups: (p) => groupPieces(p, () => 5), cidText, fetchFn });
		expect(asked).toEqual([]);
	});

	it('their copies stay in the list, with their retrieval URL', () => {
		const sets = [set(36, 1), set(9, 3)].map((s) => ({ ...s, pieces: [{ id: 1n, cid: cid('pc'), snapshot: null, size: 5 }] }));
		const [b] = backupsFromPieces(sets, { urlOf });
		expect(b.copies.map((c) => c.providerId).sort()).toEqual(['36', '9']);
	});

	it('the same numbers on Calibration are other providers: asked as before', () => {
		expect(askedBase('calibration', urlOf)(36)).toBe('https://sp36.example');
		expect(askedBase('mainnet', urlOf)('36')).toBeUndefined();
		expect(askedBase('mainnet', urlOf)(9)).toBe('https://sp9.example');
	});
});
