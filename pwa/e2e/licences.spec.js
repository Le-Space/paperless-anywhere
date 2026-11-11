import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

// The Paperless-ngx tag in rootfs/images.txt, which the page must show.
const tag = readFileSync(new URL('../../rootfs/images.txt', import.meta.url), 'utf8').match(/paperless-ngx:([\d.]+)@/)[1];

test('/lizenzen names the Paperless-ngx version, its source, the GPL text and the other licences, without scripts', async ({ request }) => {
	const html = await (await request.get('/lizenzen/')).text();
	expect(html).toContain('<title>Lizenzen – Paperless anywhere</title>');
	expect(html).toContain(`https://github.com/paperless-ngx/paperless-ngx/tree/v${tag}`);
	expect(html).toContain('GNU GENERAL PUBLIC LICENSE');
	expect(html).toContain('Version 3, 29 June 2007');
	expect(html).toMatch(/ghcr\.io\/le-space\/paperless-anywhere\/paperless@sha256:[0-9a-f]{64}/);
	for (const name of ['PostgreSQL', 'Valkey', 'Gotenberg', 'Apache Tika', 'Node.js']) expect(html).toContain(name);

	const third = await request.get('/third-party-licences.txt');
	expect(third.ok()).toBe(true);
	const list = await third.text();
	for (const pkg of ['svelte ', 'libp2p ', '@fontsource-variable/sora ']) expect(list).toContain(`\n${pkg}`);
	expect(list).toContain('Permission is hereby granted');
});

test('the landing page and the app link to /lizenzen; it follows the language', async ({ page }) => {
	await page.context().route(/crns-list|filecoin|glif|chain\.love/, (route) => route.abort());
	await page.addInitScript(() => Object.defineProperty(navigator, 'language', { get: () => 'de-DE' }));
	await page.goto('/');
	await page.locator('footer').getByRole('link', { name: 'Lizenzen' }).click();
	await expect(page).toHaveURL(/\/lizenzen\/$/);
	await expect(page.getByTestId('ngx-version')).toHaveText(tag);
	await expect(page.getByTestId('ngx-source')).toHaveAttribute('href', `https://github.com/paperless-ngx/paperless-ngx/tree/v${tag}`);
	await page.getByRole('button', { name: 'EN' }).click();
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Licences');
	await expect(page.getByTestId('ngx-changes')).toContainText('None to its content.');

	await page.goto('/app/');
	await expect(page.getByTestId('build-info').getByRole('link', { name: 'Lizenzen' })).toHaveAttribute('href', '/lizenzen/');
});
