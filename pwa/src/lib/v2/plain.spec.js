import { describe, expect, it } from 'vitest';
import { overlay } from './plain.js';
import { catalogue } from '../i18n/index.js';
import { panelTexts } from '../evidence-i18n.js';
import { BACKUP_TEXTS } from '../backup-overview.js';

describe('plain words laid over a part’s texts', () => {
	it('replaces what is named and keeps the rest, without changing either', () => {
		const base = { a: 'A', b: { c: 'C', d: (/** @type {number} */ n) => `d${n}` }, list: ['x'] };
		const over = { b: { c: 'plain' }, list: ['y', 'z'] };
		const out = overlay(base, over);
		expect(out.a).toBe('A');
		expect(out.b.c).toBe('plain');
		expect(out.b.d(2)).toBe('d2');
		expect(out.list).toEqual(['y', 'z']);
		expect(base.b.c).toBe('C');
		expect(over).toEqual({ b: { c: 'plain' }, list: ['y', 'z'] });
	});
	it('names only keys the part really has, in both languages', () => {
		// A plain text under a key the part does not read would never show.
		const keysOf = (/** @type {any} */ o, p = '') => Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' && !Array.isArray(v) ? keysOf(v, `${p}${k}.`) : [`${p}${k}`]));
		for (const l of /** @type {const} */ (['de', 'en'])) {
			const plain = catalogue[l].v2.plain;
			const { stop, ...start } = plain.panel;
			const startKeys = keysOf(panelTexts[l]);
			expect(keysOf(start).filter((k) => !startKeys.includes(k) && !['details', 'hide'].includes(k)), `${l} panel`).toEqual([]);
			const stopKeys = keysOf(panelTexts[l].stop);
			expect(keysOf(stop).filter((k) => !stopKeys.includes(k)), `${l} stop panel`).toEqual([]);
			const firstKeys = keysOf(catalogue[l].first);
			expect(keysOf(plain.first).filter((k) => !firstKeys.includes(k)), `${l} first start`).toEqual([]);
			const nowKeys = keysOf(BACKUP_TEXTS[l]);
			expect(keysOf(plain.backupNow).filter((k) => !nowKeys.includes(k)), `${l} backup now`).toEqual([]);
		}
	});
	it('leaves no jargon in the plain panel and journey', () => {
		const words = /Image|Attestierung|attestation|Passphrase|passphrase|INSTANCE|VM\b|Knoten|Build-Dienst|build service|Messwert|measurement/;
		for (const l of /** @type {const} */ (['de', 'en'])) {
			const plain = catalogue[l].v2.plain;
			const texts = (/** @type {any} */ o) => Object.values(o).flatMap((v) => (typeof v === 'string' ? [v] : typeof v === 'function' ? [String(v(1, 2))] : v && typeof v === 'object' ? texts(v) : []));
			expect(texts(plain).filter((s) => words.test(s)), l).toEqual([]);
		}
	});
});
