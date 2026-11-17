// The backup list shows, per copy, what the Filecoin chain says, read by the
// app itself. The chain is a mocked RPC node here: made-up data sets,
// providers, pieces and payer, answered from a table of contract calls.
// Nothing leaves the test.
import { expect, test } from '@playwright/test';
import { privateKeyToAccount } from 'viem/accounts';
import { calibration } from '@filoz/synapse-core/chains';
import { calculate } from '@filoz/synapse-core/piece';
import { answers, NOW, PAYER, rpc } from './chain-mock.js';
import { alephMock } from './aleph-mock.js';
import { alephPrivateKey, deriveBytes, LABELS, newMasterSecret } from '../src/lib/keys/derive.js';
import { newSeedPhrase, seal, sealingKeyFromSeedPhrase } from '../src/lib/keys/seal.js';
import { seedIndexAccount, VAULT_KEY } from '../src/lib/keys/index-keys.js';
import { PROFILE_KEY } from '../src/lib/profile.js';

async function vault(aggregates, pieceCid, extra = {}) {
	const master = newMasterSecret();
	const phrase = newSeedPhrase();
	const box = await seal(master, sealingKeyFromSeedPhrase(phrase), 'master/seed');
	aggregates.set(seedIndexAccount(phrase).address, { [VAULT_KEY]: { v: 1, box } });
	const profile = {
		network: 'calibration', role: 'test', payer: PAYER, backupConfig: { copies: 2, providerIds: [9, 2], regions: [] },
		ageIdentity: 'AGE-SECRET-KEY-1' + 'Q'.repeat(58), ownBackups: [pieceCid], ...extra
	};
	const sealed = await seal(new TextEncoder().encode(JSON.stringify(profile)), deriveBytes(master, LABELS.profileKey), 'profile');
	aggregates.set(privateKeyToAccount(alephPrivateKey(master)).address, { [PROFILE_KEY]: { v: 1, box: sealed } });
	return phrase;
}

test.describe('German', () => {
	test.use({ locale: 'de-DE', timezoneId: 'Europe/Berlin' });

	test('v0.2: "Standard" picks a backup from a plain list without ids; "Technisch" shows the same choice with its id and seal', async ({ page }) => {
		test.setTimeout(90_000);
		const piece = await calculate(new Uint8Array(4096).fill(9));
		const cid = piece.toString();
		const aggregates = await alephMock()(page.context());
		// Set up far enough for a start, so the start's choice shows.
		const phrase = await vault(aggregates, cid, { rootfsItemHash: 'e'.repeat(64), crnHash: 'd'.repeat(64), luksPassphrase: 'made-up-passphrase', appPays: true });
		await page.context().route(/^https?:\/\/(?!localhost|api2\.aleph\.im)/, (route) => route.abort());
		await page.context().route(calibration.rpcUrls.default.http[0], rpc(answers(piece)));
		await page.goto('/v0.2/');
		await page.getByTestId('v2-have-vault').click();
		await page.getByTestId('v2-words').fill(phrase);
		await page.getByTestId('v2-open-words').click();
		await expect(page.getByTestId('v2-starts-with')).toBeVisible({ timeout: 30_000 });

		// Standard: the list is one button away and names age, size and copies, never an id.
		await expect(page.getByTestId('v2-backup-list')).toHaveCount(0);
		await page.getByTestId('v2-other-backup').click();
		const row = page.getByTestId('v2-backup-list').locator('label').first();
		await expect(row).toContainText('Neueste');
		await expect(row).toContainText('Herkunft nicht bestätigt');
		await expect(page.getByTestId('v2-start')).not.toContainText(cid.slice(-12));
		// With one backup in the list it is the one chosen already, and the list says so.
		await expect(page.getByTestId('v2-backup-pick-0')).toBeChecked();
		// A backup without the vault's mark asks before it is restored, in plain words; the start waits for the answer.
		await expect(page.getByTestId('restore-unmarked')).toContainText('Die App kann nicht bestätigen');
		await expect(page.getByTestId('v2-start-button')).toBeDisabled();
		await page.getByTestId('restore-unmarked-accept').check();
		await expect(page.getByTestId('v2-start-button')).toBeEnabled();

		// Technisch: "Eine bestimmte Sicherung wählen" lists the same backups with the id's ending and the seal.
		await page.getByRole('banner').getByTestId('view-technical').click();
		await expect(page.getByTestId('backup-pick-list')).toHaveCount(0);
		await page.getByTestId('restore-pick').check();
		const picks = page.getByTestId('backup-pick-list');
		await expect(picks).toContainText(cid.slice(-12));
		await expect(picks).toContainText('ohne Siegel');
		await page.getByTestId('backup-pick-0').check();
		await expect(page.getByTestId('v2-starts-with-tech')).toContainText(cid.slice(-12));
		// The same backup as accepted before: the start stays possible.
		await expect(page.getByTestId('v2-start-button')).toBeEnabled();
		// Back in Standard the choice is the same, and it holds while the page stays open.
		await page.getByRole('banner').getByTestId('view-standard').click();
		await expect(page.getByTestId('v2-backup-pick-0')).toBeChecked();
		await page.getByRole('banner').getByTestId('view-technical').click();
		await expect(page.getByTestId('restore-pick')).toBeChecked();
	});

	test('each copy shows what the chain says, green only for what the app read; "Jetzt prüfen" adds a blue sample', async ({ page }) => {
		test.setTimeout(90_000);
		const piece = await calculate(new Uint8Array(4096).fill(9));
		const aggregates = await alephMock()(page.context());
		const phrase = await vault(aggregates, piece.toString());
		await page.context().route(/^https?:\/\/(?!localhost|api2\.aleph\.im)/, (route) => route.abort());
		await page.context().route(calibration.rpcUrls.default.http[0], rpc(answers(piece)));
		await page.context().route(/https:\/\/sp(9|2)\.example\.com\/piece\//, (route) => route.fulfill({ status: 206, body: Buffer.alloc(1024, 1), headers: { 'access-control-allow-origin': '*' } }));

		await page.goto('/app/');
		await page.getByTestId('open-with-phrase').click();
		await page.locator('textarea').first().fill(phrase);
		await page.getByTestId('open-phrase').click();

		const chain = page.getByTestId('backup-chain').first();
		await expect(chain).toHaveAttribute('data-state', 'failed', { timeout: 30_000 });
		await chain.locator('summary').click();
		await expect(chain).toContainText('Was die Chain sagt');

		const good = chain.getByTestId('chain-copy-500');
		await expect(good).toHaveAttribute('data-state', 'app');
		await expect(good).toContainText('Kopie bei Anbieter 9 (DE, Musterstadt) · Datensatz 500');
		for (const id of ['dataSet', 'lastProof', 'nextChallenge', 'faults', 'paid']) await expect(good.getByTestId(`chain-${id}`)).toHaveAttribute('data-state', 'app');
		await expect(good.getByTestId('chain-faults')).toContainText('keine in den letzten 20 Beweisperioden');
		await expect(good.getByTestId('chain-lastProof')).toContainText(`Epoche ${NOW - 100n}`);

		const bad = chain.getByTestId('chain-copy-501');
		await expect(bad).toHaveAttribute('data-state', 'failed');
		await expect(bad.getByTestId('chain-faults')).toContainText('2 von 20 Beweisperioden ohne Beweis');

		await expect(chain.getByTestId('chain-explorer-500')).toHaveAttribute('href', 'https://pdp.filecoin.cloud/calibration/dataset/500');
		await expect(chain.getByTestId('chain-pieces').locator('a')).toHaveAttribute('href', `https://pdp.filecoin.cloud/calibration/piece/${piece.toString()}`);
		await expect(chain.getByTestId('chain-more')).toHaveAttribute('href', /docs\/backup-proofs\.md$/);
		// The provider is asked only on the button, and what it sends is blue, never green.
		await expect(good.getByTestId('chain-sample')).toHaveCount(0);
		await chain.getByTestId('chain-check').click();
		await expect(good.getByTestId('chain-sample')).toHaveAttribute('data-state', 'reported');
		await expect(good.getByTestId('chain-sample')).toContainText('vom Anbieter gemeldet');
		await page.screenshot({ path: test.info().outputPath('backup-chain.png'), fullPage: true });
	});

	/** Opens the app on a vault whose profile adds `extra`, with the chain mocked. */
	async function openWith(page, extra) {
		const piece = await calculate(new Uint8Array(4096).fill(9));
		const aggregates = await alephMock()(page.context());
		const phrase = await vault(aggregates, piece.toString(), extra(piece.toString()));
		await page.context().route(/^https?:\/\/(?!localhost|api2\.aleph\.im)/, (route) => route.abort());
		await page.context().route(calibration.rpcUrls.default.http[0], rpc(answers(piece)));
		await page.goto('/app/');
		await page.getByTestId('open-with-phrase').click();
		await page.locator('textarea').first().fill(phrase);
		await page.getByTestId('open-phrase').click();
		return piece.toString();
	}

	test('a backup without the vault’s mark is restored only after the person says so', async ({ page }) => {
		test.setTimeout(90_000);
		const piece = await openWith(page, () => ({}));
		await page.getByRole('tab', { name: 'Erweitert' }).click();
		const question = page.getByTestId('restore-unmarked').first();
		await expect(question).toContainText('trägt nicht das Siegel deines Tresors', { timeout: 30_000 });
		await expect(question).toContainText(piece.slice(-12));
		const accept = question.getByTestId('restore-unmarked-accept');
		await expect(accept).not.toBeChecked();
		await accept.check();
		await expect(accept).toBeChecked();
	});

	test('a backup with the vault’s mark starts without the question', async ({ page }) => {
		test.setTimeout(90_000);
		await openWith(page, (piece) => ({ vaultBackups: [piece] }));
		await page.getByRole('tab', { name: 'Erweitert' }).click();
		await expect(page.getByTestId('newest-backup')).toBeVisible({ timeout: 30_000 });
		await expect(page.getByTestId('restore-unmarked')).toHaveCount(0);
	});

	test('a tiny newest backup is said, with the sizes, and the one before it is chosen', async ({ page }) => {
		test.setTimeout(90_000);
		const { bytesToHex } = await import('viem');
		const big = await calculate(new Uint8Array(1 << 20).fill(7));
		const tiny = await calculate(new Uint8Array(8000).fill(3));
		const aggregates = await alephMock()(page.context());
		const phrase = await vault(aggregates, big.toString(), { ownBackups: [big.toString(), tiny.toString()], vaultBackups: [big.toString(), tiny.toString()] });
		await page.context().route(/^https?:\/\/(?!localhost|api2\.aleph\.im)/, (route) => route.abort());
		// The tiny one in the later data set: the newest.
		const table = { ...answers(big), getActivePiecesByCursor: (ds) => [[{ data: bytesToHex((ds === 500n ? big : tiny).bytes) }], [ds === 500n ? 3n : 5n], false] };
		await page.context().route(calibration.rpcUrls.default.http[0], rpc(table));
		const errors = [];
		page.on('pageerror', (e) => errors.push(e.message));
		await page.goto('/app/');
		await page.getByTestId('open-with-phrase').click();
		await page.locator('textarea').first().fill(phrase);
		await page.getByTestId('open-phrase').click();
		await page.getByRole('tab', { name: 'Erweitert' }).click();
		const warning = page.getByTestId('tiny-newest');
		await expect(warning).toBeVisible({ timeout: 30_000 });
		await expect(warning).toContainText(big.toString().slice(-12));
		expect(errors).toEqual([]);
	});
});
