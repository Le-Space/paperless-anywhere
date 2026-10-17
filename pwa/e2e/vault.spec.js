import { expect, test } from '@playwright/test';

// A virtual authenticator that can evaluate PRF stands for the YubiKey.
test.beforeEach(async ({ page }) => {
	const cdp = await page.context().newCDPSession(page);
	await cdp.send('WebAuthn.enable');
	await cdp.send('WebAuthn.addVirtualAuthenticator', {
		options: { protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, hasPrf: true }
	});
});

test('a passkey and a seed phrase open the same vault; nothing open is stored', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByTestId('state')).toHaveText('new');
	await page.getByRole('button', { name: 'Passkey anlegen' }).click();
	await expect(page.getByTestId('state')).toHaveText('unlocked');
	const words = await page.getByTestId('phrase').locator('li').allTextContents();
	expect(words).toHaveLength(24);
	const address = await page.getByTestId('address').textContent();
	expect(address).toMatch(/^0x[0-9a-fA-F]{40}$/);
	await page.getByRole('button', { name: 'Aufgeschrieben' }).click();

	// What the browser keeps: the passkey id and two sealed boxes, nothing else.
	const stored = await page.evaluate(() => ({ ...localStorage }));
	expect(Object.keys(stored)).toEqual(['paperless-anywhere.vault']);
	const vault = JSON.parse(stored['paperless-anywhere.vault']);
	expect(Object.keys(vault).sort()).toEqual(['byPasskey', 'bySeed', 'createdAt', 'credentialId', 'v']);
	expect(JSON.stringify(vault)).not.toContain(words.join(' '));
	const idb = await page.evaluate(async () => (await indexedDB.databases()).length);
	expect(idb).toBe(0);

	await page.getByRole('button', { name: 'Sperren' }).click();
	await page.reload();
	await expect(page.getByTestId('state')).toHaveText('locked');
	await page.getByRole('button', { name: 'Mit Passkey entsperren' }).click();
	await expect(page.getByTestId('address')).toHaveText(address);

	await page.getByRole('button', { name: 'Sperren' }).click();
	await page.getByText('Mit Wiederherstellungsphrase entsperren').click();
	await page.locator('textarea').fill(words.join(' '));
	await page.getByRole('button', { name: 'Entsperren', exact: true }).click();
	await expect(page.getByTestId('address')).toHaveText(address);

	await page.getByRole('button', { name: 'Sperren' }).click();
	await page.getByText('Mit Wiederherstellungsphrase entsperren').click();
	await page.locator('textarea').fill(words.slice().reverse().join(' '));
	await page.getByRole('button', { name: 'Entsperren', exact: true }).click();
	await expect(page.getByRole('alert')).toBeVisible();
	await expect(page.getByTestId('state')).toHaveText('locked');
});
