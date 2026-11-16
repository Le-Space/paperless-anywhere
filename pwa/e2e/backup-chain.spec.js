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

async function vault(aggregates, pieceCid) {
	const master = newMasterSecret();
	const phrase = newSeedPhrase();
	const box = await seal(master, sealingKeyFromSeedPhrase(phrase), 'master/seed');
	aggregates.set(seedIndexAccount(phrase).address, { [VAULT_KEY]: { v: 1, box } });
	const profile = {
		network: 'calibration', role: 'test', payer: PAYER, backupConfig: { copies: 2, providerIds: [9, 2], regions: [] },
		ageIdentity: 'AGE-SECRET-KEY-1' + 'Q'.repeat(58), ownBackups: [pieceCid]
	};
	const sealed = await seal(new TextEncoder().encode(JSON.stringify(profile)), deriveBytes(master, LABELS.profileKey), 'profile');
	aggregates.set(privateKeyToAccount(alephPrivateKey(master)).address, { [PROFILE_KEY]: { v: 1, box: sealed } });
	return phrase;
}

test.describe('German', () => {
	test.use({ locale: 'de-DE', timezoneId: 'Europe/Berlin' });

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
});
