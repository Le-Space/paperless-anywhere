// Renders scripts/og-image.html to static/og.png (1200×630), the image link
// previews show for the landing page. Run again after changing the HTML.
import { chromium } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const html = new URL('./og-image.html', import.meta.url);
// One image per language of the landing page; the HTML holds the German text.
const IMAGES = [
	{ file: 'og.png', text: null },
	{ file: 'og-en.png', text: { tag: 'Paperless-ngx in confidential VMs · offered by Le Space', h1: 'Resilient. Confidential. On your schedule.', cta: 'Open the app →', sub: 'no account · paperless.le-space.de' } }
];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
for (const { file, text } of IMAGES) {
	const out = fileURLToPath(new URL(`../static/${file}`, import.meta.url));
	await page.goto(html.href);
	if (text) {
		await page.evaluate((t) => {
			document.documentElement.lang = 'en';
			for (const [selector, value] of [['.tag', t.tag], ['h1', t.h1], ['.cta', t.cta], ['.sub', t.sub]]) {
				const el = document.querySelector(selector);
				if (!el) throw new Error(`og-image.html has no ${selector}`);
				el.textContent = value;
			}
		}, text);
	}
	await page.evaluate(() => document.fonts.ready);
	await page.screenshot({ path: out });
	console.log(`wrote ${out}`);
}
await browser.close();
