import { expect, test } from '@playwright/test';

const GiB = 1024 ** 2; // in kB
const crn = (name, freeGiB) => ({
	hash: name.padEnd(64, '0'),
	name,
	score: 0.9,
	confidential_support: true,
	system_usage: { active: true, cpu: { count: 8, load_average: { load1: 1 } }, mem: { available_kB: freeGiB * GiB }, disk: { available_kB: 500 * GiB } }
});

test('the landing page at / speaks German and English and leads to the app at /app/', async ({ page }) => {
	await page.context().route(/https:\/\/crns-list\.aleph\.sh\/.*/, (route) =>
		route.fulfill({ json: { crns: [crn('Wolkenfabrik Node', 16), crn('Stromwerk Test Node', 2), { ...crn('Plain Node', 16), confidential_support: false }] } })
	);
	// The storage providers come from a Filecoin RPC; not part of this test.
	await page.context().route(/filecoin|glif|chain\.love/, (route) => route.abort());
	await page.addInitScript(() => Object.defineProperty(navigator, 'language', { get: () => 'de-DE' }));

	await page.goto('/');
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Deine Dokumente. Nur wach, wenn du sie brauchst.');
	await expect(page.locator('#nodes')).toContainText('2 TEE-Knoten, 1 davon mit Platz');
	await expect(page.locator('#prices')).toContainText('4 €');

	await expect(page.getByRole('link', { name: 'Impressum' })).toHaveAttribute('href', 'https://le-space.de/#impressum');
	await expect(page.getByRole('link', { name: 'Datenschutz' })).toHaveAttribute('href', 'https://le-space.de/#datenschutz');

	await page.getByRole('button', { name: 'EN' }).click();
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Your documents. Awake only when you need them.');
	await expect(page.locator('html')).toHaveAttribute('lang', 'en');
	await expect(page.getByRole('link', { name: 'Privacy' })).toHaveAttribute('href', 'https://le-space.de/#privacy');
	await page.reload();
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Your documents. Awake only when you need them.');

	await page.getByRole('link', { name: /Open the app/ }).first().click();
	await expect(page).toHaveURL(/\/app\/$/);
	await expect(page.getByTestId('state')).toHaveText('new');
});
