// check-container.mjs: runs inside the builder's container (docs/own-image.md)
// and drives one whole job as on Aleph: no network, the plain image gzipped
// on a "volume", the sealed image fetched back in pieces. Then it asks
// cryptsetup whether what came back opens with the passphrase.
import { execFileSync, spawn } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

// Half noise, half zeros, as a filesystem image is.
const plain = Buffer.concat([randomBytes(4 * 1024 * 1024), Buffer.alloc(4 * 1024 * 1024)]);
const sha256 = createHash('sha256').update(plain).digest('hex');
const passphrase = randomBytes(32).toString('base64');
mkdirSync('/tmp/plain', { recursive: true });
writeFileSync('/tmp/plain/paperless-plain.ext4.gz', gzipSync(plain));

const server = spawn('node', ['server.mjs'], { env: { ...process.env, BUILDER_PLAIN: '/tmp/plain/paperless-plain.ext4.gz', BUILDER_WORK: '/tmp/work' }, stdio: 'inherit' });
const at = (path) => `http://127.0.0.1:8080${path}`;
const call = async (path, init) => {
	const response = await fetch(at(path), init);
	return { status: response.status, ...(await response.json()) };
};
const check = (ok, what) => {
	console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
	if (!ok) process.exitCode = 1;
};
try {
	await new Promise((resolve) => setTimeout(resolve, 1500));
	check((await call('/')).plain === null, 'says who it is');
	const wrong = await call('/build', { method: 'POST', body: JSON.stringify({ sha256: '00'.repeat(32), passphrase }) });
	check(wrong.status === 202, 'a build for another image is accepted …');
	// … and fails, because the image on the volume is not that one.
	await new Promise((resolve) => setTimeout(resolve, 3000));
	check((await call(`/job/${wrong.job}`)).state === 'failed', '… and fails: the image on the volume is not that one');
	const { job, status } = await call('/build', { method: 'POST', body: JSON.stringify({ sha256, passphrase }) });
	check(status === 202 && job, 'the build is accepted (the failed one before does not block it)');
	check((await call('/build', { method: 'POST', body: JSON.stringify({ sha256, passphrase }) })).status === 503, 'a second build has to wait');
	let state;
	for (let i = 0; i < 120 && (state = await call(`/job/${job}`)).state === 'building'; i++) await new Promise((resolve) => setTimeout(resolve, 1000));
	check(state.state === 'built' && state.size === plain.length + 32 * 1048576, `built: ${state.state}, ${state.size} bytes${state.error ? `, ${state.error}` : ''}`);
	check((await call('/')).plain?.sha256 === sha256, 'knows which plain image it holds');

	// Fetch it back in pieces of 4 MiB, as the app does.
	const pieces = [];
	const step = 4 * 1024 * 1024;
	for (let start = 0; start < state.size; start += step) {
		const response = await fetch(at(`/job/${job}/image`), { headers: { range: `bytes=${start}-${Math.min(start + step, state.size) - 1}` } });
		if (response.status !== 206) throw new Error(`a piece answered ${response.status}`);
		pieces.push(Buffer.from(await response.arrayBuffer()));
	}
	const image = Buffer.concat(pieces);
	check(image.length === state.size, `fetched back in ${pieces.length} pieces`);
	check((await fetch(at(`/job/${job}/image`), { headers: { range: 'bytes=0-99999999' } })).status === 416, 'a piece larger than allowed is refused');
	writeFileSync('/tmp/fetched.img', image);
	const opens = (pass) => {
		try {
			execFileSync('cryptsetup', ['open', '--test-passphrase', '--key-file', '-', '/tmp/fetched.img'], { input: pass, stdio: ['pipe', 'ignore', 'ignore'] });
			return true;
		} catch {
			return false;
		}
	};
	check(opens(passphrase), 'the fetched image opens with the passphrase');
	check(!opens('another passphrase, long enough to be one'), 'and with no other');
	check(!image.includes(plain.subarray(0, 64)), 'the plain image is not in it');
	check((await call(`/job/${job}`, { method: 'DELETE' })).removed === true, 'the caller removes it');
	check(execFileSync('sh', ['-c', 'ls /tmp/work | wc -l']).toString().trim() === '0', 'nothing is left in the work directory');
} finally {
	server.kill();
	setTimeout(() => process.exit(), 200);
}
