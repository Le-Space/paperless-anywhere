// Incremental backups in the app (snapshots.js, backups.js): listing them by
// generation, restoring one, and the dedup key the VM gets. Made-up pieces.
import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { PREFIX_BYTES, classifyPrefix, markSnapshots, pieceKind, snapshotsFromPieces } from './snapshots.js';
import { backupConfigFor, backupsFromPieces, groupPieces, protectedPieces, restoreEntry } from './backups.js';
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

/** A pack's 64-byte public prefix, as the backup tool writes it. */
const prefix = (gen, seq) => new TextEncoder().encode(`PA-SNAP/1 ${gen} ${seq}`.padEnd(PREFIX_BYTES - 1, ' ') + '\n');

describe('telling packs from full backups', () => {
	it('reads the prefix, age\'s header, and refuses anything else', () => {
		expect(classifyPrefix(prefix(G1, 3))).toEqual({ gen: G1, seq: 3 });
		expect(classifyPrefix(new TextEncoder().encode('age-encryption.org/v1\n-> X25519 made-up'))).toBe('full');
		expect(classifyPrefix(new Uint8Array(64))).toBeNull();
		expect(classifyPrefix(prefix(G1, 3).subarray(0, 30))).toBeNull();
	});
	it('asks providers with a range request, the next one when one fails, and remembers', async () => {
		const asked = [];
		const fetchFn = async (url, init) => {
			asked.push([url, init.headers.range]);
			if (url.startsWith('https://down')) throw new Error('made-up outage');
			return new Response(prefix(G2, 0), { status: 206 });
		};
		const c = cid('kq');
		expect(await pieceKind(c, ['https://down.example', 'https://up.example'], fetchFn)).toEqual({ gen: G2, seq: 0 });
		expect(asked).toEqual([
			[`https://down.example/piece/${c}`, 'bytes=0-63'],
			[`https://up.example/piece/${c}`, 'bytes=0-63']
		]);
		await pieceKind(c, ['https://up.example'], fetchFn);
		expect(asked).toHaveLength(2);
	});
	it('marks every part of a pack in parts, and leaves full backups alone', async () => {
		const base = set(1, 10, [[1, cid('qa'), null], [2, cid('qb'), null], [3, cid('qc'), null]]);
		const sizes = { [cid('qa')]: 1_000_000_000, [cid('qb')]: 5, [cid('qc')]: 7 };
		const fetchFn = async (url) => new Response(url.endsWith(cid('qa')) ? prefix(G1, 0) : new TextEncoder().encode('age-encryption.org/v1\nmade-up'), { status: 206 });
		await markSnapshots([base], { baseOf: () => 'https://sp1.example', groups: (p) => groupPieces(p, (c) => sizes[c]), cidText, fetchFn });
		expect(base.pieces.map((p) => p.snapshot)).toEqual([snap(G1, 0, 0, 2), snap(G1, 0, 1, 2), null]);
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
