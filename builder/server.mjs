// Starts the image builder on 127.0.0.1:8080, where Aleph's attestation agent
// forwards what arrives on the VM's attested TLS port. See builder.mjs.
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream, openAsBlob } from 'node:fs';
import { mkdir, rm, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname, join } from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import { createGunzip } from 'node:zlib';
import { importer } from 'ipfs-unixfs-importer';
import { createBuilder, handler } from './builder.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const api = (process.env.ALEPH_API || 'https://api2.aleph.im').replace(/\/+$/, '');
const work = process.env.BUILDER_WORK || '/work';
await mkdir(work, { recursive: true, mode: 0o700 });

/**
 * Streams `url` into `path` and says what arrived. The plain image is stored
 * gzipped on Aleph (the image workflow says why); it is unpacked on the way,
 * and both the limit and the SHA-256 are those of the unpacked image, which is
 * what gets sealed. A file that is not gzipped is taken as it is.
 */
async function download(url, path, max) {
	const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(15 * 60_000) });
	if (!response.ok || !response.body) throw new Error(`the download answered ${response.status}`);
	const parts = Readable.fromWeb(response.body)[Symbol.asyncIterator]();
	const first = await parts.next();
	const head = first.done ? Buffer.alloc(0) : Buffer.from(first.value);
	const gzipped = head.length >= 2 && head[0] === 0x1f && head[1] === 0x8b;
	async function* all() {
		if (head.length) yield head;
		for (let next = await parts.next(); !next.done; next = await parts.next()) yield next.value;
	}
	const hash = createHash('sha256');
	let size = 0;
	const measure = new Transform({
		transform(part, _encoding, done) {
			size += part.length;
			// Checked on the unpacked bytes, so a small file cannot unpack into a huge one.
			if (size > max) return done(new Error('the plain image is larger than Aleph takes in one upload'));
			hash.update(part);
			done(null, part);
		}
	});
	await pipeline([Readable.from(all()), ...(gzipped ? [createGunzip()] : []), measure, createWriteStream(path, { mode: 0o600 })]);
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
