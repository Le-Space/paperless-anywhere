import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { checkBuildRequest, checkStoreMessage, createBuilder, JOB_TTL_MS, Refused } from './builder.mjs';

const store = 'ab'.repeat(32);
const sha256 = 'cd'.repeat(32);
const passphrase = 'x'.repeat(44);
const cid = 'QmExampleExampleExampleExampleExampleExample12';

function storeMessage(over = {}, contentOver = {}) {
	const sender = '0x' + '11'.repeat(20);
	const item_content = JSON.stringify({ address: sender, time: 1, item_type: 'ipfs', item_hash: cid, payment: { type: 'credit' }, ...contentOver });
	return { sender, chain: 'ETH', type: 'STORE', item_type: 'inline', item_content, item_hash: createHash('sha256').update(item_content).digest('hex'), signature: '0xsigned', ...over };
}

function setup(over = {}) {
	const seen = { encrypted: [], removed: [], uploaded: [] };
	let time = 1000;
	const builder = createBuilder({
		api: 'https://api.example.test',
		getJson: async () => ({ type: 'STORE', content: { item_hash: 'ef'.repeat(32) } }),
		download: async () => ({ sha256, size: 4096 }),
		encrypt: async (path, pass) => void seen.encrypted.push([path, pass]),
		cidOf: async () => cid,
		sizeOf: async () => 8192,
		upload: async (path, message) => (seen.uploaded.push([path, message]), { status: 200, cid }),
		remove: async (path) => void seen.removed.push(path),
		pathFor: (job) => `/work/${job}.img`,
		now: () => time,
		...over
	});
	return { builder, seen, later: (ms) => (time += ms) };
}

const refusal = (status) => (error) => error instanceof Refused && error.status === status;

test('a build request needs the image, its hash and a long one-line passphrase', () => {
	assert.deepEqual(checkBuildRequest({ store, sha256, passphrase }), { store, sha256, passphrase });
	for (const bad of [null, { sha256, passphrase }, { store, sha256: 'xyz', passphrase }, { store, sha256, passphrase: 'short' }, { store, sha256, passphrase: `${passphrase}\n` }]) {
		assert.throws(() => checkBuildRequest(bad), refusal(400));
	}
});

test('builds, then uploads only beside a message that names the built file', async () => {
	const { builder, seen } = setup();
	const { job, done } = await builder.build({ store, sha256, passphrase });
	await done;
	assert.deepEqual(await builder.status(job), { state: 'built', cid, size: 8192 });
	assert.deepEqual(seen.encrypted, [[`/work/${job}.img`, passphrase]]);

	await assert.rejects(builder.publish(job, { message: storeMessage({}, { item_hash: 'QmAnotherFile' }) }), refusal(409));
	assert.equal(seen.uploaded.length, 0);

	const message = storeMessage();
	assert.deepEqual(await builder.publish(job, { message }), { item_hash: message.item_hash, cid });
	assert.deepEqual(seen.removed, [`/work/${job}.img`]);
	assert.deepEqual(await builder.status(job), { state: 'published', cid, size: 8192 });
});

test('never answers with the passphrase', async () => {
	const { builder } = setup();
	const { job, done } = await builder.build({ store, sha256, passphrase });
	await done;
	const said = JSON.stringify([await builder.status(job), await builder.publish(job, { message: storeMessage() })]);
	assert.ok(!said.includes(passphrase));
});

test('encrypts nothing but the image that was asked for', async () => {
	const { builder, seen } = setup({ download: async () => ({ sha256: '00'.repeat(32), size: 4096 }) });
	const { job, done } = await builder.build({ store, sha256, passphrase });
	await done;
	assert.equal((await builder.status(job)).state, 'failed');
	assert.equal(seen.encrypted.length, 0);
	assert.equal(seen.removed.length, 1);
});

test('one image at a time, and a job is known by its own id only', async () => {
	const { builder } = setup();
	const { job, done } = await builder.build({ store, sha256, passphrase });
	await assert.rejects(builder.build({ store, sha256, passphrase }), refusal(503));
	await done;
	await assert.rejects(builder.status('00'.repeat(24)), refusal(404));
	await assert.rejects(builder.publish('00'.repeat(24), { message: storeMessage() }), refusal(404));
	assert.equal((await builder.status(job)).state, 'built');
});

test('an image nobody fetched is removed after a while', async () => {
	const { builder, seen, later } = setup();
	const { job, done } = await builder.build({ store, sha256, passphrase });
	await done;
	later(JOB_TTL_MS + 1);
	await assert.rejects(builder.status(job), refusal(404));
	assert.equal(seen.removed.length, 1);
	await builder.build({ store, sha256, passphrase });
});

test('a failed upload keeps the image for another try', async () => {
	let calls = 0;
	const { builder } = setup({ upload: async () => (++calls === 1 ? { status: 422 } : { status: 200, cid }) });
	const { job, done } = await builder.build({ store, sha256, passphrase });
	await done;
	await assert.rejects(builder.publish(job, { message: storeMessage() }), refusal(502));
	assert.equal((await builder.status(job)).state, 'built');
	await builder.publish(job, { message: storeMessage() });
});

test('a STORE message must be whole', () => {
	assert.throws(() => checkStoreMessage(storeMessage({ signature: '' }), cid), refusal(400));
	assert.throws(() => checkStoreMessage(storeMessage({ item_hash: '00'.repeat(32) }), cid), refusal(400));
	assert.throws(() => checkStoreMessage(storeMessage({ type: 'POST' }), cid), refusal(400));
	assert.throws(() => checkStoreMessage(storeMessage({ sender: '0x' + '22'.repeat(20) }), cid), refusal(400));
});
