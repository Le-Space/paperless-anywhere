// An interrupted start on a node Le Space blocked (it reports SEV-SNP but
// cannot run it): "Start fortsetzen" forgets that VM, says so plainly, and
// asks for another node, never the blocked one. The vault, its sealed profile
// and every instance hash are made up; node hashes are public.
import { expect, test } from '@playwright/test';
import { privateKeyToAccount } from 'viem/accounts';
import { alephMock } from './aleph-mock.js';
import { alephPrivateKey, deriveBytes, LABELS, newMasterSecret } from '../src/lib/keys/derive.js';
import { newSeedPhrase, seal, sealingKeyFromSeedPhrase, unseal } from '../src/lib/keys/seal.js';
import { seedIndexAccount, VAULT_KEY } from '../src/lib/keys/index-keys.js';
import { PROFILE_KEY } from '../src/lib/profile.js';

const INSTANCE = 'c'.repeat(64);
const LEVIATHAN_CRN11 = '6f3d9f424fa8d9362a0584097a02b864638451c7acad7badccf657850477039b';

test.use({ locale: 'de-DE' });

test('a start on the blocked node is forgotten, and the blocked node is not picked again', async ({ page }) => {
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
		starting: { instanceHash: INSTANCE, crnHash: LEVIATHAN_CRN11, payer: '0x00000000000000000000000000000000000000bb', trustedExecution: {}, restoreEntry: null, at: Date.parse('2026-11-16T06:00:00Z') }
	};
	const profileKey = deriveBytes(master, LABELS.profileKey);
	const app = privateKeyToAccount(alephPrivateKey(master)).address;
	aggregates.set(app, { [PROFILE_KEY]: { v: 1, box: await seal(new TextEncoder().encode(JSON.stringify(profile)), profileKey, 'profile') } });

	// The FORGET of the refused VM is recorded; everything else goes to the mock.
	/** @type {string[][]} */
	const forgotten = [];
	await page.context().route(/^https?:\/\/(?!localhost|api2\.aleph\.im)/, (route) => route.abort());
	await page.context().route('https://api2.aleph.im/api/v0/messages', async (route) => {
		const { message } = route.request().postDataJSON();
		if (message.type !== 'FORGET') return route.fallback();
		forgotten.push(JSON.parse(message.item_content).hashes);
		await route.fulfill({ json: { publication_status: { status: 'success', failed: [] }, message_status: 'processed' } });
	});
	// Aleph's node list offers only the blocked node, claiming confidential support.
	const usage = { cpu: { count: 32, load_average: { load1: 0 } }, mem: { available_kB: 128 * 1024 ** 2 }, disk: { available_kB: 2000 * 1024 ** 2 }, active: true };
	await page.context().route(/https:\/\/crns-list\.aleph\.sh\/.*/, (route) =>
		route.fulfill({ json: { crns: [{ hash: LEVIATHAN_CRN11, name: 'Leviathan CRN11', score: 0.99, confidential_support: true, system_usage: usage }] } })
	);

	await page.goto('/app/');
	await page.getByTestId('open-with-phrase').click();
	await page.locator('textarea').first().fill(phrase);
	await page.getByTestId('open-phrase').click();
	await page.getByTestId('simple-resume').click();

	await expect(page.getByTestId('node-refused')).toHaveText('Dieser Knoten kann trotz Angabe keine vertraulichen VMs. Die App versucht einen anderen.');
	// No other node has room: said, and the blocked one was not asked again.
	await expect(page.locator('[role="alert"]')).toContainText('kein vertraulicher Knoten Platz');
	expect(forgotten).toEqual([[INSTANCE]]);
	await expect(page.getByTestId('simple-resume')).toHaveCount(0);

	// The profile no longer carries the start, and notes the node with the time.
	const saved = await unseal(aggregates.get(app)[PROFILE_KEY].box, profileKey, 'profile');
	const now = JSON.parse(new TextDecoder().decode(saved));
	expect(now.starting).toBeUndefined();
	expect(now.unsuitableNodes).toEqual([{ hash: LEVIATHAN_CRN11, reason: 'noSevSnp', at: expect.any(Number) }]);
});
