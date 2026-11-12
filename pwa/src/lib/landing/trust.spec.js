import { describe, expect, it } from 'vitest';
import { RUNTIME } from '../runtime-pin.js';
import { RUNTIME_ITEM_HASH } from './trust.js';
import { texts } from './i18n.js';

describe('the trust section of the landing page', () => {
	it('links the runtime the app pins', () => {
		expect(RUNTIME_ITEM_HASH).toBe(RUNTIME.itemHash);
	});

	it('has the same keys in German and English', () => {
		const shape = (v) => (Array.isArray(v) ? v.map(shape) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, shape(x)])) : typeof v);
		expect(shape(texts.en.trust)).toEqual(shape(texts.de.trust));
		expect(Object.keys(texts.en.nav)).toEqual(Object.keys(texts.de.nav));
	});

	it('says what the attestation does not cover yet', () => {
		expect(texts.de.trust.gaps[0]).toMatch(/nicht mitgemessen/);
		expect(texts.en.trust.gaps[0]).toMatch(/not measured/);
	});
});
