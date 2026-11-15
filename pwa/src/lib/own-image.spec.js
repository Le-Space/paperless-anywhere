import { describe, expect, it } from 'vitest';
import { privateKeyToAccount } from 'viem/accounts';
import { recoverMessageAddress } from 'viem';
import { imagePassphrase } from './keys/derive.js';
import { BUILDER, BUILDER_CREDITS_PER_HOUR, BuilderError, IMAGE_STORE_CREDITS_PER_HOUR, LANES, PIECE_BYTES, RUN_BYTES, buildAffordable, imageStatus, buildOnOwnBuilder, buildPaidByPackage, buildOwnImage, builderMessage, builderOpener, checkBuilder, forgetLeftBuilder, hasOwnImage, imageFields, imageKindOf, sources, storeMessage } from './own-image.js';
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
			if (method === 'GET' && path === '/') return answer(200, { service: 'paperless-anywhere image builder', plain: builder.plain });
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

// `kept` is what a second try finds of the first; each call here starts with nothing.
const quick = () => ({ sleep: async () => {}, read: async () => 'processed', now: () => 1_800_000_000_000, pieceBytes: 1000, kept: { current: null } });

describe('an image of one\'s own', () => {
	it('ships with a builder started for each build, whose content names the measurements it pins', () => {
		expect(checkBuilder(BUILDER)).toBe(BUILDER);
		const fixed = /** @type {any} */ (BUILDER);
		expect(fixed.route).toBeUndefined();
		expect(fixed.program.verification.measurements.map((m) => m.registers.launch)).toEqual(fixed.measurements);
		expect(fixed.program.verification.policy).toBe(fixed.policy);
		expect(fixed.program.requirements.node.node_hash).toBe(fixed.crn);
		// The volumes the measurement belongs to, as STOREs; no address or time of the one publication.
		for (const v of [fixed.program.workload, ...fixed.program.volumes]) for (const h of [v.ref, v.hash_tree, v.roothash]) expect(h).toMatch(/^[0-9a-f]{64}$/);
		expect(fixed.program.address).toBeUndefined();
		expect(fixed.program.time).toBeUndefined();
		expect(() => checkBuilder(null)).toThrow(BuilderError);
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
		const result = await buildOwnImage({ master, app, builder, open, store, onProgress: (p) => steps.push(p.step), ...quick() });
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
		await expect(buildOwnImage({ master, app, builder, open: async () => { throw new Error('measurement mismatch'); }, store, ...quick() })).rejects.toThrow('measurement mismatch');
		expect(seen.calls).toEqual([]);
		expect(got.message).toBeNull();
		// And only in the one build request: not to Aleph, not in any other call.
		await buildOwnImage({ master, app, builder, open, store, ...quick() });
		const pass = imagePassphrase(master, builder.plain.sha256);
		expect(seen.calls.filter((c) => JSON.stringify(c).includes(pass)).map((c) => c.path)).toEqual(['/build']);
		expect(JSON.stringify(got.message)).not.toContain(pass);
	});

	it('says so when the builder is busy, the build fails or a piece is missing, and has the image dropped', async () => {
		const run = (over) => {
			const base = fakeBuilder();
			const fake = fakeBuilder(Object.fromEntries(Object.entries(over).map(([k, v]) => [k, () => (Array.isArray(v) ? base.answer(...v) : v)])));
			return { promise: buildOwnImage({ master, app, builder, open: fake.open, store: fakeStore().store, ...quick() }), seen: fake.seen };
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
		await expect(buildOwnImage({ master, app, builder, open, store: async () => ({ status: 500, cid: null }), ...quick() })).rejects.toThrow(/nicht angenommen \(500\)/);
		await expect(buildOwnImage({ master, app, builder, open, store: fakeStore({ cid: 'QmAnotherFileAnotherFileAnotherFileAnotherFile1' }).store, ...quick() })).rejects.toThrow(/anderes Image gespeichert/);
		await expect(buildOwnImage({ master, app, builder, open, store: fakeStore().store, ...quick(), read: async () => 'rejected' })).rejects.toThrow(/nicht angenommen/);
		await expect(buildOwnImage({ master, app, builder, open, store: fakeStore().store, ...quick(), read: async () => null, confirmTries: 3 })).rejects.toThrow(/noch nicht bestätigt/);
	});

	/**
	 * A builder behind an attest relay as it is deployed: a connection carries
	 * at most `maxBytes` down, and one client may hold `maxOpen` at a time.
	 * `breakAt` lists connections (by number, from 1) that die at their first image piece.
	 */
	function relayedBuilder(big, { maxBytes = RELAY_BYTES / SCALE, maxOpen = 4, breakAt = [], refuseAt = 0, gone = false, unreachableAt = [], dropFails = 0 } = {}) {
		const seen = { opened: 0, open: 0, mostOpen: 0, builds: 0, deleted: 0, polls: 0 };
		const answer = (status, body) => ({ status, body: encoder.encode(JSON.stringify(body)) });
		const open = async () => {
			const number = ++seen.opened;
			if (number === refuseAt) throw new Error('measurement mismatch');
			if (unreachableAt.includes(number)) throw new BuilderError('not reachable just now', 'unreachable');
			if (seen.open >= maxOpen) throw new Error('connection to the relay closed: 429');
			seen.open++;
			seen.mostOpen = Math.max(seen.mostOpen, seen.open);
			let down = 0;
			let closed = false;
			const close = () => {
				if (!closed) seen.open--;
				closed = true;
			};
			return {
				measurement: 'ab'.repeat(48),
				close,
				request: async (method, path, init = {}) => {
					await Promise.resolve();
					if (closed) throw new Error('the connection closed while waiting for the answer');
					if (method === 'POST' && path === '/build') return ++seen.builds, answer(202, { job });
					if (method === 'GET' && path === `/job/${job}`) return answer(200, ++seen.polls < 2 ? { state: 'building' } : { state: 'built', cid, size: big.length });
					if (method === 'DELETE') return seen.deleteTries = (seen.deleteTries ?? 0) + 1, seen.deleteTries <= dropFails ? Promise.reject(new Error('the connection closed')) : (++seen.deleted, answer(200, { removed: true }));
					if (gone) return answer(404, { error: 'no such job' });
					const [, a, b] = /^bytes=(\d+)-(\d+)$/.exec(init.headers.range);
					down += Number(b) - Number(a) + 1;
					if (down > maxBytes || breakAt.includes(number)) {
						close();
						throw new Error('the connection closed while waiting for the answer');
					}
					return { status: 206, body: big.slice(Number(a), Number(b) + 1) };
				}
			};
		};
		return { seen, open };
	}
	// The relay's limits as deployed, and everything a sixteenth of its size so
	// the tests stay quick: the image, the relay's limit, a run and a piece
	// keep the proportions the app has.
	const RELAY_BYTES = 4 * 1024 * 1024;
	const SCALE = 16;
	const big = new Uint8Array((10 * 1024 * 1024) / SCALE + 4321);
	for (let n = 0; n < big.length; n++) big[n] = (n * 31 + (n >> 11)) & 255;
	const real = () => ({ sleep: async () => {}, read: async () => 'processed', now: () => 1_800_000_000_000, kept: { current: null }, runBytes: RUN_BYTES / SCALE, pieceBytes: PIECE_BYTES / SCALE });

	it('asks for runs larger than a strict relay carries, made of whole pieces, in no more lanes than a client may open', () => {
		expect(RUN_BYTES).toBeGreaterThan(RELAY_BYTES);
		expect(RUN_BYTES % PIECE_BYTES).toBe(0);
		expect(LANES).toBeLessThanOrEqual(4);
	});

	it('takes a run over one connection where the relay lets a builder carry more', async () => {
		const { seen, open } = relayedBuilder(big, { maxBytes: (256 * 1024 * 1024) / SCALE });
		const { got, store } = fakeStore();
		await buildOwnImage({ master, app, builder, open, store, ...real() });
		expect(await sha256Hex(got.bytes)).toBe(await sha256Hex(big));
		// The build, one per run, the drop: one attestation per run.
		expect(seen.opened).toBe(1 + Math.ceil(big.length / (RUN_BYTES / SCALE)) + 1);
	});


	it('fetches through a relay that carries 4 MiB a connection and four connections a client', async () => {
		const { seen, open } = relayedBuilder(big);
		const { got, store } = fakeStore();
		const shown = [];
		const result = await buildOwnImage({ master, app, builder: { ...builder, vprogram: '12'.repeat(32) }, open, store, onProgress: (p) => p.step === 'fetch' && shown.push(p.detail), ...real() });
		expect(got.bytes.length).toBe(big.length);
		expect(await sha256Hex(got.bytes)).toBe(await sha256Hex(big));
		// One connection for the build, one per 4 MiB the relay carries (a run goes
		// on where the relay cut it), one to have it dropped.
		expect(seen.opened).toBe(1 + Math.ceil(big.length / (RELAY_BYTES / SCALE)) + 1);
		expect(seen.mostOpen).toBeLessThanOrEqual(LANES);
		expect(seen.open).toBe(0);
		expect(seen.deleted).toBe(1);
		expect(shown.at(0)).toContain('(0 %)');
		expect(shown.at(-1)).toContain('(100 %)');
		// What the hardware reported at the build is kept beside the image.
		expect(result.ownImage.builder).toEqual({ vprogram: '12'.repeat(32), measurement: 'ab'.repeat(48), attestedAt: '2027-01-15T08:00:00.000Z' });
	});

	it('fetches a run again when its connection breaks, and asks on over a new one while the image is built', async () => {
		// Connection 1 builds; 2 and 3 break off at once; later ones carry the image.
		const { seen, open } = relayedBuilder(big, { breakAt: [2, 3] });
		const { got, store } = fakeStore();
		await buildOwnImage({ master, app, builder, open, store, ...real() });
		expect(await sha256Hex(got.bytes)).toBe(await sha256Hex(big));
		expect(seen.builds).toBe(1);

		// The relay ends the connection of the build while the app waits.
		const slow = fakeBuilder();
		let opened = 0;
		let asked = 0;
		const dropping = async () => {
			const channel = await slow.open();
			const mine = ++opened;
			return { ...channel, request: (method, path, init) => (method === 'GET' && path === `/job/${job}` && mine === 1 && ++asked ? Promise.reject(new Error('the connection closed')) : channel.request(method, path, init)) };
		};
		await buildOwnImage({ master, app, builder, open: dropping, store: fakeStore().store, ...quick() });
		expect(asked).toBe(1);
		expect(slow.seen.calls.filter((c) => c.path === '/build')).toHaveLength(1);
	});

	it('goes on where a broken connection stopped, and keeps trying while pieces come back', async () => {
		// Every connection breaks after one piece (an unsteady VPN): the run goes
		// on from there each time, so with two tries in a row it still completes.
		const inner = fakeBuilder();
		const ranges = [];
		let counted = 0;
		const shaky = async () => {
			const channel = await inner.open();
			let pieces = 0;
			return { ...channel, request: (method, path, init) => {
				if (path === `/job/${job}/image`) {
					if (++pieces > 1) return Promise.reject(new Error('the connection closed while waiting for the answer'));
					ranges.push(init.headers.range);
				}
				return channel.request(method, path, init);
			} };
		};
		const { got, store } = fakeStore();
		await buildOwnImage({ master, app, builder, open: shaky, store, ...quick(), runTries: 2, onProgress: () => {} });
		expect(got.bytes).toEqual(image);
		expect(ranges).toEqual(['bytes=0-999', 'bytes=1000-1999', 'bytes=2000-2499']);

		// No piece at all, try after try: it gives up after runTries in a row.
		let tries = 0;
		const dead = async () => {
			const channel = await inner.open();
			return { ...channel, request: (method, path, init) => (path === `/job/${job}/image` ? (tries++, Promise.reject(new Error('closed'))) : channel.request(method, path, init)) };
		};
		await expect(buildOwnImage({ master, app, builder, open: dead, store: fakeStore().store, ...quick(), runTries: 3 })).rejects.toThrow(BuilderError);
		expect(tries).toBe(3);
	});

	it('gives up where trying again cannot help: the image is gone, or a connection fails its attestation', async () => {
		const lost = relayedBuilder(big, { gone: true });
		await expect(buildOwnImage({ master, app, builder, open: lost.open, store: fakeStore().store, ...real() })).rejects.toThrow(/hat das Image nicht mehr \(404\)/);
		expect(lost.seen.opened).toBeLessThanOrEqual(1 + LANES + 1);

		// The third connection shows another measurement: nothing is fetched over it, and nothing is stored.
		const other = relayedBuilder(big, { refuseAt: 3 });
		const { got, store } = fakeStore();
		await expect(buildOwnImage({ master, app, builder, open: other.open, store, ...real() })).rejects.toThrow('measurement mismatch');
		expect(got.message).toBeNull();
		expect(other.seen.open).toBe(0);

		// A run that never arrives ends the fetch after a few tries, not never.
		const dead = relayedBuilder(big, { breakAt: Array.from({ length: 200 }, (_, n) => n + 2) });
		await expect(buildOwnImage({ master, app, builder, open: dead.open, store: fakeStore().store, ...real() })).rejects.toThrow(/Stück des Images nicht geliefert/);
		expect(dead.seen.opened).toBeLessThan(40);
	});

	it('uploads a fetched image again without building it again, and only waits when it was uploaded', async () => {
		const { seen, open } = fakeBuilder();
		const kept = { current: null };
		const stores = [];
		const failing = async () => (stores.push('refused'), { status: 500, cid: null });
		const { got, store } = fakeStore();
		const counted = async (blob, message) => (stores.push('taken'), store(blob, message));
		await expect(buildOwnImage({ master, app, builder, open, store: failing, ...quick(), kept })).rejects.toThrow(/bleibt in diesem Fenster erhalten/);
		const builderCalls = seen.calls.length;
		// Aleph has it, but does not confirm in time.
		await expect(buildOwnImage({ master, app, builder, open, store: counted, ...quick(), kept, read: async () => null, confirmTries: 2 })).rejects.toThrow(/noch nicht bestätigt/);
		const result = await buildOwnImage({ master, app, builder, open, store: counted, ...quick(), kept });
		expect(seen.calls.length).toBe(builderCalls);
		expect(stores).toEqual(['refused', 'taken']);
		expect(got.bytes).toEqual(image);
		expect(result.rootfsItemHash).toBe(got.message.item_hash);
		expect(kept.current).toBeNull();

		// Another vault in the same window gets nothing of it.
		const left = { current: null };
		await expect(buildOwnImage({ master, app, builder, open, store: failing, ...quick(), kept: left })).rejects.toThrow();
		const before = seen.calls.length;
		await buildOwnImage({ master: new Uint8Array(32).fill(9), app: privateKeyToAccount(`0x${'22'.repeat(32)}`), builder, open, store: fakeStore().store, ...quick(), kept: left });
		expect(seen.calls.slice(before).some((c) => c.path === '/build')).toBe(true);

		// Refused by Aleph after the upload: the next try signs and uploads anew.
		const again = { current: null };
		await expect(buildOwnImage({ master, app, builder, open, store: fakeStore().store, ...quick(), kept: again, read: async () => 'rejected' })).rejects.toThrow(/nicht angenommen/);
		expect(again.current.message).toBeUndefined();
	});

	it('reaches the builder over the relay that worked last, and never retries a refused attestation', async () => {
		const dialled = [];
		const works = { b: true };
		const load = async () => ({
			wasm: {},
			relays: ['a', 'b', 'c'],
			relayTransports: ([relay]) => (route) => ({ relay, route, onData: () => {} }),
			attestGuest: async ({ transport, expectedMeasurements, expectedPolicy }) => {
				dialled.push(transport.relay);
				expect(transport.route).toBe(builder.route);
				expect([expectedMeasurements, expectedPolicy]).toEqual([builder.measurements, builder.policy]);
				if (works[transport.relay] === 'refuse') throw new Error('attestation rejected: measurement');
				if (!works[transport.relay]) throw new Error('connection to the relay closed');
				return { channel: { request: async () => ({ status: 200, body: new Uint8Array(0) }), close: () => {} }, freshVerified: { measurement: 'ab'.repeat(48) } };
			}
		});
		const open = builderOpener(builder, {}, { load });
		expect((await open()).measurement).toBe('ab'.repeat(48));
		await open();
		expect(dialled).toEqual(['a', 'b', 'b']);
		works.b = false;
		await expect(open()).rejects.toThrow(/gerade nicht erreichbar/);
		works.c = 'refuse';
		works.b = true;
		dialled.length = 0;
		works.b = false;
		await expect(open()).rejects.toThrow(/attestation rejected/);
		expect(dialled).toEqual(['b', 'c']);
	});

	it('tries a run again when the builder cannot be reached for a moment, and the cleanup too', async () => {
		// Connections 4 and 5 find no way to the builder; the runs they were for are fetched again.
		const flaky = relayedBuilder(big, { unreachableAt: [4, 5], dropFails: 2 });
		const { got, store } = fakeStore();
		await buildOwnImage({ master, app, builder, open: flaky.open, store, ...real() });
		expect(await sha256Hex(got.bytes)).toBe(await sha256Hex(big));
		// The image is dropped even though the first two tries broke off.
		expect(flaky.seen.deleteTries).toBe(3);
		expect(flaky.seen.deleted).toBe(1);
		expect(flaky.seen.open).toBe(0);
		expect(LANES).toBeLessThan(4);
	});
});

describe('the choice of image in the setup', () => {
	const own = 'aa'.repeat(32);
	const pub = 'bb'.repeat(32);
	const crn = 'cc'.repeat(32);
	const built = { rootfsItemHash: own, luksPassphrase: 'derived', luksFor: own, ownImage: { plainSha256: builder.plain.sha256, builtAt: '2026-11-14T00:00:00Z' } };

	it('shows the own image as chosen once one is built for the builder, else the public one', () => {
		expect(imageKindOf(built, builder)).toBe('own');
		expect(imageKindOf({}, builder)).toBe('public');
		expect(imageKindOf(built, null)).toBe('public');
		expect(imageKindOf({ ...built, ownImage: { plainSha256: '00'.repeat(32) } }, builder)).toBe('public');
	});

	it('with the own image saves only the node: image and passphrase come from the build', () => {
		expect(imageFields({ kind: 'own', image: '', crn: ` ${crn.toUpperCase()} `, pass: 'ignored', profile: built })).toEqual({ crnHash: crn });
		expect(() => imageFields({ kind: 'own', image: '', crn: 'x', pass: '', profile: {} })).toThrow('Knoten');
	});

	it('going back to the public image needs that image and its own passphrase', () => {
		expect(() => imageFields({ kind: 'public', image: '', crn, pass: '', profile: built })).toThrow('64-stelliger Hash');
		expect(() => imageFields({ kind: 'public', image: pub, crn, pass: '', profile: built })).toThrow('eigene Passphrase');
		expect(imageFields({ kind: 'public', image: pub, crn, pass: ' shared\n', profile: built })).toEqual({ rootfsItemHash: pub, crnHash: crn, luksPassphrase: 'shared', luksFor: pub });
	});

	it('the public image as before: the same image keeps its passphrase, an old profile gets it bound', () => {
		expect(imageFields({ kind: 'public', image: pub, crn, pass: '', profile: { rootfsItemHash: pub, luksPassphrase: 'p', luksFor: pub } })).toEqual({ rootfsItemHash: pub, crnHash: crn });
		expect(imageFields({ kind: 'public', image: pub, crn, pass: '', profile: { rootfsItemHash: pub, luksPassphrase: 'p' } })).toEqual({ rootfsItemHash: pub, crnHash: crn, luksFor: pub });
	});
});

describe('a builder started for each build', () => {
	const crn = '0c'.repeat(32);
	const program = {
		allow_amend: false,
		environment: { internet: true },
		metadata: { name: 'paperless-image-builder' },
		payment: { type: 'credit' },
		requirements: { node: { node_hash: crn } },
		resources: { memory: 6144, seconds: 30, vcpus: 2 },
		runtime: { comment: '', ref: '0d'.repeat(32) },
		verification: { backend: 'sev_snp', measurements: [{ platform: 'sev_snp', registers: { launch: 'ab'.repeat(48) } }], policy: 196608 },
		volumes: [{ comment: '', hash_tree: '0e'.repeat(32), ref: 'QmExampleVolumeExampleVolumeExampleVolume12', roothash: '0f'.repeat(32) }],
		workload: { hash_tree: '1a'.repeat(32), ref: 'QmExampleWorkloadExampleWorkloadExample1', roothash: '1b'.repeat(32) }
	};
	// As the app fixes it: no route, which each build gets when it starts.
	const { route: _route, ...fixed } = builder;
	const template = { ...fixed, program, crn };
	const unreachable = () => new BuilderError('not up yet', 'unreachable');

	/** Aleph as far as a build's builder goes: what was sent, in order. */
	function fakeAleph({ refuse = [] } = {}) {
		const sent = [];
		const post = async (message) => {
			sent.push({ type: message.type, hash: message.item_hash, content: JSON.parse(message.item_content), signature: message.signature });
			if (refuse.includes(message.type)) throw new BuilderError('refused');
		};
		return { sent, post };
	}

	it('takes a builder fixed by its content and node, without a route', () => {
		expect(checkBuilder(template)).toBe(template);
		expect(() => checkBuilder({ ...template, crn: 'x' })).toThrow(BuilderError);
		expect(() => checkBuilder({ ...template, program: {} })).toThrow(BuilderError);
	});

	it('signs the fixed V-PROGRAM content as the app, with its own time', async () => {
		const message = await builderMessage(app, template, 1_800_000_000);
		const content = JSON.parse(message.item_content);
		expect(content).toEqual({ ...program, address: app.address, time: 1_800_000_000 });
		expect(message).toMatchObject({ type: 'V-PROGRAM', sender: app.address, item_hash: await sha256Hex(message.item_content) });
		expect(await recoverMessageAddress({ message: ['ETH', app.address, 'V-PROGRAM', message.item_hash].join('\n'), signature: message.signature })).toBe(app.address);
		await expect(builderMessage(app, builder)).rejects.toThrow(BuilderError);
		await expect(builderMessage(app, { ...template, crn: 'x' })).rejects.toThrow(BuilderError);
	});

	it('starts it, waits until it answers attested, builds, and forgets it', async () => {
		const { seen, open } = fakeBuilder();
		const { store } = fakeStore();
		const { sent, post } = fakeAleph();
		const noted = [];
		let routed = null;
		let tries = 0;
		const result = await buildOnOwnBuilder({
			master, app, builder: template, store, post, ...quick(),
			opener: (running) => ((routed = running), async () => (++tries < 3 ? Promise.reject(unreachable()) : open())),
			onStarted: (v) => void noted.push(['started', v, sent.length]),
			onForgotten: (v) => void noted.push(['forgotten', v])
		});
		const vprogram = sent[0].hash;
		expect(sent.map((m) => m.type)).toEqual(['V-PROGRAM', 'FORGET']);
		expect(sent[1].content.hashes).toEqual([vprogram]);
		// Noted once Aleph took it, cleared once it is forgotten.
		expect(noted).toEqual([['started', vprogram, 1], ['forgotten', vprogram]]);
		expect(routed).toMatchObject({ route: `?crn=${crn}&vm=${vprogram}`, vprogram, measurements: builder.measurements });
		expect(tries).toBeGreaterThanOrEqual(3);
		expect(seen.calls.filter((c) => c.path !== '/')[0]).toMatchObject({ method: 'POST', path: '/build' });
		expect(result.rootfsItemHash).toMatch(/^[0-9a-f]{64}$/);
	});

	it('waits while the guest attests but its workload answers "upstream not ready"', async () => {
		let hellos = 0;
		const { seen, open } = fakeBuilder({ 'GET /': () => ({ status: ++hellos < 3 ? 503 : 200, body: new TextEncoder().encode(hellos < 3 ? '{"error":"upstream not ready"}' : '{"service":"paperless-anywhere image builder"}') }) });
		const { store } = fakeStore();
		const { sent, post } = fakeAleph();
		await buildOnOwnBuilder({ master, app, builder: template, store, post, ...quick(), opener: () => open });
		expect(hellos).toBe(3);
		expect(seen.calls.filter((c) => c.path === '/build')).toHaveLength(1);
		expect(sent.map((m) => m.type)).toEqual(['V-PROGRAM', 'FORGET']);
	});

	it('calls the builder busy only when it says so', async () => {
		const { open } = fakeBuilder({ 'POST /build': () => ({ status: 503, body: new TextEncoder().encode('{"error":"busy with another image; try again in a few minutes"}') }) });
		const { post } = fakeAleph();
		await expect(buildOnOwnBuilder({ master, app, builder: template, post, ...quick(), opener: () => open })).rejects.toThrow('baut gerade ein anderes Image');
	});

	it('forgets it also when the build fails', async () => {
		const { open } = fakeBuilder({ 'POST /build': () => ({ status: 500, body: new TextEncoder().encode('{"error":"broken"}') }) });
		const { sent, post } = fakeAleph();
		await expect(buildOnOwnBuilder({ master, app, builder: template, post, ...quick(), opener: () => open })).rejects.toThrow(BuilderError);
		expect(sent.map((m) => m.type)).toEqual(['V-PROGRAM', 'FORGET']);
	});

	it('forgets it when it never answers, and at once when its attestation is refused', async () => {
		const never = fakeAleph();
		await expect(buildOnOwnBuilder({ master, app, builder: template, post: never.post, ...quick(), upTries: 3, opener: () => async () => Promise.reject(unreachable()) })).rejects.toThrow(BuilderError);
		expect(never.sent.map((m) => m.type)).toEqual(['V-PROGRAM', 'FORGET']);
		const refused = fakeAleph();
		let tries = 0;
		await expect(buildOnOwnBuilder({ master, app, builder: template, post: refused.post, ...quick(), opener: () => async () => (tries++, Promise.reject(new Error('launch measurement rejected'))) })).rejects.toThrow('measurement');
		expect(tries).toBe(1);
		expect(refused.sent.map((m) => m.type)).toEqual(['V-PROGRAM', 'FORGET']);
	});

	it('notes nothing and forgets nothing when Aleph refuses the V-PROGRAM (no credits)', async () => {
		const { sent, post } = fakeAleph({ refuse: ['V-PROGRAM'] });
		const noted = [];
		await expect(buildOnOwnBuilder({ master, app, builder: template, post, ...quick(), opener: () => async () => ({}), onStarted: () => void noted.push('started'), onForgotten: () => void noted.push('forgotten') })).rejects.toThrow('refused');
		expect(sent.map((m) => m.type)).toEqual(['V-PROGRAM']);
		expect(noted).toEqual([]);
	});

	it('keeps the note while the FORGET fails', async () => {
		const { sent, post } = fakeAleph({ refuse: ['FORGET'] });
		const noted = [];
		const { open } = fakeBuilder();
		const { store } = fakeStore();
		await buildOnOwnBuilder({ master, app, builder: template, store, post, ...quick(), opener: () => open, onStarted: () => void noted.push('started'), onForgotten: () => void noted.push('forgotten') });
		expect(sent.filter((m) => m.type === 'FORGET').length).toBeGreaterThan(1);
		expect(noted).toEqual(['started']);
	});

	it('offers a build only when the app address holds a day of the builder, the image and what it already pays', async () => {
		const day = (perHour) => Math.ceil((perHour + IMAGE_STORE_CREDITS_PER_HOUR + 1000) * 24);
		const deps = (credits, perHour) => ({ balance: async () => ({ credits }), running: async () => 1000, estimate: async () => perHour });
		expect(await buildAffordable(app, template, deps(0, 85_500))).toEqual({ ok: false, need: day(85_500), have: 0 });
		expect(await buildAffordable(app, template, deps(day(85_500), 85_500))).toMatchObject({ ok: true });
		// Aleph's estimate unreadable: the measured rate.
		expect((await buildAffordable(app, template, deps(0, null))).need).toBe(day(BUILDER_CREDITS_PER_HOUR));
		// The balance unreadable: unknown, the setup offers the build and Aleph decides.
		expect(await buildAffordable(app, template, { balance: async () => { throw new Error('down'); }, running: async () => 0, estimate: async () => 1 })).toEqual({ ok: null, need: null, have: null });
	});

	it('starts none when this window already holds the sealed image, and forgets one a closed window left', async () => {
		const { sent, post } = fakeAleph();
		const { store } = fakeStore();
		const kept = { current: { key: `${app.address.toLowerCase()}/${builder.plain.sha256}`, cid, size: image.length, image: new Blob([image]), attested: null } };
		await buildOnOwnBuilder({ master, app, builder: template, store, post, ...quick(), kept, opener: () => async () => { throw new Error('no builder needed'); } });
		expect(sent).toEqual([]);
		const left = fakeAleph();
		expect(await forgetLeftBuilder(app, { ownBuilder: { vprogram: '2c'.repeat(32) } }, { post: left.post, sleep: async () => {} })).toBe(true);
		expect(left.sent.map((m) => [m.type, m.content.hashes])).toEqual([['FORGET', ['2c'.repeat(32)]]]);
		expect(await forgetLeftBuilder(app, {}, { post: left.post })).toBe(false);
	});
});

describe('a build paid by the package', () => {
	const crn = '0c'.repeat(32);
	const owner = '0x00000000000000000000000000000000000000a5';
	const program = { runtime: { ref: '0d'.repeat(32) }, verification: { measurements: [{ registers: { launch: 'ab'.repeat(48) } }], policy: 196608 }, requirements: { node: { node_hash: crn } } };
	const { route: _r, ...fixed } = builder;
	const template = { ...fixed, program, crn };
	function aleph({ refuse = [] } = {}) {
		const sent = [];
		const post = async (m) => {
			sent.push({ type: m.type, sender: m.sender, content: JSON.parse(m.item_content), hash: m.item_hash });
			if (refuse.includes(m.type)) throw new BuilderError('refused');
		};
		return { sent, post };
	}

	it('sends builder, FORGET and STORE for the sub-account, signed by the app key, and closes the build', async () => {
		const { open } = fakeBuilder();
		const { got, store } = fakeStore();
		const { sent, post } = aleph();
		const done = [];
		const noted = [];
		await buildPaidByPackage({
			master, app, builder: template, store, post, ...quick(), opener: () => open,
			charge: async () => ({ buildId: 'b1', owner }),
			done: async (d) => void done.push(d),
			onStarted: (v, paid) => void noted.push(paid)
		});
		expect(sent.map((m) => [m.type, m.sender, m.content.address])).toEqual([['V-PROGRAM', app.address, owner], ['FORGET', app.address, owner]]);
		expect(JSON.parse(got.message.item_content).address).toBe(owner);
		expect(got.message.sender).toBe(app.address);
		expect(noted).toEqual([{ buildId: 'b1', payer: owner }]);
		expect(done).toEqual([{ buildId: 'b1', failed: false, program: sent[0].hash }]);
	});

	it('asks the charge back when Aleph never took the builder, and keeps it when the build failed later', async () => {
		const refused = aleph({ refuse: ['V-PROGRAM'] });
		const done = [];
		await expect(buildPaidByPackage({ master, app, builder: template, post: refused.post, ...quick(), opener: () => async () => ({}), charge: async () => ({ buildId: 'b2', owner }), done: async (d) => void done.push(d) })).rejects.toThrow('refused');
		expect(done).toEqual([{ buildId: 'b2', failed: true, program: null }]);
		const { open } = fakeBuilder({ 'POST /build': () => ({ status: 500, body: new TextEncoder().encode('{}') }) });
		const later = aleph();
		await expect(buildPaidByPackage({ master, app, builder: template, post: later.post, ...quick(), opener: () => open, charge: async () => ({ buildId: 'b3', owner }), done: async (d) => void done.push(d) })).rejects.toThrow(BuilderError);
		expect(done.at(-1)).toEqual({ buildId: 'b3', failed: true, program: later.sent[0].hash });
		// Nothing is started when the service charged nothing.
		const none = aleph();
		await expect(buildPaidByPackage({ master, app, builder: template, post: none.post, ...quick(), opener: () => open, charge: async () => { throw new Error('402'); }, done: async () => {} })).rejects.toThrow('402');
		expect(none.sent).toEqual([]);
	});

	it('forgets a builder a closed window left in the payer\'s name', async () => {
		const { sent, post } = aleph();
		expect(await forgetLeftBuilder(app, { ownBuilder: { vprogram: '3d'.repeat(32), payer: owner } }, { post, sleep: async () => {} })).toBe(true);
		expect(sent.map((m) => [m.type, m.content.address, m.content.hashes])).toEqual([['FORGET', owner, ['3d'.repeat(32)]]]);
	});
});

describe('what the overview says about the image', () => {
	const own = { rootfsItemHash: 'aa'.repeat(32), luksFor: 'aa'.repeat(32), ownImage: { plainSha256: builder.plain.sha256, builtAt: '2026-11-15T08:00:00Z' } };
	it('an own image, when it was built, and whether the builder holds a newer plain image', () => {
		expect(imageStatus(own, builder)).toEqual({ own: true, builtAt: '2026-11-15T08:00:00Z', buildsAtStart: false, newer: false });
		expect(imageStatus({ ...own, ownImage: { ...own.ownImage, plainSha256: '00'.repeat(32) } }, builder).newer).toBe(true);
	});
	it('nothing own yet: built at the first start, or the public image', () => {
		expect(imageStatus({}, builder, { buildsAtStart: true })).toEqual({ own: false, builtAt: null, buildsAtStart: true, newer: false });
		expect(imageStatus({ rootfsItemHash: 'bb'.repeat(32), luksPassphrase: 'p' }, builder)).toEqual({ own: false, builtAt: null, buildsAtStart: false, newer: false });
		// An own image noted, but the profile boots another one: not own.
		expect(imageStatus({ ...own, rootfsItemHash: 'cc'.repeat(32) }, builder).own).toBe(false);
	});
});
