import { describe, expect, it } from 'vitest';
import { recoverMessageAddress } from 'viem';
import { backupAuthorize, backupKeyAddress, backupOf, backupRevoke, canonical, choosePlan, creditsAccount, creditsBalance, CREDITS_PRODUCT, CreditsShortError, creditsCatalog, creditsPurchases, acceptTerms, termsOf, TermsError, fundBackups, fundVm, vmAuthorize, startSubscription, subscriptionPortal, waitForSubscription, stripeLink, payMessage, payUrl, signedHeaders, startCheckout, waitForTopUp } from './credits.js';

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
		expect(await creditsBalance(master, { baseUrl: 'https://credits.example.com', fetch })).toEqual({ credits: 2000, reserved: 150, lines: { ki: 0, vm: 0, transfer: 0 }, plan: null, terms: { accepted: null, current: null, pending: null, due: false, announced: false }, backup: null });
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

/** A service that checks the signature of a JSON request and answers with `reply(body)`. */
const jsonService = (reply) => {
	/** @type {{ line: string, signature: string | null, body: any, method: string } | null} */
	const seen = { last: null };
	const fetch = async (/** @type {string} */ url, /** @type {RequestInit} */ init) => {
		const h = new Headers(init.headers);
		const body = JSON.parse(String(init.body));
		const line = canonical({ method: init.method ?? 'GET', path: new URL(url).pathname, product: body.product, address: h.get('X-LS-Address'), timestamp: Number(h.get('X-LS-Timestamp')) });
		seen.last = { line, signature: h.get('X-LS-Signature'), body, method: init.method ?? 'GET' };
		const [status, answer] = reply(body);
		return new Response(JSON.stringify(answer), { status });
	};
	return { fetch, seen };
};

describe('packages and hours (belege#591 draft 2)', () => {
	const baseUrl = 'https://credits.example.com';

	it('reads the package from the balance', async () => {
		const fetch = async () => new Response(JSON.stringify({ credits: 600, reserved: 0, package: { id: 'paperless-30', period_start: '2026-11-01T00:00:00Z', period_end: '2026-12-01T00:00:00Z', hours_left: 12.5 } }));
		expect((await creditsBalance(master, { baseUrl, fetch }))?.plan).toEqual({ id: 'paperless-30', periodStart: '2026-11-01T00:00:00Z', periodEnd: '2026-12-01T00:00:00Z', hoursLeft: 12.5, billing: 'credits', renewsAt: null, cancelAtPeriodEnd: false });
	});

	it('chooses and ends a package with a signed PUT', async () => {
		const svc = jsonService((b) => [200, { package: b.package, period_start: '2026-11-05T00:00:00Z', period_end: '2026-12-05T00:00:00Z' }]);
		expect(await choosePlan(master, 'paperless-10', { baseUrl, fetch: svc.fetch })).toEqual({ package: 'paperless-10', periodStart: '2026-11-05T00:00:00Z', periodEnd: '2026-12-05T00:00:00Z' });
		expect(svc.seen.last?.method).toBe('PUT');
		expect(svc.seen.last?.body).toEqual({ product: CREDITS_PRODUCT, address: account.address, package: 'paperless-10' });
		expect(svc.seen.last?.line.startsWith('ls-credits/v1\nPUT\n/v1/package\npaperless-anywhere\n')).toBe(true);
		expect(await recoverMessageAddress({ message: svc.seen.last?.line ?? '', signature: svc.seen.last?.signature })).toBe(account.address);
		await choosePlan(master, null, { baseUrl, fetch: svc.fetch });
		expect(svc.seen.last?.body.package).toBeNull();
	});

	it('says where the service granted the hours, when it tells', async () => {
		const sub = '0x00000000000000000000000000000000000000c1';
		const svc = jsonService(() => [200, { transfer_id: 't2', aleph_credits: 1, charged_credits: 1, expiration: null, to: sub }]);
		expect((await fundVm(master, 5, { baseUrl, fetch: svc.fetch })).to).toBe(sub);
		const odd = jsonService(() => [200, { transfer_id: 't3', aleph_credits: 1, charged_credits: 1, to: 'not an address' }]);
		expect((await fundVm(master, 5, { baseUrl, fetch: odd.fetch })).to).toBeNull();
	});

	it('buys hours, keeping the Aleph amount and the charged credits apart', async () => {
		const svc = jsonService((b) => [200, { transfer_id: 't1', aleph_credits: 570000, charged_credits: 77, expiration: '2026-12-08T00:00:00Z', hours: b.hours }]);
		expect(await fundVm(master, 10, { baseUrl, fetch: svc.fetch })).toEqual({ transferId: 't1', alephCredits: 570000, chargedCredits: 77, expiration: '2026-12-08T00:00:00Z', to: null });
		expect(svc.seen.last?.body).toEqual({ product: CREDITS_PRODUCT, address: account.address, hours: 10 });
	});

	it('says when the balance does not cover it (402)', async () => {
		const svc = jsonService(() => [402, { error: 'insufficient credits: 250 free, 400 needed', code: 'INSUFFICIENT' }]);
		const err = await fundVm(master, 30, { baseUrl, fetch: svc.fetch }).catch((e) => e);
		expect(err).toBeInstanceOf(CreditsShortError);
		expect(err.neededCredits).toBe(150);
		expect(err.message).toMatch(/1,50/);
	});

	it('explains the service codes, e.g. hours without a package', async () => {
		const svc = jsonService(() => [409, { error: 'no plan', code: 'NO_PLAN' }]);
		await expect(fundVm(master, 5, { baseUrl, fetch: svc.fetch })).rejects.toThrow(/erst ein Paket wählen/);
	});

	it('pays months of backups with no payer in the body, and reads the answer', async () => {
		const svc = jsonService(() => [200, { funded_until: '2026-12-09T00:00:00.000Z', chargedCredits: 150, quota_bytes: 34359738368, payer: '0x' + '0'.repeat(39) + '1', tag: 'ab'.repeat(16), network: 'calibration' }]);
		expect(await fundBackups(master, 1, { baseUrl, fetch: svc.fetch })).toEqual({ fundedUntil: '2026-12-09T00:00:00.000Z', chargedCredits: 150, quotaBytes: 34359738368, payer: '0x' + '0'.repeat(39) + '1', tag: 'ab'.repeat(16), network: 'calibration' });
		expect(svc.seen.last?.body).toEqual({ product: CREDITS_PRODUCT, address: account.address, months: 1 });
		expect(svc.seen.last?.body).not.toHaveProperty('payer');
		expect(svc.seen.last?.line.startsWith('ls-credits/v1\nPOST\n/v1/backup/fund\npaperless-anywhere\n')).toBe(true);
		expect(await recoverMessageAddress({ message: svc.seen.last?.line ?? '', signature: svc.seen.last?.signature })).toBe(account.address);
	});

	it('says when the product has no backups (409 NO_BACKUP), the terms are due (412) or backups are off (503)', async () => {
		await expect(fundBackups(master, 1, { baseUrl, fetch: jsonService(() => [409, { error: 'no backup', code: 'NO_BACKUP' }]).fetch })).rejects.toThrow(/keine Sicherungen/);
		await expect(fundBackups(master, 1, { baseUrl, fetch: jsonService(() => [412, { error: 'terms', code: 'TERMS' }]).fetch })).rejects.toBeInstanceOf(TermsError);
		await expect(fundBackups(master, 1, { baseUrl, fetch: jsonService(() => [503, { error: 'backups are not configured', code: 'BACKUP_OFF' }]).fetch })).rejects.toThrow(/nicht eingerichtet/);
		await expect(fundBackups(master, 13, { baseUrl, fetch: jsonService(() => [400, { error: 'months', code: 'MONTHS' }]).fetch })).rejects.toThrow(/1 bis 12 Monate/);
	});

	describe('backupAuthorize', () => {
		const payer = '0x' + '0'.repeat(39) + '1';
		const signer = '0x' + '0'.repeat(39) + '2';
		const tag = '0123456789abcdef'.repeat(2);
		const ok = { payer, signer, tag, label: 'paperless-backup-test', network: 'calibration', funded_until: '2026-12-09T00:00:00.000Z' };

		it('sends the backup key\'s address, signed as the ledger address, and reads what the VM needs', async () => {
			const svc = jsonService(() => [200, ok]);
			const key = backupKeyAddress(master);
			expect(await backupAuthorize(master, key, { baseUrl, fetch: svc.fetch })).toEqual({ payer, signer, tag, label: 'paperless-backup-test', network: 'calibration', fundedUntil: '2026-12-09T00:00:00.000Z' });
			expect(svc.seen.last?.body).toEqual({ product: CREDITS_PRODUCT, address: account.address, backupKey: key });
			expect(svc.seen.last?.line.startsWith('ls-credits/v1\nPOST\n/v1/backup/authorize\npaperless-anywhere\n')).toBe(true);
			expect(await recoverMessageAddress({ message: svc.seen.last?.line ?? '', signature: svc.seen.last?.signature })).toBe(account.address);
		});

		it('never sends something that is not an address', async () => {
			const svc = jsonService(() => [200, ok]);
			await expect(backupAuthorize(master, '0x12', { baseUrl, fetch: svc.fetch })).rejects.toThrow(/keine Adresse/);
			expect(svc.seen.last).toBeNull();
		});

		it('refuses an answer without payer, signer, tag, label or network', async () => {
			const key = backupKeyAddress(master);
			for (const broken of [{ ...ok, payer: 'x' }, { ...ok, signer: undefined }, { ...ok, tag: 'NOT HEX' }, { ...ok, label: '<b>' }, { ...ok, network: 'devnet' }]) {
				await expect(backupAuthorize(master, key, { baseUrl, fetch: jsonService(() => [200, broken]).fetch })).rejects.toThrow(/Le Space Credits haben/);
			}
		});

		it('explains the refusals: too many keys, terms, no backup, a bad key, backups off', async () => {
			const key = backupKeyAddress(master);
			const refused = (status, code) => backupAuthorize(master, key, { baseUrl, fetch: jsonService(() => [status, { error: code, code }]).fetch });
			await expect(refused(409, 'DELEGATES')).rejects.toThrow(/5 VM-Schlüssel/);
			await expect(refused(412, 'TERMS')).rejects.toBeInstanceOf(TermsError);
			await expect(refused(409, 'NO_BACKUP')).rejects.toThrow(/keine Sicherungen/);
			await expect(refused(400, 'ADDRESS')).rejects.toThrow(/Schlüssel der VM/);
			await expect(refused(503, 'BACKUP_OFF')).rejects.toThrow(/nicht eingerichtet/);
		});
	});

	describe('backupRevoke', () => {
		it('sends a DELETE signed as the ledger address, with the backup key\'s address', async () => {
			const svc = jsonService(() => [200, { revoked: true }]);
			const key = backupKeyAddress(master);
			expect(await backupRevoke(master, key, { baseUrl, fetch: svc.fetch })).toEqual({ revoked: true });
			expect(svc.seen.last?.method).toBe('DELETE');
			expect(svc.seen.last?.body).toEqual({ product: CREDITS_PRODUCT, address: account.address, backupKey: key });
			expect(svc.seen.last?.line.startsWith('ls-credits/v1\nDELETE\n/v1/backup/authorize\npaperless-anywhere\n')).toBe(true);
			expect(await recoverMessageAddress({ message: svc.seen.last?.line ?? '', signature: svc.seen.last?.signature })).toBe(account.address);
		});
		it('says when the key was not known, and refuses what is not an address', async () => {
			expect(await backupRevoke(master, backupKeyAddress(master), { baseUrl, fetch: jsonService(() => [200, { revoked: false }]).fetch })).toEqual({ revoked: false });
			const svc = jsonService(() => [200, { revoked: true }]);
			await expect(backupRevoke(master, 'nope', { baseUrl, fetch: svc.fetch })).rejects.toThrow(/keine Adresse/);
			expect(svc.seen.last).toBeNull();
			await expect(backupRevoke(master, backupKeyAddress(master), { baseUrl, fetch: jsonService(() => [400, { error: 'bad', code: 'ADDRESS' }]).fetch })).rejects.toThrow(/Schlüssel der VM/);
		});
	});

	it('reads balance.backup: payer, signer, tag, network, paid until, the data sets\' client ids', async () => {
		const backup = { payer: '0x' + '0'.repeat(39) + '1', signer: '0x' + '0'.repeat(39) + '2', tag: 'ab'.repeat(16), network: 'mainnet', funded_until: '2027-01-01T00:00:00.000Z', data_sets: ['1', '18446744073709551617'] };
		const fetch = async () => new Response(JSON.stringify({ credits: 600, reserved: 0, backup }));
		expect((await creditsBalance(master, { baseUrl, fetch }))?.backup).toEqual({ payer: backup.payer, signer: backup.signer, tag: backup.tag, network: 'mainnet', fundedUntil: '2027-01-01T00:00:00.000Z', dataSets: ['1', '18446744073709551617'] });
		expect(backupOf(null)).toBeNull();
		expect(backupOf({ payer: 'nope' })).toBeNull();
		expect(backupOf({ payer: backup.payer })).toEqual({ payer: backup.payer, signer: null, tag: '', network: 'calibration', fundedUntil: null, dataSets: [] });
		// The old count, and anything that is not a decimal id, gives no ids.
		expect(backupOf({ payer: backup.payer, data_sets: 2 })?.dataSets).toEqual([]);
		expect(backupOf({ payer: backup.payer, data_sets: ['7', '0x1f', '-3', 12] })?.dataSets).toEqual(['7', '12']);
		expect(backupOf({ payer: backup.payer, signer: 'x' })?.signer).toBeNull();
	});

	it('reads the network the service pays backups in', async () => {
		const fetch = async () => new Response(JSON.stringify({ network: 'calibration', packages: [], topups: [] }));
		expect((await creditsCatalog({ baseUrl, fetch }))?.network).toBe('calibration');
	});

	it('reads the catalog the service lists', async () => {
		const fetch = async (url) => (String(url).endsWith('/v1/packages?product=paperless-anywhere') ? new Response(JSON.stringify({ product: 'paperless-anywhere', topups: [{ id: 'topup-20', amount_cents: 2000, credits: 2000 }], packages: [{ id: 'paperless-10', hours: 10, price_credits: 400 }, { id: 'paperless-30', hours: 30, price_credits: 600, backup_month_credits: 150 }] })) : new Response('{}', { status: 404 }));
		expect(await creditsCatalog({ baseUrl, fetch })).toEqual({ network: null, plans: [{ id: 'paperless-10', hours: 10, priceCredits: 400 }, { id: 'paperless-30', hours: 30, priceCredits: 600, backupMonthCredits: 150 }], topups: [{ id: 'topup-20', amountCents: 2000, credits: 2000 }] });
	});
});

describe('purchases', () => {
	it('lists them newest first, keeping only Stripe invoice links', async () => {
		const fetch = async () => new Response(JSON.stringify({ purchases: [
			{ id: 'p1', package: 'topup-20', amount_cents: 2000, credits: 2000, stripe_invoice_url: 'https://invoice.stripe.com/i/acct_1/test_1', created_at: '2026-11-05T03:40:00Z' },
			{ id: 'p2', package: 'topup-50', amount_cents: 5000, credits: 5000, stripe_invoice_url: 'https://evil.example.com/stripe.com', created_at: '2026-11-06T10:00:00Z' },
			{ id: 'p3', package: 'topup-20', amount_cents: 2000, credits: 2000, stripe_invoice_url: null, created_at: '2026-11-04T09:00:00Z' }
		] }));
		const list = await creditsPurchases(master, { baseUrl: 'https://credits.example.com', fetch });
		expect(list?.map((p) => [p.id, p.cents, p.invoiceUrl])).toEqual([
			['p2', 5000, null],
			['p1', 2000, 'https://invoice.stripe.com/i/acct_1/test_1'],
			['p3', 2000, null]
		]);
	});
	it('accepts only https on stripe.com', () => {
		expect(stripeLink('https://pay.stripe.com/invoice/x')).toBe('https://pay.stripe.com/invoice/x');
		expect(stripeLink('http://invoice.stripe.com/x')).toBeNull();
		expect(stripeLink('https://stripe.com.evil.example/x')).toBeNull();
		expect(stripeLink('javascript:alert(1)')).toBeNull();
	});
});

describe('terms', () => {
	const baseUrl = 'https://credits.example.com';
	it('says when the terms in force or an announced version still need consent', () => {
		expect(termsOf(undefined)).toEqual({ accepted: null, current: null, pending: null, due: false, announced: false });
		const t = termsOf({ accepted: { version: '1', url: 'https://example.com/agb-1.pdf', sha256: 'ab', accepted_at: '2026-11-09T10:00:00Z' }, current: '2', pending: null });
		expect(t.due).toBe(true);
		expect(t.accepted?.url).toBe('https://example.com/agb-1.pdf');
		expect(termsOf({ accepted: { version: '2' }, current: '2', pending: { version: '3', effectiveAt: '2026-12-21' } }).announced).toBe(true);
		expect(termsOf({ accepted: { version: '1', url: 'javascript:alert(1)' }, current: '1' }).accepted?.url).toBeNull();
	});
	it('accepts a version, signed as the ledger address', async () => {
		const svc = jsonService(() => [200, { version: '2', sha256: 'ab', accepted_at: '2026-11-09T10:00:00Z' }]);
		expect(await acceptTerms(master, '2', { baseUrl, fetch: svc.fetch })).toEqual({ version: '2', acceptedAt: '2026-11-09T10:00:00Z' });
		expect(svc.seen.last?.body).toEqual({ product: CREDITS_PRODUCT, address: account.address, version: '2' });
	});
	it('turns 412 TERMS into a TermsError', async () => {
		const svc = jsonService(() => [412, { error: 'terms', code: 'TERMS' }]);
		await expect(fundVm(master, 5, { baseUrl, fetch: svc.fetch })).rejects.toBeInstanceOf(TermsError);
	});
});

describe('subscription (Stripe)', () => {
	const baseUrl = 'https://credits.example.com';
	it('starts a subscription checkout for a package, signed', async () => {
		const svc = jsonService(() => [200, { client_secret: 'cs_test_x' }]);
		expect(await startSubscription(master, 'paperless-30', { baseUrl, fetch: svc.fetch })).toBe('cs_test_x');
		expect(svc.seen.last?.body).toEqual({ product: CREDITS_PRODUCT, address: account.address, package: 'paperless-30', locale: 'de' });
	});
	it('opens only a Stripe portal address', async () => {
		const ok = jsonService(() => [200, { url: 'https://billing.stripe.com/p/session/x' }]);
		expect(await subscriptionPortal(master, { baseUrl, fetch: ok.fetch })).toBe('https://billing.stripe.com/p/session/x');
		const bad = jsonService(() => [200, { url: 'https://evil.example.com/' }]);
		await expect(subscriptionPortal(master, { baseUrl, fetch: bad.fetch })).rejects.toThrow(/keine Stripe-Adresse/);
	});
	it('explains a running subscription (409 SUBSCRIBED)', async () => {
		const svc = jsonService(() => [409, { error: 'subscribed', code: 'SUBSCRIBED' }]);
		await expect(startSubscription(master, 'paperless-10', { baseUrl, fetch: svc.fetch })).rejects.toThrow(/schon ein Abo/);
	});
	it('waits until the package is billed by Stripe', async () => {
		let n = 0;
		const read = async () => ({ plan: { billing: ++n > 2 ? 'stripe' : 'credits' } });
		expect((await waitForSubscription(master, { read, delayMs: 1 })).booked).toBe(true);
	});
});

describe('model A: the VM paid by Le Space', () => {
	const baseUrl = 'https://credits.example.com';
	it('asks for the delegation and returns the paying account', async () => {
		const owner = '0x' + '6'.repeat(40);
		const svc = jsonService(() => [200, { owner, delegate: account.address, types: ['INSTANCE', 'FORGET', 'AGGREGATE'], aggregate_keys: ['port-forwarding'], hours_left: 34, period_end: '2026-12-06T00:00:00Z', revoke_at: null }]);
		expect(await vmAuthorize(master, { baseUrl, fetch: svc.fetch })).toEqual({ owner, delegate: account.address, hoursLeft: 34, periodEnd: '2026-12-06T00:00:00Z', revokeAt: null });
		expect(svc.seen.last?.body).toEqual({ product: CREDITS_PRODUCT, address: account.address });
	});
	it('says when the service does not pay VMs yet (503 SUBS_OFF)', async () => {
		const svc = jsonService(() => [503, { error: 'subs off', code: 'SUBS_OFF' }]);
		await expect(vmAuthorize(master, { baseUrl, fetch: svc.fetch })).rejects.toThrow(/noch nicht selbst/);
	});
});

describe('package hints', () => {
	it('calls a fifth of the package, and at least two hours, few', async () => {
		const { fewHoursLeft } = await import('./credits.js');
		expect(fewHoursLeft(6, { hours: 30 })).toBe(true);
		expect(fewHoursLeft(7, { hours: 30 })).toBe(false);
		expect(fewHoursLeft(2, { hours: 10 })).toBe(true);
		expect(fewHoursLeft(3, { hours: 10 })).toBe(false);
		expect(fewHoursLeft(null, { hours: 10 })).toBe(false);
		expect(fewHoursLeft(0, null)).toBe(false);
	});
	it('recommends the next larger package, none after the largest', async () => {
		const { biggerPlan, PLANS } = await import('./credits.js');
		expect(biggerPlan(PLANS[0])?.hours).toBe(30);
		expect(biggerPlan(PLANS[1])?.hours).toBe(80);
		expect(biggerPlan(PLANS[2])).toBe(null);
		expect(biggerPlan(null)).toBe(null);
	});
	it('says what a package means in a week', async () => {
		const { hoursPerWeek } = await import('./credits.js');
		expect([10, 30, 80].map(hoursPerWeek)).toEqual([2, 7, 18]);
	});
});

describe('nextStamp', () => {
	it('gives each request of an address a later second, even within one second', async () => {
		const { nextStamp } = await import('./credits.js');
		const a = '0x00000000000000000000000000000000000000aa';
		const t1 = nextStamp(a, 1_000_000);
		const t2 = nextStamp(a, 1_000_000);
		const t3 = nextStamp(a.toUpperCase().replace('0X', '0x'), 1_000_000);
		expect([t2 - t1, t3 - t2]).toEqual([1, 1]);
		// Another address starts from the clock.
		expect(nextStamp('0x00000000000000000000000000000000000000bb', 1_000_000)).toBe(1_000_000);
		// The clock moving past the last stamp wins.
		expect(nextStamp(a, 1_000_100)).toBe(1_000_100);
	});
});
