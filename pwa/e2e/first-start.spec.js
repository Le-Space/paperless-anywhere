// The certificate of a vault's own image: reachable under "Erweitert" once the
// image is built, with the values that can be checked and their links. The
// vault and its sealed profile are made here and put into the Aleph mock;
// every value is made up. Set SHOTS=<dir> to keep a screenshot.
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { privateKeyToAccount } from 'viem/accounts';
import { alephMock } from './aleph-mock.js';
import { alephPrivateKey, deriveBytes, LABELS, newMasterSecret } from '../src/lib/keys/derive.js';
import { newSeedPhrase, seal, sealingKeyFromSeedPhrase } from '../src/lib/keys/seal.js';
import { seedIndexAccount, VAULT_KEY } from '../src/lib/keys/index-keys.js';
import { PROFILE_KEY } from '../src/lib/profile.js';
import { BUILDER } from '../src/lib/own-image.js';

const IMAGE = 'a1'.repeat(32);
test.use({ locale: 'de-DE', timezoneId: 'Europe/Berlin' });

async function vaultWith(page, extra) {
	const install = alephMock();
	const aggregates = await install(page.context());
	const master = newMasterSecret();
	const phrase = newSeedPhrase();
	aggregates.set(seedIndexAccount(phrase).address, { [VAULT_KEY]: { v: 1, box: await seal(master, sealingKeyFromSeedPhrase(phrase), 'master/seed') } });
	const profile = { network: 'calibration', role: 'test', appPays: true, crnHash: 'd'.repeat(64), ...extra };
	const sealed = await seal(new TextEncoder().encode(JSON.stringify(profile)), deriveBytes(master, LABELS.profileKey), 'profile');
	aggregates.set(privateKeyToAccount(alephPrivateKey(master)).address, { [PROFILE_KEY]: { v: 1, box: sealed } });
	await page.context().route(/^https?:\/\/(?!localhost|api2\.aleph\.im)/, (route) => route.abort());
	await page.goto('/app/');
	await page.getByTestId('open-with-phrase').click();
	await page.locator('textarea').first().fill(phrase);
	await page.getByTestId('open-phrase').click();
}
const ownImage = (plainSha256) => ({ rootfsItemHash: IMAGE, luksPassphrase: 'made-up passphrase', luksFor: IMAGE, ownImage: { plainSha256, rootfsItemHash: IMAGE, cid: 'bafybeiexample', builtAt: '2026-11-15T07:30:00.000Z', builder: { vprogram: 'f'.repeat(64), measurement: 'ab'.repeat(24) } } });

test('the overview says which image Paperless starts from, and offers a newer version while it is off', async ({ page }) => {
	await vaultWith(page, ownImage('0'.repeat(64)));
	await expect(page.getByTestId('image-line')).toContainText('Eigenes Image, gebaut am 15.11.2026.');
	await expect(page.getByTestId('image-newer')).toHaveText('Eine neuere Image-Version ist da.');
	await expect(page.getByTestId('image-rebuild')).toHaveText('Jetzt neu bauen');
});

test('a start on an image with a newer version asks first, with the rebuild one button away', async ({ page }) => {
	await vaultWith(page, ownImage('0'.repeat(64)));
	await expect(page.getByTestId('image-newer')).toBeVisible({ timeout: 30_000 });
	await expect(page.getByTestId('start-old-image')).toHaveCount(0);
	await page.getByTestId('start').click();
	const ask = page.getByTestId('start-old-image');
	await expect(ask).toContainText('Für dein eigenes Image gibt es eine neuere Version.');
	await expect(ask.getByTestId('start-rebuild-first')).toHaveText('Erst das Image neu bauen');
	await expect(ask.getByTestId('start-old-image-anyway')).toHaveText('Mit dem alten Image starten');
	// Nothing started while it asks.
	await expect(page.getByTestId('start')).toBeEnabled();
	await ask.getByRole('button', { name: 'Doch nicht starten' }).click();
	await expect(page.getByTestId('start-old-image')).toHaveCount(0);
});

test('the overview names the public image when no own one is built or planned', async ({ page }) => {
	await vaultWith(page, { rootfsItemHash: IMAGE, luksPassphrase: 'made-up passphrase' });
	await expect(page.getByTestId('image-line')).toHaveText('Öffentliches Image, zum Ausprobieren.');
	await expect(page.getByTestId('image-rebuild')).toHaveCount(0);
});

test('the certificate of the own image opens under "Erweitert", with its evidence, and closes again', async ({ page }) => {
	const install = alephMock();
	const aggregates = await install(page.context());
	const master = newMasterSecret();
	const phrase = newSeedPhrase();
	aggregates.set(seedIndexAccount(phrase).address, { [VAULT_KEY]: { v: 1, box: await seal(master, sealingKeyFromSeedPhrase(phrase), 'master/seed') } });
	const profile = {
		network: 'calibration',
		role: 'test',
		appPays: true,
		rootfsItemHash: IMAGE,
		luksPassphrase: 'made-up passphrase',
		luksFor: IMAGE,
		crnHash: 'd'.repeat(64),
		ownImage: { plainSha256: BUILDER?.plain.sha256, rootfsItemHash: IMAGE, cid: 'bafybeiexample', builtAt: '2026-11-15T07:30:00.000Z', builder: { vprogram: 'f'.repeat(64), measurement: 'ab'.repeat(24) } }
	};
	const sealed = await seal(new TextEncoder().encode(JSON.stringify(profile)), deriveBytes(master, LABELS.profileKey), 'profile');
	aggregates.set(privateKeyToAccount(alephPrivateKey(master)).address, { [PROFILE_KEY]: { v: 1, box: sealed } });
	await page.context().route(/^https?:\/\/(?!localhost|api2\.aleph\.im)/, (route) => route.abort());

	await page.goto('/app/');
	await page.getByTestId('open-with-phrase').click();
	await page.locator('textarea').first().fill(phrase);
	await page.getByTestId('open-phrase').click();
	// The overview names the own image, current: no newer version.
	await expect(page.getByTestId('image-line')).toHaveText('Eigenes Image, gebaut am 15.11.2026.');
	await expect(page.getByTestId('image-newer')).toHaveCount(0);
	await page.getByTestId('tab-advanced').click();
	await page.getByTestId('open-certificate').click();
	const cert = page.getByTestId('certificate');
	await expect(cert).toContainText('Dein eigenes Paperless-Image');
	await expect(cert).toContainText('nur in deinem Tresor');
	await expect(page.getByTestId('cert-built')).toHaveText('15. November 2026');
	await expect(page.getByTestId('cert-store')).toHaveAttribute('href', `https://api2.aleph.im/api/v0/messages/${IMAGE}`);
	await expect(page.getByTestId('cert-print')).toHaveText('Als PDF speichern');
	if (process.env.SHOTS) await page.screenshot({ path: join(process.env.SHOTS, 'certificate.png') });
	// "Zurück" from a certificate opened later goes back to the app.
	await page.getByRole('button', { name: 'Zurück' }).click();
	await expect(page.getByTestId('first-start')).toHaveCount(0);
	// In English, at once.
	await page.getByTestId('app-lang-en').click();
	await page.getByTestId('open-certificate').click();
	await expect(page.getByTestId('certificate')).toContainText('Your own Paperless image');
	await expect(page.getByTestId('cert-print')).toHaveText('Save as PDF');
});
