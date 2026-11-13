// The credits module in English: its messages and the service's error codes
// follow the language at the moment they are needed, the payment page is
// asked for in that language, and the legal wording stays German.
import { afterEach, describe, expect, it } from 'vitest';
import { setLang } from './i18n/index.js';
import { addBackupLine, backupStatus, CANCEL_KIND, cancelSubscription, contractName, creditsAccount, CREDITS_PRODUCT, CreditsShortError, fundVm, planHours, planOf, startSubscription, TermsError, WaiverError, withdrawableName } from './credits.js';

const master = new Uint8Array(32).fill(7);
const account = creditsAccount(master);
const baseUrl = 'https://credits.example.com';
function jsonService(answer) {
	const seen = { /** @type {any} */ last: null };
	return { seen, fetch: async (/** @type {string} */ url, /** @type {RequestInit} */ init = {}) => {
		seen.last = { path: new URL(url).pathname, body: init.body ? JSON.parse(String(init.body)) : null };
		const [status, json] = answer();
		return new Response(JSON.stringify(json), { status, headers: { 'content-type': 'application/json' } });
	} };
}
const refuse = (/** @type {number} */ status, /** @type {string} */ code, error = code.toLowerCase()) => jsonService(() => [status, { error, code }]).fetch;

afterEach(() => setLang('de'));

describe('the credits module in English', () => {
	it('puts the service’s codes into English sentences, and back into German', async () => {
		setLang('en');
		await expect(addBackupLine(master, { baseUrl, fetch: refuse(409, 'BACKUP_ON') })).rejects.toThrow('The backup is already part of your subscription.');
		await expect(addBackupLine(master, { baseUrl, fetch: refuse(409, 'SUBSCRIBED') })).rejects.toThrow(/A subscription is already running/);
		await expect(cancelSubscription(master, { baseUrl, fetch: refuse(409, 'NO_SUBSCRIPTION') })).rejects.toThrow('No subscription is running that could be cancelled.');
		await expect(startSubscription(master, 'paperless-15-backup', { baseUrl, fetch: refuse(412, 'WAIVER') })).rejects.toBeInstanceOf(WaiverError);
		await expect(startSubscription(master, 'paperless-15-backup', { baseUrl, fetch: refuse(412, 'TERMS') })).rejects.toThrow(/Agree to the current terms/);
		await expect(startSubscription(master, 'paperless-15-backup', { baseUrl, fetch: refuse(412, 'TERMS') })).rejects.toBeInstanceOf(TermsError);
		await expect(fundVm(master, 5, { baseUrl, fetch: refuse(500, 'UNKNOWN_CODE', '') })).rejects.toThrow('Le Space Credits answer 500');
		const short = await fundVm(master, 5, { baseUrl, fetch: refuse(402, 'SHORT', 'insufficient credits: 100 free, 250 needed') }).catch((e) => e);
		expect(short).toBeInstanceOf(CreditsShortError);
		expect(short.message).toBe('The Le Space Credits do not cover this (€1.50 missing). Top up first.');
		setLang('de');
		await expect(addBackupLine(master, { baseUrl, fetch: refuse(409, 'BACKUP_ON') })).rejects.toThrow('Die Sicherung ist schon Teil deines Abos.');
	});

	it('asks for the payment page in the language shown', async () => {
		const svc = jsonService(() => [200, { client_secret: 'cs_test_x' }]);
		setLang('en');
		await startSubscription(master, 'paperless-15-backup', { baseUrl, fetch: svc.fetch });
		expect(svc.seen.last.body).toEqual({ product: CREDITS_PRODUCT, address: account.address, package: 'paperless-15-backup', locale: 'en' });
		setLang('de');
		await startSubscription(master, 'paperless-15-backup', { baseUrl, fetch: svc.fetch });
		expect(svc.seen.last.body.locale).toBe('de');
	});

	it('names hours and the backup’s state in English', () => {
		setLang('en');
		expect(planHours({ hours: 15 })).toBe('15 hours');
		expect(planHours({ hours: 730 })).toBe('Always on');
		const backup = /** @type {any} */ ({ active: true, renewsWithPlan: true, fundedUntil: '2027-01-10T12:00:00.000Z', retentionUntil: null, notice: null });
		expect(backupStatus(backup, { timeZone: 'Europe/Berlin' })).toEqual({ tone: 'ok', text: 'Backup: part of your subscription, renews with the package. Paid until 10/01/2027.' });
		expect(backupStatus({ ...backup, active: false, renewsWithPlan: false }).text).toBe('Backup: not booked. Without a backup your documents are gone after a stop.');
	});

	it('keeps the legal wording German', () => {
		setLang('en');
		expect(contractName(planOf('paperless-always-backup'))).toBe('Paperless anywhere, Paket Dauerbetrieb, Monatsabo');
		expect(CANCEL_KIND).toBe('Ordentliche Kündigung zum Ende des bezahlten Monats');
		expect(withdrawableName({ subject: 'backup', what: '' })).toBe('1 Jahr Aufbewahrung der Sicherungen');
	});
});
