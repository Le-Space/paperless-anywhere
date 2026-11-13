import { expect, test } from '@playwright/test';
import { alephMock } from './aleph-mock.js';

/** Only localhost and the Aleph mock: nothing else leaves the test. */
async function offline(context) {
	await context.route(/^https?:\/\/(?!localhost|api2\.aleph\.im)/, (route) => route.abort());
}

async function authenticator(page) {
	const cdp = await page.context().newCDPSession(page);
	await cdp.send('WebAuthn.enable');
	await cdp.send('WebAuthn.addVirtualAuthenticator', {
		options: { protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, hasPrf: true }
	});
}

test('the logo and the name in the app lead back to the landing page', async ({ page }) => {
	test.setTimeout(90_000);
	await alephMock()(page.context());
	await offline(page.context());
	await authenticator(page);

	await page.goto('/app/');
	const home = page.getByTestId('logo-home');
	await expect(home).toHaveAttribute('href', '/');
	await expect(home).toContainText('Paperless anywhere');
	await expect(home).toHaveAccessibleName('Zur Startseite');
	// The line below keeps its own link, outside the way home.
	const ngx = page.locator('header').getByRole('link', { name: 'Paperless-ngx' });
	await expect(ngx).toHaveAttribute('href', 'https://github.com/paperless-ngx/paperless-ngx');
	expect(await home.locator('a').count()).toBe(0);
	expect(await ngx.evaluate((a) => Boolean(a.closest('[data-testid="logo-home"]')))).toBe(false);

	// With an open vault the link says what leaving does.
	await page.getByTestId('key-loss-ok').check();
	await page.getByRole('button', { name: 'Passkey anlegen' }).click();
	await expect(page.getByTestId('phrase').locator('li')).toHaveCount(24);
	await expect(page.getByTestId('state')).toHaveText('unlocked');
	await expect(home).toHaveAccessibleName('Zur Startseite (die App wird dabei gesperrt)');
	await expect(home).toHaveAttribute('title', 'Zur Startseite (die App wird dabei gesperrt)');

	// Nothing is under way, so it leaves without a question, to the landing
	// page in the language chosen there.
	await page.evaluate(() => localStorage.setItem('paperless-lang', 'en'));
	let asked = false;
	page.on('dialog', (d) => { asked = true; d.dismiss(); });
	await home.click();
	await expect(page).toHaveURL(/\/en\/$/);
	await expect(page.getByRole('heading', { level: 1 })).toHaveAccessibleName('Paperless anywhere runs resilient, confidential and on your schedule.');
	expect(asked).toBe(false);

	// Back in the app the vault is still there, and locked.
	await page.goto('/app/');
	await expect(page.getByTestId('state')).toHaveText('locked');
});
