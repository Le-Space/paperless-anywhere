// Fewer old backups (2026-11-18): the retention default, backups only at
// blocked providers, copies that run out, and removing the VM's plan with the
// wallet. Made-up pieces, ids and URLs.
import { describe, expect, it } from 'vitest';
import { DEFAULT_RETENTION, backupsFromPieces, endingCopies, removalBatches, retentionFor, withoutBlocked } from './backups.js';
import { removeWithWallet } from './permissions.js';
import { keptDe, keptEn } from './i18n/backup.js';
import { BACKUP_TEXTS } from './backup-overview.js';

const DAY = 24 * 3600 * 1000;
const cid = (s) => `bafkzcib${s.padEnd(24, 'a')}`;
/** A made-up backup as listBackups returns it. */
const backup = (name, copies, extra = {}) => ({
	pieceCid: cid(name),
	size: 1_100_000_000,
	copies: copies.map(([providerId, dataSetId, pieceIds, more = {}]) => ({ providerId: String(providerId), dataSetId: String(dataSetId), pieceIds: pieceIds.map(String), clientDataSetId: String(dataSetId + 1000), retrievalUrl: `https://sp${providerId}.example/piece/${cid(name)}`, place: '', ...more })),
	complete: true,
	order: 0,
	...extra
});

describe('what stays by default', () => {
	it('mainnet: the last 5 and one per week of the last 4 weeks', () => {
		expect(DEFAULT_RETENTION.mainnet).toEqual({ keepLast: 5, keepDays: 0, keepWeeks: 4, keepMonths: 0 });
		expect(retentionFor('mainnet', null)).toEqual({ keepLast: 5, keepDays: 0, keepWeeks: 4, keepMonths: 0 });
	});
	it('says it in words, leaving out what is zero', () => {
		expect(keptDe(DEFAULT_RETENTION.mainnet)).toBe('die letzten 5 und je eine pro Woche der letzten 4 Wochen');
		expect(keptEn(DEFAULT_RETENTION.mainnet)).toBe('the last 5 and one per week of the last 4 weeks');
		expect(keptDe({ keepLast: 2, keepDays: 2, keepWeeks: 1, keepMonths: 0 })).toBe('die letzten 2, je eine pro Tag der letzten 2 Tage und je eine pro Woche der letzten 1 Wochen');
		expect(BACKUP_TEXTS.de.retention.policy(DEFAULT_RETENTION.mainnet)).not.toMatch(/0 (Tage|Monate)/);
	});
});

describe('backups only at blocked providers', () => {
	it('are not offered; a backup keeps only its other copies', () => {
		const onlyBlocked = backup('ob', [[36, 1, [1]], [37, 2, [1]]]);
		const mixed = backup('mx', [[36, 1, [2]], [9, 3, [1]]]);
		const fine = backup('fn', [[9, 3, [2]]]);
		const { usable, hidden } = withoutBlocked('mainnet', [fine, mixed, onlyBlocked]);
		expect(usable.map((b) => b.pieceCid)).toEqual([cid('fn'), cid('mx')]);
		expect(usable[1].copies.map((c) => c.providerId)).toEqual(['9']);
		expect(hidden.map((b) => b.pieceCid)).toEqual([cid('ob')]);
	});
	it('are offered on another network, where those ids are other providers', () => {
		const b = backup('cal', [[36, 1, [1]]]);
		expect(withoutBlocked('calibration', [b]).usable).toHaveLength(1);
	});
});

describe('copies that run out', () => {
	it('groups ended data sets by day and counts the backups gone after it', () => {
		const end = Date.UTC(2026, 11, 14, 8);
		const gone = backup('g', [[36, 1, [1], { endsAt: end }], [37, 2, [1], { endsAt: end + 3600_000 }]]);
		const stays = backup('s', [[36, 1, [2], { endsAt: end }], [9, 3, [1]]]);
		expect(endingCopies([stays, gone])).toEqual([{ at: end, providers: ['36', '37'], copies: 3, gone: 1 }]);
		expect(endingCopies([backup('x', [[9, 3, [1]]])])).toEqual([]);
	});
	it('come from the data set\'s end epoch and client id in the list', () => {
		const set = { providerId: 9, dataSetId: 3n, clientDataSetId: 7n, endsAt: Date.UTC(2026, 11, 14), pieces: [{ id: 1n, cid: cid('e'), snapshot: null }] };
		const [b] = backupsFromPieces([set], { urlOf: () => 'https://sp9.example', sizeOf: () => 5 });
		expect(b.copies[0]).toMatchObject({ dataSetId: '3', clientDataSetId: '7', endsAt: Date.UTC(2026, 11, 14) });
	});
});

describe('removing the VM\'s plan with the wallet', () => {
	const marked = () => true;
	const list = [backup('n0', [[9, 3, [9]], [2, 4, [9]]]), backup('o1', [[9, 3, [5]], [2, 4, [6]]]), backup('o2', [[9, 3, [1, 2]], [2, 4, [1, 2]]], { parts: [{ pieceCid: cid('o2') }, { pieceCid: cid('o2b') }] })];

	it('one batch per data set with every piece, the provider\'s address and the client id', () => {
		const r = removalBatches({ remove: [{ pieceCid: cid('o1') }, { pieceCid: cid('o2') }] }, list, { marked });
		expect(r.skipped).toEqual([]);
		expect(r.batches).toEqual([
			{ dataSetId: '3', clientDataSetId: '1003', providerId: '9', serviceURL: 'https://sp9.example', pieceIds: ['1', '2', '5'] },
			{ dataSetId: '4', clientDataSetId: '1004', providerId: '2', serviceURL: 'https://sp2.example', pieceIds: ['1', '2', '6'] }
		]);
	});
	it('leaves out pieces already scheduled for removal, and a batch with nothing left', () => {
		const scheduled = new Map([['3', new Set(['1', '2', '5'])], ['4', new Set(['1'])]]);
		const r = removalBatches({ remove: [{ pieceCid: cid('o1') }, { pieceCid: cid('o2') }] }, list, { marked, scheduled });
		expect(r.batches).toEqual([{ dataSetId: '4', clientDataSetId: '1004', providerId: '2', serviceURL: 'https://sp2.example', pieceIds: ['2', '6'] }]);
	});
	it('never the newest, a protected one, or one the chain no longer lists', () => {
		const r = removalBatches({ remove: [{ pieceCid: cid('n0') }, { pieceCid: cid('o1') }, { pieceCid: cid('o2') }, { pieceCid: cid('zz') }] }, list, { marked, protect: [cid('o2b')] });
		expect(Object.fromEntries(r.skipped.map((s) => [s.pieceCid, s.why]))).toEqual({ [cid('n0')]: 'newest', [cid('o2')]: 'protected', [cid('zz')]: 'gone' });
		expect(r.backups.map((b) => b.pieceCid)).toEqual([cid('o1')]);
	});
	it('no pack a kept snapshot of its generation builds on', () => {
		const snaps = [backup('s2', [[9, 3, [12]]], { kind: 'snapshot', gen: 'aaaaaaaaaaaaaaaa', seq: 2 }), backup('s1', [[9, 3, [11]]], { kind: 'snapshot', gen: 'aaaaaaaaaaaaaaaa', seq: 1 }), backup('t0', [[9, 3, [5]]], { kind: 'snapshot', gen: 'bbbbbbbbbbbbbbbb', seq: 0 })];
		const r = removalBatches({ remove: [{ pieceCid: cid('s1') }, { pieceCid: cid('t0') }] }, snaps, { marked });
		expect(r.skipped).toEqual([{ pieceCid: cid('s1'), why: 'generation' }]);
		expect(r.batches[0].pieceIds).toEqual(['5']);
	});
	it('no unmarked one while no marked one would remain', () => {
		const r = removalBatches({ remove: [{ pieceCid: cid('o1') }] }, list, { marked: () => false });
		expect(r.skipped).toEqual([{ pieceCid: cid('o1'), why: 'unmarked' }]);
		expect(r.batches).toEqual([]);
		const ok = removalBatches({ remove: [{ pieceCid: cid('o1') }] }, list, { marked: (b) => b.pieceCid === cid('n0') });
		expect(ok.backups.map((b) => b.pieceCid)).toEqual([cid('o1')]);
	});
	it('signs one call per batch with the wallet and reports each', async () => {
		/** @type {any[]} */
		const calls = [];
		globalThis.ethereum = { request: async () => null };
		const out = await removeWithWallet(`0x${'a'.repeat(40)}`, 'calibration', [
			{ dataSetId: '3', clientDataSetId: '1003', providerId: '9', serviceURL: 'https://sp9.example', pieceIds: ['1', '5'] },
			{ dataSetId: '4', clientDataSetId: '1004', providerId: '2', serviceURL: 'https://sp2.example', pieceIds: ['6'] }
		], {
			remove: async (_w, o) => {
				calls.push(o);
				if (o.dataSetId === 4n) throw new Error('made-up refusal');
				return { hash: '0xabc' };
			}
		});
		delete globalThis.ethereum;
		expect(calls.map((c) => [c.dataSetId, c.clientDataSetId, c.pieceIds, c.serviceURL])).toEqual([
			[3n, 1003n, [1n, 5n], 'https://sp9.example'],
			[4n, 1004n, [6n], 'https://sp2.example']
		]);
		expect(out).toEqual([{ dataSetId: '3', ok: true, hash: '0xabc' }, { dataSetId: '4', ok: false, error: 'made-up refusal' }]);
	});
});
