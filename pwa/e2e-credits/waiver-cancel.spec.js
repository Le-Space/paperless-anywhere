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
	await page.getByText('Auf diesem Gerät mit Wiederherstellungsphrase öffnen').click();
	await page.locator('textarea').first().fill(phrase);
	await page.getByRole('button', { name: 'Öffnen', exact: true }).click();
	await expect(page.getByTestId('package')).toBeVisible();
}
const received = async (path) => (await (await fetch(`${MOCK}/__requests`)).json()).filter((r) => r.path === path);

test.use({ locale: 'de-DE', timezoneId: 'Europe/Berlin' });

test('subscribing and topping up wait for the declaration on withdrawal, and then send it', async ({ page }) => {
	test.setTimeout(90_000);
	await openApp(page, { plan: false });
	const box = page.getByTestId('plan-waiver');
	await expect(box).toContainText('Beispieltext zum Widerruf');
	await expect(page.getByTestId('plan-waiver-box')).not.toBeChecked();
	await expect(page.getByTestId('plan-paperless-30')).toBeDisabled();
	await shot(page, 'waiver-unticked', page.getByTestId('package'));
	await page.getByTestId('plan-waiver-box').check();
	await expect(page.getByTestId('plan-paperless-30')).toBeEnabled();
	await shot(page, 'waiver-ticked', page.getByTestId('package'));
	await page.getByTestId('plan-paperless-30').click();
	await expect.poll(async () => (await received('/v1/subscribe')).map((r) => r.body.waiver)).toEqual(['1']);
	// The embedded Checkout (mocked) opens; close it, nothing is paid.
	await page.getByRole('dialog').getByRole('button', { name: 'Schließen' }).click();
	// Unticked again for the next payment.
	await expect(page.getByTestId('plan-waiver-box')).not.toBeChecked();

	await page.getByText('Aufladen, Stunden dazukaufen, Paket ändern').click();
	await expect(page.getByTestId('topup-waiver')).toContainText('Beispieltext zum Widerruf');
	await expect(page.getByTestId('topup-topup-20')).toBeDisabled();
	await page.getByTestId('topup-waiver-box').check();
	await expect(page.getByTestId('topup-topup-20')).toBeEnabled();
	await page.getByTestId('topup-topup-20').click();
	await expect.poll(async () => (await received('/v1/checkout')).map((r) => r.body.waiver)).toEqual(['1']);
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
