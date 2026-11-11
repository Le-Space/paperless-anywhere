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
	await expect(page.getByTestId('prices-included')).toHaveText('In jedem Paket enthalten: bis 8 GB Dokumente und ihre verschlüsselten Sicherungen in drei Kopien.');

	await expect(page.getByRole('link', { name: 'Impressum' })).toHaveAttribute('href', 'https://le-space.de/#impressum');
	await expect(page.getByRole('link', { name: 'Datenschutz' })).toHaveAttribute('href', 'https://le-space.de/#datenschutz');
	// Brand: the product is "Paperless anywhere"; Paperless-ngx is the software,
	// linked at its first mention (the line under the name), with the notice in
	// the footer, the FAQ and under the start button.
	await expect(page.getByTestId('brand')).toContainText('Paperless anywhere');
	await expect(page.getByTestId('brand').getByRole('link', { name: 'Paperless-ngx' })).toHaveAttribute('href', 'https://github.com/paperless-ngx/paperless-ngx');
	const notice = 'Paperless-ngx ist ein unabhängiges Open-Source-Projekt (GPL-3.0). Paperless anywhere ist ein Angebot von Le Space, nicht mit dem Projekt verbunden und wird von ihm weder unterstützt noch gesponsert.';
	await expect(page.getByTestId('hero-disclaimer')).toHaveText(notice);
	await expect(page.getByTestId('footer-disclaimer')).toContainText(notice);
	await expect(page.locator('#faq details').first()).toContainText(notice);
	await expect(page.getByRole('link', { name: 'Paperless anywhere starten' }).first()).toHaveAttribute('href', '/app/');
	// An image of one's own: four steps, and who knows the passphrase.
	await expect(page.getByTestId('own-image-flow').getByRole('listitem')).toHaveCount(4);
	await expect(page.getByTestId('own-image-knows').getByRole('listitem')).toHaveText([/Dein Tresor: ja/, /Der Build-Dienst: nur kurz/, /Deine VM: nur kurz/, /Le Space: nein/, /Der Betreiber des Knotens: nein/, /GitHub: nein/]);

	await page.getByRole('button', { name: 'EN' }).click();
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Your documents. Awake only when you need them.');
	await expect(page.locator('html')).toHaveAttribute('lang', 'en');
	await expect(page.getByRole('link', { name: 'Privacy' })).toHaveAttribute('href', 'https://le-space.de/#privacy');
	await expect(page.getByTestId('hero-disclaimer')).toHaveText('Paperless-ngx is an independent open source project (GPL-3.0). Paperless anywhere is offered by Le Space, is not affiliated with the project and is neither endorsed nor sponsored by it.');
	await expect(page.getByTestId('brand')).toContainText('Paperless-ngx on demand, run by Le Space');
	await page.reload();
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Your documents. Awake only when you need them.');

	await page.getByRole('link', { name: /Open the app/ }).first().click();
	await expect(page).toHaveURL(/\/app\/$/);
	await expect(page).toHaveTitle('Paperless anywhere');
	await expect(page.getByTestId('state')).toHaveText('new');
});

test('link previews find title, description and image in the HTML itself, without scripts', async ({ request }) => {
	const html = await (await request.get('/')).text();
	expect(html).toContain('<title>Paperless anywhere – Paperless-ngx auf Abruf, vertraulich</title>');
	for (const tag of ['og:title', 'og:description', 'og:url', 'og:image', 'og:image:alt', 'twitter:card', 'twitter:image']) expect(html).toMatch(new RegExp(`(property|name)="${tag}"`));
	expect(html).toContain('content="https://paperless.le-space.de/og.png?v=3"');
	expect(html).toContain('rel="manifest"');
	expect(html).toContain('rel="apple-touch-icon"');
	expect(html).toContain('Deine Dokumente. Nur wach, wenn du sie brauchst.');
	const image = await request.get('/og.png');
	expect(image.ok()).toBe(true);
	expect(image.headers()['content-type']).toContain('image/png');

	const manifest = await (await request.get('/manifest.webmanifest')).json();
	expect(manifest.name).toBe('Paperless anywhere');
	expect(manifest.short_name).toBe('Paperless anywhere');
	for (const icon of manifest.icons) expect((await request.get(icon.src)).ok()).toBe(true);
});
