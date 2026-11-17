import { describe, expect, it, vi } from 'vitest';
import { explorerUrl, independentCandidate, placedConfig, monthlyCost, outsideEu, pickProviders, providerIdsIn, regionCodes, sharedWarnings } from './providers.js';

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
		// Fewer copies, not a stop: the form says "nur 1 unabhängiger Betreiber".
		expect(eu).toMatchObject({ problems: [], operators: 1 });
		expect(pickProviders(list, { copies: 2, regions: ['FR'] }).problems[0]).toMatch(/2 Kopien/);
		// EU first, then the rest of Europe.
		expect(pickProviders(list, { copies: 2, regions: ['EUROPE'] }).picked.map((x) => x.id)).toEqual([7, 9]);
	});

	it('checks named providers', () => {
		expect(pickProviders(list, { providerIds: [9, 4] })).toEqual({ picked: [list[0], list[1]], problems: [] });
		expect(pickProviders(list, { providerIds: [8] }).problems[0]).toMatch(/nicht aktiv/);
		expect(pickProviders(list, { providerIds: [5] }).problems[0]).toMatch(/nicht \(mehr\) zugelassen/);
		expect(pickProviders(list, { providerIds: [4], regions: ['EU'] }).problems[0]).toMatch(/außerhalb/);
	});
});

describe('one operator', () => {
	const fidl = [
		p(36, 'FR', null, { name: 'Cello', endorsed: true, url: 'https://cello.fidl.tech', owner: '0x' + 'd'.repeat(40), payee: '0x' + 'd'.repeat(40) }),
		p(37, 'PL', null, { name: 'Bass', endorsed: true, url: 'https://bass.fidl.tech', owner: '0x' + 'e'.repeat(40), payee: '0x' + 'e'.repeat(40) }),
		p(43, 'FI', null, { name: 'ProbeLab', url: 'https://mainnet.pdp.probelab.io', owner: '0x' + 'f'.repeat(40), payee: '0x' + 'f'.repeat(40) }),
		p(1, 'GB', null, { name: 'ezpdpz-main', url: 'https://main.ezpdpz.net', owner: '0x' + '1'.repeat(40), payee: '0x' + '1'.repeat(40) })
	];
	it('refuses two named copies at one operator while another could take one', () => {
		const r = pickProviders(fidl, { providerIds: [36, 37, 1] });
		expect(r.picked.map((x) => x.id)).toEqual([36, 1]);
		expect(r.problems[0]).toMatch(/Anbieter 37 \(Bass\) gehört zum selben Betreiber wie Cello \(Domain fidl\.tech\)/);
		expect(pickProviders(fidl, { providerIds: [36, 43, 1] }).problems).toEqual([]);
	});
	it('only warns where no other operator is there (Calibration: one operator)', () => {
		const calib = [p(9, 'GB', null, { name: 'ezpdpz-calib', url: 'https://calib.ezpdpz.net' }), p(2, 'GB', null, { name: 'ezpdpz-calib2', url: 'https://calib2.ezpdpz.net' })];
		const r = pickProviders(calib, { providerIds: [9, 2] });
		expect(r.problems).toEqual([]);
		expect(sharedWarnings(r.picked)[0]).toMatch(/demselben Betreiber \(Domain ezpdpz\.net, Name „ezpdpz…“\)/);
	});
	it('never puts two copies of a region at one operator: fewer copies, and says how many operators', () => {
		const eu = pickProviders(fidl, { copies: 3, regions: ['EU'] });
		expect(eu.picked.map((x) => x.id)).toEqual([36, 43]);
		expect(eu).toMatchObject({ operators: 2, problems: [] });
	});
	it('never takes a blocked provider by itself, and refuses one named', () => {
		const blocked = fidl.map((x) => (x.id === 36 || x.id === 37 ? { ...x, blocked: 'fidl' } : x));
		expect(pickProviders(blocked, { copies: 3, regions: ['EU'] })).toMatchObject({ problems: [], operators: 1 });
		expect(pickProviders(blocked, { copies: 3, regions: ['EU'] }).picked.map((x) => x.id)).toEqual([43]);
		expect(pickProviders(blocked, { copies: 3 }).picked.map((x) => x.id)).toEqual([43, 1]);
		// Europe with 36/37 blocked: ProbeLab in the EU first, then GB.
		expect(pickProviders(blocked, { copies: 3, regions: ['EUROPE'] })).toMatchObject({ problems: [], operators: 2 });
		expect(pickProviders(blocked, { copies: 3, regions: ['EUROPE'] }).picked.map((x) => x.id)).toEqual([43, 1]);
		const named = pickProviders(blocked, { providerIds: [36, 43, 1] });
		expect(named.picked.map((x) => x.id)).toEqual([43, 1]);
		expect(named.problems[0]).toMatch(/Anbieter 36 \(Cello\) ist gesperrt: FIDL/);
		expect(independentCandidate(blocked, [blocked[3]], [])?.provider.id).toBe(43);
	});
	it('a region becomes named providers at the start; named ones stay', async () => {
		const blocked = fidl.map((x) => (x.id === 36 || x.id === 37 ? { ...x, blocked: 'fidl' } : x));
		const list = async () => blocked;
		expect(await placedConfig('mainnet', { copies: 3, providerIds: [], regions: ['EU'], keepWeeks: 12 }, { list })).toEqual({ copies: 1, providerIds: [43], regions: ['EU'], keepWeeks: 12 });
		expect(await placedConfig('mainnet', { copies: 2, providerIds: [36, 37], regions: [] }, { list })).toEqual({ copies: 2, providerIds: [36, 37], regions: [] });
		const down = async () => { throw new Error('rpc'); };
		expect(await placedConfig('mainnet', { copies: 3, providerIds: [], regions: ['EU'] }, { list: down })).toEqual({ copies: 3, providerIds: [], regions: ['EU'] });
	});
	it('Europe: three operators, the EU first, then GB', () => {
		const shuffled = [fidl[3], fidl[0], fidl[1], fidl[2]];
		expect(pickProviders(shuffled, { copies: 3, regions: ['EUROPE'] }).picked.map((x) => x.id)).toEqual([36, 43, 1]);
	});
	it('a region becomes named providers at the start; named ones stay', async () => {
		const list = async () => fidl;
		expect(await placedConfig('mainnet', { copies: 3, providerIds: [], regions: ['EUROPE'], keepWeeks: 12 }, { list })).toEqual({ copies: 3, providerIds: [36, 43, 1], regions: ['EUROPE'], keepWeeks: 12 });
		expect(await placedConfig('mainnet', { copies: 3, providerIds: [], regions: ['EU'] }, { list })).toMatchObject({ copies: 2, providerIds: [36, 43] });
		expect(await placedConfig('mainnet', { copies: 2, providerIds: [36, 37], regions: [] }, { list })).toEqual({ copies: 2, providerIds: [36, 37], regions: [] });
		const down = async () => { throw new Error('rpc'); };
		expect(await placedConfig('mainnet', { copies: 3, providerIds: [], regions: ['EU'] }, { list: down })).toEqual({ copies: 3, providerIds: [], regions: ['EU'] });
	});
	it('finds where an independent copy could go', () => {
		expect(independentCandidate(fidl, [fidl[0], fidl[1]], ['EU'])).toEqual({ provider: fidl[2], inRegion: true });
		expect(independentCandidate(fidl, [fidl[0], fidl[2]], ['EU'])).toEqual({ provider: fidl[3], inRegion: false });
		expect(independentCandidate(fidl, fidl, [])).toBeNull();
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

describe('provider health', () => {
	it('finds the providers the VM names in its lines', () => {
		expect(providerIdsIn(['error: StoreError: Failed to store piece on service provider 43 (https://…', 'provider 36 ok', 'nothing'])).toEqual([43, 36]);
	});
	it('pings each provider and keeps what answered, with a link to the explorer', async () => {
		const client = {};
		const answers = { 'https://a.example.com/pdp/ping': 200, 'https://b.example.com/pdp/ping': 503 };
		const fetch = async (url) => {
			if (!(url in answers)) throw new TypeError('network');
			return new Response('', { status: answers[url] });
		};
		vi.resetModules();
		vi.doMock('@filoz/synapse-core/sp-registry', () => ({
			getPDPProvidersByIds: async () => [
				{ id: 1n, name: 'A', serviceProvider: '0x' + '1'.repeat(40), pdp: { serviceURL: 'https://a.example.com/', location: 'C=FI;L=Helsinki' } },
				{ id: 2n, name: 'B', serviceProvider: '0x' + '2'.repeat(40), pdp: { serviceURL: 'https://b.example.com' } },
				{ id: 3n, name: 'C', serviceProvider: '0x' + '3'.repeat(40), pdp: { serviceURL: 'https://c.example.com' } },
				{ id: 4n, name: 'D', serviceProvider: '0x' + '4'.repeat(40), pdp: { serviceURL: 'http://d.example.com' } }
			]
		}));
		const { providerHealth: health } = await import('./providers.js');
		const h = await health('mainnet', [1, 2, 3, 4], { fetch, client });
		expect(h.map((x) => [x.id, x.ok, x.status])).toEqual([[1, true, 200], [2, false, 503], [3, false, null], [4, false, null]]);
		expect(h[0].explorer).toBe(`https://filfox.info/en/address/0x${'1'.repeat(40)}`);
		vi.doUnmock('@filoz/synapse-core/sp-registry');
	});
	it('links the test network to its own explorer', () => {
		expect(explorerUrl('calibration', '0xabc')).toBe('https://calibration.filfox.info/en/address/0xabc');
	});
});
