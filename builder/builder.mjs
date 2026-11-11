// The image builder: gives a person an encrypted copy of the public Paperless
// image, sealed with a passphrase only their vault knows.
//
// It is meant to run measured (an Aleph V-PROGRAM, docs/own-image.md): the app
// checks the attestation first, so it knows this code is what receives the
// passphrase. The builder keeps nothing: one job at a time, the passphrase
// goes to cryptsetup's stdin and nowhere else, and the files of a job are
// removed when it is published, fails or gets too old.
//
//   POST /build                {store, sha256, passphrase} → 202 {job}
//   GET  /job/<job>            → {state, cid?, size?, error?}
//   POST /job/<job>/publish    {message} → {item_hash}
//
// The app, not the builder, signs the STORE message (with the vault's app
// key, which also pays for the storage). The builder only uploads the file
// beside it, and only if the message names exactly the file it made.
import { createHash, randomBytes } from 'node:crypto';

const HEX64 = /^[0-9a-f]{64}$/;
export const MAX_IMAGE_BYTES = 1024 * 1024 * 1024 - 32 * 1024 * 1024; // Aleph takes 1 GiB in one upload
export const JOB_TTL_MS = 20 * 60 * 1000;
const MAX_BODY = 16 * 1024;

export class Refused extends Error {
	/** @param {number} status @param {string} message */
	constructor(status, message) {
		super(message);
		this.status = status;
	}
}

/** What a build request must look like. */
export function checkBuildRequest(body) {
	if (!body || typeof body !== 'object') throw new Refused(400, 'expected a JSON object');
	const { store, sha256, passphrase } = body;
	if (!HEX64.test(store ?? '')) throw new Refused(400, 'store: the item hash of the plain image (64 hex)');
	if (!HEX64.test(sha256 ?? '')) throw new Refused(400, 'sha256: the SHA-256 of the plain image (64 hex)');
	if (typeof passphrase !== 'string' || passphrase.length < 32 || passphrase.length > 256 || /[\r\n\0]/.test(passphrase)) {
		throw new Refused(400, 'passphrase: 32 to 256 characters, one line');
	}
	return { store, sha256, passphrase };
}

/** A STORE message that names exactly `cid`, or a refusal. The signature is Aleph's to check. */
export function checkStoreMessage(message, cid) {
	if (!message || message.type !== 'STORE' || message.item_type !== 'inline') throw new Refused(400, 'expected an inline STORE message');
	if (typeof message.item_content !== 'string' || typeof message.signature !== 'string' || !message.signature) throw new Refused(400, 'the message has no content or no signature');
	if (createHash('sha256').update(message.item_content).digest('hex') !== message.item_hash) throw new Refused(400, 'item_hash is not the hash of item_content');
	let content;
	try {
		content = JSON.parse(message.item_content);
	} catch {
		throw new Refused(400, 'item_content is no JSON');
	}
	if (content.item_type !== 'ipfs' || content.item_hash !== cid) throw new Refused(409, 'the message names another file than the one built');
	if (content.address !== message.sender) throw new Refused(400, 'the message is not from the address it stores for');
	return message;
}

/**
 * @param {{
 *   api: string,
 *   download: (url: string, path: string, max: number) => Promise<{ sha256: string, size: number }>,
 *   encrypt: (path: string, passphrase: string) => Promise<void>,
 *   cidOf: (path: string) => Promise<string>,
 *   sizeOf: (path: string) => Promise<number>,
 *   upload: (path: string, message: object) => Promise<{ status: number, cid?: string }>,
 *   remove: (path: string) => Promise<void>,
 *   getJson: (url: string) => Promise<any>,
 *   pathFor: (job: string) => string,
 *   now?: () => number
 * }} deps
 */
export function createBuilder(deps) {
	const now = deps.now ?? Date.now;
	/** @type {null | { id: string, state: string, path: string, started: number, cid?: string, size?: number, error?: string }} */
	let job = null;

	const drop = async () => {
		const old = job;
		job = null;
		if (old) await deps.remove(old.path).catch(() => {});
	};
	const expire = async () => {
		if (job && job.state !== 'building' && job.state !== 'publishing' && now() - job.started > JOB_TTL_MS) await drop();
	};
	const view = (j) => ({ state: j.state, ...(j.cid ? { cid: j.cid, size: j.size } : {}), ...(j.error ? { error: j.error } : {}) });
	const mine = (id) => {
		if (!job || job.id !== id) throw new Refused(404, 'no such job');
		return job;
	};

	async function run(j, { store, sha256 }, passphrase) {
		try {
			const message = await deps.getJson(`${deps.api}/api/v0/messages/${store}`);
			const content = message?.message?.content ?? message?.content;
			if ((message?.message?.type ?? message?.type) !== 'STORE' || !/^[A-Za-z0-9]{40,64}$/.test(content?.item_hash ?? '')) throw new Error('the plain image is no STORE message');
			const got = await deps.download(`${deps.api}/api/v0/storage/raw/${content.item_hash}`, j.path, MAX_IMAGE_BYTES);
			// The caller says which image it wants; nothing else is ever encrypted for it.
			if (got.sha256 !== sha256) throw new Error('the plain image is not the one asked for');
			await deps.encrypt(j.path, passphrase);
			j.cid = await deps.cidOf(j.path);
			j.size = await deps.sizeOf(j.path);
			j.state = 'built';
		} catch (error) {
			j.error = String(error?.message ?? error).slice(0, 200);
			j.state = 'failed';
			await deps.remove(j.path).catch(() => {});
		}
	}

	return {
		async build(body) {
			await expire();
			if (job && job.state !== 'failed' && job.state !== 'published') throw new Refused(503, 'busy with another image; try again in a few minutes');
			await drop();
			const { passphrase, ...wanted } = checkBuildRequest(body);
			const id = randomBytes(24).toString('hex');
			job = { id, state: 'building', path: deps.pathFor(id), started: now() };
			const done = run(job, wanted, passphrase);
			return { job: id, done };
		},
		async status(id) {
			await expire();
			return view(mine(id));
		},
		async publish(id, body) {
			await expire();
			const j = mine(id);
			if (j.state !== 'built') throw new Refused(409, `the image is ${j.state}`);
			const message = checkStoreMessage(body?.message, j.cid);
			j.state = 'publishing';
			try {
				const answer = await deps.upload(j.path, message);
				if (answer.cid && answer.cid !== j.cid) throw new Refused(502, 'Aleph stored another file than the one built');
				if (answer.status >= 300) throw new Refused(502, `Aleph answered ${answer.status}`);
				j.state = 'published';
				await deps.remove(j.path).catch(() => {});
				return { item_hash: message.item_hash, cid: j.cid };
			} catch (error) {
				// Still there for another try (a rejected signature, a node that was down).
				j.state = 'built';
				throw error instanceof Refused ? error : new Refused(502, 'the upload to Aleph failed');
			}
		}
	};
}

/** The HTTP face: JSON in, JSON out, a small body limit, no other route. */
export function handler(builder) {
	return async (req, res) => {
		const send = (status, body) => {
			res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
			res.end(JSON.stringify(body));
		};
		try {
			const path = new URL(req.url, 'http://builder').pathname;
			const read = async () => {
				let size = 0;
				const parts = [];
				for await (const part of req) {
					size += part.length;
					if (size > MAX_BODY) throw new Refused(413, 'the request is too large');
					parts.push(part);
				}
				try {
					return JSON.parse(Buffer.concat(parts).toString('utf8'));
				} catch {
					throw new Refused(400, 'expected JSON');
				}
			};
			const at = /^\/job\/([0-9a-f]{48})(\/publish)?$/.exec(path);
			if (req.method === 'GET' && path === '/') return send(200, { service: 'paperless-anywhere image builder' });
			if (req.method === 'POST' && path === '/build') return send(202, { job: (await builder.build(await read())).job });
			if (req.method === 'GET' && at && !at[2]) return send(200, await builder.status(at[1]));
			if (req.method === 'POST' && at?.[2]) return send(200, await builder.publish(at[1], await read()));
			throw new Refused(404, 'no such route');
		} catch (error) {
			if (error instanceof Refused) return send(error.status, { error: error.message });
			send(500, { error: 'the builder failed' });
		}
	};
}
