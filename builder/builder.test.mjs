import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkBuildRequest, createBuilder, explain, JOB_TTL_MS, MAX_PIECE_BYTES, pieceOf, Refused } from './builder.mjs';

const sha256 = 'cd'.repeat(32);
const passphrase = 'x'.repeat(44);
const cid = 'QmExampleExampleExampleExampleExampleExample12';

function setup(over = {}) {
	const seen = { unpacked: [], encrypted: [], removed: [] };
	let time = 1000;
	const builder = createBuilder({
		plainPath: '/plain/image.gz',
		unpack: async (from, to) => (seen.unpacked.push([from, to]), { sha256, size: 4096 }),
		encrypt: async (path, pass) => void seen.encrypted.push([path, pass]),
		cidOf: async () => cid,
		sizeOf: async () => 8192,
		remove: async (path) => void seen.removed.push(path),
		pathFor: (job) => `/work/${job}.img`,
		now: () => time,
		...over
	});
	return { builder, seen, later: (ms) => (time += ms) };
}

const refusal = (status) => (error) => error instanceof Refused && error.status === status;

test('a build request needs the image\'s hash and a long one-line passphrase', () => {
	assert.deepEqual(checkBuildRequest({ sha256, passphrase }), { sha256, passphrase });
	for (const bad of [null, { passphrase }, { sha256: 'xyz', passphrase }, { sha256, passphrase: 'short' }, { sha256, passphrase: `${passphrase}\n` }]) {
		assert.throws(() => checkBuildRequest(bad), refusal(400));
	}
});

test('seals the image from the volume and hands it back in pieces', async () => {
	const { builder, seen } = setup();
	assert.deepEqual(builder.info(), { service: 'paperless-anywhere image builder', plain: null });
	const { job, done } = await builder.build({ sha256, passphrase });
	await assert.rejects(builder.piece(job, undefined), refusal(409));
	await done;
	assert.deepEqual(await builder.status(job), { state: 'built', cid, size: 8192 });
	assert.deepEqual(seen.unpacked, [['/plain/image.gz', `/work/${job}.img`]]);
	assert.deepEqual(seen.encrypted, [[`/work/${job}.img`, passphrase]]);
	assert.deepEqual(builder.info().plain, { sha256, size: 4096 });
	assert.deepEqual(await builder.piece(job, 'bytes=0-4095'), { path: `/work/${job}.img`, size: 8192, start: 0, end: 4095, partial: true });
	assert.deepEqual(await builder.piece(job, 'bytes=4096-99999'), { path: `/work/${job}.img`, size: 8192, start: 4096, end: 8191, partial: true });
	assert.deepEqual(await builder.forget(job), { removed: true });
	assert.deepEqual(seen.removed, [`/work/${job}.img`]);
	await assert.rejects(builder.status(job), refusal(404));
});

test('a piece is a plain byte range inside the image, of bounded size', () => {
	assert.deepEqual(pieceOf(undefined, 100), { start: 0, end: 99, partial: false });
	assert.deepEqual(pieceOf('bytes=10-19', 100), { start: 10, end: 19, partial: true });
	for (const bad of ['bytes=5-', 'bytes=-5', 'items=0-1', 'bytes=0-1,5-6', 'bytes=200-300', 'bytes=9-3']) assert.throws(() => pieceOf(bad, 100), refusal(416));
	assert.throws(() => pieceOf(`bytes=0-${MAX_PIECE_BYTES}`, 10 * MAX_PIECE_BYTES), refusal(416));
});

test('never answers with the passphrase', async () => {
	const { builder } = setup();
	const { job, done } = await builder.build({ sha256, passphrase });
	await done;
	const said = JSON.stringify([builder.info(), await builder.status(job), await builder.piece(job, 'bytes=0-1'), await builder.forget(job)]);
	assert.ok(!said.includes(passphrase));
});

test('seals nothing but the image that was asked for', async () => {
	const { builder, seen } = setup({ unpack: async () => ({ sha256: '00'.repeat(32), size: 4096 }) });
	const { job, done } = await builder.build({ sha256, passphrase });
	await done;
	assert.deepEqual(await builder.status(job), { state: 'failed', error: 'the plain image here is not the one asked for' });
	assert.equal(seen.encrypted.length, 0);
	assert.equal(seen.removed.length, 1);
});

test('one image at a time, and a job is known by its own id only', async () => {
	let finish;
	const gate = new Promise((resolve) => (finish = resolve));
	const { builder } = setup({ unpack: async () => (await gate, { sha256, size: 4096 }) });
	const { job, done } = await builder.build({ sha256, passphrase });
	// While it builds: no second job, and it cannot be removed.
	await assert.rejects(builder.build({ sha256, passphrase }), refusal(503));
	await assert.rejects(builder.forget(job), refusal(409));
	finish();
	await done;
	await assert.rejects(builder.build({ sha256, passphrase }), refusal(503));
	for (const call of [(id) => builder.status(id), (id) => builder.piece(id, 'bytes=0-1'), (id) => builder.forget(id)]) await assert.rejects(call('00'.repeat(24)), refusal(404));
	assert.equal((await builder.status(job)).state, 'built');
});

test('an image nobody touches is removed after a while; fetching keeps it', async () => {
	const { builder, seen, later } = setup();
	const { job, done } = await builder.build({ sha256, passphrase });
	await done;
	later(JOB_TTL_MS - 1);
	await builder.piece(job, 'bytes=0-1');
	later(JOB_TTL_MS - 1);
	assert.equal((await builder.status(job)).state, 'built');
	later(JOB_TTL_MS + 1);
	await assert.rejects(builder.status(job), refusal(404));
	assert.equal(seen.removed.length, 1);
	await builder.build({ sha256, passphrase });
});

test('a failed step says what lies behind it', async () => {
	const failed = new Error('unpack failed', { cause: Object.assign(new Error('no such file'), { code: 'ENOENT' }) });
	assert.equal(explain(failed), 'unpack failed: ENOENT no such file');
	const { builder } = setup({ unpack: async () => { throw failed; } });
	const { job, done } = await builder.build({ sha256, passphrase });
	await done;
	assert.deepEqual(await builder.status(job), { state: 'failed', error: 'unpack failed: ENOENT no such file' });
	// A failed job does not block the next one.
	await builder.build({ sha256, passphrase });
});
