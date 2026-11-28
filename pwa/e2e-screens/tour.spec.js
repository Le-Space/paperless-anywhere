// The screen tour: the screenshots of the install dialog (src/lib/web-manifest.js)
// and the README, in German and English, narrow (a phone) and wide (a desktop
// window). Run on demand against the built site, not in CI:
//
//   pnpm build && pnpm screens
//
// It writes test-results/screens/<name>-<form>-<lang>.png; scripts/screens.mjs
// then compresses them into static/screenshots/. Look at every picture before
// committing it.
//
// Everything shown is made up, as in the e2e tests it borrows from: the vault
// and its sealed profile are made here, the VM is a mocked status page at
// vm.example.test, Aleph is an in-memory mock (e2e/aleph-mock.js), the chain a
// mocked RPC node with invented providers and data sets (e2e/chain-mock.js).
// Nothing leaves the test.
import { expect, test } from '@playwright/test';
import { privateKeyToAccount } from 'viem/accounts';
import { calibration } from '@filoz/synapse-core/chains';
import { calculate } from '@filoz/synapse-core/piece';
import { answers, PAYER, rpc } from '../e2e/chain-mock.js';
import { alephMock } from '../e2e/aleph-mock.js';
import { alephPrivateKey, deriveBytes, LABELS, newMasterSecret } from '../src/lib/keys/derive.js';
import { newSeedPhrase, seal, sealingKeyFromSeedPhrase } from '../src/lib/keys/seal.js';
import { seedIndexAccount, VAULT_KEY } from '../src/lib/keys/index-keys.js';
import { PROFILE_KEY } from '../src/lib/profile.js';
import { SCREENSHOT_SIZES, screenshotFile } from '../src/lib/web-manifest.js';

const OUT = process.env.SCREENS_DIR || 'test-results/screens';
const HOST = 'vm.example.test:24000';
const LAUNCH = '2a'.repeat(48);
const STATUS = { v: 2, phase: 'ready', paperless: true, backupRequest: null };
const LOCALES = { de: 'de-DE', en: 'en-GB' };

/** A vault set up and with a backup, its VM running or not, opened in /app/ in `lang`. */
async function openApp(page, lang, { running = true } = {}) {
	const piece = await calculate(new Uint8Array(4096).fill(9));
	const aggregates = await alephMock()(page.context());
	const master = newMasterSecret();
	const phrase = newSeedPhrase();
	aggregates.set(seedIndexAccount(phrase).address, { [VAULT_KEY]: { v: 1, box: await seal(master, sealingKeyFromSeedPhrase(phrase), 'master/seed') } });
	const profile = {
		network: 'calibration',
		role: 'test',
		payer: PAYER,
		rootfsItemHash: 'e'.repeat(64),
		crnHash: 'd'.repeat(64),
		luksPassphrase: 'made-up-passphrase',
		appPays: true,
		backupConfig: { copies: 2, providerIds: [9, 2], regions: [] },
		ageIdentity: 'AGE-SECRET-KEY-1' + 'Q'.repeat(58),
		ownBackups: [piece.toString()],
		vaultBackups: [piece.toString()],
		lastGoodBackup: { at: new Date(Date.now() - 50 * 60_000).toISOString(), copies: 2, pieceCid: piece.toString() }
	};
	if (running)
		profile.running = {
			instanceHash: 'c'.repeat(64),
			crnHash: 'd'.repeat(64),
			host: HOST,
			payer: '0x00000000000000000000000000000000000000bb',
			trustedExecution: { mode: 'sev_snp', policy: 196608, runtime: 'made-up', measurements: [{ platform: 'sev_snp', registers: { launch: LAUNCH } }] },
			dataDisk: 'encrypted',
			attestation: { measurement: LAUNCH, policy: '0x30000', launchTcb: { bootloader: 4, tee: 0, snp: 22, microcode: 213 }, at: Date.now() - 20 * 60_000, relay: { host: 'relay.example.test', own: false } }
		};
	const sealed = await seal(new TextEncoder().encode(JSON.stringify(profile)), deriveBytes(master, LABELS.profileKey), 'profile');
	aggregates.set(privateKeyToAccount(alephPrivateKey(master)).address, { [PROFILE_KEY]: { v: 1, box: sealed } });
	await page.context().route(/^https?:\/\/(?!localhost|api2\.aleph\.im)/, (route) => route.abort());
	// Both made-up copies healthy (the e2e mock lets one of them miss two proofs).
	await page.context().route(calibration.rpcUrls.default.http[0], rpc({ ...answers(piece), provenPeriods: () => true }));
	// The two made-up providers answer for their copy: the lights can be green.
	await page.context().route(/https:\/\/sp(9|2)\.example\.com\/piece\//, (route) => route.fulfill({ status: 206, body: Buffer.alloc(1024, 1), headers: { 'access-control-allow-origin': '*' } }));
	await page.context().route(`https://${HOST}/anywhere/**`, (route) => route.fulfill({ json: STATUS, headers: { 'access-control-allow-origin': '*' } }));
	await page.addInitScript((l) => localStorage.setItem('paperless-lang', l), lang);
	await page.goto('/app/');
	await page.getByTestId('open-with-phrase').click();
	await page.locator('textarea').first().fill(phrase);
	await page.getByTestId('open-phrase').click();
	await expect(page.getByTestId('state')).toHaveText('unlocked');
}

/** Puts `locator` near the top of the window, with a little room above it. */
async function scrollTo(page, locator, room = 12) {
	await locator.evaluate((el, r) => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - r), room);
	await page.waitForTimeout(300);
}

/** @param {import('@playwright/test').Page} page */
async function shoot(page, name, form, lang) {
	await page.evaluate(() => document.fonts.ready);
	await page.mouse.move(0, 0);
	await page.screenshot({ path: `${OUT}/${screenshotFile({ name, form }, lang).replace(/^screenshots\//, '')}`, animations: 'disabled', caret: 'hide' });
}

for (const lang of /** @type {const} */ (['de', 'en'])) {
	for (const form of /** @type {const} */ (['narrow', 'wide'])) {
		test.describe(`${lang}, ${form}`, () => {
			test.use({ locale: LOCALES[lang], timezoneId: 'Europe/Berlin', viewport: SCREENSHOT_SIZES[form], deviceScaleFactor: 1, isMobile: form === 'narrow', hasTouch: form === 'narrow' });

			test('landing', async ({ page }) => {
				await page.context().route(/^https?:\/\/(?!localhost)/, (route) => route.abort());
				await page.goto(lang === 'en' ? '/en/' : '/');
				await expect(page.getByTestId('hero-title')).toBeVisible();
				await shoot(page, 'landing', form, lang);
			});

			test('running and evidence', async ({ page }) => {
				await openApp(page, lang);
				const panel = page.getByTestId('evidence').first();
				await expect(panel).toBeVisible({ timeout: 30_000 });
				await page.waitForTimeout(1500);
				await shoot(page, 'running', form, lang);

				await panel.locator('summary').click();
				await expect(panel.getByTestId('evidence-attestation')).toBeVisible();
				await scrollTo(page, panel);
				await shoot(page, 'evidence', form, lang);
			});

			test('backups', async ({ page }) => {
				await openApp(page, lang, { running: false });
				const chain = page.getByTestId('backup-chain').first();
				await expect(chain).toHaveAttribute('data-state', 'app', { timeout: 30_000 });
				await chain.locator('summary').click();
				await expect(chain.getByTestId('chain-copy-500')).toBeVisible();
				// From the start button: what a start restores, and where its copies lie.
				await scrollTo(page, page.getByTestId('start'), 24);
				await shoot(page, 'backups', form, lang);
			});
		});
	}
}
