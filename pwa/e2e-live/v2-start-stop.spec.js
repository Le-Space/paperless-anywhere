// The v0.2 interface starts a confidential Paperless and stops it again, as a
// person would: the same round as start-stop.spec.js does in /app/, with the
// same test wallet, test image, node and relay. The setup is done in
// "Technisch" under "System"; the start and the stop are pressed in
// "Standard", which is the view the round has to hold in. No backups and no
// restore (an empty Paperless), and the test image, not an image of one's own:
// the first-start journey is not part of this round.
//
// Controls are found by test id where they have one, so a changed wording does
// not stop a round that costs VM time.
import { expect, test } from '@playwright/test';
import { privateKeyToAccount } from 'viem/accounts';

const env = (name) => {
	const v = process.env[name]?.trim();
	if (!v) throw new Error(`set ${name}`);
	return v;
};
const raw = env('PAYER_KEY');
const payer = privateKeyToAccount(raw.startsWith('0x') ? raw : `0x${raw}`);
const seconds = (since) => Math.round((Date.now() - since) / 1000);

test('start and stop a confidential Paperless from the v0.2 interface', async ({ page }) => {
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
	// v0.2 asks in its own dialog; a dialog of the browser would hang the round unseen.
	page.on('dialog', (d) => {
		console.log(`[browser dialog] ${d.message().slice(0, 200)}`);
		void d.dismiss();
	});

	const view = (name) => page.getByRole('banner').getByTestId(`view-${name}`).click();
	const area = (name) => page.getByTestId(`v2-area-${name}`).click();
	/** A section of the setup, opened if it is folded. */
	const step = async (name) => {
		const section = page.getByTestId(`step-${name}`);
		await expect(section).toBeVisible({ timeout: 60_000 });
		if (!(await section.evaluate((d) => d.open))) await section.locator('summary').first().click();
		return section;
	};

	// A new vault: passkey, the 24 words, three of them asked back.
	await page.goto('/v0.2/');
	await expect(page.getByTestId('v2-state')).toHaveText('new', { timeout: 60_000 });
	await page.getByTestId('v2-key-loss-ok').check();
	await page.getByTestId('v2-create').click();
	await expect(page.getByTestId('v2-phrase').locator('li')).toHaveCount(24, { timeout: 60_000 });
	const words = await page.getByTestId('v2-phrase').locator('li').allTextContents();
	await page.getByTestId('v2-written').click();
	const asked = page.locator('input[data-testid^="v2-confirm-"]');
	await expect(asked).toHaveCount(3);
	for (const [i, position] of (await asked.evaluateAll((inputs) => inputs.map((x) => Number(x.dataset.testid.split('-')[2])))).entries()) {
		await asked.nth(i).fill(words[position - 1]);
	}
	await page.getByTestId('v2-confirmed').click();
	await expect(page.getByTestId('v2-state')).toHaveText('unlocked', { timeout: 60_000 });

	// The setup, in "Technisch" under "System": the wallet pays, the app's key may act for it.
	await view('technical');
	await area('system');
	const pays = await step('pays');
	if (await pays.getByTestId('pays-wallet').count()) await pays.getByTestId('pays-wallet').check();
	await pays.getByRole('button', { name: 'Wallet verbinden' }).click();
	await expect(page.getByTestId('payer')).toHaveText(payer.address, { timeout: 60_000 });
	const aleph = await step('aleph');
	// The section's own button (the address beside it has one for copying).
	await aleph.locator(':scope > button').click();
	await expect(page.getByTestId('aleph-status')).toHaveText(/^freigegeben/, { timeout: 60_000 });

	// The relay of this run, then the test image, its node and its passphrase.
	const relay = await step('relay');
	await relay.getByTestId('relays').fill(env('RELAY_URL'));
	await relay.locator(':scope > button').click();
	await expect(page.getByTestId('saved-relay')).toBeVisible({ timeout: 60_000 });
	const image = await step('image');
	if (await image.getByTestId('image-public').count()) await image.getByTestId('image-public').check();
	await image.getByTestId('image-hash').fill(env('ROOTFS_ITEM_HASH'));
	await image.getByPlaceholder('SEV-SNP-Knoten (Hash)').fill(env('CRN_HASH'));
	await image.getByTestId('image-passphrase').fill(env('LUKS_PASSPHRASE'));
	await image.getByRole('button', { name: 'Image und Knoten speichern' }).click();
	await expect(page.getByTestId('saved-image')).toBeVisible({ timeout: 60_000 });

	// The start, pressed in "Standard".
	await view('standard');
	await area('start');
	const startButton = page.getByTestId('v2-start-button');
	await expect(startButton).toBeEnabled({ timeout: 60_000 });
	const started = Date.now();
	await startButton.click();
	const open = page.getByTestId('v2-open');
	const failed = page.getByTestId('start-error');
	// Print what the page says as it comes.
	let last = '';
	while (!(await open.isVisible())) {
		if (await failed.isVisible()) throw new Error(`start failed: ${await failed.textContent()}`);
		if (await page.getByTestId('v2-resume').isVisible()) throw new Error('the start was interrupted');
		const now = [await page.getByTestId('v2-progress').textContent().catch(() => ''), await page.getByTestId('progress').textContent().catch(() => '')].filter(Boolean).join(' | ');
		if (now && now !== last) console.log(`[start ${seconds(started)} s] ${now.replace(/\s+/g, ' ').slice(0, 300)}`);
		last = now;
		if (Date.now() - started > 40 * 60_000) throw new Error('start took longer than 40 minutes');
		await page.waitForTimeout(5_000);
	}
	const url = await open.getAttribute('href');
	console.log(`[start ${seconds(started)} s] Paperless at ${url}`);
	const answer = await fetch(`${url}api/`, { redirect: 'manual' });
	expect([200, 302, 401, 403]).toContain(answer.status);
	const status = await (await fetch(`${url}anywhere/status.json`)).json();
	expect(status.phase).toBe('ready');
	// "Standard" shows how to sign in; the address in full is what "Technisch" adds.
	await expect(page.getByTestId('v2-login')).toBeVisible();
	await expect(page.getByTestId('v2-host')).toHaveCount(0);

	// The stop, pressed in "Standard": erased on the node, forgotten on Aleph.
	const stopping = Date.now();
	await page.getByTestId('v2-stop').click();
	await expect(startButton).toBeVisible({ timeout: 30 * 60_000 });
	await expect(failed).toHaveCount(0);
	await expect(page.getByTestId('stop-partial')).toHaveCount(0);
	await expect(page.getByTestId('v2-stray')).toHaveCount(0);
	console.log(`[stop ${seconds(stopping)} s] stopped and forgotten`);

	// Take the authorization back.
	await view('technical');
	await area('system');
	await (await step('aleph')).locator(':scope > button').click();
	await expect(page.getByTestId('aleph-status')).toHaveText('nicht freigegeben', { timeout: 60_000 });
});
