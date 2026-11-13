import { Encrypter } from 'age-encryption';
import { describe, expect, it, vi } from 'vitest';
import { BackupFetchError, fetchBackup, MEMORY_LIMIT_BYTES, openSink, storedBytes } from './backup-fetch.js';
import { ageRecipient, newAgeIdentity } from './keys/age.js';

// These tests encrypt and decrypt for real; on a busy machine one takes seconds.
vi.setConfig({ testTimeout: 30_000 });

const cid = (n) => `bafkzcibexamplepiece${String(n).padStart(28, '0')}`;
const url = (host, c) => `https://${host}.example.com/piece/${c}`;

async function sealed(plain, identity) {
	const e = new Encrypter();
	e.addRecipient(ageRecipient(identity));
	return e.encrypt(plain);
}

/** A plain text that is no single repeated byte, so a wrong join shows. */
const sample = (n) => {
	const bytes = new Uint8Array(n);
	for (let i = 0; i < n; i++) bytes[i] = (i * 31 + (i >> 8)) & 0xff;
	return bytes;
};

/** One body in small chunks; `breakAt` ends it with an error after that many bytes. */
function body(bytes, { chunk = 4096, breakAt = Infinity } = {}) {
	let at = 0;
	return new ReadableStream({
		pull(c) {
			if (at >= breakAt) return c.error(new TypeError('network error'));
			if (at >= bytes.length) return c.close();
			const end = Math.min(at + chunk, bytes.length, breakAt);
			c.enqueue(bytes.slice(at, end));
			at = end;
		}
	});
}

/** A fake fetch over { url: bytes | (init) => Response }; records what was asked. */
function fakeFetch(table) {
	const calls = [];
	const impl = async (u, init = {}) => {
		calls.push({ url: u, headers: init.headers ?? {}, credentials: init.credentials });
		const entry = table[u];
		if (!entry) return new Response('not found', { status: 404 });
		if (typeof entry === 'function') return entry(init);
		const range = /^bytes=(\d+)-$/.exec(init.headers?.Range ?? '');
		return range ? new Response(body(entry.slice(Number(range[1]))), { status: 206 }) : new Response(body(entry), { status: 200 });
	};
	return { impl, calls };
}

function memory() {
	const chunks = [];
	let aborted = false;
	const sink = new WritableStream({ write: (c) => void chunks.push(c), abort: () => void (aborted = true) });
	// Joined in one go: spreading every byte into an array made these tests slow enough to time out on a busy machine.
	return { sink, bytes: () => new Uint8Array(Buffer.concat(chunks.map((c) => Buffer.from(c.buffer, c.byteOffset, c.byteLength)))), aborted: () => aborted };
}

const one = (c, hosts = ['a', 'b']) => ({ pieceCid: c, copies: hosts.map((h) => ({ retrievalUrl: url(h, c) })) });

describe('fetchBackup', () => {
	it('fetches one piece and decrypts it', async () => {
		const identity = newAgeIdentity();
		const plain = sample(200_000);
		const file = await sealed(plain, identity);
		const { impl, calls } = fakeFetch({ [url('a', cid(1))]: file });
		const out = memory();
		const progress = [];
		const result = await fetchBackup({ backup: one(cid(1)), identity, sink: out.sink, fetchImpl: impl, onProgress: (p) => progress.push(p) });
		expect(out.bytes()).toEqual(plain);
		expect(result).toEqual({ fetched: file.length, written: plain.length });
		expect(progress.at(-1)).toMatchObject({ fetched: file.length, written: plain.length });
		// The key is in no address and no header, and no cookie goes along.
		expect(JSON.stringify(calls)).not.toMatch(/AGE-SECRET/i);
		expect(calls.every((c) => c.credentials === 'omit')).toBe(true);
	});

	it('joins the parts of a large backup in order', async () => {
		const identity = newAgeIdentity();
		const plain = sample(300_000);
		const file = await sealed(plain, identity);
		const cut = [0, 100_000, 200_000, file.length];
		const parts = [0, 1, 2].map((i) => ({ pieceCid: cid(i + 1), size: cut[i + 1] - cut[i] }));
		const backup = { pieceCid: cid(1), parts, copies: [{ retrievalUrl: url('a', cid(1)) }] };
		const table = Object.fromEntries(parts.map((p, i) => [url('a', p.pieceCid), file.slice(cut[i], cut[i + 1])]));
		const { impl, calls } = fakeFetch(table);
		const out = memory();
		await fetchBackup({ backup, identity, sink: out.sink, fetchImpl: impl });
		expect(out.bytes()).toEqual(plain);
		expect(calls.map((c) => c.url)).toEqual(parts.map((p) => url('a', p.pieceCid)));
		expect(storedBytes(backup)).toBe(file.length);
	});

	it('takes the next copy when one does not answer', async () => {
		const identity = newAgeIdentity();
		const plain = sample(50_000);
		const { impl, calls } = fakeFetch({ [url('b', cid(1))]: await sealed(plain, identity) });
		const out = memory();
		await fetchBackup({ backup: one(cid(1)), identity, sink: out.sink, fetchImpl: impl });
		expect(out.bytes()).toEqual(plain);
		expect(calls.map((c) => c.url)).toEqual([url('a', cid(1)), url('b', cid(1))]);
	});

	it('continues at the same byte with another copy when one breaks off', async () => {
		const identity = newAgeIdentity();
		const plain = sample(150_000);
		const file = await sealed(plain, identity);
		const { impl, calls } = fakeFetch({ [url('a', cid(1))]: () => new Response(body(file, { breakAt: 40_960 }), { status: 200 }), [url('b', cid(1))]: file });
		const out = memory();
		await fetchBackup({ backup: one(cid(1)), identity, sink: out.sink, fetchImpl: impl });
		expect(out.bytes()).toEqual(plain);
		expect(calls[1].headers).toEqual({ Range: 'bytes=40960-' });
	});

	it('does not start over with a copy that ignores the range', async () => {
		const identity = newAgeIdentity();
		const file = await sealed(sample(150_000), identity);
		const { impl } = fakeFetch({ [url('a', cid(1))]: () => new Response(body(file, { breakAt: 8192 }), { status: 200 }), [url('b', cid(1))]: () => new Response(body(file), { status: 200 }) });
		const out = memory();
		await expect(fetchBackup({ backup: one(cid(1)), identity, sink: out.sink, fetchImpl: impl })).rejects.toMatchObject({ reason: 'interrupted' });
		expect(out.aborted()).toBe(true);
	});

	it('says so when no provider hands the piece out', async () => {
		const out = memory();
		await expect(fetchBackup({ backup: one(cid(1)), identity: newAgeIdentity(), sink: out.sink, fetchImpl: fakeFetch({}).impl })).rejects.toMatchObject({ reason: 'unreachable' });
		expect(out.aborted()).toBe(true);
	});

	it('refuses a backup with a piece that has no address, before asking anyone', async () => {
		const { impl, calls } = fakeFetch({});
		const backup = { pieceCid: cid(1), copies: [{ retrievalUrl: 'http://a.example.com/elsewhere' }] };
		await expect(fetchBackup({ backup, identity: newAgeIdentity(), sink: memory().sink, fetchImpl: impl })).rejects.toMatchObject({ reason: 'no-address' });
		expect(calls).toEqual([]);
	});

	it('tells a key that does not fit from a damaged backup', async () => {
		const identity = newAgeIdentity();
		const file = await sealed(sample(100_000), identity);
		const table = { [url('a', cid(1))]: file };
		await expect(fetchBackup({ backup: one(cid(1)), identity: newAgeIdentity(), sink: memory().sink, fetchImpl: fakeFetch(table).impl })).rejects.toMatchObject({ reason: 'wrong-key' });

		const cutShort = { [url('a', cid(1))]: file.slice(0, file.length - 1000) };
		const out = memory();
		await expect(fetchBackup({ backup: one(cid(1), ['a']), identity, sink: out.sink, fetchImpl: fakeFetch(cutShort).impl })).rejects.toMatchObject({ reason: 'damaged' });
		expect(out.aborted()).toBe(true);

		const flipped = file.slice();
		flipped[flipped.length - 500] ^= 1;
		await expect(fetchBackup({ backup: one(cid(1), ['a']), identity, sink: memory().sink, fetchImpl: fakeFetch({ [url('a', cid(1))]: flipped }).impl })).rejects.toMatchObject({ reason: 'damaged' });
	});

	it('stops when asked to', async () => {
		const identity = newAgeIdentity();
		const file = await sealed(sample(400_000), identity);
		const stop = new AbortController();
		const impl = async (_u, init) => {
			let at = 0;
			return new Response(
				new ReadableStream({
					pull(c) {
						if (init.signal.aborted) return c.error(new DOMException('aborted', 'AbortError'));
						c.enqueue(file.slice(at, (at += 4096)));
					}
				})
			);
		};
		const out = memory();
		const run = fetchBackup({ backup: one(cid(1)), identity, sink: out.sink, fetchImpl: impl, signal: stop.signal, onProgress: (p) => p.fetched > 100_000 && stop.abort() });
		await expect(run).rejects.toMatchObject({ reason: 'aborted' });
		expect(out.aborted()).toBe(true);
	});

	it('names no key in what it throws', async () => {
		const identity = newAgeIdentity();
		const error = await fetchBackup({ backup: one(cid(1)), identity, sink: memory().sink, fetchImpl: fakeFetch({}).impl }).catch((e) => e);
		expect(error).toBeInstanceOf(BackupFetchError);
		expect(`${error.message} ${error.stack}`).not.toContain(identity);
	});
});

describe('openSink', () => {
	it('writes to the file the person picks, where the browser can', async () => {
		const asked = [];
		const writable = new WritableStream();
		const picker = async (o) => (asked.push(o), { createWritable: async () => writable });
		const { sink, kind, finish } = await openSink({ suggestedName: 'paperless-export.zip', total: 5 * MEMORY_LIMIT_BYTES, picker });
		expect(kind).toBe('file');
		expect(sink).toBe(writable);
		expect(finish()).toBeNull();
		expect(asked[0].suggestedName).toBe('paperless-export.zip');
	});

	it('collects in memory otherwise, up to the limit', async () => {
		const { sink, kind, finish } = await openSink({ suggestedName: 'x.zip', total: 10, picker: undefined });
		expect(kind).toBe('memory');
		const w = sink.getWriter();
		await w.write(new Uint8Array([1, 2, 3]));
		await w.close();
		expect(new Uint8Array(await finish().arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
	});

	it('refuses a backup that is too large or of unknown size without a file', async () => {
		await expect(openSink({ suggestedName: 'x.zip', total: MEMORY_LIMIT_BYTES + 1, picker: undefined })).rejects.toMatchObject({ reason: 'too-large' });
		await expect(openSink({ suggestedName: 'x.zip', total: null, picker: undefined })).rejects.toMatchObject({ reason: 'too-large' });
		const { sink } = await openSink({ suggestedName: 'x.zip', total: 4, picker: undefined, limit: 4 });
		const w = sink.getWriter();
		await expect(w.write(new Uint8Array(5))).rejects.toMatchObject({ reason: 'too-large' });
	});
});
