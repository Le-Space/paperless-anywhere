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
import { ageIdentityFromMaster, ageRecipient } from '../src/lib/keys/age.js';
import { Encrypter } from 'age-encryption';
import { calibration } from '@filoz/synapse-core/chains';
import { calculate } from '@filoz/synapse-core/piece';
import { answers, PAYER, rpc } from './chain-mock.js';

const HOST = 'vm.example.test:24000';

/** A vault with a running Paperless (backups on), in the Aleph mock's aggregates. */
async function runningVault(aggregates, extra = {}) {
	const master = newMasterSecret();
	const phrase = newSeedPhrase();
	const box = await seal(master, sealingKeyFromSeedPhrase(phrase), 'master/seed');
	aggregates.set(seedIndexAccount(phrase).address, { [VAULT_KEY]: { v: 1, box } });
	const profile = {
		network: 'calibration',
		role: 'test',
		backupConfig: { providers: 2 },
		running: { instanceHash: 'c'.repeat(64), crnHash: 'd'.repeat(64), host: HOST, payer: '0x00000000000000000000000000000000000000bb', trustedExecution: {} },
		...extra,
		// 'vault': the vault's own backup key, as the app derives it.
		...(extra.ageIdentity === 'vault' ? { ageIdentity: ageIdentityFromMaster(master) } : {})
	};
	const sealed = await seal(new TextEncoder().encode(JSON.stringify(profile)), deriveBytes(master, LABELS.profileKey), 'profile');
	aggregates.set(privateKeyToAccount(alephPrivateKey(master)).address, { [PROFILE_KEY]: { v: 1, box: sealed } });
	return { master, phrase };
}

async function open(page, phrase) {
	await page.goto('/app/');
	await page.getByTestId('open-with-phrase').click();
	await page.locator('textarea').first().fill(phrase);
	await page.getByTestId('open-phrase').click();
}

/** The same vault in the v0.2 interface, in "Standard". */
async function openV2(page, phrase) {
	await page.goto('/v0.2/');
	await page.getByTestId('v2-have-vault').click();
	await page.getByTestId('v2-words').fill(phrase);
	await page.getByTestId('v2-open-words').click();
	await expect(page.getByTestId('v2-state')).toHaveText('unlocked');
}

/** Aleph mock, the vault, nothing else on the network, and the VM's status page. */
async function setUp(page, status, extra = {}) {
	const install = alephMock();
	const aggregates = await install(page.context());
	const vault = await runningVault(aggregates, extra);
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

	test('a VM without a backup of its own shows the last known one, said as before this start', async ({ page }) => {
		test.setTimeout(60_000);
		const earlier = new Date(Date.now() - 2 * 3600_000);
		earlier.setSeconds(0, 0);
		const checked = new Date(Date.now() - 600_000);
		const next = new Date(Date.now() + 6600_000);
		const { phrase } = await setUp(
			page,
			{
				v: 2,
				phase: 'ready',
				paperless: true,
				backup: { status: 'unchanged', at: checked.toISOString() },
				lastBackup: null,
				backupSchedule: { nextCheck: next.toISOString(), everySeconds: 7200 },
				backupRequest: null
			},
			{ lastGoodBackup: { at: earlier.toISOString(), copies: 2, requested: 2 } }
		);
		await open(page, phrase);
		await expect(page.getByTestId('last-good-backup')).toContainText(`Letzte erfolgreiche Sicherung: ${hhmm(earlier)}`);
		await expect(page.getByTestId('backup-last')).toHaveText(`Letzte Sicherung: ${hhmm(earlier)} · 2 Kopien · vor diesem Start`);
		await expect(page.getByTestId('backup-summary')).toHaveText(`Zuletzt geprüft ${hhmm(checked)}, keine Änderung · letzte Sicherung ${hhmm(earlier)} · nächste Prüfung ${hhmm(next)}`);
	});

	test('an image that backs up after a quiet half hour says when the next backup is due, or that none is', async ({ page }) => {
		test.setTimeout(60_000);
		const last = new Date(Date.now() - 2 * 3600_000);
		const due = new Date(Date.now() + 4 * 3600_000);
		/** @type {any} */
		const schedule = { nextCheck: new Date(Date.now() + 600_000).toISOString(), everySeconds: 600, pending: true, nextBackup: due.toISOString(), quietSeconds: 1800, minSeconds: 6 * 3600 };
		const { phrase } = await setUp(page, {
			v: 2,
			phase: 'ready',
			paperless: true,
			backup: { status: 'done', at: last.toISOString() },
			lastBackup: { status: 'done', at: last.toISOString(), seconds: 410, backup: { name: 'paperless-made-up', date: last.toISOString(), requestedCopies: 2, complete: true, copies: [{ providerId: 1 }, { providerId: 2 }] } },
			backupSchedule: schedule,
			backupRequest: null
		});
		await open(page, phrase);
		await expect(page.getByTestId('backup-next')).toHaveText(`nächste Sicherung frühestens ${hhmm(due)}`);
		await expect(page.getByTestId('simple-backup')).toContainText('höchstens alle 6 Stunden');
		await expect(page.getByTestId('simple-backup')).not.toContainText('Alle zwei Stunden');
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

	test('erasing after a partial stop shows one panel: each copy, the FORGET, then the evidence', async ({ page }) => {
		test.setTimeout(60_000);
		const at = new Date().toISOString();
		// Made up: the piece CID of 4 KiB of nines, in the mocked chain's data sets.
		const chainPiece = await calculate(new Uint8Array(4096).fill(9));
		const cid = chainPiece.toString();
		const partial = { status: 'partial', at, reason: 'only 1 of 2 copies reached the providers', log: [`${at.replace(/\.\d+Z$/, 'Z')} upload with primary 2 failed: made up`], backup: { name: 'paperless-made-up', date: at, pieceCid: cid, size: 52_000_000, requestedCopies: 2, complete: false, copies: [{ providerId: '1', dataSetId: '11', pieceId: '7', location: 'DE', retrievalUrl: `https://sp1.example/piece/${cid}` }] } };
		const { master, phrase } = await setUp(page, {
			v: 2,
			phase: 'stop-partial',
			paperless: false,
			backup: partial,
			lastBackup: partial,
			backupSchedule: { nextCheck: new Date(Date.now() + 3600_000).toISOString(), everySeconds: 7200 },
			backupRequest: null,
			stop: { status: 'partial', request: '1', at, backup: partial }
		}, { ageIdentity: 'vault', payer: PAYER });
		// Before the VM goes, the app finds the backup on the chain itself.
		await page.context().route(calibration.rpcUrls.default.http[0], rpc(answers(chainPiece)));
		// The provider serves a backup sealed with age to the vault's backup key (made up, made here).
		const e = new Encrypter();
		e.addRecipient(ageRecipient(ageIdentityFromMaster(master)));
		const piece = Buffer.from(await e.encrypt(new Uint8Array(100_000)));
		await page.context().route(`https://sp1.example/piece/${cid}`, (route) => route.fulfill({ body: piece, headers: { 'access-control-allow-origin': '*' } }));
		await open(page, phrase);
		await page.getByTestId('stop-partial-erase').click();
		const panel = page.getByTestId('stop-panel');
		await expect(panel).toBeVisible({ timeout: 30_000 });
		await expect(page.getByTestId('light-forgot')).toHaveAttribute('data-state', 'app', { timeout: 30_000 });
		await expect(page.getByTestId('light-copy-1')).toHaveAttribute('data-state', 'reported');
		await expect(page.getByTestId('light-copy-1')).toContainText('Datensatz 11');
		await expect(page.getByTestId('light-copy-2')).toHaveAttribute('data-state', 'failed');
		await expect(page.getByTestId('light-confirmed')).toContainText('1 von 2');
		await expect(page.getByTestId('light-listed')).toHaveAttribute('data-state', 'app');
		// No node answered (none in the mock): said as later, never as checked.
		await expect(page.getByTestId('light-node')).toContainText('(später)');
		// No second list of steps.
		await expect(page.getByTestId('progress-steps')).toHaveCount(0);
		await expect(panel).toHaveCount(1);
		const evidence = page.getByTestId('evidence');
		await expect(evidence).toContainText('Nachweis: Sicherung und Löschen');
		await evidence.locator('summary').click();
		await expect(evidence).toContainText(cid);
		await expect(evidence.getByRole('link', { name: 'Beim Anbieter abrufen (nur Chiffrat)' })).toHaveAttribute('href', `https://sp1.example/piece/${cid}`);
		await expect(evidence.getByRole('link', { name: 'FORGET-Nachricht' })).toBeVisible();
		// How it was encrypted, checked by the app itself: the header opened with the vault's key.
		await expect(page.getByTestId('light-header')).toHaveAttribute('data-state', 'app', { timeout: 15_000 });
		const sealedRow = page.getByTestId('evidence-stopSealed');
		await expect(sealedRow).toHaveAttribute('data-mark', 'app');
		await expect(sealedRow).toContainText('age v1 · X25519 · HKDF-SHA-256 · ChaCha20-Poly1305 (64 KiB)');
		await expect(sealedRow).toContainText('aus deinem Tresor abgeleitet');
		await expect(sealedRow.getByTestId('evidence-copy-recipient')).toBeVisible();
		await expect(sealedRow.getByRole('link', { name: 'Spezifikation age v1' })).toHaveAttribute('href', 'https://age-encryption.org/v1');
		// Only public keys in the page.
		expect(await page.content()).not.toMatch(/AGE-SECRET-KEY-1[0-9A-Z]{20}/);
	});

	test('v0.2: "Standard" shows the stop as rows and lights in plain words, the facts on request; "Technisch" writes them out', async ({ page }) => {
		test.setTimeout(60_000);
		const at = new Date().toISOString();
		const chainPiece = await calculate(new Uint8Array(4096).fill(9));
		const cid = chainPiece.toString();
		const partial = { status: 'partial', at, reason: 'only 1 of 2 copies reached the providers', log: [`${at.replace(/\.\d+Z$/, 'Z')} upload with primary 2 failed: made up`], backup: { name: 'paperless-made-up', date: at, pieceCid: cid, size: 52_000_000, requestedCopies: 2, complete: false, copies: [{ providerId: 1, dataSetId: 11, pieceId: 0, retrievalUrl: `https://sp1.example/piece/${cid}` }] } };
		const { phrase } = await setUp(page, { v: 2, phase: 'stop-partial', paperless: false, backup: partial, lastBackup: partial, backupSchedule: { nextCheck: new Date(Date.now() + 3600_000).toISOString(), everySeconds: 7200 }, backupRequest: null, stop: { status: 'partial', request: '1', at, backup: partial } }, { ageIdentity: 'vault', payer: PAYER });
		await page.context().route(calibration.rpcUrls.default.http[0], rpc(answers(chainPiece)));
		await openV2(page, phrase);
		await page.getByTestId('stop-partial-erase').click();
		const panel = page.getByTestId('stop-panel');
		await expect(panel).toBeVisible({ timeout: 30_000 });
		await expect(page.getByTestId('light-forgot')).toHaveAttribute('data-state', 'app', { timeout: 30_000 });
		// Standard: the rows in plain words with their lights; no provider, data set or FORGET on screen.
		await expect(panel).toContainText('Kopien ablegen');
		await expect(panel).toContainText('Maschine löschen');
		await expect(panel).not.toContainText('Hochladen');
		await expect(page.getByTestId('light-copy-1')).toBeHidden();
		// What failed is never a red light alone: its sentence shows without asking.
		await expect(page.getByTestId('light-copy-2')).toBeVisible();
		await expect(page.getByTestId('light-copy-2')).toHaveAttribute('data-state', 'failed');
		await expect(page.getByTestId('panel-total')).toHaveCount(0);
		// Each row still says its state to a screen reader.
		await expect(page.getByTestId('panel-forget')).toContainText('Maschine löschen: fertig');
		// The facts are one button away, and nothing is lost.
		await page.getByTestId('panel-details').click();
		await expect(page.getByTestId('light-copy-1')).toContainText('Datensatz 11');
		await page.getByTestId('panel-details').click();
		await expect(page.getByTestId('light-copy-1')).toBeHidden();
		// Technisch: today's row names, every fact written out, the timings.
		await page.getByRole('banner').getByTestId('view-technical').click();
		await expect(panel).toContainText('Hochladen');
		await expect(page.getByTestId('light-copy-1')).toContainText('Datensatz 11');
		await expect(page.getByTestId('panel-details')).toHaveCount(0);
		await expect(page.getByTestId('panel-total')).toBeVisible();
	});

	test('v0.2: an older image is said in plain words in "Standard", in today\'s words in "Technisch"', async ({ page }) => {
		const { phrase } = await setUp(page, { v: 2, phase: 'ready', paperless: true });
		await openV2(page, phrase);
		await page.getByTestId('v2-area-backup').click();
		await expect(page.getByTestId('backup-old-image')).toContainText('älteren Fassung');
		await expect(page.getByTestId('backup-old-image')).not.toContainText('Image');
		await page.getByRole('banner').getByTestId('view-technical').click();
		await expect(page.getByTestId('backup-old-image')).toContainText('älteren Image');
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
		await expect(page.getByTestId('glance-paperless')).toHaveText('läuft');
		await expect(page.getByTestId('glance-backups')).toHaveText('noch keine');
		await expect(page.getByTestId('glance-address')).toHaveText(HOST);
		await expect(page.getByTestId('glance-pays')).toHaveText('noch nicht gewählt');
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
			route.fulfill({ json: { v: 2, phase: 'ready', paperless: true, backup: null, lastBackup: null, backupSchedule: { nextCheck: new Date(Date.now() + 3600_000).toISOString(), everySeconds: 7200 }, backupRequest: null, storage: { documentsBytes: 2.5e9 } }, headers: { 'access-control-allow-origin': '*' } })
		);
		await open(page, phrase);
		// German without a choice, whatever the browser's language; the switch in the header changes it at once.
		await expect(page.getByTestId('backup-last')).toHaveText('Letzte Sicherung: Seit dem Start noch keine Sicherung');
		await page.getByTestId('app-lang-en').click();
		await expect(page.locator('html')).toHaveAttribute('lang', 'en');
		await expect(page.getByTestId('backup-last')).toHaveText('Last backup: No backup since the start yet');
		await expect(page.getByTestId('backup-summary')).toContainText('next check');
		await expect(page.getByTestId('backup-now')).toHaveText('Back up now');
		// The storage line too, with English numbers.
		await expect(page.getByTestId('storage-used')).toHaveText('2.5 GB of 8.0 GB');
		await expect(page.getByTestId('storage-hint')).toHaveText('5.5 GB still free.');
	});
});
