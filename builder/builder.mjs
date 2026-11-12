// The image builder: gives a person an encrypted copy of the public Paperless
// image, sealed with a passphrase only their vault knows.
//
// It runs measured, as an Aleph V-PROGRAM (docs/own-image.md): the app checks
// the attestation first, so it knows this code is what receives the
// passphrase. A V-PROGRAM is a closed box. Its guest firewall lets nothing in
// but the attested port, replies to outbound connections included, so the
// builder fetches nothing and uploads nothing:
//
// - the plain image comes on a verified volume, whose dm-verity root hash is
//   on the measured boot line: which image gets sealed is part of what the
//   app attests;
// - the sealed image goes back to the caller over the attested channel, in
//   pieces, and the caller stores it on Aleph itself.
//
//   GET    /                    → {service, plain: {sha256, size} | null}
//   POST   /build               {sha256, passphrase} → 202 {job}
//   GET    /job/<job>           → {state, cid?, size?, error?}
//   GET    /job/<job>/image     the sealed image; `Range: bytes=a-b` for a piece
//   DELETE /job/<job>           removes it
//
// The builder keeps nothing: one job at a time, the passphrase goes to
// cryptsetup's stdin and nowhere else, and a job's image is removed when the
// caller says so or when nobody touched it for a while.
import { randomBytes } from 'node:crypto';

const HEX64 = /^[0-9a-f]{64}$/;
export const MAX_IMAGE_BYTES = 1024 * 1024 * 1024 - 32 * 1024 * 1024; // Aleph takes 1 GiB in one upload
// Counted from the last time the caller touched the job: fetching a whole
// image through a relay takes a while.
export const JOB_TTL_MS = 30 * 60 * 1000;
export const MAX_PIECE_BYTES = 16 * 1024 * 1024;
const MAX_BODY = 16 * 1024;

export class Refused extends Error {
	/** @param {number} status @param {string} message */
	constructor(status, message) {
		super(message);
		this.status = status;
	}
}

/** An error with what lies behind it (Node keeps the reason in `cause`). Nothing here comes from the caller. */
export function explain(error) {
	const parts = [];
	for (let e = error, depth = 0; e && depth < 4; e = e.cause, depth++) {
		const text = [e.code, e.message].filter(Boolean).join(' ');
		if (text && !parts.includes(text)) parts.push(text);
	}
	return (parts.join(': ') || String(error)).slice(0, 300);
}

/** What a build request must look like. */
export function checkBuildRequest(body) {
	if (!body || typeof body !== 'object') throw new Refused(400, 'expected a JSON object');
	const { sha256, passphrase } = body;
	if (!HEX64.test(sha256 ?? '')) throw new Refused(400, 'sha256: the SHA-256 of the plain image (64 hex)');
	if (typeof passphrase !== 'string' || passphrase.length < 32 || passphrase.length > 256 || /[\r\n\0]/.test(passphrase)) {
		throw new Refused(400, 'passphrase: 32 to 256 characters, one line');
	}
	return { sha256, passphrase };
}

/**
 * The piece of a file of `size` bytes a `Range` header asks for: `bytes=a-b`
 * only, inside the file, at most MAX_PIECE_BYTES. No header means the whole.
 * @param {string | undefined} header @param {number} size
 * @returns {{ start: number, end: number, partial: boolean }} `end` inclusive
 */
export function pieceOf(header, size) {
	if (header === undefined) return { start: 0, end: size - 1, partial: false };
	const m = /^bytes=(\d{1,12})-(\d{1,12})$/.exec(header);
	if (!m) throw new Refused(416, 'Range: bytes=<first>-<last>');
	const start = Number(m[1]);
	const end = Math.min(Number(m[2]), size - 1);
	if (start > end) throw new Refused(416, 'the range lies outside the image');
	if (end - start + 1 > MAX_PIECE_BYTES) throw new Refused(416, `a piece has at most ${MAX_PIECE_BYTES} bytes`);
	return { start, end, partial: true };
}

/**
 * @param {{
 *   plainPath: string,
 *   unpack: (from: string, to: string, max: number) => Promise<{ sha256: string, size: number }>,
 *   encrypt: (path: string, passphrase: string) => Promise<void>,
 *   cidOf: (path: string) => Promise<string>,
 *   sizeOf: (path: string) => Promise<number>,
 *   remove: (path: string) => Promise<void>,
 *   pathFor: (job: string) => string,
 *   now?: () => number
 * }} deps
 */
export function createBuilder(deps) {
	const now = deps.now ?? Date.now;
	/** @type {null | { id: string, state: string, path: string, touched: number, cid?: string, size?: number, error?: string }} */
	let job = null;
	/** What the plain image on the volume is, known after the first build. @type {null | { sha256: string, size: number }} */
	let plain = null;

	const drop = async () => {
		const old = job;
		job = null;
		if (old) await deps.remove(old.path).catch(() => {});
	};
	const expire = async () => {
		if (job && job.state !== 'building' && now() - job.touched > JOB_TTL_MS) await drop();
	};
	const view = (j) => ({ state: j.state, ...(j.cid ? { cid: j.cid, size: j.size } : {}), ...(j.error ? { error: j.error } : {}) });
	const mine = (id) => {
		if (!job || job.id !== id) throw new Refused(404, 'no such job');
		job.touched = now();
		return job;
	};

	async function run(j, sha256, passphrase) {
		try {
			const got = await deps.unpack(deps.plainPath, j.path, MAX_IMAGE_BYTES);
			plain = got;
			// The caller says which image it expects; nothing else is ever sealed for it.
			if (got.sha256 !== sha256) throw new Error('the plain image here is not the one asked for');
			await deps.encrypt(j.path, passphrase);
			j.cid = await deps.cidOf(j.path);
			j.size = await deps.sizeOf(j.path);
			j.state = 'built';
		} catch (error) {
			j.error = explain(error);
			j.state = 'failed';
			await deps.remove(j.path).catch(() => {});
		}
		j.touched = now();
	}

	return {
		info() {
			return { service: 'paperless-anywhere image builder', plain };
		},
		async build(body) {
			await expire();
			if (job && job.state !== 'failed') throw new Refused(503, 'busy with another image; try again in a few minutes');
			await drop();
			const { sha256, passphrase } = checkBuildRequest(body);
			const id = randomBytes(24).toString('hex');
			job = { id, state: 'building', path: deps.pathFor(id), touched: now() };
			const done = run(job, sha256, passphrase);
			return { job: id, done };
		},
		async status(id) {
			await expire();
			return view(mine(id));
		},
		/** Where a piece of the sealed image lies: `{ path, start, end, size, partial }`. */
		async piece(id, range) {
			await expire();
			const j = mine(id);
			if (j.state !== 'built') throw new Refused(409, `the image is ${j.state}`);
			return { path: j.path, size: /** @type {number} */ (j.size), ...pieceOf(range, /** @type {number} */ (j.size)) };
		},
		async forget(id) {
			await expire();
			const j = mine(id);
			if (j.state === 'building') throw new Refused(409, 'the image is being built');
			await drop();
			return { removed: true };
		}
	};
}

/**
 * The HTTP face: JSON in, JSON out, a small body limit, and the image as
 * bytes. `readPiece(path, start, end)` gives a stream of that piece.
 */
export function handler(builder, readPiece) {
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
			const at = /^\/job\/([0-9a-f]{48})(\/image)?$/.exec(path);
			if (req.method === 'GET' && path === '/') return send(200, builder.info());
			if (req.method === 'POST' && path === '/build') return send(202, { job: (await builder.build(await read())).job });
			if (req.method === 'GET' && at && !at[2]) return send(200, await builder.status(at[1]));
			if (req.method === 'DELETE' && at && !at[2]) return send(200, await builder.forget(at[1]));
			if (req.method === 'GET' && at?.[2]) {
				const piece = await builder.piece(at[1], req.headers.range);
				res.writeHead(piece.partial ? 206 : 200, {
					'content-type': 'application/octet-stream',
					'content-length': piece.end - piece.start + 1,
					'cache-control': 'no-store',
					...(piece.partial ? { 'content-range': `bytes ${piece.start}-${piece.end}/${piece.size}` } : {})
				});
				const stream = readPiece(piece.path, piece.start, piece.end);
				stream.on('error', () => res.destroy());
				return stream.pipe(res);
			}
			throw new Refused(404, 'no such route');
		} catch (error) {
			if (error instanceof Refused) return send(error.status, { error: error.message });
			send(500, { error: 'the builder failed' });
		}
	};
}
