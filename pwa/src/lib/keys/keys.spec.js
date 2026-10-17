import { describe, expect, it } from 'vitest';
import { privateKeyToAccount } from 'viem/accounts';
import { alephPrivateKey, deriveBytes, LABELS, newMasterSecret, paperlessSecrets } from './derive.js';
import { newSeedPhrase, seal, sealingKeyFromPrf, sealingKeyFromSeedPhrase, unseal } from './seal.js';

const master = new Uint8Array(32).fill(7);

describe('derive', () => {
	it('is deterministic and separates purposes', () => {
		expect(deriveBytes(master, LABELS.alephAccount)).toEqual(deriveBytes(master, LABELS.alephAccount));
		expect(deriveBytes(master, LABELS.alephAccount)).not.toEqual(deriveBytes(master, LABELS.vaultKey));
	});
	it('gives a usable Aleph key, the same for the same secret', () => {
		const a = privateKeyToAccount(alephPrivateKey(master)).address;
		expect(a).toMatch(/^0x[0-9a-fA-F]{40}$/);
		expect(privateKeyToAccount(alephPrivateKey(master)).address).toBe(a);
		expect(privateKeyToAccount(alephPrivateKey(newMasterSecret())).address).not.toBe(a);
	});
	it("gives Paperless's secrets as URL-safe text", () => {
		const s = paperlessSecrets(master);
		for (const v of Object.values(s)) expect(v).toMatch(/^[A-Za-z0-9_-]{32,}$/);
		expect(new Set(Object.values(s)).size).toBe(3);
	});
	it('refuses a master secret of the wrong size', () => {
		expect(() => deriveBytes(new Uint8Array(16), LABELS.vaultKey)).toThrow();
	});
});

describe('seal', () => {
	it('opens with the passkey key and with the seed key, not with another', async () => {
		const phrase = newSeedPhrase();
		expect(phrase.split(' ')).toHaveLength(24);
		const byPasskey = await seal(master, sealingKeyFromPrf(new Uint8Array(32).fill(1)), 'master/passkey');
		const bySeed = await seal(master, sealingKeyFromSeedPhrase(phrase), 'master/seed');
		expect(await unseal(byPasskey, sealingKeyFromPrf(new Uint8Array(32).fill(1)))).toEqual(master);
		expect(await unseal(bySeed, sealingKeyFromSeedPhrase(` ${phrase.toUpperCase()} `))).toEqual(master);
		await expect(unseal(byPasskey, sealingKeyFromPrf(new Uint8Array(32).fill(2)))).rejects.toThrow();
	});
	it('notices a changed box or a changed purpose', async () => {
		const key = sealingKeyFromPrf(new Uint8Array(32).fill(3));
		const box = await seal(master, key, 'master/passkey');
		await expect(unseal({ ...box, purpose: 'master/seed' }, key)).rejects.toThrow();
		const ct = atob(box.ct).split('');
		ct[0] = String.fromCharCode(ct[0].charCodeAt(0) ^ 1);
		await expect(unseal({ ...box, ct: btoa(ct.join('')) }, key)).rejects.toThrow();
	});
	it('refuses a seed phrase with a bad checksum', () => {
		expect(() => sealingKeyFromSeedPhrase('abandon '.repeat(24).trim())).toThrow();
	});
});
