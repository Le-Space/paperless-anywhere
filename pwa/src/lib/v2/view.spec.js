import { describe, expect, it } from 'vitest';
import { get } from 'svelte/store';
import { VIEW_KEY, createView, savedView } from './view.js';

const storage = (/** @type {Record<string, string>} */ start = {}) => {
	const kept = { ...start };
	return { kept, getItem: (/** @type {string} */ k) => kept[k] ?? null, setItem: (/** @type {string} */ k, /** @type {string} */ v) => void (kept[k] = v) };
};

describe('the view of the v0.2 interface', () => {
	it('is "standard" without a choice', () => {
		expect(savedView(storage())).toBe('standard');
		expect(savedView(null)).toBe('standard');
	});
	it('starts in "technical" for someone who chose "Erweitert" in v0.1', () => {
		expect(savedView(storage({ 'paperless-anywhere.tab': 'advanced' }))).toBe('technical');
		expect(savedView(storage({ 'paperless-anywhere.tab': 'simple' }))).toBe('standard');
	});
	it('prefers its own choice over the one from v0.1', () => {
		expect(savedView(storage({ 'paperless-anywhere.tab': 'advanced', [VIEW_KEY]: 'standard' }))).toBe('standard');
	});
	it('takes nothing else for a view', () => {
		expect(savedView(storage({ [VIEW_KEY]: 'expert' }))).toBe('standard');
		const s = storage();
		const { view, setView } = createView(s);
		setView(/** @type {any} */ ('expert'));
		expect(get(view)).toBe('standard');
		expect(s.kept).toEqual({});
	});
	it('applies a choice at once and remembers it, without touching the choice of v0.1', () => {
		const s = storage({ 'paperless-anywhere.tab': 'simple' });
		const { view, setView, technical } = createView(s);
		expect(get(technical)).toBe(false);
		setView('technical');
		expect(get(view)).toBe('technical');
		expect(get(technical)).toBe(true);
		expect(s.kept).toEqual({ 'paperless-anywhere.tab': 'simple', [VIEW_KEY]: 'technical' });
	});
	it('holds for this visit when storage is blocked', () => {
		const blocked = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
		const { view, setView } = createView(blocked);
		expect(get(view)).toBe('standard');
		setView('technical');
		expect(get(view)).toBe('technical');
	});
});
