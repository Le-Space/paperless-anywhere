import { describe, expect, it } from 'vitest';
import { privateKeyToAccount } from 'viem/accounts';
import { alephPrivateKey } from './keys/derive.js';
import { buildImageForVault, forgetOldImage } from './own-image-build.js';

const master = new Uint8Array(32).fill(7);
const program = { verification: { measurements: [{ registers: { launch: 'ab'.repeat(48) } }], policy: 196608 } };
const versions = [];
const builder = { program, crn: '0c'.repeat(32), measurements: ['ab'.repeat(48)], policy: 196608, plain: { sha256: 'ef'.repeat(32) } };
const image = { rootfsItemHash: '9a'.repeat(32), luksPassphrase: 'p', luksFor: '9a'.repeat(32), ownImage: {} };

/** Records which path ran and what it was given. */
function deps({ types = ['INSTANCE', 'V-PROGRAM', 'STORE', 'FORGET', 'AGGREGATE'], quote = { included: false, chargedCredits: 5 } } = {}) {
	const seen = [];
	return {
		seen,
		deps: {
			authorize: async () => (seen.push('authorize'), { owner: '0x' + 'a'.repeat(40), types }),
			build: async (_m, what) => (seen.push(what?.quote ? 'quote' : 'charge'), versions.push(what?.version), { ...quote, buildId: 'b1', owner: '0x' + 'a'.repeat(40) }),
			done: async () => seen.push('done'),
			paid: async (a) => (seen.push('paid'), await a.onStarted('5e'.repeat(32), { buildId: 'b1', payer: '0x' + 'a'.repeat(40) }), await a.onForgotten(), image),
			own: async (a) => (seen.push('own'), await a.onStarted('5e'.repeat(32)), await a.onForgotten(), image),
			running: async () => (seen.push('running'), image),
			opener: () => async () => ({}),
			relays: async () => (seen.push('relays'), ['wss://relay.example/attest'])
		}
	};
}

describe('building the own image for a vault', () => {
	it('with a package: authorize, price, agree, build paid by the package, notes cleared', async () => {
		const { seen, deps: d } = deps();
		const saved = [];
		const asked = [];
		const yes = [];
		const out = await buildImageForVault({ master, profile: {}, packagePays: true, confirm: (q, y) => (asked.push(q), yes.push(y), true), save: async (p) => void saved.push(p), builder, deps: d });
		expect(out).toBe(image);
		expect(seen).toEqual(['relays', 'authorize', 'quote', 'paid']);
		// The service learns which image version: the plain image's SHA-256.
		expect(versions).toEqual(['ef'.repeat(32)]);
		expect(asked[0]).toMatch(/abgebucht/);
		// A charge is agreed with a button that names it (§ 312j Abs. 3 BGB).
		expect(yes[0]).toBe('Jetzt kostenpflichtig kaufen');
		expect(saved[0].ownBuilder).toMatchObject({ vprogram: '5e'.repeat(32), buildId: 'b1' });
		expect(saved.at(-1)).toEqual({ ownBuilder: null });
	});

	it('says when a voucher includes the build, and builds nothing when the person declines', async () => {
		const { seen, deps: d } = deps({ quote: { included: true, chargedCredits: 0 } });
		const asked = [];
		const yes = [];
		expect(await buildImageForVault({ master, profile: {}, packagePays: true, confirm: (q, y) => (asked.push(q), yes.push(y), false), save: async () => {}, builder, deps: d })).toBeNull();
		expect(asked[0]).toMatch(/Dieser Bau ist enthalten/);
		// Nothing charged: the plain yes.
		expect(yes[0]).toBeUndefined();
		expect(seen).toEqual(['relays', 'authorize', 'quote']);
	});

	it('refuses when the service does not grant V-PROGRAM and STORE yet', async () => {
		const { deps: d } = deps({ types: ['INSTANCE', 'FORGET', 'AGGREGATE'] });
		await expect(buildImageForVault({ master, profile: {}, packagePays: true, confirm: () => true, save: async () => {}, builder, deps: d })).rejects.toThrow(/V-PROGRAM/);
	});

	it('without a package: the app address pays, no price asked', async () => {
		const { seen, deps: d } = deps();
		const asked = [];
		expect(await buildImageForVault({ master, profile: {}, packagePays: false, confirm: (q) => (asked.push(q), true), save: async () => {}, builder, deps: d })).toBe(image);
		expect(seen).toEqual(['relays', 'own']);
		expect(asked).toEqual([]);
		const fixed = deps();
		const { program: _p, crn: _c, ...running } = builder;
		await buildImageForVault({ master, profile: {}, packagePays: false, confirm: () => true, save: async () => {}, builder: { ...running, route: '?vm=x' }, deps: fixed.deps });
		expect(fixed.seen).toEqual(['relays', 'running']);
	});

	it('finds a relay before anything is charged or started', async () => {
		const { seen, deps: d } = deps();
		const none = { ...d, relays: async () => { seen.push('relays'); throw new Error('Kein Attest-Relay'); } };
		await expect(buildImageForVault({ master, profile: {}, packagePays: true, confirm: () => true, save: async () => {}, builder, deps: none })).rejects.toThrow('Kein Attest-Relay');
		expect(seen).toEqual(['relays']);
	});

	it('after a rebuild, keeps the old own image as the way back and forgets nothing yet', async () => {
		const app = privateKeyToAccount(alephPrivateKey(master));
		const owner = '0x' + 'a'.repeat(40);
		const old = '7f'.repeat(32);
		const sent = [];
		const { deps: d } = deps();
		const read = async (hash) => ({ status: 'processed', message: { type: 'STORE', sender: app.address, content: { address: owner }, item_hash: hash } });
		const post = async (m) => void sent.push({ type: m.type, content: JSON.parse(m.item_content) });
		const profile = { rootfsItemHash: old, luksFor: old, ownImage: { plainSha256: 'ef'.repeat(32) } };
		const built = await buildImageForVault({ master, profile, packagePays: false, confirm: () => true, save: async () => {}, builder, deps: { ...d, read, post } });
		expect(sent).toEqual([]);
		expect(built.ownImage.previous.rootfsItemHash).toBe(old);
		// A first build replaces no own image: nothing forgotten.
		sent.length = 0;
		await buildImageForVault({ master, profile: { rootfsItemHash: 'bb'.repeat(32), luksPassphrase: 'p' }, packagePays: false, confirm: () => true, save: async () => {}, builder, deps: { ...d, read, post } });
		expect(sent).toEqual([]);
	});

	it('forgets only a STORE this vault\'s key sent', async () => {
		const app = privateKeyToAccount(alephPrivateKey(master));
		const sent = [];
		const post = async (m) => void sent.push(m.type);
		const other = async () => ({ status: 'processed', message: { type: 'STORE', sender: '0x' + 'b'.repeat(40), content: { address: '0x' + 'b'.repeat(40) } } });
		expect(await forgetOldImage(app, '7f'.repeat(32), { read: other, post })).toBe(false);
		const gone = async () => ({ status: 'forgotten', message: { type: 'STORE' } });
		expect(await forgetOldImage(app, '7f'.repeat(32), { read: gone, post })).toBe(false);
		expect(sent).toEqual([]);
	});
});
