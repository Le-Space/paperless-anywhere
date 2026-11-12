import { describe, expect, it } from 'vitest';
import { privateKeyToAccount } from 'viem/accounts';
import { recoverMessageAddress } from 'viem';
import { imagePassphrase } from './keys/derive.js';
import { BUILDER, BuilderError, buildOwnImage, checkBuilder, hasOwnImage, sources, storeMessage } from './own-image.js';
import { sha256Hex } from './vm.js';

const master = new Uint8Array(32).fill(7);
const app = privateKeyToAccount(`0x${'11'.repeat(32)}`);
const builder = { route: '?builder=example', measurements: ['ab'.repeat(48)], policy: 0x30000, plain: { sha256: 'ef'.repeat(32) } };
const job = '0a'.repeat(24);
const cid = 'QmExampleExampleExampleExampleExampleExample12';
const encoder = new TextEncoder();

const image = new Uint8Array(2500).map((_, n) => n % 251);

/** A builder that answers as builder/builder.mjs does, and notes what it was sent. */
function fakeBuilder(over = {}) {
	const seen = { calls: [], closed: false };
	let polls = 0;
	const answer = (status, body) => ({ status, body: encoder.encode(JSON.stringify(body)) });
	const channel = {
		close: () => void (seen.closed = true),
		request: async (method, path, init = {}) => {
			const body = init.body ? JSON.parse(init.body) : undefined;
			seen.calls.push({ method, path, body, ...(init.headers?.range ? { range: init.headers.range } : {}) });
			if (over[`${method} ${path}`]) return over[`${method} ${path}`](init);
			if (method === 'POST' && path === '/build') return answer(202, { job });
			if (method === 'GET' && path === `/job/${job}`) return answer(200, ++polls < 2 ? { state: 'building' } : { state: 'built', cid, size: image.length });
			if (method === 'GET' && path === `/job/${job}/image`) {
				const [, a, b] = /^bytes=(\d+)-(\d+)$/.exec(init.headers.range);
				return { status: 206, body: image.slice(Number(a), Number(b) + 1) };
			}
			if (method === 'DELETE' && path === `/job/${job}`) return answer(200, { removed: true });
			return answer(404, { error: 'no such route' });
		}
	};
	return { seen, answer, open: async () => channel };
}

/** Aleph's upload, noting what arrived. */
function fakeStore(result = {}) {
	const got = { bytes: null, message: null };
	const store = async (blob, message) => {
		got.bytes = new Uint8Array(await blob.arrayBuffer());
		got.message = message;
		return { status: 200, cid, ...result };
	};
	return { got, store };
}

const quick = { sleep: async () => {}, read: async () => 'processed', now: () => 1_800_000_000_000, pieceBytes: 1000 };

describe('an image of one\'s own', () => {
	it('ships without a builder: the step stays hidden until one is fixed here', () => {
		expect(BUILDER).toBeNull();
		expect(() => checkBuilder(BUILDER)).toThrow(BuilderError);
		expect(() => checkBuilder({ ...builder, plain: { sha256: 'y' } })).toThrow(BuilderError);
		expect(checkBuilder(builder)).toBe(builder);
	});

	it('names what an image is made from and by, with links only to what is known', () => {
		expect(sources(builder).map((r) => r.label)).toEqual(['Öffentliches Image, SHA-256', 'Messwert des Build-Dienstes']);
		expect(sources({ ...builder, plain: { ...builder.plain, store: 'cd'.repeat(32) } }).map((r) => r.label)).toContain('Öffentliches Image bei Aleph');
		const full = sources({ ...builder, vprogram: '12'.repeat(32), plain: { ...builder.plain, commit: 'ab'.repeat(20) } });
		expect(full.find((r) => r.label === 'Gebaut aus dem Quelltext-Stand')?.href).toBe(`https://github.com/Le-Space/paperless-anywhere/tree/${'ab'.repeat(20)}`);
		expect(full.find((r) => r.label === 'Build-Dienst bei Aleph')?.href).toBe(`https://api2.aleph.im/api/v0/messages/${'12'.repeat(32)}`);
		// A value that is no hash never becomes part of a link.
		expect(sources({ ...builder, vprogram: 'x"onclick', plain: { ...builder.plain, store: 'javascript:1', commit: '../..' } })).toHaveLength(2);
		expect(() => sources(null)).toThrow(BuilderError);
	});

	it('derives one passphrase per vault and plain image', () => {
		const one = imagePassphrase(master, builder.plain.sha256);
		expect(one).toMatch(/^[A-Za-z0-9_-]{43}$/);
		expect(imagePassphrase(master, builder.plain.sha256)).toBe(one);
		expect(imagePassphrase(master, '00'.repeat(32))).not.toBe(one);
		expect(imagePassphrase(new Uint8Array(32).fill(8), builder.plain.sha256)).not.toBe(one);
		expect(() => imagePassphrase(master, 'nope')).toThrow();
	});

	it('signs a STORE message for the built file, as the app\'s own address', async () => {
		const message = await storeMessage(app, cid, 1_800_000_000);
		const content = JSON.parse(message.item_content);
		expect(content).toEqual({ address: app.address, time: 1_800_000_000, item_type: 'ipfs', item_hash: cid, payment: { type: 'credit' } });
		expect(message.item_hash).toBe(await sha256Hex(message.item_content));
		expect(await recoverMessageAddress({ message: ['ETH', app.address, 'STORE', message.item_hash].join('\n'), signature: message.signature })).toBe(app.address);
		await expect(storeMessage(app, '../etc')).rejects.toThrow(BuilderError);
	});

	it('has it sealed, fetches it in pieces, stores it itself and returns what the profile keeps', async () => {
		const { seen, open } = fakeBuilder();
		const { got, store } = fakeStore();
		const steps = [];
		const result = await buildOwnImage({ master, app, builder, open, store, onProgress: (p) => steps.push(p.step), ...quick });
		expect([...new Set(steps)]).toEqual(['attest', 'build', 'fetch', 'sign', 'upload', 'confirm']);
		expect(seen.calls[0]).toEqual({ method: 'POST', path: '/build', body: { sha256: builder.plain.sha256, passphrase: imagePassphrase(master, builder.plain.sha256) } });
		expect(seen.calls.filter((c) => c.range).map((c) => c.range)).toEqual(['bytes=0-999', 'bytes=1000-1999', 'bytes=2000-2499']);
		// What goes to Aleph is exactly what the builder handed back, beside a STORE for its content address.
		expect(got.bytes).toEqual(image);
		expect(JSON.parse(got.message.item_content).item_hash).toBe(cid);
		expect(result).toEqual({
			rootfsItemHash: got.message.item_hash,
			luksPassphrase: imagePassphrase(master, builder.plain.sha256),
			luksFor: got.message.item_hash,
			ownImage: { plainSha256: builder.plain.sha256, cid, builtAt: '2027-01-15T08:00:00.000Z' }
		});
		// The builder is told to drop the image, and the channel is closed.
		expect(seen.calls.at(-1)).toMatchObject({ method: 'DELETE', path: `/job/${job}` });
		expect(seen.closed).toBe(true);
		expect(hasOwnImage(result, builder.plain.sha256)).toBe(true);
		expect(hasOwnImage(result, '00'.repeat(32))).toBe(false);
		expect(hasOwnImage({ ...result, rootfsItemHash: '12'.repeat(32) }, builder.plain.sha256)).toBe(false);
	});

	it('sends the passphrase to nothing but an attested builder', async () => {
		const { seen, open } = fakeBuilder();
		const { got, store } = fakeStore();
		await expect(buildOwnImage({ master, app, builder, open: async () => { throw new Error('measurement mismatch'); }, store, ...quick })).rejects.toThrow('measurement mismatch');
		expect(seen.calls).toEqual([]);
		expect(got.message).toBeNull();
		// And only in the one build request: not to Aleph, not in any other call.
		await buildOwnImage({ master, app, builder, open, store, ...quick });
		const pass = imagePassphrase(master, builder.plain.sha256);
		expect(seen.calls.filter((c) => JSON.stringify(c).includes(pass)).map((c) => c.path)).toEqual(['/build']);
		expect(JSON.stringify(got.message)).not.toContain(pass);
	});

	it('says so when the builder is busy, the build fails or a piece is missing, and has the image dropped', async () => {
		const run = (over) => {
			const base = fakeBuilder();
			const fake = fakeBuilder(Object.fromEntries(Object.entries(over).map(([k, v]) => [k, () => (Array.isArray(v) ? base.answer(...v) : v)])));
			return { promise: buildOwnImage({ master, app, builder, open: fake.open, store: fakeStore().store, ...quick }), seen: fake.seen };
		};
		const busy = run({ 'POST /build': [503, { error: 'busy' }] });
		await expect(busy.promise).rejects.toThrow(/baut gerade ein anderes Image/);
		expect(busy.seen.closed).toBe(true);
		// No job was given, so there is nothing to drop.
		expect(busy.seen.calls.some((c) => c.method === 'DELETE')).toBe(false);
		await expect(run({ [`GET /job/${job}`]: [200, { state: 'failed', error: 'the plain image here is not the one asked for' }] }).promise).rejects.toThrow(/fehlgeschlagen: the plain image here is not the one asked for/);
		const short = run({ [`GET /job/${job}/image`]: { status: 206, body: new Uint8Array(3) } });
		await expect(short.promise).rejects.toThrow(/Stück des Images nicht geliefert/);
		expect(short.seen.calls.at(-1)).toMatchObject({ method: 'DELETE' });
		await expect(run({ [`GET /job/${job}`]: [200, { state: 'built', cid, size: 5 * 1024 ** 3 }] }).promise).rejects.toThrow(/keine gültige Größe/);
	});

	it('keeps nothing when Aleph does not take the image', async () => {
		const { open } = fakeBuilder();
		await expect(buildOwnImage({ master, app, builder, open, store: async () => ({ status: 500, cid: null }), ...quick })).rejects.toThrow(/nicht angenommen \(500\)/);
		await expect(buildOwnImage({ master, app, builder, open, store: fakeStore({ cid: 'QmAnotherFileAnotherFileAnotherFileAnotherFile1' }).store, ...quick })).rejects.toThrow(/anderes Image gespeichert/);
		await expect(buildOwnImage({ master, app, builder, open, store: fakeStore().store, ...quick, read: async () => 'rejected' })).rejects.toThrow(/nicht angenommen/);
		await expect(buildOwnImage({ master, app, builder, open, store: fakeStore().store, ...quick, read: async () => null, confirmTries: 3 })).rejects.toThrow(/noch nicht bestätigt/);
	});
});
