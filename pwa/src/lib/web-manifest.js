// The web app manifest, one per language: what a browser shows when it offers
// to install Paperless anywhere, and what the installed app is. Written at
// build time (routes/manifest.webmanifest, routes/manifest.en.webmanifest)
// from the catalogue (i18n/install.js), so its texts are translated like every
// other text.
//
// Which page links which: the shell (app.html) links the German one; the
// prerendered English pages get the English one (hooks.server.js), and the
// landing page and the app follow a change of language (linkManifest).
//
// Both name the same app (one `id`), open the app at /app/ and differ only in
// language, texts and screenshots. The screenshots come from the screen tour
// (e2e-screens/tour.spec.js, run on demand), narrow for phones and wide for
// desktops: Chrome shows them in its larger install dialog. Nothing here is
// precached: the site has no service worker.

import { install } from './i18n/install.js';

/** @typedef {'de' | 'en'} Lang */

/** Where each language's manifest lies, from the site's root. */
export const MANIFEST_PATHS = /** @type {const} */ ({ de: '/manifest.webmanifest', en: '/manifest.en.webmanifest' });

/** The size of a screenshot of each form factor: a phone and a desktop window. */
export const SCREENSHOT_SIZES = /** @type {const} */ ({ narrow: { width: 412, height: 915 }, wide: { width: 1280, height: 800 } });

/**
 * The screenshots, in the order a browser shows them; `name` is the file's
 * name and the label's key in the catalogue (install.screens).
 * @type {ReadonlyArray<{ name: keyof typeof install.de.screens, form: keyof typeof SCREENSHOT_SIZES }>}
 */
export const SCREENSHOTS = [
	{ name: 'running', form: 'narrow' },
	{ name: 'backups', form: 'narrow' },
	{ name: 'evidence', form: 'narrow' },
	{ name: 'landing', form: 'narrow' },
	{ name: 'running', form: 'wide' },
	{ name: 'backups', form: 'wide' },
	{ name: 'evidence', form: 'wide' },
	{ name: 'landing', form: 'wide' }
];

/** The file of a screenshot, below static/ and the site's root. @param {{ name: string, form: string }} shot @param {Lang} lang */
export const screenshotFile = ({ name, form }, lang) => `screenshots/${name}-${form}-${lang}.png`;

/** Where the landing page of a language lives. */
const LANDING = { de: '/', en: '/en/' };

/** @param {Lang} lang */
export function webManifest(lang) {
	const t = install[lang];
	return {
		// The same app in both languages; it was start_url before this was set.
		id: '/app/',
		name: 'Paperless anywhere',
		short_name: 'Paperless anywhere',
		description: t.manifest.description,
		lang,
		dir: 'ltr',
		start_url: '/app/',
		scope: '/',
		display: 'standalone',
		background_color: '#faf6ee',
		theme_color: '#faf6ee',
		categories: ['productivity', 'business', 'utilities'],
		icons: [
			{ src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
			{ src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
			{ src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }
		],
		// A long press on the installed app's icon: the landing page's prices and questions.
		shortcuts: [
			{ name: t.manifest.shortcuts.prices, url: `${LANDING[lang]}#prices`, icons: [{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' }] },
			{ name: t.manifest.shortcuts.faq, url: `${LANDING[lang]}#faq`, icons: [{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' }] }
		],
		screenshots: SCREENSHOTS.map((shot) => {
			const { width, height } = SCREENSHOT_SIZES[shot.form];
			return { src: `/${screenshotFile(shot, lang)}`, sizes: `${width}x${height}`, type: 'image/png', form_factor: shot.form, label: t.screens[shot.name] };
		})
	};
}

/** The manifest of `lang` as the response of a prerendered route. @param {Lang} lang */
export function manifestResponse(lang) {
	return new Response(JSON.stringify(webManifest(lang), null, '\t') + '\n', { headers: { 'content-type': 'application/manifest+json' } });
}

/**
 * Points the page's manifest link at the manifest of `lang`: the landing page
 * and the app change language without a reload. In the browser only.
 * @param {Lang} lang
 */
export function linkManifest(lang) {
	const link = /** @type {HTMLLinkElement | null} */ (document.querySelector('link[rel="manifest"]'));
	if (!link) return;
	const href = link.getAttribute('href') ?? '';
	const next = href.replace(/manifest(?:\.en)?\.webmanifest$/, MANIFEST_PATHS[lang].slice(1));
	if (next !== href) link.setAttribute('href', next);
}
