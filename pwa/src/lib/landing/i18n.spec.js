import { describe, expect, it } from 'vitest';
import { texts } from './i18n.js';

describe('the landing page\'s counted sentences', () => {
	it('say one provider in one country as such', () => {
		expect(texts.de.storage.count(1, 1)).toBe('1 zugelassener Anbieter in 1 Land');
		expect(texts.de.storage.count(6, 4)).toBe('6 zugelassene Anbieter in 4 Ländern');
		expect(texts.en.storage.count(1, 1)).toBe('1 approved provider in 1 country');
		expect(texts.en.storage.count(6, 4)).toBe('6 approved providers in 4 countries');
	});
	it('say one node of one operator as such', () => {
		expect(texts.de.nodes.resilience(1, 1, 1)).toBe('1 vertraulicher Knoten von 1 Betreiber in 1 Land');
		expect(texts.en.nodes.resilience(1, 1, 1)).toBe('1 confidential node of 1 operator in 1 country');
		expect(texts.de.nodes.resilience(13, 5, 4)).toBe('13 vertrauliche Knoten von 5 Betreibern in 4 Ländern');
	});
});

describe('the headline', () => {
	it('names its three words in the sentence a screen reader gets, in both languages', () => {
		for (const lang of /** @type {const} */ (['de', 'en'])) {
			const { words, full, before } = texts[lang].hero;
			expect(words).toHaveLength(3);
			expect(full.startsWith(before)).toBe(true);
			for (const w of words) expect(full).toContain(w.replace(/\.$/, ''));
			for (const w of words.slice(0, 2)) expect(texts[lang].title).toContain(w.replace(/\.$/, ''));
		}
	});
});
