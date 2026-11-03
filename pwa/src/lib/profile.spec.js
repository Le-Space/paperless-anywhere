import { describe, expect, it } from 'vitest';
import { vmPayer } from './profile.js';
import { startRequirements } from './lifecycle.js';

const app = '0x00000000000000000000000000000000000000A1';
const wallet = '0x00000000000000000000000000000000000000B2';
const ready = { rootfsItemHash: 'a'.repeat(64), luksPassphrase: 'x', crnHash: 'b'.repeat(64) };

describe('vmPayer', () => {
	it('is the wallet unless the app pays', () => {
		expect(vmPayer({ payer: wallet }, app)).toBe(wallet);
		expect(vmPayer({ payer: wallet, appPays: true }, app)).toBe(app);
		expect(vmPayer({ appPays: true }, app)).toBe(app);
		expect(vmPayer({}, app)).toBeUndefined();
	});
});

describe('startRequirements', () => {
	it('needs a wallet only to pay, or for backups when the app pays', () => {
		expect(startRequirements({ ...ready })).toEqual(['zahlendes Konto']);
		expect(startRequirements({ ...ready, payer: wallet })).toEqual([]);
		expect(startRequirements({ ...ready, appPays: true })).toEqual([]);
		expect(startRequirements({ ...ready, appPays: true, backupConfig: { copies: 2 } })).toEqual(['Wallet für die Sicherungen']);
		expect(startRequirements({ ...ready, appPays: true, payer: wallet, backupConfig: { copies: 2 } })).toEqual([]);
	});
});
