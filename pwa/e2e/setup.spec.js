import { expect, test } from '@playwright/test';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import { alephMock } from './aleph-mock.js';

const payer = privateKeyToAccount(generatePrivateKey());
const OTHER = { address: '0x00000000000000000000000000000000000000aa', types: ['POST'] };
// Shaped like an age identity; never used to decrypt anything here.
const AGE = 'AGE-SECRET-KEY-1' + 'Q'.repeat(58);

/** Only localhost and the Aleph mock: nothing else leaves the test. */
async function offline(context) {
	await context.route(/^https?:\/\/(?!localhost|api2\.aleph\.im)/, (route) => route.abort());
}

/** MetaMask, as far as this app uses it: accounts and personal_sign, by a test key. */
async function wallet(context) {
	await context.exposeBinding('__wallet', async (_source, { method, params }) => {
		if (method === 'eth_requestAccounts' || method === 'eth_accounts') return [payer.address];
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

	await page.getByRole('button', { name: 'Wallet verbinden' }).click();
	await expect(page.getByTestId('payer')).toHaveText(payer.address);
	await expect(page.getByTestId('aleph-status')).toHaveText('nicht freigegeben');

	await page.getByRole('button', { name: 'Im Wallet freigeben' }).click();
	await expect(page.getByTestId('aleph-status')).toHaveText('freigegeben (INSTANCE, FORGET)');
	expect(aggregates.get(payer.address).security.authorizations).toEqual([OTHER, { address: appAddress, types: ['INSTANCE', 'FORGET'] }]);

	await page.getByPlaceholder('wss://dein-relay.example/attest').fill('wss://relay.example.com/attest');
	await page.getByRole('button', { name: 'Speichern' }).click();
	await page.getByPlaceholder('AGE-SECRET-KEY-1…').fill(AGE);
	await page.getByRole('button', { name: 'Versiegelt hinterlegen' }).click();
	await expect(page.getByTestId('age-status')).toHaveText('hinterlegt (versiegelt)');

	// Aleph holds the profile as a sealed box only.
	const profile = aggregates.get(appAddress)['paperless-anywhere-profile'];
	expect(Object.keys(profile.box).sort()).toEqual(['ct', 'iv', 'purpose', 'v']);
	expect(JSON.stringify(profile)).not.toContain(AGE);
	expect(JSON.stringify(profile)).not.toContain(payer.address);

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
	await expect(phone.getByTestId('aleph-status')).toHaveText('freigegeben (INSTANCE, FORGET)');
	await expect(phone.getByTestId('age-status')).toHaveText('hinterlegt (versiegelt)');
	await expect(phone.getByPlaceholder('wss://dein-relay.example/attest')).toHaveValue('wss://relay.example.com/attest');

	// Revoking removes this app's entry and keeps the others.
	await phone.getByRole('button', { name: 'Freigabe zurücknehmen' }).click();
	await expect(phone.getByTestId('aleph-status')).toHaveText('nicht freigegeben');
	expect(aggregates.get(payer.address).security.authorizations).toEqual([OTHER]);
	await other.close();
});
