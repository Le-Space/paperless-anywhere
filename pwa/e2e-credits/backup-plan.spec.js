// The backup beside the plan (Le-Space/paperless-anywhere#175), against the
// local mock of le-space-credits: the box "mit Sicherung" at the plans, the
// backup line of the card with its two purchases, and the service's notices.
// Set SHOTS=<dir> to keep screenshots.
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { alephMock } from '../e2e/aleph-mock.js';
import { newMasterSecret } from '../src/lib/keys/derive.js';
import { newSeedPhrase, seal, sealingKeyFromSeedPhrase } from '../src/lib/keys/seal.js';
import { seedIndexAccount, VAULT_KEY } from '../src/lib/keys/index-keys.js';

const MOCK = 'http://127.0.0.1:4422';
const shot = (page, name, locator) => (process.env.SHOTS ? (locator ?? page).screenshot({ path: join(process.env.SHOTS, `${name}.png`) }) : null);

/** A fresh vault in the Aleph mock, the mock service in the given state, the app opened. */
async function openApp(page, state) {
	const install = alephMock();
	const aggregates = await install(page.context());
	const master = newMasterSecret();
	const phrase = newSeedPhrase();
	aggregates.set(seedIndexAccount(phrase).address, { [VAULT_KEY]: { v: 1, box: await seal(master, sealingKeyFromSeedPhrase(phrase), 'master/seed') } });
	await page.context().route(/^https?:\/\/(?!localhost|127\.0\.0\.1|api2\.aleph\.im)/, (route) => route.abort());
	await fetch(`${MOCK}/__state`, { method: 'POST', body: JSON.stringify(state) });
	await page.goto('/app/');
	await page.getByTestId('open-with-phrase').click();
	await page.locator('textarea').first().fill(phrase);
	await page.getByTestId('open-phrase').click();
	await expect(page.getByTestId('package')).toBeVisible();
}
const received = async (path) => (await (await fetch(`${MOCK}/__requests`)).json()).filter((r) => r.path === path);
const closeCheckout = (page) => page.getByRole('dialog').getByRole('button', { name: 'Schließen' }).click();

test.use({ locale: 'de-DE', timezoneId: 'Europe/Berlin' });
test.beforeEach(() => test.setTimeout(90_000));

test('until the service sells it, nothing of the backup line shows', async ({ page }) => {
	await openApp(page, { plan: false, backup: 'none', offered: false });
	await expect(page.getByTestId('plan-paperless-30')).toBeVisible();
	await expect(page.getByTestId('plan-backup')).toHaveCount(0);
	await expect(page.getByTestId('backup-status')).toContainText('nicht gebucht');
	await expect(page.getByTestId('backup-year-fold')).toHaveCount(0);
	await page.getByTestId('plan-waiver-box').check();
	await page.getByTestId('plan-paperless-30').click();
	await expect.poll(async () => (await received('/v1/subscribe')).map((r) => 'backup' in r.body)).toEqual([false]);
	await expect(page.getByTestId('checkout-summary')).not.toContainText('Sicherung');
	await closeCheckout(page);
});

test('“mit Sicherung” starts unticked, shows the total and goes into the order', async ({ page }) => {
	await openApp(page, { plan: false, backup: 'none', offered: true });
	const box = page.getByTestId('plan-backup-box');
	await expect(box).not.toBeChecked();
	await expect(page.getByTestId('plan-backup')).toContainText('mit Sicherung (+ 1,50 € im Monat)');
	await expect(page.getByTestId('plan-backup')).toContainText('Ohne Sicherung sind deine Dokumente nach einem Stopp weg.');
	await expect(page.getByTestId('plan-price-paperless-30')).toHaveText('6,00 €');
	await shot(page, 'plan-without-backup', page.getByTestId('package'));
	await box.check();
	await expect(page.getByTestId('plan-price-paperless-30')).toHaveText('7,50 €');
	await expect(page.getByTestId('plan-price-paperless-10')).toHaveText('5,50 €');
	await shot(page, 'plan-with-backup', page.getByTestId('package'));
	// Still the one declaration of the subscription, no second box.
	await expect(page.getByTestId('plan-paperless-30')).toBeDisabled();
	await page.getByTestId('plan-waiver-box').check();
	await page.getByTestId('plan-paperless-30').click();
	await expect.poll(async () => (await received('/v1/subscribe')).map((r) => [r.body.package, r.body.backup, r.body.waiver])).toEqual([['paperless-30', true, '1']]);
	await expect(page.getByTestId('checkout-summary')).toHaveText('30 Stunden im Monat: 6,00 € + Sicherung 1,50 € = 7,50 €. Monatsabo, verlängert sich jeden Monat, kündbar zum Monatsende.');
	await shot(page, 'checkout-summary', page.getByRole('dialog'));
	await closeCheckout(page);

	// Without the tick the order says so and sends no backup.
	await box.uncheck();
	await page.getByTestId('plan-waiver-box').check();
	await page.getByTestId('plan-paperless-30').click();
	await expect(page.getByTestId('checkout-summary')).toContainText('6,00 €, ohne Sicherung.');
	await expect.poll(async () => (await received('/v1/subscribe')).map((r) => 'backup' in r.body)).toEqual([true, false]);
	await closeCheckout(page);
});

test('packages that include the backup show one price, no box, and say what is included', async ({ page }) => {
	await openApp(page, { plan: false, backup: 'none', offered: true, included: true });
	await expect(page.getByTestId('plan-backup')).toHaveCount(0);
	await expect(page.getByTestId('plan-backup-included')).toHaveText('Sicherung inklusive: 3 verschlüsselte Kopien, bis 32 GiB, nach dem Ende noch 30 Tage abrufbar.');
	await expect(page.getByTestId('plan-price-paperless-15-backup')).toHaveText('6,40 €');
	await expect(page.getByTestId('plan-price-paperless-100-backup')).toHaveText('16,40 €');
	await expect(page.getByTestId('plan-price-paperless-always-backup')).toHaveText('90,50 €');
	await expect(page.getByTestId('plan-paperless-15-backup')).toContainText('Sicherung inklusive');
	await shot(page, 'plans-backup-included', page.getByTestId('package'));
	await page.getByTestId('plan-waiver-box').check();
	await page.getByTestId('plan-paperless-15-backup').click();
	// The plan carries the backup: no extra flag goes out, and the order says what it holds.
	await expect.poll(async () => (await received('/v1/subscribe')).map((r) => [r.body.package, 'backup' in r.body])).toEqual([['paperless-15-backup', false]]);
	await expect(page.getByTestId('checkout-summary')).toHaveText('15 Stunden im Monat: 6,40 €, Sicherung inklusive. Monatsabo, verlängert sich jeden Monat, kündbar zum Monatsende.');
	await closeCheckout(page);
	// The year of keeping stays, also without a package.
	await expect(page.getByTestId('backup-year-fold')).toHaveCount(1);
});

test('the backup is added to a running subscription in the app, with its own declaration', async ({ page }) => {
	await openApp(page, { plan: true, backup: 'none', offered: true });
	await expect(page.getByTestId('backup-status')).toHaveText('Sicherung: nicht gebucht. Ohne Sicherung sind deine Dokumente nach einem Stopp weg.');
	await page.getByText('Sicherung zum Abo hinzubuchen (1,50 € im Monat)').click();
	await expect(page.getByTestId('backup-add-fold')).toContainText('nächste Abbuchung am 01.12.2026');
	await expect(page.getByTestId('backup-add-waiver-box')).not.toBeChecked();
	await expect(page.getByTestId('backup-add')).toBeDisabled();
	await shot(page, 'backup-add', page.getByTestId('backup-line'));
	await page.getByTestId('backup-add-waiver-box').check();
	await page.getByTestId('backup-add').click();
	await expect.poll(async () => (await received('/v1/backup/subscription')).map((r) => r.body.waiver)).toEqual(['1']);
	await expect(page.getByTestId('backup-status')).toHaveText('Sicherung: Teil deines Abos, verlängert sich mit dem Paket. Bezahlt bis zum 01.12.2026.');
	await expect(page.getByTestId('backup-note')).toContainText('jetzt Teil deines Abos');
	// Adding is gone; removing points to the portal.
	await expect(page.getByTestId('backup-add-fold')).toHaveCount(0);
	await expect(page.getByTestId('backup-remove')).toBeVisible();
	await shot(page, 'backup-line-on', page.getByTestId('backup-line'));
});

test('a year of keeping is its own purchase, with or without a plan', async ({ page }) => {
	await openApp(page, { plan: false, backup: 'week', offered: true });
	const status = page.getByTestId('backup-status');
	await expect(status).toHaveAttribute('data-tone', 'warn');
	await expect(status).toHaveText('Die Sicherung ist bis zum 18.11.2026 bezahlt (noch 5 Tage). Danach entstehen keine neuen Sicherungen mehr.');
	await expect(page.getByTestId('backup-mail-note')).toContainText('Adresse aus deiner Kartenzahlung');
	// No card subscription: nothing to add a line to.
	await expect(page.getByTestId('backup-add-fold')).toHaveCount(0);
	await page.getByText('1 Jahr Aufbewahrung buchen (18,00 €, einmalig)').click();
	await expect(page.getByTestId('backup-year-fold')).toContainText('Aufbewahren heißt nicht öffnen: Zum Wiederherstellen braucht es Rechenzeit, also ein laufendes Paket oder Zusatzstunden.');
	await expect(page.getByTestId('backup-year')).toBeDisabled();
	await shot(page, 'backup-year', page.getByTestId('backup-line'));
	await page.getByTestId('backup-year-waiver-box').check();
	await page.getByTestId('backup-year').click();
	await expect.poll(async () => (await received('/v1/backup/checkout')).map((r) => r.body.waiver)).toEqual(['1']);
	await expect(page.getByTestId('checkout-summary')).toHaveText('1 Jahr Aufbewahrung der Sicherungen: 18,00 €, einmalig, keine Verlängerung.');
	await closeCheckout(page);
	await expect(page.getByTestId('backup-note')).toHaveText('Das Jahr wurde nicht gekauft.');
	await expect(page.getByTestId('backup-year-waiver-box')).not.toBeChecked();
});

for (const [state, tone, text] of [
	['soon', 'soon', 'Die Sicherung ist bis zum 06.12.2026 bezahlt. Danach entstehen keine neuen Sicherungen mehr.'],
	['ended', 'warn', 'Seit dem 03.11.2026 entstehen keine neuen Sicherungen. Die vorhandenen bleiben bis zum 03.12.2026 abrufbar.'],
	['paid', 'ok', 'Sicherung: bezahlt bis zum 13.11.2027.']
]) {
	test(`the service's notice is shown as it is: ${state}`, async ({ page }) => {
		await openApp(page, { plan: true, backup: state, offered: true });
		await expect(page.getByTestId('backup-status')).toHaveAttribute('data-tone', tone);
		await expect(page.getByTestId('backup-status')).toHaveText(text);
		await shot(page, `backup-${state}`, page.getByTestId('backup-line'));
	});
}

test('after the retention nothing pretends the backups can be brought back', async ({ page }) => {
	await openApp(page, { plan: true, backup: 'over', offered: true });
	await expect(page.getByTestId('backup-status')).toHaveAttribute('data-tone', 'over');
	await expect(page.getByTestId('backup-status')).toContainText('Die Sicherungen sind abgelaufen.');
});

// Before a start: a package pays the VM, but no backup period covers today.
test.describe('a start without a paid backup', () => {
	/** As openApp, with a profile that is ready to start and paid from the package. */
	async function openReady(page, state, role = 'primary', extra = {}) {
		const { privateKeyToAccount } = await import('viem/accounts');
		const { alephPrivateKey, deriveBytes, LABELS } = await import('../src/lib/keys/derive.js');
		const { PROFILE_KEY } = await import('../src/lib/profile.js');
		const install = alephMock();
		const aggregates = await install(page.context());
		const master = newMasterSecret();
		const phrase = newSeedPhrase();
		aggregates.set(seedIndexAccount(phrase).address, { [VAULT_KEY]: { v: 1, box: await seal(master, sealingKeyFromSeedPhrase(phrase), 'master/seed') } });
		const profile = { network: role === 'primary' ? 'mainnet' : 'calibration', role, leSpacePays: true, rootfsItemHash: 'a'.repeat(64), luksPassphrase: 'made-up-passphrase', crnHash: 'd'.repeat(64), ...extra };
		const sealed = await seal(new TextEncoder().encode(JSON.stringify(profile)), deriveBytes(master, LABELS.profileKey), 'profile');
		aggregates.set(privateKeyToAccount(alephPrivateKey(master)).address, { [PROFILE_KEY]: { v: 1, box: sealed } });
		await page.context().route(/^https?:\/\/(?!localhost|127\.0\.0\.1|api2\.aleph\.im)/, (route) => route.abort());
		await fetch(`${MOCK}/__state`, { method: 'POST', body: JSON.stringify(state) });
		await page.goto('/app/');
		await page.getByTestId('open-with-phrase').click();
		await page.locator('textarea').first().fill(phrase);
		await page.getByTestId('open-phrase').click();
		await expect(page.getByTestId('package')).toBeVisible();
	}
	const startButton = (page) => page.getByRole('button', { name: 'Paperless anywhere starten' }).first();
	const question = (page) => page.getByTestId('start-unpaid-backup');

	test('asks once, with the way to the backup first', async ({ page }) => {
		await openReady(page, { plan: true, backup: 'ended', offered: true });
		await startButton(page).click();
		await expect(question(page)).toContainText('Für heute ist keine Sicherung bezahlt.');
		await expect(question(page).getByRole('button')).toHaveText(['Erst die Sicherung buchen (im Paket)', 'Ohne Sicherung starten', 'Doch nicht starten']);
		await shot(page, 'start-unpaid', question(page));
		// Nothing was started yet.
		expect(await received('/v1/vm/authorize')).toEqual([]);
		await page.getByTestId('start-book-backup').click();
		await expect(question(page)).toHaveCount(0);
		await expect(page.getByTestId('backup-line')).toBeInViewport();
		expect(await received('/v1/vm/authorize')).toEqual([]);

		// The explicit third choice starts.
		await startButton(page).click();
		await page.getByTestId('start-without-backup').click();
		await expect(question(page)).toHaveCount(0);
		await expect.poll(async () => (await received('/v1/vm/authorize')).length).toBe(1);
	});

	test('does not ask when the backup is paid', async ({ page }) => {
		await openReady(page, { plan: true, backup: 'line', offered: true });
		await startButton(page).click();
		await expect.poll(async () => (await received('/v1/vm/authorize')).length).toBe(1);
		await expect(question(page)).toHaveCount(0);
	});

	test('does not ask a test instance', async ({ page }) => {
		await openReady(page, { plan: true, backup: 'ended', offered: true }, 'test');
		await startButton(page).click();
		await expect.poll(async () => (await received('/v1/vm/authorize')).length).toBe(1);
		await expect(question(page)).toHaveCount(0);
	});

	test('backups paid from the own wallet: the card offers nothing and warns of nothing', async ({ page }) => {
		// A made-up wallet pays the VM and the backups; Le Space sells this account nothing.
		await openReady(page, { plan: false, backup: 'none', offered: true }, 'test', { leSpacePays: false, payer: '0x00000000000000000000000000000000000000aa', backupConfig: { providers: 2 }, backupsByCredits: false });
		// The card is one line for someone who pays the providers themselves, until they open it.
		const self = page.getByTestId('package-self');
		await expect(self.locator('> summary')).toContainText('Du zahlst die Anbieter selbst.');
		await expect(page.getByTestId('plan-paperless-30')).toBeHidden();
		await expect(page.getByTestId('backup-status')).toBeHidden();
		if (process.env.SHOTS) await page.getByTestId('package').screenshot({ path: `${process.env.SHOTS}/package-self-closed.png` });
		await self.locator('> summary').click();
		await expect(self).toContainText('Deine Wallet bezahlt die VM bei Aleph direkt');
		await expect(page.getByTestId('plan-paperless-30')).toBeVisible();
		await expect(page.getByTestId('backup-status')).toContainText('bezahlst du aus deiner eigenen Wallet');
		await expect(page.getByTestId('backup-status')).not.toContainText('nicht gebucht');
		await expect(page.getByTestId('backup-year-fold')).toHaveCount(0);
		await expect(page.getByTestId('backup-add-fold')).toHaveCount(0);
	});
});
