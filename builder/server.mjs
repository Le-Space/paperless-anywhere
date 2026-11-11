// Starts the image builder on 127.0.0.1:8080, where Aleph's attestation agent
// forwards what arrives on the VM's attested TLS port. See builder.mjs.
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream, openAsBlob } from 'node:fs';
import { mkdir, rm, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { importer } from 'ipfs-unixfs-importer';
import { createBuilder, handler } from './builder.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const api = (process.env.ALEPH_API || 'https://api2.aleph.im').replace(/\/+$/, '');
const work = process.env.BUILDER_WORK || '/work';
await mkdir(work, { recursive: true, mode: 0o700 });

/** Streams `url` into `path`, at most `max` bytes, and says what arrived. */
async function download(url, path, max) {
	const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(15 * 60_000) });
	if (!response.ok || !response.body) throw new Error(`the download answered ${response.status}`);
	const hash = createHash('sha256');
	const out = createWriteStream(path, { mode: 0o600 });
	let size = 0;
	try {
		for await (const part of response.body) {
			size += part.length;
			if (size > max) throw new Error('the plain image is larger than Aleph takes in one upload');
			hash.update(part);
			if (!out.write(part)) await new Promise((resolve) => out.once('drain', resolve));
		}
	} finally {
		await new Promise((resolve) => out.end(resolve));
	}
	return { sha256: hash.digest('hex'), size };
}

/** The passphrase reaches cryptsetup on stdin only: no file, no argument, no environment. */
function encrypt(path, passphrase) {
	return new Promise((resolve, reject) => {
		const child = spawn(join(here, 'encrypt-image.sh'), [path], { stdio: ['pipe', 'ignore', 'inherit'] });
		child.on('error', reject);
		child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error('the encryption failed'))));
		child.stdin.end(passphrase);
	});
}

/** `ipfs add` defaults, which is the CID Aleph's node makes and compares. */
async function cidOf(path) {
	const sink = { put: async (cid) => cid, get: async () => { throw new Error('no blocks kept'); }, has: async () => false };
	let last;
	for await (const entry of importer([{ content: createReadStream(path) }], sink, { cidVersion: 0, rawLeaves: false, reduceSingleLeafToSelf: true })) last = entry;
	return last.cid.toString();
}

async function upload(path, message) {
	const form = new FormData();
	form.append('file', await openAsBlob(path), 'rootfs');
	form.append('metadata', JSON.stringify({ message, sync: true }));
	const response = await fetch(`${api}/api/v0/ipfs/add_file`, { method: 'POST', body: form, signal: AbortSignal.timeout(60 * 60_000) });
	const text = await response.text();
	let cid;
	try { cid = JSON.parse(text)?.hash; } catch { /* no JSON: the status says enough */ }
	return { status: response.status, cid };
}

const builder = createBuilder({
	api,
	download,
	encrypt,
	cidOf,
	upload,
	sizeOf: async (path) => (await stat(path)).size,
	remove: (path) => rm(path, { force: true }),
	getJson: async (url) => (await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(30_000) })).json(),
	pathFor: (job) => join(work, `${job}.img`)
});

createServer(handler(builder)).listen(8080, '127.0.0.1', () => console.log('image builder on 127.0.0.1:8080'));
