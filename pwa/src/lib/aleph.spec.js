import { afterEach, describe, expect, it, vi } from 'vitest';
import { broadcast } from './aleph.js';

const message = { type: 'AGGREGATE', item_hash: 'a'.repeat(64) };
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
// The synchronous broadcast never answers; only the abort signal ends it.
const hang = (_url, init) => new Promise((_resolve, reject) => init.signal.addEventListener('abort', () => reject(init.signal.reason)));

afterEach(() => vi.unstubAllGlobals());

describe('broadcast', () => {
	it('returns the answer of the synchronous broadcast', async () => {
		vi.stubGlobal('fetch', vi.fn(async () => json({ message_status: 'processed', publication_status: { status: 'success' } })));
		expect((await broadcast(message)).httpStatus).toBe(200);
	});

	it('asks for the status when the synchronous broadcast does not answer', async () => {
		const fetch = vi.fn(async (url, init) => (String(url).endsWith(`/messages/${message.item_hash}`) ? json({ status: 'processed' }) : hang(url, init)));
		vi.stubGlobal('fetch', fetch);
		expect(await broadcast(message, { answerMs: 20, pollMs: 1 })).toEqual({ httpStatus: 200, response: { message_status: 'processed' } });
	});

	it('reports a rejected message as refused', async () => {
		vi.stubGlobal('fetch', vi.fn(async (url, init) => (String(url).includes('/messages/') ? json({ status: 'rejected' }) : hang(url, init))));
		expect((await broadcast(message, { answerMs: 20, pollMs: 1 })).httpStatus).toBe(422);
	});

	it('gives up after waiting', async () => {
		vi.stubGlobal('fetch', vi.fn(async (url, init) => (String(url).includes('/messages/') ? json({ status: 'pending' }) : hang(url, init))));
		await expect(broadcast(message, { answerMs: 20, pollMs: 1, waitMs: 50 })).rejects.toThrow(/did not process/);
	});
});
