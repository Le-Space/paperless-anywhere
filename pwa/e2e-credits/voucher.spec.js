// Redeeming a voucher in the package card (le-space-credits#73), against the
// local mock of le-space-credits with made-up codes. Set SHOTS=<dir> to keep
// screenshots.
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { alephMock } from '../e2e/aleph-mock.js';
import { newMasterSecret } from '../src/lib/keys/derive.js';
import { newSeedPhrase, seal, sealingKeyFromSeedPhrase } from '../src/lib/keys/seal.js';
import { seedIndexAccount, VAULT_KEY } from '../src/lib/keys/index-keys.js';

const MOCK = 'http://127.0.0.1:4422';
const shot = (page, name, locator) => (process.env.SHOTS ? (locator ?? page).screenshot({ path: join(process.env.SHOTS, `${name}.png`) }) : null);

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

test.use({ locale: 'de-DE', timezoneId: 'Europe/Berlin' });
test.beforeEach(() => test.setTimeout(90_000));

test('no voucher field until the service takes vouchers', async ({ page }) => {
	await openApp(page, { plan: false, backup: 'none', offered: true, included: true, vouchers: false });
	await expect(page.getByTestId('plan-paperless-15-backup')).toBeVisible();
	await expect(page.getByTestId('voucher')).toHaveCount(0);
});

test('a voucher is redeemed in the package card and shows as a voucher period', async ({ page }) => {
	await openApp(page, { plan: false, backup: 'none', offered: true, included: true, vouchers: true });
	const fold = page.getByTestId('voucher');
	await expect(fold.locator('summary')).toHaveText('Gutschein einlösen');
	await fold.locator('summary').click();
	await expect(page.getByTestId('voucher-redeem')).toBeDisabled();
	await shot(page, 'voucher-field', page.getByTestId('package'));

	// A typo is caught here, and nothing is sent.
	await page.getByTestId('voucher-code').fill('PA-ABCD');
	await page.getByTestId('voucher-redeem').click();
	await expect(page.getByTestId('plan-error')).toHaveText('Das ist kein Gutschein-Code. Er sieht so aus: PA-XXXX-XXXX-XXXX.');
	expect(await received('/v1/voucher/redeem')).toEqual([]);

	// A code the service does not know, and one this account has redeemed already.
	await page.getByTestId('voucher-code').fill('PA-ZZZZ-ZZZZ-ZZZZ');
	await page.getByTestId('voucher-redeem').click();
	await expect(page.getByTestId('plan-error')).toHaveText('Diesen Gutschein-Code gibt es nicht. Bitte noch einmal prüfen.');
	await page.getByTestId('voucher-code').fill('pa used used used');
	await page.getByTestId('voucher-redeem').click();
	await expect(page.getByTestId('plan-error')).toHaveText('Diesen Gutschein hast du schon eingelöst.');

	// The real one, typed loosely.
	await page.getByTestId('voucher-code').fill('pa-abcd efgh-jklm');
	await page.getByTestId('voucher-redeem').click();
	await expect(page.getByTestId('plan-note')).toHaveText('Gutschein eingelöst: Dauerbetrieb bis 20.11.2026, Sicherung bis 20.11.2026.');
	expect((await received('/v1/voucher/redeem')).at(-1).body.code).toBe('PA-ABCD-EFGH-JKLM');
	expect((await received('/v1/voucher/redeem')).every((r) => !('waiver' in r.body))).toBe(true);

	// The card now shows the period: hours, its end, and nothing to change, end or cancel.
	await expect(page.getByTestId('plan-left')).toContainText('168 Stunden Laufzeit übrig, bis 20.11.');
	await expect(page.getByTestId('voucher-period')).toHaveText('Gutschein-Zeitraum bis 20.11.2026.');
	await expect(page.getByTestId('plan-current')).toContainText('Er verlängert sich nicht; danach kannst du ein Paket wählen.');
	await expect(page.getByTestId('voucher')).toHaveCount(0);
	await expect(page.getByTestId('plan-cancel')).toHaveCount(0);
	await page.getByTestId('package-more').click();
	await expect(page.getByTestId('plan-change')).toHaveCount(0);
	await expect(page.getByTestId('plan-end')).toHaveCount(0);
	// The backup runs with the period and says when it ends.
	// The backup runs with the period: said plainly, not as a warning, and with no word of a card payment.
	await expect(page.getByTestId('backup-status')).toHaveText('Sicherung: bezahlt bis zum 20.11.2026.');
	await expect(page.getByTestId('backup-status')).toHaveAttribute('data-tone', 'ok');
	await expect(page.getByTestId('backup-line')).toContainText('Nach dem Ende bleiben die Sicherungen noch bis zum 20.12.2026 abrufbar.');
	await expect(page.getByTestId('backup-mail-note')).toHaveCount(0);
	await shot(page, 'voucher-period', page.getByTestId('package'));
});

test('the terms come first, as before a purchase', async ({ page }) => {
	await openApp(page, { plan: false, backup: 'none', offered: true, included: true, vouchers: true, termsDue: true });
	await page.getByTestId('voucher').locator('summary').click();
	await page.getByTestId('voucher-code').fill('PA-WAIT-WAIT-WAIT');
	await page.getByTestId('voucher-redeem').click();
	await expect(page.getByTestId('plan-error')).toHaveText('Erst den aktuellen Bedingungen (AGB) zustimmen, dann geht es weiter.');
	await expect(page.getByTestId('voucher-period')).toHaveCount(0);
});

test('hours that are still to come are said so', async ({ page }) => {
	await openApp(page, { plan: false, backup: 'none', offered: true, included: true, vouchers: true });
	await page.getByTestId('voucher').locator('summary').click();
	await page.getByTestId('voucher-code').fill('PA-WAIT-WAIT-WAIT');
	await page.getByTestId('voucher-redeem').click();
	await expect(page.getByTestId('plan-note')).toHaveText('Gutschein eingelöst: Dauerbetrieb bis 20.11.2026, Sicherung bis 20.11.2026. Die Stunden erscheinen in Kürze.');
	await expect(page.getByTestId('plan-left')).toContainText('0 Stunden Laufzeit übrig');
});

test('vouchers in English', async ({ page }) => {
	await openApp(page, { plan: false, backup: 'none', offered: true, included: true, vouchers: true });
	await page.getByTestId('app-lang-en').click();
	await page.getByTestId('voucher').locator('summary').click();
	await expect(page.getByTestId('voucher')).toContainText('A voucher gives you a period of running time with backups, without a payment. It does not renew.');
	await page.getByTestId('voucher-code').fill('PA-ZZZZ-ZZZZ-ZZZZ');
	await page.getByTestId('voucher-redeem').click();
	await expect(page.getByTestId('plan-error')).toHaveText('There is no such voucher code. Please check it again.');
	await page.getByTestId('voucher-code').fill('PA-ABCD-EFGH-JKLM');
	await page.getByTestId('voucher-redeem').click();
	await expect(page.getByTestId('plan-note')).toHaveText('Voucher redeemed: always on until 20/11/2026, backups until 20/11/2026.');
	await expect(page.getByTestId('voucher-period')).toHaveText('Voucher period until 20/11/2026.');
});
