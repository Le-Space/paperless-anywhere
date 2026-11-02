import { describe, expect, it } from 'vitest';
import { recoverMessageAddress } from 'viem';
import { canonical, creditsAccount, creditsBalance, CREDITS_PRODUCT, payMessage, payUrl, signedHeaders, startCheckout, waitForTopUp } from './credits.js';

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

describe('startCheckout', () => {
	it('signs the POST for this product and returns the client secret', async () => {
		/** @type {{ line: string, signature: string | null, body: any } | null} */
		let seen = null;
		const fetch = async (/** @type {string} */ url, /** @type {RequestInit} */ init) => {
			const h = new Headers(init.headers);
			const body = JSON.parse(String(init.body));
			const line = canonical({ method: init.method ?? 'GET', path: new URL(url).pathname, product: body.product, address: h.get('X-LS-Address'), timestamp: Number(h.get('X-LS-Timestamp')) });
			seen = { line, signature: h.get('X-LS-Signature'), body };
			return new Response(JSON.stringify({ client_secret: 'cs_test_a1_secret_b2', session_id: 'cs_test_a1' }));
		};
		expect(await startCheckout(master, 'topup-20', { baseUrl: 'https://credits.example.com', fetch })).toBe('cs_test_a1_secret_b2');
		expect(seen?.body).toEqual({ product: CREDITS_PRODUCT, package: 'topup-20', locale: 'de' });
		expect(seen?.line.startsWith('ls-credits/v1\nPOST\n/v1/checkout\npaperless-anywhere\n')).toBe(true);
		expect(await recoverMessageAddress({ message: seen?.line ?? '', signature: seen?.signature })).toBe(account.address);
	});

	it('says when the service cannot take money yet', async () => {
		const off = async () => new Response(JSON.stringify({ error: 'Stripe is not configured', code: 'STRIPE_OFF' }), { status: 503 });
		await expect(startCheckout(master, 'topup-20', { baseUrl: 'https://credits.example.com', fetch: off })).rejects.toThrow(/noch nicht eingerichtet/);
	});
});

describe('the /pay page', () => {
	it('gets the secret and this app’s origin in the fragment only', () => {
		const url = new URL(payUrl('https://credits.example.com', { clientSecret: 'cs_test_a1_secret_b2', origin: 'https://app.example.com' }));
		expect(url.pathname).toBe('/pay');
		expect(url.search).toBe('');
		expect(Object.fromEntries(new URLSearchParams(url.hash.slice(1)))).toEqual({ cs: 'cs_test_a1_secret_b2', origin: 'https://app.example.com' });
	});

	it('is heard only from the service’s origin', () => {
		const from = (origin, type) => /** @type {MessageEvent} */ ({ origin, data: { type } });
		expect(payMessage(from('https://credits.example.com', 'ls-credits:paid'), 'https://credits.example.com')).toBe('paid');
		expect(payMessage(from('https://credits.example.com', 'ls-credits:failed'), 'https://credits.example.com')).toBe('failed');
		expect(payMessage(from('https://evil.example.com', 'ls-credits:paid'), 'https://credits.example.com')).toBeNull();
		expect(payMessage(from('https://credits.example.com', 'other'), 'https://credits.example.com')).toBeNull();
		expect(payMessage(from('https://credits.example.com', 'ls-credits:paid'), '')).toBeNull();
	});
});

describe('waitForTopUp', () => {
	it('reads until the webhook has booked the purchase', async () => {
		const answers = [{ credits: 100, reserved: 0, lines: {} }, { credits: 100, reserved: 0, lines: {} }, { credits: 2100, reserved: 0, lines: {} }];
		let i = 0;
		const read = async () => answers[Math.min(i++, answers.length - 1)];
		expect(await waitForTopUp(master, 100, { delayMs: 0, read })).toEqual({ booked: true, balance: answers[2] });
		expect(i).toBe(3);
	});

	it('gives up after its tries with the last balance', async () => {
		const read = async () => ({ credits: 100, reserved: 0, lines: {} });
		expect(await waitForTopUp(master, 100, { tries: 3, delayMs: 0, read })).toEqual({ booked: false, balance: { credits: 100, reserved: 0, lines: {} } });
	});
});
