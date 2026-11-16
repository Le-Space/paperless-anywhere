import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkDue, forgetCopies, independenceLevel, knownCopies, reachLevel, rememberCopies } from './backup-status.js';

describe('the lights', () => {
	it('reach: green from two answering copies, yellow for one, red for none, grey unchecked', () => {
		expect(reachLevel({ answering: 2, total: 2 })).toBe('ok');
		expect(reachLevel({ answering: 2, total: 3 })).toBe('ok');
		expect(reachLevel({ answering: 1, total: 2 })).toBe('warn');
		expect(reachLevel({ answering: 0, total: 2 })).toBe('bad');
		expect(reachLevel({ answering: 0, total: 0 })).toBe('unknown');
		expect(reachLevel(null)).toBe('unknown');
	});
	it('independence: green only for copies at different operators', () => {
		const cello = { id: 36, name: 'Cello', url: 'https://cello.fidl.tech' };
		const bass = { id: 37, name: 'Bass', url: 'https://bass.fidl.tech' };
		const probe = { id: 43, name: 'ProbeLab', url: 'https://mainnet.pdp.probelab.io' };
		expect(independenceLevel([cello, probe])).toBe('ok');
		expect(independenceLevel([cello, bass])).toBe('warn');
		expect(independenceLevel([cello])).toBe('warn');
		expect(independenceLevel(null)).toBe('unknown');
		expect(independenceLevel([cello, { id: 5, listed: false }])).toBe('unknown');
		// Fewer operators than copies wanted: yellow ("nur 2 unabhängige Betreiber").
		expect(independenceLevel([cello, probe], 3)).toBe('warn');
		expect(independenceLevel([cello, probe], 2)).toBe('ok');
	});
	it('check again after a while, never twice within the gap', () => {
		const at = new Date(1_000_000);
		expect(checkDue(null, 0)).toBe(true);
		expect(checkDue(at, 1_000_000 + 60_000)).toBe(false);
		expect(checkDue(at, 1_000_000 + 5 * 60_000)).toBe(true);
		expect(checkDue(at, 1_000_000 + 10_000, { forced: true })).toBe(false);
		expect(checkDue(at, 1_000_000 + 30_000, { forced: true })).toBe(true);
	});
});

describe('the copies kept for the locked vault', () => {
	const mem = new Map();
	vi.stubGlobal('localStorage', { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) });
	afterEach(() => forgetCopies());
	it('are the network and provider ids only', () => {
		rememberCopies('mainnet', [36, 37, 37]);
		const kept = JSON.parse(localStorage.getItem('paperless-anywhere.backup-copies') ?? '{}');
		expect(Object.keys(kept).sort()).toEqual(['at', 'network', 'providerIds', 'wanted']);
		expect(knownCopies()).toMatchObject({ network: 'mainnet', providerIds: [36, 37] });
		forgetCopies();
		expect(knownCopies()).toBeNull();
	});
});

describe('checkCopies', () => {
	it('asks each copy (its own URL, else the provider’s ping) and names the shared operator', async () => {
		vi.resetModules();
		vi.doMock('@filoz/synapse-core/sp-registry', () => ({
			getPDPProvidersByIds: async () => [
				{ id: 36n, name: 'Cello', serviceProvider: '0x' + 'd'.repeat(40), payee: '0x' + 'd'.repeat(40), pdp: { serviceURL: 'https://cello.fidl.tech', location: 'C=FR;L=Strasbourg' } },
				{ id: 37n, name: 'Bass', serviceProvider: '0x' + 'e'.repeat(40), payee: '0x' + 'e'.repeat(40), pdp: { serviceURL: 'https://bass.fidl.tech/', location: 'C=PL;L=Warsaw' } }
			]
		}));
		const { checkCopies, providersAnswer } = await import('./backup-status.js');
		const asked = [];
		const answers = async (url) => (asked.push(url), url.startsWith('https://bass'));
		const r = await checkCopies({ network: 'mainnet', copies: [{ providerId: 36, url: 'https://cello.fidl.tech/piece/x' }, { providerId: 37 }] }, { client: {}, answers, now: () => new Date(0) });
		expect(asked).toEqual(['https://cello.fidl.tech/piece/x', 'https://bass.fidl.tech/pdp/ping']);
		expect(r).toMatchObject({ answering: 1, total: 2, at: new Date(0) });
		expect(r.copies.map((c) => [c.id, c.domain, c.answers])).toEqual([[36, 'fidl.tech', false], [37, 'fidl.tech', true]]);
		expect(r.pairs.map((p) => p.signs)).toEqual([[{ kind: 'domain', value: 'fidl.tech' }]]);
		expect(await providersAnswer('mainnet', [36, 37], { client: {}, answers: async () => false })).toEqual({ answering: 0, total: 2, names: ['36 Cello', '37 Bass'] });
		vi.doUnmock('@filoz/synapse-core/sp-registry');
	});
	it('is no check when the registry names none of the providers', async () => {
		vi.resetModules();
		vi.doMock('@filoz/synapse-core/sp-registry', () => ({ getPDPProvidersByIds: async () => [] }));
		const { checkCopies } = await import('./backup-status.js');
		await expect(checkCopies({ network: 'mainnet', copies: [{ providerId: 36 }] }, { client: {}, answers: async () => true })).rejects.toThrow();
		vi.doUnmock('@filoz/synapse-core/sp-registry');
	});
	it('says nothing before a stop when the registry cannot be read', async () => {
		vi.resetModules();
		vi.doMock('@filoz/synapse-core/sp-registry', () => ({ getPDPProvidersByIds: async () => { throw new Error('rpc down'); } }));
		const { providersAnswer } = await import('./backup-status.js');
		expect(await providersAnswer('mainnet', [36], { client: {} })).toBeNull();
		expect(await providersAnswer('mainnet', [], { client: {} })).toBeNull();
		vi.doUnmock('@filoz/synapse-core/sp-registry');
	});
});
