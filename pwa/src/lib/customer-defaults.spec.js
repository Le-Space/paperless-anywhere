// A Paperless that Le Space pays for starts with defaults, once, and only
// while nobody has chosen who pays.
import { describe, expect, it } from 'vitest';
import { applyCustomerDefaults, CUSTOMER_PLACES, customerDefaults, undecided } from './customer-defaults.js';
import { ageIdentityFromMaster, ageRecipient } from './keys/age.js';
import { pickNode, startRequirements } from './lifecycle.js';

const master = new Uint8Array(32).fill(3);
const vaultAge = ageIdentityFromMaster(master);
const store = (initial) => {
	let profile = { ...initial };
	return {
		get: () => profile,
		load: async () => ({ ...profile }),
		update: async (_m, fn) => (profile = fn({ ...profile }))
	};
};

describe('defaults for a Paperless Le Space pays for', () => {
	it('are for a profile nobody has set up, and never for one with a choice', () => {
		expect(undecided({})).toBe(true);
		expect(undecided({ payer: '0x0000000000000000000000000000000000000001' })).toBe(false);
		expect(undecided({ appPays: false })).toBe(false);
		expect(undecided({ leSpacePays: false })).toBe(false);
		expect(customerDefaults({ appPays: true }, { network: 'mainnet', vaultAge })).toBeNull();
	});

	it('let Le Space pay, back up through Le Space Credits to three copies in the EU, on the service’s network', () => {
		const d = customerDefaults({}, { network: 'mainnet', vaultAge });
		expect(d).toMatchObject({ leSpacePays: true, appPays: false, backupsByCredits: true, network: 'mainnet', role: 'primary', ageIdentity: vaultAge });
		expect(d?.backupConfig).toMatchObject({ copies: 3, providerIds: [], regions: ['EU'], ageRecipient: ageRecipient(vaultAge) });
		expect(CUSTOMER_PLACES.regions).toEqual(['EU']);
		expect(customerDefaults({}, { network: 'calibration', vaultAge })?.role).toBe('test');
	});

	it('are written once, release the VM’s backup key, and then leave the start only the image', async () => {
		const s = store({});
		const signer = { payer: '0x00000000000000000000000000000000000000aa', signer: '0x00000000000000000000000000000000000000bb', tag: 'abcd1234', label: 'paperless-customer', network: 'mainnet', fundedUntil: null };
		expect(await applyCustomerDefaults(master, { network: 'mainnet' }, { load: s.load, update: s.update, authorize: async () => signer })).toBe(true);
		expect(s.get()).toMatchObject({ leSpacePays: true, backupsByCredits: true, backupSigner: { payer: signer.payer, network: 'mainnet' } });
		// Nothing but the image is missing: no payer, no wallet, no node, no key.
		expect(startRequirements(s.get())).toEqual(['Paperless-Image', 'Image-Passphrase']);
		// A second time changes nothing.
		expect(await applyCustomerDefaults(master, { network: 'mainnet' }, { load: s.load, update: s.update, authorize: async () => signer })).toBe(false);
	});

	it('leave a profile alone that someone set up in the meantime, and need a known network', async () => {
		const s = store({});
		const update = async (m, fn) => s.update(m, (now) => fn({ ...now, payer: '0x0000000000000000000000000000000000000001' }));
		await applyCustomerDefaults(master, { network: 'mainnet' }, { load: s.load, update, authorize: async () => { throw new Error('no'); } });
		expect(s.get().leSpacePays).toBeUndefined();
		expect(await applyCustomerDefaults(master, { network: null }, { load: s.load, update: s.update })).toBe(false);
	});
});

describe('the node for a start without one fixed', () => {
	const node = (hash, fits) => ({ hash, fits, name: 'n', score: 1, freeVcpus: 4, freeMemoryGiB: 8, freeDiskGiB: 100, place: null, owner: '' });
	it('is the best one with room', async () => {
		expect(await pickNode({ load: async () => [node('a'.repeat(64), false), node('b'.repeat(64), true), node('c'.repeat(64), true)] })).toBe('b'.repeat(64));
	});
	it('is refused in words when none has room or the list cannot be read', async () => {
		await expect(pickNode({ load: async () => [node('a'.repeat(64), false)] })).rejects.toThrow('Gerade hat kein vertraulicher Knoten Platz');
		await expect(pickNode({ load: async () => { throw new Error('offline'); } })).rejects.toThrow('kein vertraulicher Knoten');
	});
});
