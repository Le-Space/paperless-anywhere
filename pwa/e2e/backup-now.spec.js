// The overview of a running Paperless shows its backups (last one, next
// check) from the VM's private status page, and "Jetzt sichern" asks the VM for
// a backup. The VM is a mocked status page at a made-up host; the vault and its
// sealed profile are made here and put into the Aleph mock, opened with the
// recovery phrase. Nothing leaves the test.
import { expect, test } from '@playwright/test';
import { privateKeyToAccount } from 'viem/accounts';
import { alephMock } from './aleph-mock.js';
import { alephPrivateKey, deriveBytes, LABELS, newMasterSecret, statusToken } from '../src/lib/keys/derive.js';
import { newSeedPhrase, seal, sealingKeyFromSeedPhrase } from '../src/lib/keys/seal.js';
import { seedIndexAccount, VAULT_KEY } from '../src/lib/keys/index-keys.js';
import { PROFILE_KEY } from '../src/lib/profile.js';

const HOST = 'vm.example.test:24000';

/** A vault with a running Paperless (backups on), in the Aleph mock's aggregates. */
async function runningVault(aggregates) {
	const master = newMasterSecret();
	const phrase = newSeedPhrase();
	const box = await seal(master, sealingKeyFromSeedPhrase(phrase), 'master/seed');
	aggregates.set(seedIndexAccount(phrase).address, { [VAULT_KEY]: { v: 1, box } });
	const profile = {
		network: 'calibration',
		role: 'test',
		backupConfig: { providers: 2 },
		running: { instanceHash: 'c'.repeat(64), crnHash: 'd'.repeat(64), host: HOST, payer: '0x00000000000000000000000000000000000000bb', trustedExecution: {} }
	};
	const sealed = await seal(new TextEncoder().encode(JSON.stringify(profile)), deriveBytes(master, LABELS.profileKey), 'profile');
	aggregates.set(privateKeyToAccount(alephPrivateKey(master)).address, { [PROFILE_KEY]: { v: 1, box: sealed } });
	return { master, phrase };
}

async function open(page, phrase) {
	await page.goto('/app/');
	await page.getByText('Auf diesem Gerät mit Wiederherstellungsphrase öffnen').click();
	await page.locator('textarea').first().fill(phrase);
	await page.getByRole('button', { name: 'Öffnen', exact: true }).click();
}

/** Aleph mock, the vault, nothing else on the network, and the VM's status page. */
async function setUp(page, status) {
	const install = alephMock();
	const aggregates = await install(page.context());
	const vault = await runningVault(aggregates);
	await page.context().route(/^https?:\/\/(?!localhost|api2\.aleph\.im)/, (route) => route.abort());
	await page.context().route(`https://${HOST}/anywhere/**`, (route) => route.fulfill({ json: status, headers: { 'access-control-allow-origin': '*' } }));
	return vault;
}

const hhmm = (d) => d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' });

test.describe('German', () => {
	test.use({ locale: 'de-DE', timezoneId: 'Europe/Berlin' });

	test('the overview shows the last backup, the last check and the next one, from the private status page', async ({ page }) => {
		test.setTimeout(90_000);
		const install = alephMock();
		const aggregates = await install(page.context());
		const { master, phrase } = await runningVault(aggregates);
		await page.context().route(/^https?:\/\/(?!localhost|api2\.aleph\.im)/, (route) => route.abort());

		const last = new Date(Date.now() - 50 * 60_000);
		const checked = new Date(Date.now() - 20 * 60_000);
		const next = new Date(Date.now() + 100 * 60_000);
		/** @type {any} */
		let page_ = {
			v: 2,
			phase: 'ready',
			paperless: true,
			backup: { status: 'unchanged', at: checked.toISOString() },
			lastBackup: { status: 'done', at: last.toISOString(), seconds: 410, backup: { name: 'paperless-made-up', date: last.toISOString(), requestedCopies: 2, complete: true, copies: [{ providerId: 1 }, { providerId: 2 }] } },
			backupSchedule: { nextCheck: next.toISOString(), everySeconds: 7200 },
			backupRequest: null,
			storage: { documentsBytes: 2.5e9, databaseBytes: 1e8, at: Math.floor(Date.now() / 1000) }
		};
		const asked = [];
		await page.context().route(`https://${HOST}/anywhere/**`, (route) => {
			asked.push(new URL(route.request().url()).pathname);
			return route.fulfill({ json: page_, headers: { 'access-control-allow-origin': '*' } });
		});

		await open(page, phrase);
		await expect(page.getByRole('heading', { name: 'Paperless-ngx läuft' })).toBeVisible();
		await expect(page.getByTestId('backup-last')).toContainText(`Letzte Sicherung: ${hhmm(last)} · alle 2 Kopien angekommen`);
		// The check apart from the backup: most checks find nothing new.
		await expect(page.getByTestId('backup-summary')).toHaveText(`Zuletzt geprüft ${hhmm(checked)}, keine Änderung · letzte Sicherung ${hhmm(last)} · nächste Prüfung ${hhmm(next)}`);
		await expect(page.getByTestId('simple-backup')).toContainText('gesichert wird nur, wenn sich etwas geändert hat');
		// The documents against the 8 GB a package includes.
		await expect(page.getByTestId('storage-used')).toHaveText('2,5 GB von 8,0 GB');
		await expect(page.getByTestId('storage-hint')).toHaveText('Noch 5,5 GB frei.');
		// Only the private page, by the vault's token.
		expect(asked).toContain(`/anywhere/s/${statusToken(master)}.json`);
		expect(asked).not.toContain('/anywhere/status.json');

	});

	test('while the VM backs up, the overview shows its progress; "Jetzt sichern" waits', async ({ page }) => {
		test.setTimeout(60_000);
		const { phrase } = await setUp(page, {
			v: 2,
			phase: 'ready',
			paperless: true,
			backup: { status: 'running', log: ['2026-01-02T03:04:05Z uploading to provider 2'] },
			lastBackup: null,
			backupSchedule: { nextCheck: new Date(Date.now() + 3600_000).toISOString(), everySeconds: 7200 },
			backupRequest: { status: 'running', mode: 'run', at: new Date().toISOString() }
		});
		await open(page, phrase);
		await expect(page.getByTestId('backup-progress')).toHaveText('Sicherung läuft … uploading to provider 2');
		await expect(page.getByTestId('backup-now')).toBeDisabled();
		await expect(page.getByTestId('backup-last')).toHaveText('Letzte Sicherung: Seit dem Start noch keine Sicherung');
	});

	test('"Jetzt sichern" asks the VM over the attested channel; without a relay it says why, and the stop stays possible', async ({ page }) => {
		test.setTimeout(60_000);
		const { phrase } = await setUp(page, {
			v: 2,
			phase: 'ready',
			paperless: true,
			backup: { status: 'failed', at: new Date().toISOString(), reason: 'the backup did not complete (exit 1)' },
			lastBackup: { status: 'failed', at: new Date().toISOString(), reason: 'the backup did not complete (exit 1)' },
			backupSchedule: { nextCheck: new Date(Date.now() + 3600_000).toISOString(), everySeconds: 7200 },
			backupRequest: null
		});
		await open(page, phrase);
		await expect(page.getByTestId('backup-last')).toContainText('fehlgeschlagen (the backup did not complete (exit 1))');
		await page.getByTestId('backup-now').click();
		await expect(page.getByTestId('backup-result')).toBeVisible({ timeout: 30_000 });
		await expect(page.getByTestId('backup-now')).toBeEnabled();
		await expect(page.getByRole('button', { name: 'Sichern und beenden' })).toBeEnabled();
	});

	test('a stop that reached fewer providers waits for the person: erase anyway or keep the VM', async ({ page }) => {
		test.setTimeout(60_000);
		const at = new Date().toISOString();
		const partial = { status: 'partial', at, reason: 'only 1 of 2 copies reached the providers', backup: { name: 'paperless-made-up', date: at, requestedCopies: 2, complete: false, copies: [{ providerId: 1 }] } };
		const { phrase } = await setUp(page, {
			v: 2,
			phase: 'stop-partial',
			paperless: false,
			backup: partial,
			lastBackup: partial,
			backupSchedule: { nextCheck: new Date(Date.now() + 3600_000).toISOString(), everySeconds: 7200 },
			backupRequest: null,
			stop: { status: 'partial', request: '1', at, backup: partial }
		});
		await open(page, phrase);
		await expect(page.getByTestId('stop-partial')).toContainText('nur 1 von 2 Kopien');
		await expect(page.getByTestId('stop-partial')).toContainText('fehlt diese Sicherung bei einem Anbieter');
		await expect(page.getByTestId('stop-partial-erase')).toBeEnabled();
		await expect(page.getByTestId('stop-partial-keep')).toBeEnabled();
		await expect(page.getByTestId('backup-short')).toHaveText(' · nur 1 von 2 Kopien');
		// Keeping it needs the attested channel; without a relay it says why and asks again.
		await page.getByTestId('stop-partial-keep').click();
		await expect(page.locator('.error[role=alert]')).toBeVisible({ timeout: 30_000 });
		await expect(page.getByTestId('stop-partial-keep')).toBeEnabled();
	});

	test('an older image: no backup details, no button', async ({ page }) => {
		test.setTimeout(60_000);
		const install = alephMock();
		const aggregates = await install(page.context());
		const { phrase } = await runningVault(aggregates);
		await page.context().route(/^https?:\/\/(?!localhost|api2\.aleph\.im)/, (route) => route.abort());
		await page.context().route(`https://${HOST}/anywhere/**`, (route) =>
			route.fulfill({ json: { v: 2, phase: 'ready', paperless: true, backup: { status: 'unchanged', at: new Date().toISOString() } }, headers: { 'access-control-allow-origin': '*' } })
		);
		await open(page, phrase);
		await expect(page.getByTestId('backup-old-image')).toContainText('älteren Image');
		await expect(page.getByTestId('backup-now')).toHaveCount(0);
	});

	test('"Erweitert" opens with "Auf einen Blick": one row per card, each with its state and a link', async ({ page }) => {
		test.setTimeout(90_000);
		const { phrase } = await setUp(page, { v: 2, phase: 'ready', paperless: true });
		await open(page, phrase);
		await page.getByTestId('tab-advanced').click();
		const glance = page.getByTestId('glance');
		await expect(glance.locator('li a')).toHaveText(['Paperless-ngx', 'Sicherungen', 'Adresse', 'Zahlweg']);
		await expect(page.getByTestId('glance-Paperless-ngx')).toHaveText('läuft');
		await expect(page.getByTestId('glance-Sicherungen')).toHaveText('noch keine');
		await expect(page.getByTestId('glance-Adresse')).toHaveText(HOST);
		await expect(page.getByTestId('glance-Zahlweg')).toHaveText('noch nicht gewählt');
		// It stands first; the Paperless card follows with its own chip and one main action.
		const top = async (l) => (await l.boundingBox()).y;
		expect(await top(glance)).toBeLessThan(await top(page.getByTestId('lifecycle')));
		await expect(page.getByTestId('paperless-chip')).toHaveText('läuft');
		await expect(page.getByRole('link', { name: 'Paperless-ngx öffnen' })).toHaveAttribute('href', `https://${HOST}/`);
		await glance.getByRole('link', { name: 'Zahlweg' }).click();
		await expect(page).toHaveURL(/#technisch$/);
		// The overview has none of it.
		await page.getByTestId('tab-simple').click();
		await expect(glance).toHaveCount(0);
	});
});

test.describe('English', () => {
	test.use({ locale: 'en-GB', timezoneId: 'Europe/Berlin' });

	test('the backup texts follow the language', async ({ page }) => {
		test.setTimeout(60_000);
		const install = alephMock();
		const aggregates = await install(page.context());
		const { phrase } = await runningVault(aggregates);
		await page.context().route(/^https?:\/\/(?!localhost|api2\.aleph\.im)/, (route) => route.abort());
		await page.context().route(`https://${HOST}/anywhere/**`, (route) =>
			route.fulfill({ json: { v: 2, phase: 'ready', paperless: true, backup: null, lastBackup: null, backupSchedule: { nextCheck: new Date(Date.now() + 3600_000).toISOString(), everySeconds: 7200 }, backupRequest: null }, headers: { 'access-control-allow-origin': '*' } })
		);
		await open(page, phrase);
		await expect(page.getByTestId('backup-last')).toHaveText('Last backup: No backup since the start yet');
		await expect(page.getByTestId('backup-summary')).toContainText('next check');
		await expect(page.getByTestId('backup-now')).toHaveText('Back up now');
	});
});
