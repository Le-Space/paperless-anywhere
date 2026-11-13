// A backup fetched and decrypted in the browser, without a VM: the pieces come
// straight from the storage providers (their piece addresses are public and
// send CORS headers), are joined in order, and age opens them as they arrive.
// Nothing is held in memory beyond the part in flight, so the size of a backup
// is bounded by where the result is written, not by the browser's memory.
//
// The backup key is handed to the age library and nowhere else: it appears in
// no address, no header and no message.
import { pieceSources } from './backups.js';

/** Without a file to write into, the result is held in memory: up to this size. */
export const MEMORY_LIMIT_BYTES = 512 * 1024 * 1024;

export class BackupFetchError extends Error {
	/** @param {'no-address' | 'unreachable' | 'interrupted' | 'wrong-key' | 'damaged' | 'too-large' | 'aborted'} reason @param {string} message */
	constructor(reason, message) {
		super(message);
		this.name = 'BackupFetchError';
		this.reason = reason;
	}
}

const TEXT = {
	'no-address': 'Für mindestens ein Stück dieser Sicherung ist gerade keine Adresse bekannt.',
	unreachable: 'Keiner der Speicheranbieter hat dieses Stück herausgegeben.',
	interrupted: 'Die Verbindung ist abgebrochen, und keine andere Kopie konnte an derselben Stelle fortsetzen.',
	'wrong-key': 'Der Sicherungsschlüssel dieses Tresors öffnet diese Sicherung nicht.',
	damaged: 'Die Sicherung ist unvollständig oder beschädigt angekommen.',
	'too-large': 'Diese Sicherung ist zu groß, um sie in diesem Browser im Arbeitsspeicher zu halten.',
	aborted: 'Abgebrochen.'
};
const refuse = (/** @type {keyof typeof TEXT} */ reason) => new BackupFetchError(reason, TEXT[reason]);

/** The backup's size as stored (encrypted), or null when a part does not tell. @param {any} backup */
export function storedBytes(backup) {
	if (Number.isSafeInteger(backup?.size)) return backup.size;
	const parts = backup?.parts ?? [];
	if (!parts.length || parts.some((/** @type {any} */ p) => !Number.isSafeInteger(p.size))) return null;
	return parts.reduce((/** @type {number} */ sum, /** @type {any} */ p) => sum + p.size, 0);
}

/**
 * One piece as a reader of bytes. Tries the copies in turn; when a copy breaks
 * off in the middle, the next one is asked for the rest (Range), so a large
 * part is not started over.
 * @param {string[]} urls
 * @param {{ fetchImpl: typeof fetch, signal?: AbortSignal }} deps
 */
function pieceReader(urls, { fetchImpl, signal }) {
	let next = 0;
	let offset = 0;
	/** @type {ReadableStreamDefaultReader<Uint8Array> | null} */
	let reader = null;

	async function open() {
		while (next < urls.length) {
			const url = urls[next++];
			try {
				const res = await fetchImpl(url, { signal, cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer', ...(offset ? { headers: { Range: `bytes=${offset}-` } } : {}) });
				// A copy that ignores the range would start over: not usable here.
				if (res.body && (offset ? res.status === 206 : res.status === 200)) return res.body.getReader();
				await res.body?.cancel().catch(() => {});
			} catch (e) {
				if (signal?.aborted) throw refuse('aborted');
			}
		}
		throw refuse(offset ? 'interrupted' : 'unreachable');
	}

	return {
		/** @returns {Promise<Uint8Array | null>} the next bytes, or null at the end */
		async read() {
			for (;;) {
				reader ??= await open();
				try {
					const { done, value } = await reader.read();
					if (done) return null;
					offset += value.byteLength;
					return value;
				} catch (e) {
					if (signal?.aborted) throw refuse('aborted');
					reader = null;
				}
			}
		},
		cancel: () => reader?.cancel().catch(() => {})
	};
}

/**
 * The backup's parts as one stream, in order.
 * @param {Array<{ pieceCid: string, urls: string[] }>} sources
 * @param {{ fetchImpl: typeof fetch, signal?: AbortSignal, onBytes?: (n: number) => void }} deps
 */
export function joinedPieces(sources, { fetchImpl, signal, onBytes }) {
	let index = 0;
	/** @type {ReturnType<typeof pieceReader> | null} */
	let current = null;
	return new ReadableStream({
		async pull(controller) {
			for (;;) {
				if (index >= sources.length) return controller.close();
				current ??= pieceReader(sources[index].urls, { fetchImpl, signal });
				const chunk = await current.read();
				if (chunk) {
					onBytes?.(chunk.byteLength);
					return controller.enqueue(chunk);
				}
				current = null;
				index++;
			}
		},
		cancel: () => current?.cancel()
	});
}

/**
 * Fetches `backup`, decrypts it with `identity` and writes the zip to `sink`.
 * @param {{
 *   backup: any,
 *   identity: string,
 *   sink: WritableStream<Uint8Array>,
 *   fetchImpl?: typeof fetch,
 *   signal?: AbortSignal,
 *   onProgress?: (p: { fetched: number, total: number | null, written: number }) => void,
 *   age?: () => Promise<{ Decrypter: new () => { addIdentity(s: string): void, decrypt(file: ReadableStream<Uint8Array>): Promise<ReadableStream<Uint8Array>> } }>
 * }} options
 * @returns {Promise<{ fetched: number, written: number }>}
 */
export async function fetchBackup({ backup, identity, sink, fetchImpl = fetch, signal, onProgress, age = () => import('age-encryption') }) {
	const sources = pieceSources(backup);
	if (!sources.length || sources.some((s) => !s.urls.length)) {
		await sink.abort().catch(() => {});
		throw refuse('no-address');
	}
	const total = storedBytes(backup);
	let fetched = 0;
	let written = 0;
	const tell = () => onProgress?.({ fetched, total, written });
	const writer = sink.getWriter();
	/** @type {ReadableStreamDefaultReader<Uint8Array> | null} */
	let plain = null;
	try {
		const { Decrypter } = await age();
		const decrypter = new Decrypter();
		decrypter.addIdentity(identity.trim());
		const sealed = joinedPieces(sources, { fetchImpl, signal, onBytes: (n) => ((fetched += n), tell()) });
		/** @type {unknown} */
		let failure = null;
		// What the network refuses is kept apart from what age refuses.
		const watched = sealed.getReader();
		const guarded = new ReadableStream({
			async pull(controller) {
				try {
					const { done, value } = await watched.read();
					if (done) controller.close();
					else controller.enqueue(value);
				} catch (e) {
					failure = e;
					controller.error(e);
				}
			},
			cancel: (reason) => watched.cancel(reason)
		});
		try {
			plain = (await decrypter.decrypt(guarded)).getReader();
			for (;;) {
				const { done, value } = await plain.read();
				if (done) break;
				await writer.write(value);
				written += value.byteLength;
				tell();
			}
		} catch (e) {
			if (signal?.aborted) throw refuse('aborted');
			if (failure instanceof BackupFetchError) throw failure;
			if (failure) throw refuse('interrupted');
			// age names a key that does not fit differently from a broken stream.
			throw refuse(/no identity matched/i.test(String(/** @type {any} */ (e)?.message)) ? 'wrong-key' : 'damaged');
		}
		await writer.close();
		return { fetched, written };
	} catch (e) {
		await plain?.cancel().catch(() => {});
		await writer.abort().catch(() => {});
		throw e;
	}
}

/**
 * Where the zip goes. With the File System Access API the person picks a file
 * and the bytes go straight to disk; without it they are collected in memory
 * (bounded) and handed over as a download at the end.
 * @param {{ suggestedName: string, total: number | null, picker?: any, limit?: number }} options
 * @returns {Promise<{ sink: WritableStream<Uint8Array>, kind: 'file' | 'memory', finish: () => Blob | null }>}
 */
export async function openSink({ suggestedName, total, picker = /** @type {any} */ (globalThis).showSaveFilePicker, limit = MEMORY_LIMIT_BYTES }) {
	if (typeof picker === 'function') {
		const handle = await picker.call(globalThis, { suggestedName, types: [{ description: 'Zip', accept: { 'application/zip': ['.zip'] } }] });
		return { sink: await handle.createWritable(), kind: 'file', finish: () => null };
	}
	if (total == null || total > limit) throw refuse('too-large');
	/** @type {Uint8Array[]} */
	const chunks = [];
	let size = 0;
	const sink = new WritableStream({
		write(chunk) {
			size += chunk.byteLength;
			if (size > limit) throw refuse('too-large');
			chunks.push(chunk);
		},
		abort() {
			chunks.length = 0;
		}
	});
	return { sink, kind: 'memory', finish: () => new Blob(/** @type {any} */ (chunks), { type: 'application/zip' }) };
}
