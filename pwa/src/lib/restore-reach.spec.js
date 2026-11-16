import { describe, expect, it } from 'vitest';
import { answeringCopies, copyAnswers } from './restore-reach.js';

const up = async () => ({ type: 'opaque', status: 0 });
const down = async () => {
	throw new TypeError('Failed to fetch');
};

describe('whether a copy of a backup answers', () => {
	it('counts any answer as up, and a network error as down', async () => {
		expect(await copyAnswers('https://a.example/piece/x', { fetch: up })).toBe(true);
		expect(await copyAnswers('https://a.example/piece/x', { fetch: down })).toBe(false);
	});
	it('asks with a one-byte range in no-cors mode', async () => {
		let seen;
		await copyAnswers('https://a.example/piece/x', { fetch: async (_u, init) => ((seen = init), ({ type: 'opaque', status: 0 })) });
		expect(seen.mode).toBe('no-cors');
		expect(seen.headers.Range).toBe('bytes=0-0');
	});
	it('takes no address that is not https', async () => {
		expect(await copyAnswers('http://a.example/piece/x', { fetch: up })).toBe(false);
	});
	it('counts the copies that answer; a copy in parts by its first part', async () => {
		const fetch = async (url) => (String(url).includes('up.example') ? ({ type: 'opaque', status: 0 }) : Promise.reject(new TypeError('refused')));
		const entry = { copies: [{ retrievalUrl: 'https://down.example/piece/a' }, { retrievalUrl: 'https://x/piece/a', retrievalUrls: ['https://up.example/piece/p1', 'https://up.example/piece/p2'] }] };
		expect(await answeringCopies(entry, { fetch })).toEqual({ answering: 1, total: 2 });
	});
});
