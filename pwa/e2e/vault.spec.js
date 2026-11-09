import { expect, test } from '@playwright/test';
import { alephMock } from './aleph-mock.js';

/** Opens a folded part of "Technisch" (#105), whether or not it is open already. */
const open = (page, id) => page.getByTestId(id).evaluate((d) => { d.open = true; });

/** A virtual authenticator that can evaluate PRF stands for the YubiKey. */
async function authenticator(page) {
	const cdp = await page.context().newCDPSession(page);
	await cdp.send('WebAuthn.enable');
	const { authenticatorId } = await cdp.send('WebAuthn.addVirtualAuthenticator', {
		options: { protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, hasPrf: true }
	});
	return { cdp, authenticatorId };
}

test('a passkey and a seed phrase open the same vault, also on another device; nothing open is stored', async ({ page, browser }) => {
	const install = alephMock();
	const aggregates = await install(page.context());
	await authenticator(page);

	await page.goto('/app/');
	await expect(page.getByTestId('state')).toHaveText('new');
	// Which build: the version ("dev" outside a release) and the commit.
	await expect(page.getByTestId('build-version')).toHaveText(process.env.PAPERLESS_VERSION || 'dev');
	await expect(page.getByTestId('build-info')).toContainText(/· [0-9a-f]{7}/);
	// The key-loss notice comes first: no vault without ticking it.
	await expect(page.getByTestId('key-loss')).toContainText('Le Space kann deinen Tresor weder öffnen noch wiederherstellen');
	await expect(page.getByRole('button', { name: 'Passkey anlegen' })).toBeDisabled();
	await page.getByTestId('key-loss-ok').check();
	await page.getByRole('button', { name: 'Passkey anlegen' }).click();
	await expect(page.getByTestId('state')).toHaveText('unlocked');
	const words = await page.getByTestId('phrase').locator('li').allTextContents();
	expect(words).toHaveLength(24);
	const address = await page.getByTestId('address').textContent();
	expect(address).toMatch(/^0x[0-9a-fA-F]{40}$/);
	await page.getByRole('button', { name: 'Aufgeschrieben' }).click();
	// Three words are asked back; a wrong one keeps the button off.
	const asked = page.locator('[data-testid^="confirm-"]');
	await expect(asked).toHaveCount(3);
	const positions = await asked.evaluateAll((inputs) => inputs.map((i) => Number(i.dataset.testid.split('-')[1])));
	await asked.nth(0).fill('falsch');
	await expect(page.getByRole('button', { name: 'Stimmt' })).toBeDisabled();
	for (const [i, position] of positions.entries()) await asked.nth(i).fill(words[position - 1]);
	await page.getByRole('button', { name: 'Stimmt' }).click();

	// In Aleph: two vault entries (passkey, phrase), each only a sealed box.
	expect(aggregates.size).toBe(2);
	for (const data of aggregates.values()) {
		const entry = data['paperless-anywhere-vault'];
		expect(Object.keys(entry.box).sort()).toEqual(['ct', 'iv', 'purpose', 'v']);
		expect(JSON.stringify(entry)).not.toContain(words.join(' '));
	}

	// In this browser: the passkey id and the sealed boxes, nothing else.
	const stored = await page.evaluate(() => ({ ...localStorage }));
	expect(Object.keys(stored)).toEqual(['paperless-anywhere.vault']);
	expect(await page.evaluate(async () => (await indexedDB.databases()).length)).toBe(0);

	await page.getByRole('button', { name: 'Sperren' }).click();
	await page.reload();
	await expect(page.getByTestId('state')).toHaveText('locked');
	await page.getByRole('button', { name: 'Mit Passkey entsperren' }).click();
	await expect(page.getByTestId('address')).toHaveText(address);

	// The same browser without its local vault: the passkey finds the vault in Aleph.
	await page.evaluate(() => localStorage.clear());
	await page.reload();
	await expect(page.getByTestId('state')).toHaveText('new');
	await page.getByRole('button', { name: 'Auf diesem Gerät mit Passkey öffnen' }).click();
	await expect(page.getByTestId('address')).toHaveText(address);

	// Another device, with the phrase only.
	const other = await browser.newContext();
	await install(other);
	const phone = await other.newPage();
	await phone.goto('/app/');
	await phone.getByText('Auf diesem Gerät mit Wiederherstellungsphrase öffnen').click();
	await phone.locator('textarea').fill(words.join(' '));
	await phone.getByRole('button', { name: 'Öffnen', exact: true }).click();
	await expect(phone.getByTestId('address')).toHaveText(address);

	// There, a passkey of its own: a third box in Aleph, and the vault opens with it.
	await authenticator(phone);
	await phone.getByTestId('tab-advanced').click();
	await open(phone, 'tech-keys');
	await phone.getByText('Weiteren Passkey hinzufügen').click();
	await phone.getByRole('button', { name: /^Passkey für / }).click();
	await expect(phone.getByTestId('passkey-added')).toBeVisible();
	expect(aggregates.size).toBe(3);
	await phone.getByRole('button', { name: 'Sperren' }).click();
	await phone.reload();
	await phone.getByRole('button', { name: 'Mit Passkey entsperren' }).click();
	await expect(phone.getByTestId('address')).toHaveText(address);

	// A wrong phrase finds nothing.
	await phone.getByRole('button', { name: 'Sperren' }).click();
	await phone.evaluate(() => localStorage.clear());
	await phone.reload();
	await phone.getByText('Auf diesem Gerät mit Wiederherstellungsphrase öffnen').click();
	await phone.locator('textarea').fill(words.slice().reverse().join(' '));
	await phone.getByRole('button', { name: 'Öffnen', exact: true }).click();
	await expect(phone.getByRole('alert')).toBeVisible();
	await other.close();
});
