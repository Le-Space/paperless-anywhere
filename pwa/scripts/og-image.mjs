// Renders scripts/og-image.html to static/og.png (1200×630), the image link
// previews show for the landing page. Run again after changing the HTML.
import { chromium } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const html = new URL('./og-image.html', import.meta.url);
const out = fileURLToPath(new URL('../static/og.png', import.meta.url));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.goto(html.href);
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: out });
await browser.close();
console.log(`wrote ${out}`);
