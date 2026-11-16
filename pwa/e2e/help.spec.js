import { expect, test } from '@playwright/test';

// "Hilfe & Support" on the landing page and in the app, the diagnosis without
// secrets, and /.well-known/security.txt.

test.beforeEach(async ({ page }) => {
	// Lists from outside are not part of these tests.
	await page.context().route(/crns-list\.aleph\.sh|filecoin|glif|chain\.love/, (route) => route.abort());
});

test('the landing page says how to reach Le Space, what it never asks for, and how to report a security issue', async ({ page }) => {
	await page.goto('/');
	const help = page.getByTestId('help');
	await expect(help).toHaveAttribute('open', '');
	await expect(help.locator('summary')).toHaveText('Hilfe & Support');
	await expect(help.getByTestId('help-mail')).toHaveAttribute('href', /^mailto:paperless@le-space\.de\?subject=/);
	await expect(help.getByTestId('help-payment-mail')).toHaveAttribute('href', 'mailto:support@le-space.de');
	await expect(help.getByTestId('help-legal-mail')).toHaveAttribute('href', 'mailto:contact@le-space.de');
	await expect(help.getByTestId('help-never')).toContainText('Wer danach fragt, ist nicht Le Space.');
	// The landing page has no diagnosis of its own; it points to the app's button.
	await expect(help.getByTestId('help-diagnosis')).toHaveCount(0);
	await expect(help).toContainText('„Diagnose kopieren“');
	await expect(help.getByTestId('help-restore')).toHaveAttribute('href', /docs\/restore-yourself\.de\.md$/);
	await expect(help.getByTestId('help-security-mail')).toHaveAttribute('href', 'mailto:security@le-space.de');
	await expect(help.getByTestId('help-security-github')).toHaveAttribute('href', 'https://github.com/Le-Space/paperless-anywhere/security/advisories/new');
	await expect(help.getByTestId('help-security-policy')).toHaveAttribute('href', /\/blob\/main\/SECURITY\.md$/);
	await expect(page.getByTestId('footer-help')).toHaveAttribute('href', '#hilfe');
	await expect(page.getByTestId('footer-security')).toHaveAttribute('href', '#sicherheit');

	await page.goto('/en/');
	await expect(page.getByTestId('help').locator('summary')).toHaveText('Help & support');
	await expect(page.getByTestId('help-never')).toContainText('Whoever asks for them is not Le Space.');
	await expect(page.getByTestId('help-restore')).toHaveAttribute('href', /docs\/restore-yourself\.md$/);
	await expect(page.locator('#security')).toHaveText('Reporting a security issue');
	await expect(page.getByTestId('footer-security')).toHaveAttribute('href', '#security');
});

test('in the app the footer opens the help, and the diagnosis holds nothing of a locked vault', async ({ page, context, browserName }) => {
	await page.goto('/app/');
	const help = page.getByTestId('help');
	await expect(help).not.toHaveAttribute('open', '');
	await page.getByTestId('footer-help').click();
	await expect(help).toHaveAttribute('open', '');
	await expect(help.getByTestId('help-never')).toBeVisible();
	await help.getByText('Was die Diagnose enthält').click();
	const text = help.getByTestId('help-diagnosis-text');
	await expect(text).toContainText('Paperless anywhere – diagnosis');
	await expect(text).toContainText('vault: locked');
	await expect(text).toContainText('browser: ');
	await expect(text).not.toContainText('vm:');
	if (browserName === 'chromium') {
		await context.grantPermissions(['clipboard-read', 'clipboard-write']);
		await help.getByTestId('help-diagnosis').click();
		await expect(help.getByTestId('help-diagnosis-said')).toHaveText('Kopiert. Füg sie in deine Mail ein.');
		expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('vault: locked');
	}
	// Nothing wider than a phone.
	await page.setViewportSize({ width: 375, height: 812 });
	expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
});

test('security.txt is served where RFC 9116 puts it', async ({ request }) => {
	const res = await request.get('/.well-known/security.txt');
	expect(res.ok()).toBe(true);
	const body = await res.text();
	expect(body).toContain('Contact: mailto:security@le-space.de');
	expect(body).toContain('Policy: https://github.com/Le-Space/paperless-anywhere/blob/main/SECURITY.md');
});
