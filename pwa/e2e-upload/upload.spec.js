// Uploads a file of random bytes the size of a sealed image (UPLOAD_MIB,
// 868 by default) from Chromium to Aleph, as "Mein Image bauen" does, then
// waits until Aleph has processed the STORE and forgets it again. Measures
// each part. Random bytes, like an encrypted disk: nothing to compress.
//
// UPLOAD_KEY pays the storage for the minutes the file lies there. Without
// it (DRY=1 is implied) the test signs with a throwaway key and stops before
// anything leaves the machine.
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdtemp, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { expect, test } from '@playwright/test';
import { importer } from 'ipfs-unixfs-importer';
import { privateKeyToAccount } from 'viem/accounts';
import { storeMessage } from '../src/lib/own-image.js';
import { forgetInstance } from '../src/lib/vm.js';
import { ALEPH_API } from '../src/lib/aleph.js';

const MIB = Number(process.env.UPLOAD_MIB ?? 868);
const KEY = process.env.UPLOAD_KEY ?? '';
const DRY = !KEY || process.env.DRY === '1';
const RESULT = process.env.UPLOAD_RESULT ?? '';

/** The CID Aleph's node makes of a file (`ipfs add` defaults), as builder/server.mjs computes it. */
async function cidOf(path) {
	const sink = { put: async (cid) => cid, get: async () => { throw new Error('no blocks kept'); }, has: async () => false };
	let last;
	for await (const entry of importer([{ content: createReadStream(path) }], sink, { cidVersion: 0, rawLeaves: false, reduceSingleLeafToSelf: true })) last = entry;
	return last.cid.toString();
}

async function randomFile(path, mib) {
	const out = createWriteStream(path);
	for (let i = 0; i < mib; i++) if (!out.write(randomBytes(1024 * 1024))) await once(out, 'drain');
	out.end();
	await once(out, 'finish');
}

const statusOf = async (hash) => (await (await fetch(`${ALEPH_API}/api/v0/messages/${hash}`, { cache: 'no-store' }).catch(() => null))?.json().catch(() => null))?.status ?? null;

test('a sealed image\'s size, from a browser to Aleph', async ({ page }) => {
	const seconds = (t) => Math.round((Date.now() - t) / 100) / 10;
	const result = { mib: MIB, dry: DRY };
	const dir = await mkdtemp(join(tmpdir(), 'upload-'));
	const file = join(dir, 'image.bin');
	let stored = null;
	/** @type {import('node:http').Server | null} */
	let server = null;
	const account = privateKeyToAccount(DRY ? `0x${randomBytes(32).toString('hex')}` : /** @type {`0x${string}`} */ (KEY));
	try {
		await randomFile(file, MIB);
		expect((await stat(file)).size).toBe(MIB * 1024 * 1024);
		let t = Date.now();
		const cid = await cidOf(file);
		result.cidSeconds = seconds(t);
		const message = await storeMessage(account, cid);
		result.store = message.item_hash;

		// The page gets the file as the app gets the sealed image: as a Blob in
		// memory. Served from a local server beside the page (Playwright's own
		// routing cannot carry more than 512 MiB).
		server = createServer((req, res) => {
			res.writeHead(200, { 'content-type': 'application/octet-stream', 'access-control-allow-origin': '*' });
			createReadStream(file).pipe(res);
		}).listen(4452, '127.0.0.1');
		await once(server, 'listening');
		await page.goto('/');
		t = Date.now();
		await page.evaluate(async () => {
			globalThis.__image = await (await fetch('http://127.0.0.1:4452/image.bin')).blob();
		});
		result.intoBrowserSeconds = seconds(t);
		expect(await page.evaluate(() => globalThis.__image.size)).toBe(MIB * 1024 * 1024);
		// The app's own upload code, loaded in the page: what a live run calls.
		expect(await page.evaluate(async () => typeof (await import('/src/lib/own-image.js')).storeOnAleph)).toBe('function');
		if (DRY) {
			result.note = 'dry: signed with a throwaway key, nothing uploaded';
			return;
		}

		t = Date.now();
		stored = message.item_hash;
		const answer = await page.evaluate(async (message) => {
			const { storeOnAleph } = await import('/src/lib/own-image.js');
			return storeOnAleph(globalThis.__image, message);
		}, message);
		result.uploadSeconds = seconds(t);
		result.uploadStatus = answer.status;
		if (answer.reason) result.uploadReason = answer.reason;
		result.mibPerSecond = Math.round((MIB / result.uploadSeconds) * 100) / 100;
		expect(answer.status, 'Aleph took the upload').toBeLessThan(300);
		expect(answer.cid, 'Aleph made the same CID').toBe(cid);

		t = Date.now();
		let status = null;
		while (Date.now() - t < 20 * 60_000 && status !== 'processed' && status !== 'rejected') {
			await new Promise((r) => setTimeout(r, 10_000));
			status = await statusOf(message.item_hash);
		}
		result.processedSeconds = seconds(t);
		result.storeStatus = status;
		expect(status).toBe('processed');
	} finally {
		// Forget it, whatever happened: the file was only there to be measured.
		if (stored) {
			try {
				await forgetInstance(account, account.address, stored, 'paperless-anywhere: upload measurement');
				result.forgotten = await statusOf(stored);
			} catch (error) {
				result.forgetError = String(error?.message ?? error).slice(0, 200);
			}
		}
		server?.close();
		await rm(dir, { recursive: true, force: true });
		console.log(JSON.stringify(result, null, 1));
		if (RESULT) await writeFile(RESULT, JSON.stringify(result, null, 1));
	}
});
