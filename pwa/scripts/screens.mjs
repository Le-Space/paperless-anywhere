#!/usr/bin/env node
// After the screen tour (e2e-screens/tour.spec.js): compresses its pictures
// into static/screenshots/, under the names the web app manifest gives them
// (src/lib/web-manifest.js), and checks that none is missing. 256 colours and
// optipng: the screens are flat colour and text, so this keeps them sharp at
// a fraction of the size. Needs ImageMagick (magick) and optipng.
//
//   pnpm build && pnpm screens
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { SCREENSHOTS, screenshotFile } from '../src/lib/web-manifest.js';

const FROM = process.env.SCREENS_DIR || path.join('test-results', 'screens');
const TO = 'static';

mkdirSync(path.join(TO, 'screenshots'), { recursive: true });
const missing = [];
for (const lang of /** @type {const} */ (['de', 'en'])) {
	for (const shot of SCREENSHOTS) {
		const file = screenshotFile(shot, lang);
		const from = path.join(FROM, path.basename(file));
		if (!existsSync(from)) {
			missing.push(from);
			continue;
		}
		const to = path.join(TO, file);
		execFileSync('magick', [from, '-strip', '-dither', 'None', '-colors', '256', `PNG8:${to}`]);
		execFileSync('optipng', ['-quiet', '-o2', to]);
		console.log(`${from} → ${to} (${Math.round(statSync(to).size / 1024)} KiB)`);
	}
}
if (missing.length) {
	console.error(`missing, run the tour first (pnpm screens):\n  ${missing.join('\n  ')}`);
	process.exit(1);
}
