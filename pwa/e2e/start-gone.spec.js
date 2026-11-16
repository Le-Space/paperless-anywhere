// An interrupted start Aleph rejected (its image was forgotten): "Start
// fortsetzen" drops it with a plain note, and the start is offered anew.
// The vault, its sealed profile and every hash are made up and stay in the mocks.
import { expect, test } from '@playwright/test';
import { privateKeyToAccount } from 'viem/accounts';
import { alephMock } from './aleph-mock.js';
import { alephPrivateKey, deriveBytes, LABELS, newMasterSecret } from '../src/lib/keys/derive.js';
import { newSeedPhrase, seal, sealingKeyFromSeedPhrase } from '../src/lib/keys/seal.js';
import { seedIndexAccount, VAULT_KEY } from '../src/lib/keys/index-keys.js';
import { PROFILE_KEY } from '../src/lib/profile.js';

const INSTANCE = 'c'.repeat(64);
const GONE_IMAGE = 'a'.repeat(64);

test.use({ locale: 'de-DE' });

test('a rejected interrupted start is dropped, and the start is offered again', async ({ page }) => {
	const install = alephMock();
	const aggregates = await install(page.context());
	const master = newMasterSecret();
	const phrase = newSeedPhrase();
	aggregates.set(seedIndexAccount(phrase).address, { [VAULT_KEY]: { v: 1, box: await seal(master, sealingKeyFromSeedPhrase(phrase), 'master/seed') } });
	const image = 'e'.repeat(64);
	const profile = {
		network: 'calibration',
		role: 'test',
		appPays: true,
		rootfsItemHash: image,
		luksPassphrase: 'made-up passphrase',
		luksFor: image,
		crnHash: 'd'.repeat(64),
		starting: { instanceHash: INSTANCE, crnHash: 'd'.repeat(64), payer: '0x00000000000000000000000000000000000000bb', trustedExecution: {}, restoreEntry: null, at: Date.parse('2026-11-16T06:00:00Z') }
	};
	const sealed = await seal(new TextEncoder().encode(JSON.stringify(profile)), deriveBytes(master, LABELS.profileKey), 'profile');
	aggregates.set(privateKeyToAccount(alephPrivateKey(master)).address, { [PROFILE_KEY]: { v: 1, box: sealed } });
	await page
		.context()
		.route(`https://api2.aleph.im/api/v0/messages/${INSTANCE}`, (route) => route.fulfill({ json: { status: 'rejected', item_hash: INSTANCE, error_code: 301, details: { errors: [GONE_IMAGE] } } }));
	await page.context().route(/^https?:\/\/(?!localhost|api2\.aleph\.im)/, (route) => route.abort());
	await page.goto('/app/');
	await page.getByTestId('open-with-phrase').click();
	await page.locator('textarea').first().fill(phrase);
	await page.getByTestId('open-phrase').click();

	// The overview offers both: carry on, or drop it.
	await expect(page.getByTestId('simple-resume')).toBeVisible();
	await expect(page.getByTestId('simple-discard-start')).toBeVisible();
	await page.getByTestId('simple-resume').click();

	await expect(page.getByTestId('start-gone')).toContainText('abgelehnt worden');
	await expect(page.getByTestId('start-gone')).toContainText(GONE_IMAGE.slice(0, 12));
	await expect(page.getByTestId('start-gone')).toContainText('du kannst neu starten');
	await expect(page.getByTestId('simple-resume')).toHaveCount(0);
	await expect(page.getByTestId('start')).toBeVisible();
	await expect(page.locator('[role="alert"]')).toHaveCount(0);
});
