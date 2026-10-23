import { describe, expect, it } from 'vitest';
import { monthlyCost, outsideEu, pickProviders, regionCodes, sharedWarnings } from './providers.js';

// Made-up providers, shaped like listProviders' answer (endorsed first).
const p = (id, country, operator, extra = {}) => ({ id, name: `sp-${id}`, location: `C=${country};L=Stadt ${country}`, place: `${country}, Stadt ${country}`, country, operator, endorsed: false, active: true, ...extra });
const list = [p(9, 'GB', 'one.example', { endorsed: true }), p(4, 'US', 'two.example', { endorsed: true }), p(2, 'GB', 'one.example'), p(7, 'DE', 'three.example'), p(8, 'NL', 'four.example', { active: false })];

describe('regionCodes', () => {
	it('expands the presets and keeps country codes', () => {
		expect(regionCodes(['EUROPE'])).toContain('GB');
		expect(regionCodes(['EU'])).not.toContain('GB');
		expect(regionCodes(['de', 'NL'])).toEqual(['DE', 'NL']);
		expect(regionCodes([])).toEqual([]);
	});
});

describe('pickProviders', () => {
	it('takes one copy per operator first, endorsed first', () => {
		expect(pickProviders(list, { copies: 2 }).picked.map((x) => x.id)).toEqual([9, 4]);
		expect(pickProviders(list, { copies: 3 }).picked.map((x) => x.id)).toEqual([9, 4, 7]);
	});

	it('stays inside the region and says when it is too small', () => {
		const eu = pickProviders(list, { copies: 2, regions: ['EU'] });
		expect(eu.picked.map((x) => x.id)).toEqual([7]);
		expect(eu.problems[0]).toMatch(/2 Kopien/);
		expect(pickProviders(list, { copies: 2, regions: ['EUROPE'] }).picked.map((x) => x.id)).toEqual([9, 7]);
	});

	it('checks named providers', () => {
		expect(pickProviders(list, { providerIds: [9, 2] })).toEqual({ picked: [list[0], list[2]], problems: [] });
		expect(pickProviders(list, { providerIds: [8] }).problems[0]).toMatch(/nicht aktiv/);
		expect(pickProviders(list, { providerIds: [5] }).problems[0]).toMatch(/nicht \(mehr\) zugelassen/);
		expect(pickProviders(list, { providerIds: [4], regions: ['EU'] }).problems[0]).toMatch(/außerhalb/);
	});
});

describe('sharedWarnings', () => {
	it('warns when two copies share an operator or a place', () => {
		expect(sharedWarnings([list[0], list[2]])[0]).toMatch(/demselben Betreiber/);
		expect(sharedWarnings([list[0], p(3, 'GB', 'five.example')])[0]).toMatch(/am selben Ort/);
		expect(sharedWarnings([list[0], list[1]])).toEqual([]);
	});
});

describe('monthlyCost', () => {
	it('is the data-set fee plus the size per copy', () => {
		expect(monthlyCost({ perTibMonth: 2.5, perDataSetMonth: 0.12 }, 2, 2 ** 40)).toBeCloseTo(5.24);
		expect(monthlyCost({ perTibMonth: 2.5, perDataSetMonth: 0.12 }, 1, 0)).toBeCloseTo(0.12);
	});
});

describe('outsideEu', () => {
	it('names the countries outside the EU, once each', () => {
		expect(outsideEu([list[0], list[1], list[2], list[3]])).toEqual(['GB', 'US']);
		expect(outsideEu([list[3]])).toEqual([]);
		expect(outsideEu([p(6, null, 'six.example')])).toEqual(['??']);
	});
});
