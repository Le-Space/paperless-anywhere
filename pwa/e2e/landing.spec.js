import { expect, test } from '@playwright/test';

const GiB = 1024 ** 2; // in kB
const crn = (name, freeGiB) => ({
	hash: name.padEnd(64, '0'),
	name,
	score: 0.9,
	// Both made-up nodes belong to one made-up operator.
	owner: '0x00000000000000000000000000000000000000c1',
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
	// The headline: one sentence with one changing word. Its name holds all three.
	const h1 = page.getByRole('heading', { level: 1 });
	await expect(h1).toHaveAccessibleName('Paperless anywhere läuft ausfallsicher, vertraulich und nach deinem Takt.');
	await expect(h1).not.toHaveAttribute('aria-live');
	await expect(h1.locator('.word')).toHaveText(['ausfallsicher.', 'vertraulich.', 'nach deinem Takt.']);
	await expect(page.locator('.hero .kicker')).toHaveText('Dezentral · vertraulich · auf Abruf');
	await expect(page.locator('.points h3')).toHaveText(['Ausfallsicher', 'Vertraulich und nachprüfbar', 'Rund um die Uhr oder nach Gebrauch']);
	await expect(page).toHaveTitle('Paperless anywhere – ausfallsicher, vertraulich, nach deinem Takt');
	await expect(page.locator('#nodes')).toContainText('2 TEE-Knoten, 1 davon mit Platz');
	// Resilience, with the live numbers and without claiming more than is true.
	await expect(page.locator('#nodes h2')).toHaveText('Ausfallsicher: kein einzelnes Rechenzentrum');
	await expect(page.getByTestId('nodes-resilience')).toHaveText(/^2 vertrauliche Knoten von 1 Betreiber/);
	await expect(page.getByTestId('nodes-depends')).toContainText('Was noch an Le Space hängt');
	await expect(page.getByRole('navigation', { name: 'Sections' }).getByRole('link', { name: 'Ausfallsicher' })).toHaveAttribute('href', '#nodes');
	// What a consumer has to see with the prices: the end price and the terms.
	await expect(page.getByTestId('prices-vat')).toHaveText('Alle Preise inkl. 19 % USt.');
	const legal = page.getByTestId('prices-legal');
	await expect(legal.getByRole('link', { name: 'AGB' })).toHaveAttribute('href', 'https://credits.le-space.de/agb');
	await expect(legal.getByRole('link', { name: 'Widerrufsbelehrung' })).toHaveAttribute('href', 'https://credits.le-space.de/agb');
	await expect(page.getByTestId('footer-terms')).toHaveAttribute('href', 'https://credits.le-space.de/agb');
	await expect(page.getByTestId('footer-withdrawal')).toHaveText('Widerrufsbelehrung');
	await expect(page.locator('#prices .lead')).toHaveText('Wähle ein Monatspaket: Dauerbetrieb rund um die Uhr, oder die Stunden, die du im Monat brauchst.');
	// Who it is for, and the way to "Nachprüfbar" from the top.
	await expect(page.locator('#audience .lead')).toHaveText('Für alle, die ihr Dokumentenarchiv nicht einem einzelnen Rechenzentrum anvertrauen wollen:');
	await expect(page.getByTestId('audience').locator('li strong')).toHaveText(['Wer nicht vom Ausfall eines Hosters oder Speicheranbieters abhängen will:', 'Wem die Vertraulichkeit seiner Dokumente wichtig ist:', 'Unternehmen, die ihr Archiv rund um die Uhr brauchen:', 'Selbstständige und kleine Firmen, die es nur ab und zu brauchen:']);
	await expect(page.getByTestId('audience')).toContainText('Was dabei noch offen ist, steht unter „Nachprüfbar“.');
	await expect(page.getByTestId('audience')).toContainText('in etwa einer Viertelstunde bereit');
	if (process.env.SHOTS) await page.locator('#audience').screenshot({ path: `${process.env.SHOTS}/audience.png` });
	await expect(page.getByTestId('trust-hint')).toHaveAttribute('href', '#trust');
	await expect(page.getByTestId('trust-hint')).toContainText('Vertrauen ist gut, nachprüfen ist besser:');
	await expect(page.locator('#prices')).toContainText('4,90 €');
	await expect(page.locator('#prices')).toContainText('Dauerbetrieb, rund um die Uhr');
	// The package holds the documents' room; the backup is a price of its own.
	await expect(page.getByTestId('prices-included')).toHaveText('In jedem Paket enthalten: bis 8 GB Dokumente.');
	await expect(page.getByTestId('prices-backup')).toContainText('ist nicht im Paket enthalten: Sie kostet 1,50 € im Monat dazu');
	await expect(page.getByTestId('prices-backup')).toContainText('als weitere Zeile deines Monatsabos');
	await expect(page.getByTestId('prices-backup')).not.toContainText('Guthaben');
	await expect(page.getByTestId('prices-backup')).toContainText('damit deine Dokumente nach einem Stopp zurückkommen');
	await expect(page.getByTestId('prices-backup-year')).toContainText('Oder einmalig 18 € für ein Jahr Aufbewahrung, mit oder ohne Paket.');
	await expect(page.getByTestId('prices-backup-total')).toHaveText('15 Stunden mit Sicherung: 4,90 € + 1,50 € = 6,40 € im Monat.');
	await expect(page.getByTestId('prices-backup-after')).toContainText('mindestens 30 Tage abrufbar');
	await expect(page.locator('#faq')).toContainText('Die Sicherung ist nicht im Paket enthalten');
	await expect(page.locator('main')).not.toContainText('Sicherungen in drei Kopien.');

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
	// Not running yet: the section says so, and comes after what is true today.
	await expect(page.getByTestId('own-image-status')).toHaveText('In Vorbereitung');
	expect(await page.evaluate(() => document.querySelector('#trust').compareDocumentPosition(document.querySelector('#image')) & Node.DOCUMENT_POSITION_FOLLOWING)).toBeTruthy();
	await expect(page.getByTestId('own-image-flow').getByRole('listitem')).toHaveCount(4);
	await expect(page.getByTestId('own-image-knows').getByRole('listitem')).toHaveText([/Dein Tresor: ja/, /Der Build-Dienst: nur kurz/, /Deine VM: nur kurz/, /Le Space: nein/, /Der Betreiber des Knotens: nein/, /GitHub: nein/]);

	await page.getByRole('button', { name: 'EN' }).click();
	await expect(page.getByRole('heading', { level: 1 })).toHaveAccessibleName('Paperless anywhere runs resilient, confidential and on your schedule.');
	await expect(page.locator('html')).toHaveAttribute('lang', 'en');
	await expect(page.getByRole('link', { name: 'Privacy' })).toHaveAttribute('href', 'https://le-space.de/#privacy');
	await expect(page.getByTestId('hero-disclaimer')).toHaveText('Paperless-ngx is an independent open source project (GPL-3.0). Paperless anywhere is offered by Le Space, is not affiliated with the project and is neither endorsed nor sponsored by it.');
	await expect(page.getByTestId('brand')).toContainText('Paperless-ngx on demand, run by Le Space');
	await page.reload();
	await expect(page.getByRole('heading', { level: 1 })).toHaveAccessibleName('Paperless anywhere runs resilient, confidential and on your schedule.');

	await page.getByRole('link', { name: /Open the app/ }).first().click();
	await expect(page).toHaveURL(/\/app\/$/);
	await expect(page).toHaveTitle('Paperless anywhere');
	await expect(page.getByTestId('state')).toHaveText('new');
});

test('link previews find title, description and image in the HTML itself, without scripts', async ({ request }) => {
	const html = await (await request.get('/')).text();
	expect(html).toContain('<title>Paperless anywhere – ausfallsicher, vertraulich, nach deinem Takt</title>');
	for (const tag of ['og:title', 'og:description', 'og:url', 'og:image', 'og:image:alt', 'twitter:card', 'twitter:image']) expect(html).toMatch(new RegExp(`(property|name)="${tag}"`));
	expect(html).toContain('content="https://paperless.le-space.de/og.png?v=3"');
	expect(html).toContain('rel="manifest"');
	expect(html).toContain('rel="apple-touch-icon"');
	expect(html).toContain('Paperless anywhere läuft ausfallsicher, vertraulich und nach deinem Takt.');
	const image = await request.get('/og.png');
	expect(image.ok()).toBe(true);
	expect(image.headers()['content-type']).toContain('image/png');

	const manifest = await (await request.get('/manifest.webmanifest')).json();
	expect(manifest.name).toBe('Paperless anywhere');
	expect(manifest.short_name).toBe('Paperless anywhere');
	for (const icon of manifest.icons) expect((await request.get(icon.src)).ok()).toBe(true);
});

test('the landing page shows who holds which key, what is attested and where to check it', async ({ page }) => {
	await page.context().route(/https:\/\/crns-list\.aleph\.sh\/.*/, (route) => route.fulfill({ json: { crns: [] } }));
	await page.context().route(/filecoin|glif|chain\.love/, (route) => route.abort());
	await page.addInitScript(() => Object.defineProperty(navigator, 'language', { get: () => 'de-DE' }));

	await page.goto('/');
	const trust = page.locator('#trust');
	await expect(trust.getByRole('heading', { level: 2 })).toHaveText('Vertrauen ist gut. Nachprüfen ist besser.');
	// The claim keeps its company: the old heading as a subline, and the way to what is not confirmed yet.
	await expect(page.getByTestId('trust-sub')).toContainText('Nachprüfbar: wer welchen Schlüssel hat');
	await expect(page.getByTestId('trust-sub').getByRole('link')).toHaveAttribute('href', '#trust-open');
	await expect(page.locator('#trust-open')).toBeVisible();
	await expect(page.locator('#trust-open h3')).toHaveText('Noch nicht bestätigt');
	if (process.env.SHOTS) await page.locator('#trust').screenshot({ path: `${process.env.SHOTS}/trust-claim.png` });
	// The diagram, wide on a desktop, tall on a phone, with a text for screen readers.
	await expect(page.getByTestId('trust-diagram').getByRole('img')).toHaveCount(1);
	await expect(page.getByTestId('trust-diagram').locator('svg:visible')).toHaveAttribute('class', /trust-wide/);
	await expect(page.getByTestId('trust-diagram').locator('svg:visible text').getByText('Image (LUKS): nicht gemessen')).toBeVisible();
	// What the hardware confirms and what it does not yet are open without a click.
	await expect(page.getByTestId('trust-gaps')).toBeVisible();
	await expect(page.getByTestId('trust-gaps')).toContainText('Der Inhalt des Images wird nicht mitgemessen.');
	await expect(page.getByTestId('trust-proves')).toBeVisible();
	await expect(page.getByTestId('trust-proves')).toContainText('Der Relay dazwischen trägt nur verschlüsselte Bytes.');
	// The table and the sources are folded, and open with the keyboard.
	const secrets = trust.locator('details#trust-secrets');
	const verify = trust.locator('details#trust-verify');
	await expect(page.getByTestId('trust-secrets')).toBeHidden();
	await expect(page.getByTestId('trust-verify')).toBeHidden();
	await expect(secrets.locator('summary')).toContainText('Wer welches Geheimnis kennt');
	await expect(secrets.locator('summary')).toContainText('5 Geheimnisse');
	await secrets.locator('summary').focus();
	await page.keyboard.press('Enter');
	await expect(page.getByTestId('trust-secrets').getByRole('row')).toHaveCount(6);
	// The app's evidence view as a sample: marked as one, with made-up values and no link built from them.
	const sample = trust.locator('details#trust-sample');
	await expect(sample.locator('summary').first()).toContainText('Beispiel, keine echte VM');
	await expect(sample.getByTestId('evidence')).toBeHidden();
	await sample.locator('summary').first().click();
	await expect(sample.getByTestId('evidence-sample')).toHaveText('Beispiel, keine echte VM');
	await expect(sample.getByTestId('evidence-instance')).toContainText('example-instance-');
	await expect(sample.getByTestId('evidence-instance').getByRole('link')).toHaveCount(0);
	await expect(sample.getByTestId('evidence-image')).toContainText('Der Inhalt des Images wird nicht mitgemessen.');
	await expect(sample.getByTestId('evidence-again')).toHaveCount(0);
	// A link to a folded part opens it.
	await page.evaluate(() => (location.hash = '#trust-verify'));
	await expect(verify).toHaveAttribute('open', '');
	await expect(verify.locator('summary')).toContainText('8 Stellen mit Links');
	await expect(page.getByTestId('trust-verify').getByRole('link', { name: 'Aleph-Nachricht' })).toHaveAttribute('href', /api2\.aleph\.im\/api\/v0\/messages\/[0-9a-f]{64}$/);
	await expect(page.getByTestId('trust-verify').getByRole('link', { name: 'Sicherheitsmodell' })).toHaveAttribute('href', /docs\/security-model\.md$/);
	await expect(page.getByTestId('trust-verify').getByRole('link', { name: 'Varianten vertraulicher VMs im Vergleich' })).toHaveAttribute('href', /docs\/confidential-vm-variants\.md$/);

	await page.getByRole('button', { name: 'EN' }).click();
	await expect(trust.getByRole('heading', { level: 2 })).toHaveText('Don’t trust. Verify.');
	await expect(page.getByTestId('trust-sub')).toContainText('Checkable: who holds which key');
	await expect(page.getByTestId('trust-sub').getByRole('link')).toHaveText('Not confirmed yet ↓');
	await expect(page.getByTestId('trust-gaps')).toContainText('The image’s content is not measured.');

	await page.setViewportSize({ width: 375, height: 812 });
	await expect(page.getByTestId('trust-diagram').locator('svg:visible')).toHaveAttribute('class', /trust-tall/);
	// Nothing wider than the phone.
	expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);

	// Arriving with a link to a folded part finds it open.
	await page.goto('/#trust-secrets');
	await page.reload();
	await expect(page.locator('details#trust-secrets')).toHaveAttribute('open', '');
	await expect(page.locator('details#trust-verify')).not.toHaveAttribute('open', '');
});

test('the folded parts of the trust section open without JavaScript', async ({ browser }) => {
	const context = await browser.newContext({ javaScriptEnabled: false, locale: 'de-DE' });
	const page = await context.newPage();
	await page.goto('/');
	await expect(page.getByTestId('trust-gaps')).toBeVisible();
	await expect(page.getByTestId('trust-verify')).toBeHidden();
	await page.locator('details#trust-verify summary').click();
	await expect(page.getByTestId('trust-verify').getByRole('link').first()).toBeVisible();
	await context.close();
});

test('the section links stay at the top while the page scrolls', async ({ page }) => {
	await page.context().route(/^https?:\/\/(?!localhost)/, (route) => route.abort());
	await page.setViewportSize({ width: 1200, height: 800 });
	await page.addInitScript(() => Object.defineProperty(navigator, 'language', { get: () => 'de-DE' }));
	await page.goto('/');
	const header = page.locator('header.top');
	const nav = page.getByRole('navigation', { name: 'Sections' });
	await nav.getByRole('link', { name: 'FAQ' }).click();
	await expect(page).toHaveURL(/#faq$/);
	await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(500);
	// Still there, at the very top, and usable for the next jump.
	await expect(nav).toBeInViewport();
	expect(Math.round((await header.boundingBox())?.y ?? -1)).toBe(0);
	// The section it jumped to begins below the header, not under it.
	const bottom = await header.evaluate((h) => h.getBoundingClientRect().bottom);
	const heading = await page.locator('#faq h2').evaluate((h) => h.getBoundingClientRect().top);
	expect(heading).toBeGreaterThanOrEqual(bottom);
	await nav.getByRole('link', { name: 'Preise' }).click();
	await expect(page).toHaveURL(/#prices$/);
	await expect(page.locator('#prices h2')).toBeInViewport();

	// On a phone there are no section links, and the header scrolls away as before.
	await page.setViewportSize({ width: 390, height: 800 });
	await page.goto('/#faq');
	await expect(nav).toBeHidden();
	await expect(header).not.toBeInViewport();
});

test('the headline changes one word without moving the page, three times, and stands still for reduced motion', async ({ page }) => {
	await page.context().route(/^https?:\/\/(?!localhost)/, (route) => route.abort());
	await page.addInitScript(() => Object.defineProperty(navigator, 'language', { get: () => 'de-DE' }));
	await page.goto('/');
	const words = page.locator('h1 .word');
	const look = () => words.evaluateAll((els) => els.map((e) => { const c = getComputedStyle(e); return { name: c.animationName, turns: c.animationIterationCount, opacity: Number(c.opacity) }; }));
	// Three turns each, then it stops.
	expect((await look()).map((w) => [w.name === 'none', w.turns])).toEqual([[false, '3'], [false, '3'], [false, '3']]);
	// All three words share one cell: its size is the largest word's, whichever shows.
	const boxes = await words.evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top)]; }));
	expect(new Set(boxes.map(String)).size).toBe(1);
	const slot = await page.locator('h1 .swap').evaluate((e) => e.getBoundingClientRect().width);
	for (const w of await words.evaluateAll((els) => els.map((e) => e.scrollWidth))) expect(Math.ceil(slot) + 1).toBeGreaterThanOrEqual(w);
	const leadTop = () => page.locator('.hero .lead').evaluate((e) => Math.round(e.getBoundingClientRect().top));
	const before = await leadTop();
	// The second word's turn comes after three seconds; the lead has not moved.
	await expect.poll(async () => (await look())[1].opacity, { timeout: 8000 }).toBeGreaterThan(0.9);
	expect((await look())[0].opacity).toBeLessThan(0.1);
	expect(await leadTop()).toBe(before);

	// With reduced motion nothing moves: the first word stands from the start.
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.reload();
	expect(await look()).toEqual([{ name: 'none', turns: '1', opacity: 1 }, { name: 'none', turns: '1', opacity: 0 }, { name: 'none', turns: '1', opacity: 0 }]);
});

test('the FAQ says what the own device has to do with it, with what to do and a link to the details', async ({ page }) => {
	await page.context().route(/^https?:\/\/(?!localhost)/, (route) => route.abort());
	await page.addInitScript(() => Object.defineProperty(navigator, 'language', { get: () => 'de-DE' }));
	await page.goto('/');
	const item = page.locator('#faq details', { hasText: 'Wie sicher ist mein eigenes Gerät dabei?' });
	await item.locator('summary').click();
	await expect(item).toContainText('ohne deine Freigabe per Fingerabdruck oder PIN öffnet er nichts');
	await expect(item.locator('li')).toHaveCount(4);
	await expect(item.locator('li').first()).toContainText('eigenes Browser-Profil ohne Erweiterungen');
	await expect(item.getByRole('link', { name: 'Die Einzelheiten stehen im Sicherheitsmodell.' })).toHaveAttribute('href', /docs\/security-model\.md#your-own-device$/);
	if (process.env.SHOTS) await item.screenshot({ path: `${process.env.SHOTS}/faq-device.png` });
});
