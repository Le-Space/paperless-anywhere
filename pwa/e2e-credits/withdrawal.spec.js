// The withdrawal function (§ 356a BGB) against the local mock of
// le-space-credits: the button shows only while something can be withdrawn,
// a second button withdraws, and the receipt can be kept as a file.
// Set SHOTS=<dir> to keep screenshots of the view before and after.
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { alephMock } from '../e2e/aleph-mock.js';
import { newMasterSecret } from '../src/lib/keys/derive.js';
import { newSeedPhrase, seal, sealingKeyFromSeedPhrase } from '../src/lib/keys/seal.js';
import { seedIndexAccount, VAULT_KEY } from '../src/lib/keys/index-keys.js';

const MOCK = 'http://127.0.0.1:4422';
const shot = (page, name, locator) => (process.env.SHOTS ? (locator ?? page).screenshot({ path: join(process.env.SHOTS, `${name}.png`) }) : null);

async function openApp(page, state) {
	const aggregates = await alephMock()(page.context());
	const master = newMasterSecret();
	const phrase = newSeedPhrase();
	aggregates.set(seedIndexAccount(phrase).address, { [VAULT_KEY]: { v: 1, box: await seal(master, sealingKeyFromSeedPhrase(phrase), 'master/seed') } });
	await page.context().route(/^https?:\/\/(?!localhost|127\.0\.0\.1|api2\.aleph\.im)/, (route) => route.abort());
	await fetch(`${MOCK}/__state`, { method: 'POST', body: JSON.stringify(state) });
	await page.goto('/app/');
	await page.getByText('Auf diesem Gerät mit Wiederherstellungsphrase öffnen').click();
	await page.locator('textarea').first().fill(phrase);
	await page.getByRole('button', { name: 'Öffnen', exact: true }).click();
	await expect(page.getByTestId('package')).toBeVisible();
}
const received = async (path) => (await (await fetch(`${MOCK}/__requests`)).json()).filter((r) => r.path === path);

test.use({ locale: 'de-DE', timezoneId: 'Europe/Berlin' });

test('nothing to withdraw: no button', async ({ page }) => {
	await openApp(page, { plan: true, withdrawable: false });
	await expect(page.getByTestId('plan-cancel')).toBeVisible();
	// The app asked, and only asked.
	await expect.poll(async () => (await received('/v1/withdrawal')).map((r) => r.body.quote)).toEqual([true]);
	await expect(page.getByTestId('withdraw-open')).toHaveCount(0);
});

test('a contract within its 14 days is withdrawn in two steps, with a receipt to keep', async ({ page }) => {
	test.setTimeout(90_000);
	await openApp(page, { plan: true, withdrawable: true });
	const open = page.getByTestId('withdraw-open');
	await expect(open).toHaveText('Vertrag widerrufen');
	await open.click();
	const view = page.getByTestId('withdraw-view');
	await expect(page.getByTestId('withdraw-list')).toHaveText('Paket 30 Stunden, Monatsabo, geschlossen am 05.11.2026, Widerruf möglich bis 19.11.2026, 10:00 MEZ');
	await expect(page.getByTestId('withdraw-what')).toContainText('innerhalb von 14 Tagen');
	await expect(view).toContainText('Le Space UG (haftungsbeschränkt), info@le-space.de');
	await shot(page, 'withdraw-before', view);
	// Opening the view withdrew nothing.
	expect((await received('/v1/withdrawal')).every((r) => r.body.quote === true)).toBe(true);

	await page.getByTestId('withdraw-now').click();
	await expect(page.getByTestId('withdraw-done')).toHaveText('Widerruf eingegangen am 11.11.2026, 11:15 MEZ.');
	await expect(page.getByTestId('withdraw-next')).toContainText('refund_mock_1');
	const sent = (await received('/v1/withdrawal')).filter((r) => r.body.quote !== true);
	expect(sent).toHaveLength(1);
	expect(sent[0].body.product).toBe('paperless-anywhere');
	await shot(page, 'withdraw-after', view);
	// The plan is gone behind the open receipt.
	await expect(page.getByTestId('plan-none')).toBeVisible();

	const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId('withdraw-save').click()]);
	expect(download.suggestedFilename()).toBe('widerruf-paperless-anywhere-2026-11-11.txt');
	const text = await readFile(/** @type {string} */ (await download.path()), 'utf8');
	expect(text).toContain('Bestätigung des Widerrufs');
	expect(text).toContain('Widerrufen: Paket 30 Stunden, Monatsabo, geschlossen am 05.11.2026');
	expect(text).toContain('Widerruf eingegangen am: 11.11.2026, 11:15 MEZ (2026-11-11T10:15:00.000Z)');
	expect(text).toContain('Erstattung: refund_mock_1');
	expect(text).toContain('Anbieter: Le Space UG (haftungsbeschränkt), info@le-space.de');

	// Closed, nothing is left to withdraw, and the button is gone.
	await view.getByRole('button', { name: 'Schließen' }).click();
	await expect(page.getByTestId('withdraw-view')).toHaveCount(0);
	await expect(page.getByTestId('withdraw-open')).toHaveCount(0);
});

test('cancelling is reachable without opening the vault', async ({ page }) => {
	await page.context().route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/, (route) => route.abort());
	await page.goto('/app/');
	await expect(page.getByTestId('state')).toHaveText('new');
	const link = page.getByTestId('cancel-by-mail');
	await expect(link).toHaveText('Verträge hier kündigen');
	const href = await link.getAttribute('href');
	expect(href).toMatch(/^mailto:info@le-space\.de\?subject=K%C3%BCndigung%20Paperless%20anywhere&body=/);
	expect(decodeURIComponent(/** @type {string} */ (href))).toContain('Rechnungsnummer');
});
