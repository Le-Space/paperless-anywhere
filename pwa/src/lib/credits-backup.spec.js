// The backup beside the plan (le-space-credits#69, paperless-anywhere#175):
// what the service offers, where an account's backup stands, the two new
// purchases, and the words the app finds for the service's notice.
import { describe, expect, it } from 'vitest';
import { addBackupLine, backupNoticeOf, backupOf, backupOfferOf, backupStatus, creditsAccount, creditsCatalog, CREDITS_PRODUCT, startBackupYear, startSubscription, waitForBackup, WaiverError } from './credits.js';

const master = new Uint8Array(32).fill(7);
const account = creditsAccount(master);
const baseUrl = 'https://credits.example.com';
const payer = '0x' + '5'.repeat(40);

/** Answers every request with `answer(path, body)`; keeps what it saw. */
function jsonService(answer) {
	const seen = { /** @type {any} */ last: null };
	return {
		seen,
		fetch: async (/** @type {string} */ url, /** @type {RequestInit} */ init = {}) => {
			const u = new URL(url);
			seen.last = { path: u.pathname, method: init.method ?? 'GET', body: init.body ? JSON.parse(String(init.body)) : null };
			const [status, json] = answer(u.pathname, seen.last.body);
			return new Response(JSON.stringify(json), { status, headers: { 'content-type': 'application/json' } });
		}
	};
}

const OFFER = { month_credits: 150, month_price_cents: 150, year_price_cents: 1800, year_days: 365, copies: 3, quota_gib: 32, retention_days: 30, plan_offered: true };

describe('what the service offers of backups', () => {
	it('reads the line and the year from the catalogue', async () => {
		const svc = jsonService(() => [200, { network: 'mainnet', backup: OFFER, packages: [{ id: 'paperless-15', hours: 15, price_credits: 490, backup_month_credits: 150 }], topups: [] }]);
		const catalog = await creditsCatalog({ baseUrl, fetch: svc.fetch });
		expect(catalog?.backup).toEqual({ monthCents: 150, yearCents: 1800, yearDays: 365, copies: 3, quotaGib: 32, retentionDays: 30, planOffered: true, includedInPlans: false });
	});
	it('reads packages that include the backup, and names the old ones for accounts still on them', async () => {
		const svc = jsonService(() => [200, { network: 'mainnet', backup: { ...OFFER, included_in_plans: true }, packages: [{ id: 'paperless-15-backup', hours: 15, price_credits: 640, backup_included: true }], topups: [] }]);
		const catalog = await creditsCatalog({ baseUrl, fetch: svc.fetch });
		expect(catalog?.plans).toEqual([{ id: 'paperless-15-backup', hours: 15, priceCredits: 640, backupIncluded: true }]);
		expect(catalog?.backup?.includedInPlans).toBe(true);
		expect(backupOfferOf(OFFER)?.includedInPlans).toBe(false);
		const { planOf } = await import('./credits.js');
		expect(planOf('paperless-15', catalog?.plans)).toEqual({ id: 'paperless-15', hours: 15, priceCredits: 490 });
		expect(planOf('paperless-always', catalog?.plans)?.priceCredits).toBe(8900);
	});
	it('is null from a service that names no prices, and not offered until the service says so', () => {
		expect(backupOfferOf(undefined)).toBeNull();
		expect(backupOfferOf({ month_credits: 150 })).toBeNull();
		expect(backupOfferOf({ ...OFFER, month_price_cents: '150' })).toBeNull();
		expect(backupOfferOf({ ...OFFER, plan_offered: false })?.planOffered).toBe(false);
		expect(backupOfferOf({ ...OFFER, plan_offered: 'yes' })?.planOffered).toBe(false);
	});
});

describe('where the backup stands', () => {
	const base = { payer, tag: 't', network: 'mainnet', funded_until: '2027-01-10T00:00:00.000Z' };
	it('reads the plan line, the retention and the notice', () => {
		const b = backupOf({ ...base, active: true, renews_with_plan: true, retention_until: '2027-02-09T00:00:00.000Z', notice: null });
		expect(b).toMatchObject({ active: true, renewsWithPlan: true, retentionUntil: '2027-02-09T00:00:00.000Z', notice: null });
	});
	it('knows nothing of them from an older service', () => {
		expect(backupOf(base)).toMatchObject({ active: null, renewsWithPlan: false, retentionUntil: null, notice: null });
	});
	it('takes only the notices it knows', () => {
		expect(backupNoticeOf({ kind: 'expires_soon', funded_until: 'x', retention_until: 'y', days_left: 6, retention_days_left: 36 })).toEqual({ kind: 'expires_soon', fundedUntil: 'x', retentionUntil: 'y', daysLeft: 6, retentionDaysLeft: 36 });
		expect(backupNoticeOf({ kind: 'buy-now', days_left: 1 })).toBeNull();
		expect(backupNoticeOf(null)).toBeNull();
		expect(backupNoticeOf({ kind: 'expired' })).toMatchObject({ daysLeft: null, retentionDaysLeft: null });
	});
});

describe('the words for it', () => {
	const tz = { timeZone: 'Europe/Berlin' };
	const at = { fundedUntil: '2027-01-10T12:00:00.000Z', retentionUntil: '2027-02-09T12:00:00.000Z' };
	const backup = (/** @type {any} */ more) => /** @type {any} */ ({ payer, signer: null, tag: '', network: 'mainnet', dataSets: [], active: true, renewsWithPlan: false, notice: null, ...at, ...more });
	const notice = (/** @type {string} */ kind, /** @type {number} */ daysLeft) => ({ kind, ...at, daysLeft, retentionDaysLeft: daysLeft + 30 });

	it('names the subscription line and a paid end', () => {
		expect(backupStatus(backup({ renewsWithPlan: true }), tz)).toEqual({ tone: 'ok', text: 'Sicherung: Teil deines Abos, verlängert sich mit dem Paket. Bezahlt bis zum 10.01.2027.' });
		expect(backupStatus(backup({}), tz)).toEqual({ tone: 'ok', text: 'Sicherung: bezahlt bis zum 10.01.2027.' });
	});
	it('is quiet 30 days before and warns in the last week', () => {
		const soon = backupStatus(backup({ notice: notice('expires_soon', 23) }), tz);
		expect(soon.tone).toBe('soon');
		expect(soon.text).toBe('Die Sicherung ist bis zum 10.01.2027 bezahlt. Danach entstehen keine neuen Sicherungen mehr.');
		const week = backupStatus(backup({ notice: notice('expires_soon', 7) }), tz);
		expect(week.tone).toBe('warn');
		expect(week.text).toContain('(noch 7 Tage)');
		expect(backupStatus(backup({ notice: notice('expires_soon', 1) }), tz).text).toContain('(noch 1 Tag)');
	});
	it('says what still can be fetched after the end, and when nothing can', () => {
		const ended = backupStatus(backup({ active: false, notice: notice('expired', -3) }), tz);
		expect(ended).toEqual({ tone: 'warn', text: 'Seit dem 10.01.2027 entstehen keine neuen Sicherungen. Die vorhandenen bleiben bis zum 09.02.2027 abrufbar.' });
		const over = backupStatus(backup({ active: false, notice: notice('retention_over', -40) }), tz);
		expect(over.tone).toBe('over');
		expect(over.text).toMatch(/^Die Sicherungen sind abgelaufen\./);
	});
	it('says so when no backup was ever booked', () => {
		expect(backupStatus(backup({ active: false, fundedUntil: null, retentionUntil: null }), tz)).toEqual({ tone: 'none', text: 'Sicherung: nicht gebucht. Ohne Sicherung sind deine Dokumente nach einem Stopp weg.' });
	});
});

describe('buying', () => {
	it('subscribes with the backup line only when asked', async () => {
		const svc = jsonService(() => [200, { client_secret: 'cs_test_x' }]);
		await startSubscription(master, 'paperless-15', { baseUrl, fetch: svc.fetch, waiver: '2', backup: true });
		expect(svc.seen.last.body).toEqual({ product: CREDITS_PRODUCT, address: account.address, package: 'paperless-15', locale: 'de', waiver: '2', backup: true });
		await startSubscription(master, 'paperless-15', { baseUrl, fetch: svc.fetch, waiver: '2', backup: false });
		expect(svc.seen.last.body).not.toHaveProperty('backup');
		await startSubscription(master, 'paperless-15', { baseUrl, fetch: svc.fetch });
		expect(svc.seen.last.body).not.toHaveProperty('backup');
	});
	it('adds the line to a running subscription with its own declaration', async () => {
		const svc = jsonService(() => [200, { added: true, funded_until: '2026-12-01T00:00:00.000Z' }]);
		expect(await addBackupLine(master, { baseUrl, fetch: svc.fetch, waiver: '2' })).toEqual({ fundedUntil: '2026-12-01T00:00:00.000Z' });
		expect(svc.seen.last).toMatchObject({ method: 'POST', path: '/v1/backup/subscription', body: { product: CREDITS_PRODUCT, address: account.address, waiver: '2' } });
	});
	it('opens the year’s own Checkout', async () => {
		const svc = jsonService(() => [200, { client_secret: 'cs_test_year' }]);
		expect(await startBackupYear(master, { baseUrl, fetch: svc.fetch, waiver: '2' })).toBe('cs_test_year');
		expect(svc.seen.last).toMatchObject({ method: 'POST', path: '/v1/backup/checkout', body: { waiver: '2', locale: 'de' } });
		const none = jsonService(() => [200, {}]);
		await expect(startBackupYear(master, { baseUrl, fetch: none.fetch })).rejects.toThrow(/keine Bezahlseite/);
	});
	it('explains what the service refuses', async () => {
		const refuse = (/** @type {number} */ status, /** @type {string} */ code) => jsonService(() => [status, { error: code.toLowerCase(), code }]).fetch;
		await expect(addBackupLine(master, { baseUrl, fetch: refuse(409, 'NOT_YET') })).rejects.toThrow(/erst mit den neuen AGB/);
		await expect(addBackupLine(master, { baseUrl, fetch: refuse(409, 'BACKUP_ON') })).rejects.toThrow(/schon Teil deines Abos/);
		await expect(addBackupLine(master, { baseUrl, fetch: refuse(409, 'BACKUP_INCLUDED') })).rejects.toThrow(/in deinem Paket schon enthalten/);
		await expect(addBackupLine(master, { baseUrl, fetch: refuse(409, 'NO_SUBSCRIPTION') })).rejects.toThrow(/laufendes Abo/);
		await expect(startBackupYear(master, { baseUrl, fetch: refuse(503, 'STRIPE_OFF') })).rejects.toThrow(/noch nicht eingerichtet/);
		await expect(startBackupYear(master, { baseUrl, fetch: refuse(412, 'WAIVER') })).rejects.toBeInstanceOf(WaiverError);
	});
	it('waits until the backup is paid further than before', async () => {
		let n = 0;
		const read = async () => /** @type {any} */ ({ backup: { fundedUntil: ++n > 2 ? '2027-12-01T00:00:00.000Z' : '2026-12-01T00:00:00.000Z' } });
		expect((await waitForBackup(master, '2026-12-01T00:00:00.000Z', { read, delayMs: 1 })).booked).toBe(true);
		const never = async () => /** @type {any} */ ({ backup: { fundedUntil: null } });
		expect((await waitForBackup(master, null, { read: never, delayMs: 1, tries: 2 })).booked).toBe(false);
	});
});

describe('withdrawing a backup year', () => {
	it('is listed like the other contracts', async () => {
		const { withdrawableOf, withdrawableName } = await import('./credits.js');
		const w = withdrawableOf({ subject: 'backup', what: '', concluded_at: '2026-11-13T09:00:00.000Z', until: '2026-11-27T09:00:00.000Z' });
		expect(w).toMatchObject({ subject: 'backup', concludedAt: '2026-11-13T09:00:00.000Z' });
		expect(withdrawableName(/** @type {any} */ (w))).toBe('1 Jahr Aufbewahrung der Sicherungen');
		expect(withdrawableOf({ subject: 'something-else' })).toBeNull();
	});
});
