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
	await expect(page.locator('.hero .kicker')).toHaveText('Dezentral · vertraulich · nachprüfbar');
	await expect(page.locator('.points h3')).toHaveText(['Ausfallsicher', 'Vertraulich und nachprüfbar', 'Rund um die Uhr oder nach Gebrauch']);
	await expect(page).toHaveTitle('Paperless-ngx vertraulich gehostet – Paperless anywhere');
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
	await expect(page.getByTestId('audience')).toContainText('Was die Hardware dabei nicht prüft, steht unter „Nachprüfbar“.');
	await expect(page.getByTestId('audience')).toContainText('in etwa einer Viertelstunde bereit');
	if (process.env.SHOTS) await page.locator('#audience').screenshot({ path: `${process.env.SHOTS}/audience.png` });
	await expect(page.getByTestId('trust-hint')).toHaveAttribute('href', '#trust');
	await expect(page.getByTestId('trust-hint')).toContainText('Vertrauen ist gut, nachprüfen ist besser:');
	await expect(page.locator('#prices .price')).toHaveText(['6,40 €', '16,40 €', '90,50 €']);
	await expect(page.getByTestId('prices-plan-backup')).toHaveText(['Sicherung inklusive', 'Sicherung inklusive', 'Sicherung inklusive']);
	await expect(page.locator('#prices')).toContainText('Dauerbetrieb, rund um die Uhr');
	// The package holds the documents' room, and the backup with it.
	await expect(page.getByTestId('prices-included')).toHaveText('In jedem Paket enthalten: bis 8 GB Dokumente und der Bau deines eigenen Images.');
	await expect(page.getByTestId('prices-backup')).toContainText('Die verschlüsselte Sicherung in drei Kopien ist in jedem Paket enthalten.');
	await expect(page.locator('#prices')).not.toContainText('1,50');
	await expect(page.getByTestId('prices-backup')).not.toContainText('Guthaben');
	await expect(page.getByTestId('prices-backup')).toContainText('damit deine Dokumente nach einem Stopp zurückkommen');
	await expect(page.getByTestId('prices-backup-year')).toContainText('Ohne Paket kannst du deine Sicherungen für einmalig 18 € ein Jahr aufbewahren lassen.');
	await expect(page.getByTestId('prices-backup-total')).toHaveCount(0);
	await expect(page.getByTestId('prices-backup-after')).toContainText('mindestens 30 Tage abrufbar');
	await expect(page.locator('#faq')).toContainText('Die Sicherung ist im Paket enthalten und läuft mit ihm weiter.');
	await expect(page.locator('main')).not.toContainText('Sicherungen in drei Kopien.');

	await expect(page.getByRole('link', { name: 'Impressum' })).toHaveAttribute('href', 'https://le-space.de/#impressum');
	await expect(page.getByRole('link', { name: 'Datenschutz' })).toHaveAttribute('href', 'https://credits.le-space.de/datenschutz');
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
	// In the app now: the section says so, and still comes after the public image's story.
	await expect(page.getByTestId('own-image-status')).toHaveText('In der App');
	await expect(page.locator('#image')).not.toContainText('In Vorbereitung');
	expect(await page.evaluate(() => document.querySelector('#trust').compareDocumentPosition(document.querySelector('#image')) & Node.DOCUMENT_POSITION_FOLLOWING)).toBeTruthy();
	// Sold first: what it gives, and the way into the app; how it works in a fold.
	await expect(page.getByTestId('own-image-benefits').locator('h3')).toHaveText(['Ein Schlüssel nur für dich', 'Nachgeprüft statt vertraut', 'In etwa 15 Minuten fertig', 'Erprobt']);
	await expect(page.getByTestId('own-image-cta')).toHaveAttribute('href', '/app/');
	await expect(page.getByTestId('own-image-tech')).toBeHidden();
	await page.getByTestId('own-image-how').locator('summary').click();
	await expect(page.getByTestId('own-image-tech')).toContainText('LUKS2');
	await expect(page.getByTestId('own-image-honest')).toContainText('derzeit auf einem einzigen Knoten');
	await expect(page.getByTestId('own-image-flow').getByRole('listitem')).toHaveCount(4);
	await expect(page.getByTestId('own-image-knows').getByRole('listitem')).toHaveText([/Dein Tresor: ja/, /Der Build-Dienst: nur kurz/, /Deine VM: nur kurz/, /Le Space: nein/, /Der Betreiber des Knotens: nein/, /GitHub: nein/]);

	// English has its own address; the language links are real links.
	await expect(page.getByTestId('lang-de')).toHaveAttribute('aria-current', 'page');
	await expect(page.getByTestId('lang-en')).toHaveAttribute('href', '/en/');
	await page.getByTestId('lang-en').click();
	await expect(page).toHaveURL(/\/en\/$/);
	await expect(page.getByRole('heading', { level: 1 })).toHaveAccessibleName('Paperless anywhere runs resilient, confidential and on your schedule.');
	await expect(page.locator('html')).toHaveAttribute('lang', 'en');
	await expect(page.getByTestId('lang-de')).toHaveAttribute('href', '/');
	await expect(page.locator('.hero .hint')).toHaveText('With a passkey, no account.');
	// Section links stay on the English page, and the licence page follows the language.
	await page.locator('nav a[href="#trust"]').click();
	await expect(page).toHaveURL(/\/en\/#trust$/);
	await expect(page.getByRole('link', { name: 'Privacy' })).toHaveAttribute('href', 'https://credits.le-space.de/datenschutz');
	await expect(page.getByTestId('hero-disclaimer')).toHaveText('Paperless-ngx is an independent open source project (GPL-3.0). Paperless anywhere is offered by Le Space, is not affiliated with the project and is neither endorsed nor sponsored by it.');
	await expect(page.getByTestId('brand')).toContainText('Paperless-ngx in confidential VMs · offered by Le Space');
	await page.reload();
	await expect(page.getByRole('heading', { level: 1 })).toHaveAccessibleName('Paperless anywhere runs resilient, confidential and on your schedule.');

	await page.getByRole('link', { name: /Open the app/ }).first().click();
	await expect(page).toHaveURL(/\/app\/$/);
	await expect(page).toHaveTitle('Paperless anywhere');
	await expect(page.getByTestId('state')).toHaveText('new');
});

test('the backup section says how a provider proves it still has the backup, with the maths and its limits', async ({ page }) => {
	await page.context().route(/^https?:\/\/(?!localhost)/, (route) => route.abort());
	await page.goto('/');
	const proof = page.getByTestId('backup-proof');
	await expect(proof.getByRole('heading', { level: 3 })).toHaveText('Woher weiß ich, dass meine Sicherung noch da ist?');
	await expect(proof).toContainText('Die Beweise prüft ein Vertrag auf der Filecoin-Kette, nicht Le Space');
	await expect(page.getByTestId('backup-proof-app')).toContainText('„Was die Chain sagt“');
	await expect(page.getByTestId('backup-proof-app')).toContainText('Die Beweise rechnet der Vertrag nach, nicht die App.');
	await page.getByTestId('backup-proof-maths').locator('summary').click();
	await expect(proof).toContainText('Blätter zu je 32 Byte');
	await expect(proof).toContainText('höchstens 24 Stunden (2880 Epochen zu 30 Sekunden)');
	await expect(page.getByTestId('backup-proof-table').locator('tbody tr')).toHaveText([/^100 %.*100 %\s*100 %\s*100 %$/, /^10 %\s*41 %\s*97,5 %\s*> 99,99 %$/, /^1 %\s*4,9 %\s*30 %\s*78 %$/, /^0,1 %\s*0,5 %\s*3,4 %\s*14 %$/]);
	await expect(proof).toContainText('PDP beweist Besitz, nicht die Herausgabe');
	await expect(proof.getByRole('link', { name: /Mit Quellen und den Verträgen/ })).toHaveAttribute('href', /docs\/backup-proofs\.md$/);
	await page.goto('/en/');
	await expect(page.getByTestId('backup-proof').getByRole('heading', { level: 3 })).toHaveText('How do I know my backup is still there?');
});

test('search engines find a robots.txt, a sitemap with both languages, and leave the app out', async ({ request }) => {
	const robots = await (await request.get('/robots.txt')).text();
	expect(robots).toContain('Sitemap: https://paperless.le-space.de/sitemap.xml');
	const sitemap = await (await request.get('/sitemap.xml')).text();
	for (const loc of ['https://paperless.le-space.de/', 'https://paperless.le-space.de/en/', 'https://paperless.le-space.de/lizenzen/']) expect(sitemap).toContain(`<loc>${loc}</loc>`);
	expect(sitemap).toContain('hreflang="en" href="https://paperless.le-space.de/en/"');
	const app = await (await request.get('/app/')).text();
	expect(app).toContain('<meta name="robots" content="noindex" />');
	const home = await (await request.get('/')).text();
	expect(home).not.toContain('name="robots"');
	const licences = await (await request.get('/lizenzen/')).text();
	for (const tag of ['og:image', 'twitter:card', 'twitter:image']) expect(licences).toMatch(new RegExp(`(property|name)="${tag}"`));
});

test('link previews find title, description and image in the HTML itself, without scripts', async ({ request }) => {
	const html = await (await request.get('/')).text();
	expect(html).toContain('<title>Paperless-ngx vertraulich gehostet – Paperless anywhere</title>');
	for (const tag of ['og:title', 'og:description', 'og:url', 'og:image', 'og:image:alt', 'twitter:card', 'twitter:image']) expect(html).toMatch(new RegExp(`(property|name)="${tag}"`));
	expect(html).toContain('content="https://paperless.le-space.de/og.png?v=4"');
	expect(html).toContain('rel="manifest"');
	expect(html).toContain('rel="apple-touch-icon"');
	expect(html).toContain('Paperless anywhere läuft ausfallsicher, vertraulich und nach deinem Takt.');
	const image = await request.get('/og.png');
	expect(image.ok()).toBe(true);
	expect(image.headers()['content-type']).toContain('image/png');
	expect((await request.get('/og-en.png')).headers()['content-type']).toContain('image/png');

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
	// The claim keeps its company: the old heading as a subline, and the way to what the hardware does not check.
	await expect(page.getByTestId('trust-sub')).toContainText('Nachprüfbar: wer welchen Schlüssel hat');
	await expect(page.getByTestId('trust-sub').getByRole('link')).toHaveAttribute('href', '#trust-open');
	await expect(page.locator('#trust-open')).toBeVisible();
	await expect(page.locator('#trust-open h3')).toHaveText('Was die Hardware nicht prüft');
	if (process.env.SHOTS) await page.locator('#trust').screenshot({ path: `${process.env.SHOTS}/trust-claim.png` });
	// The diagram, wide on a desktop, tall on a phone, with a text for screen readers.
	await expect(page.getByTestId('trust-diagram').getByRole('img')).toHaveCount(1);
	await expect(page.getByTestId('trust-diagram').locator('svg:visible')).toHaveAttribute('class', /trust-wide/);
	await expect(page.getByTestId('trust-diagram').locator('svg:visible text').getByText('Image (LUKS): nicht gemessen')).toBeVisible();
	// The own image's way: built, sealed by the attested builder, stored by the browser; the public image only as a note.
	await expect(page.getByTestId('trust-diagram').locator('svg:visible text').getByText('2 · Versiegelt')).toBeVisible();
	await expect(page.getByTestId('trust-diagram').locator('svg:visible text').getByText('Image-Passphrase: nur deine')).toBeVisible();
	await expect(page.getByTestId('trust-diagram-note')).toContainText('Zum reinen Ausprobieren gibt es das öffentliche Image');
	await expect(page.getByTestId('trust-diagram-note').getByRole('link')).toHaveAttribute('href', /docs\/backup-proofs\.md$/);
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
	await expect(verify.locator('summary')).toContainText('9 Stellen mit Links');
	await expect(page.getByTestId('trust-verify').getByRole('link', { name: 'Aleph-Nachricht' })).toHaveAttribute('href', /api2\.aleph\.im\/api\/v0\/messages\/[0-9a-f]{64}$/);
	await expect(page.getByTestId('trust-verify').getByRole('link', { name: 'Sicherheitsmodell', exact: true })).toHaveAttribute('href', /docs\/security-model\.md$/);
	// The relay: named as not attested among the open points, with its source to read.
	await expect(page.getByTestId('trust-gaps')).toContainText('läuft in einer gewöhnlichen VM und wird nicht attestiert');
	await expect(page.getByTestId('trust-verify').getByRole('link', { name: 'attest-relay (relay-button)' })).toHaveAttribute('href', 'https://github.com/NiKrause/relay-button/tree/main/packages/attest-relay');
	await expect(page.getByTestId('trust-verify').getByRole('link', { name: 'Brücke (orbitdb-relay)' })).toHaveAttribute('href', /NiKrause\/orbitdb-relay\/blob\/main\/src\/services\/attest-bridge-service\.ts$/);
	await expect(page.getByTestId('trust-verify').getByRole('link', { name: 'Im Sicherheitsmodell' })).toHaveAttribute('href', /docs\/security-model\.md#the-relay$/);
	await expect(page.getByTestId('trust-verify').getByRole('link', { name: 'Varianten vertraulicher VMs im Vergleich' })).toHaveAttribute('href', /docs\/confidential-vm-variants\.md$/);

	await page.goto('/en/');
	await expect(trust.getByRole('heading', { level: 2 })).toHaveText('Don’t trust. Verify.');
	await expect(page.getByTestId('trust-sub')).toContainText('Checkable: who holds which key');
	await expect(page.getByTestId('trust-sub').getByRole('link')).toHaveText('What the hardware does not check ↓');
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

// A shared link shows the preview of the language it points to: crawlers run
// no scripts, so each address carries its own language in the HTML itself.
for (const page_ of [
	{ path: '/', lang: 'de', url: 'https://paperless.le-space.de/', seoTitle: 'Paperless-ngx vertraulich gehostet – Paperless anywhere', seoDescription: /^Paperless-ngx in einer vertraulichen VM/, title: 'Paperless anywhere – ausfallsicher, vertraulich, nach deinem Takt', description: /^Paperless anywhere läuft ausfallsicher/, locale: 'de_DE', alternate: 'en_GB', faq: 'Gehört Paperless anywhere zum Projekt Paperless-ngx?', image: 'https://paperless.le-space.de/og.png?v=4', alt: /ein Angebot von Le Space/, h1: 'Paperless anywhere läuft ausfallsicher, vertraulich und nach deinem Takt.' },
	{ path: '/en/', lang: 'en', url: 'https://paperless.le-space.de/en/', seoTitle: 'Confidential Paperless-ngx hosting – Paperless anywhere', seoDescription: /^Paperless-ngx in a confidential VM/, title: 'Paperless anywhere – resilient, confidential, on your schedule', description: /^Paperless anywhere runs resilient/, locale: 'en_GB', alternate: 'de_DE', faq: 'Is Paperless anywhere part of the Paperless-ngx project?', image: 'https://paperless.le-space.de/og-en.png?v=1', alt: /offered by Le Space: Resilient\./, h1: 'Paperless anywhere runs resilient, confidential and on your schedule.' }
]) {
	test(`without JavaScript, ${page_.path} carries its own language in title, description and preview`, async ({ browser }) => {
		const context = await browser.newContext({ javaScriptEnabled: false, locale: 'fr-FR' });
		const page = await context.newPage();
		await page.goto(page_.path);
		const meta = (key) => page.locator(`meta[property="${key}"], meta[name="${key}"]`);
		await expect(page.locator('html')).toHaveAttribute('lang', page_.lang);
		// Search engines get the words people search for; link previews the tagline.
		await expect(page).toHaveTitle(page_.seoTitle);
		await expect(meta('description')).toHaveAttribute('content', page_.seoDescription);
		await expect(meta('og:title')).toHaveAttribute('content', page_.title);
		await expect(meta('og:description')).toHaveAttribute('content', page_.description);
		await expect(meta('og:url')).toHaveAttribute('content', page_.url);
		await expect(meta('og:locale')).toHaveAttribute('content', page_.locale);
		await expect(meta('og:locale:alternate')).toHaveAttribute('content', page_.alternate);
		await expect(meta('og:image')).toHaveAttribute('content', page_.image);
		await expect(meta('og:image:alt')).toHaveAttribute('content', page_.alt);
		await expect(meta('twitter:title')).toHaveAttribute('content', page_.title);
		await expect(meta('twitter:description')).toHaveAttribute('content', page_.description);
		await expect(meta('twitter:image')).toHaveAttribute('content', page_.image);
		await expect(meta('twitter:image:alt')).toHaveAttribute('content', page_.alt);
		await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', page_.url);
		await expect(page.locator('link[rel="alternate"][hreflang="de"]')).toHaveAttribute('href', 'https://paperless.le-space.de/');
		await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveAttribute('href', 'https://paperless.le-space.de/en/');
		await expect(page.locator('link[rel="alternate"][hreflang="x-default"]')).toHaveAttribute('href', 'https://paperless.le-space.de/');
		// Structured data in the HTML itself: who offers it, the site, the app, the FAQ in this language.
		const ld = JSON.parse(await page.locator('script[type="application/ld+json"]').textContent());
		const types = ld['@graph'].map((n) => n['@type']);
		expect(types).toEqual(['Organization', 'WebSite', 'WebApplication', 'FAQPage']);
		const faq = ld['@graph'][3];
		expect(faq.inLanguage).toBe(page_.lang);
		expect(faq.mainEntity[0].name).toBe(page_.faq);
		expect(faq.mainEntity.every((q) => q.acceptedAnswer.text.length > 20)).toBe(true);
		// The page itself is in that language too, whatever the browser's is.
		await expect(page.getByRole('heading', { level: 1 })).toHaveAccessibleName(page_.h1);
		await expect(page.getByTestId('lang-de')).toHaveAttribute('href', '/');
		await expect(page.getByTestId('lang-en')).toHaveAttribute('href', '/en/');
		await context.close();
	});
}

test('/en without the slash reaches the English page, and the way back from the app and the licence page keeps the language', async ({ page }) => {
	await page.context().route(/^https?:\/\/(?!localhost)/, (route) => route.abort());
	await page.goto('/en');
	await expect(page).toHaveURL(/\/en\/$/);
	await expect(page.locator('html')).toHaveAttribute('lang', 'en');
	await page.getByRole('link', { name: 'Licences' }).first().click();
	await expect(page).toHaveURL(/\/lizenzen\/$/);
	await expect(page.locator('html')).toHaveAttribute('lang', 'en');
	await page.locator('a.brand').click();
	await expect(page).toHaveURL(/\/en\/$/);
	await page.goto('/app/');
	await expect(page.getByTestId('logo-home').first()).toHaveAttribute('href', '/en/');
});

test('the FAQ says that the providers can be paid directly, what that needs and what still comes from Le Space', async ({ page }) => {
	await page.context().route(/^https?:\/\/(?!localhost)/, (route) => route.abort());
	await page.addInitScript(() => Object.defineProperty(navigator, 'language', { get: () => 'de-DE' }));
	await page.goto('/');
	const item = page.locator('#faq details', { hasText: 'Kann ich die Anbieter auch selbst bezahlen?' });
	await item.locator('summary').click();
	await expect(item).toContainText('gehören in diesem Fall der Adresse deiner Wallet');
	await expect(item.locator('li')).toHaveText([/^Was du brauchst: eine Wallet/, /^Was du freigibst:/, /^Was auch dann von Le Space kommt: die App, das Image \(beim öffentlichen auch seine Passphrase\) und der Relay/]);
	await expect(item).toContainText('Einrichten kannst du das in der App unter „Einrichtung“.');
});

test('the FAQ says how a voucher is redeemed and how the documents come out without Le Space, in both languages', async ({ page }) => {
	await page.context().route(/^https?:\/\/(?!localhost)/, (route) => route.abort());
	await page.goto('/');
	const voucher = page.locator('#faq details', { hasText: 'Ich habe einen Gutschein.' });
	await voucher.locator('summary').click();
	await expect(voucher).toContainText('„Gutschein einlösen“');
	await expect(voucher).toContainText('die App zeigt es nach dem Einlösen');
	await expect(voucher.locator('li')).toHaveText([/^Der Zeitraum beginnt mit dem Einlösen und läuft in Kalendertagen durch/, /^Jeder Code lässt sich mit einem Tresor nur einmal einlösen, und nur bis zu seinem Ablaufdatum/, /^Der Bau eines eigenen Images ist im Gutschein-Zeitraum enthalten, bis er gelingt \(bis zu 3 Versuche\)/, /^Sichere oder exportiere deine Dokumente vor dem Ende/, /^Umfasst der Gutschein die Sicherung, bleiben/]);
	await expect(voucher.getByRole('link', { name: 'Gutscheine in den AGB (§ 4a)' })).toHaveAttribute('href', 'https://credits.le-space.de/agb');
	const out = page.locator('#faq details', { hasText: 'Komme ich auch ohne Le Space an meine Dokumente?' });
	await out.locator('summary').click();
	await expect(out).toContainText('„Sicherung selbst holen“');
	await expect(out.getByRole('link', { name: 'Sicherung selbst holen: die Anleitung' })).toHaveAttribute('href', /docs\/restore-yourself\.de\.md$/);
	await page.goto('/en/');
	await expect(page.locator('#faq details', { hasText: 'I have a voucher. How do I redeem it?' })).toHaveCount(1);
	await expect(page.locator('#faq details', { hasText: 'Can I get at my documents without Le Space?' })).toHaveCount(1);
});

test('the footers of /, /en/ and /lizenzen/ name the build: release, time in UTC, commit, in the delivered HTML', async ({ page, request }) => {
	await page.context().route(/^https?:\/\/(?!localhost)/, (route) => route.abort());
	const version = process.env.PAPERLESS_VERSION || 'dev';
	for (const [path, date, label] of /** @type {const} */ ([
		['/', /^\d{2}\.\d{2}\.\d{4}, \d{2}:\d{2} UTC$/, 'Stand dieser Seite:'],
		['/en/', /^\d{2}\/\d{2}\/\d{4}, \d{2}:\d{2} UTC$/, 'This page’s build:'],
		['/lizenzen/', /^\d{2}\.\d{2}\.\d{4}, \d{2}:\d{2} UTC$/, 'Stand dieser Seite:']
	])) {
		// Prerendered: the line is in the HTML itself, before any script runs.
		const html = await (await request.get(path)).text();
		expect(html, path).toContain('data-testid="landing-build"');
		expect(html, path).toMatch(/data-testid="landing-build-time"[^>]*>\d{2}[./]\d{2}[./]\d{4}, \d{2}:\d{2} UTC</);
		expect(html, path).toMatch(/href="https:\/\/github\.com\/Le-Space\/paperless-anywhere\/commit\/[0-9a-f]{7}"/);

		// The licence page is one address for both languages and shows the one chosen before.
		if (path === '/lizenzen/') await page.addInitScript(() => localStorage.setItem('paperless-lang', 'de'));
		await page.goto(path);
		const build = page.getByTestId('landing-build');
		await expect(build).toContainText(label);
		await expect(build.getByTestId('landing-build-version')).toHaveText(version);
		// A release links its page on GitHub; a build without one says "dev" and links nothing.
		if (version === 'dev') await expect(build.getByRole('link', { name: 'dev' })).toHaveCount(0);
		else await expect(build.getByTestId('landing-build-version')).toHaveAttribute('href', `https://github.com/Le-Space/paperless-anywhere/releases/tag/${version}`);
		await expect(build.getByTestId('landing-build-time')).toHaveText(date);
		await expect(build.getByTestId('landing-build-time')).toHaveAttribute('datetime', /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
		await expect(build.getByTestId('landing-build-commit')).toHaveText(/^[0-9a-f]{7}$/);
		await expect(build.getByTestId('landing-build-commit')).toHaveAttribute('href', /\/commit\/[0-9a-f]{7}$/);
	}
	// The licence page follows the language chosen: its build line too.
	await page.getByRole('button', { name: 'EN' }).click();
	await expect(page.getByTestId('landing-build')).toContainText('This page’s build:');
	await expect(page.getByTestId('landing-build-time')).toHaveText(/^\d{2}\/\d{2}\/\d{4}, \d{2}:\d{2} UTC$/);
	// No message from the browser about the page's content policy or a mismatch of the prerendered text.
	const complaints = [];
	page.on('console', (m) => /Content Security Policy|hydration/i.test(m.text()) && complaints.push(m.text()));
	await page.goto('/en/');
	await expect(page.getByTestId('landing-build')).toBeVisible();
	expect(complaints).toEqual([]);
});

test('the FAQ says what happens when the relay is down, and how to run one', async ({ page }) => {
	await page.context().route(/^https?:\/\/(?!localhost)/, (route) => route.abort());
	await page.goto('/');
	const item = page.locator('#faq details', { hasText: 'Was, wenn der Relay ausfällt oder blockiert ist?' });
	await item.locator('summary').click();
	await expect(item).toContainText('versucht sie nacheinander; fällt einer aus, nimmt sie den nächsten');
	await expect(item).toContainText('ein Relay sieht nur verschlüsselte Daten');
	await expect(item.locator('li')).toHaveText([/relay-button: einen orbitdb-relay, der den Prüfweg unter \/attest anbietet/, /braucht dafür eigene Aleph-Credits/, /„Eigene Relays“/]);
	await expect(item.getByRole('link', { name: 'relay-button: Quelltext und Anleitung' })).toHaveAttribute('href', 'https://github.com/NiKrause/relay-button');
	await expect(item.getByRole('link', { name: 'Der Relay im Sicherheitsmodell' })).toHaveAttribute('href', /docs\/security-model\.md#the-relay$/);
	// The same entry on the English page.
	await page.goto('/en/');
	await expect(page.locator('#faq details', { hasText: 'What if the relay is down or blocked?' })).toHaveCount(1);
});

test('the FAQ says what happens when a storage provider fails, and what is paid, in both languages', async ({ page }) => {
	await page.context().route(/crns-list\.aleph\.sh|filecoin|glif|chain\.love/, (route) => route.abort());
	await page.goto('/');
	const item = page.locator('#faq details', { hasText: 'Was passiert, wenn ein Speicheranbieter ausfällt?' });
	await item.locator('summary').click();
	await expect(item).toContainText('fordert keine VM an, solange keine Kopie antwortet');
	await expect(item.getByRole('link')).toHaveAttribute('href', /docs\/backup-proofs\.md$/);
	const pay = page.locator('#faq details', { hasText: 'Zahle ich für ausgefallene Anbieter' });
	await pay.locator('summary').click();
	await expect(pay).toContainText('Bezahlt werden nur Beweisperioden');
	await page.goto('/en/');
	await expect(page.locator('#faq summary', { hasText: 'Does the app notice beforehand that a provider cannot be reached?' })).toBeVisible();
	await expect(page.locator('#faq summary', { hasText: 'Do I pay for failed providers, or for more and more copies?' })).toBeVisible();
});

test('the FAQ says what happens when a voucher or package ends, in both languages', async ({ page }) => {
	await page.context().route(/crns-list\.aleph\.sh|filecoin|glif|chain\.love/, (route) => route.abort());
	await page.goto('/');
	const item = page.locator('#faq details', { hasText: 'Was passiert, wenn mein Gutschein oder Paket endet?' });
	await item.locator('summary').click();
	await expect(item).toContainText('bis 30 Tage nach dem letzten bezahlten Tag abrufbar');
	await expect(item.getByRole('link', { name: 'Eine Sicherung selbst holen und entschlüsseln' })).toHaveAttribute('href', /restore-yourself\.de\.md$/);
	await page.goto('/en/');
	const en = page.locator('#faq details', { hasText: 'What happens when my voucher or package ends?' });
	await en.locator('summary').click();
	await expect(en.getByRole('link', { name: 'Fetch and decrypt a backup yourself' })).toHaveAttribute('href', /restore-yourself\.md$/);
});

test('the landing page says what Paperless-ngx is, and links its own source in the header and the footer', async ({ page }) => {
	await page.context().route(/crns-list\.aleph\.sh|filecoin|glif|chain\.love/, (route) => route.abort());
	await page.goto('/');
	await expect(page.locator('.hero .lead')).toContainText('Dein papierloses Büro: Paperless-ngx');
	await expect(page.locator('#paperless-ngx h2')).toHaveText('Was ist Paperless-ngx?');
	await expect(page.getByTestId('ngx-features').locator('h3')).toHaveText(['Hineingeben', 'Ordnet von selbst', 'Findet in Sekunden', 'Holt Post aus dem Postfach']);
	await expect(page.locator('#paperless-ngx').getByRole('link', { name: 'Paperless-ngx auf GitHub' })).toHaveAttribute('href', 'https://github.com/paperless-ngx/paperless-ngx');
	await expect(page.getByTestId('header-source')).toHaveAttribute('href', 'https://github.com/Le-Space/paperless-anywhere');
	await expect(page.getByTestId('header-source')).toHaveAccessibleName('Quelltext von Paperless anywhere auf GitHub');
	await expect(page.getByTestId('footer-source')).toHaveText('Quelltext von Paperless anywhere auf GitHub');
	await page.goto('/en/');
	await expect(page.locator('#paperless-ngx h2')).toHaveText('What is Paperless-ngx?');
	await expect(page.getByTestId('footer-source')).toHaveText('Paperless anywhere’s source code on GitHub');
	await page.goto('/app/');
	await expect(page.getByTestId('footer-source')).toHaveAttribute('href', 'https://github.com/Le-Space/paperless-anywhere');
});
