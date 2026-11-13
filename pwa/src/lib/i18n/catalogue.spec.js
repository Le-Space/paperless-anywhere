import { describe, expect, it } from 'vitest';
import { get } from 'svelte/store';
import { catalogue, currentLang, format, lang, localeOf, savedLang, setLang, t, tr } from './index.js';

/** Every key path of a catalogue, with what kind of value it holds. */
function shape(node, path = '') {
	if (typeof node === 'function') return [`${path}()#${node.length}`];
	if (Array.isArray(node)) return [`${path}[${node.length}]`, ...node.flatMap((v, i) => shape(v, `${path}.${i}`))];
	if (node && typeof node === 'object') return Object.keys(node).sort().flatMap((k) => shape(node[k], path ? `${path}.${k}` : k));
	return [`${path}:${typeof node}`];
}

describe('the app’s catalogue', () => {
	it('has the same keys, of the same kind, in German and English', () => {
		expect(shape(catalogue.en)).toEqual(shape(catalogue.de));
	});
	it('has no empty text', () => {
		const empty = (node, path = '') => (typeof node === 'string' ? (node.trim() ? [] : [path]) : node && typeof node === 'object' ? Object.entries(node).flatMap(([k, v]) => empty(v, `${path}.${k}`)) : []);
		expect([...empty(catalogue.de, 'de'), ...empty(catalogue.en, 'en')]).toEqual([]);
	});
	it('answers a text with arguments in both languages', () => {
		expect(catalogue.de.app.phrase.word(3)).toBe('Wort 3');
		expect(catalogue.en.app.phrase.word(3)).toBe('Word 3');
	});
});

describe('the language', () => {
	it('is German without a choice, and follows a choice at once', () => {
		expect(savedLang()).toBe('de');
		expect(currentLang()).toBe('de');
		expect(tr().app.lock).toBe('Sperren');
		setLang('en');
		expect(currentLang()).toBe('en');
		expect(tr().app.lock).toBe('Lock');
		expect(get(t).app.lock).toBe('Lock');
		// Anything else is not a language.
		setLang(/** @type {any} */ ('fr'));
		expect(get(lang)).toBe('en');
		setLang('de');
		expect(tr().app.lock).toBe('Sperren');
	});
	it('formats dates, numbers and money for the language', () => {
		expect(localeOf('de')).toBe('de-DE');
		expect(localeOf('en')).toBe('en-GB');
		expect(format.euro(490, 'de')).toBe('4,90 €');
		expect(format.euro(490, 'en')).toBe('€4.90');
		expect(format.number(1234.5, undefined, 'de')).toBe('1.234,5');
		expect(format.number(1234.5, undefined, 'en')).toBe('1,234.5');
		expect(format.date('2026-11-13T12:00:00Z', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }, 'de')).toBe('13.11.2026');
		expect(format.date('2026-11-13T12:00:00Z', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }, 'en')).toBe('13/11/2026');
	});
});
