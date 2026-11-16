import { expect, test } from '@playwright/test';
import { alephMock } from './aleph-mock.js';

async function authenticator(page) {
	const cdp = await page.context().newCDPSession(page);
	await cdp.send('WebAuthn.enable');
	await cdp.send('WebAuthn.addVirtualAuthenticator', {
		options: { protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, hasPrf: true }
	});
}

test('the two backup lights stand at the top, also locked, and are green only for what the app checked', async ({ page }) => {
	test.setTimeout(90_000);
	await alephMock()(page.context());
	// Nothing leaves the test: the registry cannot be read, no provider answers.
	await page.context().route(/^https?:\/\/(?!localhost|api2\.aleph\.im)/, (route) => route.abort());
	await authenticator(page);

	await page.goto('/app/');
	// No vault: nothing to show.
	await expect(page.getByTestId('backup-leds')).toHaveCount(0);
	await page.getByTestId('key-loss-ok').check();
	await page.getByRole('button', { name: 'Passkey anlegen' }).click();
	await expect(page.getByTestId('state')).toHaveText('unlocked');
	await expect(page.getByTestId('led-reach')).toHaveAttribute('data-level', 'unknown');
	await expect(page.getByTestId('led-independent')).toHaveAttribute('data-level', 'unknown');
	await page.getByTestId('led-reach').click();
	await expect(page.getByTestId('led-details')).toContainText('Noch keine Sicherung bekannt');

	// Locked, with the providers kept from the last list: still at the top,
	// still grey, as the registry did not answer.
	await page.evaluate(() => localStorage.setItem('paperless-anywhere.backup-copies', JSON.stringify({ network: 'mainnet', providerIds: [36, 37], at: '2026-11-16T09:00:00Z' })));
	await page.reload();
	await expect(page.getByTestId('state')).toHaveText('locked');
	await page.getByTestId('led-independent').click();
	await expect(page.getByTestId('led-details')).toContainText('Die Anbieterliste ließ sich gerade nicht lesen. Nichts geprüft.');
	await expect(page.getByTestId('led-details')).toContainText('Anbieter aus der zuletzt gelesenen Liste');
	await expect(page.getByTestId('led-reach')).toHaveAttribute('data-level', 'unknown');
	await expect(page.getByTestId('led-independent')).toHaveAttribute('data-level', 'unknown');

	// In English too.
	await page.getByTestId('app-lang-en').click();
	await expect(page.getByTestId('led-reach')).toContainText('Backups reachable');
	await expect(page.getByTestId('led-independent')).toContainText('Copies independent');
});
