// Light or dark in the v0.2 interface: "system" follows the device (as v0.1
// does), "light" and "dark" hold whatever the device says. The choice is the
// attribute data-theme on <html>, which theme.css reads; static/theme.js sets
// it before the first paint, this store when the person chooses.
//
// Remembered per device in localStorage, where nothing secret is kept; "system"
// removes the entry. With storage blocked the choice holds for this visit.
import { writable } from 'svelte/store';

/** @typedef {'system' | 'light' | 'dark'} Theme */
export const THEMES = /** @type {const} */ (['system', 'light', 'dark']);
export const THEME_KEY = 'paperless-anywhere.theme';
// The page background of each look, for the browser's own bars (as in app.html).
export const BAR = { light: '#faf6ee', dark: '#0b0e15' };

/** @param {Pick<Storage, 'getItem'> | null | undefined} [storage] @returns {Theme} */
export function savedTheme(storage = globalThis.localStorage) {
	try {
		const own = storage?.getItem(THEME_KEY);
		return own === 'light' || own === 'dark' ? own : 'system';
	} catch {
		return 'system';
	}
}

/** Put a look on the document: the attribute, and the colour of the browser's bars. @param {Theme} next @param {Document | undefined} [doc] */
export function applyTheme(next, doc = globalThis.document) {
	if (!doc) return;
	if (next === 'system') doc.documentElement.removeAttribute('data-theme');
	else doc.documentElement.setAttribute('data-theme', next);
	for (const meta of doc.querySelectorAll('meta[name="theme-color"]')) {
		const own = /dark/.test(meta.getAttribute('media') ?? '') ? BAR.dark : BAR.light;
		meta.setAttribute('content', next === 'system' ? own : BAR[next]);
	}
}

/**
 * @param {Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null | undefined} [storage] injectable for tests
 * @param {Document | undefined} [doc]
 */
export function createTheme(storage = globalThis.localStorage, doc = globalThis.document) {
	/** @type {import('svelte/store').Writable<Theme>} */
	const theme = writable(savedTheme(storage));
	applyTheme(savedTheme(storage), doc);
	/** Choose a look: applied at once, remembered in this browser. @param {Theme} next */
	const setTheme = (next) => {
		if (!THEMES.includes(next)) return;
		try {
			if (next === 'system') storage?.removeItem(THEME_KEY);
			else storage?.setItem(THEME_KEY, next);
		} catch {
			/* only for this visit */
		}
		applyTheme(next, doc);
		theme.set(next);
	};
	/** Leaving the interface: the document follows the system again, the choice stays remembered. */
	const releaseTheme = () => applyTheme('system', doc);
	return { theme, setTheme, releaseTheme };
}

export const { theme, setTheme, releaseTheme } = createTheme();
