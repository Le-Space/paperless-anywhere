import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { get } from 'svelte/store';
import { BAR, THEME_KEY, applyTheme, createTheme, savedTheme } from './theme.js';

const storage = (/** @type {Record<string, string>} */ start = {}) => {
	const kept = { ...start };
	return {
		kept,
		getItem: (/** @type {string} */ k) => kept[k] ?? null,
		setItem: (/** @type {string} */ k, /** @type {string} */ v) => void (kept[k] = v),
		removeItem: (/** @type {string} */ k) => void delete kept[k]
	};
};
// As much of a document as the store touches.
const page = () => {
	/** @type {Record<string, string>} */
	const attrs = {};
	const meta = (/** @type {string} */ media, /** @type {string} */ content) => {
		const own = /** @type {Record<string, string>} */ ({ media, content });
		return { own, getAttribute: (/** @type {string} */ k) => own[k] ?? null, setAttribute: (/** @type {string} */ k, /** @type {string} */ v) => void (own[k] = v) };
	};
	const metas = [meta('(prefers-color-scheme: light)', BAR.light), meta('(prefers-color-scheme: dark)', BAR.dark)];
	const doc = {
		documentElement: { setAttribute: (/** @type {string} */ k, /** @type {string} */ v) => void (attrs[k] = v), removeAttribute: (/** @type {string} */ k) => void delete attrs[k] },
		querySelectorAll: () => metas
	};
	return { attrs, metas, doc: /** @type {Document} */ (/** @type {unknown} */ (doc)) };
};

describe('light and dark in the v0.2 interface', () => {
	it('follows the system without a choice, and takes nothing else for a look', () => {
		expect(savedTheme(storage())).toBe('system');
		expect(savedTheme(null)).toBe('system');
		expect(savedTheme(storage({ [THEME_KEY]: 'sepia' }))).toBe('system');
		const s = storage();
		const { theme, setTheme } = createTheme(s, page().doc);
		setTheme(/** @type {any} */ ('sepia'));
		expect(get(theme)).toBe('system');
		expect(s.kept).toEqual({});
	});
	it('applies a choice at once, remembers it, and colours the browser\'s bars to match', () => {
		const s = storage();
		const p = page();
		const { theme, setTheme } = createTheme(s, p.doc);
		setTheme('dark');
		expect(get(theme)).toBe('dark');
		expect(s.kept).toEqual({ [THEME_KEY]: 'dark' });
		expect(p.attrs).toEqual({ 'data-theme': 'dark' });
		expect(p.metas.map((m) => m.own.content)).toEqual([BAR.dark, BAR.dark]);
	});
	it('starts with the remembered choice', () => {
		const p = page();
		const { theme } = createTheme(storage({ [THEME_KEY]: 'light' }), p.doc);
		expect(get(theme)).toBe('light');
		expect(p.attrs).toEqual({ 'data-theme': 'light' });
	});
	it('goes back to the system: no entry, no attribute, the bars as delivered', () => {
		const s = storage({ [THEME_KEY]: 'dark' });
		const p = page();
		const { setTheme } = createTheme(s, p.doc);
		setTheme('system');
		expect(s.kept).toEqual({});
		expect(p.attrs).toEqual({});
		expect(p.metas.map((m) => m.own.content)).toEqual([BAR.light, BAR.dark]);
	});
	it('leaves the document to the system when the interface is left, and keeps the choice', () => {
		const s = storage({ [THEME_KEY]: 'dark' });
		const p = page();
		const { releaseTheme } = createTheme(s, p.doc);
		releaseTheme();
		expect(p.attrs).toEqual({});
		expect(s.kept).toEqual({ [THEME_KEY]: 'dark' });
	});
	it('holds for the visit when storage refuses', () => {
		const p = page();
		const refusing = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); }, removeItem: () => { throw new Error('blocked'); } };
		const { theme, setTheme } = createTheme(refusing, p.doc);
		setTheme('light');
		expect(get(theme)).toBe('light');
		expect(p.attrs).toEqual({ 'data-theme': 'light' });
		applyTheme('dark', undefined);
	});
	it('the script that runs before the first paint reads the same key and values', () => {
		const early = readFileSync(new URL('../../../static/theme.js', import.meta.url), 'utf8');
		expect(early).toContain(`'${THEME_KEY}'`);
		expect(early).toContain("chosen === 'light' || chosen === 'dark'");
	});
	it('the chosen night has the same values as the system\'s night', () => {
		const css = readFileSync(new URL('../theme.css', import.meta.url), 'utf8');
		const block = (/** @type {RegExp} */ re) => (css.match(re)?.[1] ?? '').split('\n').map((l) => l.trim()).filter(Boolean);
		const system = block(/:root:not\(\[data-theme='light'\]\) \{\n([\s\S]*?)\n\t\}/);
		const chosen = block(/:root\[data-theme='dark'\] \{\n([\s\S]*?)\n\}/);
		expect(system.length).toBeGreaterThan(15);
		expect(chosen).toEqual(system);
	});
});
