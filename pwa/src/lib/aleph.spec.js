import { afterEach, describe, expect, it, vi } from 'vitest';
import { alephUrls, broadcast, readFetch } from './aleph.js';

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

	it('asks api.aleph.im when api2 does not answer, and sends the message there once more when it does not know it yet', async () => {
		const sent = [];
		let known = false;
		const fetch = vi.fn(async (url, init) => {
			const u = String(url);
			if (u.startsWith('https://api2.aleph.im')) throw new TypeError('Failed to fetch');
			if (u === 'https://api.aleph.im/api/v0/messages' || u.endsWith('/api/v0/messages')) {
				sent.push(JSON.parse(init.body));
				known = true;
				return json({ publication_status: { status: 'success' } }, 202);
			}
			return known ? json({ status: 'processed' }) : json({}, 404);
		});
		vi.stubGlobal('fetch', fetch);
		expect(await broadcast(message, { answerMs: 20, pollMs: 1 })).toEqual({ httpStatus: 200, response: { message_status: 'processed' } });
		expect(sent).toHaveLength(1);
		expect(sent[0]).toMatchObject({ sync: false, message: { item_hash: message.item_hash } });
		expect(fetch.mock.calls.some(([u]) => String(u).startsWith('https://api.aleph.im/api/v0/messages'))).toBe(true);
	});

	it('takes a 5xx of the synchronous broadcast like no answer, and asks for the status', async () => {
		vi.stubGlobal('fetch', vi.fn(async (url) => (String(url).includes('/messages/') ? json({ status: 'processed' }) : json({ error: 'bad gateway' }, 502))));
		expect((await broadcast(message, { answerMs: 20, pollMs: 1 })).httpStatus).toBe(200);
	});

	it('keeps a refusal of the message itself', async () => {
		vi.stubGlobal('fetch', vi.fn(async () => json({ message_status: 'rejected', error_code: 1 }, 422)));
		await expect(broadcast(message, { answerMs: 20, pollMs: 1 })).resolves.toMatchObject({ httpStatus: 422 });
	});

	it('gives up after waiting', async () => {
		vi.stubGlobal('fetch', vi.fn(async (url, init) => (String(url).includes('/messages/') ? json({ status: 'pending' }) : hang(url, init))));
		await expect(broadcast(message, { answerMs: 20, pollMs: 1, waitMs: 50 })).rejects.toThrow(/did not process/);
	});
});

describe('readFetch', () => {
	const url = 'https://api2.aleph.im/api/v0/addresses/0x1/balance';
	it('tries again after a network error and a 5xx', async () => {
		const answers = [() => Promise.reject(new TypeError('Failed to fetch')), () => Promise.resolve(json({}, 502)), () => Promise.resolve(json({ credit_balance: 7 }))];
		let i = 0;
		const res = await readFetch(url, 'Guthaben abfragen', { pauseMs: 1, fetch: () => answers[i++]() });
		expect(await res.json()).toEqual({ credit_balance: 7 });
		expect(i).toBe(3);
	});
	it('passes a 4xx through at once', async () => {
		let i = 0;
		const res = await readFetch(url, 'x', { pauseMs: 1, fetch: async () => (i++, json({}, 404)) });
		expect(res.status).toBe(404);
		expect(i).toBe(1);
	});
	it('asks api.aleph.im at once when api2 fails, with the same path', async () => {
		const asked = [];
		const res = await readFetch(url, 'x', {
			pauseMs: 1,
			fetch: async (u) => (asked.push(u), String(u).startsWith('https://api2.') ? Promise.reject(new TypeError('Failed to fetch')) : json({ credit_balance: 7 }))
		});
		expect(await res.json()).toEqual({ credit_balance: 7 });
		expect(asked).toEqual([url, 'https://api.aleph.im/api/v0/addresses/0x1/balance']);
	});
	it('names both hosts and what each answered when every try fails', async () => {
		const fetch = (u) => (String(u).startsWith('https://api2.') ? Promise.reject(new TypeError('Failed to fetch')) : Promise.resolve(json({}, 503)));
		await expect(readFetch(url, 'Guthaben abfragen', { pauseMs: 1, fetch })).rejects.toThrow(
			'api2.aleph.im, api.aleph.im nicht erreichbar (Guthaben abfragen, 3 Versuche: api2.aleph.im: Failed to fetch; api.aleph.im: HTTP 503). Verbindung prüfen und erneut versuchen.'
		);
	});
	it('reads a node, not an Aleph API, from its own host only', async () => {
		expect(alephUrls('https://node.example/about')).toEqual(['https://node.example/about']);
		expect(alephUrls('https://api.aleph.im/api/v0/messages/x?y=1')).toEqual(['https://api.aleph.im/api/v0/messages/x?y=1', 'https://api2.aleph.im/api/v0/messages/x?y=1']);
		let i = 0;
		await expect(readFetch('https://node.example/about', 'Knoten', { pauseMs: 1, fetch: () => (i++, Promise.reject(new TypeError('Failed to fetch'))) })).rejects.toThrow(
			'node.example nicht erreichbar (Knoten, 3 Versuche: Failed to fetch).'
		);
		expect(i).toBe(3);
	});
});
