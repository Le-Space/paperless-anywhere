// The automatic stop (auto-stop.js, docs/auto-stop.md) in the v0.2 interface:
// the form in the backup area writes the setting into the sealed profile,
// and while the VM runs, the start area says when it stops itself and warns
// shortly before. The VM is a mocked status page at a made-up host; the vault
// and its sealed profile are made here and put into the Aleph mock. Nothing
// leaves the test.
import { expect, test } from '@playwright/test';
import { privateKeyToAccount } from 'viem/accounts';
import { alephMock } from './aleph-mock.js';
import { alephPrivateKey, deriveBytes, LABELS, newMasterSecret } from '../src/lib/keys/derive.js';
import { newSeedPhrase, seal, sealingKeyFromSeedPhrase, unseal } from '../src/lib/keys/seal.js';
import { seedIndexAccount, VAULT_KEY } from '../src/lib/keys/index-keys.js';
import { PROFILE_KEY } from '../src/lib/profile.js';

const HOST = 'vm.example.test:24000';

/** A vault in the Aleph mock, with backups on, running or not. */
async function vault(page, extra = {}, status = null) {
	const aggregates = await alephMock()(page.context());
	const master = newMasterSecret();
	const phrase = newSeedPhrase();
	aggregates.set(seedIndexAccount(phrase).address, { [VAULT_KEY]: { v: 1, box: await seal(master, sealingKeyFromSeedPhrase(phrase), 'master/seed') } });
	const profile = { network: 'calibration', role: 'test', backupConfig: { providers: 2 }, ...extra };
	const key = deriveBytes(master, LABELS.profileKey);
	const app = privateKeyToAccount(alephPrivateKey(master)).address;
	aggregates.set(app, { [PROFILE_KEY]: { v: 1, box: await seal(new TextEncoder().encode(JSON.stringify(profile)), key, 'profile') } });
	await page.context().route(/^https?:\/\/(?!localhost|api2\.aleph\.im)/, (route) => route.abort());
	if (status) await page.context().route(`https://${HOST}/anywhere/**`, (route) => route.fulfill({ json: status, headers: { 'access-control-allow-origin': '*' } }));
	await page.goto('/v0.2/');
	await page.getByTestId('v2-have-vault').click();
	await page.getByTestId('v2-words').fill(phrase);
	await page.getByTestId('v2-open-words').click();
	await expect(page.getByTestId('v2-state')).toHaveText('unlocked');
	const saved = async () => JSON.parse(new TextDecoder().decode(await unseal(aggregates.get(app)[PROFILE_KEY].box, key, 'profile')));
	return { saved };
}

test.use({ locale: 'de-DE', timezoneId: 'Europe/Berlin' });

test('the form keeps the setting in the sealed profile, with the browser’s time zone, and says that a pause still costs', async ({ page }) => {
	test.setTimeout(60_000);
	const { saved } = await vault(page);
	await page.getByTestId('v2-area-backup').click();
	const form = page.getByTestId('auto-stop');
	await expect(form).toBeVisible();
	await expect(form).toContainText('kostet die Maschine noch so viel wie laufend');
	await expect(form).toContainText('Zeitzone: Europe/Berlin');
	// Another value out of range is refused before anything is written.
	await page.getByTestId('auto-stop-idle').selectOption('other');
	await page.getByTestId('auto-stop-minutes').fill('5');
	await page.getByTestId('auto-stop-save').click();
	await expect(page.getByTestId('auto-stop-note')).toContainText('zwischen 15 und 1440');
	expect((await saved()).autoStop).toBeUndefined();
	// One hour, and daily at 18:00.
	await page.getByTestId('auto-stop-idle').selectOption('60');
	await page.getByTestId('auto-stop-daily-on').check();
	await page.getByTestId('auto-stop-daily').fill('18:00');
	await page.getByTestId('auto-stop-save').click();
	await expect(page.getByTestId('auto-stop-note')).toHaveText('Gespeichert.');
	expect((await saved()).autoStop).toEqual({ idleMinutes: 60, dailyAt: '18:00', tz: 'Europe/Berlin', postponeUntil: 0 });
	// Off again.
	await page.getByTestId('auto-stop-idle').selectOption('');
	await page.getByTestId('auto-stop-daily-on').uncheck();
	await page.getByTestId('auto-stop-save').click();
	await expect(page.getByTestId('auto-stop-note')).toHaveText('Gespeichert.');
	expect((await saved()).autoStop).toBeNull();
});

test('while the VM runs, the start area says when it stops itself, and warns ten minutes before', async ({ page }) => {
	test.setTimeout(60_000);
	const soon = new Date(Date.now() + 5 * 60_000).toISOString().replace(/\.\d+Z$/, 'Z');
	const setting = { idleMinutes: 60, dailyAt: null, tz: 'Europe/Berlin', utcOffsetMinutes: 60, postponeUntil: 0 };
	const status = { v: 2, phase: 'ready', paperless: true, capabilities: { v: 1, autoStop: 1 }, autoStop: { setting, idleAt: soon, dailyAt: null, postponeUntil: null } };
	const running = { instanceHash: 'c'.repeat(64), crnHash: 'd'.repeat(64), host: HOST, payer: '0x00000000000000000000000000000000000000bb', trustedExecution: {} };
	await vault(page, { running, autoStop: { idleMinutes: 60, dailyAt: null, tz: 'Europe/Berlin' } }, status);
	const start = page.getByTestId('v2-start');
	await expect(start.getByTestId('auto-stop-warning')).toContainText('sichert sich und hält um etwa');
	await expect(start.getByTestId('auto-stop-later')).toBeVisible();
	if (process.env.AUTO_STOP_SHOTS) await page.screenshot({ path: `${process.env.AUTO_STOP_SHOTS}/start.png`, fullPage: true });
	await page.getByTestId('v2-area-backup').click();
	await expect(page.getByTestId('auto-stop').getByTestId('auto-stop-idle')).toHaveValue('60');
	if (process.env.AUTO_STOP_SHOTS) await page.getByTestId('auto-stop').screenshot({ path: `${process.env.AUTO_STOP_SHOTS}/form.png` });
});
