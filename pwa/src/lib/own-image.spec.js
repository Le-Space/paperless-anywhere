import { describe, expect, it } from 'vitest';
import { privateKeyToAccount } from 'viem/accounts';
import { recoverMessageAddress } from 'viem';
import { imagePassphrase } from './keys/derive.js';
import { BUILDER, BuilderError, buildOwnImage, checkBuilder, hasOwnImage, storeMessage } from './own-image.js';
import { sha256Hex } from './vm.js';

const master = new Uint8Array(32).fill(7);
const app = privateKeyToAccount(`0x${'11'.repeat(32)}`);
const builder = { route: '?builder=example', measurements: ['ab'.repeat(48)], policy: 0x30000, plain: { store: 'cd'.repeat(32), sha256: 'ef'.repeat(32) } };
const job = '0a'.repeat(24);
const cid = 'QmExampleExampleExampleExampleExampleExample12';
const encoder = new TextEncoder();

/** A builder that answers as builder/builder.mjs does, and notes what it was sent. */
function fakeBuilder(over = {}) {
	const seen = { calls: [], closed: false, published: null };
	let polls = 0;
	const answer = (status, body) => ({ status, body: encoder.encode(JSON.stringify(body)) });
	const channel = {
		close: () => void (seen.closed = true),
		request: async (method, path, init = {}) => {
			const body = init.body ? JSON.parse(init.body) : undefined;
			seen.calls.push({ method, path, body });
			if (over[`${method} ${path}`]) return over[`${method} ${path}`](body);
			if (method === 'POST' && path === '/build') return answer(202, { job });
			if (method === 'GET' && path === `/job/${job}`) return answer(200, ++polls < 2 ? { state: 'building' } : { state: 'built', cid, size: 700 * 1048576 });
			if (method === 'POST' && path === `/job/${job}/publish`) return (seen.published = body.message), answer(200, { item_hash: body.message.item_hash, cid });
			return answer(404, { error: 'no such route' });
		}
	};
	return { seen, answer, open: async () => channel };
}

const quick = { sleep: async () => {}, read: async () => 'processed', now: () => 1_800_000_000_000 };

describe('an image of one\'s own', () => {
	it('ships without a builder: the step stays hidden until one is fixed here', () => {
		expect(BUILDER).toBeNull();
		expect(() => checkBuilder(BUILDER)).toThrow(BuilderError);
		expect(() => checkBuilder({ ...builder, plain: { store: 'x', sha256: 'y' } })).toThrow(BuilderError);
		expect(checkBuilder(builder)).toBe(builder);
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

	it('builds, signs, uploads and returns what the profile keeps', async () => {
		const { seen, open } = fakeBuilder();
		const steps = [];
		const result = await buildOwnImage({ master, app, builder, open, onProgress: (p) => steps.push(p.step), ...quick });
		expect(steps).toEqual(['attest', 'build', 'sign', 'upload', 'confirm']);
		expect(seen.calls[0]).toEqual({ method: 'POST', path: '/build', body: { store: builder.plain.store, sha256: builder.plain.sha256, passphrase: imagePassphrase(master, builder.plain.sha256) } });
		expect(JSON.parse(seen.published.item_content).item_hash).toBe(cid);
		expect(result).toEqual({
			rootfsItemHash: seen.published.item_hash,
			luksPassphrase: imagePassphrase(master, builder.plain.sha256),
			luksFor: seen.published.item_hash,
			ownImage: { plainSha256: builder.plain.sha256, cid, builtAt: '2027-01-15T08:00:00.000Z' }
		});
		expect(seen.closed).toBe(true);
		expect(hasOwnImage(result, builder.plain.sha256)).toBe(true);
		expect(hasOwnImage(result, '00'.repeat(32))).toBe(false);
		expect(hasOwnImage({ ...result, rootfsItemHash: '12'.repeat(32) }, builder.plain.sha256)).toBe(false);
	});

	it('sends the passphrase to nothing but an attested builder', async () => {
		const { seen, open } = fakeBuilder();
		await expect(buildOwnImage({ master, app, builder, open: async () => { throw new Error('measurement mismatch'); }, ...quick })).rejects.toThrow('measurement mismatch');
		expect(seen.calls).toEqual([]);
		// And only in the one build request.
		await buildOwnImage({ master, app, builder, open, ...quick });
		const pass = imagePassphrase(master, builder.plain.sha256);
		expect(seen.calls.filter((c) => JSON.stringify(c).includes(pass)).map((c) => c.path)).toEqual(['/build']);
	});

	it('says so when the builder is busy, the build fails or the upload is refused', async () => {
		const run = (over) => {
			const fake = fakeBuilder();
			const withOver = fakeBuilder(Object.fromEntries(Object.entries(over).map(([k, v]) => [k, () => fake.answer(...v)])));
			return { promise: buildOwnImage({ master, app, builder, open: withOver.open, ...quick }), seen: withOver.seen };
		};
		const busy = run({ 'POST /build': [503, { error: 'busy' }] });
		await expect(busy.promise).rejects.toThrow(/baut gerade ein anderes Image/);
		expect(busy.seen.closed).toBe(true);
		await expect(run({ [`GET /job/${job}`]: [200, { state: 'failed', error: 'the plain image is not the one asked for' }] }).promise).rejects.toThrow(/fehlgeschlagen: the plain image is not the one asked for/);
		const refused = run({ [`POST /job/${job}/publish`]: [502, { error: 'the upload to Aleph failed' }] });
		await expect(refused.promise).rejects.toThrow(/Hochladen ist fehlgeschlagen \(502/);
	});

	it('keeps nothing when Aleph does not take the image', async () => {
		const { open } = fakeBuilder();
		await expect(buildOwnImage({ master, app, builder, open, ...quick, read: async () => 'rejected' })).rejects.toThrow(/nicht angenommen/);
		await expect(buildOwnImage({ master, app, builder, open, ...quick, read: async () => null, confirmTries: 3 })).rejects.toThrow(/noch nicht bestätigt/);
	});
});
