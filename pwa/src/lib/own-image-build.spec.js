import { describe, expect, it } from 'vitest';
import { buildImageForVault } from './own-image-build.js';

const master = new Uint8Array(32).fill(7);
const program = { verification: { measurements: [{ registers: { launch: 'ab'.repeat(48) } }], policy: 196608 } };
const builder = { program, crn: '0c'.repeat(32), measurements: ['ab'.repeat(48)], policy: 196608, plain: { sha256: 'ef'.repeat(32) } };
const image = { rootfsItemHash: '9a'.repeat(32), luksPassphrase: 'p', luksFor: '9a'.repeat(32), ownImage: {} };

/** Records which path ran and what it was given. */
function deps({ types = ['INSTANCE', 'V-PROGRAM', 'STORE', 'FORGET', 'AGGREGATE'], quote = { included: false, chargedCredits: 5 } } = {}) {
	const seen = [];
	return {
		seen,
		deps: {
			authorize: async () => (seen.push('authorize'), { owner: '0x' + 'a'.repeat(40), types }),
			build: async (_m, what) => (seen.push(what?.quote ? 'quote' : 'charge'), { ...quote, buildId: 'b1', owner: '0x' + 'a'.repeat(40) }),
			done: async () => seen.push('done'),
			paid: async (a) => (seen.push('paid'), await a.onStarted('5e'.repeat(32), { buildId: 'b1', payer: '0x' + 'a'.repeat(40) }), await a.onForgotten(), image),
			own: async (a) => (seen.push('own'), await a.onStarted('5e'.repeat(32)), await a.onForgotten(), image),
			running: async () => (seen.push('running'), image),
			opener: () => async () => ({})
		}
	};
}

describe('building the own image for a vault', () => {
	it('with a package: authorize, price, agree, build paid by the package, notes cleared', async () => {
		const { seen, deps: d } = deps();
		const saved = [];
		const asked = [];
		const out = await buildImageForVault({ master, profile: {}, packagePays: true, confirm: (q) => (asked.push(q), true), save: async (p) => void saved.push(p), builder, deps: d });
		expect(out).toBe(image);
		expect(seen).toEqual(['authorize', 'quote', 'paid']);
		expect(asked[0]).toMatch(/abgebucht/);
		expect(saved[0].ownBuilder).toMatchObject({ vprogram: '5e'.repeat(32), buildId: 'b1' });
		expect(saved.at(-1)).toEqual({ ownBuilder: null });
	});

	it('says when a voucher includes the build, and builds nothing when the person declines', async () => {
		const { seen, deps: d } = deps({ quote: { included: true, chargedCredits: 0 } });
		const asked = [];
		expect(await buildImageForVault({ master, profile: {}, packagePays: true, confirm: (q) => (asked.push(q), false), save: async () => {}, builder, deps: d })).toBeNull();
		expect(asked[0]).toMatch(/im Gutschein enthalten/);
		expect(seen).toEqual(['authorize', 'quote']);
	});

	it('refuses when the service does not grant V-PROGRAM and STORE yet', async () => {
		const { deps: d } = deps({ types: ['INSTANCE', 'FORGET', 'AGGREGATE'] });
		await expect(buildImageForVault({ master, profile: {}, packagePays: true, confirm: () => true, save: async () => {}, builder, deps: d })).rejects.toThrow(/V-PROGRAM/);
	});

	it('without a package: the app address pays, no price asked', async () => {
		const { seen, deps: d } = deps();
		const asked = [];
		expect(await buildImageForVault({ master, profile: {}, packagePays: false, confirm: (q) => (asked.push(q), true), save: async () => {}, builder, deps: d })).toBe(image);
		expect(seen).toEqual(['own']);
		expect(asked).toEqual([]);
		const fixed = deps();
		const { program: _p, crn: _c, ...running } = builder;
		await buildImageForVault({ master, profile: {}, packagePays: false, confirm: () => true, save: async () => {}, builder: { ...running, route: '?vm=x' }, deps: fixed.deps });
		expect(fixed.seen).toEqual(['running']);
	});
});
