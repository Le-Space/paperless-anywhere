import { expect, test } from '@playwright/test';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import { alephMock } from './aleph-mock.js';
import { ageRecipient, newAgeIdentity } from '../src/lib/keys/age.js';

const payer = privateKeyToAccount(generatePrivateKey());
const OTHER = { address: '0x00000000000000000000000000000000000000aa', types: ['POST'] };
// Shaped like an age identity; never used to decrypt anything here.
// A real-format identity: the backup toggle derives its recipient.
const AGE = newAgeIdentity();

/** Only localhost and the Aleph mock: nothing else leaves the test. */
async function offline(context) {
	await context.route(/^https?:\/\/(?!localhost|api2\.aleph\.im)/, (route) => route.abort());
}

/** MetaMask, as far as this app uses it: accounts and personal_sign, by a test key. */
async function wallet(context) {
	await context.exposeBinding('__wallet', async (_source, { method, params }) => {
		// MetaMask answers in lowercase; Aleph knows the account only by its checksum spelling.
		if (method === 'eth_requestAccounts' || method === 'eth_accounts') return [payer.address.toLowerCase()];
		if (method === 'personal_sign') return payer.signMessage({ message: { raw: params[0] } });
		throw new Error(`unsupported ${method}`);
	});
	await context.addInitScript(() => {
		window.ethereum = { request: (r) => window.__wallet(r), on() {}, removeListener() {} };
	});
}

async function authenticator(page) {
	const cdp = await page.context().newCDPSession(page);
	await cdp.send('WebAuthn.enable');
	await cdp.send('WebAuthn.addVirtualAuthenticator', {
		options: { protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, hasPrf: true }
	});
}

test('the paying account authorizes this app on Aleph; the sealed profile follows to another device', async ({ page, browser }) => {
	test.setTimeout(120_000);
	const install = alephMock();
	const aggregates = await install(page.context());
	aggregates.set(payer.address, { security: { authorizations: [OTHER] } });
	await offline(page.context());
	await wallet(page.context());
	await authenticator(page);

	await page.goto('/');
	await page.getByRole('button', { name: 'Passkey anlegen' }).click();
	await expect(page.getByTestId('phrase').locator('li')).toHaveCount(24);
	const words = await page.getByTestId('phrase').locator('li').allTextContents();
	const appAddress = await page.getByTestId('address').textContent();
	await page.getByRole('button', { name: 'Aufgeschrieben' }).click();
	const asked = page.locator('[data-testid^="confirm-"]');
	await expect(asked).toHaveCount(3);
	for (const [i, position] of (await asked.evaluateAll((inputs) => inputs.map((x) => Number(x.dataset.testid.split('-')[1])))).entries()) {
		await asked.nth(i).fill(words[position - 1]);
	}
	await page.getByRole('button', { name: 'Stimmt' }).click();

	await page.getByRole('button', { name: 'Wallet verbinden' }).click();
	await expect(page.getByTestId('payer')).toHaveText(payer.address);
	await expect(page.getByTestId('aleph-status')).toHaveText('nicht freigegeben');

	await page.getByRole('button', { name: 'Im Wallet freigeben' }).click();
	await expect(page.getByTestId('aleph-status')).toHaveText('freigegeben (INSTANCE, FORGET, Port-Freigaben)');
	expect(aggregates.get(payer.address).security.authorizations).toEqual([OTHER, { address: appAddress, types: ['INSTANCE', 'FORGET', 'AGGREGATE'], aggregate_keys: ['port-forwarding'] }]);

	await page.getByTestId('relays').fill('wss://relay.example.com/attest');
	await page.getByRole('button', { name: 'Relays speichern' }).click();
	await page.getByText('Einen vorhandenen Schlüssel einfügen').click();
	await page.getByPlaceholder('AGE-SECRET-KEY-1…').fill(AGE);
	await page.getByRole('button', { name: 'Versiegelt hinterlegen' }).click();
	await expect(page.getByTestId('age-status')).toHaveText('eingefügt (nicht aus dem Tresor: getrennt aufbewahren!)');
	// Only the recipient is shown; backups on Calibration can be switched on.
	await expect(page.getByTestId('age-recipient')).toHaveText(ageRecipient(AGE));
	await page.getByTestId('backups-on').check();
	await expect(page.getByTestId('backups-on')).toBeChecked();
	// The vault's own key replaces the pasted one: then the 24 words suffice.
	page.once('dialog', (d) => d.accept());
	await page.getByRole('button', { name: 'Schlüssel des Tresors verwenden (empfohlen)' }).click();
	await expect(page.getByTestId('age-status')).toHaveText('der Schlüssel des Tresors (die 24 Wörter genügen zur Wiederherstellung)');
	await expect(page.getByTestId('age-recipient')).not.toHaveText(ageRecipient(AGE));

	// With image, node and passphrase, the start button comes alive (it reads the saved profile).
	await expect(page.getByRole('button', { name: 'Paperless starten' })).toBeDisabled();
	await page.getByPlaceholder('Image (STORE-Hash)').fill('a'.repeat(64));
	await page.getByPlaceholder('SEV-SNP-Knoten (Hash)').fill('b'.repeat(64));
	await page.getByPlaceholder('Passphrase des Images').fill('made-up passphrase');
	await page.getByRole('button', { name: 'Image und Knoten speichern' }).click();
	await expect(page.getByRole('button', { name: 'Paperless starten' })).toBeEnabled();

	// Aleph holds the profile as a sealed box only.
	const profile = aggregates.get(appAddress)['paperless-anywhere-profile'];
	expect(Object.keys(profile.box).sort()).toEqual(['ct', 'iv', 'purpose', 'v']);
	expect(JSON.stringify(profile)).not.toContain(AGE);
	expect(JSON.stringify(profile)).not.toContain(payer.address);
	expect(JSON.stringify(profile)).not.toContain('made-up passphrase');

	// Another device: the phrase opens the vault, and the profile comes with it.
	const other = await browser.newContext();
	await install(other);
	await offline(other);
	await wallet(other);
	const phone = await other.newPage();
	await phone.goto('/');
	await expect(phone.getByTestId('state')).toHaveText('new');
	await phone.getByText('Auf diesem Gerät mit Wiederherstellungsphrase öffnen').click();
	await phone.locator('textarea').first().fill(words.join(' '));
	await phone.getByRole('button', { name: 'Öffnen', exact: true }).click();
	await expect(phone.getByTestId('payer')).toHaveText(payer.address);
	await expect(phone.getByTestId('aleph-status')).toHaveText('freigegeben (INSTANCE, FORGET, Port-Freigaben)');
	// The other device derives the same key from the same master: the vault's own key.
	await expect(phone.getByTestId('age-status')).toHaveText('der Schlüssel des Tresors (die 24 Wörter genügen zur Wiederherstellung)');
	await expect(phone.getByTestId('relays')).toHaveValue('wss://relay.example.com/attest');

	// Revoking removes this app's entry and keeps the others.
	await phone.getByRole('button', { name: 'Freigabe zurücknehmen' }).click();
	await expect(phone.getByTestId('aleph-status')).toHaveText('nicht freigegeben');
	expect(aggregates.get(payer.address).security.authorizations).toEqual([OTHER]);
	await other.close();
});

test('the app can pay its VMs itself: no wallet, no authorization, its own balance', async ({ page }) => {
	test.setTimeout(120_000);
	const install = alephMock();
	await install(page.context());
	await offline(page.context());
	await page.context().route(/https:\/\/api2\.aleph\.im\/api\/v0\/addresses\/0x[0-9a-fA-F]{40}\/balance/, (route) =>
		route.fulfill({ json: { balance: 0, credit_balance: 1_500_000 } })
	);
	await page.context().route(/https:\/\/api2\.aleph\.im\/api\/v0\/costs.*/, (route) => route.fulfill({ json: { summary: { total_cost_credit: '0' } } }));
	// Made-up market prices: ALEPH at 0.02 $, the dollar at 0.9 €.
	await page.context().route(/https:\/\/api\.coingecko\.com\/.*/, (route) =>
		route.fulfill({ json: { aleph: { usd: 0.02, eur: 0.018 }, 'usd-coin': { usd: 1, eur: 0.9 } }, headers: { 'access-control-allow-origin': '*' } })
	);
	await authenticator(page);

	await page.goto('/');
	await page.getByRole('button', { name: 'Passkey anlegen' }).click();
	await expect(page.getByTestId('phrase').locator('li')).toHaveCount(24);
	const words = await page.getByTestId('phrase').locator('li').allTextContents();
	const appAddress = await page.getByTestId('address').textContent();
	await page.getByRole('button', { name: 'Aufgeschrieben' }).click();
	const asked = page.locator('[data-testid^="confirm-"]');
	await expect(asked).toHaveCount(3);
	for (const [i, position] of (await asked.evaluateAll((inputs) => inputs.map((x) => Number(x.dataset.testid.split('-')[1])))).entries()) {
		await asked.nth(i).fill(words[position - 1]);
	}
	await page.getByRole('button', { name: 'Stimmt' }).click();

	// The role: test by default; production asks first and warns.
	await expect(page.getByTestId('role-test')).toBeChecked();
	await expect(page.getByTestId('role-line')).toContainText('als Test');
	page.once('dialog', (d) => d.dismiss());
	await page.getByTestId('role-primary').click();
	await expect(page.getByTestId('role-test')).toBeChecked();
	page.once('dialog', (d) => d.accept());
	await page.getByTestId('role-primary').check();
	await expect(page.getByTestId('role-warning')).toContainText('Nur eine Instanz darf produktiv sein');
	await expect(page.getByTestId('role-warning')).toContainText('Mainnet');
	await expect(page.getByTestId('role-line')).toContainText('produktiv');
	await expect(page.getByTestId('saved-role')).toBeVisible();
	await page.getByTestId('role-test').check();

	await page.getByTestId('pays-app').check();
	await expect(page.getByTestId('app-payer')).toHaveText(appAddress);
	await expect(page.getByTestId('aleph-status')).toHaveCount(0);
	await expect(page.getByRole('button', { name: 'Wallet für Sicherungen verbinden' })).toBeVisible();
	await expect(page.getByTestId('balances')).toContainText('Konto der App');
	await expect(page.getByTestId('balance-credits')).toContainText('1.500.000');
	await expect(page.getByTestId('balance-gas')).toHaveCount(0);
	// Credits also in money: euros by default, ALEPH on request.
	await expect(page.getByTestId('balance-money')).toHaveText('≈ 1,35 €');
	await page.getByTestId('credit-unit').selectOption('aleph');
	await expect(page.getByTestId('balance-money')).toHaveText('≈ 75 ALEPH');
});
