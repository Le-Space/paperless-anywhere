// check-container.mjs: runs inside the builder's container (docs/own-image.md)
// and drives one whole job against a stand-in for Aleph's API on this host:
// download, encryption, the CID, the upload beside a STORE message. Then it
// asks cryptsetup whether the uploaded file opens with the passphrase.
import { execFileSync, spawn } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { gzipSync } from 'node:zlib';

// Half noise, half zeros, as a filesystem image is; stored gzipped, as on Aleph.
const plain = Buffer.concat([randomBytes(4 * 1024 * 1024), Buffer.alloc(4 * 1024 * 1024)]);
const stored = gzipSync(plain);
const sha256 = createHash('sha256').update(plain).digest('hex');
const store = 'ab'.repeat(32);
const passphrase = randomBytes(32).toString('base64');
let uploaded;

createServer(async (req, res) => {
	if (req.url === `/api/v0/messages/${store}`) return res.end(JSON.stringify({ type: 'STORE', content: { item_hash: 'cd'.repeat(32) } }));
	if (req.url === `/api/v0/storage/raw/${'cd'.repeat(32)}`) return res.end(stored);
	if (req.url === '/api/v0/ipfs/add_file') {
		const form = await new Request('http://x', { method: 'POST', headers: req.headers, body: req, duplex: 'half' }).formData();
		uploaded = { file: Buffer.from(await form.get('file').arrayBuffer()), metadata: JSON.parse(form.get('metadata')) };
		return res.end(JSON.stringify({ status: 'success' }));
	}
	res.writeHead(404).end();
}).listen(9000, '127.0.0.1');

const server = spawn('node', ['server.mjs'], { env: { ...process.env, ALEPH_API: 'http://127.0.0.1:9000', BUILDER_WORK: '/tmp/work' }, stdio: 'inherit' });
const call = async (path, body) => {
	const response = await fetch(`http://127.0.0.1:8080${path}`, body ? { method: 'POST', body: JSON.stringify(body) } : {});
	return { status: response.status, ...(await response.json()) };
};
const check = (ok, what) => {
	console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
	if (!ok) process.exitCode = 1;
};
try {
	await new Promise((resolve) => setTimeout(resolve, 1500));
	const { job, status } = await call('/build', { store, sha256, passphrase });
	check(status === 202 && job, 'the build is accepted');
	check((await call('/build', { store, sha256, passphrase })).status === 503, 'a second build has to wait');
	let state;
	for (let i = 0; i < 120 && (state = await call(`/job/${job}`)).state === 'building'; i++) await new Promise((resolve) => setTimeout(resolve, 1000));
	check(state.state === 'built' && state.size === plain.length + 32 * 1048576, `built: ${state.state}, ${state.size} bytes${state.error ? `, ${state.error}` : ''}`);
	const sender = '0x' + '11'.repeat(20);
	const item_content = JSON.stringify({ address: sender, time: 1, item_type: 'ipfs', item_hash: state.cid, payment: { type: 'credit' } });
	const message = { sender, chain: 'ETH', type: 'STORE', item_type: 'inline', item_content, item_hash: createHash('sha256').update(item_content).digest('hex'), signature: '0xstand-in' };
	const published = await call(`/job/${job}/publish`, { message });
	check(published.status === 200 && published.item_hash === message.item_hash, 'published beside the STORE message');
	check(uploaded?.metadata?.message?.item_hash === message.item_hash, 'the stand-in got the message');
	writeFileSync('/tmp/uploaded.img', uploaded.file);
	const opens = (pass) => {
		try {
			execFileSync('cryptsetup', ['open', '--test-passphrase', '--key-file', '-', '/tmp/uploaded.img'], { input: pass, stdio: ['pipe', 'ignore', 'ignore'] });
			return true;
		} catch {
			return false;
		}
	};
	check(opens(passphrase), 'the uploaded image opens with the passphrase');
	check(!opens('another passphrase, long enough to be one'), 'and with no other');
	check(!uploaded.file.includes(plain.subarray(0, 64)), 'the plain image is not in it');
	check(execFileSync('sh', ['-c', 'ls /tmp/work | wc -l']).toString().trim() === '0', 'nothing is left in the work directory');
} finally {
	server.kill();
	setTimeout(() => process.exit(), 200);
}
