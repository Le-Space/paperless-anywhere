// Vouchers (le-space-credits#73): the form of a code, redeeming, and the
// service's refusals in words, in both languages.
import { afterEach, describe, expect, it } from 'vitest';
import { setLang } from './i18n/index.js';
import { creditsAccount, creditsCatalog, creditsBalance, CREDITS_PRODUCT, redeemVoucher, TermsError, voucherCode } from './credits.js';

const master = new Uint8Array(32).fill(7);
const account = creditsAccount(master);
const baseUrl = 'https://credits.example.com';
function service(answer) {
	const seen = { /** @type {any[]} */ calls: [] };
	return { seen, fetch: async (/** @type {string} */ url, /** @type {RequestInit} */ init = {}) => {
		seen.calls.push({ path: new URL(url).pathname, method: init.method ?? 'GET', body: init.body ? JSON.parse(String(init.body)) : null });
		const [status, json] = answer();
		return new Response(JSON.stringify(json), { status, headers: { 'content-type': 'application/json' } });
	} };
}
const refuse = (/** @type {number} */ status, /** @type {string} */ code) => service(() => [status, { error: code.toLowerCase(), code }]).fetch;
afterEach(() => setLang('de'));

describe('a voucher code', () => {
	it('is read in any case, with or without spaces and hyphens', () => {
		expect(voucherCode('PA-ABCD-EFGH-JKLM')).toBe('PA-ABCD-EFGH-JKLM');
		expect(voucherCode('  pa abcd efgh jklm ')).toBe('PA-ABCD-EFGH-JKLM');
		expect(voucherCode('paabcdefghjklm')).toBe('PA-ABCD-EFGH-JKLM');
		expect(voucherCode('PA-ABCD-EFGH-JKL2')).toBe('PA-ABCD-EFGH-JKL2');
	});
	it('is refused before anything is sent when it cannot be one', async () => {
		for (const typo of ['', 'PA-ABCD', 'PA-ABCD-EFGH-JKLM-X', '12-ABCD-EFGH-JKLM', 'PA-ABCD-EFGH-JK!M', null, undefined]) expect(voucherCode(typo)).toBeNull();
		const svc = service(() => [200, {}]);
		await expect(redeemVoucher(master, 'PA-ABCD', { baseUrl, fetch: svc.fetch })).rejects.toThrow('Das ist kein Gutschein-Code. Er sieht so aus: PA-XXXX-XXXX-XXXX.');
		expect(svc.seen.calls).toEqual([]);
	});
});

describe('redeeming', () => {
	it('sends the code in the service’s form, signed like a purchase, without a declaration on withdrawal', async () => {
		const svc = service(() => [200, { redeemed: true, package: 'paperless-voucher', days: 7, hours: 168, always: true, period_start: '2026-11-13T10:15:00.000Z', period_end: '2026-11-20T10:15:00.000Z', backup_until: '2026-11-20T10:15:00.000Z', granted: true }]);
		const r = await redeemVoucher(master, 'pa abcd-efgh jklm', { baseUrl, fetch: svc.fetch });
		expect(svc.seen.calls).toEqual([{ path: '/v1/voucher/redeem', method: 'POST', body: { product: CREDITS_PRODUCT, address: account.address, code: 'PA-ABCD-EFGH-JKLM' } }]);
		expect(r).toEqual({ days: 7, hours: 168, always: true, periodEnd: '2026-11-20T10:15:00.000Z', backupUntil: '2026-11-20T10:15:00.000Z', granted: true });
	});
	it('reads a period by hours, and hours that are still to come', async () => {
		const svc = service(() => [200, { redeemed: true, days: 30, hours: 15, always: false, period_end: '2026-12-13T10:15:00.000Z', backup_until: null, granted: false }]);
		expect(await redeemVoucher(master, 'PA-ABCD-EFGH-JKLM', { baseUrl, fetch: svc.fetch })).toMatchObject({ hours: 15, always: false, granted: false, backupUntil: null });
	});
	it('does not take an answer without `redeemed` for a redemption', async () => {
		await expect(redeemVoucher(master, 'PA-ABCD-EFGH-JKLM', { baseUrl, fetch: service(() => [200, { ok: true }]).fetch })).rejects.toThrow(/Einlösung nicht bestätigt/);
	});
	it('puts every refusal into a sentence, in German and in English', async () => {
		const code = 'PA-ABCD-EFGH-JKLM';
		const de = { VOUCHER_FORMAT: /kein Gutschein-Code/, VOUCHER: /gibt es nicht/, VOUCHER_REVOKED: /zurückgezogen/, VOUCHER_EXPIRED: /abgelaufen/, VOUCHER_USED_UP: /vollständig eingelöst/, VOUCHER_REDEEMED: /hast du schon eingelöst/, PERIOD_RUNNING: /kein Paket und kein anderer Zeitraum/, NOT_YET: /erst mit den neuen AGB/, VOUCHER_OFF: /gerade nicht einlösen/, PAUSED: /gerade nicht einlösen/ };
		for (const [c, text] of Object.entries(de)) await expect(redeemVoucher(master, code, { baseUrl, fetch: refuse(c === 'VOUCHER' ? 404 : c === 'VOUCHER_FORMAT' ? 400 : c.endsWith('OFF') || c === 'PAUSED' ? 503 : 409, c) }), c).rejects.toThrow(text);
		setLang('en');
		await expect(redeemVoucher(master, code, { baseUrl, fetch: refuse(409, 'VOUCHER_REDEEMED') })).rejects.toThrow('You have already redeemed this voucher.');
		await expect(redeemVoucher(master, code, { baseUrl, fetch: refuse(409, 'PERIOD_RUNNING') })).rejects.toThrow(/no package and no other period/);
		await expect(redeemVoucher(master, 'nope', { baseUrl, fetch: refuse(409, 'X') })).rejects.toThrow('This is not a voucher code. It looks like this: PA-XXXX-XXXX-XXXX.');
	});
	it('asks for the terms first, as a purchase does', async () => {
		await expect(redeemVoucher(master, 'PA-ABCD-EFGH-JKLM', { baseUrl, fetch: refuse(412, 'TERMS') })).rejects.toBeInstanceOf(TermsError);
	});
});

describe('what the service says about vouchers', () => {
	it('offers them only when it says so', async () => {
		const list = (/** @type {any} */ voucher) => service(() => [200, { network: null, packages: [], topups: [], ...(voucher === undefined ? {} : { voucher }) }]).fetch;
		expect((await creditsCatalog({ baseUrl, fetch: list({ offered: true, prefix: 'PA' }) }))?.voucherOffered).toBe(true);
		expect((await creditsCatalog({ baseUrl, fetch: list({ offered: false, prefix: 'PA' }) }))?.voucherOffered).toBe(false);
		expect((await creditsCatalog({ baseUrl, fetch: list(null) }))?.voucherOffered).toBe(false);
		expect((await creditsCatalog({ baseUrl, fetch: list(undefined) }))?.voucherOffered).toBe(false);
		expect((await creditsCatalog({ baseUrl, fetch: list({ offered: 'yes' }) }))?.voucherOffered).toBe(false);
	});
	it('reads a voucher’s period from the balance', async () => {
		const svc = service(() => [200, { credits: 0, reserved: 0, package: { id: 'paperless-voucher', billing: 'voucher', state: 'ending', period_end: '2026-11-20T10:15:00.000Z', hours_left: 168, renews_at: null, cancel_at_period_end: false } }]);
		expect((await creditsBalance(master, { baseUrl, fetch: svc.fetch }))?.plan).toMatchObject({ id: 'paperless-voucher', billing: 'voucher', periodEnd: '2026-11-20T10:15:00.000Z', hoursLeft: 168, renewsAt: null, cancelAtPeriodEnd: false });
	});
});
