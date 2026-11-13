// The evidence of a running VM in the app: what the app checked itself, what
// was only reported, and what nothing confirms. The vault, its sealed profile
// and every hash here are made up and put into the Aleph mock; nothing leaves
// the test.
import { expect, test } from '@playwright/test';
import { privateKeyToAccount } from 'viem/accounts';
import { alephMock } from './aleph-mock.js';
import { alephPrivateKey, deriveBytes, LABELS, newMasterSecret } from '../src/lib/keys/derive.js';
import { newSeedPhrase, seal, sealingKeyFromSeedPhrase } from '../src/lib/keys/seal.js';
import { seedIndexAccount, VAULT_KEY } from '../src/lib/keys/index-keys.js';
import { PROFILE_KEY } from '../src/lib/profile.js';

const HOST = 'vm.example.test:24000';
const LAUNCH = '2a'.repeat(48);
const STATUS = { v: 2, phase: 'ready', paperless: true, backupRequest: null };

async function open(page, running) {
	const install = alephMock();
	const aggregates = await install(page.context());
	const master = newMasterSecret();
	const phrase = newSeedPhrase();
	aggregates.set(seedIndexAccount(phrase).address, { [VAULT_KEY]: { v: 1, box: await seal(master, sealingKeyFromSeedPhrase(phrase), 'master/seed') } });
	const profile = {
		network: 'calibration',
		role: 'test',
		rootfsItemHash: 'e'.repeat(64),
		running: {
			instanceHash: 'c'.repeat(64),
			crnHash: 'd'.repeat(64),
			host: HOST,
			payer: '0x00000000000000000000000000000000000000bb',
			trustedExecution: { mode: 'sev_snp', policy: 196608, runtime: 'made-up', measurements: [{ platform: 'sev_snp', registers: { launch: LAUNCH } }] },
			dataDisk: 'encrypted',
			...running
		}
	};
	const sealed = await seal(new TextEncoder().encode(JSON.stringify(profile)), deriveBytes(master, LABELS.profileKey), 'profile');
	aggregates.set(privateKeyToAccount(alephPrivateKey(master)).address, { [PROFILE_KEY]: { v: 1, box: sealed } });
	await page.context().route(/^https?:\/\/(?!localhost|api2\.aleph\.im)/, (route) => route.abort());
	await page.context().route(`https://${HOST}/anywhere/**`, (route) => route.fulfill({ json: STATUS, headers: { 'access-control-allow-origin': '*' } }));
	await page.goto('/app/');
	await page.getByText('Auf diesem Gerät mit Wiederherstellungsphrase öffnen').click();
	await page.locator('textarea').first().fill(phrase);
	await page.getByRole('button', { name: 'Öffnen', exact: true }).click();
}

test.describe('German', () => {
	test.use({ locale: 'de-DE' });

	test('a running VM shows its evidence, folded, with the attestation the app kept', async ({ page }) => {
		await open(page, { attestation: { measurement: LAUNCH, policy: '0x30000', launchTcb: { bootloader: 4, tee: 0, snp: 22, microcode: 213 }, at: Date.UTC(2026, 0, 2, 3, 4, 5) } });
		const evidence = page.getByTestId('evidence').first();
		await expect(evidence).toBeVisible({ timeout: 30_000 });
		await expect(evidence.getByTestId('evidence-tally')).toHaveText('4 von der App geprüft · 2 gemeldet · 2 nicht bestätigt');
		await expect(evidence.getByTestId('evidence-attestation')).toBeHidden();
		await evidence.locator('summary').focus();
		await page.keyboard.press('Enter');
		const attestation = evidence.getByTestId('evidence-attestation');
		await expect(attestation).toHaveAttribute('data-mark', 'app');
		await expect(attestation).toContainText(LAUNCH);
		await expect(attestation).toContainText('2026-01-02T03:04:05.000Z');
		await expect(attestation.getByRole('button', { name: 'Jetzt erneut prüfen' })).toBeVisible();
		// The image is never called confirmed; what the VM says is marked as reported.
		await expect(evidence.getByTestId('evidence-image')).toHaveAttribute('data-mark', 'open');
		await expect(evidence.getByTestId('evidence-image')).toContainText('Der Inhalt des Images wird nicht mitgemessen.');
		await expect(evidence.getByTestId('evidence-data')).toHaveAttribute('data-mark', 'reported');
		await expect(evidence.getByTestId('evidence-instance').getByRole('link', { name: 'Aleph-Nachricht' })).toHaveAttribute('href', `https://api2.aleph.im/api/v0/messages/${'c'.repeat(64)}`);
		await expect(evidence.getByTestId('evidence-sample')).toHaveCount(0);
		// Nothing wider than a phone.
		await page.setViewportSize({ width: 375, height: 812 });
		expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
	});

	test('a VM without a kept attestation says so instead of calling it checked', async ({ page }) => {
		await open(page, {});
		const evidence = page.getByTestId('evidence').first();
		await expect(evidence).toBeVisible({ timeout: 30_000 });
		await expect(evidence.getByTestId('evidence-tally')).toHaveText('3 von der App geprüft · 2 gemeldet · 3 nicht bestätigt');
		await evidence.locator('summary').click();
		await expect(evidence.getByTestId('evidence-attestation')).toHaveAttribute('data-mark', 'open');
		await expect(evidence.getByTestId('evidence-attestation')).toContainText('Für diese VM ist kein Ergebnis vermerkt');
	});
});

test('the evidence follows the language chosen on the landing page', async ({ page }) => {
	await page.addInitScript(() => localStorage.setItem('paperless-lang', 'en'));
	await open(page, {});
	await expect(page.getByTestId('evidence').first().locator('summary')).toContainText('Evidence of this VM', { timeout: 30_000 });
});
