// The web app manifests (web-manifest.js): valid, the same app in both
// languages, texts from the catalogue, and every screenshot they name lies in
// static/ with the size the manifest declares.
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { install } from './i18n/install.js';
import { MANIFEST_PATHS, SCREENSHOTS, SCREENSHOT_SIZES, screenshotFile, webManifest } from './web-manifest.js';
import { GET as german } from '../routes/manifest.webmanifest/+server.js';
import { GET as english } from '../routes/manifest.en.webmanifest/+server.js';

const STATIC = fileURLToPath(new URL('../../static/', import.meta.url));
const LANGS = /** @type {const} */ (['de', 'en']);

/** Width and height of a PNG, from its IHDR chunk. @param {Buffer} png */
function pngSize(png) {
	expect(png.subarray(1, 4).toString('latin1')).toBe('PNG');
	return { width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
}

describe('the web app manifests', () => {
	it('are valid JSON with the fields an install needs, served as a manifest', async () => {
		for (const [lang, GET] of /** @type {const} */ ([['de', german], ['en', english]])) {
			const response = GET();
			expect(response.headers.get('content-type')).toBe('application/manifest+json');
			const manifest = JSON.parse(await response.text());
			expect(manifest).toEqual(JSON.parse(JSON.stringify(webManifest(lang))));
			for (const field of ['id', 'name', 'short_name', 'description', 'lang', 'start_url', 'scope', 'display', 'icons', 'categories', 'screenshots']) expect(manifest[field], `${lang}: ${field}`).toBeTruthy();
			expect(manifest.lang).toBe(lang);
			expect(manifest.icons.some((/** @type {any} */ i) => i.sizes === '192x192')).toBe(true);
			expect(manifest.icons.some((/** @type {any} */ i) => i.sizes === '512x512')).toBe(true);
			for (const icon of manifest.icons) expect(existsSync(STATIC + icon.src.slice(1)), icon.src).toBe(true);
		}
		expect(MANIFEST_PATHS).toEqual({ de: '/manifest.webmanifest', en: '/manifest.en.webmanifest' });
	});

	it('name one app in both languages, opening /app/ as before', () => {
		const [de, en] = LANGS.map(webManifest);
		for (const m of [de, en]) expect(m).toMatchObject({ id: '/app/', start_url: '/app/', scope: '/', display: 'standalone', name: 'Paperless anywhere', categories: ['productivity', 'business', 'utilities'] });
		expect(de.icons).toEqual(en.icons);
	});

	it('take their texts from the catalogue of their language, every label in both', () => {
		for (const lang of LANGS) {
			const m = webManifest(lang);
			expect(m.description).toBe(install[lang].manifest.description);
			expect(m.shortcuts.map((s) => s.name)).toEqual([install[lang].manifest.shortcuts.prices, install[lang].manifest.shortcuts.faq]);
			expect(m.screenshots.map((s) => s.label)).toEqual(SCREENSHOTS.map((s) => install[lang].screens[s.name]));
			for (const s of m.screenshots) expect(s.label.trim(), `${lang}: ${s.src}`).not.toBe('');
		}
		expect(Object.keys(install.en.screens).sort()).toEqual(Object.keys(install.de.screens).sort());
		for (const shot of SCREENSHOTS) for (const lang of LANGS) expect(install[lang].screens[shot.name], `${lang}: ${shot.name}`).toBeTruthy();
	});

	it('lead the shortcuts to the landing page of their language', () => {
		expect(webManifest('de').shortcuts.map((s) => s.url)).toEqual(['/#prices', '/#faq']);
		expect(webManifest('en').shortcuts.map((s) => s.url)).toEqual(['/en/#prices', '/en/#faq']);
	});

	it('give Chrome its larger dialog: narrow and wide screenshots, each a file of the size it declares', () => {
		expect(new Set(SCREENSHOTS.map((s) => s.form))).toEqual(new Set(['narrow', 'wide']));
		for (const lang of LANGS) {
			for (const shot of webManifest(lang).screenshots) {
				expect(shot.src).toMatch(new RegExp(`-${lang}\\.png$`));
				const path = STATIC + shot.src.slice(1);
				expect(existsSync(path), `${shot.src} is missing: run pnpm screens`).toBe(true);
				const { width, height } = pngSize(readFileSync(path));
				expect(`${width}x${height}`, shot.src).toBe(shot.sizes);
				expect(shot.sizes).toBe(`${SCREENSHOT_SIZES[shot.form_factor].width}x${SCREENSHOT_SIZES[shot.form_factor].height}`);
				// Kept small: the dialog loads them over the network, there is no cache of ours.
				expect(readFileSync(path).length, shot.src).toBeLessThan(150 * 1024);
			}
		}
		// Chrome's limits: no side shorter than 320, none longer than 2.3 times the other.
		for (const { width, height } of Object.values(SCREENSHOT_SIZES)) {
			expect(Math.min(width, height)).toBeGreaterThanOrEqual(320);
			expect(Math.max(width, height) / Math.min(width, height)).toBeLessThanOrEqual(2.3);
		}
		expect(screenshotFile({ name: 'running', form: 'wide' }, 'en')).toBe('screenshots/running-wide-en.png');
	});
});
