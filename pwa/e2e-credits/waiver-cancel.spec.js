// The declaration on withdrawal before every payment and the app's own cancel
// page (§ 312k BGB), against the local mock of le-space-credits. The vault is
// made here, put into the Aleph mock and opened with its recovery phrase.
// Set SHOTS=<dir> to keep screenshots of the waiver box and the cancel view.
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { alephMock } from '../e2e/aleph-mock.js';
import { newMasterSecret } from '../src/lib/keys/derive.js';
import { newSeedPhrase, seal, sealingKeyFromSeedPhrase } from '../src/lib/keys/seal.js';
import { seedIndexAccount, VAULT_KEY } from '../src/lib/keys/index-keys.js';

const MOCK = 'http://127.0.0.1:4422';
const shot = (page, name, locator) => (process.env.SHOTS ? (locator ?? page).screenshot({ path: join(process.env.SHOTS, `${name}.png`) }) : null);

/** A fresh vault in the Aleph mock, the mock service in the given state, the app opened. */
async function openApp(page, { plan }) {
	const install = alephMock();
	const aggregates = await install(page.context());
	const master = newMasterSecret();
	const phrase = newSeedPhrase();
	aggregates.set(seedIndexAccount(phrase).address, { [VAULT_KEY]: { v: 1, box: await seal(master, sealingKeyFromSeedPhrase(phrase), 'master/seed') } });
	// Nothing leaves the test but the app itself, the Aleph mock and the credits mock.
	await page.context().route(/^https?:\/\/(?!localhost|127\.0\.0\.1|api2\.aleph\.im)/, (route) => route.abort());
	await fetch(`${MOCK}/__state`, { method: 'POST', body: JSON.stringify({ plan }) });
	await page.goto('/app/');
	await page.getByTestId('open-with-phrase').click();
	await page.locator('textarea').first().fill(phrase);
	await page.getByTestId('open-phrase').click();
	await expect(page.getByTestId('package')).toBeVisible();
}
const received = async (path) => (await (await fetch(`${MOCK}/__requests`)).json()).filter((r) => r.path === path);

test.use({ locale: 'de-DE', timezoneId: 'Europe/Berlin' });

test('a purchase is chosen first, then its one declaration shows, and it goes out with that purchase', async ({ page }) => {
	test.setTimeout(90_000);
	await openApp(page, { plan: false });
	const declarations = page.getByText('Beispieltext zum Widerruf');
	// Nothing chosen: no declaration on the screen, even with the top-up open.
	await page.getByText('Aufladen, Stunden dazukaufen, Paket ändern').click();
	await expect(declarations).toHaveCount(0);
	await shot(page, 'waiver-none', page.getByTestId('package'));

	// A package chosen: its declaration below the cards, unticked; payment waits for the tick.
	await page.getByTestId('plan-paperless-30').click();
	await expect(page.getByTestId('plan-paperless-30')).toHaveAttribute('aria-pressed', 'true');
	await expect(page.getByTestId('plan-step')).toContainText('Für diesen Kauf: 30 Stunden im Monat');
	await expect(declarations).toHaveCount(1);
	await expect(page.getByTestId('plan-waiver-box')).not.toBeChecked();
	await expect(page.getByTestId('plan-pay')).toBeDisabled();
	await shot(page, 'waiver-unticked', page.getByTestId('package'));
	await page.getByTestId('plan-waiver-box').check();
	await shot(page, 'waiver-ticked', page.getByTestId('package'));

	// An amount chosen instead: the package's declaration goes, unticked; the amount's shows.
	await page.getByTestId('topup-topup-20').click();
	await expect(page.getByTestId('plan-step')).toHaveCount(0);
	await expect(page.getByTestId('topup-step')).toContainText('Für diesen Kauf: 20 € aufladen');
	await expect(declarations).toHaveCount(1);
	await expect(page.getByTestId('topup-waiver-box')).not.toBeChecked();
	await expect(page.getByTestId('topup-pay')).toBeDisabled();

	// Back to the package: unticked again, and it is the package that goes out with the declaration.
	await page.getByTestId('plan-paperless-30').click();
	await expect(page.getByTestId('topup-step')).toHaveCount(0);
	await expect(page.getByTestId('plan-waiver-box')).not.toBeChecked();
	await page.getByTestId('plan-waiver-box').check();
	await page.getByTestId('plan-pay').click();
	await expect.poll(async () => (await received('/v1/subscribe')).map((r) => [r.body.package, r.body.waiver])).toEqual([['paperless-30', '1']]);
	expect(await received('/v1/checkout')).toEqual([]);
	// The embedded Checkout (mocked) opens; close it, nothing is paid. The step is done.
	await page.getByRole('dialog').getByRole('button', { name: 'Schließen' }).click();
	await expect(page.getByTestId('plan-step')).toHaveCount(0);

	// The amount, the same way: the declaration goes with the top-up, not with a package.
	await page.getByTestId('topup-topup-20').click();
	await expect(declarations).toHaveCount(1);
	await page.getByTestId('topup-waiver-box').check();
	await page.getByTestId('topup-pay').click();
	await expect.poll(async () => (await received('/v1/checkout')).map((r) => [r.body.package, r.body.waiver])).toEqual([['topup-20', '1']]);
	expect((await received('/v1/subscribe')).length).toBe(1);
});

test('“Verträge hier kündigen” cancels in the app and keeps a confirmation', async ({ page }) => {
	test.setTimeout(90_000);
	await openApp(page, { plan: true });
	await page.getByTestId('plan-cancel').click();
	const view = page.getByTestId('cancel-view');
	await expect(page.getByTestId('cancel-contract')).toHaveText('Paperless anywhere, Paket 30 Stunden, Monatsabo');
	await expect(page.getByTestId('cancel-kind')).toHaveText('Ordentliche Kündigung zum Ende des bezahlten Monats, also zum 01.12.2026');
	await expect(page.getByTestId('cancel-provider')).toContainText('Le Space UG (haftungsbeschränkt), info@le-space.de');
	await expect(view).toContainText('Fristlos aus wichtigem Grund: per E-Mail an info@le-space.de');
	await expect(page.getByTestId('cancel-portal')).toHaveText('Zahlungsdaten und Rechnungen');
	await shot(page, 'cancel-before', view);

	await page.getByRole('button', { name: 'Jetzt kündigen' }).click();
	await expect(page.getByTestId('cancel-done')).toHaveText(/^Kündigung eingegangen am 11\.11\.2026, 11:15 MEZ, wirksam zum 01\.12\.2026\.$/);
	expect(await received('/v1/subscription/cancel')).toHaveLength(1);
	// The balance is read again: the plan now says it ends.
	await expect(page.getByTestId('plan-current')).toContainText('Gekündigt, endet am 01.12.');
	await shot(page, 'cancel-after', view);

	const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId('cancel-save').click()]);
	expect(download.suggestedFilename()).toBe('kuendigung-paperless-anywhere-2026-11-11.txt');
	const text = await readFile(/** @type {string} */ (await download.path()), 'utf8');
	expect(text).toContain('Vertrag: Paperless anywhere, Paket 30 Stunden, Monatsabo');
	expect(text).toContain('Art: Ordentliche Kündigung zum Ende des bezahlten Monats');
	expect(text).toContain('Kündigung eingegangen am: 11.11.2026, 11:15 MEZ (2026-11-11T10:15:00.000Z)');
	expect(text).toContain('Wirksam zum: 01.12.2026 (2026-12-01T00:00:00.000Z)');
	expect(text).toMatch(/Konto \(Adresse\): 0x[0-9a-fA-F]{40}/);
	expect(text).toContain('Anbieter: Le Space UG (haftungsbeschränkt), info@le-space.de');
	expect(text).toContain('Impressum: https://le-space.de/#impressum');
});
