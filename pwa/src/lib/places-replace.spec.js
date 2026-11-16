import { describe, expect, it } from 'vitest';
import { replacementPlan } from './places-replace.js';

const p = (id, name, url, country = 'DE', extra = {}) => ({ id, name, url, country, active: true, owner: `0x${String(id).padStart(40, '0')}`, payee: `0x${String(id).padStart(40, '1')}`, ...extra });
const providers = [
	p(36, 'Cello', 'https://cello.op-a.example', 'FR'),
	p(37, 'Bass', 'https://bass.op-a.example', 'PL'),
	p(43, 'Probe', 'https://probe.op-b.example', 'DE'),
	p(44, 'Viola', 'https://viola.op-a.example', 'DE'),
	p(38, 'Brown', 'https://brown.op-c.example', 'GB'),
	p(45, 'Gone', 'https://gone.op-d.example', 'NL', { active: false })
];
const up = (set) => async (url) => set.some((s) => url.includes(s));

describe('a replacement for a provider that does not answer', () => {
	it('takes an answering provider at another operator, in the region', async () => {
		const r = await replacementPlan({ providers, ids: [36, 37], down: [37], regions: ['EU'], answers: up(['probe', 'brown', 'viola']) });
		expect(r.replaced.map((x) => [x.from.id, x.to?.id])).toEqual([[37, 43]]);
		expect(r.ids).toEqual([36, 43]);
	});
	it('never the operator of a copy that stays, nor the one that failed', async () => {
		const r = await replacementPlan({ providers, ids: [36, 37], down: [37], answers: up(['viola', 'brown']) });
		expect(r.replaced[0].to?.id).toBe(38);
	});
	it('both down: two replacements at two different operators', async () => {
		const r = await replacementPlan({ providers, ids: [36, 37], down: [36, 37], answers: up(['probe', 'brown', 'viola']) });
		expect(r.ids).toEqual([43, 38]);
	});
	it('in Europe, the EU before GB', async () => {
		const gbFirst = [providers[4], ...providers.filter((x) => x.id !== 38)];
		const r = await replacementPlan({ providers: gbFirst, ids: [36, 37], down: [37], regions: ['EUROPE'], answers: up(['probe', 'brown']) });
		expect(r.replaced[0].to?.id).toBe(43);
	});
	it('none to be had: the copy is dropped from the places and said so', async () => {
		const r = await replacementPlan({ providers, ids: [36, 37], down: [37], regions: ['EU'], answers: up([]) });
		expect(r.replaced[0].to).toBeNull();
		expect(r.ids).toEqual([36]);
	});
});

describe('a blocked provider', () => {
	it('is never the replacement', async () => {
		const withBlocked = providers.map((x) => (x.id === 43 ? { ...x, blocked: 'fidl' } : x));
		const r = await replacementPlan({ providers: withBlocked, ids: [36, 37], down: [37], answers: up(['probe', 'brown']) });
		expect(r.replaced[0].to?.id).toBe(38);
	});
});
