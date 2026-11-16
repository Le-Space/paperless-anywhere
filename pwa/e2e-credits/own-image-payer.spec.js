// The own image's price follows who pays (Setup.svelte): with the package and
// a Le Space balance of 0 it says what a build costs and that a voucher does
// not go while the package runs; switched to the app's address, it asks Aleph
// instead and no longer shows the package's answer.
import { expect, test } from '@playwright/test';
import { alephMock } from '../e2e/aleph-mock.js';
import { newMasterSecret } from '../src/lib/keys/derive.js';
import { newSeedPhrase, seal, sealingKeyFromSeedPhrase } from '../src/lib/keys/seal.js';
import { seedIndexAccount, VAULT_KEY } from '../src/lib/keys/index-keys.js';

const MOCK = 'http://127.0.0.1:4422';

test.use({ locale: 'de-DE', timezoneId: 'Europe/Berlin' });
test.beforeEach(() => test.setTimeout(90_000));

test('switching who pays asks again whether a build is affordable', async ({ page }) => {
	const install = alephMock();
	const aggregates = await install(page.context());
	const master = newMasterSecret();
	const phrase = newSeedPhrase();
	aggregates.set(seedIndexAccount(phrase).address, { [VAULT_KEY]: { v: 1, box: await seal(master, sealingKeyFromSeedPhrase(phrase), 'master/seed') } });
	await page.context().route(/^https?:\/\/(?!localhost|127\.0\.0\.1|api2\.aleph\.im)/, (route) => route.abort());
	await fetch(`${MOCK}/__state`, { method: 'POST', body: JSON.stringify({ plan: true, backup: 'none', buildShort: true }) });
	await page.goto('/app/');
	await page.getByTestId('open-with-phrase').click();
	await page.locator('textarea').first().fill(phrase);
	await page.getByTestId('open-phrase').click();
	await page.getByTestId('tab-advanced').click();

	await page.getByTestId('pays-lespace').check();
	await page.getByTestId('image-own').check();
	const no = page.getByTestId('own-image-package-no');
	await expect(no).toContainText('Ein Bau kostet 0,30 €');
	await expect(no).toContainText('Es fehlen 0,30 €');
	await expect(no).toContainText('Einen Gutschein kannst du nicht einlösen, solange dein Paket läuft.');

	// The app's address pays now: Aleph is asked (nothing there in this mock), the package's answer goes.
	await page.getByTestId('pays-app').check();
	// The saved payer reloads the setup, which may show the image choice anew: picked again.
	await expect(async () => {
		await page.getByTestId('image-own').check();
		await expect(page.getByTestId('own-image-needs-credits')).toContainText('braucht derzeit Aleph-Guthaben', { timeout: 2000 });
	}).toPass({ timeout: 20_000 });
	await expect(no).toHaveCount(0);

	// And back to the package: asked again, with the same answer.
	await page.getByTestId('pays-lespace').check();
	await expect(async () => {
		await page.getByTestId('image-own').check();
		await expect(no).toContainText('Ein Bau kostet 0,30 €', { timeout: 2000 });
	}).toPass({ timeout: 20_000 });
	await expect(page.getByTestId('own-image-needs-credits')).toHaveCount(0);

	// Topped up: "check again" asks the service anew, and the build is offered with its price.
	await fetch(`${MOCK}/__state`, { method: 'POST', body: JSON.stringify({ plan: true, backup: 'none', buildShort: false }) });
	await page.getByTestId('own-image-recheck').click();
	await expect(no).toHaveCount(0);
	await expect(page.getByTestId('own-image-price')).toContainText('Ein Bau kostet 0,30 €');
	await expect(page.getByTestId('own-image-build')).toBeVisible();
});
