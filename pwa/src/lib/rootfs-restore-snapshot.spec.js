// The restore of an incremental backup (rootfs/files/paperless-restore): the
// entry parser turns a snapshot entry into the download plan (every part of
// every pack up to the snapshot) and the entry the backup tool unpacks from.
// Run here with python3 on made-up entries.
import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const script = readFileSync(new URL('../../../rootfs/files/paperless-restore', import.meta.url), 'utf8');
const parser = script.match(/vars="\$\(python3 - "\$secrets\/restore_ledger_entry" <<'PY'\n([\s\S]*?)\nPY\n/)?.[1];
const dir = mkdtempSync(join(tmpdir(), 'restore-snap-'));

/** The parser's variables for an entry, or its refusal. */
function parse(entry) {
	const file = join(dir, `e${Math.random()}.json`);
	writeFileSync(file, JSON.stringify(entry));
	const r = spawnSync('python3', ['-', file], { input: parser, encoding: 'utf8' });
	if (r.status !== 0) return { error: r.stderr.trim() };
	// The shell evals these lines; read them back with sh.
	const out = spawnSync('sh', ['-c', `eval "$1"; printf '%s\\n---\\n%s\\n---\\n%s\\n---\\n%s' "$kind" "$cid" "$plan" "$snapentry"`, 'sh', r.stdout], { encoding: 'utf8' }).stdout.split('\n---\n');
	return { kind: out[0], cid: out[1], plan: out[2].split('\n').filter(Boolean), snapentry: out[3] ? JSON.parse(out[3]) : null };
}

const cid = (n) => `bafkzcib${'a'.repeat(20)}${n}`.replace(/\d/g, (d) => 'abcdefghij'[d]);
const url = (host, c) => `https://${host}.example/piece/${c}`;
const pack = (seq, cids, hosts = ['sp1', 'sp2']) => ({
	seq,
	parts: cids.map((c) => ({ pieceCid: c, size: 3_145_728 })),
	copies: hosts.map((h, i) => ({ providerId: i + 1, dataSetId: 10 + i, retrievalUrls: cids.map((c) => url(h, c)) }))
});
const GEN = '0123456789abcdef';

describe('the restore of a snapshot entry', () => {
	it('finds its parser', () => expect(parser).toContain('SNAPSHOT-ENTRY'));

	it('plans every part of every pack up to the snapshot, in order, with every copy\'s URL', () => {
		const e = { kind: 'snapshot', name: 'paperless-snap', gen: GEN, seq: 2, packs: [pack(0, [cid(1), cid(2)]), pack(1, [cid(3)]), pack(2, [cid(4)]), pack(3, [cid(5)])] };
		const r = parse(e);
		expect(r.kind).toBe('snapshot');
		expect(r.cid).toBe(cid(4));
		expect(r.plan.map((l) => l.split(' ').slice(0, 2))).toEqual([
			['0', cid(1)],
			['0', cid(2)],
			['1', cid(3)],
			['2', cid(4)]
		]);
		expect(r.plan[0].split(' ').slice(4)).toEqual([url('sp1', cid(1)), url('sp2', cid(1))]);
		expect(r.snapentry.gen).toBe(GEN);
		expect(r.snapentry.seq).toBe(2);
		expect(r.snapentry.packs.map((p) => p.seq)).toEqual([0, 1, 2]);
		expect(r.snapentry.packs[0].copies[0]).toEqual({ providerId: 1, dataSetId: 10, retrievalUrls: [url('sp1', cid(1)), url('sp1', cid(2))] });
	});

	it('refuses a snapshot that lacks a pack, names one twice, or has no generation', () => {
		expect(parse({ kind: 'snapshot', gen: GEN, seq: 1, packs: [pack(1, [cid(3)])] }).error).toMatch(/lacks packs/);
		expect(parse({ kind: 'snapshot', gen: GEN, seq: 0, packs: [pack(0, [cid(1)]), pack(0, [cid(2)])] }).error).toMatch(/twice/);
		expect(parse({ kind: 'snapshot', gen: 'nope', seq: 0, packs: [pack(0, [cid(1)])] }).error).toMatch(/generation/);
		expect(parse({ kind: 'snapshot', gen: GEN, seq: true, packs: [pack(0, [cid(1)])] }).error).toMatch(/generation/);
	});

	it('refuses parts without a piece CID or an https URL, and odd sizes', () => {
		const noUrl = pack(0, [cid(1)]);
		noUrl.copies = noUrl.copies.map((c) => ({ ...c, retrievalUrls: ['http://sp.example/piece/x'] }));
		expect(parse({ kind: 'snapshot', gen: GEN, seq: 0, packs: [noUrl] }).error).toMatch(/https/);
		const bad = pack(0, ['not-a-cid']);
		expect(parse({ kind: 'snapshot', gen: GEN, seq: 0, packs: [bad] }).error).toMatch(/piece CID/);
		const big = pack(0, [cid(1)]);
		big.parts[0].size = 2_000_000_000;
		expect(parse({ kind: 'snapshot', gen: GEN, seq: 0, packs: [big] }).error).toMatch(/part size/);
	});

	it('refuses an entry whose pieceCid is not the snapshot pack\'s', () => {
		expect(parse({ kind: 'snapshot', gen: GEN, seq: 0, pieceCid: cid(9), packs: [pack(0, [cid(1)])] }).error).toMatch(/not its pack/);
	});

	it('reads a full backup as before', () => {
		const r = parse({ name: 'paperless-2026-11-01', pieceCid: cid(7), copies: [{ retrievalUrl: url('sp1', cid(7)) }] });
		expect(r.kind).toBe('full');
		expect(r.cid).toBe(cid(7));
	});

	it('keeps the restored folder as the next backup\'s export, and records every pack as restored-from', () => {
		expect(script).toMatch(/mv "\$work\/import" \/srv\/paperless\/export\/state/);
		expect(script).toMatch(/restore-snapshot "\$work\/entry\.json" "\$work\/import" --packs "\$work\/packs" \$adopt/);
		expect(script).toMatch(/k == "snapshot" \? \$2 : \$1/);
	});
});
