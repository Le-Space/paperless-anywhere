// The area "Paket" of the v0.2 interface (lib/v2/Plan.svelte), against the
// local mock of le-space-credits: the same flow control as the package card
// at /app/, one thing per card, and the three dead ends it closes.
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { alephMock } from '../e2e/aleph-mock.js';
import { newMasterSecret } from '../src/lib/keys/derive.js';
import { newSeedPhrase, seal, sealingKeyFromSeedPhrase } from '../src/lib/keys/seal.js';
import { seedIndexAccount, VAULT_KEY } from '../src/lib/keys/index-keys.js';

const MOCK = 'http://127.0.0.1:4422';

async function openPlan(page, state) {
	const aggregates = await alephMock()(page.context());
	const master = newMasterSecret();
	const phrase = newSeedPhrase();
	aggregates.set(seedIndexAccount(phrase).address, { [VAULT_KEY]: { v: 1, box: await seal(master, sealingKeyFromSeedPhrase(phrase), 'master/seed') } });
	await page.context().route(/^https?:\/\/(?!localhost|127\.0\.0\.1|api2\.aleph\.im)/, (route) => route.abort());
	await fetch(`${MOCK}/__state`, { method: 'POST', body: JSON.stringify(state) });
	await page.goto('/v0.2/');
	await page.getByTestId('v2-have-vault').click();
	await page.getByTestId('v2-words').fill(phrase);
	await page.getByTestId('v2-open-words').click();
	await expect(page.getByTestId('v2-state')).toHaveText('unlocked');
	await page.getByTestId('v2-area-plan').click();
	await expect(page.getByRole('heading', { level: 1, name: 'Paket' })).toBeFocused();
}
const received = async (path) => (await (await fetch(`${MOCK}/__requests`)).json()).filter((r) => r.path === path);
async function accessible(page, what) {
	const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
	expect(violations.filter((v) => ['serious', 'critical'].includes(v.impact ?? '')).map((v) => `${what}: ${v.id} (${v.nodes.map((n) => n.target.join(' ')).join('; ')})`)).toEqual([]);
}

test.use({ locale: 'de-DE', timezoneId: 'Europe/Berlin' });
test.beforeEach(() => test.setTimeout(90_000));

test('v0.2 without a package: the state, the plans, the balance and topping up are each in sight; a voucher is redeemed', async ({ page }) => {
	await openPlan(page, { plan: false, backup: 'none', offered: true, included: true, vouchers: true });
	await expect(page.getByTestId('plan-none')).toHaveText('Noch kein Paket');
	await expect(page.getByTestId('v2-plan-choose').getByRole('heading', { level: 2 })).toHaveText('Paket wählen');
	await expect(page.getByTestId('plan-paperless-15-backup')).toBeVisible();
	await expect(page.getByTestId('balance-euro')).toHaveText('12,34 €');
	// Topping up is not inside a fold any more.
	await expect(page.getByTestId('topup')).toBeVisible();
	await accessible(page, 'Paket without a plan, Standard');
	// The same in "Technisch", plus who pays the VM and the way to change it.
	await expect(page.getByTestId('v2-tech-payer')).toHaveCount(0);
	await page.getByRole('banner').getByTestId('view-technical').click();
	await expect(page.getByTestId('plan-none')).toBeVisible();
	await expect(page.getByTestId('topup')).toBeVisible();
	await expect(page.getByTestId('v2-tech-payer')).toContainText('Wer die VM zahlt');
	await accessible(page, 'Paket without a plan, Technisch');
	await page.getByRole('banner').getByTestId('view-standard').click();

	await page.getByTestId('voucher').locator('summary').click();
	await page.getByTestId('voucher-code').fill('pa-abcd efgh-jklm');
	await page.getByTestId('voucher-redeem').click();
	await expect(page.getByTestId('plan-note')).toContainText('Gutschein eingelöst');
	expect((await received('/v1/voucher/redeem')).at(-1).body.code).toBe('PA-ABCD-EFGH-JKLM');
	await expect(page.getByTestId('plan-left')).toContainText('168 Stunden');
	await expect(page.getByTestId('voucher-period')).toBeVisible();
	// A voucher's period has nothing to change, end or cancel.
	await expect(page.getByTestId('plan-change')).toHaveCount(0);
	await expect(page.getByTestId('plan-cancel')).toHaveCount(0);
	// Nothing wider than a phone.
	await page.setViewportSize({ width: 360, height: 800 });
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

test('v0.2 with a subscription: the cancel button stays in sight, and leaving for Stripe asks first', async ({ page }) => {
	await openPlan(page, { plan: true });
	await expect(page.getByTestId('plan-left')).toContainText('Stunden');
	// § 312k BGB: in sight, no fold.
	await expect(page.getByTestId('plan-cancel')).toBeVisible();
	await expect(page.getByTestId('plan-cancel')).toHaveText('Verträge hier kündigen');
	// "Abo verwalten" goes to Stripe, which locks the app: asked in a dialog, and "Hier bleiben" asks nothing of the service.
	const before = (await received('/v1/portal')).length;
	await page.getByTestId('plan-portal').click();
	const dialog = page.getByTestId('v2-confirm');
	await expect(dialog).toContainText('Zu Stripe wechseln?');
	await expect(dialog).toContainText('sie wird gesperrt');
	await page.getByTestId('v2-confirm-no').click();
	await expect(page.getByTestId('v2-state')).toHaveText('unlocked');
	expect((await received('/v1/portal')).length).toBe(before);
	// The cancellation opens in place, with its legal text.
	await page.getByTestId('plan-cancel').click();
	await expect(page.getByTestId('v2-plan-state')).toContainText('kündigen');
	await accessible(page, 'Paket with a subscription');
});

test('v0.2: a balance that cannot be read has a retry and still a way to cancel', async ({ page }) => {
	// The service answers the balance with an error once the page is open.
	let down = true;
	await page.context().route(/127\.0\.0\.1:4422\/v1\/balance/, (route) => (down ? route.fulfill({ status: 500, json: { error: 'made up', code: 'DOWN' }, headers: { 'access-control-allow-origin': '*' } }) : route.fallback()));
	await openPlan(page, { plan: true });
	const box = page.getByTestId('v2-plan-unreadable');
	await expect(box).toBeVisible();
	await expect(page.getByTestId('v2-plan-cancel-by-mail')).toHaveAttribute('href', /^mailto:/);
	down = false;
	await page.getByTestId('v2-plan-again').click();
	await expect(page.getByTestId('plan-left')).toBeVisible();
	await expect(box).toHaveCount(0);
});
