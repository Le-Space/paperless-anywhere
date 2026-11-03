// The PWA starts a confidential Paperless and stops it again, as a person
// would: a passkey (virtual, with PRF), a paying wallet (the test wallet,
// injected as window.ethereum), the real Aleph, a real SEV-SNP node and an
// attest relay beside the test. No backups and no restore here (made-up
// nothing, empty Paperless); those have their own round trip (roundtrip.yml).
import { expect, test } from '@playwright/test';
import { privateKeyToAccount } from 'viem/accounts';

const env = (name) => {
	const v = process.env[name]?.trim();
	if (!v) throw new Error(`set ${name}`);
	return v;
};
const raw = env('PAYER_KEY');
const payer = privateKeyToAccount(raw.startsWith('0x') ? raw : `0x${raw}`);

test('start and stop a confidential Paperless from the PWA', async ({ page }) => {
	await page.context().exposeBinding('__wallet', async (_s, { method, params }) => {
		if (method === 'eth_requestAccounts' || method === 'eth_accounts') return [payer.address];
		if (method === 'personal_sign') return payer.signMessage({ message: { raw: params[0] } });
		throw new Error(`unsupported ${method}`);
	});
	await page.context().addInitScript(() => {
		window.ethereum = { request: (r) => window.__wallet(r), on() {}, removeListener() {} };
	});
	const cdp = await page.context().newCDPSession(page);
	await cdp.send('WebAuthn.enable');
	await cdp.send('WebAuthn.addVirtualAuthenticator', {
		options: { protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, hasPrf: true }
	});
	page.on('console', (m) => /error|warn/i.test(m.type()) && console.log(`[browser ${m.type()}] ${m.text().slice(0, 300)}`));

	await page.goto('/');
	await page.getByRole('button', { name: 'Passkey anlegen' }).click();
	await expect(page.getByTestId('phrase').locator('li')).toHaveCount(24, { timeout: 60_000 });
	const words = await page.getByTestId('phrase').locator('li').allTextContents();
	await page.getByRole('button', { name: 'Aufgeschrieben' }).click();
	const asked = page.locator('[data-testid^="confirm-"]');
	await expect(asked).toHaveCount(3);
	for (const [i, position] of (await asked.evaluateAll((inputs) => inputs.map((x) => Number(x.dataset.testid.split('-')[1])))).entries()) {
		await asked.nth(i).fill(words[position - 1]);
	}
	await page.getByRole('button', { name: 'Stimmt' }).click();
	// The settings, the step list and "Sichern und stoppen" live under "Erweitert".
	await page.getByTestId('tab-advanced').click();

	await page.getByRole('button', { name: 'Wallet verbinden' }).click();
	await expect(page.getByTestId('payer')).toHaveText(payer.address, { timeout: 60_000 });
	await page.getByRole('button', { name: 'Im Wallet freigeben' }).click();
	await expect(page.getByTestId('aleph-status')).toHaveText(/^freigegeben/, { timeout: 60_000 });

	await page.getByPlaceholder('wss://dein-relay.example/attest').fill(env('RELAY_URL'));
	await page.getByRole('button', { name: 'Relay speichern' }).click();
	await page.getByPlaceholder('Image (STORE-Hash)').fill(env('ROOTFS_ITEM_HASH'));
	await page.getByPlaceholder('SEV-SNP-Knoten (Hash)').fill(env('CRN_HASH'));
	await page.getByPlaceholder('Passphrase des Images').fill(env('LUKS_PASSPHRASE'));
	await page.getByRole('button', { name: 'Image und Knoten speichern' }).click();
	await expect(page.getByRole('button', { name: 'Paperless starten' })).toBeEnabled({ timeout: 60_000 });

	const started = Date.now();
	await page.getByRole('button', { name: 'Paperless starten' }).click();
	const progress = page.getByTestId('progress');
	const link = page.getByTestId('paperless-link');
	// Print the steps as they come.
	let last = '';
	while (!(await link.isVisible())) {
		const alert = page.getByRole('alert');
		if (await alert.isVisible()) throw new Error(`start failed: ${await alert.textContent()}`);
		const now = (await progress.textContent().catch(() => '')) ?? '';
		if (now && now !== last) console.log(`[start ${Math.round((Date.now() - started) / 1000)} s] ${now}`);
		last = now;
		if (Date.now() - started > 40 * 60_000) throw new Error('start took longer than 40 minutes');
		await page.waitForTimeout(5_000);
	}
	const host = (await link.textContent())?.trim();
	console.log(`[start ${Math.round((Date.now() - started) / 1000)} s] Paperless at https://${host}/`);
	const answer = await fetch(`https://${host}/api/`, { redirect: 'manual' });
	expect([200, 302, 401, 403]).toContain(answer.status);
	const status = await (await fetch(`https://${host}/anywhere/status.json`)).json();
	expect(status.phase).toBe('ready');

	const stopping = Date.now();
	await page.getByRole('button', { name: 'Sichern und stoppen' }).click();
	await expect(page.getByRole('button', { name: 'Paperless starten' })).toBeVisible({ timeout: 30 * 60_000 });
	await expect(page.getByRole('alert')).toHaveCount(0);
	console.log(`[stop ${Math.round((Date.now() - stopping) / 1000)} s] stopped and forgotten`);

	await page.getByRole('button', { name: 'Freigabe zurücknehmen' }).click();
	await expect(page.getByTestId('aleph-status')).toHaveText('nicht freigegeben', { timeout: 60_000 });
});
