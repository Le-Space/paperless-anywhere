// Installing the web app: the manifest each page links, the "App installieren"
// button after the browser's own prompt event (fired here by the test), and
// the hint for Safari, which has none. Nothing leaves the test.
import { expect, test } from '@playwright/test';

const SAFARI_MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15';

test.beforeEach(async ({ context }) => {
	await context.route(/^https?:\/\/(?!localhost)/, (route) => route.abort());
});

/** Fires a made-up `beforeinstallprompt`, whose prompt() is counted in the page. */
async function offerInstall(page) {
	return page.evaluate(() => {
		const event = /** @type {any} */ (new Event('beforeinstallprompt', { cancelable: true }));
		/** @type {any} */ (window).prompted = 0;
		event.prompt = async () => { /** @type {any} */ (window).prompted++; };
		event.userChoice = Promise.resolve({ outcome: 'accepted', platform: 'web' });
		window.dispatchEvent(event);
		return event.defaultPrevented;
	});
}

test('each page links the manifest of its language, and the app follows a change of language', async ({ page, request }) => {
	await page.goto('/');
	await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', './manifest.webmanifest');
	await page.goto('/en/');
	await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', '../manifest.en.webmanifest');
	// The app starts in German (no language chosen in this browser yet) and follows a switch.
	await page.addInitScript(() => localStorage.removeItem('paperless-lang'));
	await page.goto('/app/');
	await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', '../manifest.webmanifest');
	await page.getByTestId('app-lang-en').click();
	await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', '../manifest.en.webmanifest');
	await page.getByTestId('app-lang-de').click();
	await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', '../manifest.webmanifest');

	for (const [path, lang] of [['/manifest.webmanifest', 'de'], ['/manifest.en.webmanifest', 'en']]) {
		const response = await request.get(path);
		expect(response.ok()).toBe(true);
		const manifest = await response.json();
		expect(manifest).toMatchObject({ id: '/app/', lang, start_url: '/app/' });
		for (const shot of manifest.screenshots) {
			const image = await request.get(shot.src);
			expect(image.ok(), shot.src).toBe(true);
			expect(image.headers()['content-type']).toContain('image/png');
		}
	}
});

test('the landing page offers "App installieren" once the browser can, and asks the browser on a click', async ({ page }) => {
	await page.goto('/');
	await page.waitForLoadState('networkidle');
	await expect(page.getByTestId('install-app-landing')).toHaveCount(0);
	expect(await offerInstall(page)).toBe(true);
	const button = page.getByTestId('install-app-landing');
	await expect(button).toHaveText('App installieren');
	await button.click();
	expect(await page.evaluate(() => /** @type {any} */ (window).prompted)).toBe(1);
	// Accepted: installed, the button goes.
	await expect(button).toHaveCount(0);
});

test('the app has the button in its header, in its language, and drops it after an install', async ({ page }) => {
	await page.addInitScript(() => localStorage.setItem('paperless-lang', 'en'));
	await page.goto('/app/');
	await page.waitForLoadState('networkidle');
	await offerInstall(page);
	const button = page.locator('header').getByTestId('install-app-header');
	await expect(button).toHaveText('Install app');
	await expect(page.getByTestId('install-hint-app')).toHaveCount(0);
	await page.evaluate(() => window.dispatchEvent(new Event('appinstalled')));
	await expect(button).toHaveCount(0);
});

test.describe('Safari on the Mac', () => {
	test.use({ userAgent: SAFARI_MAC });

	test('gets a hint instead of a button, which stays away once dismissed', async ({ page }) => {
		await page.goto('/');
		const hint = page.getByTestId('install-hint-landing');
		await expect(hint).toContainText('Ablage → Zum Dock hinzufügen');
		await expect(page.getByTestId('install-app-landing')).toHaveCount(0);
		await page.getByTestId('install-hint-dismiss-landing').click();
		await expect(hint).toHaveCount(0);
		await page.reload();
		await page.waitForLoadState('networkidle');
		await expect(hint).toHaveCount(0);
		// The app, on the same device, keeps it dismissed too.
		await page.goto('/app/');
		await expect(page.getByTestId('state')).toHaveText('new');
		await expect(page.getByTestId('install-hint-app')).toHaveCount(0);
	});

	test('the app shows the hint below its content, not in the header', async ({ page }) => {
		await page.goto('/app/');
		await expect(page.getByTestId('install-hint-app')).toContainText('Ablage → Zum Dock hinzufügen');
		await expect(page.locator('header').getByTestId('install-hint-app')).toHaveCount(0);
	});
});
