// Renders the signet from static/favicon.svg (light colours) onto paper as the
// PNG icons the manifest and iOS need: an SVG favicon is not enough for an
// installed app or a home-screen link. Run again after changing the signet.
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const svg = readFileSync(new URL('../static/favicon.svg', import.meta.url), 'utf8').replace(/<style>.*<\/style>/, '');
// Padding keeps the signet inside the safe zone of a maskable icon (80 %).
const sizes = { 'icon-192.png': 192, 'icon-512.png': 512, 'apple-touch-icon.png': 180 };

const browser = await chromium.launch();
for (const [name, size] of Object.entries(sizes)) {
	const page = await browser.newPage({ viewport: { width: size, height: size } });
	await page.setContent(`<body style="margin:0;background:#faf6ee;display:grid;place-items:center;height:100vh"><div style="width:68%;height:68%">${svg.replace('<svg ', '<svg width="100%" height="100%" ')}</div></body>`);
	const out = fileURLToPath(new URL(`../static/${name}`, import.meta.url));
	await page.screenshot({ path: out });
	await page.close();
	console.log(`wrote ${out}`);
}
await browser.close();
