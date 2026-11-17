import { expect, test } from '@playwright/test';
import { alephMock } from './aleph-mock.js';

// The v0.2 interface at /v0.2/: the way into the vault in plain words, the
// switch between "Standard" and "Technisch", and the areas. It shares the
// origin, the vault record and the sealed profile with the app at /app/.

/** A virtual authenticator that can evaluate PRF stands for the device's passkey. */
async function authenticator(page) {
	const cdp = await page.context().newCDPSession(page);
	await cdp.send('WebAuthn.enable');
	await cdp.send('WebAuthn.addVirtualAuthenticator', {
		options: { protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, hasPrf: true }
	});
}

/** Creates a vault in v0.2 and returns its 24 words. */
async function createVault(page) {
	await page.goto('/v0.2/');
	await expect(page.getByTestId('v2-state')).toHaveText('new');
	await expect(page.getByTestId('v2-create')).toBeDisabled();
	await page.getByTestId('v2-key-loss-ok').check();
	await page.getByTestId('v2-create').click();
	await expect(page.getByTestId('v2-state')).toHaveText('phrase');
	const words = await page.getByTestId('v2-phrase').locator('li').allTextContents();
	expect(words).toHaveLength(24);
	return words;
}

/** Answers the three words asked back. */
async function confirmWords(page, words) {
	await page.getByTestId('v2-written').click();
	const asked = page.locator('input[data-testid^="v2-confirm-"]');
	await expect(asked).toHaveCount(3);
	const positions = await asked.evaluateAll((inputs) => inputs.map((i) => Number(i.dataset.testid.split('-')[2])));
	// A wrong word is said to be wrong, next to its field.
	// (judged once the field is left, not while typing)
	await asked.nth(0).fill('falsch');
	await expect(page.getByTestId(`v2-wrong-${positions[0]}`)).toHaveCount(0);
	await asked.nth(0).blur();
	await expect(page.getByTestId(`v2-wrong-${positions[0]}`)).toBeVisible();
	await expect(page.getByTestId('v2-confirmed')).toBeDisabled();
	for (const [i, position] of positions.entries()) await asked.nth(i).fill(words[position - 1]);
	await expect(page.getByTestId(`v2-wrong-${positions[0]}`)).toHaveCount(0);
	await page.getByTestId('v2-confirmed').click();
	await expect(page.getByTestId('v2-state')).toHaveText('unlocked');
}

test('v0.2: a vault is made in three steps; the 24 words cannot be lost by locking, and a wrong word is named', async ({ page }) => {
	await alephMock()(page.context());
	await authenticator(page);
	const words = await createVault(page);
	// While the words show there is no lock button, and the page says so.
	await expect(page.getByTestId('v2-lock')).toHaveCount(0);
	await expect(page.getByTestId('v2-phrase-guard')).toBeVisible();
	await confirmWords(page, words);
	// Standard: four areas; no "System".
	await expect(page.getByRole('banner').getByTestId('view-standard')).toHaveAttribute('aria-pressed', 'true');
	await expect(page.getByRole('navigation', { name: 'Bereiche' }).getByRole('button')).toHaveText(['Start', 'Sicherung', 'Paket', 'Mehr']);
	await expect(page.getByTestId('v2-status')).toBeVisible();
});

test('v0.2: the switch adds "System" and technical detail, hides nothing, and is remembered on this device', async ({ page }) => {
	await alephMock()(page.context());
	await authenticator(page);
	// Before the vault exists, the switch already works: the technical view adds the facts.
	await page.goto('/v0.2/');
	await expect(page.getByTestId('v2-tech')).toHaveCount(0);
	await page.getByRole('banner').getByTestId('view-technical').click();
	await expect(page.getByTestId('v2-tech')).toContainText('WebAuthn');
	await expect(page.getByTestId('v2-key-loss')).toBeVisible();
	await page.getByRole('banner').getByTestId('view-standard').click();

	const words = await createVault(page);
	await confirmWords(page, words);
	await page.getByRole('banner').getByTestId('view-technical').click();
	await expect(page.getByRole('navigation', { name: 'Bereiche' }).getByRole('button')).toHaveText(['Start', 'Sicherung', 'Paket', 'System', 'Mehr']);
	await page.getByTestId('v2-area-system').click();
	await expect(page.getByRole('heading', { level: 1, name: 'System' })).toBeFocused();
	await expect(page.getByTestId('v2-setup')).toBeVisible();
	// Remembered in this browser under its own key; v0.1's tab is not written.
	expect(await page.evaluate(() => ({ view: localStorage.getItem('paperless-anywhere.view'), tab: localStorage.getItem('paperless-anywhere.tab') }))).toEqual({ view: 'technical', tab: null });
	// Back to Standard while "System" shows: the person lands on Start, nothing is lost.
	await page.getByRole('banner').getByTestId('view-standard').click();
	await expect(page.getByTestId('v2-area-system')).toHaveCount(0);
	await expect(page.getByTestId('v2-status')).toBeVisible();
	await page.reload();
	await expect(page.getByRole('banner').getByTestId('view-standard')).toHaveAttribute('aria-pressed', 'true');
});

test('v0.2 and v0.1 open the same vault with the same passkey; forgetting the browser asks first', async ({ page }) => {
	await alephMock()(page.context());
	await authenticator(page);
	const words = await createVault(page);
	await confirmWords(page, words);
	await page.getByTestId('v2-area-more').click();
	await page.getByRole('banner').getByTestId('view-technical').click();
	const address = await page.getByTestId('v2-address').textContent();
	expect(address).toMatch(/^0x[0-9a-fA-F]{40}$/);
	// Only the vault record and the view are in this browser.
	expect(Object.keys(await page.evaluate(() => ({ ...localStorage }))).sort()).toEqual(['paperless-anywhere.vault', 'paperless-anywhere.view']);

	// The app at /app/ finds the vault this interface made, and opens it with the same passkey.
	await page.goto('/app/');
	await expect(page.getByTestId('state')).toHaveText('locked');
	await page.getByRole('button', { name: 'Mit Passkey entsperren' }).click();
	await expect(page.getByTestId('state')).toHaveText('unlocked');
	await page.getByTestId('tab-advanced').click();
	await page.getByTestId('tech-keys').evaluate((d) => { d.open = true; });
	await expect(page.getByTestId('address')).toHaveText(address);

	// And back: locked, opened with the passkey, then with the 24 words.
	await page.goto('/v0.2/');
	await expect(page.getByTestId('v2-state')).toHaveText('locked');
	await page.getByTestId('v2-unlock').click();
	await expect(page.getByTestId('v2-state')).toHaveText('unlocked');
	await page.getByTestId('v2-lock').click();
	await page.getByTestId('v2-with-words').click();
	await page.getByTestId('v2-words').fill(words.join(' '));
	await page.getByTestId('v2-unlock-words').click();
	await expect(page.getByTestId('v2-state')).toHaveText('unlocked');
	await page.getByTestId('v2-lock').click();

	// "Diesen Browser vergessen" sits behind "Probleme beim Entsperren?" and asks in a dialog.
	await expect(page.getByTestId('v2-forget')).toHaveCount(0);
	await page.getByTestId('v2-trouble').click();
	await page.getByTestId('v2-forget').click();
	await expect(page.getByTestId('v2-confirm')).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(page.getByTestId('v2-state')).toHaveText('locked');
	await page.getByTestId('v2-forget').click();
	await page.getByTestId('v2-confirm-yes').click();
	await expect(page.getByTestId('v2-state')).toHaveText('new');
	// A device without the record: the 24 words open the vault.
	await page.getByTestId('v2-have-vault').click();
	await page.getByTestId('v2-words').fill(words.join(' '));
	await page.getByTestId('v2-open-words').click();
	await expect(page.getByTestId('v2-state')).toHaveText('unlocked');
});

test('v0.2 speaks English when asked, and is usable by keyboard on the first screen', async ({ page }) => {
	await page.goto('/v0.2/');
	await page.getByTestId('v2-lang-en').click();
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Your documents in a vault of your own');
	await expect(page.getByRole('banner').getByTestId('view-technical')).toHaveText('Technical');
	// Every control on the first screen is reached by Tab, in order, with a name.
	await page.reload();
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Your documents in a vault of your own');
	const names = [];
	for (let i = 0; i < 14; i++) {
		await page.keyboard.press('Tab');
		names.push(await page.evaluate(() => (document.activeElement?.getAttribute('aria-label') || document.activeElement?.textContent || '').trim().slice(0, 40)));
	}
	expect(names).toEqual(expect.arrayContaining(['Standard', 'Technical', 'DE', 'EN', 'I already have a vault']));
	// Targets a finger can hit: at least 44 px high.
	for (const id of ['v2-create', 'v2-have-vault', 'view-standard', 'v2-lang-de']) {
		const box = await page.getByTestId(id).boundingBox();
		expect(box?.height, id).toBeGreaterThanOrEqual(44);
	}
});
