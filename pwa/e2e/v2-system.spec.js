// The areas "System" and "Mehr" of the v0.2 interface, and the alert for a VM
// that no card knows. The vault, its sealed profile and every hash here are
// made up and put into the Aleph mock; nothing leaves the test.
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { privateKeyToAccount } from 'viem/accounts';
import { alephMock } from './aleph-mock.js';
import { alephPrivateKey, deriveBytes, LABELS, newMasterSecret } from '../src/lib/keys/derive.js';
import { newSeedPhrase, seal, sealingKeyFromSeedPhrase } from '../src/lib/keys/seal.js';
import { seedIndexAccount, VAULT_KEY } from '../src/lib/keys/index-keys.js';
import { PROFILE_KEY } from '../src/lib/profile.js';

test.use({ locale: 'de-DE' });

/** Opens /v0.2/ with a vault whose sealed profile is `profile`; `vms` are INSTANCE messages Aleph lists for the app key. */
async function open(page, profile, vms = () => []) {
	const aggregates = await alephMock()(page.context());
	const master = newMasterSecret();
	const phrase = newSeedPhrase();
	const app = privateKeyToAccount(alephPrivateKey(master)).address;
	aggregates.set(seedIndexAccount(phrase).address, { [VAULT_KEY]: { v: 1, box: await seal(master, sealingKeyFromSeedPhrase(phrase), 'master/seed') } });
	const sealed = await seal(new TextEncoder().encode(JSON.stringify(profile)), deriveBytes(master, LABELS.profileKey), 'profile');
	aggregates.set(app, { [PROFILE_KEY]: { v: 1, box: sealed } });
	await page.context().route(/^https?:\/\/(?!localhost|api2\.aleph\.im)/, (route) => route.abort());
	await page.context().route(/https:\/\/api2\.aleph\.im\/api\/v0\/messages\.json.*/, (route) => route.fulfill({ json: { messages: vms(app) } }));
	await page.goto('/v0.2/');
	await page.getByTestId('v2-have-vault').click();
	await page.getByTestId('v2-words').fill(phrase);
	await page.getByTestId('v2-open-words').click();
	await expect(page.getByTestId('v2-state')).toHaveText('unlocked');
	return { phrase, app };
}
const technical = (page) => page.getByRole('banner').getByTestId('view-technical').click();
async function accessible(page, what) {
	const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
	expect(violations.filter((v) => ['serious', 'critical'].includes(v.impact ?? '')).map((v) => `${what}: ${v.id} (${v.nodes.map((n) => n.target.join(' ')).join('; ')})`)).toEqual([]);
}

test('System: one overview with the shell\'s and the setup\'s rows, the sections directly under it, and a dialog before this instance becomes productive', async ({ page }) => {
	await open(page, { network: 'calibration', role: 'test' });
	await technical(page);
	await page.getByTestId('v2-area-system').click();
	const overview = page.getByTestId('setup-overview');
	await expect(overview).toBeVisible({ timeout: 30_000 });
	// One list called "Auf einen Blick", not two.
	await expect(page.getByText('Auf einen Blick', { exact: true })).toHaveCount(1);
	// The shell's rows lead to their areas; the setup's rows to their sections.
	await expect(overview.getByTestId('overview-paperless')).toContainText('aus');
	await expect(overview.getByTestId('overview-pays')).toBeVisible();
	// The sections are not inside another fold: the first one that is not done is open.
	await expect(page.getByTestId('step-pays')).toHaveAttribute('open', '');
	await expect(page.getByTestId('setup-where')).toBeVisible();
	await accessible(page, 'System');

	// Making this instance productive asks in the app's own dialog; "Abbrechen" keeps it a test.
	await page.getByTestId('role-primary').click();
	const dialog = page.getByTestId('v2-confirm');
	await expect(dialog).toContainText('produktiv');
	await page.getByTestId('v2-confirm-no').click();
	await expect(page.getByTestId('role-test')).toBeChecked();
	await expect(page.getByTestId('role-warning')).toHaveCount(0);
	// A row of the overview leads where it says.
	await overview.getByTestId('overview-paperless').getByRole('button').click();
	await expect(page.getByTestId('v2-status')).toBeVisible();
});

test('a VM that no card knows is said on Start in both views, with the way to it; deleting it asks in a dialog', async ({ page }) => {
	const stray = (app) => [{ item_hash: 'f'.repeat(64), sender: app, time: Date.now() / 1000 - 3600, content: { address: app, metadata: { name: 'paperless-made-up' }, requirements: { node: { node_hash: 'd'.repeat(64) } } } }];
	await open(page, { network: 'calibration', role: 'test', appPays: true }, stray);
	// Standard: it costs running time, and one button leads to it.
	const alert = page.getByTestId('v2-stray');
	await expect(alert).toBeVisible({ timeout: 30_000 });
	await expect(alert).toContainText('Es läuft eine Maschine, die diese App nicht als gestartet kennt.');
	await expect(alert).toContainText('kostet Laufzeit');
	await page.getByTestId('v2-stray-open').click();
	await expect(page.getByRole('banner').getByTestId('view-technical')).toHaveAttribute('aria-pressed', 'true');
	await expect(page.getByRole('heading', { level: 1, name: 'System' })).toBeFocused();
	const vms = page.getByTestId('v2-vms');
	await expect(vms).toHaveAttribute('open', '');
	await expect(vms).toContainText('paperless-made-up');
	// "Löschen" asks in the app's dialog, not the browser's; "Abbrechen" deletes nothing.
	let browserDialog = false;
	page.on('dialog', (d) => { browserDialog = true; d.dismiss(); });
	await vms.getByRole('button', { name: 'Löschen' }).click();
	await expect(page.getByTestId('v2-confirm')).toContainText('paperless-made-up');
	await page.getByTestId('v2-confirm-no').click();
	await expect(vms).toContainText('paperless-made-up');
	expect(browserDialog).toBe(false);
});

test('Mehr: the app\'s address with a copy button in the technical view only, a footer without commit in Standard, and "Diesen Browser vergessen" behind a dialog', async ({ page }) => {
	const { app } = await open(page, { network: 'calibration', role: 'test' });
	await page.getByTestId('v2-area-more').click();
	// Standard: no address, no commit.
	await expect(page.getByTestId('v2-address')).toHaveCount(0);
	const footer = page.getByTestId('build-info');
	await expect(footer.getByTestId('build-version')).toBeVisible();
	await expect(footer.locator('code')).toHaveCount(0);
	await accessible(page, 'Mehr, Standard');
	// Technisch: the address once, with "Kopieren", and the commit.
	await technical(page);
	await expect(page.getByTestId('v2-address')).toHaveText(app);
	await expect(page.getByTestId('v2-address').locator('..').getByRole('button')).toHaveText('Kopieren');
	await expect(footer.locator('code').first()).toHaveText(/^[0-9a-f]{7}$/);
	// Forgetting this browser is here too, and asks first.
	await page.getByTestId('v2-forget-here').click();
	await expect(page.getByTestId('v2-confirm')).toContainText('Diesen Browser vergessen?');
	await page.keyboard.press('Escape');
	await expect(page.getByTestId('v2-state')).toHaveText('unlocked');
	await page.getByTestId('v2-forget-here').click();
	await page.getByTestId('v2-confirm-yes').click();
	await expect(page.getByTestId('v2-state')).toHaveText('new');
	expect(await page.evaluate(() => localStorage.getItem('paperless-anywhere.vault'))).toBeNull();
});
