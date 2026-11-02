import { describe, expect, it } from 'vitest';
import { recoverMessageAddress } from 'viem';
import { canonical, creditsAccount, creditsBalance, CREDITS_PRODUCT, signedHeaders } from './credits.js';

// A made-up vault: the ledger knows it by the address its Aleph key has.
const master = new Uint8Array(32).fill(7);
const account = creditsAccount(master);

/**
 * What le-space-credits checks (src/lib/server/auth.js, http.js): the product,
 * the address the signature recovers to, the 5-minute window and one use per
 * timestamp. Answers like its ledger.
 * @param {Record<string, { credits: number, reserved: number }>} balances by product
 */
function fakeService(balances, { now = () => Math.floor(Date.now() / 1000) } = {}) {
	const used = new Set();
	return async (/** @type {string} */ url, /** @type {RequestInit} */ init) => {
		const u = new URL(url);
		const h = new Headers(init.headers);
		const product = u.searchParams.get('product');
		const address = h.get('X-LS-Address');
		const timestamp = Number(h.get('X-LS-Timestamp'));
		const signer = await recoverMessageAddress({ message: canonical({ method: 'GET', path: u.pathname, product, address, timestamp }), signature: h.get('X-LS-Signature') }).catch(() => null);
		const answer = (status, body) => new Response(JSON.stringify(body), { status });
		if (signer !== address) return answer(401, { error: 'signature does not match the address', code: 'SIGNATURE' });
		if (Math.abs(now() - timestamp) > 300) return answer(401, { error: 'timestamp outside the window', code: 'TIMESTAMP' });
		if (used.has(`${address}:${timestamp}`)) return answer(401, { error: 'replayed request', code: 'REPLAY' });
		used.add(`${address}:${timestamp}`);
		const b = balances[product] ?? { credits: 0, reserved: 0 };
		return answer(200, { product, address, credits: b.credits, reserved: b.reserved, lines_this_month: { ki: 0, vm: 0, transfer: 0 } });
	};
}

describe('signed requests', () => {
	it('sign the line le-space-credits checks, with the vault’s Aleph address', async () => {
		const headers = await signedHeaders(account, { method: 'get', path: '/v1/balance', timestamp: 1_800_000_000 });
		expect(headers['X-LS-Address']).toBe(account.address);
		const line = `ls-credits/v1\nGET\n/v1/balance\n${CREDITS_PRODUCT}\n${account.address}\n1800000000`;
		expect(canonical({ method: 'get', path: '/v1/balance', product: CREDITS_PRODUCT, address: account.address, timestamp: 1_800_000_000 })).toBe(line);
		expect(await recoverMessageAddress({ message: line, signature: headers['X-LS-Signature'] })).toBe(account.address);
	});
});

describe('creditsBalance', () => {
	it('shows a top-up as this vault’s paperless-anywhere balance, and a Belege top-up not at all', async () => {
		const fetch = fakeService({ 'paperless-anywhere': { credits: 2000, reserved: 150 }, belege: { credits: 5000, reserved: 0 } });
		expect(await creditsBalance(master, { baseUrl: 'https://credits.example.com', fetch })).toEqual({ credits: 2000, reserved: 150, lines: { ki: 0, vm: 0, transfer: 0 } });
		const onlyBelege = fakeService({ belege: { credits: 5000, reserved: 0 } });
		expect((await creditsBalance(master, { baseUrl: 'https://credits.example.com', fetch: onlyBelege }))?.credits).toBe(0);
	});

	it('is null without a service, and says what the service refused', async () => {
		expect(await creditsBalance(master, { baseUrl: '' })).toBeNull();
		const late = fakeService({}, { now: () => Math.floor(Date.now() / 1000) + 3600 });
		await expect(creditsBalance(master, { baseUrl: 'https://credits.example.com', fetch: late })).rejects.toThrow(/timestamp outside the window/);
	});
});
