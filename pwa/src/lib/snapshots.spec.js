// Incremental backups in the app (snapshots.js, backups.js): listing them by
// generation, restoring one, and the dedup key the VM gets. Made-up pieces.
import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { keccak256, toHex } from 'viem';
import { decodeStringSlot, parseSnapshotMeta, pieceMetadataSlot, readSnapshotMeta, snapshotsFromPieces } from './snapshots.js';
import { backupConfigFor, backupsFromPieces, protectedPieces, restoreEntry } from './backups.js';
import { backupDedupKey, backupMarkKey } from './keys/derive.js';

const G1 = '1111111111111111';
const G2 = '2222222222222222';
const cid = (s) => `bafkzcib${s.padEnd(24, 'a')}`;
const snap = (gen, seq, part = 0, parts = 1) => ({ gen, seq, part, parts });
const urlOf = (id) => `https://sp${id}.example`;
const sizeOf = () => 3 * 2 ** 20;
const cidText = (c) => String(c);

/** A data set's pieces: [id, cid, snapshot meta or null]. */
const set = (providerId, dataSetId, pieces) => ({ providerId, dataSetId, pieces: pieces.map(([id, c, s]) => ({ id: BigInt(id), cid: c, snapshot: s })) });

describe('snapshot metadata', () => {
	it('parses what the backup tool writes, and nothing else', () => {
		expect(parseSnapshotMeta({ pa: 'snap/1', gen: G1, seq: '3' })).toEqual({ gen: G1, seq: 3, part: 0, parts: 1 });
		expect(parseSnapshotMeta({ pa: 'snap/1 2/2', gen: G1, seq: '0' })).toEqual({ gen: G1, seq: 0, part: 1, parts: 2 });
		for (const m of [null, {}, { pa: 'snap/2', gen: G1, seq: '1' }, { pa: 'snap/1', gen: 'x', seq: '1' }, { pa: 'snap/1', gen: G1, seq: '-1' }]) expect(parseSnapshotMeta(m)).toBeNull();
	});
	it('reads it from the storage slots, short and long values', async () => {
		const word = (s) => {
			const b = new Uint8Array(32);
			b.set(new TextEncoder().encode(s));
			b[31] = s.length * 2;
			return toHex(b);
		};
		const store = new Map([
			[pieceMetadataSlot(7n, 4n, 'pa'), word('snap/1')],
			[pieceMetadataSlot(7n, 4n, 'gen'), word(G1)],
			[pieceMetadataSlot(7n, 4n, 'seq'), word('2')]
		]);
		const client = { readContract: async ({ args }) => store.get(args[0]) ?? toHex(0n, { size: 32 }) };
		const m = await readSnapshotMeta(client, '0x0000000000000000000000000000000000000001', 7n, [4n, 5n]);
		expect(m.get('4')).toEqual({ gen: G1, seq: 2, part: 0, parts: 1 });
		expect(m.get('5')).toBeNull();
		const long = 'y'.repeat(40);
		const slot = toHex(9n, { size: 32 });
		const got = await decodeStringSlot(toHex(BigInt(long.length * 2 + 1), { size: 32 }), slot, async (at, n) => {
			expect(at).toBe(keccak256(slot));
			const b = new Uint8Array(n * 32);
			b.set(new TextEncoder().encode(long));
			return [toHex(b.subarray(0, 32)), toHex(b.subarray(32))];
		});
		expect(got).toBe(long);
	});
});

describe('snapshots on chain', () => {
	const a = set(1, 10, [[1, cid('bz'), snap(G1, 0)], [2, cid('dy'), snap(G1, 1)], [3, cid('dx'), snap(G1, 2)]]);
	const b = set(2, 20, [[1, cid('bz'), snap(G1, 0)], [2, cid('dx'), snap(G1, 2)]]);

	it('a data set can restore a snapshot only with every pack before it', () => {
		const { snapshots } = snapshotsFromPieces([a, b], { urlOf, sizeOf, cidText });
		const bySeq = Object.fromEntries(snapshots.map((s) => [s.seq, s]));
		expect(bySeq[0].copies.map((c) => c.providerId)).toEqual(['1', '2']);
		expect(bySeq[0].complete).toBe(true);
		expect(bySeq[2].copies.map((c) => c.providerId)).toEqual(['1']);
		expect(bySeq[2].complete).toBe(false);
		expect(bySeq[2].packs.map((p) => p.seq)).toEqual([0, 1, 2]);
		expect(bySeq[2].packs[0].copies.map((c) => c.retrievalUrls[0])).toEqual([`https://sp1.example/piece/${cid('bz')}`, `https://sp2.example/piece/${cid('bz')}`]);
	});

	it('lists snapshots beside full backups, newest first by the chain\'s order', () => {
		const mixed = set(1, 10, [[1, cid('full'), null], [2, cid('bz'), snap(G2, 0)], [3, cid('dy'), snap(G2, 1)]]);
		const list = backupsFromPieces([mixed], { urlOf, sizeOf });
		expect(list.map((x) => x.kind ?? 'full')).toEqual(['snapshot', 'snapshot', 'full']);
		expect(list.map((x) => x.seq ?? null)).toEqual([1, 0, null]);
		expect(list[0].pieceCid).toBe(cid('dy'));
	});

	it('a baseline in parts is one snapshot', () => {
		const parts = set(1, 10, [[1, cid('pq'), snap(G1, 0, 0, 2)], [2, cid('pr'), snap(G1, 0, 1, 2)]]);
		const [s] = snapshotsFromPieces([parts], { urlOf, sizeOf, cidText }).snapshots;
		expect(s.parts.map((p) => p.pieceCid)).toEqual([cid('pq'), cid('pr')]);
		expect(s.copies[0].retrievalUrls).toHaveLength(2);
	});

	it('restores a snapshot with every pack, and protects every one of them', () => {
		const list = backupsFromPieces([a], { urlOf, sizeOf });
		const newest = list[0];
		const entry = restoreEntry(newest);
		expect(entry.kind).toBe('snapshot');
		expect(entry.gen).toBe(G1);
		expect(entry.seq).toBe(2);
		expect(entry.packs.map((p) => p.parts[0].pieceCid)).toEqual([cid('bz'), cid('dy'), cid('dx')]);
		expect(entry.packs[1].copies[0]).toEqual({ providerId: '1', dataSetId: '10', retrievalUrls: [`https://sp1.example/piece/${cid('dy')}`] });
		expect(protectedPieces(entry).sort()).toEqual([cid('bz'), cid('dy'), cid('dx')].sort());
	});
});

describe('the switch and the key', () => {
	const recipient = `age1${'q'.repeat(58)}`;
	it('is off unless the places turn it on', () => {
		expect(backupConfigFor('calibration', recipient).incremental).toBeUndefined();
		expect(backupConfigFor('calibration', recipient, { copies: 2, incremental: { enabled: true } }).incremental).toEqual({ enabled: true });
	});
	it('the app\'s dedup key is the one the VM derives from the mark key', () => {
		const master = new Uint8Array(32).fill(9);
		const vm = spawnSync('python3', ['-c', 'import hashlib, hmac, sys; print(hmac.new(bytes.fromhex(sys.argv[1]), b"paperless-anywhere/backup-dedup-key/v1", hashlib.sha256).hexdigest())', backupMarkKey(master)], { encoding: 'utf8' }).stdout.trim();
		expect(backupDedupKey(master)).toBe(vm);
		expect(backupDedupKey(master)).not.toBe(backupMarkKey(master));
		const script = readFileSync(new URL('../../../rootfs/files/paperless-dedup-key', import.meta.url), 'utf8');
		expect(script).toContain('b"paperless-anywhere/backup-dedup-key/v1"');
	});
});
